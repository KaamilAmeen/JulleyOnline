#!/usr/bin/env node
/**
 * Smoke test for the PostgreSQL MCP server.
 *
 * Spawns scripts/postgres-mcp.mjs exactly as OpenCode does, performs the MCP
 * handshake over stdio, lists tools and runs one read-only query.
 *
 * Usage: npm.cmd run mcp:check
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const wrapper = resolve(here, 'postgres-mcp.mjs');

const child = spawn(process.execPath, [wrapper], {
  cwd: resolve(here, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
let stderr = '';
const pending = new Map();
let finished = false;

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(id, method, params) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 15_000);
    pending.set(id, { resolve: resolvePromise, reject, timer });
    send({ jsonrpc: '2.0', id, method, params });
  });
}

function handleLine(line) {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id);
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message ?? 'MCP error'));
    else entry.resolve(message.result);
  }
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? '';
  for (const line of lines) handleLine(line);
});

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8');
});

child.on('exit', (code) => {
  if (finished) return;
  finished = true;
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error(`MCP server exited with code ${code}`));
  }
  if (code !== 0) {
    console.error(stderr.trim() || `MCP server exited with code ${code}`);
    process.exit(1);
  }
});

function finish(code) {
  finished = true;
  child.stdin.end();
  child.kill();
  process.exit(code);
}

try {
  const init = await request(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'julleyonline-mcp-check', version: '1.0.0' },
  });
  console.log(`✓ connected to ${init.serverInfo?.name ?? 'MCP server'} ${init.serverInfo?.version ?? ''}`.trim());

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const tools = await request(2, 'tools/list', {});
  const names = (tools.tools ?? []).map((tool) => tool.name);
  console.log(`✓ tools: ${names.join(', ') || '(none)'}`);

  const result = await request(3, 'tools/call', {
    name: 'query',
    arguments: { sql: 'select current_database() as database, current_user as username' },
  });
  const text = result.content?.map((part) => part.text).filter(Boolean).join('\n') ?? '';
  console.log('✓ read-only query succeeded');
  console.log(text);
  finish(0);
} catch (error) {
  console.error(`✗ ${error.message}`);
  if (stderr.trim()) console.error(stderr.trim());
  finish(1);
}
