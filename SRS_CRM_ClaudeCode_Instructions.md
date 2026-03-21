# SRS CRM — Claude Code Build Instructions

## Project Overview

Build a full-featured CRM (Customer Relationship Management) application tailored for a full-service government relations firm. The system must support contact management, tracking of three distinct entity types (Companies, Government Organizations, and Congressional Offices), initiative/project association, meeting notes, and bidirectional lookups (entity → people and people → entity/initiatives).

---

## Tech Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Node.js + Express (REST API)
- **Database**: SQLite (via Prisma ORM) — easy local setup, can migrate to PostgreSQL later
- **Auth**: JWT-based login with role-based access control (multi-user)
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: React Router v6

---

## Database Schema

Design the following Prisma models:

### `Contact`
- `id` (UUID)
- `firstName`, `lastName` (string, required)
- `rank` (string, optional — military rank if applicable, e.g., "COL", "RDML", "SES")
- `title` (string, optional — civilian title or position)
- `email` (string, optional)
- `officePhone` (string, optional)
- `cell` (string, optional)
- `linkedIn` (string, optional)
- `bio` (text, optional)
- `tags` (string array — e.g., "decision-maker", "technical", "congressional", "Hill staffer", "program office", "BD target", "SITE 525")
- `entityId` (FK → Entity, optional)
- `createdAt`, `updatedAt`

### `Entity`
The central organizing model for all organizations a government relations firm interacts with. Unifies three distinct types — Congressional Offices, Government Organizations, and Companies — under one schema while preserving type-specific metadata.

- `id` (UUID)
- `name` (string, required)
- `entityType` (enum: `CongressionalOffice`, `GovernmentOrganization`, `Company`, `NGO`, `Other`)
- `website` (string, optional)
- `description` (text, optional)
- `address` (string, optional)
- `tags` (string array)
- `createdAt`, `updatedAt`

**Type-specific fields (all optional — only populated for relevant entity types):**

For `CongressionalOffice`:
- `memberName` (string — e.g., "Sen. John Cornyn")
- `chamber` (enum: `Senate`, `House`)
- `state` (string)
- `district` (string, optional — House only)
- `committee` (string array — committee assignments)
- `party` (enum: `Republican`, `Democrat`, `Independent`)
- `subcommittee` (string array, optional)

For `GovernmentOrganization`:
- `parentAgency` (string, optional — e.g., "Department of Defense")
- `subComponent` (string, optional — e.g., "SO/LIC", "USSOCOM", "DARPA")
- `governmentType` (enum: `DoD`, `Intel`, `DHS`, `State`, `Other`)
- `budgetLineItem` (string, optional — relevant program/budget reference)

For `Company`:
- `industry` (string, optional)
- `contractVehicles` (string array, optional — e.g., "OASIS+", "SEWP VI")

### `Initiative`
- `id` (UUID)
- `title` (string, required)
- `description` (text, optional)
- `status` (enum: `Active`, `Pipeline`, `On Hold`, `Closed`)
- `priority` (enum: `High`, `Medium`, `Low`)
- `startDate`, `targetDate` (DateTime, optional)
- `primaryEntityId` (FK → Entity, optional — primary entity associated)
- `createdAt`, `updatedAt`

### `InitiativeContact` (join table)
- `initiativeId` (FK → Initiative)
- `contactId` (FK → Contact)
- `role` (string, optional — e.g., "Champion", "Gatekeeper", "End User", "Sponsor", "Staffer Lead")

### `InitiativeEntity` (join table — for multi-entity initiatives)
- `initiativeId` (FK → Initiative)
- `entityId` (FK → Entity)
- `relationshipNote` (string, optional — e.g., "oversight committee", "contracting office", "end user")

### `Interaction` (meeting/call/email notes)
- `id` (UUID)
- `type` (enum: `Meeting`, `Call`, `Email`, `Hearing`, `Briefing`, `Event`, `Other`)
- `date` (DateTime)
- `subject` (string)
- `notes` (text — rich/markdown)
- `gmailThreadUrl` (string, optional — link back to Gmail thread if imported)
- `entityId` (FK → Entity, optional)
- `initiativeId` (FK → Initiative, optional)
- `createdAt`, `updatedAt`

### `InteractionContact` (join table)
- `interactionId`, `contactId`

### `Task`
- `id` (UUID)
- `title` (string)
- `dueDate` (DateTime, optional)
- `completed` (boolean)
- `contactId` (FK, optional)
- `entityId` (FK, optional)
- `initiativeId` (FK, optional)
- `createdAt`, `updatedAt`

---

## API Endpoints

Build full CRUD REST endpoints for all entities:

```
/api/contacts          GET, POST
/api/contacts/:id      GET, PUT, DELETE
/api/contacts/:id/interactions
/api/contacts/:id/initiatives
/api/contacts/:id/tasks

/api/entities          GET, POST
/api/entities/:id      GET, PUT, DELETE
/api/entities/:id/contacts
/api/entities/:id/initiatives
/api/entities/:id/interactions
/api/entities?type=CongressionalOffice     (filter by entityType)
/api/entities?type=GovernmentOrganization
/api/entities?type=Company

/api/initiatives       GET, POST
/api/initiatives/:id   GET, PUT, DELETE
/api/initiatives/:id/contacts
/api/initiatives/:id/entities
/api/initiatives/:id/interactions

/api/interactions      GET, POST
/api/interactions/:id  GET, PUT, DELETE

/api/tasks             GET, POST
/api/tasks/:id         PUT, DELETE

/api/search?q=         Global search across contacts, entities, initiatives

/api/export/contacts        GET → CSV
/api/export/entities        GET → CSV (accepts ?type= filter)
/api/export/interactions    GET → CSV
/api/briefing/entity/:id    GET → structured data for AI briefing generation
/api/briefing/contact/:id   GET → structured data for AI briefing generation

/auth/gmail                 GET → initiate Gmail OAuth
/auth/gmail/callback        GET → OAuth callback
/api/gmail/search?q=        GET → search Gmail inbox
/api/gmail/thread/:id       GET → fetch thread content for import
```

---

## Frontend Pages & Features

### 1. Dashboard (`/`)
- Summary stats: total contacts, congressional offices, government organizations, companies, active initiatives, tasks due this week
- Recent interactions feed (last 10)
- Tasks due soon
- Quick-add buttons for contact, interaction, task

### 2. Contacts (`/contacts`)
- Searchable, filterable table (by entity, tag, name, rank)
- Columns: Name, Rank/Title, Organization (with entity type badge), Tags, Last Interaction date
- Click row → Contact Detail page

### 3. Contact Detail (`/contacts/:id`)
- Header: Name, Rank, Title, Organization (linked, with entity type badge), office phone, cell, email, LinkedIn
- Tags
- **Associated Organization** (linked card with entity type badge)
- **Initiatives** — list of all initiatives this person is associated with, with their role
- **Interaction History** — chronological log of all meetings/calls/notes involving this person
- **Tasks** related to this contact
- Edit button (inline form or modal)
- "Log Interaction" button
- "Add to Initiative" button
- **"Generate Briefing"** button → triggers Briefing Mode

### 4. Three Entity List Pages (shared layout, filtered by type):

#### Congressional Offices (`/congressional`)
- Searchable, filterable table (by chamber, state, party, committee)
- Columns: Member, Chamber, State/District, Party, Key Committees, # Contacts, Last Interaction
- Entity type badge: blue `SENATE` or red `HOUSE`

#### Government Organizations (`/government`)
- Searchable, filterable table (by parent agency, government type, sub-component)
- Columns: Organization, Parent Agency, Sub-Component, Type badge, # Contacts, # Active Initiatives, Last Interaction

#### Companies (`/companies`)
- Searchable, filterable table (by industry, tag)
- Columns: Name, Industry, Contract Vehicles, # Contacts, # Active Initiatives, Last Interaction

### 5. Entity Detail (shared layout, type-aware rendering) (`/entities/:id`)
- Header: Name + entity type badge, type-specific metadata shown contextually:
  - Congressional: member name, chamber, state/district, party, committees
  - Government Org: parent agency, sub-component, type, budget line item
  - Company: industry, contract vehicles
- **People** tab — all contacts associated (with rank, title, tags)
- **Initiatives** tab — all initiatives for this entity (with status, priority)
- **Interactions** tab — all interactions logged against this entity or its contacts
- **Tasks** tab
- "Add Contact" button
- "Create Initiative" button
- "Log Interaction" button
- **"Generate Briefing"** button

### 6. Initiatives (`/initiatives`)
- Kanban board view (by status: Pipeline → Active → On Hold → Closed) AND list view toggle
- Cards show: title, entity name + type badge, # contacts, priority badge, target date

### 7. Initiative Detail (`/initiatives/:id`)
- Header: Title, Primary Entity (linked), Status, Priority, Dates, Description
- **Contacts** tab — everyone associated, with their role on this initiative
- **Organizations** tab — all entities linked (primary + additional via InitiativeEntity), with relationship notes
- **Interactions** tab — all meeting/call notes tied to this initiative
- **Tasks** tab
- Edit, "Add Contact", "Add Organization", "Log Interaction" buttons

### 8. Interactions / Log (`/interactions`)
- Reverse-chronological feed of all logged interactions
- Filterable by type, date range, entity, contact
- Each card: date, type badge, subject, entities/contacts linked, Gmail thread link if present

### 9. Log Interaction (modal or `/interactions/new`)
- Fields: Type (includes Hearing, Briefing), Date, Subject, Notes (markdown editor)
- Multi-select contacts (searchable dropdown)
- Link to Entity (optional — searches across all entity types, shows type badge in results)
- Link to Initiative (optional)
- **"Import from Gmail"** button (see Gmail Integration below)

### 10. Global Search
- Persistent search bar in header
- Returns unified results: Contacts, Congressional Offices, Government Orgs, Companies, Initiatives — each labeled with a colored entity type badge
- Keyboard shortcut: `Cmd+K` / `Ctrl+K`

### 11. Tasks (`/tasks`)
- Simple list grouped by: Overdue, Due Today, Upcoming, No Date
- Checkbox to complete
- Linked entity shown (contact / entity / initiative), with entity type badge where applicable

### 12. Export to CSV
- Available on Contacts, each Entity list page, and Interactions
- "Export CSV" button in the top-right of each list view
- Exports the current filtered view (not all records)
- Columns match the visible table plus all relevant linked fields

### 13. Gmail Integration — Interaction Logging
- "Import from Gmail" button in the Log Interaction modal
- Launches a Gmail search panel: user types a contact name or subject keyword
- Returns matching email threads from Gmail inbox
- User selects a thread → auto-populates: Date, Subject, Notes (formatted email body)
- Gmail thread URL stored on the interaction record and shown as a link
- User reviews and saves as an `Email` type interaction
- Requires Gmail OAuth — on first use, prompts user to connect Gmail account

### 14. Briefing Mode
- Accessible via "Generate Briefing" button on Contact Detail and Entity Detail pages
- Fetches full CRM context for that record via `/api/briefing/` endpoints
- Calls the Anthropic API (`claude-sonnet-4-20250514`) with a structured system prompt and the full context payload
- System prompt instructs Claude to produce a concise, structured pre-meeting briefing memo:
  - **Who They Are** — organization overview or individual bio
  - **Our History** — summary of past interactions and relationship status
  - **Active Initiatives** — what we're working on together or pursuing
  - **Key Contacts** — relevant people and their roles (for entity briefings)
  - **Talking Points** — suggested agenda items or conversation starters
  - **Watch Items** — pending tasks, unresolved follow-ups, anything flagged
- Output rendered as formatted markdown in a full-screen modal
- Modal includes "Copy to Clipboard" and "Export as PDF" buttons
- PDF uses the same server-side PDF generation utility used for CSV exports

---

## UI/UX Requirements

- **Aesthetic**: Clean, professional, dark-navy primary with warm accent color. Think "secure government portal meets premium SaaS." No gradients, no fluff. Typography-forward. Dense but readable.
- **Fonts**: IBM Plex Sans — import from Google Fonts
- **Color palette**:
  - Background: `#0d1117`
  - Surface: `#1c2333`
  - Border: `#30363d`
  - Primary accent: `#c9a84c` (muted gold)
  - Text primary: `#e6edf3` / muted: `#8b949e`
  - Status: green `#238636` (Active), amber `#9e6a03` (Pipeline / On Hold), red `#da3633` (Overdue/Closed)
- **Entity type badges** (consistent throughout the app):
  - Senate: `#1e3a5f` bg / `#60a5fa` text — `SENATE`
  - House: `#3b1f1f` bg / `#f87171` text — `HOUSE`
  - Government Org: `#0f3030` bg / `#34d399` text — label = governmentType value (e.g., `DoD`)
  - Company: `#2a2a2a` bg / `#9ca3af` text — `COMPANY`
- **Sidebar navigation**: Collapsible. Icons + labels. Sections: Dashboard, Contacts, Congressional, Government Orgs, Companies, Initiatives, Interactions, Tasks
- **Responsive**: Desktop-first but functional at tablet width
- **Empty states**: Every list/table needs an empty state with a CTA button
- **Toast notifications** for all create/update/delete actions
- **Confirmation dialogs** for all deletes

---

## Key Bidirectional Relationship Logic

This is the most important feature. The system must make it trivially easy to navigate in all directions:

1. **From any Entity** → see every person associated + every initiative + every logged interaction
2. **From a Contact** → see their organization (with entity type context) + every initiative they're on (with role) + full interaction history
3. **From an Initiative** → see all organizations linked (primary + additional) + all people involved + all logged interactions
4. **Cross-entity initiatives**: Some initiatives span multiple entity types (e.g., a Senate SASC staffer, an OSD/SO/LIC office, and a defense prime all involved in the same program). The `InitiativeEntity` join table supports this. Initiative Detail must show all linked entities, not just the primary one.

Every linked entity throughout the app must be a **clickable link**. No dead-end views.

---

## Pre-Seeded Tags

Pre-populate the tag system with these suggested values (user can add more at any time):

**Contact tags**: `Hill Staffer`, `Member`, `Program Office`, `Contracting Officer`, `SES`, `Flag Officer`, `Decision Maker`, `Technical POC`, `BD Target`, `Champion`, `Gatekeeper`, `SITE 525`

**Entity tags**: `Priority Account`, `Active Contract`, `Oversight`, `Appropriations`, `Authorization`, `FYDP`, `Current Client`, `Prospect`

---

## Data Seeding

Create a seed script (`prisma/seed.ts`) with realistic sample data:
- 2 Congressional Offices (one Senate, one House — with committee assignments, party, state)
- 2 Government Organizations (e.g., OSD/SO/LIC and USSOCOM or CYBERCOM)
- 2 Companies (defense contractors or consulting firms)
- 12–16 contacts spread across the above entities, with rank/title as appropriate
- 5–7 initiatives (mix of statuses, some linked to multiple entities via InitiativeEntity)
- 12+ interactions with varied dates, types, and realistic-sounding subject/notes
- Several tasks with varied due dates and linked entities

---

## File Structure

```
/crm
  /client
    /src
      /components      (Badge, Card, Modal, Table, EntityTypeBadge, MarkdownViewer, etc.)
      /pages
      /hooks           (useContacts, useEntity, useInitiatives, useBriefing, useGmail, etc.)
      /api             (typed API client functions)
      /types           (shared TypeScript interfaces)
  /server
    /routes
    /controllers
    /middleware
    /services
      briefing.ts      (Anthropic API call + prompt construction)
      gmail.ts         (Gmail OAuth + thread import)
      export.ts        (CSV + PDF generation)
  /prisma
    schema.prisma
    seed.ts
  .env.example
  README.md
```

---

## Environment Variables (`.env.example`)

```
DATABASE_URL=file:./dev.db
JWT_SECRET=your_jwt_secret_here
ADMIN_EMAIL=your_email@example.com
ADMIN_PASSWORD=choose_a_strong_password
ANTHROPIC_API_KEY=your_anthropic_key_here
GMAIL_CLIENT_ID=your_google_oauth_client_id
GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_REDIRECT_URI=http://localhost:3001/auth/gmail/callback
PORT=3001
```

---

## README Requirements

Include:
- Setup instructions (install, env vars, db migrate, seed, dev server)
- How to run frontend + backend together (use `concurrently`)
- Gmail OAuth setup (how to create a Google Cloud project and OAuth credentials)
- Anthropic API key setup
- Brief description of each major feature
- How to export/backup the SQLite database

---

## Branding — Signal Ridge Strategies

The app should reflect the Signal Ridge Strategies brand throughout. Pull branding reference from **www.signalridgestrategies.com**.

- **App name**: "Signal Ridge CRM" — shown in the sidebar header and login page
- **Logo**: Use the Signal Ridge Strategies logo in the sidebar and on the login screen. If a logo file is not available, render the firm name in the app's display font with a small geometric mark as a placeholder.
- **Login page**: Branded full-screen page — dark background, centered card with logo, firm name, and tagline pulled from the website. Should feel polished and professional, consistent with the app's dark-navy aesthetic.
- **Browser tab title**: "Signal Ridge CRM"
- **Favicon**: Use the firm's logo mark if available; otherwise a simple "SR" monogram

---

## User Authentication & Access Control

The CRM must support multiple named users with role-based access so Jonathan can grant access to employers, contractors, or colleagues at varying permission levels.

### `User` model
- `id` (UUID)
- `email` (string, unique, required)
- `passwordHash` (string)
- `firstName`, `lastName` (string)
- `role` (enum: `Admin`, `Editor`, `Viewer`)
- `isActive` (boolean — Admin can deactivate without deleting)
- `lastLogin` (DateTime, optional)
- `createdAt`, `updatedAt`

### Roles & Permissions

| Feature | Admin | Editor | Viewer |
|---|---|---|---|
| View all records | ✅ | ✅ | ✅ |
| Create / edit contacts, entities, initiatives | ✅ | ✅ | ❌ |
| Log interactions | ✅ | ✅ | ❌ |
| Create / complete tasks | ✅ | ✅ | ❌ |
| Export CSV / generate briefings | ✅ | ✅ | ✅ |
| Add / deactivate users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| Delete any record | ✅ | ❌ | ❌ |

### Login Page (`/login`)
- Branded full-screen page with Signal Ridge Strategies logo and firm name
- Email + password fields
- "Sign In" button
- Error message for invalid credentials (do not specify which field is wrong)
- No self-registration — all accounts are created by Admin
- After login, redirect to Dashboard
- JWT stored in an httpOnly cookie (not localStorage)

### User Management Page (`/settings/users`) — Admin only
- Table of all users: Name, Email, Role, Status (Active/Inactive), Last Login
- "Add User" button → modal with fields: First Name, Last Name, Email, Role, temporary password
- New users receive a temporary password that they must change on first login
- Edit role button (inline dropdown)
- Deactivate / Reactivate toggle (does not delete the user or their activity)
- Cannot deactivate your own account

### Account Settings Page (`/settings/account`) — all users
- Change display name
- Change password (requires current password)

### Forced Password Change
- If `mustChangePassword` flag is set on the User model, redirect to a password-change screen after login before accessing any other page
- Set this flag automatically when Admin creates a new user

### Session Handling
- JWT expiry: 8 hours
- If session expires, redirect to `/login` with a "Your session has expired" message
- All API routes protected by auth middleware — unauthenticated requests return 401

### Audit Trail (lightweight)
- Add `createdByUserId` and `updatedByUserId` fields to Contact, Entity, Initiative, Interaction, and Task models
- Show "Added by [Name]" and "Last edited by [Name] on [date]" in small muted text at the bottom of detail pages

---

## Build Order

Build in this sequence:
1. Prisma schema + migration + seed script (including User model)
2. Express server with auth middleware (JWT, login route, protected routes)
3. Login page with Signal Ridge Strategies branding
4. React app scaffold with routing, sidebar, and auth-gated routes
5. Dashboard page
6. Contacts list + detail pages
7. Entity list pages (Congressional, Government, Companies) + shared Entity Detail page
8. Initiatives list (kanban + list) + detail pages
9. Interactions feed + Log Interaction modal
10. Tasks page
11. Global search (Cmd+K)
12. User Management page (`/settings/users`) + Account Settings (`/settings/account`)
13. CSV export (server routes + frontend buttons)
14. Gmail integration (OAuth flow + email import into interactions)
15. Briefing Mode (Anthropic API integration + PDF export)
16. Polish: pre-seeded tags, empty states, toasts, loading skeletons, responsive fixes, audit trail display

---

## Seed the First Admin User

The seed script must create one default Admin user so Jonathan can log in on first run:
- Email: set via `ADMIN_EMAIL` environment variable
- Password: set via `ADMIN_PASSWORD` environment variable (hashed with bcrypt before storing)
- Role: `Admin`
- `mustChangePassword`: `false` (Jonathan sets his own password via env var)

Add both to `.env.example` with placeholder values.
