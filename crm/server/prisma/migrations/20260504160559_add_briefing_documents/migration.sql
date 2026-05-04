-- CreateTable
CREATE TABLE "BriefingDocument" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "meetingDate" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,

    CONSTRAINT "BriefingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BriefingDocument_clientId_idx" ON "BriefingDocument"("clientId");

-- CreateIndex
CREATE INDEX "BriefingDocument_officeId_idx" ON "BriefingDocument"("officeId");

-- AddForeignKey
ALTER TABLE "BriefingDocument" ADD CONSTRAINT "BriefingDocument_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingDocument" ADD CONSTRAINT "BriefingDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
