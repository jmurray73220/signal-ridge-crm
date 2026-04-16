-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GmailPendingEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "snippet" TEXT,
    "emailDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactId" TEXT,
    "entityId" TEXT,
    "matchedContactIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GmailPendingEmail_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GmailPendingEmail_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GmailPendingEmail" ("contactId", "createdAt", "emailDate", "entityId", "from", "id", "snippet", "status", "subject", "threadId", "updatedAt") SELECT "contactId", "createdAt", "emailDate", "entityId", "from", "id", "snippet", "status", "subject", "threadId", "updatedAt" FROM "GmailPendingEmail";
DROP TABLE "GmailPendingEmail";
ALTER TABLE "new_GmailPendingEmail" RENAME TO "GmailPendingEmail";
CREATE UNIQUE INDEX "GmailPendingEmail_threadId_key" ON "GmailPendingEmail"("threadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
