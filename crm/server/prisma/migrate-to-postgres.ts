/**
 * SQLite → PostgreSQL data migration script
 *
 * Prerequisites:
 *   1. npm install better-sqlite3 @types/better-sqlite3
 *   2. Update .env DATABASE_URL to your PostgreSQL connection string
 *   3. Run: npx prisma migrate dev --name init  (to create PG tables)
 *   4. Run: npx ts-node prisma/migrate-to-postgres.ts
 *
 * This script reads every record from the SQLite backup and inserts
 * it into PostgreSQL in FK-safe order. It does NOT modify the SQLite file.
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const SQLITE_PATH = path.join(__dirname, 'backup.db');

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const prisma = new PrismaClient();

// Helper: read all rows from a SQLite table
function readAll(table: string): any[] {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
}

// Helper: convert SQLite datetime string or null to Date or null
function toDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  return new Date(val);
}

// Helper: convert SQLite boolean (0/1) to JS boolean
function toBool(val: number | boolean | null | undefined): boolean {
  return val === 1 || val === true;
}

async function migrate() {
  console.log(`Reading from SQLite: ${SQLITE_PATH}`);
  console.log(`Writing to PostgreSQL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//<redacted>@')}\n`);

  // ─── 1. Users ───────────────────────────────────────────────────────
  const users = readAll('User');
  console.log(`Migrating ${users.length} Users...`);
  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: toBool(u.isActive),
        mustChangePassword: toBool(u.mustChangePassword),
        lastLogin: toDate(u.lastLogin),
        resetToken: u.resetToken,
        resetTokenExpiry: toDate(u.resetTokenExpiry),
        createdAt: toDate(u.createdAt)!,
        updatedAt: toDate(u.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Users done`);

  // ─── 2. Entities ────────────────────────────────────────────────────
  const entities = readAll('Entity');
  console.log(`Migrating ${entities.length} Entities...`);
  for (const e of entities) {
    await prisma.entity.create({
      data: {
        id: e.id,
        name: e.name,
        entityType: e.entityType,
        website: e.website,
        description: e.description,
        address: e.address,
        tags: e.tags ?? '[]',
        memberName: e.memberName,
        chamber: e.chamber,
        state: e.state,
        district: e.district,
        committee: e.committee ?? '[]',
        party: e.party,
        subcommittee: e.subcommittee ?? '[]',
        parentAgency: e.parentAgency,
        subComponent: e.subComponent,
        governmentType: e.governmentType,
        budgetLineItem: e.budgetLineItem,
        industry: e.industry,
        contractVehicles: e.contractVehicles ?? '[]',
        capabilityDescription: e.capabilityDescription,
        createdByUserId: e.createdByUserId,
        updatedByUserId: e.updatedByUserId,
        createdAt: toDate(e.createdAt)!,
        updatedAt: toDate(e.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Entities done`);

  // ─── 3. Contacts ────────────────────────────────────────────────────
  const contacts = readAll('Contact');
  console.log(`Migrating ${contacts.length} Contacts...`);
  for (const c of contacts) {
    await prisma.contact.create({
      data: {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        rank: c.rank,
        title: c.title,
        email: c.email,
        officePhone: c.officePhone,
        cell: c.cell,
        linkedIn: c.linkedIn,
        website: c.website,
        bio: c.bio,
        tags: c.tags ?? '[]',
        entityId: c.entityId,
        createdByUserId: c.createdByUserId,
        updatedByUserId: c.updatedByUserId,
        createdAt: toDate(c.createdAt)!,
        updatedAt: toDate(c.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Contacts done`);

  // ─── 4. Initiatives ─────────────────────────────────────────────────
  const initiatives = readAll('Initiative');
  console.log(`Migrating ${initiatives.length} Initiatives...`);
  for (const i of initiatives) {
    await prisma.initiative.create({
      data: {
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        priority: i.priority,
        startDate: toDate(i.startDate),
        targetDate: toDate(i.targetDate),
        primaryEntityId: i.primaryEntityId,
        createdByUserId: i.createdByUserId,
        updatedByUserId: i.updatedByUserId,
        createdAt: toDate(i.createdAt)!,
        updatedAt: toDate(i.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Initiatives done`);

  // ─── 5. InitiativeContacts ──────────────────────────────────────────
  const initiativeContacts = readAll('InitiativeContact');
  console.log(`Migrating ${initiativeContacts.length} InitiativeContacts...`);
  for (const ic of initiativeContacts) {
    await prisma.initiativeContact.create({
      data: {
        initiativeId: ic.initiativeId,
        contactId: ic.contactId,
        role: ic.role,
        sortOrder: ic.sortOrder ?? 0,
      },
    });
  }
  console.log(`  ✓ InitiativeContacts done`);

  // ─── 6. InitiativeEntities ─────────────────────────────────────────
  const initiativeEntities = readAll('InitiativeEntity');
  console.log(`Migrating ${initiativeEntities.length} InitiativeEntities...`);
  for (const ie of initiativeEntities) {
    await prisma.initiativeEntity.create({
      data: {
        initiativeId: ie.initiativeId,
        entityId: ie.entityId,
        relationshipNote: ie.relationshipNote,
      },
    });
  }
  console.log(`  ✓ InitiativeEntities done`);

  // ─── 7. Interactions ────────────────────────────────────────────────
  const interactions = readAll('Interaction');
  console.log(`Migrating ${interactions.length} Interactions...`);
  for (const i of interactions) {
    await prisma.interaction.create({
      data: {
        id: i.id,
        type: i.type,
        date: toDate(i.date)!,
        subject: i.subject,
        notes: i.notes,
        gmailThreadUrl: i.gmailThreadUrl,
        entityId: i.entityId,
        initiativeId: i.initiativeId,
        createdByUserId: i.createdByUserId,
        updatedByUserId: i.updatedByUserId,
        createdAt: toDate(i.createdAt)!,
        updatedAt: toDate(i.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Interactions done`);

  // ─── 8. InteractionContacts ─────────────────────────────────────────
  const interactionContacts = readAll('InteractionContact');
  console.log(`Migrating ${interactionContacts.length} InteractionContacts...`);
  for (const ic of interactionContacts) {
    await prisma.interactionContact.create({
      data: {
        interactionId: ic.interactionId,
        contactId: ic.contactId,
      },
    });
  }
  console.log(`  ✓ InteractionContacts done`);

  // ─── 9. Tasks ───────────────────────────────────────────────────────
  const tasks = readAll('Task');
  console.log(`Migrating ${tasks.length} Tasks...`);
  for (const t of tasks) {
    await prisma.task.create({
      data: {
        id: t.id,
        title: t.title,
        dueDate: toDate(t.dueDate),
        completed: toBool(t.completed),
        contactId: t.contactId,
        entityId: t.entityId,
        initiativeId: t.initiativeId,
        createdByUserId: t.createdByUserId,
        updatedByUserId: t.updatedByUserId,
        createdAt: toDate(t.createdAt)!,
        updatedAt: toDate(t.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Tasks done`);

  // ─── 10. Reminders ──────────────────────────────────────────────────
  const reminders = readAll('Reminder');
  console.log(`Migrating ${reminders.length} Reminders...`);
  for (const r of reminders) {
    await prisma.reminder.create({
      data: {
        id: r.id,
        title: r.title,
        notes: r.notes,
        remindAt: toDate(r.remindAt)!,
        completed: toBool(r.completed),
        completedAt: toDate(r.completedAt),
        contactId: r.contactId,
        entityId: r.entityId,
        initiativeId: r.initiativeId,
        interactionId: r.interactionId,
        createdByUserId: r.createdByUserId,
        updatedByUserId: r.updatedByUserId,
        createdAt: toDate(r.createdAt)!,
        updatedAt: toDate(r.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ Reminders done`);

  // ─── 11. CrmSettings ───────────────────────────────────────────────
  const crmSettings = readAll('CrmSettings');
  console.log(`Migrating ${crmSettings.length} CrmSettings...`);
  for (const s of crmSettings) {
    await prisma.crmSettings.create({
      data: {
        id: s.id,
        majorityParty: s.majorityParty,
        logoData: s.logoData,
        logoMimeType: s.logoMimeType,
        createdAt: toDate(s.createdAt)!,
        updatedAt: toDate(s.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ CrmSettings done`);

  // ─── 12. GmailCredential ───────────────────────────────────────────
  const gmailCreds = readAll('GmailCredential');
  console.log(`Migrating ${gmailCreds.length} GmailCredentials...`);
  for (const g of gmailCreds) {
    await prisma.gmailCredential.create({
      data: {
        id: g.id,
        accessToken: g.accessToken,
        refreshToken: g.refreshToken,
        expiresAt: toDate(g.expiresAt),
        accountEmail: g.accountEmail,
        createdAt: toDate(g.createdAt)!,
        updatedAt: toDate(g.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ GmailCredentials done`);

  // ─── 13. GmailSyncSettings ─────────────────────────────────────────
  const gmailSync = readAll('GmailSyncSettings');
  console.log(`Migrating ${gmailSync.length} GmailSyncSettings...`);
  for (const g of gmailSync) {
    await prisma.gmailSyncSettings.create({
      data: {
        id: g.id,
        enabled: toBool(g.enabled),
        syncIntervalMinutes: g.syncIntervalMinutes,
        lastSyncAt: toDate(g.lastSyncAt),
        createdAt: toDate(g.createdAt)!,
        updatedAt: toDate(g.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ GmailSyncSettings done`);

  // ─── 14. GmailPendingEmails ─────────────────────────────────────────
  const pendingEmails = readAll('GmailPendingEmail');
  console.log(`Migrating ${pendingEmails.length} GmailPendingEmails...`);
  for (const e of pendingEmails) {
    await prisma.gmailPendingEmail.create({
      data: {
        id: e.id,
        threadId: e.threadId,
        subject: e.subject,
        from: e.from,
        snippet: e.snippet,
        emailDate: toDate(e.emailDate)!,
        status: e.status,
        contactId: e.contactId,
        entityId: e.entityId,
        matchedContactIds: e.matchedContactIds ?? '[]',
        createdAt: toDate(e.createdAt)!,
        updatedAt: toDate(e.updatedAt)!,
      },
    });
  }
  console.log(`  ✓ GmailPendingEmails done`);

  // ─── 15. BudgetDocuments ────────────────────────────────────────────
  const budgetDocs = readAll('BudgetDocument');
  console.log(`Migrating ${budgetDocs.length} BudgetDocuments...`);
  for (const b of budgetDocs) {
    await prisma.budgetDocument.create({
      data: {
        id: b.id,
        name: b.name,
        documentType: b.documentType,
        fiscalYear: b.fiscalYear,
        serviceBranch: b.serviceBranch,
        extractedText: b.extractedText,
        createdAt: toDate(b.createdAt)!,
      },
    });
  }
  console.log(`  ✓ BudgetDocuments done`);

  // ─── 16. BudgetConversations ────────────────────────────────────────
  const budgetConvos = readAll('BudgetConversation');
  console.log(`Migrating ${budgetConvos.length} BudgetConversations...`);
  for (const bc of budgetConvos) {
    await prisma.budgetConversation.create({
      data: {
        id: bc.id,
        budgetDocumentId: bc.budgetDocumentId,
        messages: bc.messages ?? '[]',
        createdAt: toDate(bc.createdAt)!,
      },
    });
  }
  console.log(`  ✓ BudgetConversations done`);

  // ─── 17. BudgetLinks ───────────────────────────────────────────────
  const budgetLinks = readAll('BudgetLink');
  console.log(`Migrating ${budgetLinks.length} BudgetLinks...`);
  for (const bl of budgetLinks) {
    await prisma.budgetLink.create({
      data: {
        id: bl.id,
        budgetConversationId: bl.budgetConversationId,
        entityType: bl.entityType,
        entityId: bl.entityId,
        note: bl.note,
        createdAt: toDate(bl.createdAt)!,
      },
    });
  }
  console.log(`  ✓ BudgetLinks done`);

  // ─── 18. ReportTemplates ────────────────────────────────────────────
  const reportTemplates = readAll('ReportTemplate');
  console.log(`Migrating ${reportTemplates.length} ReportTemplates...`);
  for (const rt of reportTemplates) {
    await prisma.reportTemplate.create({
      data: {
        id: rt.id,
        name: rt.name,
        description: rt.description,
        fileData: rt.fileData,
        createdAt: toDate(rt.createdAt)!,
      },
    });
  }
  console.log(`  ✓ ReportTemplates done`);

  console.log('\n🎉 Migration complete!');
}

migrate()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    sqlite.close();
  });
