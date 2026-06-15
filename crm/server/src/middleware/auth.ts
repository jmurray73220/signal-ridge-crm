import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload, UserRole } from '../types';
import { isClientUser } from '../services/clientScope';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-prod';

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireEditor(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  // Client logins are read-only, even if they were mistakenly given an Editor
  // CRM role. Block writes regardless of role.
  if (isClientUser(req.user)) return res.status(403).json({ error: 'Insufficient permissions' });
  if (req.user.role !== 'Admin' && req.user.role !== 'Editor') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

/**
 * Hard-deny external client logins. Use on routers that expose firm-wide /
 * internal-only data (tasks, reminders, budgets, exports, gmail, settings, …).
 */
export function denyClientUsers(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (isClientUser(req.user)) return res.status(403).json({ error: 'Not available for client accounts' });
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
