-- AlterTable
ALTER TABLE "WorkflowSOW" ADD COLUMN     "budget" TEXT,
ADD COLUMN     "deliverables" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "differentiationLayer" TEXT,
ADD COLUMN     "draftingChecklist" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "keyPersonnel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "periodOfPerformance" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "targetAgency" TEXT,
ADD COLUMN     "targetFundingVehicle" TEXT,
ADD COLUMN     "trlStatement" TEXT;

-- AlterTable
ALTER TABLE "WorkflowSOWVersion" ADD COLUMN     "snapshotJson" TEXT NOT NULL DEFAULT '{}';
