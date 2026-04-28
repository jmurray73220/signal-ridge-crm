import { rawPrisma } from './prisma';

/**
 * Entity-type tags used across the change log and recycle bin. Keeping this
 * as a const union ensures we don't drift between controllers.
 */
export const AUDITED_TYPES = [
  'Contact',
  'Entity',
  'Initiative',
  'Interaction',
  'Task',
  'Reminder',
  'WorkflowTrack',
  'WorkflowSOW',
  'WorkflowActionItem',
] as const;
export type AuditedType = typeof AUDITED_TYPES[number];

export type ChangeAction = 'create' | 'update' | 'delete' | 'restore' | 'purge';

/**
 * Field names to ignore when computing update diffs — timestamps and audit
 * fields that flip on every write, plus Prisma relation names that show up
 * only in the post-update payload (when we `include:` them) and would look
 * like phantom changes.
 */
const IGNORED_DIFF_FIELDS = new Set([
  // Timestamps + audit bookkeeping
  'updatedAt',
  'createdAt',
  'updatedByUserId',
  'deletedAt',
  'deletedByUserId',
  // Prisma relation names — the object shape differs between before/after
  // based on what the update call `include`d; the scalar FK (e.g. `entityId`)
  // already captures the real change.
  'entity', 'primaryEntity', 'track', 'sow', 'workflowClient',
  'createdBy', 'updatedBy', 'deletedBy',
  'contacts', 'initiatives', 'interactions', 'tasks', 'reminders',
  'phases', 'milestones', 'actionItems',
  'versions', 'comments', 'trackAssignments',
]);

function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Return the set of fields whose values changed between `before` and `after`.
 * Skips known-noisy fields and any value that is a non-array object (those
 * are Prisma relation payloads we never want to diff).
 */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (IGNORED_DIFF_FIELDS.has(key)) continue;
    const a = normalize(before[key]);
    const b = normalize(after[key]);
    // Skip complex relation objects — we only diff scalars and JSON-encoded arrays.
    const isRelationLike = (v: unknown) =>
      v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
    if (isRelationLike(a) || isRelationLike(b)) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[key] = { before: a, after: b };
    }
  }
  return diff;
}

interface ChangeLogArgs {
  entityType: AuditedType;
  entityId: string;
  userId: string | null;
  action: ChangeAction;
  diff?: Record<string, unknown>;
}

/**
 * Append a single row to the change log. Swallows its own errors — we never
 * want an audit write to fail the user-visible operation.
 */
export async function writeChangeLog(args: ChangeLogArgs): Promise<void> {
  try {
    await rawPrisma.changeLog.create({
      data: {
        entityType: args.entityType,
        entityId: args.entityId,
        userId: args.userId,
        action: args.action,
        diff: JSON.stringify(args.diff || {}),
      },
    });
  } catch (err) {
    console.warn('[audit] failed to write change log entry', { entityType: args.entityType, entityId: args.entityId, action: args.action, err });
  }
}

/**
 * Fire-and-forget update log — call after an update has persisted so the
 * change log stays consistent with the DB. Diffs against ignored-field mask.
 * No-op if nothing meaningful changed.
 */
export async function logUpdate(args: {
  entityType: AuditedType;
  id: string;
  userId: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}): Promise<void> {
  const diff = diffFields(args.before, args.after);
  if (Object.keys(diff).length === 0) return;
  await writeChangeLog({
    entityType: args.entityType,
    entityId: args.id,
    userId: args.userId,
    action: 'update',
    diff: { fields: diff },
  });
}

/**
 * Soft-delete helper: flips deletedAt + deletedByUserId, writes a changelog
 * row carrying the pre-delete snapshot. Caller hands us the raw model name
 * (lowercased, matching Prisma client property) plus the record we've already
 * loaded.
 */
export async function softDelete(args: {
  modelName: string;               // Prisma delegate name, e.g. "contact"
  entityType: AuditedType;         // Audit tag, e.g. "Contact"
  id: string;
  userId: string | null;
  snapshot: Record<string, unknown>;
}): Promise<void> {
  const delegate = (rawPrisma as any)[args.modelName];
  if (!delegate?.update) {
    throw new Error(`softDelete: unknown model "${args.modelName}"`);
  }
  await delegate.update({
    where: { id: args.id },
    data: {
      deletedAt: new Date(),
      deletedByUserId: args.userId,
    },
  });
  await writeChangeLog({
    entityType: args.entityType,
    entityId: args.id,
    userId: args.userId,
    action: 'delete',
    diff: { snapshot: args.snapshot },
  });
}

/**
 * Reverse of softDelete — clears deletedAt/deletedByUserId and logs a restore.
 */
export async function softRestore(args: {
  modelName: string;
  entityType: AuditedType;
  id: string;
  userId: string | null;
}): Promise<void> {
  const delegate = (rawPrisma as any)[args.modelName];
  await delegate.update({
    where: { id: args.id },
    data: { deletedAt: null, deletedByUserId: null },
  });
  await writeChangeLog({
    entityType: args.entityType,
    entityId: args.id,
    userId: args.userId,
    action: 'restore',
  });
}

/**
 * Hard-delete (purge) for use by the recycle bin's explicit "purge now" action
 * and by the 90-day auto-purge sweep.
 */
export async function hardPurge(args: {
  modelName: string;
  entityType: AuditedType;
  id: string;
  userId: string | null;
}): Promise<void> {
  const delegate = (rawPrisma as any)[args.modelName];
  await delegate.delete({ where: { id: args.id } });
  await writeChangeLog({
    entityType: args.entityType,
    entityId: args.id,
    userId: args.userId,
    action: 'purge',
  });
}
