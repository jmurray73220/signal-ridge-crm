import prisma from './prisma';

export function toCSV(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(',');
  const rowLines = rows.map(row => row.map(cell => escape(String(cell ?? ''))).join(','));
  return [headerLine, ...rowLines].join('\n');
}

export async function exportContacts(): Promise<string> {
  const contacts = await prisma.contact.findMany({
    include: { entity: { select: { name: true, entityType: true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const headers = ['Last Name', 'First Name', 'Rank', 'Title', 'Organization', 'Org Type', 'Email', 'Office Phone', 'Cell', 'LinkedIn', 'Tags', 'Bio'];
  const rows = contacts.map(c => [
    c.lastName, c.firstName, c.rank || '', c.title || '',
    c.entity?.name || '', c.entity?.entityType || '',
    c.email || '', c.officePhone || '', c.cell || '', c.linkedIn || '',
    JSON.parse(c.tags || '[]').join('; '), c.bio || '',
  ]);
  return toCSV(headers, rows);
}

export async function exportEntities(entityType?: string): Promise<string> {
  const where = entityType ? { entityType } : {};
  const entities = await prisma.entity.findMany({
    where,
    include: { _count: { select: { contacts: true, initiatives: true } } },
    orderBy: { name: 'asc' },
  });

  const headers = ['Name', 'Type', 'Member/Sub-Component', 'Parent Agency/Chamber', 'State', 'Party', 'Gov Type', 'Industry', 'Contacts', 'Active Initiatives', 'Tags', 'Description'];
  const rows = entities.map(e => [
    e.name, e.entityType,
    e.memberName || e.subComponent || '',
    e.parentAgency || e.chamber || '',
    e.state || '', e.party || '', e.governmentType || '', e.industry || '',
    String(e._count.contacts), String(e._count.initiatives),
    JSON.parse(e.tags || '[]').join('; '), e.description || '',
  ]);
  return toCSV(headers, rows);
}

export async function exportInteractions(): Promise<string> {
  const interactions = await prisma.interaction.findMany({
    include: {
      entity: { select: { name: true } },
      initiative: { select: { title: true } },
      contacts: { include: { contact: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { date: 'desc' },
  });

  const headers = ['Date', 'Type', 'Subject', 'Organization', 'Initiative', 'Contacts', 'Notes', 'Gmail Thread URL'];
  const rows = interactions.map(i => [
    i.date.toISOString().split('T')[0],
    i.type,
    i.subject,
    i.entity?.name || '',
    i.initiative?.title || '',
    i.contacts.map(ic => `${ic.contact.firstName} ${ic.contact.lastName}`).join('; '),
    i.notes || '',
    i.gmailThreadUrl || '',
  ]);
  return toCSV(headers, rows);
}
