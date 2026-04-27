import { Response } from 'express';
import prisma from '../services/prisma';
import { rawPrisma } from '../services/prisma';
import { softDelete, logUpdate } from '../services/audit';
import { AuthRequest } from '../types';

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
          include: { contact: { include: { entity: { select: { id: true, name: true, entityType: true, chamber: true, committee: true, party: true, subcommittee: true, governmentType: true } } } } },
          orderBy: { sortOrder: 'asc' },
        },
        entities: {
          include: { entity: true },
        },
        interactions: {
          include: {
            contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
            entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } },
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
    const before = await prisma.initiative.findUnique({ where: { id } });
    if (!before || before.deletedAt) return res.status(404).json({ error: 'Not found' });
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
    await logUpdate({
      entityType: 'Initiative',
      id,
      userId: req.user?.userId || null,
      before: before as unknown as Record<string, unknown>,
      after: initiative as unknown as Record<string, unknown>,
    });
    return res.json(initiative);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.userId || null;
  try {
    const existing = await prisma.initiative.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });

    // Cascade: any workflow track pointing at this initiative gets soft-deleted
    // too, along with its SOW. Must use rawPrisma because workflow tracks
    // may already be soft-deleted (we still want to know about them).
    const linkedTracks = await rawPrisma.workflowTrack.findMany({
      where: { initiativeId: id, deletedAt: null },
      include: { sow: { select: { id: true, title: true, status: true } } },
    });
    for (const t of linkedTracks) {
      if (t.sow) {
        await softDelete({
          modelName: 'workflowSOW',
          entityType: 'WorkflowSOW',
          id: t.sow.id,
          userId,
          snapshot: t.sow as unknown as Record<string, unknown>,
        });
      }
      await softDelete({
        modelName: 'workflowTrack',
        entityType: 'WorkflowTrack',
        id: t.id,
        userId,
        snapshot: t as unknown as Record<string, unknown>,
      });
    }

    await softDelete({
      modelName: 'initiative',
      entityType: 'Initiative',
      id,
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });
    return res.json({
      message: linkedTracks.length > 0
        ? `Initiative moved to recycle bin (plus ${linkedTracks.length} workflow track(s))`
        : 'Initiative moved to recycle bin',
    });
  } catch (err) {
    console.error('[deleteInitiative]', err);
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

export async function reorderInitiativeContacts(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { order } = req.body; // Array of { contactId, sortOrder }
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });

  try {
    await Promise.all(
      order.map((item: { contactId: string; sortOrder: number }) =>
        prisma.initiativeContact.update({
          where: { initiativeId_contactId: { initiativeId: id, contactId: item.contactId } },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    return res.json({ message: 'Order updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Bot-specific shape ─────────────────────────────────────────────────────
//
// The bot/external-machine API expects a flatter shape than the CRM UI:
//   client (alias for primaryEntity, scoped to id/name/entityType)
//   tasks (id, title, completed, dueDate)
//   contacts (id, firstName, lastName, title, entityName)
// Soft-deleted rows are excluded automatically by the prisma extension (see
// services/prisma.ts).

const BOT_INITIATIVE_INCLUDE = {
  primaryEntity: { select: { id: true, name: true, entityType: true } },
  tasks: { select: { id: true, title: true, completed: true, dueDate: true } },
  contacts: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          entity: { select: { name: true } },
        },
      },
    },
  },
};

function shapeBotInitiative(i: any) {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    status: i.status,
    priority: i.priority,
    startDate: i.startDate,
    targetDate: i.targetDate,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    client: i.primaryEntity,
    tasks: i.tasks,
    contacts: i.contacts.map((c: any) => ({
      id: c.contact.id,
      firstName: c.contact.firstName,
      lastName: c.contact.lastName,
      title: c.contact.title,
      entityName: c.contact.entity?.name || null,
    })),
  };
}

export async function getBotInitiatives(_req: AuthRequest, res: Response) {
  try {
    const initiatives = await prisma.initiative.findMany({
      include: BOT_INITIATIVE_INCLUDE,
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { targetDate: 'asc' }],
    });
    return res.json(initiatives.map(shapeBotInitiative));
  } catch (err) {
    console.error('[getBotInitiatives]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getBotInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const initiative = await prisma.initiative.findUnique({
      where: { id },
      include: BOT_INITIATIVE_INCLUDE,
    });
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });
    return res.json(shapeBotInitiative(initiative));
  } catch (err) {
    console.error('[getBotInitiative]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function patchBotInitiative(req: AuthRequest, res: Response) {
  const { id } = req.params;
  // Whitelist: only these fields are patchable via the bot. Anything else in
  // the body (id, clientId, createdAt, relations, etc.) is ignored.
  const { status, description } = req.body;

  try {
    const before = await prisma.initiative.findUnique({ where: { id } });
    if (!before || before.deletedAt) return res.status(404).json({ error: 'Not found' });

    const data: { status?: string; description?: string | null; updatedByUserId?: string } = {
      updatedByUserId: req.user!.userId,
    };
    if (status !== undefined) data.status = status;
    if (description !== undefined) data.description = description;

    const initiative = await prisma.initiative.update({
      where: { id },
      data,
      include: BOT_INITIATIVE_INCLUDE,
    });
    await logUpdate({
      entityType: 'Initiative',
      id,
      userId: req.user?.userId || null,
      before: before as unknown as Record<string, unknown>,
      after: initiative as unknown as Record<string, unknown>,
    });
    return res.json(shapeBotInitiative(initiative));
  } catch (err) {
    console.error('[patchBotInitiative]', err);
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
