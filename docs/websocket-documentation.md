# WebSocket reference (Socket.IO)

Realtime updates use **Socket.IO v4** on the same Express server as the REST API
(`http://localhost:5000`). The browser connects directly; Next.js only proxies
HTTP, not WebSockets.

The server is authoritative: clients never broadcast their own mutations.
Every REST write is persisted first, then fanned out to the tenant room. This
keeps HTTP and WebSocket state consistent and prevents a client from spoofing
another user's activity.

## Connecting

```ts
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000", {
  withCredentials: true,                       // sends kanban_access cookie
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
});
```

### Authentication

The handshake middleware accepts either:

1. the `kanban_access` httpOnly cookie (browser default), or
2. `auth: { token: "<access-jwt>" }` for non-browser clients.

The JWT is verified and the user is loaded from the database. Failure closes the
connection with `Error("UNAUTHORIZED")`, which the client receives as
`connect_error`. A socket is **not** automatically a member of any tenant room.

### Joining a tenant

```ts
socket.emit("tenant:join", { tenantId }, (ack) => {
  if (!ack.ok) {
    // ack.error: INVALID_TENANT | TENANT_NOT_FOUND | FORBIDDEN | INTERNAL_ERROR
  }
});
```

Ack on success:

```json
{
  "ok": true,
  "tenantId": "uuid",
  "role": "MEMBER",
  "presence": [
    { "userId": "uuid", "name": "Rahul Sharma", "email": "…", "avatarColor": "#6366f1", "connections": 1, "lastSeen": "ISO-8601" }
  ]
}
```

The server verifies membership before joining `tenant:<id>` — the client cannot
join an arbitrary room. Joining a new tenant automatically leaves the previous
one and updates presence in both rooms.

### Leaving / heartbeat

```ts
socket.emit("tenant:leave", { tenantId }, (ack) => { /* { ok, tenantId } */ });
socket.emit("presence:heartbeat", (ack) => { /* { ok: true } */ });
```

`presence:heartbeat` refreshes `lastSeen`; the UI sends it periodically while the
tab is open. Disconnects remove the socket's connection count automatically.

## Server → client events

All business events are emitted **only** to the tenant room, so a socket in
tenant A never receives tenant B data.

| Event | Payload |
| --- | --- |
| `task:created` | Full task (same shape as REST, with `assignee`, `creator`) |
| `task:updated` | Full updated task (new `version`) |
| `task:moved` | `{ task, fromColumnId, toColumnId }` |
| `task:deleted` | `{ taskId, boardId, columnId }` |
| `board:created` | Board with `creator`, `columns`, `tasks` |
| `board:updated` | Board with `creator`, `columns`, `_count` |
| `board:deleted` | `{ boardId }` |
| `column:created` | Column row |
| `column:updated` | Column row |
| `column:deleted` | `{ columnId, boardId }` |
| `column:reordered` | `{ boardId, orderedIds }` |
| `activity:created` | Activity log row with `user` |
| `presence:update` | `{ tenantId, users: PresenceUser[] }` |
| `presence:online` | `{ tenantId, user: { userId, name, avatarColor } }` |
| `presence:offline` | `{ tenantId, userId }` |

`PresenceUser`:

```json
{
  "userId": "uuid",
  "name": "Priya Nair",
  "email": "priya@abctech.dev",
  "avatarColor": "#ec4899",
  "connections": 2,
  "lastSeen": "2026-03-10T09:20:00.000Z"
}
```

`connections` counts open tabs/devices. A user only goes offline when the count
reaches zero, so closing one of two tabs does not make the avatar disappear.

## How the frontend consumes events

`frontend/src/context/socket-context.tsx` invalidates TanStack Query caches
instead of patching arrays by hand:

- `task:*`, `board:*`, `column:*` → invalidate `["boards"]` and `["board"]`
- `activity:created` → invalidate `["activity"]` and `["task-activity"]`
- `presence:update` → replace the presence list
- `presence:offline` → invalidate `["presence"]`

Invalidation refetches authoritative server state, so optimistic UI is always
reconciled with the database rather than trusting event payload ordering.

## Optimistic moves & conflicts

Drag-and-drop updates the card position immediately, then calls
`PATCH /tasks/:id/move` with the task's `version`.

- `200` → the server event `task:moved` arrives and the board refetches.
- `409 VERSION_CONFLICT` → the UI opens the conflict dialog with
  `error.details.currentTask`; the user can keep their move (retry with the new
  version) or accept the server state.

Undo/redo replays the same move endpoint with the latest version, so it obeys
the same rules.

## Reconnection & network recovery

Socket.IO reconnects automatically with backoff. On every `connect`:

1. the client re-emits `tenant:join` with the selected tenant (server re-checks
   membership);
2. `["boards"]`, `["board"]`, `["activity"]` and `["presence"]` queries are
   invalidated, pulling fresh state;
3. presence is replaced with the server's list.

The REST client independently retries once after a `401` by refreshing the
session, so a rotated access cookie does not break the UI.

## Scaling note

Rooms are in-process. A single Node instance needs no extra infrastructure; to
run several instances behind a load balancer, add the
`@socket.io/redis-adapter` and publish events through Redis. The event contract
and room names (`tenant:<id>`, `user:<id>`) stay the same.

## Manual test with `wscat`-style client

```js
// node scripts/socket-smoke.mjs
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: process.env.ACCESS_TOKEN },
});

socket.on("connect", () => {
  socket.emit("tenant:join", { tenantId: process.env.TENANT_ID }, (ack) => {
    console.log("join", ack);
  });
});

for (const event of ["task:created", "task:moved", "activity:created", "presence:update"]) {
  socket.on(event, (payload) => console.log(event, payload));
}
```
