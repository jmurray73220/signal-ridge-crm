import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';
import { getClientScope } from '../services/clientScope';


export async function globalSearch(req: AuthRequest, res: Response) {
  const { q } = req.query;
  if (!q || (q as string).length < 2) {
    return res.json({ contacts: [], entities: [], initiatives: [] });
  }

  const query = q as string;

  // Resolve client scoping once. A scoped client with no linked CRM entity
  // sees nothing; otherwise every result type is constrained to their entity.
  const scope = await getClientScope(req);
  if (scope && !scope.clientId) {
    return res.json({ contacts: [], entities: [], initiatives: [] });
  }
  const cid = scope?.clientId;
  const withScope = (textOr: any[], scopeOr: any[]) =>
    cid ? { AND: [{ OR: textOr }, { OR: scopeOr }] } : { OR: textOr };

  try {
    const [contacts, entities, initiatives] = await Promise.all([
      prisma.contact.findMany({
        where: withScope(
          [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { rank: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
            { tags: { contains: query, mode: 'insensitive' } },
          ],
          [{ entityId: cid! }, { tags: { contains: scope?.clientName } }],
        ),
        include: { entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } } },
        take: 10,
      }),
      prisma.entity.findMany({
        where: withScope(
          [
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
          [{ id: cid! }],
        ),
        take: 10,
      }),
      prisma.initiative.findMany({
        where: withScope(
          [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          [{ primaryEntityId: cid! }, { entities: { some: { entityId: cid! } } }],
        ),
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
