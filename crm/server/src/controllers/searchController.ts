import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function globalSearch(req: AuthRequest, res: Response) {
  const { q } = req.query;
  if (!q || (q as string).length < 2) {
    return res.json({ contacts: [], entities: [], initiatives: [] });
  }

  const query = q as string;

  try {
    const [contacts, entities, initiatives] = await Promise.all([
      prisma.contact.findMany({
        where: {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { title: { contains: query } },
            { email: { contains: query } },
          ],
        },
        include: { entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } } },
        take: 10,
      }),
      prisma.entity.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { memberName: { contains: query } },
            { parentAgency: { contains: query } },
            { subComponent: { contains: query } },
          ],
        },
        take: 10,
      }),
      prisma.initiative.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: { primaryEntity: { select: { id: true, name: true, entityType: true } } },
        take: 10,
      }),
    ]);

    return res.json({
      contacts: contacts.map(c => ({ ...c, tags: JSON.parse(c.tags || '[]'), _type: 'contact' })),
      entities: entities.map(e => ({ ...e, tags: JSON.parse(e.tags || '[]'), _type: 'entity' })),
      initiatives: initiatives.map(i => ({ ...i, _type: 'initiative' })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
