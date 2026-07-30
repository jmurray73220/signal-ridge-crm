import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';
import { assertClientAccess } from '../middleware/workflowAuth';

// Client-level document repository. Files are stored base64 in Postgres
// (matching PhaseAttachment). Access is scoped by WorkflowClient via
// assertClientAccess: the firm (WorkflowAdmin) sees every client's repo, a
// client user only their own. Route middleware gates who may hit each verb —
// upload/download are open to any workflow user (client scope checked here),
// delete is firm-only (requireWorkflowEditor on the route).

// Strip the heavy base64 payload before sending a document to the client.
function serialize(doc: any) {
  const { fileData, ...rest } = doc;
  return rest;
}

export async function listDocuments(req: AuthRequest, res: Response) {
  try {
    const workflowClientId = String(req.query.workflowClientId || '');
    if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
    if (!assertClientAccess(req, workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const docs = await prisma.workflowDocument.findMany({
      where: { workflowClientId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true, workflowClientId: true, filename: true, description: true,
        mimeType: true, sizeBytes: true, uploadedByUserId: true,
        uploadedByName: true, uploadedAt: true, updatedAt: true,
      },
    });
    return res.json(docs);
  } catch (err: any) {
    console.error('[listDocuments]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function uploadDocument(req: AuthRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const workflowClientId = String(req.body.workflowClientId || '');
    if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
    if (!assertClientAccess(req, workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    // Confirm the client exists so we don't strand an orphan row.
    const client = await prisma.workflowClient.findUnique({ where: { id: workflowClientId }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Denormalize the uploader's name for display (JWT carries only the id).
    let uploadedByName: string | null = null;
    if (req.user?.userId) {
      const u = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { firstName: true, lastName: true },
      });
      if (u) uploadedByName = `${u.firstName} ${u.lastName}`.trim() || null;
    }

    const description = typeof req.body.description === 'string' ? req.body.description.trim() || null : null;
    // Allow a display filename override; default to the uploaded file's name.
    const filename = (typeof req.body.filename === 'string' && req.body.filename.trim())
      ? req.body.filename.trim()
      : req.file.originalname;

    const doc = await prisma.workflowDocument.create({
      data: {
        workflowClientId,
        filename,
        description,
        mimeType: req.file.mimetype || 'application/octet-stream',
        fileData: req.file.buffer.toString('base64'),
        sizeBytes: req.file.size,
        uploadedByUserId: req.user?.userId || null,
        uploadedByName,
      },
      select: {
        id: true, workflowClientId: true, filename: true, description: true,
        mimeType: true, sizeBytes: true, uploadedByUserId: true,
        uploadedByName: true, uploadedAt: true, updatedAt: true,
      },
    });
    return res.status(201).json(doc);
  } catch (err: any) {
    console.error('[uploadDocument]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export async function downloadDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const doc = await prisma.workflowDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, doc.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const buffer = Buffer.from(doc.fileData, 'base64');
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  } catch (err) {
    console.error('[downloadDocument]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Rename / re-describe a document. Firm-only (route uses requireWorkflowEditor).
export async function updateDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const doc = await prisma.workflowDocument.findUnique({
      where: { id },
      select: { id: true, workflowClientId: true },
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, doc.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const data: { filename?: string; description?: string | null } = {};
    if (typeof req.body.filename === 'string' && req.body.filename.trim()) data.filename = req.body.filename.trim();
    if (typeof req.body.description === 'string') data.description = req.body.description.trim() || null;

    const updated = await prisma.workflowDocument.update({
      where: { id },
      data,
      select: {
        id: true, workflowClientId: true, filename: true, description: true,
        mimeType: true, sizeBytes: true, uploadedByUserId: true,
        uploadedByName: true, uploadedAt: true, updatedAt: true,
      },
    });
    return res.json(updated);
  } catch (err) {
    console.error('[updateDocument]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Delete a document. Firm-only (route uses requireWorkflowEditor).
export async function deleteDocument(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const doc = await prisma.workflowDocument.findUnique({
      where: { id },
      select: { id: true, workflowClientId: true },
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, doc.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    await prisma.workflowDocument.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error('[deleteDocument]', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}
