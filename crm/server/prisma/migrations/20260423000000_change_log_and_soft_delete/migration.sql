-- Change log table + soft delete (deletedAt/deletedByUserId) across the core
-- records. Admin-only UI consumes these to render history and a recycle bin.

-- ─── ChangeLog ─────────────────────────────────────────────────────────────

CREATE TABLE "ChangeLog" (
  "id"         TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "userId"     TEXT,
  "action"     TEXT NOT NULL,
  "diff"       TEXT NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChangeLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");

-- ─── Soft-delete columns ───────────────────────────────────────────────────

ALTER TABLE "Contact"            ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Entity"             ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Initiative"         ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Interaction"        ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Task"               ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Reminder"           ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "WorkflowTrack"      ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "WorkflowSOW"        ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "WorkflowActionItem" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedByUserId" TEXT;

-- Partial indexes so "not deleted" lookups stay fast.
CREATE INDEX "Contact_deletedAt_idx"            ON "Contact"("deletedAt")            WHERE "deletedAt" IS NULL;
CREATE INDEX "Entity_deletedAt_idx"             ON "Entity"("deletedAt")             WHERE "deletedAt" IS NULL;
CREATE INDEX "Initiative_deletedAt_idx"         ON "Initiative"("deletedAt")         WHERE "deletedAt" IS NULL;
CREATE INDEX "Interaction_deletedAt_idx"        ON "Interaction"("deletedAt")        WHERE "deletedAt" IS NULL;
CREATE INDEX "Task_deletedAt_idx"               ON "Task"("deletedAt")               WHERE "deletedAt" IS NULL;
CREATE INDEX "Reminder_deletedAt_idx"           ON "Reminder"("deletedAt")           WHERE "deletedAt" IS NULL;
CREATE INDEX "WorkflowTrack_deletedAt_idx"      ON "WorkflowTrack"("deletedAt")      WHERE "deletedAt" IS NULL;
CREATE INDEX "WorkflowSOW_deletedAt_idx"        ON "WorkflowSOW"("deletedAt")        WHERE "deletedAt" IS NULL;
CREATE INDEX "WorkflowActionItem_deletedAt_idx" ON "WorkflowActionItem"("deletedAt") WHERE "deletedAt" IS NULL;
