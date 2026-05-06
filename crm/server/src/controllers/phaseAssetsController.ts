import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';
import { assertClientAccess } from '../middleware/workflowAuth';

// Helper: confirm the user has access to the track that owns this phase.
async function assertPhaseAccess(req: AuthRequest, phaseId: string): Promise<{ ok: boolean; trackId?: string }> {
  const phase = await prisma.workflowPhase.findUnique({
    where: { id: phaseId },
    select: { id: true, trackId: true, track: { select: { workflowClientId: true } } },
  });
  if (!phase) return { ok: false };
  if (!assertClientAccess(req, phase.track.workflowClientId)) return { ok: false };
  return { ok: true, trackId: phase.trackId };
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function serializeAttachment(att: any) {
  const { fileData, ...rest } = att;
  return {
    ...rest,
    sizeBytes: fileData ? Math.floor((fileData.length * 3) / 4) : 0,
  };
}

export async function uploadPhaseAttachment(req: AuthRequest, res: Response) {
  try {
    const { phaseId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const access = await assertPhaseAccess(req, phaseId);
    if (!access.ok) return res.status(404).json({ error: 'Not found' });

    const att = await prisma.phaseAttachment.create({
      data: {
        phaseId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        fileData: req.file.buffer.toString('base64'),
        uploadedByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json(serializeAttachment(att));
  } catch (err: any) {
    console.error('[uploadPhaseAttachment]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export async function downloadPhaseAttachment(req: AuthRequest, res: Response) {
  try {
    const { attachmentId } = req.params;
    const att = await prisma.phaseAttachment.findUnique({
      where: { id: attachmentId },
      include: { phase: { select: { track: { select: { workflowClientId: true } } } } },
    });
    if (!att) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, att.phase.track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const buffer = Buffer.from(att.fileData, 'base64');
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  } catch (err) {
    console.error('[downloadPhaseAttachment]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deletePhaseAttachment(req: AuthRequest, res: Response) {
  try {
    const { attachmentId } = req.params;
    const att = await prisma.phaseAttachment.findUnique({
      where: { id: attachmentId },
      include: { phase: { select: { track: { select: { workflowClientId: true } } } } },
    });
    if (!att) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, att.phase.track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    await prisma.phaseAttachment.delete({ where: { id: attachmentId } });
    return res.status(204).send();
  } catch (err) {
    console.error('[deletePhaseAttachment]', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}

// ─── Links ───────────────────────────────────────────────────────────────────

export async function createPhaseLink(req: AuthRequest, res: Response) {
  try {
    const { phaseId } = req.params;
    const { url, label } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'url required' });
    }
    const access = await assertPhaseAccess(req, phaseId);
    if (!access.ok) return res.status(404).json({ error: 'Not found' });

    const link = await prisma.phaseLink.create({
      data: {
        phaseId,
        url: url.trim(),
        label: label ? String(label).trim() || null : null,
        createdByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json(link);
  } catch (err) {
    console.error('[createPhaseLink]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deletePhaseLink(req: AuthRequest, res: Response) {
  try {
    const { linkId } = req.params;
    const link = await prisma.phaseLink.findUnique({
      where: { id: linkId },
      include: { phase: { select: { track: { select: { workflowClientId: true } } } } },
    });
    if (!link) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, link.phase.track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    await prisma.phaseLink.delete({ where: { id: linkId } });
    return res.status(204).send();
  } catch (err) {
    console.error('[deletePhaseLink]', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}
