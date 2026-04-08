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

export async function generateClientMeetingBriefing(params: {
  clientId: string;
  officeId: string;
  meetingDate: string;
  meetingTime?: string;
  meetingLocation?: string;
  stafferContactId?: string;
  primaryAsk?: string;
  rationale?: string;
  talkingPointsPrompt?: string;
  additionalContext?: string;
}): Promise<string> {
  const { clientId, officeId, stafferContactId } = params;

  // Fetch office/entity data
  const office = await prisma.entity.findUnique({
    where: { id: officeId },
    include: {
      contacts: {
        include: {
          initiatives: { include: { initiative: true } },
        },
      },
      interactions: {
        include: { contacts: { include: { contact: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      },
      initiatives: true,
      initiativeLinks: { include: { initiative: true } },
    },
  });

  if (!office) throw new Error('Office not found');

  // Fetch client data
  const client = await prisma.entity.findUnique({
    where: { id: clientId },
    include: {
      contacts: true,
      initiatives: true,
      initiativeLinks: { include: { initiative: true } },
    },
  });

  // Fetch staffer contact details if provided
  let staffer = null;
  if (stafferContactId) {
    staffer = await prisma.contact.findUnique({
      where: { id: stafferContactId },
      include: {
        entity: true,
        initiatives: { include: { initiative: true } },
      },
    });
  }

  // Build context
  const context = {
    office: {
      name: office.name,
      entityType: office.entityType,
      memberName: office.memberName,
      chamber: office.chamber,
      state: office.state,
      party: office.party,
      committee: office.committee ? JSON.parse(office.committee) : [],
      subcommittee: office.subcommittee ? JSON.parse(office.subcommittee) : [],
      description: office.description,
      address: office.address,
    },
    client: client ? {
      name: client.name,
      industry: client.industry,
      description: client.description,
      capabilityDescription: client.capabilityDescription,
    } : null,
    staffer: staffer ? {
      firstName: staffer.firstName,
      lastName: staffer.lastName,
      title: staffer.title,
      rank: staffer.rank,
      bio: staffer.bio,
    } : null,
    meetingDate: params.meetingDate,
    meetingTime: params.meetingTime || '',
    meetingLocation: params.meetingLocation || '',
    primaryAsk: params.primaryAsk || '',
    rationale: params.rationale || '',
    talkingPointsPrompt: params.talkingPointsPrompt || '',
    additionalContext: params.additionalContext || '',
    recentInteractions: office.interactions.slice(0, 10).map(i => ({
      date: i.date,
      type: i.type,
      subject: i.subject,
      notes: i.notes?.slice(0, 500),
      contacts: i.contacts.map(ic => `${ic.contact.firstName} ${ic.contact.lastName}`),
    })),
    officeContacts: office.contacts.map(c => ({
      name: `${c.firstName} ${c.lastName}`,
      title: c.title,
      rank: c.rank,
      bio: c.bio,
    })),
  };

  const apiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await apiClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a senior government relations advisor at Signal Ridge Strategies. Generate a professional Congressional Meeting Prep briefing memo. Use markdown formatting.

This briefing should follow this exact structure and tone — professional, direct, actionable:

# [Office Name]
# Congressional Meeting Prep

**Position:** [Member position/title]
**Meeting date and time:** [Date and time]
**Meeting Location:** [Location]
**Meeting with:** [Staffer name, title]

## Bio
Write a concise professional biography of the member (2-3 paragraphs). If bio information is available in the CRM data, use it. Otherwise, write one based on your knowledge of this public figure.

## Staff
If staffer information is available, include their background. If a bio is in the CRM, use it. Otherwise, create a brief professional summary based on their title and role.

## Objectives
### Primary Ask:
State the primary ask clearly and concisely.

## Rationale for Meeting
Write 1-2 paragraphs explaining why this meeting matters and why this office should care. Focus on what benefits their state/district/constituents. Use the user's rationale guidance to inform this section.

## Suggested Meeting Structure and Talking Points
Provide structured talking points that flow logically. Include specific, persuasive points. The user's talking points guidance should shape the content. Make these actionable and time-conscious for a typical 30-minute meeting.

## Additional Materials
Note any supporting documents that should be prepared.

Be specific, use real names and details. Write in a professional but direct tone. This should read like it was written by an experienced lobbyist preparing their team for a Hill meeting.`,
    messages: [{
      role: 'user',
      content: `Generate a client meeting briefing memo using this data:\n\n${JSON.stringify(context, null, 2)}`,
    }],
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
