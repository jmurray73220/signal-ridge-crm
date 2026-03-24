import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import {
  getAuthUrl,
  handleCallback,
  searchEmails,
  getThread,
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
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending emails' });
  }
});

router.post('/api/gmail/pending/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const pending = await prisma.gmailPendingEmail.findUnique({ where: { id } });
    if (!pending) return res.status(404).json({ error: 'Not found' });

    // Create an interaction from the pending email
    const interaction = await prisma.interaction.create({
      data: {
        type: 'Email',
        date: pending.emailDate,
        subject: pending.subject,
        notes: `From: ${pending.from}\n\n${pending.snippet ?? ''}`,
        gmailThreadUrl: `https://mail.google.com/mail/u/0/#inbox/${pending.threadId}`,
        entityId: pending.entityId ?? null,
        createdByUserId: req.user!.userId,
        ...(pending.contactId ? {
          contacts: { create: { contactId: pending.contactId } }
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
