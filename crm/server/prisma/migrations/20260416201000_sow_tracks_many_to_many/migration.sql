-- Create join table for SOW <-> Track many-to-many
CREATE TABLE "WorkflowSOWTrack" (
    "sowId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowSOWTrack_pkey" PRIMARY KEY ("sowId","trackId")
);

CREATE INDEX "WorkflowSOWTrack_trackId_idx" ON "WorkflowSOWTrack"("trackId");

ALTER TABLE "WorkflowSOWTrack"
    ADD CONSTRAINT "WorkflowSOWTrack_sowId_fkey"
    FOREIGN KEY ("sowId") REFERENCES "WorkflowSOW"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowSOWTrack"
    ADD CONSTRAINT "WorkflowSOWTrack_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "WorkflowTrack"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing WorkflowSOW.trackId values so current assignments survive the cutover.
INSERT INTO "WorkflowSOWTrack" ("sowId","trackId","createdAt")
SELECT "id","trackId", NOW()
FROM "WorkflowSOW"
WHERE "trackId" IS NOT NULL;

-- Drop old 1:N FK + column
ALTER TABLE "WorkflowSOW" DROP CONSTRAINT "WorkflowSOW_trackId_fkey";
ALTER TABLE "WorkflowSOW" DROP COLUMN "trackId";
