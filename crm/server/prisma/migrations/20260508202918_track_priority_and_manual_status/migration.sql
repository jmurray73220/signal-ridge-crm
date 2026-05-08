-- AlterTable
ALTER TABLE "WorkflowMilestone" ADD COLUMN     "statusManuallySet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkflowPhase" ADD COLUMN     "statusManuallySet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkflowTrack" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Medium';
