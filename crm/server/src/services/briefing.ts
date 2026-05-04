import Anthropic from '@anthropic-ai/sdk';
import prisma from './prisma';
import { findMember } from './memberLookup';

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
  stafferContactIds?: string[];
  // Back-compat: older callers used a single ID. Accepted but optional.
  stafferContactId?: string;
  primaryAsk?: string;
  rationale?: string;
  talkingPointsPrompt?: string;
  additionalContext?: string;
  // When provided, only these past briefings feed Claude as reference context.
  // When omitted, the legacy behavior pulls every briefing tagged to the client.
  referenceBriefingIds?: string[];
}): Promise<string> {
  const { clientId, officeId } = params;
  const stafferIds = (params.stafferContactIds && params.stafferContactIds.length)
    ? params.stafferContactIds
    : (params.stafferContactId ? [params.stafferContactId] : []);

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

  // Fetch staffer contact details for any selected staffers (one or many)
  const staffers = stafferIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: stafferIds } },
        include: {
          entity: true,
          initiatives: { include: { initiative: true } },
        },
      })
    : [];
  // Preserve the order the user picked them in
  staffers.sort(
    (a, b) => stafferIds.indexOf(a.id) - stafferIds.indexOf(b.id)
  );

  // Determine whether this office represents a single sitting Member of Congress.
  // If yes (e.g. "Sen. Schumer"), we generate a Bio section. If no (e.g. a
  // committee or generic staff org), we omit the Bio section entirely.
  const memberMatch = office.entityType === 'CongressionalOffice'
    ? await findMember({
        displayName: office.name,
        chamber: office.chamber,
        state: office.state,
      })
    : null;
  const isMemberOffice = !!memberMatch;

  // Reference briefings: the wizard either explicitly picked some, explicitly
  // picked none (empty array), or didn't pick at all (undefined → fall back to
  // every briefing tagged to the client).
  const refIds = params.referenceBriefingIds;
  const referenceBriefings = refIds === undefined
    ? await prisma.briefingDocument.findMany({
        where: { clientId },
        include: { office: { select: { name: true } } },
        orderBy: { uploadedAt: 'desc' },
        take: 10,
      })
    : refIds.length > 0
      ? await prisma.briefingDocument.findMany({
          where: { id: { in: refIds } },
          include: { office: { select: { name: true } } },
          orderBy: { uploadedAt: 'desc' },
        })
      : [];

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
    staffers: staffers.map(s => ({
      firstName: s.firstName,
      lastName: s.lastName,
      title: s.title,
      rank: s.rank,
      bio: s.bio,
    })),
    isMemberOffice,
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
    referenceBriefings: referenceBriefings.map(b => {
      let tagsArr: string[] = [];
      try { tagsArr = JSON.parse(b.tags); } catch { /* keep empty */ }
      // Cap each reference briefing's text so a single huge file doesn't
      // dominate context. 8k chars ≈ 2k tokens — enough for tone/voice cues.
      const text = (b.extractedText || '').slice(0, 8000);
      return {
        filename: b.filename,
        atOffice: b.office?.name,
        meetingDate: b.meetingDate,
        tags: tagsArr,
        excerpt: text,
      };
    }),
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
**Meeting with:** [Comma-separated list of every staffer's name and title — include all of them]

## Bio
ONLY include this section if the context's \`isMemberOffice\` is true. Write a concise professional biography of the member (2-3 paragraphs). If bio information is available in the CRM data, use it. Otherwise, write one based on your knowledge of this public figure.

If \`isMemberOffice\` is false (this is a committee, caucus, or staff organization rather than a single Member's personal office), OMIT the entire \`## Bio\` heading and section — go straight from the header block to \`## Staff\`.

## Staff
For EACH staffer in the \`staffers\` array, render a separate subsection. The order of subsections must match the order in the array.

Format every subsection like this:

### [First Last] — [Title]
- [Position 1, organization (year–year)]
- [Position 2, organization (year–year)]
- [Position 3, organization (year–year)]
- [Education entry, school (year)]

Rules:
- Each bullet is one line — a single role with employer and date range. Do NOT write prose.
- Pull the bullets straight from the staffer's \`bio\` field, which is pasted-from-LinkedIn text. Preserve dates exactly as written. Keep the most recent role first.
- If \`bio\` is empty for a staffer, write a single bullet: "- Background not yet on file."
- Do NOT invent positions or dates that aren't in the bio. Do NOT add a paragraph summary above or below the bullets.

## Objectives
### Primary Ask:
State the primary ask clearly and concisely.

## Rationale for Meeting
Write 1-2 paragraphs explaining why this meeting matters and why this office should care. Focus on what benefits their state/district/constituents. Use the user's rationale guidance to inform this section.

## Suggested Meeting Structure and Talking Points
Provide actionable, persuasive talking points for a typical 30-minute meeting. The user's talking points guidance should shape the content.

Match the structural style of the reference briefings:
  - If their talking-points section uses a flat bulleted list, you use a flat bulleted list — no \`###\` subheadings.
  - If their talking-points section uses subheadings (Background / Ask / Why It Matters / etc.), mirror those exact same subheadings here.
  - If there are no reference briefings, default to a flat bulleted list with no subheadings.
Do NOT invent subdivisions the references don't use.

## Additional Materials
Note any supporting documents that should be prepared.

Be specific, use real names and details. Write in a professional but direct tone. This should read like it was written by an experienced lobbyist preparing their team for a Hill meeting.

If the context contains a \`referenceBriefings\` array, treat each entry as a prior briefing prepared for THIS SAME CLIENT (possibly at a different office). Use them to:
  - Carry forward consistent talking points, framing, and the client's preferred phrasing/tone.
  - Reference specific data points (statistics, contract numbers, prior asks) when they're still relevant.
  - Avoid contradicting positions the client has previously taken.
  Do NOT copy them verbatim — synthesize. Do NOT cite them as sources in the briefing text.`,
    messages: [{
      role: 'user',
      content: `Generate a client meeting briefing memo using this data:\n\n${JSON.stringify(context, null, 2)}`,
    }],
  });

  return (message.content[0] as any).text;
}

// Pre-fill draft for the wizard: given selected past briefings, pull a starter
// Primary Ask / Rationale / Talking Points so the user has something to edit
// instead of staring at empty boxes.
export async function extractDraftFromReferences(
  referenceBriefingIds: string[]
): Promise<{ primaryAsk: string; rationale: string; talkingPointsPrompt: string }> {
  if (!referenceBriefingIds.length) return { primaryAsk: '', rationale: '', talkingPointsPrompt: '' };

  const docs = await prisma.briefingDocument.findMany({
    where: { id: { in: referenceBriefingIds } },
    include: { office: { select: { name: true } }, client: { select: { name: true } } },
  });
  if (!docs.length) return { primaryAsk: '', rationale: '', talkingPointsPrompt: '' };

  // Cap each doc's text so total context stays reasonable
  const briefingsForPrompt = docs.map(d => ({
    filename: d.filename,
    office: d.office?.name,
    text: (d.extractedText || '').slice(0, 6000),
  }));

  const apiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await apiClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You read past Hill briefings and extract the parts a lobbyist would want to reuse as a starting point for the next briefing. Given one or more prior briefings prepared for the same client, return a JSON object with three fields:

{
  "primaryAsk": "...",          // the recurring core ask, 1-2 sentences. Keep concrete.
  "rationale": "...",           // why this client/issue matters, 2-4 sentences. Reuse phrasing the client has used.
  "talkingPointsPrompt": "..."  // the recurring themes / angles, as a short bulleted list (use - bullets, one per line)
}

Return ONLY the raw JSON object — no markdown fences, no commentary. If the briefings don't have enough detail for a field, return an empty string for it.`,
    messages: [{
      role: 'user',
      content: `Past briefings to draw from:\n\n${JSON.stringify(briefingsForPrompt, null, 2)}`,
    }],
  });

  const raw = (message.content[0] as any).text || '';
  // Strip optional code fences in case the model added them
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      primaryAsk: String(parsed.primaryAsk || ''),
      rationale: String(parsed.rationale || ''),
      talkingPointsPrompt: String(parsed.talkingPointsPrompt || ''),
    };
  } catch {
    // Fallback: if Claude didn't honor the JSON request, return the raw text
    // in talkingPointsPrompt so the user has something to edit.
    return { primaryAsk: '', rationale: '', talkingPointsPrompt: cleaned };
  }
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
