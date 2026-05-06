-- AlterTable
ALTER TABLE "WorkflowTrack" ADD COLUMN     "aiExtractedAt" TIMESTAMP(3),
ADD COLUMN     "aiExtractionStatus" TEXT,
ADD COLUMN     "fundingCeiling" TEXT,
ADD COLUMN     "isContractOpportunity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "opportunityUrl" TEXT,
ADD COLUMN     "proposalDueDate" TIMESTAMP(3),
ADD COLUMN     "solicitationNumber" TEXT,
ADD COLUMN     "vehicleType" TEXT;
