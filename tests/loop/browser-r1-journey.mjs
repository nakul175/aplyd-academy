// R1 practice-loop journey in a real browser on the local Node server (ACA-E2, E3, E4, E6, E7 screens).
// Run with scripts/node-local-qa.sh and QA_TRUST_HEADERS=0, ACADEMY_MAIL_TRANSPORT=outbox, ACADEMY_AI_PROVIDER=fake.
// Owner decisions are seeded as synthetic rows; every person and file is synthetic. Never point this at a hosted Site.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:8787', run = crypto.randomUUID().slice(0, 6);
const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const browser = await chromium.launch({executablePath: process.env.ACADEMY_CHROME_PATH});
let checks = 0; const ok = (v, m) => { assert.ok(v, m); checks++; };
const email = r => `${r}-${run}@example.test`;
const lastMail = to => db.prepare('SELECT body FROM academy_mail_outbox WHERE to_address=? ORDER BY id DESC LIMIT 1').get(to)?.body ?? '';
const inviteLink = to => lastMail(to).match(/(\/loop\/join\/[A-Za-z0-9_-]{43})/)[1];
const today = new Date().toISOString().slice(0, 10), now = new Date().toISOString();

async function signIn(page, who, returnTo = '/loop') {
  await page.goto(`${base}/signin?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email address').fill(who); await page.getByRole('button', {name: 'Email me a code'}).click();
  await page.getByLabel('6-digit code').waitFor();
  await page.getByLabel('6-digit code').fill(lastMail(who).match(/\b(\d{6})\b/)[1]); await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(u => new URL(u).pathname === returnTo.split('?')[0]);
}
const userId = who => db.prepare('SELECT id FROM academy_users WHERE email=?').get(who).id;
async function newPage() { const ctx = await browser.newContext({viewport: {width: 390, height: 844}}); return ctx.newPage(); }
async function submitForm(page, button) { await page.getByRole('button', {name: button}).click(); }

try {
  // ---- Owner and operator (APLYD staff) sign in once; seed their roles and the owner's decisions (synthetic) ----
  const op = await newPage(); await signIn(op, email('owner'));
  db.prepare(`INSERT INTO loop_operators(user_id,role,granted_by,granted_at) VALUES(?, 'owner', 'local-test', ?)`).run(userId(email('owner')), now);
  db.prepare('INSERT OR IGNORE INTO loop_notices(version,body,created_at) VALUES(?,?,?)').run('local-notice-1', 'SYNTHETIC NOTICE: what we collect, why, how long, your rights.', now);
  const decide = (k, v) => db.prepare('INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)').run(k, 'global', JSON.stringify(v), userId(email('owner')), now, 'synthetic local test');
  decide('notice.approved', {version: 'local-notice-1'});
  decide('placement.instrument', {questions: [{id: 'q1', text: 'How often do you use AI at work?', options: [{id: 'a', text: 'Never', score: 0}, {id: 'b', text: 'Weekly', score: 1}]}], bands: [{level: 'L1', label: 'Starting', min: 0, max: 0}, {level: 'L2', label: 'Practising', min: 1, max: 1}]});
  decide('metrics.min_group_size', {size: 1}); decide('followup.inactive_weeks', {weeks: 2});
  decide('ai.thresholds', {overall: 1});
  db.prepare('INSERT INTO loop_eval_runs(id,at,run_by,config_hash,provider,model,thresholds,results,summary,passed) VALUES(?,?,?,?,?,?,?,?,?,1)')
    .run('run-' + run, now, 'local', createHash('sha256').update(`fake|${process.env.ACADEMY_AI_MODEL}|hint-first-1`).digest('hex'), 'fake', process.env.ACADEMY_AI_MODEL, JSON.stringify({overall: 1}), '[]', '{}');

  // ---- 2.5: the operator creates the association and invites its admin ----
  await op.goto(base + '/loop/ops');
  const orgName = `Synthetic Textile ${run}`;
  await op.locator('#org\\.create-name').fill(orgName); await op.locator('#org\\.create-sector').fill('textile');
  await submitForm(op, 'Create organisation'); await op.getByRole('link', {name: orgName}).waitFor(); checks++;
  await op.getByText('Invite this organisation’s admin').last().click();
  const orgId = db.prepare('SELECT id FROM loop_orgs WHERE name=?').get(orgName).id;
  await op.locator(`#ia-${orgId}-name`).fill('Admin Person'); await op.locator(`#ia-${orgId}-email`).fill(email('admin'));
  await op.getByRole('button', {name: 'Send single-use invite'}).click(); await op.getByText('Invite sent.').waitFor();
  ok(db.prepare(`SELECT count(*) n FROM loop_audit WHERE action IN ('org.create','org.invite_admin') AND outcome='ok'`).get().n === 2, 'operator actions audited');

  // ---- admin joins, creates the cohort, invites a facilitator, enrols members ----
  const admin = await newPage(); await signIn(admin, email('admin'), inviteLink(email('admin')));
  await admin.getByRole('button', {name: 'Join'}).click(); await admin.waitForURL(base + '/loop');
  await admin.getByRole('link', {name: 'Organisation and cohorts'}).click();
  await admin.getByLabel('Cohort name').fill('Cohort 1'); await admin.getByLabel(/Workshop date/).fill(today);
  await submitForm(admin, 'Create cohort'); await admin.waitForURL(/\/loop\/cohort\//);
  const cohortId = admin.url().split('/').pop();
  await admin.getByLabel(/Member list/).fill(`Asha Rao, ${email('asha')}, accountant\nBad Row, not-an-email, owner\nRavi K, ${email('ravi')}, merchandiser`);
  await submitForm(admin, 'Check and send invites');
  await admin.getByText('Line 2:').waitFor(); ok(await admin.getByText('Email is missing or not valid').isVisible(), 'bad row shown with reason');
  await admin.reload(); ok((await admin.getByRole('cell', {name: 'invited'}).count()) === 2, 'two members invited');
  await admin.goto(`${base}/loop/org/${orgId}`);
  await admin.locator('#org\\.invite-name').fill('Fac Person'); await admin.locator('#org\\.invite-email').fill(email('fac'));
  await submitForm(admin, 'Send invite'); await admin.getByText('Invite sent.').waitFor();
  const fac = await newPage(); await signIn(fac, email('fac'), inviteLink(email('fac'))); await fac.getByRole('button', {name: 'Join'}).click(); await fac.waitForURL(base + '/loop');

  // ---- pack: operator creates it, names the expert, imports a draft; the expert approves and publishes ----
  const expert = await newPage(); await signIn(expert, email('expert'));
  await op.goto(base + '/loop/ops');
  await op.locator('#pack\\.create-title').fill(`Textile pack ${run}`); await op.locator('#pack\\.create-sector').fill('textile');
  await submitForm(op, 'Create pack'); await op.getByText(`Textile pack ${run}`).waitFor();
  const packId = db.prepare('SELECT id FROM loop_packs WHERE title=?').get(`Textile pack ${run}`).id;
  await op.getByText('Name a reviewer').last().click();
  await op.locator(`#rv-${packId}-email`).fill(email('expert')); await op.locator(`#rv-${packId}`).getByRole('button').click(); await op.locator(`#rv-${packId}`).getByText('Saved.').waitFor();
  await op.getByText('Import an agent-drafted file').last().click();
  const src = [{title: 'Synthetic public guide', url: 'https://example.test/guide'}];
  await op.locator(`#im-${packId}-items`).fill(JSON.stringify([
    {kind: 'task', jobRole: '*', level: '*', title: 'Check a supplier invoice', body: 'Use AI to check one real supplier invoice for wrong totals.', sources: src},
    {kind: 'rule', jobRole: '*', level: '*', title: 'Re-add totals yourself', body: 'Always re-add any total the AI gives you.', sources: src},
  ]));
  await op.locator(`#im-${packId}`).getByRole('button').click(); await op.locator(`#im-${packId}`).getByText('Saved.').waitFor();
  await op.getByText('Use this pack for a cohort').last().click(); await op.locator(`#at-${packId}`).getByRole('button').click(); await op.locator(`#at-${packId}`).getByText('Saved.').waitFor();
  await expert.goto(base + '/loop'); await expert.getByRole('link', {name: `Textile pack ${run}`}).click();
  for (let i = 0; i < 2; i++) { await expert.getByRole('button', {name: 'Approve', exact: true}).first().click(); await expert.waitForTimeout(400); }
  await expert.getByText('Nothing waiting.').waitFor();
  await expert.getByRole('button', {name: 'Publish a new version'}).click(); await expert.getByText(/published version 1/).waitFor(); checks++;

  // ---- learner: notice and age before sign-in, consents, placement, workshop task ----
  const asha = await newPage();
  await asha.goto(base + inviteLink(email('asha')));
  ok(await asha.getByText('SYNTHETIC NOTICE').isVisible(), 'notice shown before sign-in');
  await asha.getByRole('button', {name: 'Yes, I am 18 or older'}).click();
  await asha.getByRole('link', {name: 'Sign in to join'}).click();
  await asha.getByLabel('Email address').fill(email('asha')); await asha.getByRole('button', {name: 'Email me a code'}).click();
  await asha.getByLabel('6-digit code').fill(lastMail(email('asha')).match(/\b(\d{6})\b/)[1]); await asha.getByRole('button', {name: 'Sign in'}).click();
  await asha.getByRole('button', {name: 'Yes, I am 18 or older'}).click();
  await asha.getByRole('button', {name: 'Join'}).click(); await asha.getByText('agree to the use of your practice data').waitFor(); checks++; // core consent required
  await asha.getByLabel(/I agree to the use of my practice data/).check(); await asha.getByLabel('Email').check();
  await asha.getByRole('button', {name: 'Join'}).click(); await asha.waitForURL(base + '/loop');
  const mem = db.prepare(`SELECT id FROM loop_members WHERE email=?`).get(email('asha')).id;
  ok(db.prepare(`SELECT notice_version FROM loop_consents WHERE member_id=? AND purpose='core'`).get(mem).notice_version === 'local-notice-1', 'consent recorded with notice version');
  await asha.getByRole('link', {name: /placement check/}).click();
  await asha.getByLabel('Weekly').check(); await asha.getByRole('button', {name: 'See my level'}).click();
  await asha.getByText(/Your AI level is/).waitFor(); ok(await asha.getByText('Practising').first().isVisible(), 'level shown');

  // ---- under-18: refused, nothing kept ----
  const ravi = await newPage(); await ravi.goto(base + inviteLink(email('ravi')));
  await ravi.getByRole('button', {name: 'No, I am under 18'}).click(); await ravi.getByText('Nothing about you has been kept').waitFor();
  ok(db.prepare('SELECT count(*) n FROM loop_members WHERE email=?').get(email('ravi')).n === 0, 'under-18 list entry deleted');
  ok(db.prepare('SELECT count(*) n FROM academy_users WHERE email=?').get(email('ravi')).n === 0, 'no account for under-18');

  // ---- 4.6 workshop session: facilitator starts; learner practises with hints, uploads own work, submits ----
  await fac.goto(`${base}/loop/facilitate/${cohortId}`); await fac.getByRole('button', {name: 'Start the workshop practice session'}).click();
  await fac.getByText(/0 of 1 have finished/).waitFor(); checks++;
  await asha.goto(base + '/loop'); await asha.getByRole('link', {name: 'Workshop: your first practice task'}).click();
  await asha.getByText('Re-add totals yourself').waitFor(); checks++; // checked guidance visible
  const dir = mkdtempSync(join(tmpdir(), 'loop-up-')), file = join(dir, 'my-invoice.txt');
  writeFileSync(file, 'SYNTHETIC invoice total 1,180'.repeat(40000)); // ~1.1 MB: several chunks
  await asha.getByLabel(/Attach your own work/).setInputFiles(file); await asha.getByRole('button', {name: 'Upload'}).click();
  await asha.getByText('Uploaded my-invoice.txt. Only you can see it.').waitFor(); checks++;
  await asha.getByLabel('Your question').fill('Just give me the answer'); await asha.getByRole('button', {name: 'Ask for a hint'}).click();
  await asha.getByText(/\[fake:coach-hint\]/).waitFor(); checks++;
  await asha.getByLabel('My attempt').fill('Totals look wrong on line 3'); await asha.getByRole('button', {name: 'Save my attempt'}).click(); await asha.getByText('Attempt saved.').waitFor();
  await asha.getByLabel('Your question').fill('Is my attempt right?'); await asha.getByRole('button', {name: 'Ask for a hint'}).click();
  await asha.getByText(/\[fake:coach-feedback\]/).waitFor(); checks++;
  await asha.getByLabel(/What changed in your work/).fill('Found a wrong total on a real invoice');
  await asha.getByLabel(/Which of your files/).selectOption({label: 'my-invoice.txt'});
  await asha.getByRole('button', {name: 'Submit my result'}).click(); await asha.getByText('You submitted this task.').waitFor();
  ok(db.prepare(`SELECT week, has_artefact FROM loop_submissions WHERE member_id=?`).get(mem).week === 0, 'workshop cycle is week 0');

  // ---- facilitator sees completion only; admin sees aggregates only; file not reachable by others ----
  await fac.reload(); await fac.getByText(/1 of 1 have finished/).waitFor(); checks++;
  const facHtml = await fac.content(); ok(!facHtml.includes('my-invoice') && !facHtml.includes('wrong total'), 'no files or answers for the facilitator');
  await admin.goto(`${base}/loop/cohort/${cohortId}`); await admin.getByText('Progress (aggregates only)').waitFor();
  ok((await admin.getByRole('cell', {name: /100% \(1\/1/}).count()) >= 1, 'week 0 aggregate shown');
  ok(!(await admin.content()).includes('wrong total'), 'admin sees no notes');
  const fileId = db.prepare('SELECT id FROM loop_files WHERE member_id=?').get(mem).id;
  ok((await admin.evaluate(async id => (await fetch('/api/loop/files/' + id)).status, fileId)) === 403, 'admin cannot fetch the learner file');
  ok((await asha.evaluate(async id => (await fetch('/api/loop/files/' + id)).status, fileId)) === 200, 'owner can fetch their file');

  // ---- 7.3 owner switches AI off: task still works with a notice ----
  decide('ai.enabled', {enabled: false});
  await asha.goto(base + '/loop/history/' + mem); await asha.getByText('Found a wrong total on a real invoice').waitFor(); checks++;
  const taskId = db.prepare(`SELECT id FROM loop_tasks WHERE member_id=?`).get(mem).id;
  await asha.goto(`${base}/loop/task/${taskId}`); await asha.getByRole('heading', {name: 'Checked guidance'}).waitFor(); ok(await asha.getByText(/AI help is paused/).isVisible(), 'paused notice'); // task works with AI off

  // ---- help from any screen; export and settings ----
  await asha.getByRole('link', {name: 'Help'}).click(); await asha.getByText('Common questions').waitFor(); checks++;
  await asha.goto(base + '/loop/settings'); await asha.getByText('Email reminders: on').waitFor().catch(() => {});
  const exp = await asha.evaluate(async () => (await (await fetch('/api/loop/export')).json()).memberships[0].submissions.length);
  ok(exp === 1, 'export contains my submission');
  console.log(JSON.stringify({checks, passed: true}));
} finally { await browser.close(); }
