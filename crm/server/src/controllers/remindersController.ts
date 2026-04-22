import { Response } from 'express';
import prisma from '../services/prisma';
import { softDelete } from '../services/audit';
import { AuthRequest } from '../types';

const reminderInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true } },
  initiative: { select: { id: true, title: true } },
  interaction: { select: { id: true, subject: true, type: true, date: true } },
};

export async function getReminders(req: AuthRequest, res: Response) {
  const { contactId, entityId, initiativeId, interactionId, completed } = req.query;

  const where: any = { createdByUserId: req.user!.userId };
  if (contactId) where.contactId = contactId as string;
  if (entityId) where.entityId = entityId as string;
  if (initiativeId) where.initiativeId = initiativeId as string;
  if (interactionId) where.interactionId = interactionId as string;
  if (completed !== undefined) where.completed = completed === 'true';

  try {
    const reminders = await prisma.reminder.findMany({
      where,
      include: reminderInclude,
      orderBy: [{ completed: 'asc' }, { remindAt: 'asc' }],
    });
    return res.json(reminders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createReminder(req: AuthRequest, res: Response) {
  const { title, notes, remindAt, contactId, entityId, initiativeId, interactionId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (!remindAt) return res.status(400).json({ error: 'Remind date required' });

  try {
    const reminder = await prisma.reminder.create({
      data: {
        title,
        notes: notes || null,
        remindAt: new Date(remindAt),
        contactId: contactId || null,
        entityId: entityId || null,
        initiativeId: initiativeId || null,
        interactionId: interactionId || null,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
      include: reminderInclude,
    });
    return res.status(201).json(reminder);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateReminder(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, notes, remindAt, completed, contactId, entityId, initiativeId, interactionId } = req.body;

  try {
    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(remindAt !== undefined && { remindAt: new Date(remindAt) }),
        ...(completed !== undefined && {
          completed,
          completedAt: completed ? new Date() : null,
        }),
        ...(contactId !== undefined && { contactId: contactId || null }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(initiativeId !== undefined && { initiativeId: initiativeId || null }),
        ...(interactionId !== undefined && { interactionId: interactionId || null }),
        updatedByUserId: req.user!.userId,
      },
      include: reminderInclude,
    });
    return res.json(reminder);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteReminder(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.reminder.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });
    await softDelete({
      modelName: 'reminder',
      entityType: 'Reminder',
      id,
      userId: req.user?.userId || null,
      snapshot: existing as unknown as Record<string, unknown>,
    });
    return res.json({ message: 'Reminder moved to recycle bin' });
  } catch (err) {
    console.error('[deleteReminder]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
