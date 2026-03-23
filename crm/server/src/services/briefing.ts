import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateEntityBriefing(entityId: string): Promise<string> {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    include: {
      contacts: { include: { initiatives: { include: { initiative: true } } } },
      initiatives: { include: { contacts: { include: { contact: true } } } },
      initiativeLinks: { include: { initiative: { include: { contacts: { include: { contact: true } } } } } },
      interactions: {
        include: { contacts: { include: { contact: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      },
      tasks: { where: { completed: false }, orderBy: { dueDate: 'asc' } },
    },
  });

  if (!entity) throw new Error('Entity not found');

  const context = JSON.stringify(entity, null, 2);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a senior government relations advisor at Signal Ridge Strategies. Generate a concise, professional pre-meeting briefing memo for the following organization. Use markdown formatting.

Structure the memo with these exact sections:
## Who They Are
## Our Relationship History
## Active Initiatives
## Key Contacts
## Suggested Talking Points
## Watch Items & Open Actions

Be specific, use the names and details provided. Write in a professional but direct tone. Focus on what's actionable for the meeting.`,
    messages: [{ role: 'user', content: `Generate a briefing memo for this entity:\n\n${context}` }],
  });

  return (message.content[0] as any).text;
}

export async function generateContactBriefing(contactId: string): Promise<string> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      entity: true,
      initiatives: { include: { initiative: { include: { primaryEntity: true } } } },
      interactions: {
        include: {
          interaction: {
            include: { entity: true, initiative: true },
          },
        },
        orderBy: { interaction: { date: 'desc' } },
        take: 15,
      },
      tasks: { where: { completed: false }, orderBy: { dueDate: 'asc' } },
    },
  });

  if (!contact) throw new Error('Contact not found');

  const context = JSON.stringify(contact, null, 2);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a senior government relations advisor at Signal Ridge Strategies. Generate a concise, professional pre-meeting briefing memo for the following individual. Use markdown formatting.

Structure the memo with these exact sections:
## Who They Are
## Our History With Them
## Active Initiatives
## Suggested Talking Points
## Watch Items & Open Actions

Be specific, use the names and details provided. Write in a professional but direct tone. Focus on what's actionable.`,
    messages: [{ role: 'user', content: `Generate a briefing memo for this contact:\n\n${context}` }],
  });

  return (message.content[0] as any).text;
}
