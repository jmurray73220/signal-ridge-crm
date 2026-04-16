-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "capabilityDescription" TEXT;

-- CreateTable
CREATE TABLE "BudgetDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "documentType" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "serviceBranch" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BudgetConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetDocumentId" TEXT NOT NULL,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetConversation_budgetDocumentId_fkey" FOREIGN KEY ("budgetDocumentId") REFERENCES "BudgetDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetConversationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetLink_budgetConversationId_fkey" FOREIGN KEY ("budgetConversationId") REFERENCES "BudgetConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
