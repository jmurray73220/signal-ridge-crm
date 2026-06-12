import { Response } from 'express';
import prisma from '../services/prisma';
import { softDelete, logUpdate } from '../services/audit';
import { formatBioSafe } from '../services/bioFormat';
import { AuthRequest } from '../types';

/**
 * Build the per-user contact scope. Users without a workflowClientId see all
 * contacts (current behavior). Users assigned to a workflow client are
 * limited to contacts whose primary entity is that client OR whose tags
 * include the client name (loose tag-based fallback for legacy contacts).
 * Returns null if the caller is unscoped, an array of OR conditions if
 * scoped, or an empty array signal (returned as []) if the workflow client
 * has no linked CRM entity.
 */
async function buildClientScope(req: AuthRequest): Promise<any[] | null> {
  const wfClientId = req.user?.workflowClientId;
  if (!wfClientId) return null;
  const wfClient = await prisma.workflowClient.findUnique({
    where: { id: wfClientId },
    select: { name: true, clientId: true },
  });
  if (!wfClient || !wfClient.clientId) {
    // Workflow user not linked to a CRM entity → see nothing rather than everything.
    return [];
  }
  return [
    { entityId: wfClient.clientId },
    { tags: { contains: wfClient.name } },
  ];
}

export async function getContacts(req: AuthRequest, res: Response) {
  const { entity, tag, name, rank, search } = req.query;

  const where: any = {};
  const ands: any[] = [];

  if (name || search) {
    const q = (name || search) as string;
    ands.push({ OR: [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
    ]});
  }

  if (entity) where.entityId = entity as string;
  if (rank) where.rank = { contains: rank as string };

  try {
    const scope = await buildClientScope(req);
    if (scope !== null) {
      if (scope.length === 0) return res.json([]);
      ands.push({ OR: scope });
    }
    if (ands.length > 0) where.AND = ands;

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true, entityType: true, chamber: true, governmentType: true, party: true, committee: true, subcommittee: true } },
        interactions: {
          include: { interaction: { select: { date: true } } },
          orderBy: { interaction: { date: 'desc' } },
          take: 1,
        },
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const result = contacts.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      issuePortfolios: JSON.parse(c.issuePortfolios || '[]'),
      lastInteraction: c.interactions[0]?.interaction?.date || null,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getContact(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const scope = await buildClientScope(req);
    if (scope !== null) {
      if (scope.length === 0) return res.status(404).json({ error: 'Contact not found' });
      const allowed = await prisma.contact.findFirst({
        where: { AND: [{ id }, { OR: scope }] },
        select: { id: true },
      });
      if (!allowed) return res.status(404).json({ error: 'Contact not found' });
    }
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        entity: true,
        initiatives: {
          include: {
            initiative: {
              include: { primaryEntity: { select: { id: true, name: true, entityType: true } } },
            },
          },
        },
        interactions: {
          include: {
            interaction: {
              include: {
                entity: { select: { id: true, name: true, entityType: true } },
                initiative: { select: { id: true, title: true } },
                _count: { select: { attachments: true } },
              },
            },
          },
          orderBy: { interaction: { date: 'desc' } },
        },
        tasks: {
          include: {
            entity: { select: { id: true, name: true, entityType: true } },
            initiative: { select: { id: true, title: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    return res.json({
      ...contact,
      tags: JSON.parse(contact.tags || '[]'),
      issuePortfolios: JSON.parse(contact.issuePortfolios || '[]'),
      entity: contact.entity ? {
        ...contact.entity,
        tags: JSON.parse(contact.entity.tags || '[]'),
        committee: JSON.parse((contact.entity as any).committee || '[]'),
        contractVehicles: JSON.parse((contact.entity as any).contractVehicles || '[]'),
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createContact(req: AuthRequest, res: Response) {
  const { firstName, lastName, rank, title, email, officePhone, cell, linkedIn, website, bio, tags, issuePortfolios, entityId } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First and last name required' });
  }

  try {
    // Auto-format pasted LinkedIn/bio text into a narrative + Experience list.
    // Falls back to the raw text if the formatter fails, so a save never breaks.
    const formattedBio = await formatBioSafe(bio);
    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        rank: rank || null,
        title: title || null,
        email: email || null,
        officePhone: officePhone || null,
        cell: cell || null,
        linkedIn: linkedIn || null,
        website: website || null,
        bio: formattedBio || null,
        tags: JSON.stringify(tags || []),
        issuePortfolios: JSON.stringify(issuePortfolios || []),
        entityId: entityId || null,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
      include: { entity: { select: { id: true, name: true, entityType: true } } },
    });
    return res.status(201).json({
      ...contact,
      tags: JSON.parse(contact.tags || '[]'),
      issuePortfolios: JSON.parse(contact.issuePortfolios || '[]'),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateContact(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { firstName, lastName, rank, title, email, officePhone, cell, linkedIn, website, bio, tags, issuePortfolios, entityId } = req.body;

  try {
    const before = await prisma.contact.findUnique({ where: { id } });
    if (!before || before.deletedAt) return res.status(404).json({ error: 'Not found' });
    // Re-format the bio only when it was actually changed in this edit — a new
    // LinkedIn paste. Unchanged bios (or edits to other fields) are left as-is,
    // so we never re-run the formatter on an already-clean bio.
    const bioChanged = bio !== undefined && bio !== before.bio;
    const nextBio = bioChanged ? await formatBioSafe(bio) : undefined;
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        rank: rank !== undefined ? rank : undefined,
        title: title !== undefined ? title : undefined,
        email: email !== undefined ? email : undefined,
        officePhone: officePhone !== undefined ? officePhone : undefined,
        cell: cell !== undefined ? cell : undefined,
        linkedIn: linkedIn !== undefined ? linkedIn : undefined,
        website: website !== undefined ? website : undefined,
        bio: bioChanged ? (nextBio ?? null) : undefined,
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(issuePortfolios !== undefined && { issuePortfolios: JSON.stringify(issuePortfolios) }),
        entityId: entityId !== undefined ? entityId : undefined,
        updatedByUserId: req.user!.userId,
      },
      include: { entity: { select: { id: true, name: true, entityType: true } } },
    });
    await logUpdate({
      entityType: 'Contact',
      id,
      userId: req.user?.userId || null,
      before: before as unknown as Record<string, unknown>,
      after: contact as unknown as Record<string, unknown>,
    });
    return res.json({
      ...contact,
      tags: JSON.parse(contact.tags || '[]'),
      issuePortfolios: JSON.parse(contact.issuePortfolios || '[]'),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// Bank of issue portfolios — sourced from the IssuePortfolio table. The
// initial seed (Intel, CYBERCOM, SOCOM, Army RDT&E, Navy RDT&E) is inserted
// on first read if the table is empty, so renames and deletes through this
// API are durable.
const SEED_ISSUE_PORTFOLIOS = ['Intel', 'CYBERCOM', 'SOCOM', 'Army RDT&E', 'Navy RDT&E'];

async function ensureSeeded(): Promise<void> {
  const count = await prisma.issuePortfolio.count();
  if (count === 0) {
    await prisma.issuePortfolio.createMany({
      data: SEED_ISSUE_PORTFOLIOS.map(name => ({ name })),
      skipDuplicates: true,
    });
  }
}

export async function listIssuePortfolios(_req: AuthRequest, res: Response) {
  try {
    await ensureSeeded();
    const rows = await prisma.issuePortfolio.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return res.json(rows.map(r => r.name));
  } catch (err) {
    console.error('[listIssuePortfolios]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createIssuePortfolio(req: AuthRequest, res: Response) {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await ensureSeeded();
    await prisma.issuePortfolio.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    return res.json({ name });
  } catch (err) {
    console.error('[createIssuePortfolio]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Rename: update the bank row + rewrite every contact's JSON array that
// contains the old name.
export async function renameIssuePortfolio(req: AuthRequest, res: Response) {
  const oldName = req.params.name;
  const newName = String(req.body?.name || '').trim();
  if (!oldName || !newName) return res.status(400).json({ error: 'oldName and new name required' });
  if (oldName === newName) return res.json({ ok: true });
  try {
    const existing = await prisma.issuePortfolio.findUnique({ where: { name: oldName } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const collision = await prisma.issuePortfolio.findUnique({ where: { name: newName } });
    if (collision) return res.status(409).json({ error: `"${newName}" already exists` });

    // Update the bank row.
    await prisma.issuePortfolio.update({
      where: { name: oldName },
      data: { name: newName },
    });

    // Cascade to contacts. issuePortfolios is a JSON-stringified array — find
    // anything that mentions the old name and rewrite it. Brute string match
    // is fine for the volume we expect.
    const matches = await prisma.contact.findMany({
      where: { issuePortfolios: { contains: JSON.stringify(oldName).slice(1, -1) } },
      select: { id: true, issuePortfolios: true },
    });
    for (const c of matches) {
      try {
        const arr = JSON.parse(c.issuePortfolios || '[]') as string[];
        const next = arr.map(n => (n === oldName ? newName : n));
        if (JSON.stringify(next) !== JSON.stringify(arr)) {
          await prisma.contact.update({
            where: { id: c.id },
            data: { issuePortfolios: JSON.stringify(next) },
          });
        }
      } catch { /* skip bad rows */ }
    }

    return res.json({ ok: true, renamed: matches.length });
  } catch (err) {
    console.error('[renameIssuePortfolio]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteIssuePortfolio(req: AuthRequest, res: Response) {
  const name = req.params.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const existing = await prisma.issuePortfolio.findUnique({ where: { name } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.issuePortfolio.delete({ where: { name } });

    // Cascade: drop the name from every contact's JSON array.
    const matches = await prisma.contact.findMany({
      where: { issuePortfolios: { contains: JSON.stringify(name).slice(1, -1) } },
      select: { id: true, issuePortfolios: true },
    });
    for (const c of matches) {
      try {
        const arr = JSON.parse(c.issuePortfolios || '[]') as string[];
        const next = arr.filter(n => n !== name);
        if (next.length !== arr.length) {
          await prisma.contact.update({
            where: { id: c.id },
            data: { issuePortfolios: JSON.stringify(next) },
          });
        }
      } catch { /* skip bad rows */ }
    }

    return res.json({ ok: true, removedFrom: matches.length });
  } catch (err) {
    console.error('[deleteIssuePortfolio]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteContact(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });
    await softDelete({
      modelName: 'contact',
      entityType: 'Contact',
      id,
      userId: req.user?.userId || null,
      snapshot: existing as unknown as Record<string, unknown>,
    });
    return res.json({ message: 'Contact moved to recycle bin' });
  } catch (err) {
    console.error('[deleteContact]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getContactInteractions(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const items = await prisma.interactionContact.findMany({
      where: { contactId: id },
      include: {
        interaction: {
          include: {
            entity: { select: { id: true, name: true, entityType: true } },
            initiative: { select: { id: true, title: true } },
            contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
            _count: { select: { attachments: true } },
          },
        },
      },
      orderBy: { interaction: { date: 'desc' } },
    });
    return res.json(items.map(i => i.interaction));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getContactInitiatives(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const items = await prisma.initiativeContact.findMany({
      where: { contactId: id },
      include: {
        initiative: {
          include: {
            primaryEntity: { select: { id: true, name: true, entityType: true } },
          },
        },
      },
    });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function importContacts(req: AuthRequest, res: Response) {
  const { contacts: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const { firstName, lastName, rank, title, email, officePhone, cell, linkedIn, bio, tags, organizationName, subcommittee } = row;
    if (!firstName || !lastName) {
      results.errors.push(`Skipped row: missing first or last name (${firstName || ''} ${lastName || ''})`);
      results.skipped++;
      continue;
    }

    try {
      // Look up entity by name if provided
      let entityId: string | null = null;
      if (organizationName) {
        const entity = await prisma.entity.findFirst({
          where: { name: { equals: organizationName } },
        });
        if (entity) entityId = entity.id;
      }

      // For committee staff, subcommittee is stored in the rank field
      const effectiveRank = subcommittee?.trim() || rank?.trim() || null;

      await prisma.contact.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          rank: effectiveRank,
          title: title?.trim() || null,
          email: email?.trim() || null,
          officePhone: officePhone?.trim() || null,
          cell: cell?.trim() || null,
          linkedIn: linkedIn?.trim() || null,
          bio: bio?.trim() || null,
          tags: JSON.stringify(Array.isArray(tags) ? tags : (tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [])),
          entityId,
          createdByUserId: req.user!.userId,
          updatedByUserId: req.user!.userId,
        },
      });
      results.created++;
    } catch (err) {
      results.errors.push(`Failed to create ${firstName} ${lastName}: ${(err as Error).message}`);
      results.skipped++;
    }
  }

  return res.json(results);
}

export async function getContactTasks(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const tasks = await prisma.task.findMany({
      where: { contactId: id },
      include: {
        entity: { select: { id: true, name: true, entityType: true } },
        initiative: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
