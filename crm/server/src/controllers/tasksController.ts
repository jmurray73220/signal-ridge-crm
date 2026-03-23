import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function getTasks(req: AuthRequest, res: Response) {
  const { contactId, entityId, initiativeId, completed } = req.query;
  const where: any = {};

  if (contactId) where.contactId = contactId as string;
  if (entityId) where.entityId = entityId as string;
  if (initiativeId) where.initiativeId = initiativeId as string;
  if (completed !== undefined) where.completed = completed === 'true';

  try {
    const tasks = await prisma.task.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
      },
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
    });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createTask(req: AuthRequest, res: Response) {
  const { title, dueDate, contactId, entityId, initiativeId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  try {
    const task = await prisma.task.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed: false,
        contactId: contactId || null,
        entityId: entityId || null,
        initiativeId: initiativeId || null,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
      },
    });
    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTask(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, dueDate, completed, contactId, entityId, initiativeId } = req.body;

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        ...(completed !== undefined && { completed }),
        contactId: contactId !== undefined ? contactId : undefined,
        entityId: entityId !== undefined ? entityId : undefined,
        initiativeId: initiativeId !== undefined ? initiativeId : undefined,
        updatedByUserId: req.user!.userId,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
      },
    });
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTask(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.task.delete({ where: { id } });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
