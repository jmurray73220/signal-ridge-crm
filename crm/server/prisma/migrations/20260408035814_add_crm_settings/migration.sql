-- CreateTable
CREATE TABLE "CrmSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "majorityParty" TEXT NOT NULL DEFAULT 'Republican',
    "logoData" TEXT,
    "logoMimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
