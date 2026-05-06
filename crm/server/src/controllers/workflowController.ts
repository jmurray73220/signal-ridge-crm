import { Response } from 'express';
import prisma from '../services/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { softDelete } from '../services/audit';
import { AuthRequest } from '../types';
import { assertClientAccess } from '../middleware/workflowAuth';


const LAYER_FRAMEWORK = `CAITIP is funded as four distinct layers, each paired to a funding vehicle:

- Layer 1 — AI/ML Research Core (funded by SBIR): entity resolution methodology, multi-spectrum correlation engine, feasibility-scale research artifacts.
- Layer 2 — Integrated Prototype (funded by Genesis at AFRL/RIGA): the prototype that assembles Layer 1 methodology into a demonstrable system with a government-facing demonstration and transition plan.
- Layer 3 — Operator-Facing Tools (funded by AFWERX): Hunt Chat, Response Packaging automation, mission planning workflow for AFCYBER operators. Workflow-first, Execution-Gap framing.
- Layer 4 — Commercial Platform (funded by DIU): commercial platform adaptation for DoD use — geospatial interface, SaaS deployment, government-hardened instance. Requires a DoD transition partner.

A separate "CYBERCOM / AFCYBER Relationship Development" track is not a funding vehicle — it exists for transition-customer relationship building, letters of interest, and deterrence-framed briefings. If a SOW is about relationship building, introductory briefings, letters of interest, or deterrence framing (not an R&D deliverable), that is the correct track.

A "Master Execution Timeline" track exists for cross-cutting 180-day execution planning. A SOW should only be assigned there if it is explicitly a timeline/coordination document, not a scoped deliverable.`;

// ─── Clients ──────────────────────────────────────────────────────────────

export async function listClients(req: AuthRequest, res: Response) {
  try {
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    const where = isAdmin ? {} : { id: req.user!.workflowClientId || '' };
    const clients = await prisma.workflowClient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { tracks: true, sows: true } } },
    });
    return res.json(clients);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * List CRM Entity records with entityType='Client' so the workflow Admin can
 * link a new WorkflowClient to an existing CRM client record.
 */
export async function listCrmClientEntities(_req: AuthRequest, res: Response) {
  try {
    const entities = await prisma.entity.findMany({
      where: { entityType: 'Client' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return res.json(entities);
  } catch (err) {
    console.error('[listCrmClientEntities]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  if (!assertClientAccess(req, id)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const client = await prisma.workflowClient.findUnique({
      where: { id },
      include: { _count: { select: { tracks: true, sows: true } } },
    });
    if (!client) return res.status(404).json({ error: 'Not found' });
    return res.json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createClient(req: AuthRequest, res: Response) {
  const { name, clientId } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const client = await prisma.workflowClient.create({
      data: { name, clientId: clientId || null },
    });
    return res.status(201).json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Create a WorkflowClient for every CRM Entity with entityType='Client' that
 * doesn't already have one (matched by WorkflowClient.clientId == Entity.id).
 * Idempotent — safe to re-run.
 */
export async function backfillClientsFromCrm(_req: AuthRequest, res: Response) {
  try {
    const [crmClients, existing] = await Promise.all([
      prisma.entity.findMany({
        where: { entityType: 'Client' },
        select: { id: true, name: true },
      }),
      prisma.workflowClient.findMany({
        where: { clientId: { not: null } },
        select: { clientId: true },
      }),
    ]);
    const existingIds = new Set(existing.map(e => e.clientId).filter((s): s is string => !!s));
    const toCreate = crmClients.filter(c => !existingIds.has(c.id));

    if (toCreate.length === 0) {
      return res.json({ created: 0, alreadyExisted: crmClients.length, items: [] });
    }

    const created = await prisma.$transaction(
      toCreate.map(c => prisma.workflowClient.create({
        data: { name: c.name, clientId: c.id },
      }))
    );

    return res.status(201).json({
      created: created.length,
      alreadyExisted: crmClients.length - created.length,
      items: created.map(c => ({ id: c.id, name: c.name, clientId: c.clientId })),
    });
  } catch (err) {
    console.error('[backfillClientsFromCrm]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { name, clientId } = req.body;
  try {
    const client = await prisma.workflowClient.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(clientId !== undefined && { clientId }),
      },
    });
    return res.json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowClient.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Tracks ───────────────────────────────────────────────────────────────

/**
 * Status cascade — manual at the action-item level, derived everywhere above:
 *   actions (Todo|InProgress|Done|Blocked, manual)
 *     → steps   (NotStarted|InProgress|Completed|Blocked, derived)
 *       → phases (NotStarted|InProgress|Completed|Blocked, derived)
 *
 * Empty containers default to InProgress (per user: "if there are no steps,
 * the phase should be in progress" — same rule applies to empty steps).
 */
function deriveStepStatus(actionItems: Array<{ status: string }>): string {
  if (actionItems.length === 0) return 'InProgress';
  if (actionItems.every(a => a.status === 'Done')) return 'Completed';
  if (actionItems.some(a => a.status === 'Blocked')) return 'Blocked';
  if (actionItems.every(a => a.status === 'Todo')) return 'NotStarted';
  return 'InProgress';
}

function derivePhaseStatus(milestones: Array<{ status: string }>): string {
  if (milestones.length === 0) return 'InProgress';
  if (milestones.every(m => m.status === 'Completed')) return 'Completed';
  if (milestones.some(m => m.status === 'Blocked')) return 'Blocked';
  if (milestones.every(m => m.status === 'NotStarted')) return 'NotStarted';
  return 'InProgress';
}

/**
 * Apply derivation in order: steps first (so phases can read their derived
 * status), then phases.
 */
function applyDerivedPhaseStatus<T extends { phases: Array<{ status: string; milestones: Array<{ status: string; actionItems: Array<{ status: string }> }> }> }>(track: T): T {
  for (const phase of track.phases) {
    for (const m of phase.milestones) {
      m.status = deriveStepStatus(m.actionItems);
    }
    phase.status = derivePhaseStatus(phase.milestones);
  }
  return track;
}

export async function listTracks(req: AuthRequest, res: Response) {
  const { workflowClientId } = req.query;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId as string)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tracks = await prisma.workflowTrack.findMany({
      where: { workflowClientId: workflowClientId as string },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        phases: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            milestones: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                actionItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });
    return res.json(tracks.map(applyDerivedPhaseStatus));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function parseTrackJsonFields<T extends Record<string, any>>(track: T): T {
  const safeParse = (v: any, fallback: any) => {
    if (typeof v !== 'string') return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
  };
  return {
    ...track,
    focusAreas: safeParse((track as any).focusAreas, []),
    targetedFocusAreas: safeParse((track as any).targetedFocusAreas, []),
    pointsOfContact: safeParse((track as any).pointsOfContact, []),
    additionalSections: safeParse((track as any).additionalSections, []),
  };
}

export async function getTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const track = await prisma.workflowTrack.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            milestones: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                actionItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
            // Strip the heavy fileData blob from the listing — clients fetch it
            // via the dedicated download endpoint when they need the bytes.
            attachments: {
              select: {
                id: true, phaseId: true, filename: true, mimeType: true,
                uploadedAt: true, uploadedByUserId: true,
              },
              orderBy: { uploadedAt: 'desc' },
            },
            links: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!track) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    // Load the attached SOW separately (if any). Keeps this endpoint resilient
    // to any reverse-relation quirks in the generated Prisma client.
    const sow = await prisma.workflowSOW.findFirst({
      where: { trackId: id },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
    return res.json({ ...parseTrackJsonFields(applyDerivedPhaseStatus(track) as any), sow });
  } catch (err) {
    console.error('[getTrack]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Mirror a workflow track into the CRM Initiative table so tracks show up in
 * the CRM alongside other entity-linked work. Soft-linked (no FK) to keep the
 * workflow tool decoupled — we store the initiative id on the track.
 */
async function upsertMirrorInitiative(params: {
  track: { id: string; title: string; description: string | null; fundingVehicle: string | null; status: string; initiativeId: string | null };
  workflowClientId: string;
  actingUserId: string | null;
}) {
  const client = await prisma.workflowClient.findUnique({
    where: { id: params.workflowClientId },
  });
  const primaryEntityId = client?.clientId ?? null;

  const description = [params.track.fundingVehicle, params.track.description]
    .filter((v): v is string => !!v)
    .join('\n\n') || null;

  const crmStatus =
    params.track.status === 'Completed'
      ? 'Closed'
      : params.track.status === 'OnHold'
      ? 'OnHold'
      : 'Active';

  if (params.track.initiativeId) {
    // Try update; if it's gone (user deleted it in CRM), fall back to create.
    const existing = await prisma.initiative.findUnique({
      where: { id: params.track.initiativeId },
    });
    if (existing) {
      await prisma.initiative.update({
        where: { id: params.track.initiativeId },
        data: {
          title: params.track.title,
          description,
          primaryEntityId,
          status: crmStatus,
          ...(params.actingUserId && { updatedByUserId: params.actingUserId }),
        },
      });
      return params.track.initiativeId;
    }
  }

  const initiative = await prisma.initiative.create({
    data: {
      title: params.track.title,
      description,
      primaryEntityId,
      status: crmStatus,
      priority: 'Medium',
      ...(params.actingUserId && {
        createdByUserId: params.actingUserId,
        updatedByUserId: params.actingUserId,
      }),
    },
  });
  return initiative.id;
}

// Default phases seeded onto a contract-opportunity track. Editable later —
// users can rename, reorder, delete, or add their own. The first phase is
// active out of the gate; the rest are queued.
const OPPORTUNITY_PHASES: { title: string; description: string; status: 'InProgress' | 'NotStarted' }[] = [
  { title: 'Capture & Triage', description: 'Initial review, bid/no-bid decision, capture plan.', status: 'InProgress' },
  { title: 'Pre-proposal', description: 'Submit clarifying questions, white paper, or RFI response.', status: 'NotStarted' },
  { title: 'Proposal Development', description: 'Draft technical, cost, management, and past-performance volumes.', status: 'NotStarted' },
  { title: 'Compliance & Submission', description: 'Section L/M compliance check, page-count audit, final upload.', status: 'NotStarted' },
  { title: 'Post-submission', description: 'Vendor Q&A, oral presentations, BAFO if requested.', status: 'NotStarted' },
  { title: 'Award Decision', description: 'Debrief on loss, kickoff on win.', status: 'NotStarted' },
];

export async function createTrack(req: AuthRequest, res: Response) {
  const {
    workflowClientId, title, description, fundingVehicle, status, sortOrder,
    isContractOpportunity, opportunityUrl,
  } = req.body;
  if (!workflowClientId || !title) return res.status(400).json({ error: 'workflowClientId and title required' });
  try {
    const isOpp = Boolean(isContractOpportunity);
    const track = await prisma.workflowTrack.create({
      data: {
        workflowClientId,
        title,
        description: description || null,
        fundingVehicle: fundingVehicle || null,
        status: status || 'Active',
        sortOrder: sortOrder ?? 0,
        isContractOpportunity: isOpp,
        opportunityUrl: isOpp && opportunityUrl ? String(opportunityUrl).trim() : null,
        aiExtractionStatus: isOpp && opportunityUrl ? 'pending' : null,
      },
    });

    // Auto-seed proposal-cycle phases for opportunity tracks. They're free to
    // delete, rename, reorder, or add their own.
    if (isOpp) {
      await prisma.workflowPhase.createMany({
        data: OPPORTUNITY_PHASES.map((p, i) => ({
          trackId: track.id,
          title: p.title,
          description: p.description,
          status: p.status,
          sortOrder: i,
        })),
      });
    }

    // Mirror into CRM Initiative
    try {
      const initiativeId = await upsertMirrorInitiative({
        track: { ...track, initiativeId: null },
        workflowClientId,
        actingUserId: req.user?.userId || null,
      });
      await prisma.workflowTrack.update({
        where: { id: track.id },
        data: { initiativeId },
      });
      (track as any).initiativeId = initiativeId;
    } catch (mirrorErr) {
      console.error('[createTrack] initiative mirror failed:', mirrorErr);
      // Non-fatal — track still exists
    }

    // Kick off Claude extraction in the background if we have a URL. Track
    // status surfaces in the UI so the user knows fields are populating.
    if (isOpp && opportunityUrl) {
      extractTrackFromUrl(track.id, String(opportunityUrl).trim()).catch(err => {
        console.error('[createTrack] background extraction failed:', err);
      });
    }

    return res.status(201).json(track);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Contract opportunity AI fill ────────────────────────────────────────────
// Fetches the URL, hands the page to Claude, and writes back a small set of
// structured fields on the track. Designed to be called fire-and-forget; all
// state lives on `aiExtractionStatus`.
const VEHICLE_TYPES = ['SBIR-PhI', 'SBIR-PhII', 'STTR', 'OTA', 'BAA', 'CSO', 'RFP', 'IDIQ-TO', 'Grant', 'Other'];

export async function extractTrackFromUrl(trackId: string, url: string): Promise<void> {
  console.log(`[extractTrackFromUrl] start track=${trackId} url=${url}`);
  // Set status pending (idempotent — re-running is safe).
  await prisma.workflowTrack.update({
    where: { id: trackId },
    data: { aiExtractionStatus: 'pending' },
  }).catch(() => undefined);

  let pageText = '';
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: {
        // SAM.gov, DSIP, and most public solicitation hosts allow vanilla
        // browser-style requests. Some agency portals will 403 here — we'll
        // mark "blocked" and surface to the UI for a Bubba handoff.
        'User-Agent': 'Mozilla/5.0 (compatible; SignalRidgeCRM/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
    });
    if (!resp.ok) {
      await prisma.workflowTrack.update({
        where: { id: trackId },
        data: { aiExtractionStatus: 'blocked', aiExtractedAt: new Date() },
      });
      return;
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const out = await pdfParse(buf);
      pageText = (out.text || '').slice(0, 60_000);
    } else {
      const html = await resp.text();
      // Strip script/style/nav garbage and collapse whitespace. Good enough
      // for Claude — it ignores noise just fine, but smaller payload = faster.
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60_000);
    }
  } catch (err) {
    console.error('[extractTrackFromUrl] fetch failed:', err);
    await prisma.workflowTrack.update({
      where: { id: trackId },
      data: { aiExtractionStatus: 'blocked', aiExtractedAt: new Date() },
    });
    return;
  }

  if (pageText.length < 200) {
    await prisma.workflowTrack.update({
      where: { id: trackId },
      data: { aiExtractionStatus: 'blocked', aiExtractedAt: new Date() },
    });
    return;
  }

  await runOpportunityExtraction(trackId, pageText);
}

// Opus-driven structured-output extraction. Used by both URL and pasted-text
// flows. Updates aiExtractionStatus + the structured fields it can fill.
async function runOpportunityExtraction(trackId: string, pageText: string): Promise<void> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sys = `You extract opportunity details from a US-government contract solicitation, BAA, OTA, SBIR/STTR topic, or RFP.

Rules:
- Return ONLY a single valid JSON object. No prose before or after.
- Be SPECIFIC. Quote concrete language from the source — agency names, dollar figures, dates, statutory citations, focus area titles, eligibility terms — exactly as written.
- For "objective": write 4-7 sentences. Cover what is being solicited, who is soliciting it, why, and the operational context. Reference the named program/initiative if there is one.
- For "focusAreas": include EVERY focus area, topic, technical area, or numbered TA/TE listed. For each, give a 2-4 sentence summary that captures the technical specifics, not just the title. If a focus area has sub-bullets describing technologies of interest, include them.
- "additionalSections": catch-all for anything else the user would care about that doesn't fit the named fields. Examples: classification level, page limits, oral defense requirements, set-aside notes, Q&A windows, team composition rules, IP/data-rights language, place of performance.
- For ANY field you cannot find in the source, set its value to null. Do not invent or infer beyond what the text says.
- Date fields must be ISO 8601 (YYYY-MM-DD). If only a month/year is given, use the first of the month. If only a quarter is given, leave null.`;

    const schemaPrompt = `Return JSON exactly matching this shape:
{
  "title": "string — concise opportunity title (program/initiative name + topic if applicable)",
  "solicitationNumber": "string — solicitation/topic/announcement number (e.g. SOCOM-25-001), or null",
  "vehicleType": "one of ${JSON.stringify(VEHICLE_TYPES)} or null — pick the closest match",
  "issuingAgency": "string — issuing organization with sub-org if stated (e.g. 'USSOCOM SOF AT&L'), or null",
  "fundingAuthority": "string — statutory authority if cited (e.g. '10 U.S.C. 4022 and 4023'), or null",
  "questionsDueDate": "ISO date or null — deadline to submit clarifying questions",
  "proposalDueDate": "ISO date or null — final proposal/white paper submission deadline",
  "periodOfPerformance": "string as written, e.g. '12 months base + 12 months option', or null",
  "fundingFloor": "string as written, e.g. '$250K', or null",
  "fundingCeiling": "string as written, e.g. '$1.8M for Phase II', or null",
  "eligibility": "string — eligibility/qualification terms quoted from the source, or null",
  "submissionFormat": "string — submission process and required volumes/format, or null",
  "objective": "string — 4-7 sentence detailed summary",
  "focusAreas": [
    { "name": "string — focus area title as written", "summary": "string — 2-4 sentence technical summary with specifics" }
  ],
  "pointsOfContact": [
    { "name": "string", "role": "string (e.g. Contracting Officer, Technical POC)", "email": "string or null" }
  ],
  "additionalSections": [
    { "heading": "string — a short title for the section", "content": "string — 1-3 sentence summary" }
  ]
}

Source page text:
${pageText.slice(0, 80_000)}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      system: sys,
      messages: [{ role: 'user', content: schemaPrompt }],
    });

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('\n');
    console.log(`[runOpportunityExtraction] track=${trackId} model returned ${text.length} chars`);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[runOpportunityExtraction] track=${trackId} no JSON found in response`);
      await prisma.workflowTrack.update({
        where: { id: trackId },
        data: { aiExtractionStatus: 'failed', aiExtractedAt: new Date() },
      });
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn(`[runOpportunityExtraction] track=${trackId} JSON parse failed:`, parseErr);
      await prisma.workflowTrack.update({
        where: { id: trackId },
        data: { aiExtractionStatus: 'failed', aiExtractedAt: new Date() },
      });
      return;
    }
    console.log(`[runOpportunityExtraction] track=${trackId} parsed keys:`, Object.keys(parsed).join(','));

    const data: any = {
      aiExtractionStatus: 'ok',
      aiExtractedAt: new Date(),
    };
    if (parsed.title && typeof parsed.title === 'string') data.title = parsed.title;
    if (parsed.solicitationNumber) data.solicitationNumber = String(parsed.solicitationNumber);
    if (parsed.vehicleType && VEHICLE_TYPES.includes(parsed.vehicleType)) data.vehicleType = parsed.vehicleType;
    if (parsed.issuingAgency) data.issuingAgency = String(parsed.issuingAgency);
    if (parsed.fundingAuthority) data.fundingAuthority = String(parsed.fundingAuthority);
    if (parsed.questionsDueDate) {
      const d = new Date(parsed.questionsDueDate);
      if (!isNaN(d.getTime())) data.questionsDueDate = d;
    }
    if (parsed.proposalDueDate) {
      const d = new Date(parsed.proposalDueDate);
      if (!isNaN(d.getTime())) data.proposalDueDate = d;
    }
    if (parsed.periodOfPerformance) data.periodOfPerformance = String(parsed.periodOfPerformance);
    if (parsed.fundingFloor) data.fundingFloor = String(parsed.fundingFloor);
    if (parsed.fundingCeiling) data.fundingCeiling = String(parsed.fundingCeiling);
    if (parsed.eligibility) data.eligibility = String(parsed.eligibility);
    if (parsed.submissionFormat) data.submissionFormat = String(parsed.submissionFormat);
    if (parsed.objective) data.objective = String(parsed.objective);

    // JSON arrays — store as strings, default to empty array string.
    data.focusAreas = JSON.stringify(Array.isArray(parsed.focusAreas) ? parsed.focusAreas : []);
    data.pointsOfContact = JSON.stringify(Array.isArray(parsed.pointsOfContact) ? parsed.pointsOfContact : []);
    data.additionalSections = JSON.stringify(Array.isArray(parsed.additionalSections) ? parsed.additionalSections : []);

    // Mark partial if Claude couldn't fill at least the basics.
    const basicFilled = ['solicitationNumber', 'vehicleType', 'proposalDueDate', 'objective'].filter(k => data[k]).length;
    const focusCount = Array.isArray(parsed.focusAreas) ? parsed.focusAreas.length : 0;
    if (basicFilled === 0 && focusCount === 0) data.aiExtractionStatus = 'partial';

    await prisma.workflowTrack.update({
      where: { id: trackId },
      data,
    });
  } catch (err) {
    console.error('[runOpportunityExtraction] Claude call failed:', err);
    await prisma.workflowTrack.update({
      where: { id: trackId },
      data: { aiExtractionStatus: 'failed', aiExtractedAt: new Date() },
    }).catch(() => undefined);
  }
}

// Pre-flight URL probe used by the create-opportunity modal. Tells the UI
// whether the server can actually read this URL before we commit to creating
// the track. If it can't, the user gets paste/bookmarklet options up front
// instead of finding out later by visiting the track.
export async function probeOpportunityUrl(req: AuthRequest, res: Response) {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, reason: 'invalid_url' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalRidgeCRM/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return res.json({ ok: false, status: resp.status, reason: 'http_error' });
    }
    // Read a small slice to confirm it's not a JS-only shell. If the body is
    // tiny or all <script> tags, the page is probably a SPA we can't parse.
    const ct = resp.headers.get('content-type') || '';
    let preview = '';
    try {
      const body = await resp.text();
      preview = body.slice(0, 50_000);
    } catch {
      return res.json({ ok: false, reason: 'unreadable_body' });
    }
    if (ct.includes('application/pdf')) {
      return res.json({ ok: true, contentType: 'pdf' });
    }
    const visibleText = preview
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (visibleText.length < 200) {
      return res.json({ ok: false, reason: 'js_only_or_empty' });
    }
    return res.json({ ok: true, contentType: 'html', textLength: visibleText.length });
  } catch (err: any) {
    console.error('[probeOpportunityUrl]', err);
    return res.json({ ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'fetch_failed' });
  }
}

// Manual paste fallback — user grabs the page text from a logged-in browser
// tab and pastes it into the track. Same Claude extraction.
export async function extractTrackFromText(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { text } = req.body as { text?: string };
  if (!text || text.trim().length < 100) {
    return res.status(400).json({ error: 'Provide at least 100 characters of opportunity page text' });
  }
  try {
    const track = await prisma.workflowTrack.findUnique({ where: { id } });
    if (!track) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    await prisma.workflowTrack.update({
      where: { id },
      data: { aiExtractionStatus: 'pending' },
    });

    runOpportunityExtraction(id, text).catch(err => {
      console.error('[extractTrackFromText] background failed:', err);
    });
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[extractTrackFromText]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// HTTP wrapper so the user can manually retry extraction from the UI.
export async function retryExtractTrackFromUrl(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const track = await prisma.workflowTrack.findUnique({ where: { id } });
    if (!track) return res.status(404).json({ error: 'Not found' });
    if (!track.opportunityUrl) return res.status(400).json({ error: 'Track has no opportunityUrl' });
    if (!assertClientAccess(req, track.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    extractTrackFromUrl(id, track.opportunityUrl).catch(err => {
      console.error('[retryExtractTrackFromUrl] background failed:', err);
    });
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[retryExtractTrackFromUrl]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const {
    title, description, fundingVehicle, status, sortOrder,
    opportunityUrl, solicitationNumber, vehicleType,
    issuingAgency, fundingAuthority,
    questionsDueDate, proposalDueDate, periodOfPerformance,
    fundingFloor, fundingCeiling,
    eligibility, submissionFormat, objective,
    focusAreas, targetedFocusAreas, pointsOfContact, additionalSections,
  } = req.body;
  try {
    const existing = await prisma.workflowTrack.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    const data: any = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(fundingVehicle !== undefined && { fundingVehicle }),
      ...(status !== undefined && { status }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(opportunityUrl !== undefined && { opportunityUrl: opportunityUrl || null }),
      ...(solicitationNumber !== undefined && { solicitationNumber: solicitationNumber || null }),
      ...(vehicleType !== undefined && { vehicleType: vehicleType || null }),
      ...(issuingAgency !== undefined && { issuingAgency: issuingAgency || null }),
      ...(fundingAuthority !== undefined && { fundingAuthority: fundingAuthority || null }),
      ...(questionsDueDate !== undefined && { questionsDueDate: questionsDueDate ? new Date(questionsDueDate) : null }),
      ...(proposalDueDate !== undefined && { proposalDueDate: proposalDueDate ? new Date(proposalDueDate) : null }),
      ...(periodOfPerformance !== undefined && { periodOfPerformance: periodOfPerformance || null }),
      ...(fundingFloor !== undefined && { fundingFloor: fundingFloor || null }),
      ...(fundingCeiling !== undefined && { fundingCeiling: fundingCeiling || null }),
      ...(eligibility !== undefined && { eligibility: eligibility || null }),
      ...(submissionFormat !== undefined && { submissionFormat: submissionFormat || null }),
      ...(objective !== undefined && { objective: objective || null }),
    };
    if (Array.isArray(focusAreas)) data.focusAreas = JSON.stringify(focusAreas);
    if (Array.isArray(targetedFocusAreas)) data.targetedFocusAreas = JSON.stringify(targetedFocusAreas);
    if (Array.isArray(pointsOfContact)) data.pointsOfContact = JSON.stringify(pointsOfContact);
    if (Array.isArray(additionalSections)) data.additionalSections = JSON.stringify(additionalSections);

    const track = await prisma.workflowTrack.update({ where: { id }, data });

    // Keep mirror initiative in sync
    try {
      const initiativeId = await upsertMirrorInitiative({
        track,
        workflowClientId: existing.workflowClientId,
        actingUserId: req.user?.userId || null,
      });
      if (initiativeId !== track.initiativeId) {
        await prisma.workflowTrack.update({ where: { id }, data: { initiativeId } });
      }
    } catch (mirrorErr) {
      console.error('[updateTrack] initiative mirror failed:', mirrorErr);
    }

    return res.json(track);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteTrack(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.userId || null;
  try {
    const existing = await prisma.workflowTrack.findUnique({
      where: { id },
      include: { sow: true },
    });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    // Close the mirror initiative but keep the record in CRM for audit trail.
    if (existing.initiativeId) {
      try {
        await prisma.initiative.update({
          where: { id: existing.initiativeId },
          data: { status: 'Closed', ...(userId && { updatedByUserId: userId }) },
        });
      } catch (mirrorErr) {
        console.warn('[deleteTrack] mirror close failed (initiative may already be gone):', mirrorErr);
      }
    }

    // Soft-delete the attached SOW first, then the track.
    if (existing.sow) {
      await softDelete({
        modelName: 'workflowSOW',
        entityType: 'WorkflowSOW',
        id: existing.sow.id,
        userId,
        snapshot: existing.sow as unknown as Record<string, unknown>,
      });
    }
    await softDelete({
      modelName: 'workflowTrack',
      entityType: 'WorkflowTrack',
      id,
      userId,
      snapshot: existing as unknown as Record<string, unknown>,
    });

    return res.json({ message: 'Track moved to recycle bin' });
  } catch (err) {
    console.error('[deleteTrack]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Orphan Initiatives ─────────────────────────────────────────────────────
//
// CRM Initiatives whose `primaryEntityId` matches the WorkflowClient's
// `clientId` but which have no companion WorkflowTrack. The Dashboard renders
// these alongside tracks so initiatives created directly in the CRM are
// visible in the workflow tool, with a one-click "Promote to Track" path
// for admins.

export async function listOrphanInitiatives(req: AuthRequest, res: Response) {
  const { workflowClientId } = req.query;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId as string)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const client = await prisma.workflowClient.findUnique({
      where: { id: workflowClientId as string },
    });
    if (!client) return res.status(404).json({ error: 'Workflow client not found' });
    if (!client.clientId) return res.json([]);

    const linked = await prisma.workflowTrack.findMany({
      where: { initiativeId: { not: null } },
      select: { initiativeId: true },
    });
    const linkedIds = linked.map(t => t.initiativeId).filter((s): s is string => !!s);

    const initiatives = await prisma.initiative.findMany({
      where: {
        primaryEntityId: client.clientId,
        ...(linkedIds.length > 0 && { id: { notIn: linkedIds } }),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        targetDate: true,
        createdAt: true,
      },
    });
    return res.json(initiatives);
  } catch (err) {
    console.error('[listOrphanInitiatives]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function promoteInitiativeToTrack(req: AuthRequest, res: Response) {
  const { initiativeId } = req.params;
  const { workflowClientId } = req.body;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const [initiative, client, existingTrack] = await Promise.all([
      prisma.initiative.findUnique({ where: { id: initiativeId } }),
      prisma.workflowClient.findUnique({ where: { id: workflowClientId } }),
      prisma.workflowTrack.findFirst({ where: { initiativeId } }),
    ]);

    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });
    if (!client) return res.status(404).json({ error: 'Workflow client not found' });
    if (existingTrack) return res.status(409).json({ error: 'Initiative already linked to a track' });
    if (initiative.primaryEntityId !== client.clientId) {
      return res.status(400).json({ error: "Initiative's primary entity doesn't match this workflow client" });
    }

    const trackStatus =
      initiative.status === 'Closed' ? 'Completed'
      : initiative.status === 'OnHold' ? 'OnHold'
      : 'Active';

    const track = await prisma.workflowTrack.create({
      data: {
        workflowClientId,
        title: initiative.title,
        description: initiative.description || null,
        status: trackStatus,
        sortOrder: 0,
        initiativeId: initiative.id,
      },
    });
    return res.status(201).json(track);
  } catch (err) {
    console.error('[promoteInitiativeToTrack]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Phases ───────────────────────────────────────────────────────────────

export async function createPhase(req: AuthRequest, res: Response) {
  const { trackId, title, description, budget, timeframe, status, sortOrder } = req.body;
  if (!trackId || !title) return res.status(400).json({ error: 'trackId and title required' });
  try {
    const phase = await prisma.workflowPhase.create({
      data: {
        trackId,
        title,
        description: description || null,
        budget: budget || null,
        timeframe: timeframe || null,
        status: status || 'NotStarted',
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(phase);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updatePhase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, budget, timeframe, status, sortOrder } = req.body;
  try {
    const phase = await prisma.workflowPhase.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(budget !== undefined && { budget }),
        ...(timeframe !== undefined && { timeframe }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return res.json(phase);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deletePhase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.workflowPhase.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Milestones ───────────────────────────────────────────────────────────

/**
 * Resolve the workflowClientId that owns a phase or milestone (via the parent
 * track). Returns null if the row is missing.
 */
async function clientIdForPhase(phaseId: string): Promise<string | null> {
  const ph = await prisma.workflowPhase.findUnique({
    where: { id: phaseId },
    select: { track: { select: { workflowClientId: true } } },
  });
  return ph?.track?.workflowClientId ?? null;
}
async function clientIdForMilestone(milestoneId: string): Promise<string | null> {
  const m = await prisma.workflowMilestone.findUnique({
    where: { id: milestoneId },
    select: { phase: { select: { track: { select: { workflowClientId: true } } } } },
  });
  return m?.phase?.track?.workflowClientId ?? null;
}

export async function createMilestone(req: AuthRequest, res: Response) {
  const { phaseId, title, description, dueDate, status, sortOrder } = req.body;
  if (!phaseId || !title) return res.status(400).json({ error: 'phaseId and title required' });
  try {
    const cid = await clientIdForPhase(phaseId);
    if (!cid) return res.status(404).json({ error: 'Phase not found' });
    if (!assertClientAccess(req, cid)) return res.status(403).json({ error: 'Forbidden' });

    const milestone = await prisma.workflowMilestone.create({
      data: {
        phaseId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'NotStarted',
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(milestone);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateMilestone(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, description, dueDate, status, sortOrder } = req.body;
  try {
    const cid = await clientIdForMilestone(id);
    if (!cid) return res.status(404).json({ error: 'Step not found' });
    if (!assertClientAccess(req, cid)) return res.status(403).json({ error: 'Forbidden' });

    const milestone = await prisma.workflowMilestone.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined && {
          status,
          completedAt: status === 'Completed' ? new Date() : null,
        }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return res.json(milestone);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const cid = await clientIdForMilestone(id);
    if (!cid) return res.status(404).json({ error: 'Step not found' });
    if (!assertClientAccess(req, cid)) return res.status(403).json({ error: 'Forbidden' });

    await prisma.workflowMilestone.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Action items ─────────────────────────────────────────────────────────

export async function getActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const item = await prisma.workflowActionItem.findUnique({
      where: { id },
      include: {
        milestone: { include: { phase: { include: { track: true } } } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    const clientId = item.milestone.phase.track.workflowClientId;
    if (!assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function createActionItem(req: AuthRequest, res: Response) {
  const { milestoneId, title, notes, status, assignedTo, dueDate, sortOrder } = req.body;
  if (!milestoneId || !title) return res.status(400).json({ error: 'milestoneId and title required' });
  try {
    const item = await prisma.workflowActionItem.create({
      data: {
        milestoneId,
        title,
        notes: notes || null,
        status: status || 'Todo',
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: sortOrder ?? 0,
        createdByUserId: req.user!.userId,
        updatedByUserId: req.user!.userId,
      },
    });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { title, notes, status, assignedTo, dueDate, sortOrder } = req.body;
  try {
    const existing = await prisma.workflowActionItem.findUnique({
      where: { id },
      include: { milestone: { include: { phase: { include: { track: true } } } } },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const clientId = existing.milestone.phase.track.workflowClientId;
    if (!assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

    // WorkflowEditor can only update status/notes/assignedTo
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    const data: any = {
      updatedByUserId: req.user!.userId,
    };
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) {
      data.status = status;
      data.completedAt = status === 'Done' ? new Date() : null;
    }
    if (assignedTo !== undefined) data.assignedTo = assignedTo;
    if (isAdmin) {
      if (title !== undefined) data.title = title;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (sortOrder !== undefined) data.sortOrder = sortOrder;
    }

    const item = await prisma.workflowActionItem.update({
      where: { id },
      data,
    });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteActionItem(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.workflowActionItem.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });
    await softDelete({
      modelName: 'workflowActionItem',
      entityType: 'WorkflowActionItem',
      id,
      userId: req.user?.userId || null,
      snapshot: existing as unknown as Record<string, unknown>,
    });
    return res.json({ message: 'Action item moved to recycle bin' });
  } catch (err) {
    console.error('[deleteActionItem]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── SOWs ─────────────────────────────────────────────────────────────────

export async function listSOWs(req: AuthRequest, res: Response) {
  const { workflowClientId } = req.query;
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId as string)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const sows = await prisma.workflowSOW.findMany({
      where: { workflowClientId: workflowClientId as string },
      orderBy: { updatedAt: 'desc' },
      include: {
        track: { select: { id: true, title: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return res.json(sows);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const sow = await prisma.workflowSOW.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, title: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!sow) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, sow.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    return res.json(sow);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

const STRUCTURED_FIELDS = [
  'title',
  'targetFundingVehicle',
  'targetAgency',
  'periodOfPerformance',
  'budget',
  'differentiationLayer',
  'trlStatement',
  'scope',
  'keyPersonnel',
  'deliverables',      // JSON string
  'draftingChecklist', // JSON string
  'status',
] as const;

type StructuredField = typeof STRUCTURED_FIELDS[number];

function buildSnapshot(sow: any): string {
  const snap: Record<string, unknown> = {};
  for (const f of STRUCTURED_FIELDS) snap[f] = sow[f];
  return JSON.stringify(snap);
}

async function validateTrackForSOW(
  trackId: string,
  workflowClientId: string,
  sowIdToExclude?: string,
): Promise<string | null> {
  const track = await prisma.workflowTrack.findUnique({
    where: { id: trackId },
    include: { sow: { select: { id: true } } },
  });
  if (!track) return 'Track not found';
  if (track.workflowClientId !== workflowClientId) return 'Track belongs to a different client';
  if (track.sow && track.sow.id !== sowIdToExclude) {
    return 'This track already has a SOW — detach it first or pick another track';
  }
  return null;
}

export async function createSOW(req: AuthRequest, res: Response) {
  const { workflowClientId, title, trackId } = req.body;
  if (!workflowClientId || !title) return res.status(400).json({ error: 'workflowClientId and title required' });
  try {
    if (trackId) {
      const err = await validateTrackForSOW(trackId, workflowClientId);
      if (err) return res.status(400).json({ error: err });
    }
    const data: any = {
      workflowClientId,
      title,
      version: 1,
      status: 'Draft',
      createdByUserId: req.user!.userId,
      ...(trackId && { trackId }),
    };
    for (const f of STRUCTURED_FIELDS) {
      if (f === 'title' || f === 'status') continue;
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (req.body.status) data.status = req.body.status;
    const sow = await prisma.workflowSOW.create({
      data,
      include: { track: { select: { id: true, title: true } } },
    });
    return res.status(201).json(sow);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    // Optional track reassignment — supports {trackId: null} to detach.
    let trackChange: { trackId: string | null } | null = null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'trackId')) {
      const nextTrackId = req.body.trackId;
      if (nextTrackId === null || nextTrackId === '') {
        trackChange = { trackId: null };
      } else if (typeof nextTrackId === 'string' && nextTrackId !== existing.trackId) {
        const err = await validateTrackForSOW(nextTrackId, existing.workflowClientId, existing.id);
        if (err) return res.status(400).json({ error: err });
        trackChange = { trackId: nextTrackId };
      }
    }

    // Any change to a structured field bumps the version and snapshots the prior state.
    const changes: Partial<Record<StructuredField, unknown>> = {};
    let versionWorthy = false;
    for (const f of STRUCTURED_FIELDS) {
      if (req.body[f] === undefined) continue;
      if ((existing as any)[f] !== req.body[f]) {
        changes[f] = req.body[f];
        // Status changes alone shouldn't bump the version.
        if (f !== 'status') versionWorthy = true;
      }
    }

    let nextVersion = existing.version;
    if (versionWorthy) {
      nextVersion = existing.version + 1;
      await prisma.workflowSOWVersion.create({
        data: {
          sowId: existing.id,
          content: existing.scope || existing.content || '',
          snapshotJson: buildSnapshot(existing),
          version: existing.version,
          createdByUserId: req.user!.userId,
        },
      });
    }

    const sow = await prisma.workflowSOW.update({
      where: { id },
      data: {
        ...changes,
        ...(trackChange || {}),
        ...(versionWorthy && { version: nextVersion }),
      } as any,
      include: { track: { select: { id: true, title: true } } },
    });
    return res.json(sow);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Not found' });
    if (!assertClientAccess(req, existing.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });
    await softDelete({
      modelName: 'workflowSOW',
      entityType: 'WorkflowSOW',
      id,
      userId: req.user?.userId || null,
      snapshot: existing as unknown as Record<string, unknown>,
    });
    return res.json({ message: 'SOW moved to recycle bin' });
  } catch (err) {
    console.error('[deleteSOW]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────

export async function createComment(req: AuthRequest, res: Response) {
  const { actionItemId, sowId, content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  if (!actionItemId && !sowId) return res.status(400).json({ error: 'actionItemId or sowId required' });
  try {
    // Scope check via parent
    let clientId: string | null = null;
    if (actionItemId) {
      const item = await prisma.workflowActionItem.findUnique({
        where: { id: actionItemId },
        include: { milestone: { include: { phase: { include: { track: true } } } } },
      });
      if (!item) return res.status(404).json({ error: 'Action item not found' });
      clientId = item.milestone.phase.track.workflowClientId;
    } else if (sowId) {
      const sow = await prisma.workflowSOW.findUnique({ where: { id: sowId } });
      if (!sow) return res.status(404).json({ error: 'SOW not found' });
      clientId = sow.workflowClientId;
    }
    if (!clientId || !assertClientAccess(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

    const comment = await prisma.workflowComment.create({
      data: {
        actionItemId: actionItemId || null,
        sowId: sowId || null,
        content,
        createdByUserId: req.user!.userId,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.workflowComment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.user!.workflowRole === 'WorkflowAdmin';
    if (!isAdmin && existing.createdByUserId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.workflowComment.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── Workflow user management (admin) ─────────────────────────────────────

export async function listWorkflowUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      where: { workflowRole: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
        isActive: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// ─── AI: cross-SOW overlap warning ────────────────────────────────────────
//
// The analyst wants a heads-up if a new SOW proposes materially similar work
// to an existing SOW on a different funding path (e.g. same scope promised to
// AFRL via ARA and also to SBIR). Returns { overlaps: [{ sowId, sowTitle, trackTitle, reason }] }.
// Warn-only — the caller decides whether to save anyway.

export async function checkSOWOverlap(req: AuthRequest, res: Response) {
  const {
    workflowClientId,
    excludeSowId,
    title,
    scope,
    deliverables,
    targetAgency,
    targetFundingVehicle,
  } = req.body as {
    workflowClientId?: string;
    excludeSowId?: string;
    title?: string;
    scope?: string;
    deliverables?: unknown;
    targetAgency?: string;
    targetFundingVehicle?: string;
  };
  if (!workflowClientId) return res.status(400).json({ error: 'workflowClientId required' });
  if (!assertClientAccess(req, workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const others = await prisma.workflowSOW.findMany({
      where: {
        workflowClientId,
        ...(excludeSowId && { NOT: { id: excludeSowId } }),
      },
      select: {
        id: true,
        title: true,
        targetAgency: true,
        targetFundingVehicle: true,
        scope: true,
        deliverables: true,
        track: { select: { title: true } },
      },
    });

    // Nothing to compare against — no overlaps.
    if (others.length === 0) return res.json({ overlaps: [] });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const candidate = {
      title: title || '(untitled)',
      targetAgency: targetAgency || null,
      targetFundingVehicle: targetFundingVehicle || null,
      scope: (scope || '').slice(0, 3500),
      deliverables: safeJsonArray(typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables ?? [])),
    };

    const corpus = others.map((s) => ({
      id: s.id,
      title: s.title,
      trackTitle: s.track?.title || null,
      targetAgency: s.targetAgency,
      targetFundingVehicle: s.targetFundingVehicle,
      scope: (s.scope || '').slice(0, 2500),
      deliverables: safeJsonArray(s.deliverables),
    }));

    const systemPrompt = `You are a defense acquisition analyst. Flag when a newly drafted SOW proposes materially the same technical work as an EXISTING SOW on a *different funding path* (different targetAgency OR different targetFundingVehicle).

Only flag true overlaps: shared core deliverables, shared scope of work, or the same underlying capability being promised to two separate funders. Do NOT flag minor keyword matches, generic language, or SOWs already on the same funding path.

Return STRICT JSON, a single line, no prose or code fences:
{"overlaps":[{"sowId":"<id>","reason":"<1-2 sentence explanation of the overlap>"}]}

Return an empty array if there are no overlaps.`;

    const userPrompt = `NEW (candidate) SOW:\n${JSON.stringify(candidate, null, 2)}\n\nEXISTING SOWs in this client:\n${JSON.stringify(corpus, null, 2)}\n\nReturn the JSON now.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    const raw = textBlock?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[check-overlap] Unparseable:', raw);
      return res.json({ overlaps: [] });
    }
    let parsed: { overlaps?: Array<{ sowId: string; reason: string }> };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.json({ overlaps: [] });
    }

    const byId = new Map(others.map((s) => [s.id, s]));
    const hits = (parsed.overlaps || [])
      .filter((h) => h && typeof h.sowId === 'string' && byId.has(h.sowId))
      .map((h) => {
        const s = byId.get(h.sowId)!;
        return {
          sowId: s.id,
          sowTitle: s.title,
          trackTitle: s.track?.title || null,
          reason: h.reason || '',
        };
      });

    return res.json({ overlaps: hits });
  } catch (err: any) {
    console.error('[check-overlap]', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

// ─── AI: suggest track for a SOW ──────────────────────────────────────────

export async function suggestTrackForSOW(req: AuthRequest, res: Response) {
  const { id } = req.params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  try {
    const sow = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!sow) return res.status(404).json({ error: 'SOW not found' });
    if (!assertClientAccess(req, sow.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const tracks = await prisma.workflowTrack.findMany({
      where: { workflowClientId: sow.workflowClientId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        fundingVehicle: true,
      },
    });

    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks exist for this client' });
    }

    const trackList = tracks
      .map((t) =>
        `- id: ${t.id}\n  title: ${t.title}\n  fundingVehicle: ${t.fundingVehicle ?? '—'}\n  description: ${t.description ?? '—'}`
      )
      .join('\n\n');

    const systemPrompt = `You are a defense acquisition analyst at Signal Ridge Strategies. Your job is to assign a Statement of Work to the correct funding track based on the Layer 1-4 differentiation framework.

${LAYER_FRAMEWORK}

You will be shown a SOW (title + markdown content) and the list of available tracks for this client. Pick the single best-fit track and explain the reasoning in 2-3 sentences. Base the decision on which layer the SOW actually scopes — not on any incidental keywords. If the SOW is a placeholder or stub that explicitly names a layer, trust that signal.

Respond ONLY as minified JSON on a single line with exactly these keys: {"suggestedTrackId":"<id>","rationale":"<2-3 sentences>"}. No prose outside the JSON. No code fences.`;

    const userPrompt = `Available tracks for this client:\n\n${trackList}\n\n---\n\nSOW title: ${sow.title}\n\nSOW content:\n${sow.content || '(empty)'}\n\nReturn the JSON now.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    const raw = textBlock?.text?.trim() || '';

    // Be tolerant of code fences / minor formatting
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[suggest-track] Unparseable response:', raw);
      return res.status(502).json({ error: 'AI returned unparseable response' });
    }
    let parsed: { suggestedTrackId?: string; rationale?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    const suggested = tracks.find((t) => t.id === parsed.suggestedTrackId);
    if (!suggested) {
      return res.status(502).json({
        error: 'AI returned an unknown track id',
        raw: parsed,
      });
    }

    return res.json({
      suggestedTrackId: suggested.id,
      trackTitle: suggested.title,
      rationale: parsed.rationale || '',
    });
  } catch (err: any) {
    console.error('[suggest-track]', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

// ─── AI: integrate SOW with a target track ────────────────────────────────

export async function integrateSOWWithTrack(req: AuthRequest, res: Response) {
  const { id, trackId } = req.params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }
  try {
    const sow = await prisma.workflowSOW.findUnique({ where: { id } });
    if (!sow) return res.status(404).json({ error: 'SOW not found' });
    if (!assertClientAccess(req, sow.workflowClientId)) return res.status(403).json({ error: 'Forbidden' });

    const track = await prisma.workflowTrack.findUnique({
      where: { id: trackId },
      include: {
        phases: {
          orderBy: { sortOrder: 'asc' },
          include: {
            milestones: {
              orderBy: { sortOrder: 'asc' },
              include: { actionItems: { orderBy: { sortOrder: 'asc' }, select: { title: true, dueDate: true, status: true } } },
            },
          },
        },
      },
    });
    if (!track || track.workflowClientId !== sow.workflowClientId) {
      return res.status(400).json({ error: 'Track not found for this client' });
    }

    const sowBrief = JSON.stringify({
      title: sow.title,
      targetFundingVehicle: sow.targetFundingVehicle,
      targetAgency: sow.targetAgency,
      periodOfPerformance: sow.periodOfPerformance,
      budget: sow.budget,
      differentiationLayer: sow.differentiationLayer,
      trlStatement: sow.trlStatement,
      scope: (sow.scope || sow.content || '').slice(0, 4000),
      deliverables: safeJsonArray(sow.deliverables),
      draftingChecklist: safeJsonArray(sow.draftingChecklist).map((c: any) => ({ title: c.title, done: !!c.done })),
    }, null, 2);

    const trackBrief = JSON.stringify({
      title: track.title,
      description: track.description,
      fundingVehicle: track.fundingVehicle,
      phases: track.phases.map((ph) => ({
        title: ph.title,
        budget: ph.budget,
        timeframe: ph.timeframe,
        milestones: ph.milestones.map((m) => ({
          title: m.title,
          dueDate: m.dueDate,
          actionItems: m.actionItems.map((a) => a.title),
        })),
      })),
    }, null, 2);

    const systemPrompt = `You are a defense acquisition analyst at Signal Ridge Strategies. A SOW has just been assigned to a track. Produce a short reconciliation report so the analyst can see where the SOW fits cleanly and where there is friction.

${LAYER_FRAMEWORK}

Evaluate the fit on these dimensions:
- Funding vehicle alignment (does the SOW's target match the track's funding vehicle?)
- Period of performance alignment (does the SOW POP fit within the track's phase timeframes?)
- Budget alignment (does the SOW budget fit within the track's phase budget, if any?)
- Differentiation layer alignment (does the SOW's Layer match what the track funds?)
- TRL alignment (does the SOW's TRL target match the track's phase TRL expectation?)
- Any scope or deliverable gaps that should become action items on the track.

Output STRICT JSON on a single line, no prose, no code fences:
{"items":[{"kind":"ok"|"warn"|"suggest","text":"short sentence"}]}

"ok" = clean alignment. "warn" = something is off and needs attention. "suggest" = recommend adding an action item or adjusting a field. 3-6 items total. Be concrete — name specific phases, dollar amounts, or dates when relevant.`;

    const userPrompt = `SOW:\n${sowBrief}\n\nTRACK:\n${trackBrief}\n\nReturn the JSON now.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    const raw = textBlock?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[integrate-track] Unparseable:', raw);
      return res.status(502).json({ error: 'AI returned unparseable response' });
    }
    let parsed: { items?: Array<{ kind: string; text: string }> };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }
    return res.json({
      sowTitle: sow.title,
      trackTitle: track.title,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    });
  } catch (err: any) {
    console.error('[integrate-track]', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}

function safeJsonArray(s: string | null | undefined): any[] {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ─── Assignees for action item dropdown ───────────────────────────────────

/**
 * Returns the list of people an action item can be assigned to for a given
 * workflow client:
 *   - All CRM contacts linked to the workflow client's Entity (e.g. Shadowgrid
 *     staff in the CRM)
 *   - All active CRM users (so Signal Ridge staff — including Jon — can be
 *     assigned actions even though they are not Shadowgrid contacts)
 */
export async function listAssignees(req: AuthRequest, res: Response) {
  const { id } = req.params; // workflowClientId
  if (!assertClientAccess(req, id)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const client = await prisma.workflowClient.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: 'Not found' });

    const contacts = client.clientId
      ? await prisma.contact.findMany({
          where: { entityId: client.clientId },
          select: { id: true, firstName: true, lastName: true, email: true, title: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        })
      : [];

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const assignees = [
      ...contacts.map((c) => ({
        kind: 'contact' as const,
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email || null,
        subtitle: c.title || 'Contact',
      })),
      ...users.map((u) => ({
        kind: 'user' as const,
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        subtitle: `Signal Ridge · ${u.role}`,
      })),
    ];
    return res.json(assignees);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function setWorkflowRole(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { workflowRole, workflowClientId } = req.body;
  const allowed = [null, 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];
  if (workflowRole !== undefined && !allowed.includes(workflowRole)) {
    return res.status(400).json({ error: 'Invalid workflowRole' });
  }
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(workflowRole !== undefined && { workflowRole }),
        ...(workflowClientId !== undefined && { workflowClientId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        workflowRole: true,
        workflowClientId: true,
      },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
