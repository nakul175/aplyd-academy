// Deep browser test in production parity (local only, synthetic people). Unlike browser-r1-journey.mjs, nothing is
// seeded by hand: decisions and the notice come from scripts/seed-decisions.mjs and the owner role from
// scripts/loop-admin.mjs, exactly as on the server; no evaluation run is faked, so the AI coach is in its real
// "not yet tested" state. One person (the owner) runs the pilot alone, as Nakul will: he names himself as the
// association admin. Then every reachable page is crawled for each role, recording HTTP errors, console errors,
// uncaught page errors and error text on the page, with a screenshot of each page.
// Run: scripts/node-local-qa.sh tests/loop/browser-prod-parity.mjs (QA_TRUST_HEADERS=0, outbox mail, fake AI).
// Output: $QA_OUT/report.json and $QA_OUT/shots/*.png. Exits 1 when any problem was found.
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:8787';
const out = process.env.QA_OUT ?? mkdtempSync(join(tmpdir(), 'prod-parity-'));
mkdirSync(join(out, 'shots'), { recursive: true });
const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const run = crypto.randomUUID().slice(0, 6);
const email = (r) => `${r}-${run}@example.test`;
const lastMail = (to) =>
  db.prepare('SELECT body FROM academy_mail_outbox WHERE to_address=? ORDER BY id DESC LIMIT 1').get(to)
    ?.body ?? '';
const inviteLink = (to) => lastMail(to).match(/(\/loop\/join\/[A-Za-z0-9_-]{43})/)?.[1];
const node = (script, ...args) =>
  execFileSync(process.execPath, ['--no-warnings', `scripts/${script}`, ...args], {
    env: process.env,
    encoding: 'utf8',
  });

const problems = []; // {where, kind, detail}
const steps = []; // {step, ok, detail}
const visited = new Map(); // path -> {status, title, errors}
const browser = await chromium.launch({ executablePath: process.env.ACADEMY_CHROME_PATH });
let shot = 0;

const ERROR_TEXT =
  /something went wrong|application error|internal server error|waiting for the product owner|not in scope yet|is missing on this server|unexpected error|cannot read prop|undefined is not|\bnull\b is not|TypeError|ReferenceError/i;

async function newPage(role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error')
      problems.push({ where: `${role} ${page.url()}`, kind: 'console', detail: m.text() });
  });
  page.on('pageerror', (e) =>
    problems.push({ where: `${role} ${page.url()}`, kind: 'pageerror', detail: e.message }),
  );
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(base) && r.status() >= 500)
      problems.push({
        where: `${role} ${page.url()}`,
        kind: `http ${r.status()}`,
        detail: u.replace(base, ''),
      });
  });
  return page;
}
async function snap(page, label) {
  const f = `${String(++shot).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`;
  await page.screenshot({ path: join(out, 'shots', f), fullPage: true }).catch(() => {});
  return f;
}
async function step(name, page, fn) {
  try {
    await fn();
    steps.push({ step: name, ok: true });
  } catch (e) {
    const f = page ? await snap(page, 'FAIL-' + name) : null;
    steps.push({ step: name, ok: false, detail: String(e.message).split('\n')[0], shot: f });
    problems.push({ where: name, kind: 'step failed', detail: String(e.message).split('\n')[0] });
  }
}
async function signIn(page, who, returnTo = '/loop') {
  await page.goto(`${base}/signin?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email address').fill(who);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor({ timeout: 10000 });
  await page.getByLabel('6-digit code').fill(lastMail(who).match(/\b(\d{6})\b/)[1]);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle');
}
async function pageErrors(page) {
  const text = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const hits = text.split('\n').filter((l) => ERROR_TEXT.test(l));
  return [...new Set(hits)].slice(0, 5);
}
// Visit every same-origin link reachable from the start pages (GET only: nothing is clicked or submitted).
async function crawl(page, role, starts, limit = 120) {
  const queue = [...starts];
  const seen = new Set();
  while (queue.length && seen.size < limit) {
    const path = queue.shift();
    const key = role + ' ' + path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}|[A-Za-z0-9_-]{30,}/g, ':id');
    if (seen.has(path) || /\/signout|\/api\/|\/download|\.(pdf|zip|csv|json)$/.test(path)) continue;
    seen.add(path);
    let status = 0;
    try {
      const r = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 20000 });
      status = r?.status() ?? 0;
    } catch (e) {
      problems.push({
        where: `${role} ${path}`,
        kind: 'navigation',
        detail: String(e.message).split('\n')[0],
      });
      continue;
    }
    const errs = await pageErrors(page);
    const f = await snap(page, `${role}-${path}`);
    visited.set(key, { path, status, title: await page.title(), errors: errs, shot: f });
    if (status >= 400)
      problems.push({ where: `${role} ${path}`, kind: `http ${status}`, detail: errs.join(' | ') });
    else if (errs.length)
      problems.push({ where: `${role} ${path}`, kind: 'error text', detail: errs.join(' | ') });
    const links = await page
      .locator('a[href^="/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href').split('#')[0]));
    for (const l of links) if (l && !seen.has(l)) queue.push(l);
  }
}

try {
  // ---- server state exactly as production: seeded decisions, owner granted from the shell ----
  steps.push({ step: 'seed-decisions', ok: true, detail: node('seed-decisions.mjs').trim() });
  const owner = await newPage('owner');
  const ownerEmail = email('nakul');
  await step('owner signs in (root redirects to /loop)', owner, async () => {
    await signIn(owner, ownerEmail, '/');
    if (!new URL(owner.url()).pathname.startsWith('/loop')) throw new Error('landed on ' + owner.url());
  });
  steps.push({
    step: 'grant owner',
    ok: true,
    detail: node('loop-admin.mjs', 'grant', ownerEmail, 'owner').trim(),
  });
  await owner.goto(base + '/loop');
  await snap(owner, 'owner-home-before');
  await step('Start here is shown', owner, async () =>
    owner.getByRole('heading', { name: 'Start here' }).waitFor({ timeout: 5000 }),
  );

  // ---- guided set-up, the way a person would: Start here, one form, then the three steps ----
  let cohortId, packId;
  await step('1 set up the workshop from Start here', owner, async () => {
    await owner.goto(base + '/loop');
    await owner.getByRole('link', { name: 'Set up a workshop' }).click();
    await owner.waitForURL(base + '/loop/setup');
    await snap(owner, 'setup-empty');
    await owner.getByLabel('Association name').fill(`Textile pilot ${run}`);
    const rows = ['asha', 'ravi', 'meena', 'joseph', 'farah', 'kiran']
      .map((n, i) => `${n} weaver, ${email(n)}, ${['weaver', 'supervisor', 'accountant'][i % 3]}`)
      .join('\n');
    await owner.getByLabel('Staff list').fill(rows);
    await owner.getByRole('button', { name: 'Create the workshop and send invites' }).click();
    await owner.getByText(/6 people invited/).waitFor({ timeout: 15000 });
    await owner.reload();
    await owner.getByText(/6 people invited/).waitFor({ timeout: 10000 });
    const c = db.prepare('SELECT id, pack_id FROM loop_cohorts ORDER BY created_at DESC LIMIT 1').get();
    cohortId = c.id;
    packId = c.pack_id;
    if (!packId) throw new Error('no pack attached');
    await snap(owner, 'setup-after-workshop');
  });
  await step('2 draft the tasks with AI', owner, async () => {
    await owner
      .getByLabel('What should they practise?')
      .fill('Checking supplier invoices and writing buyer emails');
    await owner.getByRole('button', { name: 'Draft the tasks with AI' }).click();
    await owner
      .getByText(/Drafted\. Review them now\.|could not|not in the expected format/i)
      .first()
      .waitFor({ timeout: 20000 });
    await owner.reload();
    await snap(owner, 'setup-after-draft');
    await owner.getByRole('link', { name: /Review \d+ drafted items/ }).click();
    await snap(owner, 'review-drafted');
    for (let i = 0; i < 20; i++) {
      const approve = owner.getByRole('button', { name: 'Approve', exact: true }).first();
      if (!(await approve.count())) break;
      await approve.click();
      await owner.waitForTimeout(400);
    }
    await owner.getByRole('button', { name: 'Publish a new version' }).click();
    await owner.getByText(/published version 1/).waitFor({ timeout: 10000 });
  });
  await step('3 run the coach safety test', owner, async () => {
    await owner.goto(base + '/loop/setup');
    await owner.getByRole('button', { name: 'Run the safety test' }).click();
    await owner.waitForTimeout(4000);
    await owner.reload();
    await snap(owner, 'setup-after-eval');
  });
  await owner.goto(base + '/loop');
  await snap(owner, 'owner-home-after');

  // ---- a learner joins with the real notice and placement ----
  const asha = await newPage('learner');
  await step('learner joins from the invite', asha, async () => {
    await asha.goto(base + inviteLink(email('asha')));
    await snap(asha, 'learner-invite');
    await asha.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
    await asha.getByRole('link', { name: 'Sign in to join' }).click();
    await asha.getByLabel('Email address').fill(email('asha'));
    await asha.getByRole('button', { name: 'Email me a code' }).click();
    await asha.getByLabel('6-digit code').waitFor({ timeout: 10000 });
    await asha.getByLabel('6-digit code').fill(lastMail(email('asha')).match(/\b(\d{6})\b/)[1]);
    await asha.getByRole('button', { name: 'Sign in' }).click();
    await asha.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
    await asha.getByLabel(/I agree to the use of my practice data/).check();
    await asha.getByRole('button', { name: 'Join' }).click();
    await asha.waitForURL(base + '/loop', { timeout: 10000 });
  });
  await step('learner does the placement check', asha, async () => {
    await asha.getByRole('link', { name: /placement check/ }).click();
    for (const label of [
      'Most days',
      'Changed how I do a regular task because of AI',
      'Always check it against my records or a trusted source',
      'Add details about my situation or an example and ask again',
      'Yes, always',
    ])
      await asha.getByLabel(label).check();
    await asha.getByRole('button', { name: 'See my level' }).click();
    await asha.getByText(/Your AI level is/).waitFor({ timeout: 10000 });
  });
  await asha.goto(base + '/loop');
  await snap(asha, 'learner-home');
  await step('owner starts the workshop session from set-up', owner, async () => {
    await owner.goto(base + '/loop/setup');
    await owner.getByRole('link', { name: 'Run the workshop session' }).click();
    await owner.getByRole('button', { name: 'Start the workshop practice session' }).click();
    await owner.getByText(/have finished/).waitFor({ timeout: 10000 });
    await snap(owner, 'facilitator-session');
  });
  await step('learner opens the workshop task and asks the coach', asha, async () => {
    await asha.goto(base + '/loop');
    await asha.getByRole('link', { name: 'Workshop: your first practice task' }).click();
    await snap(asha, 'learner-task');
    await asha.getByRole('heading', { name: 'Ask the AI coach' }).waitFor({ timeout: 10000 });
    if (await asha.getByLabel('Your question').count()) {
      await asha.getByLabel('Your question').fill('How do I start?');
      await asha.getByRole('button', { name: 'Ask for a hint' }).click();
      await asha.waitForTimeout(2000);
    } else if (!(await asha.getByText('Paused for now').count()))
      throw new Error('neither the coach nor the paused notice is shown');
    await snap(asha, 'learner-coach');
    await asha.getByLabel(/What changed in your work/).fill('Checked one invoice total by hand');
    await asha.getByRole('button', { name: 'Submit my result' }).click();
    await asha.getByText('You submitted this task.').waitFor({ timeout: 10000 });
  });

  // ---- crawl everything each role can reach ----
  await crawl(owner, 'owner', [
    '/',
    '/loop',
    '/loop/setup',
    '/loop/ops',
    '/loop/settings',
    '/loop/help',
    '/classic',
  ]);
  await crawl(asha, 'learner', ['/loop', '/loop/settings', '/loop/help', '/loop/sessions']);
  const anon = await newPage('anonymous');
  await crawl(anon, 'anonymous', ['/', '/loop', '/signin', '/classic'], 10);
} catch (e) {
  problems.push({ where: 'test', kind: 'crashed', detail: String(e.stack) });
} finally {
  await browser.close();
  const report = {
    out,
    steps,
    pages: [...visited.values()],
    problems,
    summary: {
      steps: steps.length,
      stepsFailed: steps.filter((s) => !s.ok).length,
      pages: visited.size,
      problems: problems.length,
    },
  };
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  process.exitCode = problems.length ? 1 : 0;
}
