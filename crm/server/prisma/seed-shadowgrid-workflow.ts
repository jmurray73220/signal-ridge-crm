/**
 * Seeds Shadowgrid's workflow roadmap.
 *
 * Idempotent: re-running upserts the WorkflowClient by name and recreates
 * its tracks from scratch. Does not touch CRM Entity data.
 *
 * Usage: npx ts-node prisma/seed-shadowgrid-workflow.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLIENT_NAME = 'Shadowgrid';

type ActionSeed = { title: string; notes?: string };
type MilestoneSeed = { title: string; description?: string; dueDate?: Date | null; actions: ActionSeed[] };
type PhaseSeed = {
  title: string;
  description?: string;
  budget?: string;
  timeframe?: string;
  milestones: MilestoneSeed[];
};
type TrackSeed = {
  title: string;
  description?: string;
  fundingVehicle?: string;
  phases: PhaseSeed[];
};

const TRACKS: TrackSeed[] = [
  {
    title: 'Genesis Resubmission',
    fundingVehicle: 'Genesis (Layer 2: Integrated Prototype)',
    description:
      'Integrated prototype bridging research core and operator tools. Three-phase structure preserves AFRL favorable rating while addressing gaps in proposal language.',
    phases: [
      {
        title: 'Phase 1 — Proof of Concept',
        budget: '$200-300K',
        timeframe: '6 months',
        description:
          'Proof of concept demonstration on proprietary attribution pipeline. Establish entity resolution metrics and feasibility signal for transition review.',
        milestones: [
          {
            title: 'POC demonstration',
            description: 'Demonstrate passive multi-source telemetry fusion on representative dataset.',
            actions: [
              { title: 'Define POC demonstration scope and success criteria' },
              { title: 'Select representative dataset for attribution demonstration' },
              { title: 'Instrument entity resolution metrics (precision/recall, accuracy)' },
              { title: 'Record baseline performance for transition review' },
            ],
          },
        ],
      },
      {
        title: 'Phase 2 — Operational Prototype',
        budget: '$3-4M',
        timeframe: '18 months',
        description:
          'Operational prototype with geospatial interface and operator evaluation cycle.',
        milestones: [
          {
            title: 'Geospatial interface build',
            actions: [
              { title: 'Design operator-facing geospatial attribution UI' },
              { title: 'Integrate attribution pipeline with interface' },
            ],
          },
          {
            title: 'Operator evaluation cycle',
            actions: [
              { title: 'Recruit operator cohort for evaluation (AFCYBER / CYBERCOM preferred)' },
              { title: 'Run structured operator evaluation and capture feedback' },
            ],
          },
        ],
      },
      {
        title: 'Phase 3 — Transition-Ready Hardening',
        budget: '$4-5M',
        timeframe: '18 months',
        description:
          'Harden operational prototype, assemble ATO package, prepare transition plan.',
        milestones: [
          {
            title: 'ATO package',
            actions: [
              { title: 'Complete security architecture documentation' },
              { title: 'Assemble ATO package (System Security Plan, controls, POA&M)' },
            ],
          },
          {
            title: 'Transition plan',
            actions: [
              { title: 'Identify transition sponsor (CYBERCOM / AFCYBER)' },
              { title: 'Draft transition plan with funding line and operator owner' },
            ],
          },
        ],
      },
      {
        title: 'Proposal Language Fixes',
        description: 'Critical edits identified from AFRL review before resubmission.',
        milestones: [
          {
            title: 'Resubmission prep',
            actions: [
              { title: 'Call Thomas Parisi and Amber Buckley to validate Genesis floor and phased structure' },
              { title: 'Resubmit within 60 days of prior decision window' },
              { title: 'Add TRL statement (current TRL and target TRL by phase)' },
              { title: 'Add key personnel section with resumes and role allocation' },
              { title: 'Fix "proprietary signals collection" language per AFRL feedback' },
              { title: 'Fix "disruption pathways" language per AFRL feedback' },
              { title: 'Add security architecture section (cleared ceiling, facility plan)' },
              { title: 'Add transition plan section (sponsor, timeline, funding line)' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'SBIR Phase I',
    fundingVehicle: 'SBIR (Layer 1: AI/ML Research Core)',
    description:
      'Adversary infrastructure attribution using passive multi-source telemetry fusion and agentic AI entity resolution. Priority topics: AFRL/RI first, DARPA I2O second, NSA/CYBERCOM-sponsored third.',
    phases: [
      {
        title: 'Topic Selection & Submission',
        timeframe: 'Days 1-120',
        description:
          'Identify next available solicitation cycle, select best topic match, differentiate scope from Genesis.',
        milestones: [
          {
            title: 'Topic research',
            actions: [
              { title: 'Identify next available SBIR solicitation cycle (DoD.gov)' },
              { title: 'Rank candidate topics: AFRL/RI Information Directorate first' },
              { title: 'Rank candidate topics: DARPA I2O second' },
              { title: 'Rank candidate topics: NSA/CYBERCOM-sponsored topics third' },
              { title: 'Confirm selected topic does not overlap Genesis scope' },
            ],
          },
          {
            title: 'Proposal package',
            actions: [
              { title: 'Differentiate SBIR scope explicitly from Genesis in narrative' },
              { title: 'Target $150-300K ask with six-month feasibility deliverable' },
              { title: 'Draft Phase I proposal' },
              { title: 'Submit by solicitation close' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'DIU Commercial Solutions Opening',
    fundingVehicle: 'DIU CSO (Layer 4: Commercial Platform)',
    description:
      'Commercial platform adaptation for DoD use. Geospatial interface, commercial data integrations, government-hardened instance.',
    phases: [
      {
        title: 'Preparation & Submission',
        timeframe: '90-120 days',
        milestones: [
          {
            title: 'CSO prep',
            actions: [
              { title: 'Begin CSO preparation (white paper, solution pitch)' },
              { title: 'Target submission in 90-120 days' },
              { title: 'Secure CYBERCOM letter of interest before submission' },
              { title: 'Lead with AFRL favorable rating in narrative' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'AFWERX',
    fundingVehicle: 'AFWERX (Layer 3: Operator-Facing Tools)',
    description:
      'Hunt Chat, Response Packaging automation, and mission planning workflow for AFCYBER operators.',
    phases: [
      {
        title: 'Portal Application',
        timeframe: 'Within 90 days',
        milestones: [
          {
            title: 'Application build',
            actions: [
              { title: 'Begin AFWERX portal application' },
              { title: 'Target submission within 90 days' },
              { title: 'Emphasize operator workflow and Execution Gap reduction' },
              { title: 'Reference AFRL favorable rating for credibility' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'CYBERCOM / AFCYBER Relationship Development',
    fundingVehicle: 'Relationship / Credibility',
    description:
      'Not a funding vehicle. Relationship and credibility building with end users and potential transition sponsors.',
    phases: [
      {
        title: 'Engagement Plan',
        milestones: [
          {
            title: 'Outreach',
            actions: [
              { title: 'Request introductory capabilities briefing with CYBERCOM J39' },
              { title: 'Request introductory capabilities briefing with AFCYBER' },
              { title: 'Prepare deterrence-framed pitch (not platform pitch)' },
              { title: 'Secure letter of interest for DIU submission' },
              { title: 'Explore CYBERCOM-sponsored SBIR topic visibility' },
            ],
          },
        ],
      },
    ],
  },
];

// Master timeline mapped as a synthetic "Execution Timeline" track
const TIMELINE: TrackSeed = {
  title: 'Master Execution Timeline',
  fundingVehicle: 'Cross-Track Timeline',
  description:
    'Phased 180-day execution plan spanning all four funding vehicles plus relationship development.',
  phases: [
    {
      title: 'Days 1-30',
      timeframe: 'Month 1',
      milestones: [
        {
          title: 'Kickoff actions',
          actions: [
            { title: 'Parisi/Buckley call' },
            { title: 'Begin Genesis resubmission drafting' },
            { title: 'Identify SBIR cycle' },
            { title: 'Begin CYBERCOM outreach' },
          ],
        },
      ],
    },
    {
      title: 'Days 30-60',
      timeframe: 'Month 2',
      milestones: [
        {
          title: 'Mid-phase actions',
          actions: [
            { title: 'Genesis resubmission submitted' },
            { title: 'AFWERX initiated' },
            { title: 'SBIR topic finalized' },
          ],
        },
      ],
    },
    {
      title: 'Days 60-90',
      timeframe: 'Month 3',
      milestones: [
        {
          title: 'Expansion actions',
          actions: [
            { title: 'DIU CSO preparation' },
            { title: 'First CYBERCOM meeting' },
            { title: 'AFWERX submission' },
          ],
        },
      ],
    },
    {
      title: 'Days 90-120',
      timeframe: 'Month 4',
      milestones: [
        {
          title: 'Submission actions',
          actions: [
            { title: 'SBIR submission' },
            { title: 'DIU submission with CYBERCOM letter attached' },
          ],
        },
      ],
    },
    {
      title: 'Days 120-180',
      timeframe: 'Months 5-6',
      milestones: [
        {
          title: 'Evaluation window',
          actions: [
            { title: 'Genesis Phase 1 award decision' },
            { title: 'SBIR evaluation' },
            { title: 'DIU evaluation' },
          ],
        },
      ],
    },
  ],
};

const SOW_STUBS: Array<{ trackTitle: string; title: string; content: string }> = [
  {
    trackTitle: 'Genesis Resubmission',
    title: 'SOW — Genesis (Layer 2: Integrated Prototype)',
    content:
      '# SOW — Genesis (Layer 2: Integrated Prototype)\n\n' +
      '**Differentiation framework:** Layer 2 — Integrated Prototype.\n\n' +
      'This SOW covers the operational prototype bridging the Layer 1 research core and Layer 3 operator tooling. ' +
      'It is distinct from SBIR (Layer 1 feasibility) and from AFWERX (Layer 3 operator workflow). ' +
      'Fill in scope, deliverables, pricing, and assumptions below.\n\n' +
      '## Scope\n\nTBD\n\n## Deliverables\n\nTBD\n\n## Price & Schedule\n\nTBD\n',
  },
  {
    trackTitle: 'SBIR Phase I',
    title: 'SOW — SBIR Phase I (Layer 1: AI/ML Research Core)',
    content:
      '# SOW — SBIR Phase I (Layer 1: AI/ML Research Core)\n\n' +
      '**Differentiation framework:** Layer 1 — AI/ML Research Core.\n\n' +
      'Six-month feasibility study on passive multi-source telemetry fusion and agentic entity resolution. ' +
      'Distinct from Genesis Layer 2 (integrated prototype) and from platform-level work.\n\n' +
      '## Scope\n\nTBD\n\n## Deliverables\n\nTBD\n\n## Price & Schedule\n\n$150-300K, 6 months.\n',
  },
  {
    trackTitle: 'DIU Commercial Solutions Opening',
    title: 'SOW — DIU CSO (Layer 4: Commercial Platform)',
    content:
      '# SOW — DIU CSO (Layer 4: Commercial Platform)\n\n' +
      '**Differentiation framework:** Layer 4 — Commercial Platform.\n\n' +
      'Commercial platform adaptation for DoD use. Geospatial interface, commercial data integrations, ' +
      'government-hardened instance. Distinct from the research core and from point operator tools.\n\n' +
      '## Scope\n\nTBD\n\n## Deliverables\n\nTBD\n\n## Price & Schedule\n\nTBD\n',
  },
  {
    trackTitle: 'AFWERX',
    title: 'SOW — AFWERX (Layer 3: Operator-Facing Tools)',
    content:
      '# SOW — AFWERX (Layer 3: Operator-Facing Tools)\n\n' +
      '**Differentiation framework:** Layer 3 — Operator-Facing Tools.\n\n' +
      'Hunt Chat, Response Packaging automation, and mission planning workflow for AFCYBER operators. ' +
      'Distinct from the research core and from the integrated prototype.\n\n' +
      '## Scope\n\nTBD\n\n## Deliverables\n\nTBD\n\n## Price & Schedule\n\nTBD\n',
  },
  {
    trackTitle: 'CYBERCOM / AFCYBER Relationship Development',
    title: 'SOW — Relationship Development (Cross-Layer)',
    content:
      '# SOW — Relationship Development\n\n' +
      'Not a funding vehicle. This document captures engagement milestones, ' +
      'letters of interest, and transition-sponsor conversations across all four differentiation layers.\n\n' +
      '## Objectives\n\nTBD\n\n## Engagement plan\n\nTBD\n',
  },
];

async function seed() {
  // Find Shadowgrid in CRM Entity table (soft link via clientId)
  const entity = await prisma.entity.findFirst({
    where: { name: { contains: 'Shadowgrid', mode: 'insensitive' } },
  });
  if (!entity) {
    console.warn('[seed] CRM Entity "Shadowgrid" not found. WorkflowClient will be created without clientId link.');
  } else {
    console.log(`[seed] Found CRM Entity "${entity.name}" id=${entity.id}`);
  }

  // Upsert WorkflowClient by name (idempotent)
  let client = await prisma.workflowClient.findFirst({ where: { name: CLIENT_NAME } });
  if (client) {
    console.log(`[seed] Resetting existing WorkflowClient "${CLIENT_NAME}" (${client.id})`);
    // Cascade deletes tracks, phases, milestones, action items via schema
    await prisma.workflowTrack.deleteMany({ where: { workflowClientId: client.id } });
    await prisma.workflowSOW.deleteMany({ where: { workflowClientId: client.id } });
    client = await prisma.workflowClient.update({
      where: { id: client.id },
      data: { clientId: entity?.id ?? null },
    });
  } else {
    client = await prisma.workflowClient.create({
      data: { name: CLIENT_NAME, clientId: entity?.id ?? null },
    });
    console.log(`[seed] Created WorkflowClient "${CLIENT_NAME}" (${client.id})`);
  }

  const allTracks = [...TRACKS, TIMELINE];

  for (let ti = 0; ti < allTracks.length; ti++) {
    const t = allTracks[ti];
    const track = await prisma.workflowTrack.create({
      data: {
        workflowClientId: client.id,
        title: t.title,
        description: t.description ?? null,
        fundingVehicle: t.fundingVehicle ?? null,
        status: 'Active',
        sortOrder: ti,
      },
    });
    console.log(`[seed]  Track: ${t.title}`);

    for (let pi = 0; pi < t.phases.length; pi++) {
      const p = t.phases[pi];
      const phase = await prisma.workflowPhase.create({
        data: {
          trackId: track.id,
          title: p.title,
          description: p.description ?? null,
          budget: p.budget ?? null,
          timeframe: p.timeframe ?? null,
          status: 'NotStarted',
          sortOrder: pi,
        },
      });

      for (let mi = 0; mi < p.milestones.length; mi++) {
        const m = p.milestones[mi];
        const milestone = await prisma.workflowMilestone.create({
          data: {
            phaseId: phase.id,
            title: m.title,
            description: m.description ?? null,
            dueDate: m.dueDate ?? null,
            status: 'NotStarted',
            sortOrder: mi,
          },
        });

        for (let ai = 0; ai < m.actions.length; ai++) {
          const a = m.actions[ai];
          await prisma.workflowActionItem.create({
            data: {
              milestoneId: milestone.id,
              title: a.title,
              notes: a.notes ?? null,
              status: 'Todo',
              sortOrder: ai,
            },
          });
        }
      }
    }
  }

  // SOW stubs — one per original funding track (not the synthetic timeline)
  const tracksByTitle = await prisma.workflowTrack.findMany({
    where: { workflowClientId: client.id },
  });
  for (const stub of SOW_STUBS) {
    const tr = tracksByTitle.find((x) => x.title === stub.trackTitle);
    await prisma.workflowSOW.create({
      data: {
        workflowClientId: client.id,
        trackId: tr?.id ?? null,
        title: stub.title,
        content: stub.content,
        version: 1,
        status: 'Draft',
      },
    });
    console.log(`[seed]  SOW: ${stub.title}`);
  }

  console.log('\n[seed] Shadowgrid workflow seed complete.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
