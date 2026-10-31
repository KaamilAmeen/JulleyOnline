import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * Prepares the isolated `kanban_test` schema once per `vitest run`.
 * `prisma db push` is idempotent, so reruns are cheap.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill in the PostgreSQL password.',
    );
  }
  if (databaseUrl.includes('CHANGE_ME')) {
    throw new Error('backend/.env still contains the CHANGE_ME database password.');
  }

  const schema = new URL(databaseUrl).searchParams.get('schema') ?? 'kanban_test';

  // Create the schema before Prisma introspects it.
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await client.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema.replace(/"/g, '""')}"`);
  } finally {
    await client.$disconnect();
  }

  const prismaBin = require.resolve('prisma/build/index.js');
  execFileSync(
    process.execPath,
    [prismaBin, 'db', 'push', '--skip-generate', '--accept-data-loss'],
    {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );
}
