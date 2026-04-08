-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InitiativeContact" (
    "initiativeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("initiativeId", "contactId"),
    CONSTRAINT "InitiativeContact_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InitiativeContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InitiativeContact" ("contactId", "initiativeId", "role") SELECT "contactId", "initiativeId", "role" FROM "InitiativeContact";
DROP TABLE "InitiativeContact";
ALTER TABLE "new_InitiativeContact" RENAME TO "InitiativeContact";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
