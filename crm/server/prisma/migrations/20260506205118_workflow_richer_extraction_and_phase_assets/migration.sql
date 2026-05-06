-- AlterTable
ALTER TABLE "WorkflowTrack" ADD COLUMN     "additionalSections" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "eligibility" TEXT,
ADD COLUMN     "focusAreas" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "fundingAuthority" TEXT,
ADD COLUMN     "fundingFloor" TEXT,
ADD COLUMN     "issuingAgency" TEXT,
ADD COLUMN     "periodOfPerformance" TEXT,
ADD COLUMN     "pointsOfContact" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "questionsDueDate" TIMESTAMP(3),
ADD COLUMN     "submissionFormat" TEXT,
ADD COLUMN     "targetedFocusAreas" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "PhaseAttachment" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,

    CONSTRAINT "PhaseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseLink" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "PhaseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhaseAttachment_phaseId_idx" ON "PhaseAttachment"("phaseId");

-- CreateIndex
CREATE INDEX "PhaseLink_phaseId_idx" ON "PhaseLink"("phaseId");

-- AddForeignKey
ALTER TABLE "PhaseAttachment" ADD CONSTRAINT "PhaseAttachment_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "WorkflowPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseLink" ADD CONSTRAINT "PhaseLink_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "WorkflowPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
