import { PrismaClient } from '@prisma/client';

/**
 * Models with a `deletedAt` column. Queries against these models
 * automatically exclude soft-deleted rows unless the caller explicitly opts
 * in via `where: { deletedAt: { not: null } }` (e.g. the recycle bin list).
 */
const SOFT_DELETE_MODELS = [
  'contact',
  'entity',
  'initiative',
  'interaction',
  'task',
  'reminder',
  'workflowTrack',
  'workflowSOW',
  'workflowActionItem',
] as const;

type SoftDeleteModel = typeof SOFT_DELETE_MODELS[number];

function withNotDeletedDefault(args: { where?: any } = {}) {
  args.where = { deletedAt: null, ...(args.where || {}) };
  return args;
}

function softDeleteOps() {
  // Prisma $extends query hooks — wrap the list/count operations so the
  // default is "non-deleted rows only" across the app.
  return {
    async findMany({ args, query }: any) {
      return query(withNotDeletedDefault(args));
    },
    async findFirst({ args, query }: any) {
      return query(withNotDeletedDefault(args));
    },
    async count({ args, query }: any) {
      return query(withNotDeletedDefault(args));
    },
    async aggregate({ args, query }: any) {
      return query(withNotDeletedDefault(args));
    },
    async groupBy({ args, query }: any) {
      return query(withNotDeletedDefault(args));
    },
  };
}

const base = new PrismaClient();

const query = SOFT_DELETE_MODELS.reduce((acc, model) => {
  acc[model] = softDeleteOps();
  return acc;
}, {} as Record<SoftDeleteModel, ReturnType<typeof softDeleteOps>>);

export const prisma = base.$extends({ query });

// Re-export the raw client for the rare case where we genuinely need to see
// deleted rows without having to shape a `where` (e.g. destructive admin ops).
export const rawPrisma = base;

export default prisma;
