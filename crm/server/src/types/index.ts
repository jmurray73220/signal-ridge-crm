import { Request } from 'express';

export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type WorkflowRole = 'WorkflowAdmin' | 'WorkflowEditor' | 'WorkflowViewer';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  workflowRole?: WorkflowRole | null;
  workflowClientId?: string | null;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
