# Signal Ridge CRM — Working Notes for Claude

Project context that's not obvious from reading the code or git log. Keep this short — it's loaded every session.

## Run locally

```
cd crm
npm run dev
```

Spins up server (`:3001`), client (`:5173/crm/`), and workflow client (`:5174/workflow/`) concurrently. Or double-click `launch.bat` at repo root.

## Deploy

Railway auto-deploys on push to `main`. Builds from `Dockerfile` per `railway.json`. Start: `node crm/server/dist/src/index.js`. No manual CLI step needed — just `git push origin main`.

The Postgres DB is the same one in dev and prod (Railway, hosted). `prisma migrate dev` writes to that prod DB. Be aware: every local migration lands in production immediately. Stop the dev server before running migrations or Prisma client regen will fail with EPERM.

## Repo layout

- `crm/client/` — Vite + React + TS, Tailwind. UI lives at `/crm/`.
- `crm/server/` — Express + Prisma + TS. Postgres on Railway.
- `crm/workflow-client/` — separate Vite app at `/workflow/`.
- `crm/server/prisma/schema.prisma` — single source of truth for the data model.

## Active feature: Client Briefing

The briefing wizard at `crm/client/src/components/ClientBriefingWizard.tsx` is the most recently overhauled piece. Five-step flow:
1. Client & Office
2. Reference Briefings — pick which past briefings to draw from
3. Meeting Details
4. Objectives & Talking Points (server pre-fills these from the references via `briefingApi.extractDraft`)
5. Review & Generate

Past briefings are uploaded on the **Past Briefings** tab on either an Office or a Client detail page (single underlying record visible from both). Storage: `BriefingDocument` table. Text extraction at upload time via `mammoth` (.docx) or `pdf-parse` (.pdf), stored on the row.

### Non-obvious decisions

- **Reference filter** is by `clientId` only, NOT also by `officeId`. Same client across multiple offices means the pool draws from all of them.
- **Bio section is conditional**: only emitted when the office's display name resolves to a current Member of Congress via the `findMember` lookup in `crm/server/src/services/memberLookup.ts`. Committees / staff orgs get no Bio.
- **Portrait lookup chain**:
  - Legislator data: `https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml` parsed with `js-yaml`. The old theunitedstates.io mirror is HTTP 410 Gone since spring 2026 — do not use.
  - Senate portraits: `https://www.senate.gov/senators/PortraitImages/{BIOGUIDE}.jpg`
  - House portraits: `https://clerk.house.gov/images/members/{lowercase_bioguide}.jpg`
  - Match key: last name + chamber (sen/rep) + 2-letter state.
- **Pre-fill is non-destructive**: the extract-draft endpoint only fills empty fields in the wizard. If the user typed something, the pre-fill won't overwrite it.
- **Tag bank** suggests previously-used tags. Free-text tags accepted via Enter or the "+ Add 'X' as new tag" affordance. Client/Initiative names aren't auto-suggested as tags — use the structured fields for those.

## Open items / queued work

- **Drop `memberName`** on `Entity` entirely. The display `name` is sufficient now. Migration + scrub references in: client edit modal, server controllers, briefing prompt context, types.
- **Phase 3 — match Schumer briefing layout**: the file at `Client Briefing - Sen Schumer.docx` (repo root) is the layout target. Rewrite `crm/server/src/services/briefingDocx.ts` to match — font, sizing, portrait positioning (likely top-right with text-wrap), section spacing.

## Useful gotchas

- `[portrait] …` log lines in the dev terminal show whether the portrait lookup succeeded for a generation (looking up → match → fetched bytes).
- Migrations folder is `crm/server/prisma/migrations/`. Each one's `migration.sql` is committed; the Prisma client is regenerated on `npm install` and on `prisma migrate dev`.
- The `dutyboundpac-web` folder lives at `~/Documents/dutyboundpac-web` — that's a separate project (Cloudflare Pages + wrangler) with its own working notes if you stumble onto it.
