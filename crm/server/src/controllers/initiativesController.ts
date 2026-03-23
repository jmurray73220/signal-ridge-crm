import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function getInitiatives(req: AuthRequest, res: Response) {
  const { status, priority, entity } = req.query;
  const where: any = {};
  if (status) where.status = status as string;
  if (priority) where.priority = priority as string;
  if (entity) {
    where.OR = [
      { primaryEntityId: entity as string },
      { entities: { some: { entityId: entity as string } } },
    ];
  }

  try {
    const initiatives = await prisma.initiative.findMany({
      where,
      include: {
        primaryEntity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { targetDate: 'asc' }],
    });
    return res.json(initiatives);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const initiative = await prisma.initiative.findUnique({
      where: { id },
      include: {
        primaryEntity: true,
        contacts: {
          include: { contact: { include: { entity: { select: { id: true, name: true, entityType: true } } } } },
        },
        entities: {
          include: { entity: true },
        },
        interactions: {
          include: {
            contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
            entity: { select: { id: true, name: true, entityType: true } },
          },
          orderBy: { date: 'desc' },
        },
        tasks: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
            entity: { select: { id: true, name: true, entityType: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });
    return res.json({
      ...initiative,
      primaryEntity: initiative.primaryEntity ? {
        ...initiative.primaryEntity,
        tags: JSON.parse((initiative.primaryEntity as any).tags || '[]'),
        committee: JSON.parse((initiative.primaryEntity as any).committee || '[]'),
        contractVehicles: JSON.parse((initiative.primaryEntity as any).contractVehicles || '[]'),
      } : null,
      entities: initiative.entities.map(e => ({
        ...e,
        entity: {
          ...e.entity,
          tags: JSON.parse(e.entity.tags || '[]'),
          committee: JSON.parse((e.entity as any).committee || '[]'),
          contractVehicles: JSON.parse((e.entity as any).contractVehicles || '[]'),
        },
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createInitiative(req: AuthRequest, res: Response) {
  const { title, description, status, priority, startDate, targetDate, primaryEntityId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  try {
    const initiative = await prisma.initiative.create({
      data: {
        title,
        description: description || null,
        status: status || 'Pipeline',
        priority: priority || 'Medium',
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        primaryEntityId: primaryEntityId || null,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
      include: {
        primaryEntity: { select: { id: true, name: true, entityType: true } },
      },
    });
    return res.status(201).json(initiative);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, status, priority, startDate, targetDate, primaryEntityId } = req.body;

  try {
    const initiative = await prisma.initiative.update({
      where: { id },
      data: {
        ...(title && { title }),
        description: description !== undefined ? description : undefined,
        ...(status && { status }),
        ...(priority && { priority }),
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        targetDate: targetDate !== undefined ? (targetDate ? new Date(targetDate) : null) : undefined,
        primaryEntityId: primaryEntityId !== undefined ? primaryEntityId : undefined,
        updatedByUserId: req.user!.userId,
      },
      include: { primaryEntity: { select: { id: true, name: true, entityType: true } } },
    });
    return res.json(initiative);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.initiative.delete({ where: { id } });
    return res.json({ message: 'Initiative deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function addInitiativeContact(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { contactId, role } = req.body;
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  try {
    const link = await prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: id, contactId } },
      update: { role: role || null },
      create: { initiativeId: id, contactId, role: role || null },
      include: { contact: { select: { id: true, firstName: true, lastName: true, title: true } } },
    });
    return res.status(201).json(link);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function removeInitiativeContact(req: AuthRequest, res: Response) {
  const { id, contactId } = req.params;
  try {
    await prisma.initiativeContact.delete({
      where: { initiativeId_contactId: { initiativeId: id, contactId } },
    });
    return res.json({ message: 'Contact removed from initiative' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function addInitiativeEntity(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { entityId, relationshipNote } = req.body;
  if (!entityId) return res.status(400).json({ error: 'entityId required' });

  try {
    const link = await prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: id, entityId } },
      update: { relationshipNote: relationshipNote || null },
      create: { initiativeId: id, entityId, relationshipNote: relationshipNote || null },
      include: { entity: { select: { id: true, name: true, entityType: true } } },
    });
    return res.status(201).json(link);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function removeInitiativeEntity(req: AuthRequest, res: Response) {
  const { id, entityId } = req.params;
  try {
    await prisma.initiativeEntity.delete({
      where: { initiativeId_entityId: { initiativeId: id, entityId } },
    });
    return res.json({ message: 'Entity removed from initiative' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
