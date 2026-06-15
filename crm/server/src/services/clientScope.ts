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

/** OR conditions limiting initiatives to those tied to a given entity. */
export function initiativeEntityScope(entityId: string) {
  return [
    { primaryEntityId: entityId },
    { entities: { some: { entityId } } },
  ];
}

/** OR conditions limiting interactions to those tied to a given entity. */
export function interactionEntityScope(entityId: string) {
  return [
    { entityId },
    { initiative: { primaryEntityId: entityId } },
    { contacts: { some: { contact: { entityId } } } },
  ];
}

/**
 * The set of CRM Entity ids a client may view: their own entity PLUS every
 * entity referenced by their own initiatives and interactions (e.g. the
 * congressional offices they're engaging). The client can open those entities'
 * pages, but their roll-ups are still filtered to the client's own activity by
 * the entity controller — so another client's activity at a shared office is
 * never exposed.
 */
export async function getClientVisibleEntityIds(clientId: string): Promise<string[]> {
  const ids = new Set<string>([clientId]);

  const initiatives = await prisma.initiative.findMany({
    where: { OR: initiativeEntityScope(clientId) },
    select: { primaryEntityId: true, entities: { select: { entityId: true } } },
  });
  for (const i of initiatives) {
    if (i.primaryEntityId) ids.add(i.primaryEntityId);
    for (const e of i.entities) ids.add(e.entityId);
  }

  const interactions = await prisma.interaction.findMany({
    where: { OR: interactionEntityScope(clientId) },
    select: { entityId: true, contacts: { select: { contact: { select: { entityId: true } } } } },
  });
  for (const x of interactions) {
    if (x.entityId) ids.add(x.entityId);
    for (const c of x.contacts) {
      if (c.contact?.entityId) ids.add(c.contact.entityId);
    }
  }

  return [...ids];
}
