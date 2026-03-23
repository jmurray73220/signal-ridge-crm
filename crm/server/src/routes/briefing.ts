import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateEntityBriefing, generateContactBriefing } from '../services/briefing';
import { AuthRequest } from '../types';

const router = Router();

router.use(requireAuth);

router.get('/entity/:id', async (req: AuthRequest, res: Response) => {
  try {
    const briefing = await generateEntityBriefing(req.params.id);
    res.json({ briefing });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate briefing' });
  }
});

router.get('/contact/:id', async (req: AuthRequest, res: Response) => {
  try {
    const briefing = await generateContactBriefing(req.params.id);
    res.json({ briefing });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate briefing' });
  }
});

export default router;
