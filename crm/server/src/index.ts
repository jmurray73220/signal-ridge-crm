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
import gmailRoutes from './routes/gmail';
import usersRoutes from './routes/users';
import budgetRoutes from './routes/budgets';
import reportTemplateRoutes from './routes/reportTemplates';
import settingsRoutes from './routes/settings';
import { errorHandler } from './middleware/errorHandler';
import { startBackgroundSync } from './services/gmail';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
app.use('/api/users', usersRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/settings', settingsRoutes);

// Gmail routes (mixed auth/api prefix — handled internally in the router)
app.use('/', gmailRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve React frontend build
// Production: Railway runs `node crm/server/dist/src/index.js` from the
// repo root, so process.cwd() = repo root and client dist lives at
// crm/client/dist. In dev, run the server from the repo root as well
// (or set CLIENT_DIST_PATH to override).
const clientDistPath = process.env.CLIENT_DIST_PATH
  || path.join(process.cwd(), 'crm/client/dist');
app.use(express.static(clientDistPath));

// SPA catch-all — must come after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Signal Ridge CRM server running on port ${PORT}`);
  // Start Gmail background sync if previously enabled
  startBackgroundSync().catch(err => console.error('Failed to start Gmail sync:', err));
});

export default app;
