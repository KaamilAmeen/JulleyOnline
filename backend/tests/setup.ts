import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';

const TABLES = [
  'refresh_tokens',
  'activity_logs',
  'tasks',
  'columns',
  'boards',
  'memberships',
  'tenants',
  'organizations',
  'users',
];

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // CASCADE handles any FK ordering; RESTART IDENTITY keeps sequences stable.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
