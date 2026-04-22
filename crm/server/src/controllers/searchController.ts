import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';


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
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { rank: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
            { tags: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } } },
        take: 10,
      }),
      prisma.entity.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { memberName: { contains: query, mode: 'insensitive' } },
            { parentAgency: { contains: query, mode: 'insensitive' } },
            { subComponent: { contains: query, mode: 'insensitive' } },
            { industry: { contains: query, mode: 'insensitive' } },
            { committee: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
            { tags: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),
      prisma.initiative.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
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
