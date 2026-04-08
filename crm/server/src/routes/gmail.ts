import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth';
import {
  getAuthUrl,
  handleCallback,
  searchEmails,
  getThread,
  getValidAccessToken,
  isGmailConnected,
  runGmailSync,
  startBackgroundSync,
  stopBackgroundSync,
} from '../services/gmail';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

// ─── OAuth (unprotected) ─────────────────────────────────────────────────────

router.get('/auth/gmail', (req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

router.get('/auth/gmail/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const tokens = await handleCallback(code as string);
    // Also set session cookie for manual import
    res.cookie('gmail_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.redirect('http://localhost:5173/settings/gmail?gmail=connected');
  } catch (err) {
    console.error('Gmail OAuth callback error:', err);
    res.redirect('http://localhost:5173/settings/gmail?gmail=error');
  }
});

// ─── Manual import (unchanged) ───────────────────────────────────────────────

router.get('/api/gmail/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const accessToken = req.cookies?.gmail_token;
  if (!accessToken) return res.status(401).json({ error: 'Gmail not connected', needsAuth: true });
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const threads = await searchEmails(accessToken, q as string);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: 'Gmail search failed' });
  }
});

router.get('/api/gmail/thread/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const accessToken = req.cookies?.gmail_token;
  if (!accessToken) return res.status(401).json({ error: 'Gmail not connected', needsAuth: true });

  try {
    const thread = await getThread(accessToken, req.params.id);
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// ─── Sync status ─────────────────────────────────────────────────────────────

router.get('/api/gmail/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const connected = await isGmailConnected();
    const settings = await prisma.gmailSyncSettings.findUnique({ where: { id: 'singleton' } });
    const pendingCount = await prisma.gmailPendingEmail.count({ where: { status: 'pending' } });

    res.json({
      connected,
      enabled: settings?.enabled ?? false,
      syncIntervalMinutes: settings?.syncIntervalMinutes ?? 60,
      lastSyncAt: settings?.lastSyncAt ?? null,
      pendingCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Gmail status' });
  }
});

// ─── Sync settings ───────────────────────────────────────────────────────────

router.get('/api/gmail/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.gmailSyncSettings.findUnique({ where: { id: 'singleton' } });
    res.json(settings ?? { enabled: false, syncIntervalMinutes: 60, lastSyncAt: null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/api/gmail/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  const { enabled, syncIntervalMinutes } = req.body;

  try {
    const settings = await prisma.gmailSyncSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', enabled: !!enabled, syncIntervalMinutes: syncIntervalMinutes ?? 60 },
      update: { enabled: !!enabled, syncIntervalMinutes: syncIntervalMinutes ?? 60 },
    });

    // Restart/stop background sync based on new setting
    if (settings.enabled) {
      await startBackgroundSync();
    } else {
      stopBackgroundSync();
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── Manual sync trigger ─────────────────────────────────────────────────────

router.post('/api/gmail/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await runGmailSync();
    res.json({ message: `Sync complete. ${result.added} new email(s) added to review queue.`, ...result });
  } catch (err) {
    console.error('Manual sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ─── Pending review queue ────────────────────────────────────────────────────

router.get('/api/gmail/pending', requireAuth, async (req: AuthRequest, res: Response) => {
  const { status = 'pending' } = req.query;

  try {
    const items = await prisma.gmailPendingEmail.findMany({
      where: { status: status as string },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        entity: { select: { id: true, name: true, entityType: true } },
      },
      orderBy: { emailDate: 'desc' },
    });

    // Resolve matchedContactIds to full contact objects
    const allContactIds = new Set<string>();
    for (const item of items) {
      try {
        const ids: string[] = JSON.parse(item.matchedContactIds || '[]');
        ids.forEach(id => allContactIds.add(id));
      } catch { /* ignore */ }
    }
    const contactsMap = new Map<string, any>();
    if (allContactIds.size > 0) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: Array.from(allContactIds) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      contacts.forEach(c => contactsMap.set(c.id, c));
    }

    const enriched = items.map(item => {
      let matchedContacts: any[] = [];
      try {
        const ids: string[] = JSON.parse(item.matchedContactIds || '[]');
        matchedContacts = ids.map(id => contactsMap.get(id)).filter(Boolean);
      } catch { /* ignore */ }
      return { ...item, matchedContacts };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending emails' });
  }
});

router.post('/api/gmail/pending/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const pending = await prisma.gmailPendingEmail.findUnique({ where: { id } });
    if (!pending) return res.status(404).json({ error: 'Not found' });

    const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${pending.threadId}`;

    // Fetch full email body from Gmail for summarization
    let fullBody = pending.snippet ?? '';
    try {
      const accessToken = await getValidAccessToken();
      if (accessToken) {
        const thread = await getThread(accessToken, pending.threadId);
        // Extract text content from all messages in the thread
        const bodies: string[] = [];
        for (const msg of (thread as any).messages ?? []) {
          const parts = msg.payload?.parts ?? [msg.payload];
          for (const part of parts) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              bodies.push(Buffer.from(part.body.data, 'base64url').toString('utf-8'));
            }
          }
        }
        if (bodies.length > 0) fullBody = bodies.join('\n\n---\n\n');
      }
    } catch (err) {
      console.error('Failed to fetch full thread for summary:', err);
    }

    // Summarize with Claude
    let summary = `From: ${pending.from}\n\n${pending.snippet ?? ''}`;
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Summarize this email thread concisely for a CRM interaction log. Focus on: who said what, any action items, decisions made, or next steps. Keep it to 2-4 sentences. Do not include greetings, signatures, or boilerplate.\n\nSubject: ${pending.subject}\nFrom: ${pending.from}\n\n${fullBody.slice(0, 8000)}`,
        }],
      });
      const block = response.content[0];
      if (block.type === 'text') {
        summary = block.text;
      }
    } catch (err) {
      console.error('Claude summarization failed, using snippet:', err);
    }

    const notes = `${summary}\n\n📧 [View full thread in Gmail](${threadUrl})`;

    // Get all matched contact IDs (from matchedContactIds or fall back to contactId)
    let contactIds: string[] = [];
    try {
      contactIds = JSON.parse(pending.matchedContactIds || '[]');
    } catch { /* ignore */ }
    if (contactIds.length === 0 && pending.contactId) {
      contactIds = [pending.contactId];
    }

    const interaction = await prisma.interaction.create({
      data: {
        type: 'Email',
        date: pending.emailDate,
        subject: pending.subject,
        notes,
        gmailThreadUrl: threadUrl,
        entityId: pending.entityId ?? null,
        createdByUserId: req.user!.userId,
        ...(contactIds.length > 0 ? {
          contacts: { create: contactIds.map(cid => ({ contactId: cid })) }
        } : {}),
      },
    });

    await prisma.gmailPendingEmail.update({
      where: { id },
      data: { status: 'approved' },
    });

    res.json({ interaction });
  } catch (err) {
    console.error('Approve pending email error:', err);
    res.status(500).json({ error: 'Failed to approve email' });
  }
});

router.patch('/api/gmail/pending/:id/contacts', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { contactIds } = req.body; // string[]

  try {
    await prisma.gmailPendingEmail.update({
      where: { id },
      data: {
        matchedContactIds: JSON.stringify(contactIds || []),
        contactId: contactIds?.[0] ?? null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update contacts' });
  }
});

router.post('/api/gmail/pending/:id/dismiss', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.gmailPendingEmail.update({
      where: { id },
      data: { status: 'dismissed' },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss email' });
  }
});

// Re-match contacts on all pending emails by checking From/To/CC against contact emails
router.post('/api/gmail/rematch-contacts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Gmail not connected' });

    const pending = await prisma.gmailPendingEmail.findMany({ where: { status: 'pending' } });
    const allContacts = await prisma.contact.findMany({
      select: { id: true, email: true, entityId: true, firstName: true, lastName: true },
    });

    let updated = 0;

    for (const item of pending) {
      // Fetch thread to get To/CC headers
      let allHeaders = item.from;
      try {
        const thread = await getThread(accessToken, item.threadId);
        const firstMsg = (thread as any).messages?.[0];
        if (firstMsg) {
          const headers = firstMsg.payload?.headers ?? [];
          const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value ?? '';
          const cc = headers.find((h: any) => h.name.toLowerCase() === 'cc')?.value ?? '';
          allHeaders = `${item.from} ${to} ${cc}`;
        }
      } catch { /* use just From */ }

      const allHeadersLower = allHeaders.toLowerCase();
      const matched = allContacts.filter(c => {
        if (c.email && allHeaders.includes(c.email)) return true;
        if (c.firstName && c.lastName) {
          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
          if (fullName.length > 3 && allHeadersLower.includes(fullName)) return true;
        }
        return false;
      });
      if (matched.length > 0) {
        const primary = matched[0];
        await prisma.gmailPendingEmail.update({
          where: { id: item.id },
          data: {
            contactId: primary.id,
            entityId: primary.entityId ?? item.entityId,
            matchedContactIds: JSON.stringify(matched.map(c => c.id)),
          },
        });
        updated++;
      }
    }

    res.json({ message: `Re-matched contacts on ${updated} pending email(s)`, updated });
  } catch (err) {
    console.error('Re-match contacts error:', err);
    res.status(500).json({ error: 'Re-match failed' });
  }
});

// Re-summarize all pending emails in the review queue
router.post('/api/gmail/resummarize-pending', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Gmail not connected' });

    const pending = await prisma.gmailPendingEmail.findMany({ where: { status: 'pending' } });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let updated = 0;
    let failed = 0;

    for (const item of pending) {
      // Fetch full thread
      let fullBody = '';
      try {
        const thread = await getThread(accessToken, item.threadId);
        const bodies: string[] = [];
        for (const msg of (thread as any).messages ?? []) {
          const parts = msg.payload?.parts ?? [msg.payload];
          for (const part of (parts ?? [])) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              bodies.push(Buffer.from(part.body.data, 'base64url').toString('utf-8'));
            }
          }
        }
        if (bodies.length > 0) fullBody = bodies.join('\n\n---\n\n');
      } catch {
        failed++;
        continue;
      }

      if (!fullBody) { failed++; continue; }

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Summarize this email thread concisely for a CRM interaction log. Focus on: who said what, any action items, decisions made, or next steps. Keep it to 2-4 sentences. Do not include greetings, signatures, or boilerplate.\n\nSubject: ${item.subject}\nFrom: ${item.from}\n\n${fullBody.slice(0, 8000)}`,
          }],
        });
        const block = response.content[0];
        if (block.type === 'text') {
          await prisma.gmailPendingEmail.update({
            where: { id: item.id },
            data: { snippet: block.text },
          });
          updated++;
        }
      } catch (err) {
        console.error(`Failed to summarize pending ${item.id}:`, err);
        failed++;
      }
    }

    res.json({ message: `Re-summarized ${updated} pending email(s)${failed ? `, ${failed} failed` : ''}`, updated, failed });
  } catch (err) {
    console.error('Re-summarize pending error:', err);
    res.status(500).json({ error: 'Re-summarize failed' });
  }
});

// Re-summarize all existing Gmail interactions that only have snippets
router.post('/api/gmail/resummarize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Gmail not connected' });

    // Find all interactions that came from Gmail (have a gmailThreadUrl)
    const interactions = await prisma.interaction.findMany({
      where: { gmailThreadUrl: { not: null } },
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let updated = 0;
    let failed = 0;

    for (const interaction of interactions) {
      const threadId = interaction.gmailThreadUrl!.split('/').pop();
      if (!threadId) { failed++; continue; }

      // Fetch full thread
      let fullBody = '';
      try {
        const thread = await getThread(accessToken, threadId);
        const bodies: string[] = [];
        for (const msg of (thread as any).messages ?? []) {
          const parts = msg.payload?.parts ?? [msg.payload];
          for (const part of parts) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              bodies.push(Buffer.from(part.body.data, 'base64url').toString('utf-8'));
            }
          }
        }
        if (bodies.length > 0) fullBody = bodies.join('\n\n---\n\n');
      } catch {
        failed++;
        continue;
      }

      if (!fullBody) { failed++; continue; }

      // Summarize with Claude
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Summarize this email thread concisely for a CRM interaction log. Focus on: who said what, any action items, decisions made, or next steps. Keep it to 2-4 sentences. Do not include greetings, signatures, or boilerplate.\n\nSubject: ${interaction.subject}\n\n${fullBody.slice(0, 8000)}`,
          }],
        });
        const block = response.content[0];
        if (block.type === 'text') {
          const notes = `${block.text}\n\n📧 [View full thread in Gmail](${interaction.gmailThreadUrl})`;
          await prisma.interaction.update({
            where: { id: interaction.id },
            data: { notes },
          });
          updated++;
        }
      } catch (err) {
        console.error(`Failed to summarize interaction ${interaction.id}:`, err);
        failed++;
      }
    }

    res.json({ message: `Re-summarized ${updated} interaction(s)${failed ? `, ${failed} failed` : ''}`, updated, failed });
  } catch (err) {
    console.error('Re-summarize error:', err);
    res.status(500).json({ error: 'Re-summarize failed' });
  }
});

router.delete('/api/gmail/disconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.gmailCredential.deleteMany({});
    stopBackgroundSync();
    res.clearCookie('gmail_token');
    res.json({ message: 'Gmail disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;
