# Architecture

## Overview

JulleyOnline is a four-process application:

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│ Next.js 16 (App Router)      │        │ Express 5 API                 │
│ localhost:3000               │  /api  │ localhost:5000                │
│                              │ ─────▶ │                               │
│ • Server components + proxy  │ rewrite│ • JWT auth (httpOnly cookies) │
│ • TanStack Query cache       │        │ • RBAC + tenant middleware    │
│ • dnd-kit Kanban             │        │ • Prisma 6 → PostgreSQL 18    │
│ • Socket.IO client           │        │ • Socket.IO server            │
└──────────────┬───────────────┘        └───────┬───────────────┬───────┘
               │ WebSocket (direct)             │               │ HTTP
               └────────────────────────────────┘               │
                                                                ▼
                                                     ┌──────────────────────┐
                                                     │ FastAPI assistant    │
                                                     │ localhost:8000       │
                                                     │ read-only snapshot   │
                                                     │ optional LLM         │
                                                     └──────────────────────┘
```

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js 16.4, React 19, TypeScript, Tailwind v4, dnd-kit, TanStack Query | UI, optimistic updates, cache invalidation, presence |
| API | Express 5, Prisma 6.19, Zod 4, Socket.IO 4 | Auth, tenancy, RBAC, validation, persistence, realtime fan-out |
| Database | PostgreSQL 18 | Source of truth, tenant-scoped indexes |
| Assistant | FastAPI, Pydantic 2, httpx | Natural-language Q&A over a pre-filtered snapshot |

There is no message broker. A single Node process owns the WebSocket server;
horizontal scaling would add the Socket.IO Redis adapter without changing the
event contract (see [`websocket-documentation.md`](./websocket-documentation.md)).

## Request lifecycle

1. **Browser → Next.js.** The app calls `/api/*` on port 3000. `next.config.ts`
   rewrites those requests to `http://localhost:5000/api/*`. Keeping the API
   same-origin means the httpOnly auth cookies are first-party and no CORS
   preflight is needed in the browser.
2. **Auth.** `requireAuth` verifies the `kanban_access` JWT and loads the user.
   On expiry the browser receives `401`; the Axios interceptor calls
   `/api/auth/refresh` once (shared promise for concurrent failures) and retries.
3. **Tenant resolution.** `requireTenant` reads `X-Tenant-Id`, loads the tenant,
   and resolves the caller's effective membership. The resulting `req.tenant`
   carries `id`, `organizationId`, `role` and `membershipId`.
4. **Authorization.** `requirePermission` checks the role against a central
   permission matrix (`middleware/role.ts`).
5. **Validation.** Zod schemas validate body/query/params before the controller
   runs. Failures become a single `400 VALIDATION_ERROR` with field details.
6. **Service.** Business rules run in a service. Multi-row changes (board +
   columns, task move + activity) use `prisma.$transaction`.
7. **Realtime.** After commit, the service emits a tenant-scoped event. Clients
   invalidate queries and refetch authoritative state.
8. **Response.** `{ data }` on success, `{ error: { code, message, details } }`
   on failure.

## Tenancy model

```
Organization ──┬── Tenant ── Board ── Column ── Task
               └── Membership (org-wide ORG_ADMIN)
Tenant ── Membership (TENANT_ADMIN / MEMBER)
```

- The **tenant is the isolation boundary**. `boards`, `columns`, `tasks` and
  `activity_logs` all carry a non-null `tenant_id`.
- A user's access is the union of their memberships. An org-wide `ORG_ADMIN`
  sees every tenant in that organization; tenant memberships see only their
  tenant.
- Every service query filters by `tenant_id`, even when the row id is already
  known. There is no unscoped `findUnique(id)` path for tenant-owned data.
- Foreign keys are validated inside the tenant too: a task's `columnId` must
  belong to the same board and tenant, and an assignee must be a tenant member
  (or an org admin).
- The WebSocket server repeats the membership check before joining
  `tenant:<id>`; the client cannot choose its own room.
- The AI service receives an already-filtered snapshot and has no database
  credentials, so it cannot widen scope.

**Why a shared schema instead of schema-per-tenant?** The assignment describes
a hierarchy *inside* one product (organizations → branches), not separate
customer databases. A shared schema keeps migrations and cross-branch reporting
simple. The trade-off is that isolation is enforced by application code rather
than by the database; that is why `tenant_id` is denormalized onto every child
table and why integration tests specifically attempt cross-tenant reads.

## Authentication & sessions

- **Access token:** JWT, 15 minutes, `httpOnly`, `SameSite=Lax`, `Secure` in
  production, path `/`.
- **Refresh token:** 32 random bytes, 7 days, `httpOnly`, path `/api/auth`.
  Only its SHA-256 hash is stored in `refresh_tokens`.
- **Rotation:** every refresh revokes the old row and issues a new pair.
  Presenting a revoked token is treated as compromise and revokes all of that
  user's sessions.
- **Passwords:** bcrypt cost 12. Login returns the same error for unknown email
  and wrong password.
- **Rate limiting:** 30/min on register/login, 600/min on the rest of the API.
- **Origin guard:** state-changing requests with a foreign `Origin` are
  rejected in addition to CORS.
- **Helmet** sets standard security headers; `x-powered-by` is disabled.

## Concurrency & ordering

### Optimistic locking

Every task has `version`, incremented on update and move. Clients send the
version they loaded; the write is `UPDATE … WHERE id = ? AND tenant_id = ? AND
version = ?`. Zero affected rows → `409 VERSION_CONFLICT` with `currentTask`.
This avoids lost updates without pessimistic locks.

### Fractional positions

Columns and tasks store a `Float position` with a default gap of 1024. A move
places the task at the midpoint of its new neighbours (`(prev + next) / 2`).
When the midpoint is too close to a neighbour, only that destination column is
re-spaced to `(i + 1) * 1024` inside the same transaction. Common-case moves
touch one row; pathological repeated inserts are repaired locally.

### Undo/redo

The client keeps a 50-entry stack of moves. Undo replays the inverse move
through the normal API using the task's latest version, so it cannot corrupt
ordering and participates in the same conflict handling.

## Realtime design

- Socket.IO rooms: `tenant:<id>` for business events, `user:<id>` for direct
  notices.
- The server is the only broadcaster. REST writes persist first, then emit.
- Presence is a map of `tenantId → userId → { connections, lastSeen }`.
  Multiple tabs increment a counter; a user goes offline only at zero.
- Clients do not merge event payloads into local arrays. They invalidate
  TanStack Query keys (`["boards"]`, `["board"]`, `["activity"]`, …) and refetch.
  This trades a little bandwidth for guaranteed consistency.
- On reconnect the client re-joins the room and invalidates everything, which
  covers events missed while offline.

## AI assistant

The Node API is the trust boundary. It:

1. authenticates the user and resolves the tenant;
2. builds a snapshot of that tenant's boards, columns, tasks and last 30
   activity entries;
3. POSTs `{ question, context }` to the Python service with a shared
   `x-service-token`.

The Python service has two modes:

- **Deterministic (default):** keyword routing over read-only tools (overdue,
  workload, column distribution, priority mix, unassigned, recent activity,
  search, summary). Every number comes from the snapshot, so answers are
  auditable and work offline.
- **Optional LLM:** any OpenAI-compatible endpoint, prompted to use only the
  supplied data. Provider errors fall back to deterministic mode.

No database credentials reach Python, and the service exposes no write endpoint.

## Frontend structure

```
src/
├── app/
│   ├── login, register
│   ├── (app)/dashboard        stats, board grid, activity, branches
│   ├── (app)/boards/[boardId] Kanban, drag & drop, conflicts
│   ├── (app)/activity         filterable audit feed
│   ├── (app)/members          role management
│   └── (app)/assistant        AI chat
├── components/
│   ├── app-shell.tsx          org/tenant switchers, sidebar, presence
│   ├── board/*                columns, cards, drawer, dialogs
│   └── ui/*                   button, input, modal, menu, feedback
├── context/                   auth, workspace, socket
├── hooks/                     TanStack Query data hooks, undo/redo
└── lib/                       Axios client, types, helpers
```

The workspace context persists the selected organization/tenant in
`localStorage`, validates it against the server on load, and drives both the
`X-Tenant-Id` header and the socket room.

## Trade-offs and known limits

| Decision | Benefit | Cost |
| --- | --- | --- |
| Shared schema, app-enforced tenancy | Simple migrations, cross-branch reporting | A missing `tenant_id` filter is a bug, not a database error. Mitigated by denormalization, code review and isolation tests. |
| Query invalidation instead of event patching | Always consistent, less client state | Extra refetches; not ideal for very high event rates. |
| Fractional float positions | O(1) common-case moves | Float precision eventually requires local rebalancing. |
| JWT access cookie + DB refresh token | Stateless reads, revocable sessions | Two cookies and a refresh round-trip. |
| No Redis adapter | Zero extra infrastructure for the assignment | Single Node instance; multi-instance needs Redis. |
| AI is a separate service | No DB credentials in Python, easy to disable | One more process; snapshot size grows with tenant data (tasks are capped at 120 per board in the prompt). |
| No soft deletes | Simple model, audit still records deletions | Restoring a deleted board/task is manual. |
| Tailwind v4 + Next 16 | Modern stack, fast builds | Bleeding-edge versions; pinned in `package.json`. |

## Security checklist

- httpOnly cookies (no tokens in `localStorage`)
- bcrypt password hashing, generic login errors
- refresh-token rotation with reuse detection
- strict CORS allow-list + origin guard
- Helmet headers, request body limit 1 MB
- Zod validation on every mutating route
- tenant + role checks on every scoped route and socket join
- no `tenant_id` from the request body; it always comes from the resolved tenant
- AI service protected by a shared token and no database access

## Testing strategy

- **Unit/integration (backend):** Vitest + Supertest against a real PostgreSQL
  database, covering auth, tenant isolation, RBAC, ordering, conflicts and
  activity.
- **AI service:** pytest covers tool routing, aggregation and the HTTP contract.
- **Frontend:** `tsc --noEmit`, ESLint and `next build` in CI; manual browser
  flows for drag-and-drop, conflicts, presence and reconnect.
- See [`test-report.md`](./test-report.md) for the latest results.

## Running everything

```powershell
# terminal 1 — database (once)
#   create role + database, then: cd backend; npx.cmd prisma migrate dev; npm.cmd run db:seed

# terminal 2 — API + sockets
cd backend; npm.cmd run dev

# terminal 3 — frontend
cd frontend; npm.cmd run dev

# terminal 4 — assistant (optional)
cd ai-service; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Open <http://localhost:3000> and sign in with `rahul@abctech.dev` /
`Password123!`.
