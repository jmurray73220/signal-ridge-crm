-- AlterTable
ALTER TABLE "WorkflowMilestone" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowPhase" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowTrack" ADD COLUMN     "createdByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowTrack" ADD CONSTRAINT "WorkflowTrack_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhase" ADD CONSTRAINT "WorkflowPhase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowMilestone" ADD CONSTRAINT "WorkflowMilestone_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
