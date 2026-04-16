import { Response, NextFunction } from 'express';
import { AuthRequest, WorkflowRole } from '../types';

export function requireWorkflow(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.workflowRole) {
    return res.status(403).json({ error: 'Workflow access not granted' });
  }
  next();
}

export function requireWorkflowRole(...roles: WorkflowRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user.workflowRole || !roles.includes(req.user.workflowRole)) {
      return res.status(403).json({ error: 'Insufficient workflow permissions' });
    }
    next();
  };
}

export function requireWorkflowEditor(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const role = req.user.workflowRole;
  if (role !== 'WorkflowAdmin' && role !== 'WorkflowEditor') {
    return res.status(403).json({ error: 'Editor access required' });
  }
  next();
}

export function requireWorkflowAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.workflowRole !== 'WorkflowAdmin') {
    return res.status(403).json({ error: 'Workflow admin access required' });
  }
  next();
}

/**
 * Scope helper: WorkflowAdmin can access any client; others are locked to
 * their own workflowClientId.
 */
export function assertClientAccess(req: AuthRequest, workflowClientId: string): boolean {
  if (!req.user) return false;
  if (req.user.workflowRole === 'WorkflowAdmin') return true;
  return req.user.workflowClientId === workflowClientId;
}
