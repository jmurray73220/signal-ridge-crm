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
  if (!email || !firstName || !lastName || !role || !temporaryPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const validRoles = ['Admin', 'Editor', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const validWorkflowRoles = [null, undefined, '', 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];
  if (!validWorkflowRoles.includes(workflowRole)) {
    return res.status(400).json({ error: 'Invalid workflowRole' });
  }

  // Normalize: empty string → null; scoped roles require a client; admin role ignores client
  const normalizedWfRole: string | null = workflowRole ? workflowRole : null;
  const normalizedWfClientId: string | null =
    normalizedWfRole && normalizedWfRole !== 'WorkflowAdmin' ? (workflowClientId || null) : null;

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
        role,
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

  const validRoles = ['Admin', 'Editor', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
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
