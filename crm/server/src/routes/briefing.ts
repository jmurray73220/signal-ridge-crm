import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateEntityBriefing, generateContactBriefing, generateClientMeetingBriefing, extractDraftFromReferences } from '../services/briefing';
import { generateBriefingDocx } from '../services/briefingDocx';
import { findMember, fetchMemberPortrait } from '../services/memberLookup';
import prisma from '../services/prisma';
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

router.post('/extract-draft', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = Array.isArray(req.body?.referenceBriefingIds)
      ? req.body.referenceBriefingIds
      : [];
    const draft = await extractDraftFromReferences(ids);
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extract draft' });
  }
});

router.post('/export-docx', async (req: AuthRequest, res: Response) => {
  try {
    const { briefingMarkdown, filename, officeId } = req.body;
    if (!briefingMarkdown) return res.status(400).json({ error: 'briefingMarkdown required' });

    // If an officeId was provided and it's a CongressionalOffice, attempt to
    // look up the member's official portrait. All failures are soft — the
    // briefing still exports without the image.
    let memberPortrait: { buffer: Buffer; mimeType: string } | null = null;
    if (officeId) {
      try {
        const office = await prisma.entity.findUnique({ where: { id: officeId } });
        if (office && office.entityType === 'CongressionalOffice' && office.name) {
          console.log('[portrait] looking up:', { name: office.name, chamber: office.chamber, state: office.state });
          const match = await findMember({
            displayName: office.name,
            chamber: office.chamber,
            state: office.state,
          });
          console.log('[portrait] match:', match);
          if (match) {
            memberPortrait = await fetchMemberPortrait(match.bioguideId, match.chamber);
            console.log('[portrait] fetched bytes:', memberPortrait?.buffer.length || 0);
          }
        }
      } catch (lookupErr) {
        // Don't block export on portrait lookup failure
        console.warn('[portrait] lookup failed:', lookupErr);
      }
    }

    const docxBuffer = await generateBriefingDocx(briefingMarkdown, { memberPortrait });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'briefing'}.docx"`);
    res.send(docxBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export' });
  }
});

export default router;
