# JulleyOnline

A multi-organization, multi-tenant **real-time collaborative Kanban** built for
the JulleyOnline technical assignment.

Organizations contain branches (tenants); each branch has boards, columns and
tasks. Every row is tenant-scoped, every request is authenticated and
authorized, and every mutation is broadcast live to the other people looking at
the same board — with optimistic UI, undo/redo, presence and explicit conflict
resolution.

![Kanban board](screenshots/board.png)

## What's inside

| Area | Highlights |
| --- | --- |
| **Multi-tenancy** | Organization → Tenant → Board → Column → Task. Mandatory `X-Tenant-Id`, validated against memberships on every request and every socket join. |
| **RBAC** | `ORG_ADMIN`, `TENANT_ADMIN`, `MEMBER` with a central permission matrix; org admins see every branch, tenant roles only their own. |
| **Realtime** | Socket.IO tenant rooms, server-authoritative broadcasts, live presence with multi-tab counts, automatic re-join + resync after reconnect. |
| **Concurrency** | Optimistic locking via `version`; stale writes return `409` with the current task and a merge dialog. |
| **Ordering** | Fractional `position` values; O(1) drag-and-drop with local rebalancing. |
| **UX** | Drag-and-drop board, task drawer, create/edit/delete, column manager, board settings, filters, activity feed, member management, dark theme. |
| **Resilience** | Optimistic moves, 50-step undo/redo, automatic token refresh, query invalidation on every event, network recovery. |
| **AI (optional)** | Read-only FastAPI analyst over a tenant-scoped snapshot; deterministic offline mode plus optional OpenAI-compatible LLM. |
| **Deliverables** | API + WebSocket docs, ERD, architecture/trade-offs, Postman collection, seed data, test report. |

## Stack

- **Frontend:** Next.js 16.4 (App Router), React 19, TypeScript, Tailwind CSS v4, dnd-kit, TanStack Query, Axios, Socket.IO client
- **Backend:** Express 5, TypeScript, Prisma 6.19, PostgreSQL 18, Zod 4, JWT + rotating refresh tokens, Socket.IO 4
- **AI service:** Python 3.14, FastAPI, Pydantic 2, httpx (optional LLM)
- **Tooling:** Vitest + Supertest, pytest, ESLint, `tsc`, Next build

## Repository layout

```
JulleyOnline/
├── backend/            Express API + Socket.IO + Prisma
│   ├── prisma/         schema.prisma, migrations, seed.ts
│   └── src/            config, middleware, services, controllers, routes, realtime
├── frontend/           Next.js app (App Router)
│   └── src/            app, components, context, hooks, lib
├── ai-service/         FastAPI read-only assistant + pytest
├── database/           schema.sql (generated DDL)
├── docs/               architecture, API, WebSocket, ERD, test report, Postman
├── scripts/            env bootstrap, PostgreSQL MCP wrapper
├── screenshots/        UI captures
├── .env.example        every variable in one place
└── opencode.jsonc      OpenCode MCP configuration (PostgreSQL)
```

## Prerequisites

- Node.js 20+ (`npm.cmd` on Windows PowerShell)
- PostgreSQL 14+ running locally (developed against 18)
- Python 3.10+ (optional, for the AI service)
- OpenCode (optional, for the PostgreSQL MCP integration)

## Setup

### 1. Database

Create a least-privilege role and the database. Replace the password:

```sql
CREATE ROLE kanban_app WITH LOGIN PASSWORD 'choose-a-strong-password';
CREATE DATABASE collaborative_kanban OWNER kanban_app;
```

### 2. Environment files

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.local.example frontend\.env.local
Copy-Item ai-service\.env.example ai-service\.env
```

Edit `backend/.env`:

```dotenv
DATABASE_URL="postgresql://kanban_app:choose-a-strong-password@localhost:5432/collaborative_kanban?schema=public"
```

`scripts/generate-env.mjs` can generate the secrets for you:

```powershell
node scripts\generate-env.mjs
```

Make sure `AI_SERVICE_TOKEN` matches in `backend/.env` and `ai-service/.env`.
Leave `LLM_API_KEY` empty to run the assistant fully offline.

### 3. Backend

```powershell
cd backend
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
npm.cmd run db:seed
npm.cmd run dev            # http://localhost:5000
```

`migrate dev` creates the schema from `prisma/schema.prisma`. If you prefer raw
DDL, `database/schema.sql` contains the generated `CREATE TABLE` statements.

### 4. Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev            # http://localhost:3000
```

The browser calls `/api/*` on port 3000; `next.config.ts` proxies it to
`http://localhost:5000`, keeping the auth cookies first-party. Socket.IO
connects directly to `NEXT_PUBLIC_SOCKET_URL`.

### 5. AI assistant (optional)

```powershell
cd ai-service
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

If it is not running, the rest of the app still works; `/api/ai/assistant`
returns `503 AI_SERVICE_UNAVAILABLE`.

## Demo accounts

Seeded by `backend/prisma/seed.ts` — password for all accounts:
**`Password123!`**

| User | Email | Access |
| --- | --- | --- |
| Rahul Sharma | `rahul@abctech.dev` | ORG_ADMIN — ABC Technologies (Hyderabad, Bangalore, Chennai) |
| Priya Nair | `priya@abctech.dev` | TENANT_ADMIN — Hyderabad |
| Arjun Reddy | `arjun@abctech.dev` | MEMBER — Hyderabad |
| Sneha Iyer | `sneha@abctech.dev` | TENANT_ADMIN — Bangalore |
| Aisha Khan | `aisha@abctech.dev` | MEMBER — Chennai |
| Meera Joshi | `meera@xyzsolutions.dev` | ORG_ADMIN — XYZ Solutions (Mumbai, Pune) |
| Kiran Patil | `kiran@xyzsolutions.dev` | MEMBER — Mumbai |

Try signing in as `rahul` and `priya` in two browsers to see presence, live
moves and role-based UI.

## Scripts

| Location | Command | Purpose |
| --- | --- | --- |
| backend | `npm.cmd run dev` | API + WebSocket with hot reload |
| backend | `npm.cmd run build` / `start` | Compile to `dist/` and run |
| backend | `npm.cmd run typecheck` | TypeScript check |
| backend | `npm.cmd test` | Vitest integration suite (needs a test database) |
| backend | `npm.cmd run prisma:migrate` | Create/apply a migration |
| backend | `npm.cmd run db:seed` | Reset demo data |
| frontend | `npm.cmd run dev` / `build` / `lint` | Next.js dev, production build, ESLint |
| ai-service | `python -m pytest -q` | Assistant unit + HTTP tests |
| ai-service | `uvicorn app.main:app --port 8000` | Run the assistant |

## Documentation

- [Architecture, tenancy model, trade-offs](docs/architecture.md)
- [REST API reference](docs/api-documentation.md)
- [WebSocket reference](docs/websocket-documentation#websocket-reference-socketio)
- [Database design + ERD](docs/database-erd.md) · [SVG](docs/database-erd.svg) · [DDL](database/schema.sql)
- [Postman collection](docs/postman_collection.json)
- [Test report](docs/test-report.md)
- [PostgreSQL MCP setup](docs/mcp-setup.md)
- [Assistant service](ai-service/README.md)

## How tenancy and RBAC work (short version)

1. The client sends `X-Tenant-Id` with every scoped request.
2. `requireTenant` loads the tenant and resolves the caller's membership:
   tenant-specific membership wins, otherwise an org-wide `ORG_ADMIN` grant
   applies.
3. `requirePermission` checks a central matrix. Members can create/update/move
   tasks but may only delete their own; only admins manage boards, columns and
   membership.
4. Services always include `tenant_id` in `WHERE` clauses — even for
   id-addressed reads. Cross-tenant ids return `404`, never data.
5. Socket.IO rooms are joined server-side after the same membership check.
6. The AI service receives a pre-filtered snapshot and has no DB credentials.

## Conflict handling

Every task carries `version`. Update and move requests must include the version
the client loaded. The SQL update is conditional on that version:

- success → `200` + new version, broadcast to the tenant;
- stale → `409 VERSION_CONFLICT` with `details.currentTask`.

The board shows a conflict dialog: **keep mine** (retry against the new version)
or **take server version**. Undo/redo replays moves through the same endpoint,
so it obeys the same rules.

## Screenshots

| | |
| --- | --- |
| ![Login](screenshots/login.png) | ![Dashboard](screenshots/dashboard.png) |
| ![Board](screenshots/board.png) | ![Task drawer](screenshots/task-drawer.png) |
| ![Activity](screenshots/activity.png) | ![Assistant](screenshots/assistant.png) |

## Known limitations

- Socket.IO rooms are in-process; multi-instance deployments need the Redis
  adapter (the event contract does not change).
- No email delivery — invited users must already have an account.
- Activity feed is paginated by `limit` rather than cursor pagination.
- Soft delete / restore is not implemented; deletions are audited instead.
- The AI assistant is read-only by design and answers from a snapshot, not live
  SQL.

See [docs/architecture.md](docs/architecture.md#trade-offs-and-known-limits) for
the reasoning behind these choices.
