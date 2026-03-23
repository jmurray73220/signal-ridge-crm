import { Request } from 'express';

export type UserRole = 'Admin' | 'Editor' | 'Viewer';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
