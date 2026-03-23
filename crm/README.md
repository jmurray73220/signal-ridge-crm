# Signal Ridge CRM

A full-featured Customer Relationship Management system built for Signal Ridge Strategies — a full-service government relations firm.

## Features

- **Contact Management** — Track individuals with rank, title, tags, and full interaction history
- **Three Entity Types** — Congressional Offices, Government Organizations, and Companies with type-specific metadata
- **Initiatives** — Kanban board + list view with multi-entity and multi-contact associations
- **Interaction Log** — Chronological feed of all meetings, calls, emails, hearings, and briefings
- **Tasks** — Due-date aware task list grouped by Overdue / Today / Upcoming
- **Global Search** — Cmd+K search across all contacts, organizations, and initiatives
- **AI Briefing Generation** — Generate pre-meeting briefing memos via Claude (Anthropic API)
- **Gmail Integration** — Import email threads directly into interaction records
- **CSV Export** — Export contacts, entities, and interactions from any list view
- **Role-Based Access** — Admin, Editor, and Viewer roles with per-feature permissions
- **Multi-User** — Create and manage user accounts with forced password change on first login

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + TanStack Query + React Router v6
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: SQLite (can migrate to PostgreSQL)
- **Auth**: JWT via httpOnly cookies
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)

## Setup

### 1. Clone and install

```bash
cd crm
npm install           # install root concurrently
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```
DATABASE_URL=file:./prisma/dev.db
JWT_SECRET=your-secret-here-minimum-32-chars
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=YourSecurePassword123!
ANTHROPIC_API_KEY=sk-ant-...
GMAIL_CLIENT_ID=your-google-oauth-client-id
GMAIL_CLIENT_SECRET=your-google-oauth-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/auth/gmail/callback
PORT=3001
```

### 3. Initialize database

```bash
cd server
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
```

### 4. Run development servers

From the `crm/` directory:

```bash
npm run dev
```

This starts both:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

Login with the admin credentials you set in `.env`.

## Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Go to **APIs & Services > Credentials**
5. Create an **OAuth 2.0 Client ID** (Web application)
6. Add authorized redirect URI: `http://localhost:3001/auth/gmail/callback`
7. Copy the Client ID and Secret into your `server/.env`

On first use of "Import from Gmail" in the log interaction modal, you'll be prompted to connect your Gmail account.

## Anthropic API Setup

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an API key
3. Add to `server/.env` as `ANTHROPIC_API_KEY`

Briefings are generated using the `claude-sonnet-4-20250514` model.

## Database Backup

The SQLite database is a single file at `server/prisma/dev.db`. To back it up:

```bash
cp server/prisma/dev.db server/prisma/dev.db.backup-$(date +%Y%m%d)
```

To migrate to PostgreSQL, update `DATABASE_URL` in `.env` to a PostgreSQL connection string and update the `provider` in `server/prisma/schema.prisma` from `sqlite` to `postgresql`, then run `npx prisma migrate dev`.

## User Management

Only Admin users can create accounts. There is no self-registration. New users receive a temporary password and must change it on first login.

**Default roles:**
- **Admin** — Full access including user management and deletes
- **Editor** — Can create and edit all records, log interactions, manage tasks
- **Viewer** — Read-only access; can export CSV and generate briefings
