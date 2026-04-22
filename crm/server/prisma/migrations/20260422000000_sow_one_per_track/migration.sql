-- Collapse WorkflowSOW <-> WorkflowTrack from many-to-many (WorkflowSOWTrack join)
-- to at-most-one SOW per track via a unique FK on WorkflowSOW.trackId.

-- 1. Add nullable trackId column on WorkflowSOW.
ALTER TABLE "WorkflowSOW" ADD COLUMN "trackId" TEXT;

-- 2. Backfill: for each SOW, pick the earliest existing track assignment.
UPDATE "WorkflowSOW" s
SET "trackId" = sub."trackId"
FROM (
  SELECT DISTINCT ON ("sowId") "sowId", "trackId"
  FROM "WorkflowSOWTrack"
  ORDER BY "sowId", "createdAt" ASC
) sub
WHERE s.id = sub."sowId";

-- 3. If any track ended up with multiple SOWs pointing at it, keep only the oldest SOW.
UPDATE "WorkflowSOW"
SET "trackId" = NULL
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "trackId" ORDER BY "createdAt" ASC) AS rn
    FROM "WorkflowSOW"
    WHERE "trackId" IS NOT NULL
  ) t WHERE t.rn > 1
);

-- 4. Enforce at-most-one-SOW-per-track with a unique index, and add the FK.
CREATE UNIQUE INDEX "WorkflowSOW_trackId_key" ON "WorkflowSOW"("trackId");

ALTER TABLE "WorkflowSOW"
  ADD CONSTRAINT "WorkflowSOW_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "WorkflowTrack"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Drop the obsolete join table.
DROP TABLE "WorkflowSOWTrack";
