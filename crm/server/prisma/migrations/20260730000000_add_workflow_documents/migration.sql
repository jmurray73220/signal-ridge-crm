-- CreateTable
CREATE TABLE "WorkflowDocument" (
    "id" TEXT NOT NULL,
    "workflowClientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowDocument_workflowClientId_idx" ON "WorkflowDocument"("workflowClientId");

-- AddForeignKey
ALTER TABLE "WorkflowDocument" ADD CONSTRAINT "WorkflowDocument_workflowClientId_fkey" FOREIGN KEY ("workflowClientId") REFERENCES "WorkflowClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
