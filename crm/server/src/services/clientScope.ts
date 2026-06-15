import prisma from './prisma';
import { AuthRequest, JwtPayload } from '../types';

/**
 * Client-scoping helpers.
 *
 * Internal staff (Admin/Editor/Viewer) have no `workflowClientId`. External
 * client logins are tied to a specific WorkflowClient that maps to a single CRM
 * Entity (e.g. "Shadowgrid"). Such users see the SAME CRM as staff, but every
 * data view is filtered to that client's records: anything tagged with the
 * client name OR linked to the client entity.
 *
 * `isClientUser` is a cheap JWT-only check; `getClientScope` resolves the
 * client's entity id + name for filtering.
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
   * The CRM Entity id this client maps to, or null when their workflow client
   * isn't linked to a CRM entity yet — in which case they should see nothing.
   */
  clientId: string | null;
  clientName: string | null;
}

/** Returns null for unscoped (internal staff) callers, or a ClientScope. */
export async function getClientScope(req: AuthRequest): Promise<ClientScope | null> {
  if (!isClientUser(req.user)) return null;
  const wfClient = await prisma.workflowClient.findUnique({
    where: { id: req.user!.workflowClientId! },
    select: { name: true, clientId: true },
  });
  return { clientId: wfClient?.clientId ?? null, clientName: wfClient?.name ?? null };
}

// ── Per-model "belongs to this client" OR-conditions ────────────────────────
// Each returns an array of Prisma where-conditions; a record matches if ANY
// holds (tagged with the client name, or linked to the client entity). Only
// Contact and Entity carry a `tags` field; Initiative/Interaction inherit the
// tag via their related entities/contacts.

// Tags are free-text and inconsistently cased (e.g. "ShadowGrid" vs
// "Shadowgrid"), so all tag matching is case-insensitive.
const tag = (clientName: string | null) => ({ contains: clientName, mode: 'insensitive' as const });

export function contactScope(s: ClientScope): any[] {
  return [
    { entityId: s.clientId },
    { tags: tag(s.clientName) },
  ];
}

export function entityScope(s: ClientScope): any[] {
  return [
    { id: s.clientId },
    { tags: tag(s.clientName) },
  ];
}

export function initiativeScope(s: ClientScope): any[] {
  return [
    { primaryEntityId: s.clientId },
    { entities: { some: { entityId: s.clientId } } },
    { primaryEntity: { tags: tag(s.clientName) } },
    { entities: { some: { entity: { tags: tag(s.clientName) } } } },
  ];
}

export function interactionScope(s: ClientScope): any[] {
  return [
    { entityId: s.clientId },
    { entity: { tags: tag(s.clientName) } },
    { initiative: { primaryEntityId: s.clientId } },
    { initiative: { primaryEntity: { tags: tag(s.clientName) } } },
    { contacts: { some: { contact: { entityId: s.clientId } } } },
    { contacts: { some: { contact: { tags: tag(s.clientName) } } } },
  ];
}
