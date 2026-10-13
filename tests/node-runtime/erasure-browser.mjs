// ACA-US-6.4 end to end: a learner signs in, saves practice work, deletes their data, and nothing about them
// remains; signing in again starts an empty account. Local only (QA_TRUST_HEADERS=0, outbox mail).
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:8787',
  email = `erase-${crypto.randomUUID().slice(0, 8)}@example.test`;
const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const browser = await chromium.launch({ executablePath: process.env.ACADEMY_CHROME_PATH });
let checks = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(base + '/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor();
  const code = db
    .prepare('SELECT body FROM academy_mail_outbox WHERE to_address=? ORDER BY id DESC LIMIT 1')
    .get(email)
    .body.match(/\b(\d{6})\b/)[1];
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => ['/', '/loop'].includes(new URL(u).pathname));
  return page;
}
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await signIn(ctx);
  const userId = db.prepare('SELECT id FROM academy_users WHERE email=?').get(email).id;
  const saved = await page.evaluate(async () => {
    const g = await (await fetch('/api/academy')).json();
    const r = await fetch('/api/academy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: { type: 'enroll', programId: g.programs[0].id },
        revision: g.revision,
        actionId: crypto.randomUUID(),
      }),
    });
    return r.status;
  });
  ok(saved === 200, 'practice work saved: ' + saved);
  ok(
    db.prepare('SELECT count(*) n FROM academy_workspaces WHERE owner=?').get(userId).n === 1,
    'workspace stored',
  );
  await page.goto(base + '/account');
  await page.getByLabel('Type DELETE MY DATA to confirm').fill('DELETE MY DATA');
  await page.getByRole('button', { name: 'Delete my data permanently' }).click();
  await page.getByRole('heading', { name: 'Your data is deleted' }).waitFor();
  checks++;
  for (const [table, col, val] of [
    ['academy_users', 'id', userId],
    ['academy_workspaces', 'owner', userId],
    ['academy_audit', 'owner', userId],
    ['academy_sessions', 'user_id', userId],
    ['academy_mail_outbox', 'to_address', email],
  ])
    ok(
      db.prepare(`SELECT count(*) n FROM ${table} WHERE ${col}=?`).get(val).n === 0,
      table + ' emptied for this person',
    );
  ok(db.prepare('SELECT count(*) n FROM academy_erasures').get().n === 1, 'erasure counted without identity');
  ok(
    (await page.evaluate(async () => (await fetch('/api/academy')).status)) === 401,
    'signed out after deletion',
  );
  const page2 = await signIn(await browser.newContext());
  const fresh = await page2.evaluate(
    async () => (await (await fetch('/api/academy')).json()).state.enrollments.length,
  );
  ok(fresh === 0, 'signing in again starts an empty account');
  console.log(JSON.stringify({ checks, passed: true }));
} finally {
  await browser.close();
}
