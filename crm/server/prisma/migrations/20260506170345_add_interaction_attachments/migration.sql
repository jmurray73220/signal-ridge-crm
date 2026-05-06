-- CreateTable
CREATE TABLE "InteractionAttachment" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "source" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,

    CONSTRAINT "InteractionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractionAttachment_interactionId_idx" ON "InteractionAttachment"("interactionId");

-- AddForeignKey
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
