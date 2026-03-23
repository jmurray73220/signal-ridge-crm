import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';

const prisma = new PrismaClient();

export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
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

export async function createUser(req: AuthRequest, res: Response) {
  const { email, firstName, lastName, role, temporaryPassword } = req.body;
  if (!email || !firstName || !lastName || !role || !temporaryPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const validRoles = ['Admin', 'Editor', 'Viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role,
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
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    return res.status(201).json(user);
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
