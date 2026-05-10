import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function crmStatusFromTrack(status: string): string {
  if (status === 'Completed') return 'Closed';
  if (status === 'OnHold') return 'OnHold';
  return 'Active';
}

async function upsertMirrorInitiative(params: {
  track: { id: string; title: string; description: string | null; fundingVehicle: string | null; status: string; initiativeId: string | null };
  workflowClientId: string;
  actingUserId: string | null;
}): Promise<string> {
  const client = await prisma.workflowClient.findUnique({ where: { id: params.workflowClientId } });
  const primaryEntityId = client?.clientId ?? null;

  const description = [params.track.fundingVehicle, params.track.description]
    .filter((v): v is string => !!v)
    .join('\n\n') || null;

  const crmStatus = crmStatusFromTrack(params.track.status);

  if (params.track.initiativeId) {
    const existing = await prisma.initiative.findUnique({ where: { id: params.track.initiativeId } });
    if (existing) {
      await prisma.initiative.update({
        where: { id: params.track.initiativeId },
        data: {
          title: params.track.title,
          description,
          primaryEntityId,
          status: crmStatus,
          ...(params.actingUserId && { updatedByUserId: params.actingUserId }),
        },
      });
      return params.track.initiativeId;
    }
  }

  const initiative = await prisma.initiative.create({
    data: {
      title: params.track.title,
      description,
      primaryEntityId,
      status: crmStatus,
      priority: 'Medium',
      ...(params.actingUserId && {
        createdByUserId: params.actingUserId,
        updatedByUserId: params.actingUserId,
      }),
    },
  });
  return initiative.id;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function listBotWorkflowClients(_req: AuthRequest, res: Response) {
  try {
    const clients = await prisma.workflowClient.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { tracks: true } } },
    });
    return res.json(clients);
  } catch (err) {
    console.error('[botWorkflow] listClients', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Tracks ───────────────────────────────────────────────────────────────────

export async function listBotWorkflowTracks(req: AuthRequest, res: Response) {
  const { clientId } = req.query as Record<string, string>;
  try {
    const tracks = await prisma.workflowTrack.findMany({
      where: {
        deletedAt: null,
        ...(clientId ? { workflowClientId: clientId } : {}),
      },
      orderBy: [{ workflowClientId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        workflowClient: { select: { id: true, name: true } },
        _count: { select: { phases: true } },
      },
    });
    return res.json(tracks);
  } catch (err) {
    console.error('[botWorkflow] listTracks', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getBotWorkflowTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const track = await prisma.workflowTrack.findFirst({
      where: { id, deletedAt: null },
      include: {
        workflowClient: { select: { id: true, name: true, clientId: true } },
        phases: {
          orderBy: { sortOrder: 'asc' },
          include: {
            milestones: {
              orderBy: { sortOrder: 'asc' },
              include: {
                actionItems: {
                  where: { deletedAt: null },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!track) return res.status(404).json({ error: 'Track not found' });
    return res.json(track);
  } catch (err) {
    console.error('[botWorkflow] getTrack', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createBotWorkflowTrack(req: AuthRequest, res: Response) {
  const { workflowClientId, title, description, fundingVehicle, status, priority } = req.body;
  if (!workflowClientId || !title) {
    return res.status(400).json({ error: 'workflowClientId and title are required' });
  }
  try {
    const track = await prisma.workflowTrack.create({
      data: {
        workflowClientId,
        title,
        description: description || null,
        fundingVehicle: fundingVehicle || null,
        status: status || 'Active',
        priority: priority || 'Medium',
      },
    });

    try {
      const initiativeId = await upsertMirrorInitiative({
        track: { ...track, initiativeId: null },
        workflowClientId,
        actingUserId: req.user?.userId || null,
      });
      await prisma.workflowTrack.update({ where: { id: track.id }, data: { initiativeId } });
      (track as any).initiativeId = initiativeId;
    } catch (mirrorErr) {
      console.error('[botWorkflow] createTrack mirror failed:', mirrorErr);
    }

    return res.status(201).json(track);
  } catch (err) {
    console.error('[botWorkflow] createTrack', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateBotWorkflowTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, fundingVehicle, status, priority } = req.body;
  try {
    const existing = await prisma.workflowTrack.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return res.status(404).json({ error: 'Track not found' });

    const updated = await prisma.workflowTrack.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(fundingVehicle !== undefined && { fundingVehicle }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      },
    });

    try {
      await upsertMirrorInitiative({
        track: updated,
        workflowClientId: updated.workflowClientId,
        actingUserId: req.user?.userId || null,
      });
    } catch (mirrorErr) {
      console.error('[botWorkflow] updateTrack mirror failed:', mirrorErr);
    }

    return res.json(updated);
  } catch (err) {
    console.error('[botWorkflow] updateTrack', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Phases ───────────────────────────────────────────────────────────────────

export async function createBotWorkflowPhase(req: AuthRequest, res: Response) {
  const { id: trackId } = req.params;
  const { title, description, budget, timeframe, status, assignedTo } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const track = await prisma.workflowTrack.findFirst({ where: { id: trackId, deletedAt: null } });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const maxSort = await prisma.workflowPhase.aggregate({
      where: { trackId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const phase = await prisma.workflowPhase.create({
      data: {
        trackId,
        title,
        description: description || null,
        budget: budget || null,
        timeframe: timeframe || null,
        status: status || 'NotStarted',
        assignedTo: assignedTo || null,
        sortOrder,
      },
    });
    return res.status(201).json(phase);
  } catch (err) {
    console.error('[botWorkflow] createPhase', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateBotWorkflowPhase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, budget, timeframe, status, assignedTo } = req.body;
  try {
    const phase = await prisma.workflowPhase.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(budget !== undefined && { budget }),
        ...(timeframe !== undefined && { timeframe }),
        ...(status !== undefined && { status, statusManuallySet: true }),
        ...(assignedTo !== undefined && { assignedTo }),
      },
    });
    return res.json(phase);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Phase not found' });
    console.error('[botWorkflow] updatePhase', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export async function createBotWorkflowMilestone(req: AuthRequest, res: Response) {
  const { id: phaseId } = req.params;
  const { title, description, dueDate, status, assignedTo } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const phase = await prisma.workflowPhase.findUnique({ where: { id: phaseId } });
    if (!phase) return res.status(404).json({ error: 'Phase not found' });

    const maxSort = await prisma.workflowMilestone.aggregate({
      where: { phaseId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const milestone = await prisma.workflowMilestone.create({
      data: {
        phaseId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'NotStarted',
        assignedTo: assignedTo || null,
        sortOrder,
      },
    });
    return res.status(201).json(milestone);
  } catch (err) {
    console.error('[botWorkflow] createMilestone', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateBotWorkflowMilestone(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, dueDate, status, assignedTo } = req.body;
  try {
    const milestone = await prisma.workflowMilestone.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined && { status, statusManuallySet: true }),
        ...(assignedTo !== undefined && { assignedTo }),
      },
    });
    return res.json(milestone);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Milestone not found' });
    console.error('[botWorkflow] updateMilestone', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Action Items ─────────────────────────────────────────────────────────────

export async function createBotWorkflowActionItem(req: AuthRequest, res: Response) {
  const { id: milestoneId } = req.params;
  const { title, description, notes, dueDate, status, assignedTo } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const milestone = await prisma.workflowMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const maxSort = await prisma.workflowActionItem.aggregate({
      where: { milestoneId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const item = await prisma.workflowActionItem.create({
      data: {
        milestoneId,
        title,
        description: description || null,
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'Todo',
        assignedTo: assignedTo || null,
        sortOrder,
        createdByUserId: req.user?.userId || null,
        updatedByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json(item);
  } catch (err) {
    console.error('[botWorkflow] createActionItem', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateBotWorkflowActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, notes, dueDate, status, assignedTo } = req.body;
  try {
    const completedAt =
      status === 'Done' ? new Date() :
      status !== undefined ? null :
      undefined;

    const item = await prisma.workflowActionItem.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined && { status }),
        ...(completedAt !== undefined && { completedAt }),
        ...(assignedTo !== undefined && { assignedTo }),
        updatedByUserId: req.user?.userId || null,
      },
    });
    return res.json(item);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Action item not found' });
    console.error('[botWorkflow] updateActionItem', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
