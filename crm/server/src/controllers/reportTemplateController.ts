import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function listTemplates(req: AuthRequest, res: Response) {
  try {
    const templates = await prisma.reportTemplate.findMany({
      select: { id: true, name: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(templates);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function uploadTemplate(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '.docx file required' });
    }

    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Template name required' });
    }

    const fileData = req.file.buffer.toString('base64');

    const template = await prisma.reportTemplate.create({
      data: { name, description: description || null, fileData },
    });

    return res.status(201).json({
      id: template.id,
      name: template.name,
      description: template.description,
      createdAt: template.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to upload template' });
  }
}

export async function deleteTemplate(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.reportTemplate.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete template' });
  }
}
