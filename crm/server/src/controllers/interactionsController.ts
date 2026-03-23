import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function getInteractions(req: AuthRequest, res: Response) {
  const { type, entityId, contactId, initiativeId, from, to } = req.query;
  const where: any = {};

  if (type) where.type = type as string;
  if (entityId) where.entityId = entityId as string;
  if (initiativeId) where.initiativeId = initiativeId as string;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from as string);
    if (to) where.date.lte = new Date(to as string);
  }
  if (contactId) {
    where.contacts = { some: { contactId: contactId as string } };
  }

  try {
    const interactions = await prisma.interaction.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
    return res.json(interactions);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getInteraction(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const interaction = await prisma.interaction.findUnique({
      where: { id },
      include: {
        entity: true,
        initiative: { select: { id: true, title: true } },
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, title: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!interaction) return res.status(404).json({ error: 'Interaction not found' });
    return res.json(interaction);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createInteraction(req: AuthRequest, res: Response) {
  const { type, date, subject, notes, gmailThreadUrl, entityId, initiativeId, contactIds } = req.body;
  if (!type || !date || !subject) {
    return res.status(400).json({ error: 'Type, date, and subject required' });
  }

  try {
    const interaction = await prisma.interaction.create({
      data: {
        type,
        date: new Date(date),
        subject,
        notes: notes || null,
        gmailThreadUrl: gmailThreadUrl || null,
        entityId: entityId || null,
        initiativeId: initiativeId || null,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
        contacts: {
          create: (contactIds || []).map((cid: string) => ({ contactId: cid })),
        },
      },
      include: {
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    return res.status(201).json(interaction);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateInteraction(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { type, date, subject, notes, gmailThreadUrl, entityId, initiativeId, contactIds } = req.body;

  try {
    // Update contacts if provided
    if (contactIds !== undefined) {
      await prisma.interactionContact.deleteMany({ where: { interactionId: id } });
      if (contactIds.length > 0) {
        await prisma.interactionContact.createMany({
          data: contactIds.map((cid: string) => ({ interactionId: id, contactId: cid })),
        });
      }
    }

    const interaction = await prisma.interaction.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(date && { date: new Date(date) }),
        ...(subject && { subject }),
        notes: notes !== undefined ? notes : undefined,
        gmailThreadUrl: gmailThreadUrl !== undefined ? gmailThreadUrl : undefined,
        entityId: entityId !== undefined ? entityId : undefined,
        initiativeId: initiativeId !== undefined ? initiativeId : undefined,
        updatedByUserId: req.user!.userId,
      },
      include: {
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
        contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    return res.json(interaction);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteInteraction(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.interaction.delete({ where: { id } });
    return res.json({ message: 'Interaction deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
