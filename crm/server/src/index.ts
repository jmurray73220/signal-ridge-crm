import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

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
import { errorHandler } from './middleware/errorHandler';
import { startBackgroundSync } from './services/gmail';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
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

// Gmail routes (mixed auth/api prefix — handled internally in the router)
app.use('/', gmailRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Signal Ridge CRM server running on port ${PORT}`);
  // Start Gmail background sync if previously enabled
  startBackgroundSync().catch(err => console.error('Failed to start Gmail sync:', err));
});

export default app;
