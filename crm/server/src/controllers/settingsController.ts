import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';

export async function getSettings(req: AuthRequest, res: Response) {
  try {
    let settings = await prisma.crmSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.crmSettings.create({
        data: { id: 'singleton', majorityParty: 'Republican' },
      });
    }
    return res.json({
      majorityParty: settings.majorityParty,
      hasLogo: !!settings.logoData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSettings(req: AuthRequest, res: Response) {
  const { majorityParty } = req.body;
  try {
    const settings = await prisma.crmSettings.upsert({
      where: { id: 'singleton' },
      update: {
        ...(majorityParty !== undefined && { majorityParty }),
      },
      create: {
        id: 'singleton',
        majorityParty: majorityParty || 'Republican',
      },
    });
    return res.json({
      majorityParty: settings.majorityParty,
      hasLogo: !!settings.logoData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function uploadLogo(req: AuthRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const logoData = req.file.buffer.toString('base64');
    const logoMimeType = req.file.mimetype;

    await prisma.crmSettings.upsert({
      where: { id: 'singleton' },
      update: { logoData, logoMimeType },
      create: { id: 'singleton', logoData, logoMimeType },
    });

    return res.json({ message: 'Logo uploaded' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getLogo(req: AuthRequest, res: Response) {
  try {
    const settings = await prisma.crmSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.logoData || !settings.logoMimeType) {
      return res.status(404).json({ error: 'No logo' });
    }
    const buffer = Buffer.from(settings.logoData, 'base64');
    res.setHeader('Content-Type', settings.logoMimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteLogo(req: AuthRequest, res: Response) {
  try {
    await prisma.crmSettings.update({
      where: { id: 'singleton' },
      data: { logoData: null, logoMimeType: null },
    });
    return res.json({ message: 'Logo removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
