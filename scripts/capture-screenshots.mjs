#!/usr/bin/env node
/**
 * Captures the README screenshots from a running app (frontend on :3000).
 *
 *   node scripts/capture-screenshots.mjs
 *
 * Uses the locally installed Chrome/Edge via puppeteer-core, so no browser
 * download is required. Output: screenshots/*.png
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const outDir = resolve(repoRoot, 'screenshots');
const base = process.env.APP_URL ?? 'http://localhost:3000';

const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = candidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  console.error('No Chrome or Edge installation found.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
page.setDefaultTimeout(25_000);

let step = 0;
async function shot(name) {
  step += 1;
  const file = resolve(outDir, `${String(step).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`âœ“ ${file}`);
}

async function clickText(text, selector = 'button, a') {
  const clicked = await page.evaluate(
    (needle, scope) => {
      const node = [...document.querySelectorAll(scope)].find((element) =>
        element.textContent?.trim().toLowerCase().includes(needle.toLowerCase()),
      );
      if (!node) return false;
      node.click();
      return true;
    },
    text,
    selector,
  );
  if (!clicked) throw new Error(`No ${selector} containing "${text}"`);
}

try {
  // 1. Login
  await page.goto(`${base}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await shot('login');

  // The form ships pre-filled with the demo credentials, so select-all first.
  for (const [selector, value] of [
    ['input[type="email"]', 'rahul@abctech.dev'],
    ['input[type="password"]', 'Password123!'],
  ]) {
    await page.focus(selector);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(selector, value, { delay: 5 });
  }
  const credentialsOk = await page.evaluate(() => document.querySelector('form')?.checkValidity());
  if (!credentialsOk) throw new Error('Login form is not valid after filling credentials');
  await page.click('form button[type="submit"]');
  try {
    await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 15_000 });
  } catch {
    // Fallback: submit the form directly if the button click was swallowed.
    await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 20_000 });
  }
  await page.waitForSelector('a[href^="/boards/"]');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '*{transition:none!important;animation:none!important}';
    document.head.appendChild(style);
  });
  await shot('dashboard');

  // 2. Board
  const boardName = await page.$eval('a[href^="/boards/"] h3', (node) => node.textContent?.trim() ?? 'Board');
  await page.click('a[href^="/boards/"]');
  await page.waitForFunction(() => location.pathname.startsWith('/boards/'));
  await page.waitForFunction(() => document.body.innerText.includes('Columns'), { timeout: 30_000 });
  await page
    .waitForFunction(
      () => [...document.querySelectorAll('[role="button"]')].some((el) => /v\d+/.test(el.textContent ?? '')),
      { timeout: 15_000 },
    )
    .catch(() => null);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '*{transition:none!important;animation:none!important}';
    document.head.appendChild(style);
  });
  await shot('board');

  // 3. Task drawer
  const opened = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[role="button"]')].find((el) => /v\d+/.test(el.textContent ?? ''));
    if (!card) return false;
    card.click();
    return true;
  });
  if (opened) {
    await page.waitForSelector('[aria-label="Close task"]');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    await shot('task-drawer');
    await page.click('[aria-label="Close task"]');
  } else {
    console.warn('! No task card found; skipped task-drawer screenshot');
  }

  // 4. Activity
  await page.goto(`${base}/activity`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('Activity log'));
  await shot('activity');

  // 5. Assistant
  await page.goto(`${base}/assistant`, { waitUntil: 'networkidle2' });
  const ask = 'textarea[placeholder*="Ask a question"]';
  await page.waitForSelector(ask);
  await page.type(ask, 'What is blocked?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('deterministic'), { timeout: 30_000 });
  await shot('assistant');

  console.log(`\nBoard captured: ${boardName}`);
  console.log('Done.');
} finally {
  await browser.close();
}
