# PostgreSQL MCP server for OpenCode

This repo ships a project-local [Model Context Protocol](https://modelcontextprotocol.io)
server that lets an OpenCode agent inspect the JulleyOnline PostgreSQL schema
and run **read-only** SQL. Configuration lives in
[`../opencode.jsonc`](../opencode.jsonc).

## What was configured

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "postgres": {
        "type": "local",
        "command": ["node", "scripts/postgres-mcp.mjs"],
        "cwd": ".",
        "timeout": { "startup": 20000, "catalog": 20000 }
      }
    }
  }
}
```

OpenCode V2 reads MCP servers from `mcp.servers` (not directly under `mcp`).
The `postgres` server is started as a local stdio process from the repository
root. OpenCode reloads configuration automatically after a save.

### Why a wrapper?

`scripts/postgres-mcp.mjs` exists so that:

1. **No credentials are committed.** The wrapper reads `DATABASE_URL` from
   `backend/.env` (git-ignored) when it is not already in the environment.
   `opencode.jsonc` contains no password.
2. **Failures are legible.** If the placeholder password is still present, it
   exits with a clear message instead of a silent MCP handshake failure.
3. **Read-only is enforced twice.** The upstream server wraps every query in a
   `READ ONLY` transaction; the wrapper additionally appends
   `options=-c default_transaction_read_only=on` to the session, so even a
   future server change cannot write.
4. **Startup is fast and offline.** The package is pinned in the root
   `package.json` and resolved locally, rather than downloaded by `npx` on every
   connection.

## Setup

```powershell
# 1. Install the pinned MCP server (repo root)
npm.cmd install

# 2. Make sure backend/.env has a real DATABASE_URL
#    DATABASE_URL="postgresql://kanban_app:your-password@localhost:5432/collaborative_kanban?schema=public"

# 3. Verify the server end-to-end
npm.cmd run mcp:check

# 4. Ask OpenCode for the connection state
opencode mcp list
```

Expected output from the check:

```text
✓ connected to postgres 0.6.2
✓ tools: query
✓ read-only query succeeded
[{"database":"collaborative_kanban","username":"kanban_app"}]
```

`opencode mcp list` should report `postgres` as connected. If it reports an
error, run `npm.cmd run mcp:check` first — it surfaces the wrapper's stderr.

## Using it in a session

Once connected, the tool appears as `postgres_query` (Code Mode groups it under
`tools.postgres.query`). Example prompts:

- "List the tables and their row counts."
- "Show the indexes on `tasks`."
- "Explain the tenant isolation columns."
- "Which boards have no tasks?"

The server also exposes table schemas as MCP resources.

## Security notes

- The MCP server is read-only, but it connects with `kanban_app`, which owns the
  schema. For a stricter setup, create a dedicated login with `CONNECT` +
  `USAGE` and `SELECT` only:

  ```sql
  CREATE ROLE kanban_ro WITH LOGIN PASSWORD 'another-strong-password';
  GRANT CONNECT ON DATABASE collaborative_kanban TO kanban_ro;
  GRANT USAGE ON SCHEMA public TO kanban_ro;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO kanban_ro;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kanban_ro;
  ```

  Then point a separate MCP entry (e.g. `postgres_ro`) at that URL. Keep the
  application's write credentials out of MCP entirely.
- The wrapper never logs the connection string.
- `backend/.env` is excluded by `.gitignore`; only `.env.example` is committed.
- Do not add `DATABASE_URL` to `opencode.jsonc` — use `{env:DATABASE_URL}` if you
  prefer an environment variable:

  ```jsonc
  "environment": { "DATABASE_URL": "{env:DATABASE_URL}" }
  ```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `backend/.env still contains the placeholder password` | `DATABASE_URL` not updated | Set the real password in `backend/.env` |
| `@modelcontextprotocol/server-postgres is not installed` | Root dependencies missing | `npm.cmd install` at the repo root |
| `password authentication failed` | Wrong DB password / role | Test with `psql "postgresql://…"` |
| `ECONNREFUSED` | PostgreSQL not running | Start the service; check port 5432 |
| `opencode mcp list` shows failed | Wrapper exits before handshake | Run `npm.cmd run mcp:check` for the real error |
| Tools missing in a session | Server still starting / disabled | Run `/mcps` in OpenCode, or `/reload` |

> Note: `@modelcontextprotocol/server-postgres` is archived upstream but remains
> the simplest read-only PostgreSQL MCP server. If you prefer a maintained
> alternative, `@bytebase/dbhub` or `postgres-mcp` can be substituted; only the
> `command` array in `opencode.jsonc` changes.
