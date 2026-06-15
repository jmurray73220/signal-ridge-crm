import prisma from './prisma';
import { AuthRequest, JwtPayload } from '../types';

/**
 * Client-scoping helpers.
 *
 * Internal staff (Admin/Editor/Viewer) have no `workflowClientId`. External
 * client logins are tied to a specific WorkflowClient that maps to a single CRM
 * Entity. Those users must only ever see/touch data belonging to that entity.
 *
 * `isClientUser` is a cheap, JWT-only check used by middleware to block writes
 * and gate internal-only routes. `getClientScope` does the DB lookup needed to
 * resolve the actual CRM entity id for read filtering.
 */

export function isClientUser(
  user?: Pick<JwtPayload, 'role' | 'workflowClientId'> | null
): boolean {
  // Admins are never scoped (safety net). Anyone else carrying a
  // workflowClientId is an external client login.
  return !!user?.workflowClientId && user.role !== 'Admin';
}

export interface ClientScope {
  /**
   * The CRM Entity id this client is limited to, or null when their workflow
   * client isn't linked to a CRM entity yet — in which case they should see
   * nothing rather than everything.
   */
  clientId: string | null;
  clientName: string | null;
}

/**
 * Returns null for unscoped (internal staff) callers, or a ClientScope object
 * for client users. Callers should treat a non-null scope with a null
 * `clientId` as "return no rows".
 */
export async function getClientScope(req: AuthRequest): Promise<ClientScope | null> {
  if (!isClientUser(req.user)) return null;
  const wfClient = await prisma.workflowClient.findUnique({
    where: { id: req.user!.workflowClientId! },
    select: { name: true, clientId: true },
  });
  return { clientId: wfClient?.clientId ?? null, clientName: wfClient?.name ?? null };
}
