import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { AuthRequest } from '../types';
import { assertClientAccess } from '../middleware/workflowAuth';

const prisma = new PrismaClient();

const LAYER_FRAMEWORK = `CAITIP is funded as four distinct layers, each paired to a funding vehicle:

- Layer 1 — AI/ML Research Core (funded by SBIR): entity resolution methodology, multi-spectrum correlation engine, feasibility-scale research artifacts.
- Layer 2 — Integrated Prototype (funded by Genesis at AFRL/RIGA): the prototype that assembles Layer 1 methodology into a demonstrable system with a government-facing demonstration and transition plan.
- Layer 3 — Operator-Facing Tools (funded by AFWERX): Hunt Chat, Response Packaging automation, mission planning workflow for AFCYBER operators. Workflow-first, Execution-Gap framing.
- Layer 4 — Commercial Platform (funded by DIU): commercial platform adaptation for DoD use — geospatial interface, SaaS deployment, government-hardened instance. Requires a DoD transition partner.

A separate "CYBERCOM / AFCYBER Relationship Development" track is not a funding vehicle — it exists for transition-customer relationship building, letters of interest, and deterrence-framed briefings. If a SOW is about relationship building, introductory briefings, letters of interest, or deterrence framing (not an R&D deliverable), that is the correct track.

A "Master Execution Timeline" track exists for cross-cutting 180-day execution planning. A SOW should only be assigned there if it is explicitly a timeline/coordination document, not a scoped deliverable.`;

// ─── Clients ──────────────────────────────────────────────────────────────

export async function listClients(req: AuthRequest, res: Response) {
  try {
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    const where = isAdmin ? {} : { id: req.user!.workflowClientId || '' };
    const clients = await prisma.workflowClient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { tracks: true, sows: true } } },
    });
    return res.json(clients);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  if (!assertClientAccess(req, id)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const client = await prisma.workflowClient.findUnique({
      where: { id },
      include: { _count: { select: { tracks: true, sows: true } } },
    });
    if (!client) return res.status(404).json({ error: 'Not found' });
    return res.json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createClient(req: AuthRequest, res: Response) {
  const { name, clientId } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const client = await prisma.workflowClient.create({
      data: { name, clientId: clientId || null },
    });
    return res.status(201).json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { name, clientId } = req.body;
  try {
    const client = await prisma.workflowClient.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(clientId !== undefined && { clientId }),
      },
    });
    return res.json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowClient.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Tracks ───────────────────────────────────────────────────────────────

export async function listTracks(req: AuthRequest, res: Response) {
  const { workflowClientId } = req.query;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId as string)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tracks = await prisma.workflowTrack.findMany({
      where: { workflowClientId: workflowClientId as string },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        phases: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            milestones: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                actionItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });
    return res.json(tracks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const track = await prisma.workflowTrack.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            milestones: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                actionItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });
    if (!track) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    return res.json(track);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createTrack(req: AuthRequest, res: Response) {
  const { workflowClientId, title, description, fundingVehicle, status, sortOrder } = req.body;
  if (!workflowClientId || !title) return res.status(400).json({ error: 'workflowClientId and title required' });
  try {
    const track = await prisma.workflowTrack.create({
      data: {
        workflowClientId,
        title,
        description: description || null,
        fundingVehicle: fundingVehicle || null,
        status: status || 'Active',
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(track);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, fundingVehicle, status, sortOrder } = req.body;
  try {
    const existing = await prisma.workflowTrack.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    const track = await prisma.workflowTrack.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(fundingVehicle !== undefined && { fundingVehicle }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return res.json(track);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowTrack.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Phases ───────────────────────────────────────────────────────────────

export async function createPhase(req: AuthRequest, res: Response) {
  const { trackId, title, description, budget, timeframe, status, sortOrder } = req.body;
  if (!trackId || !title) return res.status(400).json({ error: 'trackId and title required' });
  try {
    const phase = await prisma.workflowPhase.create({
      data: {
        trackId,
        title,
        description: description || null,
        budget: budget || null,
        timeframe: timeframe || null,
        status: status || 'NotStarted',
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(phase);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updatePhase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, budget, timeframe, status, sortOrder } = req.body;
  try {
    const phase = await prisma.workflowPhase.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(budget !== undefined && { budget }),
        ...(timeframe !== undefined && { timeframe }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return res.json(phase);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deletePhase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowPhase.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Milestones ───────────────────────────────────────────────────────────

export async function createMilestone(req: AuthRequest, res: Response) {
  const { phaseId, title, description, dueDate, status, sortOrder } = req.body;
  if (!phaseId || !title) return res.status(400).json({ error: 'phaseId and title required' });
  try {
    const milestone = await prisma.workflowMilestone.create({
      data: {
        phaseId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'NotStarted',
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(milestone);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateMilestone(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, dueDate, status, sortOrder } = req.body;
  try {
    const milestone = await prisma.workflowMilestone.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined && {
          status,
          completedAt: status === 'Completed' ? new Date() : null,
        }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return res.json(milestone);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowMilestone.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Action items ─────────────────────────────────────────────────────────

export async function getActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const item = await prisma.workflowActionItem.findUnique({
      where: { id },
      include: {
        milestone: { include: { phase: { include: { track: true } } } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    const clientId = item.milestone.phase.track.workflowClientId;
    if (!assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createActionItem(req: AuthRequest, res: Response) {
  const { milestoneId, title, notes, status, assignedTo, dueDate, sortOrder } = req.body;
  if (!milestoneId || !title) return res.status(400).json({ error: 'milestoneId and title required' });
  try {
    const item = await prisma.workflowActionItem.create({
      data: {
        milestoneId,
        title,
        notes: notes || null,
        status: status || 'Todo',
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: sortOrder ?? 0,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, notes, status, assignedTo, dueDate, sortOrder } = req.body;
  try {
    const existing = await prisma.workflowActionItem.findUnique({
      where: { id },
      include: { milestone: { include: { phase: { include: { track: true } } } } },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const clientId = existing.milestone.phase.track.workflowClientId;
    if (!assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

    // WorkflowEditor can only update status/notes/assignedTo
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    const data: any = {
      updatedByUserId: req.user!.userId,
    };
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) {
      data.status = status;
      data.completedAt = status === 'Done' ? new Date() : null;
    }
    if (assignedTo !== undefined) data.assignedTo = assignedTo;
    if (isAdmin) {
      if (title !== undefined) data.title = title;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (sortOrder !== undefined) data.sortOrder = sortOrder;
    }

    const item = await prisma.workflowActionItem.update({
      where: { id },
      data,
    });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowActionItem.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── SOWs ─────────────────────────────────────────────────────────────────

export async function listSOWs(req: AuthRequest, res: Response) {
  const { workflowClientId } = req.query;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId as string)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const sows = await prisma.workflowSOW.findMany({
      where: { workflowClientId: workflowClientId as string },
      orderBy: { updatedAt: 'desc' },
      include: {
        track: { select: { id: true, title: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return res.json(sows);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const sow = await prisma.workflowSOW.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, title: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!sow) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, sow.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    return res.json(sow);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createSOW(req: AuthRequest, res: Response) {
  const { workflowClientId, trackId, title, content, status } = req.body;
  if (!workflowClientId || !title) return res.status(400).json({ error: 'workflowClientId and title required' });
  try {
    const sow = await prisma.workflowSOW.create({
      data: {
        workflowClientId,
        trackId: trackId || null,
        title,
        content: content || '',
        version: 1,
        status: status || 'Draft',
        createdByUserId: req.user!.userId,
      },
    });
    return res.status(201).json(sow);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, content, trackId, status } = req.body;
  try {
    const existing = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    // If content changes, snapshot the prior version and bump version number.
    const contentChanged = content !== undefined && content !== existing.content;
    let nextVersion = existing.version;

    if (contentChanged) {
      nextVersion = existing.version + 1;
      await prisma.workflowSOWVersion.create({
        data: {
          sowId: existing.id,
          content: existing.content,
          version: existing.version,
          createdByUserId: req.user!.userId,
        },
      });
    }

    const sow = await prisma.workflowSOW.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(trackId !== undefined && { trackId }),
        ...(status !== undefined && { status }),
        ...(contentChanged && { version: nextVersion }),
      },
    });
    return res.json(sow);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowSOW.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────

export async function createComment(req: AuthRequest, res: Response) {
  const { actionItemId, sowId, content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  if (!actionItemId && !sowId) return res.status(400).json({ error: 'actionItemId or sowId required' });
  try {
    // Scope check via parent
    let clientId: string | null = null;
    if (actionItemId) {
      const item = await prisma.workflowActionItem.findUnique({
        where: { id: actionItemId },
        include: { milestone: { include: { phase: { include: { track: true } } } } },
      });
      if (!item) return res.status(404).json({ error: 'Action item not found' });
      clientId = item.milestone.phase.track.workflowClientId;
    } else if (sowId) {
      const sow = await prisma.workflowSOW.findUnique({ where: { id: sowId } });
      if (!sow) return res.status(404).json({ error: 'SOW not found' });
      clientId = sow.workflowClientId;
    }
    if (!clientId || !assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

    const comment = await prisma.workflowComment.create({
      data: {
        actionItemId: actionItemId || null,
        sowId: sowId || null,
        content,
        createdByUserId: req.user!.userId,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.workflowComment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    if (!isAdmin && existing.createdByUserId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.workflowComment.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Workflow user management (admin) ─────────────────────────────────────

export async function listWorkflowUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      where: { workflowRole: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
        isActive: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── AI: suggest track for a SOW ──────────────────────────────────────────

export async function suggestTrackForSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  try {
    const sow = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!sow) return res.status(404).json({ error: 'SOW not found' });
    if (!assertClientAccess(req, sow.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const tracks = await prisma.workflowTrack.findMany({
      where: { workflowClientId: sow.workflowClientId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        fundingVehicle: true,
      },
    });

    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks exist for this client' });
    }

    const trackList = tracks
      .map((t) =>
        `- id: ${t.id}\n  title: ${t.title}\n  fundingVehicle: ${t.fundingVehicle ?? '—'}\n  description: ${t.description ?? '—'}`
      )
      .join('\n\n');

    const systemPrompt = `You are a defense acquisition analyst at Signal Ridge Strategies. Your job is to assign a Statement of Work to the correct funding track based on the Layer 1-4 differentiation framework.

${LAYER_FRAMEWORK}

You will be shown a SOW (title + markdown content) and the list of available tracks for this client. Pick the single best-fit track and explain the reasoning in 2-3 sentences. Base the decision on which layer the SOW actually scopes — not on any incidental keywords. If the SOW is a placeholder or stub that explicitly names a layer, trust that signal.

Respond ONLY as minified JSON on a single line with exactly these keys: {"suggestedTrackId":"<id>","rationale":"<2-3 sentences>"}. No prose outside the JSON. No code fences.`;

    const userPrompt = `Available tracks for this client:\n\n${trackList}\n\n---\n\nSOW title: ${sow.title}\n\nSOW content:\n${sow.content || '(empty)'}\n\nReturn the JSON now.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    const raw = textBlock?.text?.trim() || '';

    // Be tolerant of code fences / minor formatting
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[suggest-track] Unparseable response:', raw);
      return res.status(502).json({ error: 'AI returned unparseable response' });
    }
    let parsed: { suggestedTrackId?: string; rationale?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    const suggested = tracks.find((t) => t.id === parsed.suggestedTrackId);
    if (!suggested) {
      return res.status(502).json({
        error: 'AI returned an unknown track id',
        raw: parsed,
      });
    }

    return res.json({
      suggestedTrackId: suggested.id,
      trackTitle: suggested.title,
      rationale: parsed.rationale || '',
    });
  } catch (err: any) {
    console.error('[suggest-track]', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

export async function setWorkflowRole(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { workflowRole, workflowClientId } = req.body;
  const allowed = [null, 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];
  if (workflowRole !== undefined && !allowed.includes(workflowRole)) {
    return res.status(400).json({ error: 'Invalid workflowRole' });
  }
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(workflowRole !== undefined && { workflowRole }),
        ...(workflowClientId !== undefined && { workflowClientId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
      },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
