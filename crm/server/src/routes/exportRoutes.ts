import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { exportContacts, exportEntities, exportInteractions } from '../services/export';
import { AuthRequest } from '../types';

const router = Router();

router.use(requireAuth);

router.get('/contacts', async (req: AuthRequest, res: Response) => {
  const csv = await exportContacts();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.send(csv);
});

router.get('/entities', async (req: AuthRequest, res: Response) => {
  const { type } = req.query;
  const csv = await exportEntities(type as string | undefined);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="entities.csv"');
  res.send(csv);
});

router.get('/interactions', async (req: AuthRequest, res: Response) => {
  const csv = await exportInteractions();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="interactions.csv"');
  res.send(csv);
});

export default router;
