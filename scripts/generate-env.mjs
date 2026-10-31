// Generates backend/.env with strong random JWT secrets.
// Usage: node scripts/generate-env.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'backend', '.env');
const example = path.join(process.cwd(), 'backend', '.env.example');

if (fs.existsSync(target)) {
  console.log('backend/.env already exists — leaving it untouched.');
  process.exit(0);
}

const template = fs.readFileSync(example, 'utf8');
const content = template
  .replace('replace-with-a-random-32-byte-hex-secret', crypto.randomBytes(32).toString('hex'))
  .replace('replace-with-a-different-random-32-byte-hex-secret', crypto.randomBytes(32).toString('hex'))
  .replace('dev-ai-service-token-change-me', crypto.randomBytes(24).toString('hex'));

fs.writeFileSync(target, content);
console.log('Created backend/.env — set DATABASE_URL before running migrations.');
