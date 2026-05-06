import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import contactsRoutes from './routes/contacts';
import entitiesRoutes from './routes/entities';
import initiativesRoutes from './routes/initiatives';
import interactionsRoutes from './routes/interactions';
import tasksRoutes from './routes/tasks';
import remindersRoutes from './routes/reminders';
import searchRoutes from './routes/search';
import exportRoutes from './routes/exportRoutes';
import briefingRoutes from './routes/briefing';
import briefingDocsRoutes from './routes/briefingDocs';
import gmailRoutes from './routes/gmail';
import usersRoutes from './routes/users';
import budgetRoutes from './routes/budgets';
import reportTemplateRoutes from './routes/reportTemplates';
import settingsRoutes from './routes/settings';
import workflowRoutes from './routes/workflow';
import bubbaRoutes from './routes/bubba';
import recycleBinRoutes from './routes/recycleBin';
import botRoutes from './routes/bot';
import { errorHandler } from './middleware/errorHandler';
import { startBackgroundSync } from './services/gmail';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
// Browser UI uses CLIENT_URL with credentials. Bot traffic is server-to-server
// (curl/axios from a VPS — CORS does not apply) but we still allow a
// comma-separated BOT_CORS_ORIGINS list so a browser-based bot tool could hit
// /api/bot/* if needed later. '*' is supported but only when credentials are
// not required, so the bot branch does not set credentials:true.
const uiOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const botOrigins = (process.env.BOT_CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use('/api/bot', cors({
  origin: botOrigins.length === 0 || botOrigins.includes('*') ? true : botOrigins,
  credentials: false,
}));

app.use(cors({
  origin: uiOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/initiatives', initiativesRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/briefing', briefingRoutes);
app.use('/api/briefing-docs', briefingDocsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/bubba', bubbaRoutes);
app.use('/api/bot', botRoutes);
app.use('/api', recycleBinRoutes);

// Gmail routes (mixed auth/api prefix — handled internally in the router)
app.use('/', gmailRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Marketing contact form submissions
app.post('/api/contact', express.json(), (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, and message are required' });
  }
  // TODO: wire up email delivery. For now, log the submission so it's
  // visible in Railway logs and doesn't get dropped.
  console.log('[contact]', JSON.stringify({
    at: new Date().toISOString(),
    name,
    email,
    phone: phone || null,
    message,
  }));
  return res.json({ ok: true });
});

// ─── Static content ────────────────────────────────────────────────
// All paths resolved from process.cwd() which is the repo root both in
// dev (server run from repo root) and production (CMD from /app in
// Dockerfile). Override with CLIENT_DIST_PATH / MARKETING_PATH env vars
// if you run the server from elsewhere.
const marketingPath = process.env.MARKETING_PATH
  || path.join(process.cwd(), 'marketing');
const clientDistPath = process.env.CLIENT_DIST_PATH
  || path.join(process.cwd(), 'crm/client/dist');
const workflowClientDistPath = process.env.WORKFLOW_CLIENT_DIST_PATH
  || path.join(process.cwd(), 'crm/workflow-client/dist');

// Marketing site — root domain
app.use(express.static(marketingPath));
app.get('/', (_req, res) => res.sendFile(path.join(marketingPath, 'index.html')));
app.get('/about', (_req, res) => res.sendFile(path.join(marketingPath, 'about.html')));

// CRM SPA at /crm — static assets first, then a regex catch-all that
// serves index.html for any /crm or /crm/* path not already handled.
// Regex form is explicit and version-agnostic (path-to-regexp changed
// wildcard handling between Express 4 and 5).
app.use('/crm', express.static(clientDistPath));
app.get(/^\/crm(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Workflow SPA at /workflow
app.use('/workflow', express.static(workflowClientDistPath));
app.get(/^\/workflow(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(workflowClientDistPath, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Signal Ridge CRM server running on port ${PORT}`);
  // Start Gmail background sync if previously enabled
  startBackgroundSync().catch(err => console.error('Failed to start Gmail sync:', err));
});

export default app;
