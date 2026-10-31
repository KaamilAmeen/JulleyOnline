import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(root, '.env') });

/**
 * Integration tests run against an isolated PostgreSQL schema in the same
 * database, so `prisma db push` does not need CREATEDB privileges and the dev
 * data is never touched.
 */
function testDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const url = new URL(base);
  url.searchParams.set('schema', 'kanban_test');
  return url.toString();
}

const databaseUrl = testDatabaseUrl();

if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-16-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-16-chars';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // One database schema means test files must not interleave truncations.
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    },
  },
});
