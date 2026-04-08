import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

// ─── OAuth ─────────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const oauth2Client = makeOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always return refresh_token
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });
}

export async function handleCallback(code: string) {
  const oauth2Client = makeOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Persist tokens for background sync
  await prisma.gmailCredential.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });

  return tokens;
}

export async function isGmailConnected(): Promise<boolean> {
  const cred = await prisma.gmailCredential.findUnique({ where: { id: 'singleton' } });
  return !!cred;
}

// Returns a fresh access token, refreshing via refresh_token if needed
export async function getValidAccessToken(): Promise<string | null> {
  const cred = await prisma.gmailCredential.findUnique({ where: { id: 'singleton' } });
  if (!cred) return null;

  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token: cred.accessToken,
    refresh_token: cred.refreshToken ?? undefined,
    expiry_date: cred.expiresAt?.getTime(),
  });

  const { token } = await oauth2Client.getAccessToken();
  if (!token) return null;

  // Persist refreshed token if it changed
  if (token !== cred.accessToken) {
    const credentials = oauth2Client.credentials;
    await prisma.gmailCredential.update({
      where: { id: 'singleton' },
      data: {
        accessToken: token,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      },
    });
  }

  return token;
}

// ─── Manual import (unchanged) ──────────────────────────────────────────────

export async function searchEmails(accessToken: string, query: string) {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.threads.list({
    userId: 'me',
    q: query,
    maxResults: 10,
  });

  return response.data.threads || [];
}

export async function getThread(accessToken: string, threadId: string) {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  return response.data;
}

// ─── Background sync ────────────────────────────────────────────────────────

function parseHeader(headers: any[], name: string): string {
  return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function runGmailSync(): Promise<{ added: number }> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return { added: 0 };

  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  // Get sync settings to find the lastSyncAt window
  const settings = await prisma.gmailSyncSettings.findUnique({ where: { id: 'singleton' } });
  const since = settings?.lastSyncAt ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // default: last 90 days
  const afterEpoch = Math.floor(since.getTime() / 1000);

  // Fetch all contacts (including those without email, for name-based matching)
  const allContactsForMatching = await prisma.contact.findMany({
    select: { id: true, email: true, entityId: true, firstName: true, lastName: true },
  });
  // Contacts with emails for Gmail search
  const contacts = allContactsForMatching.filter(c => c.email);
  if (contacts.length === 0 && allContactsForMatching.length === 0) {
    await prisma.gmailSyncSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastSyncAt: new Date() },
      update: { lastSyncAt: new Date() },
    });
    return { added: 0 };
  }

  // Batch contacts into groups of 15 to stay within Gmail query limits
  const allEmails = contacts.map(c => c.email!);
  const batchSize = 15;
  const batches: string[][] = [];
  for (let i = 0; i < allEmails.length; i += batchSize) {
    batches.push(allEmails.slice(i, i + batchSize));
  }

  // Search both from: and to: for each batch, collect all unique threads
  const threadMap = new Map<string, any>();
  for (const batch of batches) {
    const fromTo = batch.map(e => `from:${e} OR to:${e}`).join(' OR ');
    const query = `(${fromTo}) after:${afterEpoch} -subject:"Accepted:" -subject:"Declined:" -subject:"Tentatively accepted:" -subject:"Updated invitation:" -subject:"Canceled event:" -subject:"Invitation:"  -filename:ics`;

    try {
      const response = await gmail.users.threads.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });
      for (const t of (response.data.threads ?? [])) {
        if (t.id && !threadMap.has(t.id)) threadMap.set(t.id, t);
      }
    } catch (err) {
      console.error('Gmail sync batch error:', err);
    }
  }

  const threads = Array.from(threadMap.values());

  let added = 0;

  for (const thread of threads) {
    if (!thread.id) continue;

    // Skip already-known threads
    const exists = await prisma.gmailPendingEmail.findUnique({ where: { threadId: thread.id } });
    if (exists) continue;

    // Fetch full thread for headers + body
    let threadData: any;
    try {
      const r = await gmail.users.threads.get({ userId: 'me', id: thread.id, format: 'full' });
      threadData = r.data;
    } catch {
      continue;
    }

    const firstMsg = threadData.messages?.[0];
    if (!firstMsg) continue;

    const headers = firstMsg.payload?.headers ?? [];
    const from = parseHeader(headers, 'From');
    const to = parseHeader(headers, 'To');
    const cc = parseHeader(headers, 'Cc');
    const subject = parseHeader(headers, 'Subject') || '(no subject)';
    const dateStr = parseHeader(headers, 'Date');
    const emailDate = dateStr ? new Date(dateStr) : new Date();

    // Extract full text body from all messages
    const bodies: string[] = [];
    for (const msg of threadData.messages ?? []) {
      const parts = msg.payload?.parts ?? [msg.payload];
      for (const part of (parts ?? [])) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          bodies.push(Buffer.from(part.body.data, 'base64url').toString('utf-8'));
        }
      }
    }
    const fullBody = bodies.join('\n\n---\n\n');
    const fallbackSnippet = firstMsg.snippet ?? '';

    // Summarize with Claude
    let summary = fallbackSnippet;
    if (fullBody && process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Summarize this email thread concisely for a CRM interaction log. Focus on: who said what, any action items, decisions made, or next steps. Keep it to 2-4 sentences. Do not include greetings, signatures, or boilerplate.\n\nSubject: ${subject}\nFrom: ${from}\n\n${fullBody.slice(0, 8000)}`,
          }],
        });
        const block = response.content[0];
        if (block.type === 'text') summary = block.text;
      } catch (err) {
        console.error('Claude summary failed during sync:', err);
      }
    }

    // Match contacts by email address AND by name in From, To, or CC headers
    const allHeaders = `${from} ${to} ${cc}`;
    const allHeadersLower = allHeaders.toLowerCase();
    const matchedContacts = allContactsForMatching.filter(c => {
      // Match by email address
      if (c.email && allHeaders.includes(c.email)) return true;
      // Match by full name in header display names (e.g., "John Smith <john@senate.gov>")
      if (c.firstName && c.lastName) {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (fullName.length > 3 && allHeadersLower.includes(fullName)) return true;
      }
      return false;
    });
    const primaryContact = matchedContacts[0] ?? null;

    await prisma.gmailPendingEmail.create({
      data: {
        threadId: thread.id,
        subject,
        from,
        snippet: summary,
        emailDate,
        contactId: primaryContact?.id ?? null,
        entityId: primaryContact?.entityId ?? null,
        matchedContactIds: JSON.stringify(matchedContacts.map(c => c.id)),
        status: 'pending',
      },
    });
    added++;
  }

  // Update lastSyncAt
  await prisma.gmailSyncSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', lastSyncAt: new Date() },
    update: { lastSyncAt: new Date() },
  });

  console.log(`Gmail sync: added ${added} pending emails`);
  return { added };
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

let syncInterval: NodeJS.Timeout | null = null;

export async function startBackgroundSync() {
  // Clear any existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  const settings = await prisma.gmailSyncSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.enabled) return;

  const intervalMs = (settings.syncIntervalMinutes ?? 60) * 60 * 1000;

  // Run immediately, then on interval
  runGmailSync().catch(err => console.error('Background sync error:', err));

  syncInterval = setInterval(() => {
    runGmailSync().catch(err => console.error('Background sync error:', err));
  }, intervalMs);

  console.log(`Gmail background sync started (every ${settings.syncIntervalMinutes} min)`);
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
