import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateEntityBriefing, generateContactBriefing, generateClientMeetingBriefing } from '../services/briefing';
import { generateBriefingDocx } from '../services/briefingDocx';
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

router.post('/client-meeting', async (req: AuthRequest, res: Response) => {
  try {
    const briefing = await generateClientMeetingBriefing(req.body);
    res.json({ briefing });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate briefing' });
  }
});

router.post('/export-docx', async (req: AuthRequest, res: Response) => {
  try {
    const { briefingMarkdown, filename } = req.body;
    if (!briefingMarkdown) return res.status(400).json({ error: 'briefingMarkdown required' });

    const docxBuffer = await generateBriefingDocx(briefingMarkdown);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'briefing'}.docx"`);
    res.send(docxBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export' });
  }
});

export default router;
