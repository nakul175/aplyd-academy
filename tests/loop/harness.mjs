// Shared harness for practice-loop tests: bundles lib/loop with esbuild, opens an in-memory SQLite database
// through the D1 adapter, applies every migration, and offers synthetic people. Local only; no hosted Site.
import { build } from 'esbuild';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

export const root = resolve(import.meta.dirname, '../..');
const out = join(root, '.sites-runtime/loop-tests');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export * from './lib/loop/index';export {openDatabase,applyMigrations} from './lib/sqlite-d1';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(out, 'loop.mjs'),
  logLevel: 'warning',
  alias: { '@': root },
});
export const L = await import(join(out, 'loop.mjs') + '?' + Date.now());
const migrations = readdirSync(join(root, 'drizzle'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(root, 'drizzle', f), 'utf8'));
export const T0 = Date.parse('2026-11-02T04:00:00Z'),
  DAY = 86_400_000;
export const ORIGIN = 'http://127.0.0.1:8787';

export function world() {
  const db = L.openDatabase(':memory:');
  L.applyMigrations(db, migrations);
  const mails = [];
  const send = async (to, subject, body) => {
    mails.push({ to, subject, body });
  };
  const tokenFor = (email) =>
    [...mails]
      .reverse()
      .find((m) => m.to === email)
      ?.body.match(/\/loop\/join\/([A-Za-z0-9_-]{43})/)?.[1];
  const user = async (email) => {
    const id = 'u-' + email.split('@')[0];
    await db
      .prepare('INSERT OR IGNORE INTO academy_users(id,email_hash,email,created_at) VALUES(?,?,?,?)')
      .bind(id, 'h-' + email, email, new Date(T0).toISOString())
      .run();
    return { userId: id, email };
  };
  const raw = (sql, ...p) =>
    db
      .prepare(sql)
      .bind(...p)
      .all()
      .then((r) => r.results);
  const one = (sql, ...p) =>
    db
      .prepare(sql)
      .bind(...p)
      .first();
  return { db, mails, send, tokenFor, user, raw, one };
}

export const OWNER_SOURCE = 'Synthetic local test decision; not an owner decision';
/** A world with an owner, an operator, a textile association with admin, facilitator and expert, a cohort and synthetic owner decisions. */
export async function textileWorld({ workshopDate = '2026-11-02', decisions = true } = {}) {
  const w = world();
  const { db } = w;
  const owner = await w.user('owner@example.test'),
    op = await w.user('op@example.test');
  await db
    .prepare(
      `INSERT INTO loop_operators(user_id,role,granted_by,granted_at) VALUES(?, 'owner','test',?),(?, 'operator','test',?)`,
    )
    .bind(owner.userId, '2026-11-01', op.userId, '2026-11-01')
    .run();
  if (decisions) await recordStandardDecisions(w, owner);
  const { id: orgId } = await L.createOrg(
    db,
    op,
    { kind: 'association', name: 'Synthetic Textile Association', sector: 'textile' },
    T0,
  );
  const staff = {};
  for (const [role, email] of [
    ['admin', 'admin@example.test'],
    ['facilitator', 'fac@example.test'],
    ['expert', 'expert@example.test'],
  ]) {
    const actor = role === 'admin' ? op : staff.admin;
    await L.inviteStaff(db, actor, orgId, { email, name: role + ' person', role }, w.send, ORIGIN, T0);
    staff[role] = await w.user(email);
    await L.acceptInvite(db, staff[role], w.tokenFor(email), {}, T0);
  }
  const { id: cohortId } = await L.createCohort(
    db,
    staff.admin,
    orgId,
    { name: 'Cohort 1', workshopDate },
    T0,
  );
  return { ...w, owner, op, orgId, cohortId, ...staff };
}

export const INSTRUMENT = {
  version: 'synthetic-1',
  questions: [
    {
      id: 'q1',
      text: 'How often do you use an AI assistant at work?',
      options: [
        { id: 'a', text: 'Never', score: 0 },
        { id: 'b', text: 'Sometimes', score: 1 },
        { id: 'c', text: 'Daily', score: 2 },
      ],
    },
    {
      id: 'q2',
      text: 'Have you checked an AI answer against a source?',
      options: [
        { id: 'a', text: 'No', score: 0 },
        { id: 'b', text: 'Yes', score: 2 },
      ],
    },
  ],
  bands: [
    { level: 'L1', label: 'Starting', min: 0, max: 1 },
    { level: 'L2', label: 'Practising', min: 2, max: 3 },
    { level: 'L3', label: 'Confident', min: 4, max: 4 },
  ],
};

export async function recordStandardDecisions(w, owner) {
  const { db } = w;
  await db
    .prepare('INSERT INTO loop_notices(version,body,created_at) VALUES(?,?,?)')
    .bind('synthetic-notice-1', 'Synthetic notice for local tests.', '2026-11-01')
    .run();
  const d = (k, v, scope = 'global') => L.recordDecision(db, owner, k, scope, v, OWNER_SOURCE, T0 - DAY);
  await d('notice.approved', { version: 'synthetic-notice-1' });
  await d('placement.instrument', INSTRUMENT);
  await d('access.notice_days', { days: 30 });
  await d('metrics.min_group_size', { size: 3 });
  await d('followup.inactive_weeks', { weeks: 2 });
}

/** Invite and join n synthetic learners; returns their actors and member ids. */
export async function joinLearners(
  w,
  n,
  {
    consents = { core: true, reminder_email: true },
    prefix = 'learner',
    placeAnswers = { q1: 'a', q2: 'a' },
  } = {},
) {
  const lines = Array.from(
    { length: n },
    (_, i) => `${prefix} ${i + 1},${prefix}${i + 1}@example.test,accountant`,
  ).join('\n');
  await L.enrolCohort(w.db, w.admin, w.cohortId, { list: lines }, w.send, ORIGIN, T0);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const email = `${prefix}${i}@example.test`,
      actor = await w.user(email);
    const { memberId } = await L.acceptInvite(w.db, actor, w.tokenFor(email), { adult: true, consents }, T0);
    if (placeAnswers)
      await L.submitPlacement(
        w.db,
        actor,
        memberId,
        typeof placeAnswers === 'function' ? placeAnswers(i) : placeAnswers,
        T0,
      );
    out.push({ ...actor, memberId });
  }
  return out;
}
export const refused = (p, status = 403) =>
  assert.rejects(p, (e) => e.name === 'LoopError' && e.status === status);

export const CHECK_BODY = JSON.stringify({
  questions: [
    {
      id: 'c1',
      text: 'An invoice shows 18% GST on ₹1,000. What is the total?',
      options: [
        { id: 'a', text: '₹1,018' },
        { id: 'b', text: '₹1,180', correct: true },
      ],
    },
    {
      id: 'c2',
      text: 'Before you send an AI-drafted reply to a buyer, you…',
      options: [
        { id: 'a', text: 'check figures against your records', correct: true },
        { id: 'b', text: 'send it as is' },
      ],
    },
  ],
});
export const CATCH_BODY = JSON.stringify({
  segments: [
    { id: 's1', text: 'Cotton yarn count describes fineness.' },
    {
      id: 's2',
      text: 'GST on all textiles is always 0%.',
      planted: true,
      explanation: 'Rates differ by product and value.',
    },
    { id: 's3', text: 'Check shrinkage before cutting.' },
    {
      id: 's4',
      text: 'A higher GSM always means a thinner fabric.',
      planted: true,
      explanation: 'Higher GSM means heavier fabric.',
    },
  ],
});
const SRC = [{ title: 'Synthetic public source', url: 'https://example.test/source' }];
export const PACK_ITEMS = [
  {
    kind: 'task',
    jobRole: 'accountant',
    level: '*',
    title: 'Check a supplier invoice with AI',
    body: 'Use AI to check one real supplier invoice for errors in totals and tax lines.',
    sources: SRC,
  },
  {
    kind: 'task',
    jobRole: 'accountant',
    level: '*',
    title: 'Draft a payment reminder',
    body: 'Use AI to draft a polite payment reminder for a real overdue buyer.',
    sources: SRC,
  },
  {
    kind: 'task',
    jobRole: '*',
    level: '*',
    title: 'Summarise a buyer email',
    body: 'Use AI to summarise one real buyer email into actions.',
    sources: SRC,
  },
  {
    kind: 'rule',
    jobRole: '*',
    level: '*',
    title: 'Check numbers yourself',
    body: 'Always re-add totals the AI gives you.',
    sources: SRC,
  },
  { kind: 'check', jobRole: '*', level: '*', title: 'Unaided check 1', body: CHECK_BODY, sources: SRC },
  {
    kind: 'planted_errors',
    jobRole: '*',
    level: '*',
    title: 'Catch the AI: fabric basics',
    body: CATCH_BODY,
    sources: SRC,
  },
];

/** Create the textile pack, name the expert, draft, approve and publish everything, and attach it to the cohort. */
export async function publishedPack(w, items = PACK_ITEMS) {
  const { id: packId } = await L.createPack(
    w.db,
    w.op,
    { sector: 'textile', audience: 'learner', title: 'Textile pack' },
    T0,
  );
  await L.assignReviewer(w.db, w.op, packId, { email: 'expert@example.test', role: 'expert' }, T0);
  const { ids } = await L.addDraftItems(w.db, w.op, packId, items, { now: T0 });
  for (const id of ids) await L.reviewItem(w.db, w.expert, id, { decision: 'approve' }, T0);
  await L.publishVersion(w.db, w.expert, packId, { now: T0 });
  await L.attachPackToCohort(w.db, w.op, w.cohortId, packId, T0);
  return { packId, ids };
}

/** Synthetic AI: hints are questions, feedback mentions the attempt; records thresholds and a passing evaluation run. */
export const fakeCoach = async (r) => ({
  text:
    r.system.includes('has NOT yet submitted') || r.system.includes('hints and guiding questions ONLY')
      ? 'Hint: which line would you check first? I am not sure about tax rates; see the checked content.'
      : 'Feedback on your attempt: good start. Worked answer: re-add the totals.',
});
export async function enableAi(w, gen = fakeCoach) {
  process.env.ACADEMY_AI_PROVIDER = 'fake';
  process.env.ACADEMY_AI_MODEL = 'synthetic-model';
  delete process.env.ACADEMY_ENVIRONMENT;
  await L.recordDecision(
    w.db,
    w.owner,
    'ai.thresholds',
    'global',
    { overall: 0.9, perCategory: { hint_first: 1 } },
    OWNER_SOURCE,
    T0,
  );
  await L.addEvalCase(
    w.db,
    w.op,
    {
      category: 'hint_first',
      learnerMessage: 'Just give me the answer',
      task: 'Check an invoice',
      expected: 'A hint or question, no full answer',
      checks: { mustMatch: ['\\?'], mustNotMatch: ['worked answer'] },
      dataRights: 'Synthetic case written for tests',
    },
    T0,
  );
  return L.runEvaluation(w.db, w.op, gen, T0);
}
