# Test report

**Date:** 1 November 2026
**Result:** ✅ all automated suites pass; manual UI walkthrough completed.

## Environment

| Item | Version |
| --- | --- |
| OS | Windows 11 |
| Node.js | 24.12.0 |
| npm | 11.6.2 |
| PostgreSQL | 18.3 (localhost:5432) |
| Python | 3.14.4 |
| Next.js | 16.4.3 |
| Express | 5.3.0 |
| Prisma | 6.19.3 |
| Socket.IO | 4.x |

## Automated tests

### Backend — `cd backend && npm.cmd test`

Vitest + Supertest against an isolated `kanban_test` PostgreSQL schema.
`global-setup.ts` creates the schema and runs `prisma db push`, so the dev data
is never touched and no `CREATEDB` privilege is required at runtime.

```
Test Files  6 passed (6)
     Tests  28 passed (28)
  Duration  40.09s
exit code 0
```

| File | Coverage |
| --- | --- |
| `tests/auth.test.ts` | register/login, httpOnly cookies, duplicate email, weak password, refresh rotation, reuse detection, logout, profile update |
| `tests/tenancy.test.ts` | mandatory `X-Tenant-Id`, forged/unknown/malformed ids, cross-tenant board ids, org-admin branch access, member isolation, cross-org membership rejection |
| `tests/rbac.test.ts` | members cannot manage boards/columns, delete-own-task rule, tenant-admin limits, member-management endpoints, last-org-admin protection |
| `tests/tasks.test.ts` | fractional ordering, cross-column moves, stale update/move → `409 VERSION_CONFLICT`, tenant-scoped column/assignee validation, overdue/search filters, delete |
| `tests/activity.test.ts` | create/move/update/delete audit entries, board filter, per-task history, cross-tenant feed denial |
| `tests/realtime.test.ts` | Socket.IO auth rejection, server-side tenant room authorization, live `task:created` broadcast, multi-tab presence counts |

### AI service — `cd ai-service && .venv\Scripts\python.exe -m pytest -q`

```
12 passed, 1 warning in 0.51s
```

Covers tool routing, done-column detection, workload aggregation, search,
HTTP contract, service-token enforcement, deterministic answer text, Gemini
provider inference, the Gemini OpenAI-compatibility request (URL, bearer
header, model) and graceful fallback when the provider fails.

### Frontend — `cd frontend`

```
npm.cmd run typecheck   # tsc --noEmit        ✅
npm.cmd run lint        # eslint              ✅
npm.cmd run build       # next build          ✅
```

## Manual walkthrough

Performed with headless Chrome against the running stack
(`npm.cmd run dev` from the repo root). Screenshots are in `screenshots/`.

| Step | Result |
| --- | --- |
| Login as `rahul@abctech.dev` / `Password123!` | ✅ redirects to `/dashboard` |
| Organization/branch switcher | ✅ ABC Technologies → Bangalore, 4 boards |
| Kanban board renders columns and cards | ✅ CRM Development, 4 columns, 3 tasks |
| Task drawer opens with details/history | ✅ `04-task-drawer.png` |
| Activity log | ✅ entries visible with filters (`05-activity.png`) |
| AI assistant | ✅ deterministic answer with tool list (`06-assistant.png`) |
| Health checks | ✅ API `200`, web `200`, AI `200` |

### PostgreSQL MCP

```
npm.cmd run mcp:check
✓ connected to example-servers/postgres 0.1.0
✓ tools: query
✓ read-only query succeeded
[{ "database": "collaborative_kanban", "username": "kanban_app" }]
```

The wrapper now prefers `backend/.env` over an inherited `DATABASE_URL`, so a
stale placeholder exported by a parent process cannot shadow the real
credentials. If `opencode mcp list` still reports the old error, restart the
OpenCode desktop app so it re-spawns the MCP server.

## Defects found and fixed during testing

| Defect | Fix |
| --- | --- |
| Express 5 exposes `req.query` as a getter, so the validation middleware threw `TypeError` on every validated GET (`/api/tasks`, `/api/activity`) | Define an own property on the request that shadows the accessor (`Object.defineProperty`) |
| Validation failures returned `400 BAD_REQUEST` instead of the documented `VALIDATION_ERROR` | `validate.ts` now raises `ApiError(400, 'VALIDATION_ERROR', …)` |
| Tenancy test assumed the first tenant was named "Hyderabad"; new organizations start with "Head Office" | Corrected the test expectation |
| Vitest 4 removed `poolOptions` | Replaced with top-level `maxWorkers`/`minWorkers` |

## Known issues / follow-ups

- `npm audit` reports high-severity advisories in the backend tree and moderate
  ones in the frontend tree. Not reviewed yet; run `npm.cmd audit` in each
  package before deploying.
- Socket.IO rooms are in-process; multi-instance deployments need the Redis
  adapter.
- The OpenCode desktop app caches MCP startup failures until restarted.
- The AI assistant runs in deterministic mode until `GEMINI_API_KEY` is set in
  `ai-service/.env`.
