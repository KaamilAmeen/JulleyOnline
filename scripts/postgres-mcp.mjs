#!/usr/bin/env node
/**
 * PostgreSQL MCP launcher for OpenCode.
 *
 * Why a wrapper instead of putting the connection string in opencode.jsonc?
 *  - the password stays in backend/.env (git-ignored), never in committed config;
 *  - OpenCode inherits no DATABASE_URL, so we resolve it here;
 *  - we can refuse to start without a usable URL and print a clear message
 *    instead of a cryptic MCP handshake failure.
 *
 * The underlying @modelcontextprotocol/server-postgres already wraps every
 * query in a READ ONLY transaction. We additionally set `default_transaction_read_only`
 * at the session level as defence in depth.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const envPath = resolve(repoRoot, 'backend', '.env');

/** Minimal dotenv parser: KEY=VALUE, optional quotes, ignores comments. */
function readEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function isUsable(url) {
  return Boolean(url) && !url.includes('CHANGE_ME');
}

function redact(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<unparseable>';
  }
}

/**
 * Resolution order:
 *  1. backend/.env — the documented, git-ignored source of truth;
 *  2. the inherited DATABASE_URL, for CI or a shell override.
 *
 * The file wins so a stale placeholder exported by the desktop app's parent
 * process cannot shadow the real credentials.
 */
function resolveDatabaseUrl() {
  const fileUrl = existsSync(envPath) ? readEnvFile(envPath).DATABASE_URL : undefined;
  if (isUsable(fileUrl)) return { url: fileUrl, source: 'backend/.env' };

  if (isUsable(process.env.DATABASE_URL)) {
    return { url: process.env.DATABASE_URL, source: 'environment' };
  }

  if (!existsSync(envPath)) {
    console.error(
      `[postgres-mcp] No DATABASE_URL in the environment and ${envPath} does not exist.\n` +
        'Copy backend/.env.example to backend/.env and set DATABASE_URL.',
    );
    process.exit(1);
  }

  console.error(
    '[postgres-mcp] backend/.env still contains the placeholder password.\n' +
      'Set DATABASE_URL in backend/.env to your real PostgreSQL connection string.',
  );
  process.exit(1);
}

function withReadOnlySession(rawUrl) {
  try {
    const url = new URL(rawUrl);
    // Session-level guard. The MCP server also uses READ ONLY transactions.
    url.searchParams.set('options', '-c default_transaction_read_only=on');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function resolveServerEntry() {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('@modelcontextprotocol/server-postgres/dist/index.js');
  } catch {
    return null;
  }
}

const resolved = resolveDatabaseUrl();

// `node scripts/postgres-mcp.mjs --check` prints the resolved config (redacted)
// without starting the MCP server. Handy when OpenCode reports a startup error.
if (process.argv.includes('--check')) {
  console.log(`[postgres-mcp] source: ${resolved.source}`);
  console.log(`[postgres-mcp] url: ${redact(resolved.url)}`);
  process.exit(0);
}

const databaseUrl = withReadOnlySession(resolved.url);
const serverEntry = resolveServerEntry();

if (!serverEntry) {
  console.error(
    '[postgres-mcp] @modelcontextprotocol/server-postgres is not installed.\n' +
      'Run `npm.cmd install` in the repository root, then try again.',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [serverEntry, databaseUrl], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

child.on('error', (error) => {
  console.error('[postgres-mcp] Failed to start:', error.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
