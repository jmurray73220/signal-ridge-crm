import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { rawPrisma } from '../services/prisma';
import { AuthRequest, UserRole } from '../types';

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function botAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractBearer(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

  const keyHash = sha256Hex(token);

  try {
    const apiKey = await rawPrisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }
    if (!apiKey.user || !apiKey.user.isActive) {
      return res.status(401).json({ error: 'Bot user inactive' });
    }

    rawPrisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => console.warn('[botAuth] lastUsedAt update failed', err));

    req.user = {
      userId: apiKey.user.id,
      email: apiKey.user.email,
      role: apiKey.user.role as UserRole,
      mustChangePassword: false,
    };
    return next();
  } catch (err) {
    console.error('[botAuth]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
