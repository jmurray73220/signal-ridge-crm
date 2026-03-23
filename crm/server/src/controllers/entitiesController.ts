import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

function parseEntityArrayFields(entity: any) {
  return {
    ...entity,
    tags: JSON.parse(entity.tags || '[]'),
    committee: JSON.parse(entity.committee || '[]'),
    subcommittee: JSON.parse(entity.subcommittee || '[]'),
    contractVehicles: JSON.parse(entity.contractVehicles || '[]'),
  };
}

export async function getEntities(req: AuthRequest, res: Response) {
  const { type, search, q } = req.query;
  const where: any = {};
  if (type) where.entityType = type as string;
  const searchTerm = (search || q) as string | undefined;
  if (searchTerm) where.name = { contains: searchTerm };

  try {
    const entities = await prisma.entity.findMany({
      where,
      include: {
        _count: { select: { contacts: true, initiatives: true, interactions: true } },
        interactions: {
          select: { date: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(entities.map(e => ({
      ...parseEntityArrayFields(e),
      lastInteraction: e.interactions[0]?.date || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getEntity(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        contacts: {
          include: {
            interactions: {
              include: { interaction: { select: { date: true } } },
              orderBy: { interaction: { date: 'desc' } },
              take: 1,
            },
          },
        },
        initiatives: {
          where: { primaryEntityId: id },
          include: { _count: { select: { contacts: true } } },
        },
        initiativeLinks: {
          include: {
            initiative: {
              include: {
                primaryEntity: { select: { id: true, name: true, entityType: true } },
                _count: { select: { contacts: true } },
              },
            },
          },
        },
        interactions: {
          include: {
            contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
            initiative: { select: { id: true, title: true } },
          },
          orderBy: { date: 'desc' },
        },
        tasks: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
            initiative: { select: { id: true, title: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    return res.json(parseEntityArrayFields(entity));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createEntity(req: AuthRequest, res: Response) {
  const {
    name, entityType, website, description, address, tags,
    memberName, chamber, state, district, committee, party, subcommittee,
    parentAgency, subComponent, governmentType, budgetLineItem,
    industry, contractVehicles,
  } = req.body;

  if (!name || !entityType) {
    return res.status(400).json({ error: 'Name and entity type required' });
  }

  try {
    const entity = await prisma.entity.create({
      data: {
        name,
        entityType,
        website: website || null,
        description: description || null,
        address: address || null,
        tags: JSON.stringify(tags || []),
        memberName: memberName || null,
        chamber: chamber || null,
        state: state || null,
        district: district || null,
        committee: JSON.stringify(committee || []),
        party: party || null,
        subcommittee: JSON.stringify(subcommittee || []),
        parentAgency: parentAgency || null,
        subComponent: subComponent || null,
        governmentType: governmentType || null,
        budgetLineItem: budgetLineItem || null,
        industry: industry || null,
        contractVehicles: JSON.stringify(contractVehicles || []),
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
    });
    return res.status(201).json(parseEntityArrayFields(entity));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateEntity(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const data = req.body;

  const jsonFields = ['tags', 'committee', 'subcommittee', 'contractVehicles'];
  const updateData: any = { updatedByUserId: req.user!.userId };

  for (const [key, value] of Object.entries(data)) {
    if (jsonFields.includes(key) && Array.isArray(value)) {
      updateData[key] = JSON.stringify(value);
    } else if (value !== undefined) {
      updateData[key] = value;
    }
  }

  try {
    const entity = await prisma.entity.update({ where: { id }, data: updateData });
    return res.json(parseEntityArrayFields(entity));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteEntity(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.entity.delete({ where: { id } });
    return res.json({ message: 'Entity deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getEntityContacts(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const contacts = await prisma.contact.findMany({
      where: { entityId: id },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json(contacts.map(c => ({ ...c, tags: JSON.parse(c.tags || '[]') })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getEntityInitiatives(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const [primary, linked] = await Promise.all([
      prisma.initiative.findMany({
        where: { primaryEntityId: id },
        include: { _count: { select: { contacts: true } } },
      }),
      prisma.initiativeEntity.findMany({
        where: { entityId: id },
        include: {
          initiative: { include: { _count: { select: { contacts: true } } } },
        },
      }),
    ]);
    const linkedInitiatives = linked.map(l => ({ ...l.initiative, relationshipNote: l.relationshipNote }));
    const all = [...primary, ...linkedInitiatives.filter(l => !primary.find(p => p.id === l.id))];
    return res.json(all);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getEntityInteractions(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const interactions = await prisma.interaction.findMany({
      where: { entityId: id },
      include: {
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
        initiative: { select: { id: true, title: true } },
      },
      orderBy: { date: 'desc' },
    });
    return res.json(interactions);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
