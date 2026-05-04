-- AlterTable
ALTER TABLE "BriefingDocument" ADD COLUMN     "initiativeId" TEXT;

-- CreateIndex
CREATE INDEX "BriefingDocument_initiativeId_idx" ON "BriefingDocument"("initiativeId");

-- AddForeignKey
ALTER TABLE "BriefingDocument" ADD CONSTRAINT "BriefingDocument_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
