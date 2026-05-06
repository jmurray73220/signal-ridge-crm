import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';


export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
        workflowClient: { select: { id: true, name: true } },
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function listWorkflowClients(_req: AuthRequest, res: Response) {
  try {
    const clients = await prisma.workflowClient.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return res.json(clients);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// CRM users can only be created from existing CRM contacts that work for a
// Client entity. Filters out contacts already linked to a User row by email
// so the dropdown doesn't show duplicates.
export async function listClientContactsForUser(_req: AuthRequest, res: Response) {
  try {
    const [contacts, existingEmails] = await Promise.all([
      prisma.contact.findMany({
        where: {
          deletedAt: null,
          email: { not: null },
          entity: { entityType: 'Client', deletedAt: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          entity: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.user.findMany({ select: { email: true } }),
    ]);
    const taken = new Set(existingEmails.map(u => u.email.toLowerCase()));
    const filtered = contacts.filter(c => c.email && !taken.has(c.email.toLowerCase()));
    return res.json(filtered);
  } catch (err) {
    console.error('[listClientContactsForUser]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  const {
    email,
    firstName,
    lastName,
    role,
    temporaryPassword,
    workflowRole,
    workflowClientId,
  } = req.body;
  if (!email || !firstName || !lastName || !temporaryPassword) {
    return res.status(400).json({ error: 'email, firstName, lastName, and temporaryPassword required' });
  }

  // role is now optional — null means "no CRM access (workflow-only user)".
  const validRoles = [null, undefined, '', 'Admin', 'Editor', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const normalizedRole: string | null = role ? role : null;

  const validWorkflowRoles = [null, undefined, '', 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];
  if (!validWorkflowRoles.includes(workflowRole)) {
    return res.status(400).json({ error: 'Invalid workflowRole' });
  }
  const normalizedWfRole: string | null = workflowRole ? workflowRole : null;
  const normalizedWfClientId: string | null =
    normalizedWfRole && normalizedWfRole !== 'WorkflowAdmin' ? (workflowClientId || null) : null;

  if (!normalizedRole && !normalizedWfRole) {
    return res.status(400).json({ error: 'User must have at least CRM or Workflow access' });
  }

  if (
    normalizedWfRole &&
    normalizedWfRole !== 'WorkflowAdmin' &&
    !normalizedWfClientId
  ) {
    return res.status(400).json({ error: 'Workflow Editor/Viewer requires a client' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    if (normalizedWfClientId) {
      const client = await prisma.workflowClient.findUnique({ where: { id: normalizedWfClientId } });
      if (!client) return res.status(400).json({ error: 'Workflow client not found' });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role: normalizedRole,
        workflowRole: normalizedWfRole,
        workflowClientId: normalizedWfClientId,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    return res.status(201).json(user);
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateUserWorkflowRole(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { workflowRole, workflowClientId } = req.body;

  const validWorkflowRoles = [null, '', 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];
  if (workflowRole !== undefined && !validWorkflowRoles.includes(workflowRole)) {
    return res.status(400).json({ error: 'Invalid workflowRole' });
  }

  const normalizedWfRole: string | null =
    workflowRole === undefined ? undefined as unknown as string | null : (workflowRole ? workflowRole : null);
  const normalizedWfClientId: string | null =
    workflowClientId === undefined
      ? (undefined as unknown as string | null)
      : normalizedWfRole && normalizedWfRole !== 'WorkflowAdmin'
        ? (workflowClientId || null)
        : null;

  try {
    if (normalizedWfClientId) {
      const client = await prisma.workflowClient.findUnique({ where: { id: normalizedWfClientId } });
      if (!client) return res.status(400).json({ error: 'Workflow client not found' });
    }
    // Don't strand a workflow-only user with no access.
    if (workflowRole !== undefined && normalizedWfRole === null) {
      const existing = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!existing?.role) {
        return res.status(400).json({ error: 'Cannot remove workflow access — user has no CRM access either' });
      }
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(workflowRole !== undefined && { workflowRole: normalizedWfRole }),
        ...(workflowClientId !== undefined && { workflowClientId: normalizedWfClientId }),
      },
      select: {
        id: true,
        email: true,
        workflowRole: true,
        workflowClientId: true,
      },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateUserRole(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { role } = req.body;

  // role can be null/empty now ("no CRM access — workflow only").
  const validRoles = [null, '', 'Admin', 'Editor', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const normalized: string | null = role ? role : null;

  try {
    // Don't strand the user with no access at all.
    if (normalized === null) {
      const existing = await prisma.user.findUnique({
        where: { id },
        select: { workflowRole: true },
      });
      if (!existing?.workflowRole) {
        return res.status(400).json({ error: 'Cannot remove CRM access — user has no workflow access either' });
      }
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role: normalized },
      select: { id: true, email: true, role: true },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function toggleUserActive(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { isActive } = req.body;

  // Cannot deactivate yourself
  if (id === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
