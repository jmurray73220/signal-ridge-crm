import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

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
async function getValidAccessToken(): Promise<string | null> {
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
  const since = settings?.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days
  const afterEpoch = Math.floor(since.getTime() / 1000);

  // Fetch all contacts with email addresses
  const contacts = await prisma.contact.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, entityId: true },
  });
  if (contacts.length === 0) {
    await prisma.gmailSyncSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastSyncAt: new Date() },
      update: { lastSyncAt: new Date() },
    });
    return { added: 0 };
  }

  // Build a search query: emails from any known contact since lastSync
  const emailList = contacts.map(c => c.email!).slice(0, 20); // Gmail OR limit
  const query = `(${emailList.map(e => `from:${e}`).join(' OR ')}) after:${afterEpoch}`;

  let threads: any[] = [];
  try {
    const response = await gmail.users.threads.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });
    threads = response.data.threads ?? [];
  } catch (err) {
    console.error('Gmail sync list error:', err);
    return { added: 0 };
  }

  let added = 0;

  for (const thread of threads) {
    if (!thread.id) continue;

    // Skip already-known threads
    const exists = await prisma.gmailPendingEmail.findUnique({ where: { threadId: thread.id } });
    if (exists) continue;

    // Fetch thread details
    let threadData: any;
    try {
      const r = await gmail.users.threads.get({ userId: 'me', id: thread.id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'] });
      threadData = r.data;
    } catch {
      continue;
    }

    const firstMsg = threadData.messages?.[0];
    if (!firstMsg) continue;

    const headers = firstMsg.payload?.headers ?? [];
    const from = parseHeader(headers, 'From');
    const subject = parseHeader(headers, 'Subject') || '(no subject)';
    const dateStr = parseHeader(headers, 'Date');
    const snippet = firstMsg.snippet ?? '';
    const emailDate = dateStr ? new Date(dateStr) : new Date();

    // Match to a contact by email address in the From header
    const matchedContact = contacts.find(c => c.email && from.includes(c.email));

    await prisma.gmailPendingEmail.create({
      data: {
        threadId: thread.id,
        subject,
        from,
        snippet,
        emailDate,
        contactId: matchedContact?.id ?? null,
        entityId: matchedContact?.entityId ?? null,
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
