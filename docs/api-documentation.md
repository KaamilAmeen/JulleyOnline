# API reference

Base URL (direct): `http://localhost:5000/api`
Base URL (through the Next.js proxy): `/api`

All responses use one envelope:

```json
{ "data": { ... } }
```

Errors always look like:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "title", "message": "Title is required" }]
  }
}
```

`details` is optional and only present for validation, conflict and rate-limit
responses.

## Authentication

Auth uses **httpOnly cookies**, not bearer headers:

| Cookie | Path | Lifetime | Purpose |
| --- | --- | --- | --- |
| `kanban_access` | `/` | 15 min | Signed JWT (`sub`, `email`, `name`, `avatarColor`) |
| `kanban_refresh` | `/api/auth` | 7 days | Opaque rotating token, stored SHA-256-hashed in the DB |

The browser never sees or stores a token in JavaScript. Because the Next.js
dev server proxies `/api/*` to Express, cookies remain first-party.

**Refresh flow.** When any API call returns `401`, the frontend calls
`POST /api/auth/refresh` once (concurrent 401s share one promise) and retries the
original request. Refresh tokens rotate on every use. Reusing an already-rotated
token is treated as theft: every active session for that user is revoked.

Credential endpoints are limited to **30 requests/minute per IP**; the rest of
the API allows 600/minute.

### `POST /auth/register`

```json
{ "name": "Ayesha Khan", "email": "ayesha@example.com", "password": "Password123!" }
```

`201` → `{ "data": { "user": {…}, "memberships": [] } }` and sets both cookies.
A new account has no organization until an admin invites it or the user creates
one.

### `POST /auth/login`

```json
{ "email": "rahul@abctech.dev", "password": "Password123!" }
```

`200` → `{ "data": { "user": {…}, "memberships": [{ "id", "role", "organizationId", "tenantId", "organization", "tenant" }] } }`

Unknown email and wrong password return the same `401 Incorrect email or password`.

### `POST /auth/refresh`

No body. Reads `kanban_refresh`, revokes it, issues a new pair. `200` with
`{ user, memberships }`.

### `POST /auth/logout`

Revokes the presented refresh token and clears both cookies. `200`
`{ "data": { "success": true } }`.

### `GET /auth/me`

Returns the current user and all memberships. `401` when the access cookie is
missing/expired (the client then refreshes).

### `PATCH /auth/me`

```json
{ "name": "Rahul S.", "avatarColor": "#6366f1" }
```

## Tenant scoping

Every endpoint below `/organizations` (except list/create) and **every** board,
column, task, activity, AI and presence endpoint requires:

```
X-Tenant-Id: <uuid>
```

The header is validated against the caller's memberships on every request. A
missing header → `400`; a valid UUID the user cannot access → `403`; an unknown
tenant → `404`. The client cannot widen access by changing the header.

## Roles & permissions

| Permission | ORG_ADMIN | TENANT_ADMIN | MEMBER |
| --- | :-: | :-: | :-: |
| Update/delete organization, manage org members | ✅ | — | — |
| Create tenant | ✅ | — | — |
| Update tenant / delete tenant | ✅ | ✅ / — | — |
| Manage tenant members | ✅ | ✅ | — |
| Create/update/delete board | ✅ | ✅ | — |
| Manage columns (create/rename/reorder/delete) | ✅ | ✅ | — |
| Create/update/move task | ✅ | ✅ | ✅ |
| Delete task | ✅ | ✅ | own tasks only |
| Read activity / presence / AI | ✅ | ✅ | ✅ |

An `ORG_ADMIN` membership is organization-wide (`tenant_id = NULL`) and applies
to every tenant in that organization. A `TENANT_ADMIN`/`MEMBER` membership is
scoped to one tenant.

## Organizations

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/organizations` | Organizations the caller belongs to, with visible tenants and counts |
| `POST` | `/organizations` | `{ name }` → creates org + owner membership + `Head Office` tenant + starter board |
| `GET` | `/organizations/:organizationId` | Visible tenants only |
| `PATCH` | `/organizations/:organizationId` | `{ name }` — ORG_ADMIN |
| `DELETE` | `/organizations/:organizationId` | Cascades everything — ORG_ADMIN |
| `GET` | `/organizations/:organizationId/members` | All memberships, including tenant-scoped |
| `POST` | `/organizations/:organizationId/members` | `{ email, role, tenantId? }` — ORG_ADMIN |
| `PATCH` | `/organizations/:organizationId/members/:membershipId` | `{ role }` — ORG_ADMIN |
| `DELETE` | `/organizations/:organizationId/members/:membershipId` | ORG_ADMIN; last org admin protected |
| `POST` | `/organizations/:organizationId/tenants` | `{ name }` → creates tenant + `Getting Started` board |

`GET /organizations` response (trimmed):

```json
{
  "data": [
    {
      "id": "…",
      "name": "ABC Technologies",
      "slug": "abc-technologies",
      "role": "ORG_ADMIN",
      "boardCount": 7,
      "tenants": [
        { "id": "…", "name": "Hyderabad HQ", "slug": "hyderabad-hq", "boardCount": 3, "memberCount": 4 }
      ]
    }
  ]
}
```

Rules for adding a member:

- `ORG_ADMIN` must **not** include `tenantId`.
- `TENANT_ADMIN` / `MEMBER` **must** include a `tenantId` from the same org.
- The target user must already have an account (register first).
- The last remaining org admin cannot be demoted or removed (`409 LAST_ORG_ADMIN`).

## Tenants

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/tenants?organizationId=` | Tenants the caller can see (optional filter) |
| `GET` | `/tenants/:tenantId` | Membership required (header optional; param is used) |
| `PATCH` | `/tenants/:tenantId` | `{ name }` — TENANT_ADMIN/ORG_ADMIN |
| `DELETE` | `/tenants/:tenantId` | ORG_ADMIN only |
| `GET` | `/tenants/:tenantId/members` | TENANT_ADMIN/ORG_ADMIN |
| `GET` | `/tenants/:tenantId/people` | Everyone assignable: tenant members + org admins, de-duplicated with highest role |
| `POST` | `/tenants/:tenantId/members` | `{ email, role: "TENANT_ADMIN"\|"MEMBER" }` |
| `PATCH` | `/tenants/:tenantId/members/:membershipId` | `{ role }` |
| `DELETE` | `/tenants/:tenantId/members/:membershipId` | |

## Boards

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/boards` | Boards in the active tenant, ordered by creation |
| `POST` | `/boards` | `{ name, description?, templateColumns?: string[] }` |
| `GET` | `/boards/:id` | Board + ordered columns + all tasks |
| `PATCH` | `/boards/:id` | `{ name?, description? }` |
| `DELETE` | `/boards/:id` | Cascades columns/tasks |
| `GET` | `/boards/:id/columns` | Columns ordered by `position` |
| `POST` | `/boards/:id/columns` | `{ name }` — appended at the end |

`templateColumns` defaults to `["To Do", "In Progress", "Testing", "Done"]`.

`GET /boards/:id` response (trimmed):

```json
{
  "data": {
    "id": "…",
    "tenantId": "…",
    "name": "Platform Roadmap",
    "description": "Q3 delivery",
    "creator": { "id": "…", "name": "Rahul Sharma", "email": "…", "avatarColor": "#6366f1" },
    "columns": [{ "id": "…", "name": "In Progress", "position": 2048 }],
    "tasks": [
      {
        "id": "…",
        "boardId": "…",
        "columnId": "…",
        "title": "Ship audit log",
        "priority": "URGENT",
        "assignedTo": "…",
        "dueDate": "2026-03-01T00:00:00.000Z",
        "position": 1024,
        "version": 3,
        "assignee": { "id": "…", "name": "Rahul Sharma", "avatarColor": "#6366f1" },
        "creator": { "id": "…", "name": "Priya Nair", "avatarColor": "#ec4899" }
      }
    ]
  }
}
```

## Columns

| Method | Path | Notes |
| --- | --- | --- |
| `PATCH` | `/columns/:id` | `{ name }` |
| `DELETE` | `/columns/:id` | `409 COLUMN_NOT_EMPTY` if it still holds tasks |
| `POST` | `/columns/reorder` | `{ boardId, orderedIds: [uuid, …] }` |

All column mutations require `column:manage` (ORG_ADMIN or TENANT_ADMIN).

## Tasks

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/tasks` | Filters: `boardId`, `columnId`, `assignedTo`, `search`, `overdue=true`, `limit` (1–500, default 200) |
| `POST` | `/tasks` | `{ boardId, columnId, title, description?, priority?, assignedTo?, dueDate? }` |
| `GET` | `/tasks/:id` | |
| `GET` | `/tasks/:id/activity` | Last 50 events for the task |
| `PATCH` | `/tasks/:id` | Any editable field **plus `version`** |
| `PATCH` | `/tasks/:id/move` | `{ columnId, index, version }` |
| `DELETE` | `/tasks/:id` | Members only for their own tasks |

### Create

```json
{
  "boardId": "9f1c…",
  "columnId": "6a2d…",
  "title": "Ship audit log",
  "description": "Include tenant id on every row.",
  "priority": "URGENT",
  "assignedTo": "1b7e…",
  "dueDate": "2026-03-01T00:00:00.000Z"
}
```

The column must belong to the board **and** the tenant; the assignee must be a
tenant member or org admin. Both checks return `400` otherwise.

### Update (optimistic lock)

```json
{ "title": "Ship audit log v2", "priority": "HIGH", "version": 3 }
```

- `200` → the updated task with `version: 4`.
- `409` → someone else already wrote:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This task changed since you loaded it. Review the latest version and try again.",
    "details": { "currentTask": { "…": "latest server state" } }
  }
}
```

The UI shows the server version next to the user's draft and lets them keep
theirs (retry with the new version) or take the server copy.

### Move (drag & drop)

```json
{ "columnId": "target-column-uuid", "index": 2, "version": 4 }
```

`index` is the zero-based destination slot **excluding** the moved task.
`position` is computed as the midpoint of its new neighbours; if the gap is too
small the destination column is re-spaced in the same transaction. Response is
the moved task with an incremented `version`.

### Task object

```json
{
  "id": "uuid",
  "boardId": "uuid",
  "columnId": "uuid",
  "tenantId": "uuid",
  "title": "string",
  "description": "string|null",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "assignedTo": "uuid|null",
  "dueDate": "ISO-8601|null",
  "position": 1024,
  "version": 1,
  "createdBy": "uuid",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "assignee": { "id", "name", "email", "avatarColor" } | null,
  "creator": { "id", "name", "email", "avatarColor" }
}
```

## Activity

### `GET /activity`

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | int 1–200 | 50 | |
| `entityType` | string | — | `task`, `board`, `column`, `member`, `tenant`, `organization` |
| `entityId` | uuid | — | e.g. one task's history |
| `userId` | uuid | — | Filter by actor |
| `boardId` | uuid | — | Only events whose details reference the board |

```json
{
  "data": [
    {
      "id": "…",
      "tenantId": "…",
      "organizationId": "…",
      "userId": "…",
      "entityType": "task",
      "entityId": "…",
      "action": "MOVED",
      "details": { "title": "Ship audit log", "fromColumnId": "…", "toColumnId": "…", "index": 0 },
      "createdAt": "2026-03-10T09:12:00.000Z",
      "user": { "id": "…", "name": "Rahul Sharma", "email": "…", "avatarColor": "#6366f1" }
    }
  ]
}
```

### `GET /presence`

Returns the current tenant presence list (also delivered over WebSockets):

```json
{
  "data": [
    { "userId": "…", "name": "Rahul Sharma", "email": "…", "avatarColor": "#6366f1", "connections": 2, "lastSeen": "ISO-8601" }
  ]
}
```

## AI assistant

### `POST /ai/assistant`

```json
{ "question": "What is overdue in this branch?" }
```

Requires `activity:read`. The Node API builds a tenant-scoped snapshot and
forwards it to the Python service. Response:

```json
{
  "data": {
    "answer": "Overdue tasks (1):\n• Ship audit log — Rahul Sharma, due 2026-03-01 (In Progress)",
    "toolsUsed": ["overdue_tasks"],
    "provider": "deterministic",
    "model": null,
    "generatedAt": "2026-03-10T09:15:00.000Z"
  }
}
```

If the Python service is down: `503 AI_SERVICE_UNAVAILABLE`. If it rejects the
shared token or errors: `502 AI_SERVICE_ERROR`.

## Health

`GET /api/health` (no auth) →

```json
{ "data": { "status": "ok", "service": "kanban-api", "uptimeSeconds": 42, "timestamp": "…" } }
```

## Error codes

| Status | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Missing/invalid `X-Tenant-Id`, bad relationship, bad assignee |
| 400 | `VALIDATION_ERROR` | Zod schema failure (`details` lists fields) |
| 401 | `UNAUTHORIZED` | No/expired access token, bad refresh token, bad credentials |
| 403 | `FORBIDDEN` | Not a member, wrong role, CORS origin denied |
| 404 | `NOT_FOUND` | Unknown route or resource in this tenant |
| 409 | `VERSION_CONFLICT` | Stale `version` on task update/move |
| 409 | `DUPLICATE` / `MEMBERSHIP_EXISTS` / `LAST_ORG_ADMIN` / `COLUMN_NOT_EMPTY` | Business conflicts |
| 429 | `TOO_MANY_REQUESTS` | Rate limit |
| 500 | `INTERNAL_ERROR` | Unhandled server error |
| 502/503 | `AI_SERVICE_ERROR` / `AI_SERVICE_UNAVAILABLE` | Assistant upstream failure |

## cURL quick start

```bash
# 1. Sign in and keep the cookies
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"rahul@abctech.dev","password":"Password123!"}'

# 2. Pick a tenant from /auth/me, then use it on every call
curl -b cookies.txt http://localhost:5000/api/auth/me
curl -b cookies.txt http://localhost:5000/api/boards -H 'X-Tenant-Id: <tenant-uuid>'
```

A ready-to-import Postman collection is at
[`postman_collection.json`](./postman_collection.json).
