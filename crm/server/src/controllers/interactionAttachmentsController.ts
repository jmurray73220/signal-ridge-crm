import { Response } from 'express';
import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

// Best-effort text extraction. We persist whatever we get (or empty string for
// formats we don't understand) — the original file is always preserved as
// fileData, so the user can still download it back even if we can't index it.
async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const lower = (filename || '').toLowerCase();
  try {
    if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
      const out = await pdfParse(buffer);
      return (out.text || '').trim();
    }
    if (
      mimeType.includes('officedocument.wordprocessingml.document') ||
      lower.endsWith('.docx')
    ) {
      const out = await mammoth.extractRawText({ buffer });
      return (out.value || '').trim();
    }
    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      lower.endsWith('.vtt') ||
      lower.endsWith('.srt') ||
      lower.endsWith('.json')
    ) {
      return buffer.toString('utf8').trim();
    }
  } catch (err) {
    console.error('[interactionAttachments] extractText failed:', err);
  }
  return '';
}

function serialize(att: any) {
  // Don't ship fileData or extractedText in list responses — they can be huge.
  // Callers download the file via the dedicated endpoint.
  const { fileData, extractedText, ...rest } = att;
  return {
    ...rest,
    sizeBytes: fileData ? Math.floor((fileData.length * 3) / 4) : 0,
    hasText: Boolean(extractedText && extractedText.length > 0),
  };
}

// ─── Multipart upload (browser UI) ───────────────────────────────────────────
export async function uploadAttachmentMultipart(req: AuthRequest, res: Response) {
  try {
    const { id: interactionId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const interaction = await prisma.interaction.findUnique({ where: { id: interactionId } });
    if (!interaction || interaction.deletedAt) return res.status(404).json({ error: 'Interaction not found' });

    const filename = req.file.originalname;
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const extractedText = await extractText(req.file.buffer, mimeType, filename);
    const source = (req.body?.source as string) || null;

    const att = await prisma.interactionAttachment.create({
      data: {
        interactionId,
        filename,
        mimeType,
        fileData: req.file.buffer.toString('base64'),
        extractedText,
        source,
        uploadedByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json(serialize(att));
  } catch (err: any) {
    console.error('[uploadAttachmentMultipart]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

// ─── JSON / base64 upload (Bubba and other bots) ─────────────────────────────
// Bots typically run as scripts; multipart from a script is fiddly, so we
// accept a JSON body with base64-encoded file bytes. Body shape:
//   { filename: string, mimeType?: string, base64: string, source?: string }
// `mimeType` is optional — we'll guess from the extension if missing.
export async function uploadAttachmentJson(req: AuthRequest, res: Response) {
  try {
    const { id: interactionId } = req.params;
    const { filename, mimeType, base64, source } = req.body || {};
    if (!filename || !base64) {
      return res.status(400).json({ error: 'filename and base64 required' });
    }

    const interaction = await prisma.interaction.findUnique({ where: { id: interactionId } });
    if (!interaction || interaction.deletedAt) return res.status(404).json({ error: 'Interaction not found' });

    let buffer: Buffer;
    try {
      buffer = Buffer.from(String(base64), 'base64');
    } catch {
      return res.status(400).json({ error: 'base64 is not valid' });
    }
    if (buffer.length === 0) return res.status(400).json({ error: 'Decoded file is empty' });
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'File exceeds 25 MB limit' });
    }

    const guessedMime =
      mimeType ||
      (filename.toLowerCase().endsWith('.txt')
        ? 'text/plain'
        : filename.toLowerCase().endsWith('.md')
        ? 'text/markdown'
        : filename.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : filename.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream');

    const extractedText = await extractText(buffer, guessedMime, filename);

    const att = await prisma.interactionAttachment.create({
      data: {
        interactionId,
        filename,
        mimeType: guessedMime,
        fileData: buffer.toString('base64'),
        extractedText,
        source: source || 'bot',
        uploadedByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json(serialize(att));
  } catch (err: any) {
    console.error('[uploadAttachmentJson]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export async function listAttachments(req: AuthRequest, res: Response) {
  try {
    const { id: interactionId } = req.params;
    const atts = await prisma.interactionAttachment.findMany({
      where: { interactionId },
      orderBy: { uploadedAt: 'desc' },
    });
    return res.json(atts.map(serialize));
  } catch (err) {
    console.error('[listAttachments]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function downloadAttachment(req: AuthRequest, res: Response) {
  try {
    const { attachmentId } = req.params;
    const att = await prisma.interactionAttachment.findUnique({ where: { id: attachmentId } });
    if (!att) return res.status(404).json({ error: 'Not found' });

    const buffer = Buffer.from(att.fileData, 'base64');
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  } catch (err) {
    console.error('[downloadAttachment]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getAttachmentText(req: AuthRequest, res: Response) {
  try {
    const { attachmentId } = req.params;
    const att = await prisma.interactionAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, filename: true, mimeType: true, extractedText: true, uploadedAt: true },
    });
    if (!att) return res.status(404).json({ error: 'Not found' });
    return res.json(att);
  } catch (err) {
    console.error('[getAttachmentText]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteAttachment(req: AuthRequest, res: Response) {
  try {
    const { attachmentId } = req.params;
    await prisma.interactionAttachment.delete({ where: { id: attachmentId } });
    return res.status(204).send();
  } catch (err) {
    console.error('[deleteAttachment]', err);
    return res.status(500).json({ error: 'Failed to delete' });
  }
}
