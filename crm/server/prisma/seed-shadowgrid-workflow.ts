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

type ActionSeed = { title: string; description?: string; notes?: string };
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
      'Integrated prototype bridging the research core (Layer 1) and operator tools (Layer 3). Three-phase structure preserves the AFRL/RIGA "favorable" rating while addressing the funding and language gaps that blocked the first submission. Hard deadline: September 30, 2026.',
    phases: [
      {
        title: 'Phase 1 — Proof of Concept',
        budget: '$200-300K',
        timeframe: '6 months',
        description:
          'Proof of concept on proprietary attribution pipeline. Phase 1 is deliberately sized at SBIR Phase I scale so the program office can actually find the money — the original unphased $20M ask was the single biggest reason Genesis went unfunded despite the favorable technical rating.',
        milestones: [
          {
            title: 'POC demonstration',
            description: 'Demonstrate passive multi-source telemetry fusion on a representative dataset to establish a baseline for transition review.',
            actions: [
              {
                title: 'Define POC demonstration scope and success criteria',
                description:
                  'Scope must be narrow enough to finish in six months at $200-300K but rich enough to show the multi-spectrum correlation engine working end-to-end. Write the success criteria in language an AFRL program manager can defend to a review panel: specific entity-resolution targets, specific datasets, specific "would have saved N analyst hours" claims.',
              },
              {
                title: 'Select representative dataset for attribution demonstration',
                description:
                  'Pick a dataset that exercises passive multi-source telemetry fusion without triggering the "proprietary signals collection" red flag that reviewers already flagged. Commercial threat intel feeds plus open-source telemetry is a safer narrative than anything that could be read as active collection inside denied territory.',
              },
              {
                title: 'Instrument entity resolution metrics (precision/recall, accuracy)',
                description:
                  'Hard numbers are the difference between a Phase 1 that unlocks Phase 2 funding and a Phase 1 that stalls in review. Instrument the pipeline to report precision, recall, and accuracy on known-answer test cases, and capture the 98% automation delta — the platform doing in minutes what analyst teams do in days — as a headline number the program office can cite.',
              },
              {
                title: 'Record baseline performance for transition review',
                description:
                  'The transition review at the end of Phase 1 is where CYBERCOM/AFCYBER decide whether Phase 2 is worth $3-4M. A recorded baseline — runtime, accuracy, operator-hours-saved — is the artifact that review runs on. Without it the review becomes a subjective pitch.',
              },
            ],
          },
        ],
      },
      {
        title: 'Phase 2 — Operational Prototype',
        budget: '$3-4M',
        timeframe: '18 months',
        description:
          'Operational prototype with geospatial interface and a structured operator evaluation cycle. This is the layer where CAITIP transitions from research artifact to something AFCYBER operators will actually touch.',
        milestones: [
          {
            title: 'Geospatial interface build',
            description: 'Build the operator-facing geospatial attribution UI and wire it to the Phase 1 attribution pipeline.',
            actions: [
              {
                title: 'Design operator-facing geospatial attribution UI',
                description:
                  'The interface is what separates CAITIP from an academic research tool. Design for a tier-2 CYBERCOM analyst workflow, not for a data scientist — the goal is for an operator to see attribution confidence at a glance and drill down into the evidence chain without a training course.',
              },
              {
                title: 'Integrate attribution pipeline with interface',
                description:
                  'The Layer 1 research core (SBIR) and the Layer 3 operator UI (AFWERX) must come together inside the Layer 2 prototype. Integration work in this milestone is what proves the layered funding strategy actually composes into a single platform.',
              },
            ],
          },
          {
            title: 'Operator evaluation cycle',
            description: 'Structured evaluation with a cohort of AFCYBER or CYBERCOM operators to surface workflow gaps before hardening begins in Phase 3.',
            actions: [
              {
                title: 'Recruit operator cohort for evaluation (AFCYBER / CYBERCOM preferred)',
                description:
                  'Operator engagement here feeds directly into the CYBERCOM/AFCYBER relationship-building track and de-risks transition. Even a small cohort (3-5 operators) creates the advocates inside the customer that later justify a Phase 3 ATO investment.',
              },
              {
                title: 'Run structured operator evaluation and capture feedback',
                description:
                  'The evaluation must produce written artifacts — evaluator notes, quantitative task-completion metrics, quotable operator feedback — that can be referenced in Phase 3 justification, in DIU CSO submission, and in future AFWERX proposals.',
              },
            ],
          },
        ],
      },
      {
        title: 'Phase 3 — Transition-Ready Hardening',
        budget: '$4-5M',
        timeframe: '18 months',
        description:
          'Harden the operational prototype, assemble the ATO package, and finalize the transition plan. Phase 3 is where the platform stops being a prototype and becomes something an operational organization can accept ownership of.',
        milestones: [
          {
            title: 'ATO package',
            description: 'Assemble the documentation the transition customer needs to accept and operate the system under their own authority.',
            actions: [
              {
                title: 'Complete security architecture documentation',
                description:
                  'Missing security architecture detail was one of the gaps flagged in the Genesis white paper review. By Phase 3 this becomes a gating artifact for ATO, so capturing the architecture in writing and keeping it current through Phase 2 is cheaper than a scramble at the end of Phase 3.',
              },
              {
                title: 'Assemble ATO package (System Security Plan, controls, POA&M)',
                description:
                  'The ATO package is what transforms CAITIP from "a prototype we built" into "a system the customer can run." Start the SSP and controls mapping early in Phase 3; POA&M items identified here are the ones that get addressed with Phase 3 budget rather than becoming blockers after award.',
              },
            ],
          },
          {
            title: 'Transition plan',
            description: 'Name the sponsor, the funding line, and the operator owner so that at Phase 3 close-out the platform has a home.',
            actions: [
              {
                title: 'Identify transition sponsor (CYBERCOM / AFCYBER)',
                description:
                  'A named transition sponsor is what separates a successful Phase 3 from one that dies on the vine. The relationship-building track exists specifically to surface this sponsor before Phase 2 closes so Phase 3 can be written around a real customer, not a hypothetical one.',
              },
              {
                title: 'Draft transition plan with funding line and operator owner',
                description:
                  'The transition plan must name a funding line (POM, OCO, or direct customer funds) and an operator owner by role. Ambiguity here is the #1 reason prototypes with favorable ratings still fail to transition.',
              },
            ],
          },
        ],
      },
      {
        title: 'Proposal Language Fixes',
        description:
          'Critical edits identified from the AFRL/RIGA review. The original white paper earned a "favorable" rating on technical merit — this milestone is about fixing the language gaps that, combined with the unphased $20M ask, blocked funding.',
        milestones: [
          {
            title: 'Resubmission prep',
            description: 'Edit the white paper before resubmitting. Each fix maps to a specific reviewer concern or missing section.',
            actions: [
              {
                title: 'Call Thomas Parisi and Amber Buckley to validate Genesis floor and phased structure',
                description:
                  'Parisi and Buckley are the ARA contacts at AFRL/RIGA who already know Shadowgrid. A pre-submission call confirms whether Genesis has a practical floor on award size and whether a phased $200-300K / $3-4M / $4-5M structure is supported — both are open questions that a 10-minute call resolves faster than a resubmission cycle.',
              },
              {
                title: 'Resubmit within 60 days of prior decision window',
                description:
                  'The AFRL/RIGA "favorable" rating is a written technical endorsement that ages. Resubmitting while the reviewers still remember the submission keeps the institutional memory warm and increases the odds that the same evaluators see the phased rework.',
              },
              {
                title: 'Add TRL statement (current TRL and target TRL by phase)',
                description:
                  'The original white paper has no TRL statement and AFRL reviewers will ask immediately. An honest claim of TRL 3-4 entering Phase 1 and TRL 6-7 by end of Phase 3 is both defensible and fundable — pretending to be higher than that invites technical challenge with no upside.',
              },
              {
                title: 'Add key personnel section with resumes and role allocation',
                description:
                  'A missing key personnel section signals to reviewers that the proposer has not thought through execution. Name PI, co-PI, technical leads for each layer, and allocate percent-time against each phase so the program office can see who is actually doing the work.',
              },
              {
                title: 'Fix "proprietary signals collection" language per AFRL feedback',
                description:
                  'This phrase will get flagged because reviewers will want to know whether it implies active collection inside denied territory — which raises Title 50 and CFAA concerns AFRL has no appetite to adjudicate. Clarify that collection is from commercial and open-source sources, or remove the phrase entirely.',
              },
              {
                title: 'Fix "disruption pathways" language per AFRL feedback',
                description:
                  'The word "disruption" reads as offensive/operational activity, which pushes the proposal outside AFRL/RIGA\'s charter. Replace with "access pathway identification" and add an explicit note that the platform produces analysis, not exploits or payloads — this maps directly to the readiness-not-capability framing.',
              },
              {
                title: 'Add security architecture section (cleared ceiling, facility plan)',
                description:
                  'Reviewers need to see the cleared ceiling of the team, the facility plan, and how classified data handling would work if required. Missing this section was one of the gaps noted — including it removes an easy reason to defer funding.',
              },
              {
                title: 'Add transition plan section (sponsor, timeline, funding line)',
                description:
                  'A Genesis proposal without a transition plan is an R&D pitch, not a program. Even a placeholder naming CYBERCOM J39 as a prospective sponsor, with a timeline and candidate funding line, changes how the program office reads the whole document.',
              },
              {
                title: 'Add readiness-not-capability framing explicitly',
                description:
                  'CAITIP produces analysis, not action — no exploit code, no payloads, all execution requires legal authorization and operator decision authority. Stating this explicitly in the white paper preempts the most common reviewer objection and gives cover for the "access pathway identification" language elsewhere in the document.',
              },
              {
                title: 'Add 98% automation claim with supporting math',
                description:
                  'The platform automates work that would otherwise require a full-time analyst team. That is the single most striking differentiator Shadowgrid has and it does not appear in the current white paper. Put it in, with the analyst-hours-saved math behind it, because reviewers remember specific numbers.',
              },
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
      'Feasibility-scale funding for the AI/ML research core — entity resolution methodology and the multi-spectrum correlation engine. AFRL/RI is ranked first because the existing Genesis relationship means Shadowgrid is already a known quantity there; DARPA I2O is ranked second because it funds novel AI methodology and a DARPA win carries enormous credibility across every other track.',
    phases: [
      {
        title: 'Topic Selection & Submission',
        timeframe: 'Days 1-120',
        description:
          'Pick the right topic on the right cycle, write a proposal that is visibly distinct from Genesis, and submit.',
        milestones: [
          {
            title: 'Topic research',
            description: 'Rank candidate topics and confirm the selected one does not overlap Genesis scope.',
            actions: [
              {
                title: 'Identify next available SBIR solicitation cycle (DoD.gov)',
                description:
                  'Cycle timing drives everything else on this track. Pull the active and upcoming cycles from DoD.gov and sodium.sbir.gov and map them against the 60-day Genesis resubmission window so the two proposals do not step on each other.',
              },
              {
                title: 'Rank candidate topics: AFRL/RI Information Directorate first',
                description:
                  'AFRL/RI is the top priority because Shadowgrid already has a "favorable" white paper rating inside AFRL/RIGA. A Phase I win inside AFRL builds on existing relationships and signals to AFRL/RIGA that the research core is being independently validated while Genesis waits for funding.',
              },
              {
                title: 'Rank candidate topics: DARPA I2O second',
                description:
                  'DARPA I2O is ranked second because it funds novel AI methodology and a DARPA win carries enormous credibility across every other track — every subsequent proposal gets easier with "DARPA-funded" in the capability statement. The bar is higher and the Shadowgrid relationship is not yet warm, so rank second, not first.',
              },
              {
                title: 'Rank candidate topics: NSA/CYBERCOM-sponsored topics third',
                description:
                  'NSA/CYBERCOM-sponsored SBIR topics are ranked third because the relationship is still being built through the CYBERCOM/AFCYBER track, but they rate highly once the introductory briefings happen. A topic here would directly seed the transition customer relationship — check back after the J39 and AFCYBER meetings.',
              },
              {
                title: 'Confirm selected topic does not overlap Genesis scope',
                description:
                  'Any visible scope overlap with Genesis will get flagged as double-dipping by a reviewer comparing the two packages. The layered funding strategy only works if reviewers can see, on the page, that SBIR funds methodology (Layer 1) and Genesis funds the integrated prototype (Layer 2).',
              },
            ],
          },
          {
            title: 'Proposal package',
            description: 'Write and submit the Phase I proposal.',
            actions: [
              {
                title: 'Differentiate SBIR scope explicitly from Genesis in narrative',
                description:
                  'Use the Layer 1 / Layer 2 distinction in the narrative itself — SBIR funds the research core (methodology, correlation engine), Genesis funds the integrated prototype that consumes the SBIR outputs. Making this distinction visible on the page is what keeps both proposals alive through review.',
              },
              {
                title: 'Target $150-300K ask with six-month feasibility deliverable',
                description:
                  'Standard SBIR Phase I sizing. The six-month feasibility deliverable is timed to produce a usable research artifact ahead of the Genesis Phase 1 transition review, so each track strengthens the other.',
              },
              {
                title: 'Draft Phase I proposal',
                description:
                  'Draft with the same language discipline as the Genesis rewrite: no "proprietary signals collection," no "disruption pathways," explicit readiness-not-capability framing. Consistent language across proposals protects both.',
              },
              {
                title: 'Submit by solicitation close',
                description:
                  'Submission timing matters — submit early enough to absorb a portal failure without missing the window. SBIR portals have a history of overload in the final 24 hours before close.',
              },
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
      'Commercial platform adaptation for DoD use — geospatial interface, commercial data integrations, government-hardened instance deployed as SaaS. DIU requires a DoD transition partner, so this track is gated on progress in the CYBERCOM/AFCYBER relationship-building track.',
    phases: [
      {
        title: 'Preparation & Submission',
        timeframe: '90-120 days',
        description: 'Pre-submission preparation including the CYBERCOM letter of interest, then submit.',
        milestones: [
          {
            title: 'CSO prep',
            description: 'Build out the white paper and solution pitch, and secure the transition-partner letter that makes the submission credible.',
            actions: [
              {
                title: 'Begin CSO preparation (white paper, solution pitch)',
                description:
                  'DIU CSO submissions are lightweight by design but assume a commercial product ready to adapt. Start the white paper and solution pitch early so the artifacts are ready when the CYBERCOM letter lands, rather than rushing everything after the relationship move.',
              },
              {
                title: 'Target submission in 90-120 days',
                description:
                  'This window is long enough to secure a CYBERCOM letter of interest through the relationship track, and short enough to capture evaluator attention while the AFRL rating and Genesis resubmission are fresh.',
              },
              {
                title: 'Secure CYBERCOM letter of interest before submission',
                description:
                  'DIU requires a DoD transition partner and a letter of interest from CYBERCOM J39 or AFCYBER transforms the DIU submission from hypothetical to concrete. This is the single highest-leverage artifact on the DIU track — without it, the submission competes on commercial merit alone.',
              },
              {
                title: 'Lead with AFRL favorable rating in narrative',
                description:
                  'The AFRL/RIGA favorable rating on the Genesis white paper is a written government validation of technical merit that costs nothing to cite and raises the floor on how DIU evaluators read every other claim. Open the narrative with it.',
              },
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
      'Operator-facing tools layer — Hunt Chat, Response Packaging automation, and mission planning workflow for AFCYBER operators. AFWERX is where the operator workflow and Execution Gap narrative pay off fastest.',
    phases: [
      {
        title: 'Portal Application',
        timeframe: 'Within 90 days',
        description: 'Get the application in the portal, emphasize operator workflow, reference AFRL credibility.',
        milestones: [
          {
            title: 'Application build',
            description: 'Build the AFWERX application around the operator workflow value proposition.',
            actions: [
              {
                title: 'Begin AFWERX portal application',
                description:
                  'AFWERX portal applications are a known format with tight page limits — drafting early leaves room for the AFCYBER operator voice to be incorporated once the Genesis Phase 2 operator evaluation starts producing quotes.',
              },
              {
                title: 'Target submission within 90 days',
                description:
                  'The 90-day target is deliberate: it aligns AFWERX submission with the DIU submission window and the first CYBERCOM/AFCYBER briefings, so each track reinforces the others at the submission moment.',
              },
              {
                title: 'Emphasize operator workflow and Execution Gap reduction',
                description:
                  'The Execution Gap — the time between knowing something and being able to act on it — is the narrative that resonates with AFCYBER operators and AFWERX evaluators alike. Hunt Chat, Response Packaging, and mission planning all map onto closing this gap and should be framed that way.',
              },
              {
                title: 'Reference AFRL favorable rating for credibility',
                description:
                  'AFWERX evaluators give weight to prior AFRL engagement. Cite the AFRL/RIGA favorable rating in the AFWERX submission — it transfers credibility across tracks at zero cost.',
              },
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
      'Not a funding vehicle. CYBERCOM/AFCYBER is the transition customer — where the platform goes, not where the money comes from. Everything on this track is about building the relationship and credibility that unlocks letters of interest, transition sponsorship, and long-term operator advocacy.',
    phases: [
      {
        title: 'Engagement Plan',
        description: 'Structured engagement with CYBERCOM J39 and AFCYBER leadership pitched in their language, not R&D language.',
        milestones: [
          {
            title: 'Outreach',
            description: 'Introductory briefings, pitch materials, and the letter of interest that gates DIU submission.',
            actions: [
              {
                title: 'Request introductory capabilities briefing with CYBERCOM J39',
                description:
                  'J39 is the strategic plans shop and they think in deterrence terms, not R&D terms. An introductory briefing opens the door for the deterrence-framed pitch and surfaces whether they are willing to write a letter of interest for DIU.',
              },
              {
                title: 'Request introductory capabilities briefing with AFCYBER',
                description:
                  'AFCYBER is the operator community most likely to become the transition owner for a Genesis Phase 3 sponsor role. A briefing here seeds the transition relationship 18 months before Phase 3 decision-making begins.',
              },
              {
                title: 'Prepare deterrence-framed pitch (not platform pitch)',
                description:
                  'CYBERCOM and AFCYBER leadership think in deterrence terms — the Execution Gap as a deterrence problem, not a platform demo. A deck that opens with "here is our platform" misreads the audience; a deck that opens with "here is the gap between knowing and acting, and here is what closes it" lands.',
              },
              {
                title: 'Secure letter of interest for DIU submission',
                description:
                  'The single most tangible deliverable on this track. A letter of interest from CYBERCOM J39 or AFCYBER transforms the DIU CSO submission from a hypothetical into a sponsored submission — it is the lever that gates the entire Layer 4 funding track.',
              },
              {
                title: 'Explore CYBERCOM-sponsored SBIR topic visibility',
                description:
                  'CYBERCOM occasionally sponsors SBIR topics aligned to internal requirements — the same briefings that produce the DIU letter of interest may also surface a CYBERCOM-sponsored SBIR topic that becomes the first-ranked target on the SBIR track.',
              },
            ],
          },
        ],
      },
    ],
  },
];

const TIMELINE: TrackSeed = {
  title: 'Master Execution Timeline',
  fundingVehicle: 'Cross-Track Timeline',
  description:
    'Phased 180-day execution plan across all four funding vehicles plus relationship development. The dates compound: a delay in the CYBERCOM briefings cascades into the DIU submission, so track slippage here, not per-track.',
  phases: [
    {
      title: 'Days 1-30',
      timeframe: 'Month 1',
      description: 'Kickoff — the calls and drafting that everything else depends on.',
      milestones: [
        {
          title: 'Kickoff actions',
          description: 'Four parallel kickoff threads, each cheap, each unblocking a downstream track.',
          actions: [
            {
              title: 'Parisi/Buckley call',
              description:
                'A single call that de-risks the Genesis resubmission by confirming the phased structure and award floor. Cheapest, highest-leverage action on the whole 180-day plan.',
            },
            {
              title: 'Begin Genesis resubmission drafting',
              description:
                'Drafting starts in Month 1 because the September 30, 2026 Genesis deadline is the hard deadline on the entire plan. Earlier is better — every week of buffer absorbs a portal outage or a reviewer clarification without missing the window.',
            },
            {
              title: 'Identify SBIR cycle',
              description:
                'Knowing the SBIR cycle dates in Month 1 drives the submission plan in Month 4 and keeps the two proposal tracks (Genesis + SBIR) from colliding.',
            },
            {
              title: 'Begin CYBERCOM outreach',
              description:
                'The CYBERCOM/AFCYBER relationship is the slowest-moving part of the plan, so it has to start first. Introductory briefings booked in Month 1 are the ones that happen in Month 3 — any later and the DIU letter of interest slips past the DIU submission window.',
            },
          ],
        },
      ],
    },
    {
      title: 'Days 30-60',
      timeframe: 'Month 2',
      description: 'Genesis resubmission goes in, AFWERX starts, SBIR topic locks.',
      milestones: [
        {
          title: 'Mid-phase actions',
          description: 'Submissions and topic decisions that commit the rest of the plan.',
          actions: [
            {
              title: 'Genesis resubmission submitted',
              description:
                'Resubmitting inside the 60-day window keeps the AFRL/RIGA institutional memory warm. Submitting later is not fatal but every month that passes thins the chance that the same "favorable" reviewers see the rewrite.',
            },
            {
              title: 'AFWERX initiated',
              description:
                'Starting AFWERX in Month 2 gives the portal application enough calendar time to incorporate operator feedback from the Genesis Phase 2 evaluation once it starts producing quotes.',
            },
            {
              title: 'SBIR topic finalized',
              description:
                'Topic lock in Month 2 is the latest point that keeps the SBIR drafting window on schedule. Ranked choice is AFRL/RI first, DARPA I2O second, NSA/CYBERCOM third — finalize based on what is actually in the current cycle.',
            },
          ],
        },
      ],
    },
    {
      title: 'Days 60-90',
      timeframe: 'Month 3',
      description: 'Expansion — DIU prep, CYBERCOM meetings, AFWERX submission.',
      milestones: [
        {
          title: 'Expansion actions',
          description: 'The middle month where the relationship track starts paying off in concrete artifacts.',
          actions: [
            {
              title: 'DIU CSO preparation',
              description:
                'DIU preparation runs in parallel with the CYBERCOM meetings because the letter of interest is the gating artifact for submission — preparing early keeps the submission ready to go the moment the letter lands.',
            },
            {
              title: 'First CYBERCOM meeting',
              description:
                'Month 3 is the earliest realistic date for an introductory briefing after a Month 1 request. This meeting is where the DIU letter of interest is either asked for or left for a follow-up conversation.',
            },
            {
              title: 'AFWERX submission',
              description:
                'AFWERX submits in Month 3 so the operator-tools track is in the evaluator pipeline before the DIU submission adds commercial-platform framing. Each submission informs how the evaluators of the next one read the Shadowgrid narrative.',
            },
          ],
        },
      ],
    },
    {
      title: 'Days 90-120',
      timeframe: 'Month 4',
      description: 'SBIR submission, DIU submission with CYBERCOM letter attached.',
      milestones: [
        {
          title: 'Submission actions',
          description: 'The last of the four proposal-track submissions go in.',
          actions: [
            {
              title: 'SBIR submission',
              description:
                'Submission window aligned to the cycle identified in Month 1. By Month 4 the Genesis resubmission, AFWERX, and now SBIR are all in evaluator hands simultaneously — by design, so the layered funding story is visible across multiple program offices at once.',
            },
            {
              title: 'DIU submission with CYBERCOM letter attached',
              description:
                'The CYBERCOM letter of interest secured in Month 3 travels with the DIU submission. This is the moment the relationship track converts into a funded-submission track.',
            },
          ],
        },
      ],
    },
    {
      title: 'Days 120-180',
      timeframe: 'Months 5-6',
      description: 'Evaluation window. Decisions cascade.',
      milestones: [
        {
          title: 'Evaluation window',
          description: 'Reviewers decide. This is the month where the layered strategy either compounds or does not.',
          actions: [
            {
              title: 'Genesis Phase 1 award decision',
              description:
                'A Phase 1 award is the signal the rest of the strategy is built around — it validates the phased restructure, unlocks Phase 2 planning, and becomes the single most quotable artifact in every other in-flight proposal.',
            },
            {
              title: 'SBIR evaluation',
              description:
                'SBIR evaluation typically runs 60-120 days. Track it and start preparing a Phase II follow-on framing in parallel, because a Phase I win is cheap insurance for continuity if Genesis slips.',
            },
            {
              title: 'DIU evaluation',
              description:
                'DIU evaluation can move fast once the transition-partner gate is cleared. This is the month where the CYBERCOM letter of interest either converts to a DIU award or the debrief identifies the specific reason to go back to J39 for version two.',
            },
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
  const entity = await prisma.entity.findFirst({
    where: { name: { contains: 'Shadowgrid', mode: 'insensitive' } },
  });
  if (!entity) {
    console.warn('[seed] CRM Entity "Shadowgrid" not found. WorkflowClient will be created without clientId link.');
  } else {
    console.log(`[seed] Found CRM Entity "${entity.name}" id=${entity.id}`);
  }

  let client = await prisma.workflowClient.findFirst({ where: { name: CLIENT_NAME } });
  if (client) {
    console.log(`[seed] Resetting existing WorkflowClient "${CLIENT_NAME}" (${client.id})`);
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

  let actionCount = 0;
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
              description: a.description ?? null,
              notes: a.notes ?? null,
              status: 'Todo',
              sortOrder: ai,
            },
          });
          actionCount++;
        }
      }
    }
  }

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

  console.log(`\n[seed] Shadowgrid workflow seed complete. ${allTracks.length} tracks, ${actionCount} action items.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
