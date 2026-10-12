// ACA-US-1.4 end to end on a phone-sized browser: a signed-out visitor is sent to sign-in, gets an email code,
// signs in, reaches the private workspace, signs out, and the old session no longer works.
// Local only: scripts/node-local-qa.sh with QA_TRUST_HEADERS=0, ACADEMY_MAIL_TRANSPORT=outbox, ACADEMY_AUTH_SECRET set.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:8787', email = `learner-${crypto.randomUUID().slice(0, 8)}@example.test`;
const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const browser = await chromium.launch({executablePath: process.env.ACADEMY_CHROME_PATH});
const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
const page = await ctx.newPage(); let checks = 0; const ok = (v, m) => { assert.ok(v, m); checks++; };
try {
  await page.goto(base + '/');
  ok(new URL(page.url()).pathname === '/signin', 'signed-out visitor sent to sign-in: ' + page.url());
  ok((await fetch(base + '/api/academy')).status === 401, 'API refuses without a session');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', {name: 'Email me a code'}).click();
  await page.getByLabel('6-digit code').waitFor();
  const mail = db.prepare('SELECT body FROM academy_mail_outbox WHERE to_address=? ORDER BY id DESC LIMIT 1').get(email);
  const code = mail.body.match(/\b(\d{6})\b/)[1];
  await page.getByLabel('6-digit code').fill(code === '000000' ? '111111' : '000000');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.getByText('That code is wrong or has expired.').waitFor(); checks++;
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(u => new URL(u).pathname === '/');
  const api = await page.evaluate(async () => (await fetch('/api/academy')).status);
  ok(api === 200, 'workspace API works with the session: ' + api);
  const cookie = (await ctx.cookies()).find(c => c.name === 'academy_session');
  ok(cookie && cookie.httpOnly && cookie.sameSite === 'Lax', 'session cookie is HttpOnly and SameSite=Lax');
  ok(!(await page.content()).includes(cookie.value), 'token not in the page');
  const status = await page.evaluate(async () => (await fetch('/signout', {method: 'POST', redirect: 'manual'})).type);
  ok(status === 'opaqueredirect', 'sign-out answers with a redirect');
  const reuse = await fetch(base + '/api/academy', {headers: {cookie: `academy_session=${cookie.value}`}});
  ok(reuse.status === 401, 'old session refused after sign-out: ' + reuse.status);
  console.log(JSON.stringify({checks, passed: true, coverage: ['redirect to sign-in', 'API refuses without session', 'wrong code message', 'code sign-in on 390px phone', 'HttpOnly SameSite cookie', 'server-side sign-out']}));
} finally { await browser.close(); }
