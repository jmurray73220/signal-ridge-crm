import { Response } from 'express';
import { rawPrisma } from '../services/prisma';
import { softRestore, hardPurge, AUDITED_TYPES, type AuditedType } from '../services/audit';
import { AuthRequest } from '../types';

const RETENTION_DAYS = 90;

/**
 * Map audit entity-type tags to the Prisma delegate name and a concise title
 * function used by the recycle bin UI. Keeping this mapping in one place keeps
 * the restore/purge endpoints polymorphic.
 */
const TYPE_MAP: Record<AuditedType, {
  modelName: string;
  title: (row: any) => string;
}> = {
  Contact:            { modelName: 'contact',            title: (r) => `${r.firstName} ${r.lastName}` },
  Entity:             { modelName: 'entity',             title: (r) => r.name },
  Initiative:         { modelName: 'initiative',         title: (r) => r.title },
  Interaction:        { modelName: 'interaction',        title: (r) => r.subject },
  Task:               { modelName: 'task',               title: (r) => r.title },
  Reminder:           { modelName: 'reminder',           title: (r) => r.title },
  WorkflowTrack:      { modelName: 'workflowTrack',      title: (r) => r.title },
  WorkflowSOW:        { modelName: 'workflowSOW',        title: (r) => r.title },
  WorkflowActionItem: { modelName: 'workflowActionItem', title: (r) => r.title },
};

/**
 * GET /api/recycle-bin
 * Returns all soft-deleted records across tracked types, grouped by type.
 * Admin-only (gate enforced at the route layer).
 */
export async function listRecycleBin(_req: AuthRequest, res: Response) {
  try {
    const results: Record<string, Array<{
      id: string;
      title: string;
      deletedAt: string;
      deletedByUserId: string | null;
      purgeAt: string;
    }>> = {};

    for (const type of AUDITED_TYPES) {
      const { modelName, title } = TYPE_MAP[type];
      const delegate = (rawPrisma as any)[modelName];
      const rows: any[] = await delegate.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      });
      results[type] = rows.map((r) => {
        const deleted = new Date(r.deletedAt);
        const purge = new Date(deleted);
        purge.setDate(purge.getDate() + RETENTION_DAYS);
        return {
          id: r.id,
          title: title(r) || '(untitled)',
          deletedAt: deleted.toISOString(),
          deletedByUserId: r.deletedByUserId,
          purgeAt: purge.toISOString(),
        };
      });
    }

    return res.json({ retentionDays: RETENTION_DAYS, items: results });
  } catch (err) {
    console.error('[listRecycleBin]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * POST /api/recycle-bin/:entityType/:id/restore
 * Restores a soft-deleted record by clearing deletedAt. Admin-only.
 */
export async function restore(req: AuthRequest, res: Response) {
  const { entityType, id } = req.params;
  if (!(AUDITED_TYPES as readonly string[]).includes(entityType)) {
    return res.status(400).json({ error: 'Unknown entity type' });
  }
  const { modelName } = TYPE_MAP[entityType as AuditedType];
  try {
    const delegate = (rawPrisma as any)[modelName];
    const row = await delegate.findUnique({ where: { id } });
    if (!row || !row.deletedAt) {
      return res.status(404).json({ error: 'Not found in recycle bin' });
    }
    await softRestore({
      modelName,
      entityType: entityType as AuditedType,
      id,
      userId: req.user?.userId || null,
    });
    return res.json({ message: 'Restored' });
  } catch (err) {
    console.error('[restore]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * DELETE /api/recycle-bin/:entityType/:id
 * Permanently purges a soft-deleted record. Admin-only.
 */
export async function purge(req: AuthRequest, res: Response) {
  const { entityType, id } = req.params;
  if (!(AUDITED_TYPES as readonly string[]).includes(entityType)) {
    return res.status(400).json({ error: 'Unknown entity type' });
  }
  const { modelName } = TYPE_MAP[entityType as AuditedType];
  try {
    const delegate = (rawPrisma as any)[modelName];
    const row = await delegate.findUnique({ where: { id } });
    if (!row || !row.deletedAt) {
      return res.status(404).json({ error: 'Not found in recycle bin' });
    }
    await hardPurge({
      modelName,
      entityType: entityType as AuditedType,
      id,
      userId: req.user?.userId || null,
    });
    return res.json({ message: 'Permanently deleted' });
  } catch (err) {
    console.error('[purge]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * POST /api/recycle-bin/purge-old
 * Sweep — purges every soft-deleted record older than RETENTION_DAYS. Intended
 * for manual admin invocation or a scheduled job. Idempotent.
 */
export async function purgeOld(req: AuthRequest, res: Response) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  let total = 0;
  try {
    for (const type of AUDITED_TYPES) {
      const { modelName } = TYPE_MAP[type];
      const delegate = (rawPrisma as any)[modelName];
      const stale = await delegate.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
      });
      for (const row of stale) {
        await hardPurge({
          modelName,
          entityType: type,
          id: row.id,
          userId: req.user?.userId || null,
        });
        total++;
      }
    }
    return res.json({ purged: total, olderThanDays: RETENTION_DAYS });
  } catch (err) {
    console.error('[purgeOld]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * GET /api/changelog?entityType=X&entityId=Y
 * Returns change log entries for a given record, newest first. Admin-only.
 */
export async function listChangeLog(req: AuthRequest, res: Response) {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType and entityId required' });
  }
  if (!(AUDITED_TYPES as readonly string[]).includes(entityType as string)) {
    return res.status(400).json({ error: 'Unknown entity type' });
  }
  try {
    const rows = await rawPrisma.changeLog.findMany({
      where: { entityType: entityType as string, entityId: entityId as string },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json(rows.map((r) => ({
      ...r,
      diff: safeJson(r.diff),
    })));
  } catch (err) {
    console.error('[listChangeLog]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function safeJson(s: string | null): unknown {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}
