// R1 practice-loop journey in a real browser on the local Node server (ACA-E2, E3, E4, E6, E7 screens).
// Run with scripts/node-local-qa.sh and QA_TRUST_HEADERS=0, ACADEMY_MAIL_TRANSPORT=outbox, ACADEMY_AI_PROVIDER=fake.
// Owner decisions are seeded as synthetic rows; every person and file is synthetic. Never point this at a hosted Site.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:8787',
  run = crypto.randomUUID().slice(0, 6);
// Operations folds its less frequent sections; the journey opens them all, as an operator would.
// Wait until the page has hydrated, or React may render the folds closed again after they were opened.
const openFolds = async (p) => {
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.querySelectorAll('details[data-fold]').forEach((d) => (d.open = true)));
};
const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const browser = await chromium.launch({ executablePath: process.env.ACADEMY_CHROME_PATH });
let checks = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const email = (r) => `${r}-${run}@example.test`;
const lastMail = (to) =>
  db.prepare('SELECT body FROM academy_mail_outbox WHERE to_address=? ORDER BY id DESC LIMIT 1').get(to)
    ?.body ?? '';
const inviteLink = (to) => lastMail(to).match(/(\/loop\/join\/[A-Za-z0-9_-]{43})/)[1];
const today = new Date().toISOString().slice(0, 10),
  now = new Date().toISOString();

async function signIn(page, who, returnTo = '/loop') {
  await page.goto(`${base}/signin?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email address').fill(who);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByLabel('6-digit code').waitFor();
  await page.getByLabel('6-digit code').fill(lastMail(who).match(/\b(\d{6})\b/)[1]);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => new URL(u).pathname === returnTo.split('?')[0]);
}
const userId = (who) => db.prepare('SELECT id FROM academy_users WHERE email=?').get(who).id;
// ACA-US-12.3: automated WCAG 2.2 AA checks (axe-core) on every R1 screen the journey visits, at phone width.
const axeSource = readFileSync(join(import.meta.dirname, '../../node_modules/axe-core/axe.min.js'), 'utf8');
const a11yResults = [];
async function a11y(page, screen) {
  await page.waitForLoadState('networkidle');
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(
    async () =>
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      }),
  );
  a11yResults.push({
    screen,
    path: new URL(page.url()).pathname.replace(
      /[A-Za-z0-9_-]{20,}|(org|coh|mem|task|pack|ses|thr)-[0-9a-f-]{36}/g,
      ':id',
    ),
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    })),
    passes: r.passes.length,
  });
}
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  return ctx.newPage();
}
async function submitForm(page, button) {
  await page.getByRole('button', { name: button }).click();
}

try {
  // ---- Owner and operator (APLYD staff) sign in once; seed their roles and the owner's decisions (synthetic) ----
  const op = await newPage();
  await signIn(op, email('owner'));
  db.prepare(
    `INSERT INTO loop_operators(user_id,role,granted_by,granted_at) VALUES(?, 'owner', 'local-test', ?)`,
  ).run(userId(email('owner')), now);
  db.prepare('INSERT OR IGNORE INTO loop_notices(version,body,created_at) VALUES(?,?,?)').run(
    'local-notice-1',
    'SYNTHETIC NOTICE: what we collect, why, how long, your rights.',
    now,
  );
  const decide = (k, v) =>
    db
      .prepare('INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)')
      .run(k, 'global', JSON.stringify(v), userId(email('owner')), now, 'synthetic local test');
  decide('notice.approved', { version: 'local-notice-1' });
  decide('placement.instrument', {
    questions: [
      {
        id: 'q1',
        text: 'How often do you use AI at work?',
        options: [
          { id: 'a', text: 'Never', score: 0 },
          { id: 'b', text: 'Weekly', score: 1 },
        ],
      },
    ],
    bands: [
      { level: 'L1', label: 'Starting', min: 0, max: 0 },
      { level: 'L2', label: 'Practising', min: 1, max: 1 },
    ],
  });
  decide('metrics.min_group_size', { size: 1 });
  decide('followup.inactive_weeks', { weeks: 2 });
  decide('ai.thresholds', { overall: 1 });
  db.prepare(
    'INSERT INTO loop_eval_runs(id,at,run_by,config_hash,provider,model,thresholds,results,summary,passed) VALUES(?,?,?,?,?,?,?,?,?,1)',
  ).run(
    'run-' + run,
    now,
    'local',
    createHash('sha256').update(`fake|${process.env.ACADEMY_AI_MODEL}|hint-first-2`).digest('hex'),
    'fake',
    process.env.ACADEMY_AI_MODEL,
    JSON.stringify({ overall: 1 }),
    '[]',
    '{}',
  );

  // ---- 2.5: the operator creates the association and invites its admin ----
  await op.goto(base + '/loop/ops');
  await openFolds(op);
  await a11y(op, 'operations');
  const orgName = `Synthetic Textile ${run}`;
  await op.locator('#org\\.create-name').fill(orgName);
  await op.locator('#org\\.create-sector').fill('textile');
  await submitForm(op, 'Create organisation');
  await op.getByRole('link', { name: orgName }).waitFor();
  checks++;
  await op.getByText('Invite this organisation’s admin').last().click();
  const orgId = db.prepare('SELECT id FROM loop_orgs WHERE name=?').get(orgName).id;
  await op.locator(`#ia-${orgId}-name`).fill('Admin Person');
  await op.locator(`#ia-${orgId}-email`).fill(email('admin'));
  await op.getByRole('button', { name: 'Send single-use invite' }).click();
  await op.getByText('Invite sent.').waitFor();
  ok(
    db
      .prepare(
        `SELECT count(*) n FROM loop_audit WHERE action IN ('org.create','org.invite_admin') AND outcome='ok'`,
      )
      .get().n === 2,
    'operator actions audited',
  );

  // ---- admin joins, creates the cohort, invites a facilitator, enrols members ----
  const admin = await newPage();
  await signIn(admin, email('admin'), inviteLink(email('admin')));
  await admin.getByRole('button', { name: 'Join' }).click();
  await admin.waitForURL(base + '/loop');
  await admin.getByRole('link', { name: 'Organisation and cohorts' }).click();
  await a11y(admin, 'organisation');
  await admin.getByLabel('Cohort name').fill('Cohort 1');
  await admin.getByLabel(/Workshop date/).fill(today);
  await submitForm(admin, 'Create cohort');
  await admin.waitForURL(/\/loop\/cohort\//);
  const cohortId = admin.url().split('/').pop();
  await admin
    .getByLabel(/Member list/)
    .fill(
      `Asha Rao, ${email('asha')}, accountant\nBad Row, not-an-email, owner\nRavi K, ${email('ravi')}, merchandiser`,
    );
  await submitForm(admin, 'Check and send invites');
  await admin.getByText('Line 2:').waitFor();
  ok(await admin.getByText('Email is missing or not valid').isVisible(), 'bad row shown with reason');
  await admin.reload();
  ok((await admin.getByRole('cell', { name: 'invited' }).count()) === 2, 'two members invited');
  await a11y(admin, 'cohort admin');
  await admin.goto(`${base}/loop/org/${orgId}`);
  await admin.locator('#org\\.invite-name').fill('Fac Person');
  await admin.locator('#org\\.invite-email').fill(email('fac'));
  await submitForm(admin, 'Send invite');
  await admin.getByText('Invite sent.').waitFor();
  const fac = await newPage();
  await signIn(fac, email('fac'), inviteLink(email('fac')));
  await fac.getByRole('button', { name: 'Join' }).click();
  await fac.waitForURL(base + '/loop');

  // ---- pack: operator creates it, names the expert, imports a draft; the expert approves and publishes ----
  const expert = await newPage();
  await signIn(expert, email('expert'));
  await op.goto(base + '/loop/ops');
  await openFolds(op);
  await op.locator('#pack\\.create-title').fill(`Textile pack ${run}`);
  await op.locator('#pack\\.create-sector').fill('textile');
  await submitForm(op, 'Create pack');
  await op.getByText(`Textile pack ${run}`).waitFor();
  const packId = db.prepare('SELECT id FROM loop_packs WHERE title=?').get(`Textile pack ${run}`).id;
  await op.getByText('Name a reviewer').last().click();
  await op.locator(`#rv-${packId}-email`).fill(email('expert'));
  await op.locator(`#rv-${packId}`).getByRole('button').click();
  await op.locator(`#rv-${packId}`).getByText('Saved.').waitFor();
  await op.getByText('Import an agent-drafted file').last().click();
  const src = [{ title: 'Synthetic public guide', url: 'https://example.test/guide' }];
  await op.locator(`#im-${packId}-items`).fill(
    JSON.stringify([
      {
        kind: 'task',
        jobRole: '*',
        level: '*',
        title: 'Check a supplier invoice',
        body: 'Use AI to check one real supplier invoice for wrong totals.',
        sources: src,
      },
      {
        kind: 'rule',
        jobRole: '*',
        level: '*',
        title: 'Re-add totals yourself',
        body: 'Always re-add any total the AI gives you.',
        sources: src,
      },
    ]),
  );
  await op.locator(`#im-${packId}`).getByRole('button').click();
  await op.locator(`#im-${packId}`).getByText('Saved.').waitFor();
  await op.getByText('Use this pack for a cohort').last().click();
  await op.locator(`#at-${packId}`).getByRole('button').click();
  await op.locator(`#at-${packId}`).getByText('Saved.').waitFor();
  await expert.goto(base + '/loop');
  await expert.getByRole('link', { name: `Textile pack ${run}` }).click();
  for (let i = 0; i < 2; i++) {
    await expert.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await expert.waitForTimeout(400);
  }
  await expert.getByText('Nothing waiting.').waitFor();
  await expert.getByRole('button', { name: 'Publish a new version' }).click();
  await expert.getByText(/published version 1/).waitFor();
  checks++;
  await a11y(expert, 'pack review');

  // ---- learner: notice and age before sign-in, consents, placement, workshop task ----
  const asha = await newPage();
  await asha.goto(base + inviteLink(email('asha')));
  ok(await asha.getByText('SYNTHETIC NOTICE').isVisible(), 'notice shown before sign-in');
  await a11y(asha, 'join: notice and age');
  await asha.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
  await asha.getByRole('link', { name: 'Sign in to join' }).click();
  await asha.getByLabel('Email address').fill(email('asha'));
  await asha.getByRole('button', { name: 'Email me a code' }).click();
  await asha.getByLabel('6-digit code').waitFor();
  await asha.getByLabel('6-digit code').fill(lastMail(email('asha')).match(/\b(\d{6})\b/)[1]);
  await asha.getByRole('button', { name: 'Sign in' }).click();
  await asha.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
  await a11y(asha, 'join: consent choices');
  await asha.getByRole('button', { name: 'Join' }).click();
  await asha.getByText('agree to the use of your practice data').waitFor();
  checks++; // core consent required
  await asha.getByLabel(/I agree to the use of my practice data/).check();
  await asha.getByLabel('Email').check();
  await asha.getByRole('button', { name: 'Join' }).click();
  await asha.waitForURL(base + '/loop');
  const mem = db.prepare(`SELECT id FROM loop_members WHERE email=?`).get(email('asha')).id;
  ok(
    db.prepare(`SELECT notice_version FROM loop_consents WHERE member_id=? AND purpose='core'`).get(mem)
      .notice_version === 'local-notice-1',
    'consent recorded with notice version',
  );
  await a11y(asha, 'learner home');
  await asha.getByRole('link', { name: /placement check/ }).click();
  await asha.getByLabel('Weekly').waitFor();
  await a11y(asha, 'placement');
  await asha.getByLabel('Weekly').check();
  await asha.getByRole('button', { name: 'See my level' }).click();
  await asha.getByText(/Your AI level is/).waitFor();
  ok(await asha.getByText('Practising').first().isVisible(), 'level shown');

  // ---- under-18: refused, nothing kept ----
  const ravi = await newPage();
  await ravi.goto(base + inviteLink(email('ravi')));
  await ravi.getByRole('button', { name: 'No, I am under 18' }).click();
  await ravi.getByText('Nothing about you has been kept').waitFor();
  ok(
    db.prepare('SELECT count(*) n FROM loop_members WHERE email=?').get(email('ravi')).n === 0,
    'under-18 list entry deleted',
  );
  ok(
    db.prepare('SELECT count(*) n FROM academy_users WHERE email=?').get(email('ravi')).n === 0,
    'no account for under-18',
  );

  // ---- 4.6 workshop session: facilitator starts; learner practises with hints, uploads own work, submits ----
  await fac.goto(`${base}/loop/facilitate/${cohortId}`);
  await fac.getByRole('button', { name: 'Start the workshop practice session' }).click();
  await fac.getByText(/0 of 1 have finished/).waitFor();
  checks++;
  await a11y(fac, 'facilitator');
  await asha.goto(base + '/loop');
  await asha.getByRole('link', { name: 'Workshop: your first practice task' }).click();
  await asha.getByText('Re-add totals yourself').waitFor();
  checks++; // checked guidance visible
  await a11y(asha, 'practice task');
  const dir = mkdtempSync(join(tmpdir(), 'loop-up-')),
    file = join(dir, 'my-invoice.txt');
  writeFileSync(file, 'SYNTHETIC invoice total 1,180'.repeat(40000)); // ~1.1 MB: several chunks
  await asha.getByLabel(/Attach your own work/).setInputFiles(file);
  await asha.getByRole('button', { name: 'Upload' }).click();
  await asha.getByText('Uploaded my-invoice.txt. Only you can see it.').waitFor();
  checks++;
  await asha.getByLabel('Your question').fill('Just give me the answer');
  await asha.getByRole('button', { name: 'Ask for a hint' }).click();
  await asha.getByText(/\[fake:coach-hint\]/).waitFor();
  checks++;
  await asha.getByLabel('My attempt').fill('Totals look wrong on line 3');
  await asha.getByRole('button', { name: 'Save my attempt' }).click();
  await asha.getByText('Attempt saved.').waitFor();
  await asha.getByLabel('Your question').fill('Is my attempt right?');
  await asha.getByRole('button', { name: 'Ask for a hint' }).click();
  await asha.getByText(/\[fake:coach-feedback\]/).waitFor();
  checks++;
  await asha.getByLabel(/What changed in your work/).fill('Found a wrong total on a real invoice');
  await asha.getByLabel(/Which of your files/).selectOption({ label: 'my-invoice.txt' });
  await asha.getByRole('button', { name: 'Submit my result' }).click();
  await asha.getByText('You submitted this task.').waitFor();
  ok(
    db.prepare(`SELECT week, has_artefact FROM loop_submissions WHERE member_id=?`).get(mem).week === 0,
    'workshop cycle is week 0',
  );

  // ---- facilitator sees completion only; admin sees aggregates only; file not reachable by others ----
  await fac.reload();
  await fac.getByText(/1 of 1 have finished/).waitFor();
  checks++;
  const facHtml = await fac.content();
  ok(
    !facHtml.includes('my-invoice') && !facHtml.includes('wrong total'),
    'no files or answers for the facilitator',
  );
  await admin.goto(`${base}/loop/cohort/${cohortId}`);
  await admin.getByText('Progress (aggregates only)').waitFor();
  ok((await admin.getByRole('cell', { name: /100% \(1\/1/ }).count()) >= 1, 'week 0 aggregate shown');
  ok(!(await admin.content()).includes('wrong total'), 'admin sees no notes');
  const fileId = db.prepare('SELECT id FROM loop_files WHERE member_id=?').get(mem).id;
  ok(
    (await admin.evaluate(async (id) => (await fetch('/api/loop/files/' + id)).status, fileId)) === 403,
    'admin cannot fetch the learner file',
  );
  ok(
    (await asha.evaluate(async (id) => (await fetch('/api/loop/files/' + id)).status, fileId)) === 200,
    'owner can fetch their file',
  );

  // ---- 7.3 owner switches AI off: task still works with a notice ----
  decide('ai.enabled', { enabled: false });
  await asha.goto(base + '/loop/history/' + mem);
  await asha.getByText('Found a wrong total on a real invoice').waitFor();
  checks++;
  await a11y(asha, 'history');
  const taskId = db.prepare(`SELECT id FROM loop_tasks WHERE member_id=?`).get(mem).id;
  await asha.goto(`${base}/loop/task/${taskId}`);
  await asha.getByRole('heading', { name: 'Checked guidance' }).waitFor();
  ok(await asha.getByText(/AI help is paused/).isVisible(), 'paused notice'); // task works with AI off

  // ---- help from any screen; export and settings ----
  await asha.getByRole('link', { name: 'Help' }).click();
  await asha.getByText('Common questions').waitFor();
  checks++;
  await a11y(asha, 'help');
  await asha.goto(base + '/loop/settings');
  await a11y(asha, 'settings');
  const exp = await asha.evaluate(
    async () => (await (await fetch('/api/loop/export')).json()).memberships[0].submissions.length,
  );
  ok(exp === 1, 'export contains my submission');
  // ---- 12.5 help: report from any screen; the facilitator sees it with time and screen ----
  await asha.goto(`${base}/loop/history/${mem}`);
  await asha.getByRole('link', { name: 'Help' }).click();
  await asha.getByLabel('What went wrong?').fill('The upload bar stopped once');
  await asha.getByRole('button', { name: 'Send report' }).click();
  await asha.getByText('Thank you. We have your report').waitFor();
  checks++;
  await fac.goto(`${base}/loop/facilitate/${cohortId}`);
  await fac.getByText('The upload bar stopped once').waitFor();
  ok(await fac.getByText('screen “history”').isVisible(), 'report carries the screen');

  // ---- 8.1/8.2 live session for Asha's level, then a cohort-only thread with moderation ----
  decide('sessions.format', { cadence: 'monthly', minutes: 45 });
  await fac.goto(`${base}/loop/community/${cohortId}`);
  await fac.getByLabel('Level').selectOption('L2');
  await fac.getByLabel('Title').fill('Checking invoices together');
  await fac.getByLabel(/Starts at/).fill('2026-12-01T10:00:00Z');
  await fac.getByLabel('Meeting link').fill('https://meet.example.test/abc');
  await fac.getByRole('button', { name: 'Schedule and invite' }).click();
  await fac.getByText('1 invited').waitFor();
  checks++;
  await asha.goto(base + '/loop/sessions');
  await asha.getByText('Checking invoices together').waitFor();
  checks++;
  await a11y(asha, 'sessions');
  await fac.getByText('End the session').click();
  await fac.getByRole('button', { name: 'End and open the follow-up thread' }).click();
  await fac.getByRole('link', { name: /After the session/ }).waitFor();
  await asha.reload();
  await asha.getByRole('link', { name: 'Follow-up thread' }).click();
  await asha.getByLabel('Your post').fill('SPAM post for moderation test');
  await asha.getByRole('button', { name: 'Post' }).click();
  await asha.getByText('SPAM post for moderation test').waitFor();
  await fac.getByRole('link', { name: /After the session/ }).click();
  await fac.getByRole('button', { name: 'Hide' }).click();
  await fac.getByText('hidden', { exact: true }).waitFor();
  await asha.reload();
  await asha.getByText('This post was hidden by a facilitator.').waitFor();
  checks++;
  await a11y(asha, 'thread');
  await fac.goto(`${base}/loop/community/${cohortId}`);
  await a11y(fac, 'community');
  ok(
    db.prepare(`SELECT count(*) n FROM loop_audit WHERE action='thread.hide' AND outcome='ok'`).get().n === 1,
    'hide audited',
  );

  // ---- 10.1 confirmation by a supervisor without an account ----
  await asha.goto(`${base}/loop/history/${mem}`);
  await asha.getByText('Ask a supervisor or peer to confirm this change').click();
  await asha.getByLabel('Their email').fill(email('boss'));
  await asha
    .getByLabel(/What they will see/)
    .fill('I now check every supplier invoice total with AI and by hand');
  await asha.getByRole('button', { name: 'Send request' }).click();
  await asha.getByText('Request sent.').waitFor();
  const boss = await newPage();
  await boss.goto(base + lastMail(email('boss')).match(/(\/loop\/confirm\/[A-Za-z0-9_-]{43})/)[1]);
  await boss.getByText('I now check every supplier invoice total').waitFor();
  await a11y(boss, 'confirmation (public)');
  ok(!(await boss.content()).includes('wrong total'), 'confirmer sees only what was shared');
  await boss.getByRole('button', { name: 'Yes, I confirm this change' }).click();
  await boss.getByText('You confirmed this change.').waitFor();
  ok(
    db.prepare(`SELECT status FROM loop_confirmations WHERE member_id=?`).get(mem).status === 'confirmed',
    'confirmation stored',
  );

  // ======== R3 and R4 screens (ACA-E11, E19, E20, E21) on the same synthetic world ========
  decide('scope.release', { epics: ['ACA-E19', 'ACA-E20', 'ACA-E21'], strategyVersion: 'synthetic' });
  decide('language.local', { code: 'hi', name: 'Hindi' });

  // 20.1/20.2: a learner notes part of an item; the expert compares an AI refinement and approves it
  await asha.goto(`${base}/loop/task/${taskId}`);
  await asha.getByText('Add a note on part of this text').first().click();
  await asha.getByLabel('Copy the exact words your note is about').first().fill('Always re-add');
  await asha.getByLabel('Your note', { exact: true }).first().fill('Which totals do you mean?');
  await asha.getByRole('button', { name: 'Save note' }).first().click();
  await asha
    .getByText('The expert sees it next to those words')
    .waitFor({ timeout: 8000 })
    .catch(async (e) => {
      console.error(
        'ALERTS:',
        await asha.locator('[role=alert]').allInnerTexts(),
        await asha.locator('input[id^=ann-]').first().inputValue(),
        await asha.locator('input[id^=ann-]').first().getAttribute('id'),
        JSON.stringify(db.prepare("SELECT id, kind, body FROM loop_pack_items WHERE kind='rule'").all()),
      );
      throw e;
    });
  checks++;
  await expert.goto(`${base}/loop/review/${packId}`);
  await expert.getByText('Which totals do you mean?').waitFor();
  await expert.getByRole('button', { name: 'Ask AI to propose a refinement' }).click();
  await expert.getByText(/Proposed refinement:/).waitFor();
  await a11y(expert, 'pack review with notes and refinement');
  await expert.getByRole('button', { name: 'Approve as a new revision' }).click();
  await expert.getByText(/Proposed refinement:/).waitFor({ state: 'detached' });
  checks++;

  // 19.1: language switch in settings
  await asha.goto(base + '/loop/settings');
  await asha.getByLabel('Show the app and my tasks in').selectOption('hi');
  await asha.getByRole('button', { name: 'Save language' }).click();
  await asha.locator('form').filter({ hasText: 'Save language' }).getByText('Saved.').waitFor();
  ok(
    db.prepare('SELECT language FROM loop_user_prefs WHERE user_id=?').get(userId(email('asha'))).language ===
      'hi',
    'language saved',
  );

  // 11.1/11.2/11.6: school, guardian consent, teacher class view
  await op.goto(base + '/loop/ops');
  await openFolds(op);
  await op.locator('#org\\.create-kind').selectOption('school');
  await op.locator('#org\\.create-name').fill(`Synthetic School ${run}`);
  await op.locator('#org\\.create-sector').fill('education');
  await op.locator('#org\\.create-agreementRef').fill('Synthetic signed MoU');
  await submitForm(op, 'Create organisation');
  await op.getByRole('link', { name: `Synthetic School ${run}` }).waitFor();
  const schoolId = db.prepare('SELECT id FROM loop_orgs WHERE name=?').get(`Synthetic School ${run}`).id;
  await op.locator(`#ia-${schoolId}`).locator('xpath=..').locator('summary').click();
  await op.locator(`#ia-${schoolId}-name`).fill('Head Teacher');
  await op.locator(`#ia-${schoolId}-email`).fill(email('head'));
  await op.locator(`#ia-${schoolId}`).getByRole('button').click();
  await op.locator(`#ia-${schoolId}`).getByText('Invite sent.').waitFor();
  const head = await newPage();
  await signIn(head, email('head'), inviteLink(email('head')));
  await head.getByRole('button', { name: 'Join' }).click();
  await head.waitForURL(base + '/loop');
  await head.goto(`${base}/loop/org/${schoolId}`);
  await head.getByLabel('Cohort name').fill('Class 8 pilot');
  await head.getByLabel(/Workshop date/).fill(today);
  await submitForm(head, 'Create cohort');
  await head.waitForURL(/\/loop\/cohort\//);
  const schoolCohort = head.url().split('/').pop();
  const sdecide = (k, v) =>
    db
      .prepare('INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)')
      .run(k, schoolId, JSON.stringify(v), userId(email('owner')), now, 'synthetic local test');
  sdecide('student.agreement', { ref: 'Synthetic processing agreement', signedOn: today });
  sdecide('student.legal_review', {
    ref: 'Synthetic legal review',
    parentalConsentRequired: true,
    teacherMaySee: ['practice_counts', 'check_results'],
  });
  decide('golive.decision', { decision: 'go' });
  await head.reload();
  await head.getByLabel('Who are they?').selectOption('student');
  await head.getByLabel(/Member list/).fill(`Kid One, ${email('kid1')}, 8a, ${email('parent1')}`);
  await submitForm(head, 'Check and send invites');
  await head.getByText(/Done\. Every valid row/).waitFor();
  ok(!lastMail(email('kid1')), 'student not contacted before guardian consent');
  const parent = await newPage();
  await parent.goto(base + lastMail(email('parent1')).match(/(\/loop\/guardian\/[A-Za-z0-9_-]{43})/)[1]);
  await parent.getByRole('button', { name: 'I give consent' }).waitFor();
  await a11y(parent, 'guardian consent (public)');
  await parent.getByRole('button', { name: 'I give consent' }).click();
  await parent.getByText('You gave consent.').waitFor();
  ok(/\/loop\/join\//.test(lastMail(email('kid1'))), 'student invited after consent');
  await head.getByLabel('Who are they?').selectOption('teacher');
  await head.getByLabel(/Member list/).fill(`Teacher A, ${email('teach')}, maths`);
  await submitForm(head, 'Check and send invites');
  await head.getByText(/Done\. Every valid row/).waitFor();
  const teach = await newPage();
  await teach.goto(base + inviteLink(email('teach')));
  await teach.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
  await teach.getByRole('link', { name: 'Sign in to join' }).click();
  await teach.getByLabel('Email address').fill(email('teach'));
  await teach.getByRole('button', { name: 'Email me a code' }).click();
  await teach.getByLabel('6-digit code').waitFor();
  await teach.getByLabel('6-digit code').fill(lastMail(email('teach')).match(/\b(\d{6})\b/)[1]);
  await teach.getByRole('button', { name: 'Sign in' }).click();
  await teach.getByRole('button', { name: 'Yes, I am 18 or older' }).click();
  await teach.getByLabel(/I agree to the use of my practice data/).check();
  await teach.getByRole('button', { name: 'Join' }).click();
  await teach.waitForURL(base + '/loop');
  const kid = await newPage();
  const kidHosts = new Set();
  kid.on('request', (r) => kidHosts.add(new URL(r.url()).host)); // ACA-TT-11.3.2: trackers and data flows in a student session
  await signIn(kid, email('kid1'), inviteLink(email('kid1')));
  await kid.getByLabel(/I agree to the use of my practice data/).check();
  await kid.getByRole('button', { name: 'Join' }).click();
  await kid.waitForURL(base + '/loop');
  await kid.goto(base + '/loop/help');
  await kid.goto(base + '/loop/settings');
  ok(
    [...kidHosts].every((h) => h === '127.0.0.1:8787'),
    'student session talks only to the Academy itself: ' + [...kidHosts].join(','),
  );
  ok(
    !(await kid.content()).match(
      /googletagmanager|google-analytics|facebook\.net|hotjar|segment\.io|clarity\.ms/,
    ),
    'no tracker scripts in student pages',
  );
  await head.goto(`${base}/loop/org/${schoolId}`);
  await head.getByLabel('Class', { exact: true }).fill('8A');
  await head.getByRole('button', { name: 'Give this teacher the class view' }).click();
  await head.getByText('Saved.').first().waitFor();
  await a11y(head, 'school organisation');
  await teach.goto(base + '/loop');
  await teach.getByRole('link', { name: 'My class' }).click();
  await teach.getByRole('cell', { name: 'Kid One' }).waitFor();
  checks++;
  await a11y(teach, 'teacher class view');

  // 21.1/21.2: sponsor funds seats; sponsor staff see aggregates only
  const odecide = (k, v, sc) =>
    db
      .prepare('INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)')
      .run(k, sc, JSON.stringify(v), userId(email('owner')), now, 'synthetic local test');
  odecide('pricing.workshop', { model: 'per_participant', unitPaise: 50000, cap: 40 }, orgId);
  await op.goto(base + '/loop/ops');
  await openFolds(op);
  await op.locator('#sp-name').fill(`Synthetic CSR ${run}`);
  await op.locator('#sp-kind').selectOption('csr');
  await op.locator('#sp').getByRole('button').click();
  await op.getByRole('link', { name: `Synthetic CSR ${run}` }).waitFor();
  const spId = db.prepare('SELECT id FROM loop_sponsors WHERE name=?').get(`Synthetic CSR ${run}`).id;
  await op.locator(`#fs-${spId}`).locator('xpath=..').locator('summary').click();
  await op.locator(`#fs-${spId}-cohortId`).selectOption(cohortId);
  await op.locator(`#fs-${spId}-seats`).fill('5');
  await op.locator(`#fs-${spId}`).getByRole('button').click();
  await op.locator(`#fs-${spId}`).getByText('Saved.').waitFor();
  await op.locator(`#sv-${spId}`).locator('xpath=..').locator('summary').click();
  await op.locator(`#sv-${spId}-email`).fill(email('admin'));
  await op.locator(`#sv-${spId}`).getByRole('button').click();
  await op.locator(`#sv-${spId}`).getByText('Saved.').waitFor();
  await a11y(op, 'operations (full)');
  await admin.goto(`${base}/loop/sponsor/${spId}`);
  await admin.getByText('Funded seats: 5').waitFor();
  checks++;
  ok(!(await admin.content()).includes(email('asha')), 'sponsor sees no learner identities');
  await a11y(admin, 'sponsor usage');

  if (process.env.A11Y_OUT) {
    mkdirSync(join(process.env.A11Y_OUT, '..'), { recursive: true });
    writeFileSync(
      process.env.A11Y_OUT,
      JSON.stringify(
        {
          tool: 'axe-core 4.11.4',
          tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          viewport: '390x844',
          at: new Date().toISOString(),
          screens: a11yResults,
        },
        null,
        2,
      ),
    );
  }
  const failing = a11yResults.filter((r) => r.violations.length);
  if (failing.length) console.error(JSON.stringify(failing, null, 1));
  ok(failing.length === 0, `WCAG 2.2 AA automated checks: ${failing.length} screen(s) with violations`);
  console.log(JSON.stringify({ checks, passed: true, a11yScreens: a11yResults.length }));
} finally {
  await browser.close();
}
