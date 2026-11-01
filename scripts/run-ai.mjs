#!/usr/bin/env node
/**
 * Starts the FastAPI assistant with the project virtualenv.
 *
 * Used by `npm run dev` at the repo root so the AI service always runs with
 * `ai-service` as its working directory (needed for `load_dotenv()`).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const serviceDir = resolve(repoRoot, 'ai-service');
const python =
  process.platform === 'win32'
    ? resolve(serviceDir, '.venv', 'Scripts', 'python.exe')
    : resolve(serviceDir, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.error(
    '[ai] Python virtualenv not found at ai-service/.venv.\n' +
      'Create it first:\n' +
      '  cd ai-service\n' +
      '  py -m venv .venv\n' +
      '  .venv\\Scripts\\python.exe -m pip install -r requirements.txt',
  );
  process.exit(1);
}

const host = process.env.AI_HOST ?? '127.0.0.1';
const port = process.env.AI_PORT ?? '8000';

const child = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--host', host, '--port', port],
  { cwd: serviceDir, stdio: 'inherit', env: process.env },
);

child.on('error', (error) => {
  console.error('[ai] Failed to start:', error.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
