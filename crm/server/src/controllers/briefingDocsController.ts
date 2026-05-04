import { Response } from 'express';
import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const lower = (filename || '').toLowerCase();
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
  if (mimeType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return buffer.toString('utf8').trim();
  }
  throw new Error('Unsupported file type. Upload a .pdf, .docx, .txt, or .md file.');
}

export async function uploadBriefingDoc(req: AuthRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const { officeId, clientId, initiativeId, tags, meetingDate } = req.body;
    if (!officeId) return res.status(400).json({ error: 'officeId required' });
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const filename = req.file.originalname;
    const mimeType = req.file.mimetype || 'application/octet-stream';

    const extractedText = await extractText(req.file.buffer, mimeType, filename);
    if (!extractedText || extractedText.length < 30) {
      return res.status(400).json({ error: 'Could not extract meaningful text from this file.' });
    }

    // Tags arrive as JSON string (form-data) or plain array (json body)
    let tagsArr: string[] = [];
    if (typeof tags === 'string') {
      try { tagsArr = JSON.parse(tags); } catch { tagsArr = tags.split(',').map((t: string) => t.trim()).filter(Boolean); }
    } else if (Array.isArray(tags)) {
      tagsArr = tags;
    }
    tagsArr = tagsArr.map(t => String(t).trim()).filter(Boolean);

    const doc = await prisma.briefingDocument.create({
      data: {
        officeId,
        clientId,
        initiativeId: initiativeId || null,
        filename,
        mimeType,
        extractedText,
        tags: JSON.stringify(tagsArr),
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        uploadedByUserId: req.user?.userId || null,
      },
      include: {
        client: { select: { id: true, name: true } },
        office: { select: { id: true, name: true } },
        initiative: { select: { id: true, title: true } },
      },
    });
    return res.status(201).json(serialize(doc));
  } catch (err: any) {
    console.error('Upload briefing doc error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload briefing' });
  }
}

export async function listBriefingDocs(req: AuthRequest, res: Response) {
  try {
    const { officeId, clientId } = req.query;
    const where: any = {};
    if (officeId) where.officeId = officeId;
    if (clientId) where.clientId = clientId;

    const docs = await prisma.briefingDocument.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        office: { select: { id: true, name: true } },
        initiative: { select: { id: true, title: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    return res.json(docs.map(serialize));
  } catch (err) {
    console.error('List briefing docs error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteBriefingDoc(req: AuthRequest, res: Response) {
  try {
    await prisma.briefingDocument.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete' });
  }
}

// All distinct tags across briefing docs — for the tag-bank autocomplete
export async function getBriefingDocTags(_req: AuthRequest, res: Response) {
  try {
    const rows = await prisma.briefingDocument.findMany({ select: { tags: true } });
    const seen = new Set<string>();
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.tags) as string[];
        for (const t of arr) {
          const trimmed = String(t).trim();
          if (trimmed) seen.add(trimmed);
        }
      } catch {
        // tolerate bad rows
      }
    }
    return res.json(Array.from(seen).sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

function serialize(doc: any) {
  let tagsArr: string[] = [];
  try { tagsArr = JSON.parse(doc.tags || '[]'); } catch { /* keep empty */ }
  // Don't ship the full extracted text in list responses — only as a field on the
  // record. UI doesn't need it. Generation reads it server-side.
  const { extractedText, ...rest } = doc;
  return { ...rest, tags: tagsArr, hasText: Boolean(extractedText) };
}
