// Regression tests for the independent review of 13 October 2026 (findings 1-22, see docs/security/findings.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  L,
  T0,
  DAY,
  ORIGIN,
  textileWorld,
  joinLearners,
  refused,
  publishedPack,
  OWNER_SOURCE,
  fakeCoach,
} from './harness.mjs';

const W = (n) => T0 + n * 7 * DAY + 3600_000;
const decide = (w, k, v, scope = 'global') => L.recordDecision(w.db, w.owner, k, scope, v, OWNER_SOURCE, T0);

test('R2: a task finished late counts in the week it is finished, so A-01 cannot be met in one sitting', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const t2 = await L.ensureWeeklyTask(w.db, a, a.memberId, W(2)),
    t3 = await L.ensureWeeklyTask(w.db, a, a.memberId, W(3)),
    t6 = await L.ensureWeeklyTask(w.db, a, a.memberId, W(6));
  for (const t of [t2, t3, t6]) await L.submitTask(w.db, a, t.taskId, { note: 'n' }, W(6));
  assert.deepEqual(
    (await w.raw('SELECT DISTINCT week FROM loop_submissions')).map((r) => r.week),
    [6],
  );
  assert.equal((await L.a01(w.db, [w.cohortId]))[0].share.numerator, 0);
});

test('R3: once a run has failed, no threshold can go below the highest value recorded before', async () => {
  const w = await textileWorld();
  process.env.ACADEMY_AI_PROVIDER = 'fake';
  process.env.ACADEMY_AI_MODEL = 'm';
  await decide(w, 'ai.thresholds', { overall: 0.9 });
  await L.addEvalCase(
    w.db,
    w.op,
    {
      category: 'hint_first',
      learnerMessage: 'x',
      task: 't',
      expected: 'e',
      checks: { mustMatch: ['NEVER'] },
      dataRights: 'synthetic',
    },
    T0,
  );
  assert.equal((await L.runEvaluation(w.db, w.op, fakeCoach, T0)).passed, false);
  await decide(w, 'ai.thresholds', { overall: 0.95 });
  await refused(decide(w, 'ai.thresholds', { overall: 0 }), 409);
});

test('R4: every retention record type runs, including invites and sessions keyed by token hash', async () => {
  const w = await textileWorld();
  await decide(w, 'retention.periods', {
    days: Object.fromEntries(Object.keys(L.RECORD_TYPES).map((k) => [k, 1])),
  });
  const r = await L.runRetention(w.db, 'test', T0 + 400 * DAY);
  assert.ok(r.counts.invites >= 3, 'expired staff invites deleted');
  assert.equal((await w.one(`SELECT count(*) n FROM loop_deletion_runs`)).n, 1);
  assert.ok((await L.reapplyDeletionLog(w.db, T0 + 401 * DAY)).entries >= 3);
});

async function school(w) {
  const { id: orgId } = await L.createOrg(
    w.db,
    w.op,
    { kind: 'school', name: 'S', sector: 'education', agreementRef: 'x' },
    T0,
  );
  await L.inviteStaff(
    w.db,
    w.op,
    orgId,
    { email: 'head@example.test', name: 'Head', role: 'admin' },
    w.send,
    ORIGIN,
    T0,
  );
  const head = await w.user('head@example.test');
  await L.acceptInvite(w.db, head, w.tokenFor('head@example.test'), {}, T0);
  const { id: cohortId } = await L.createCohort(
    w.db,
    head,
    orgId,
    { name: 'C', workshopDate: '2026-11-02' },
    T0,
  );
  await decide(w, 'student.agreement', { ref: 'a' }, orgId);
  await decide(
    w,
    'student.legal_review',
    { ref: 'r', parentalConsentRequired: false, teacherMaySee: ['practice_counts'] },
    orgId,
  );
  await decide(w, 'golive.decision', { decision: 'go' });
  return { orgId, cohortId, head };
}

test('R5: a teacher’s digest shows only their own class; without a class it is refused', async () => {
  const w = await textileWorld();
  const s = await school(w);
  await L.enrolCohort(
    w.db,
    s.head,
    s.cohortId,
    { list: 'Kid A,ka@example.test,8a\nKid B,kb@example.test,8b', role: 'student' },
    w.send,
    ORIGIN,
    T0,
  );
  for (const e of ['ka@example.test', 'kb@example.test'])
    await L.acceptInvite(w.db, await w.user(e), w.tokenFor(e), { consents: { core: true } }, T0);
  await L.enrolCohort(
    w.db,
    s.head,
    s.cohortId,
    { list: 'Teach,t@example.test,maths', role: 'teacher' },
    w.send,
    ORIGIN,
    T0,
  );
  const t = await w.user('t@example.test');
  const { memberId } = await L.acceptInvite(
    w.db,
    t,
    w.tokenFor('t@example.test'),
    { adult: true, consents: { core: true } },
    T0,
  );
  await refused(L.schoolReminderDigest(w.db, t, s.cohortId, ORIGIN, T0));
  await L.assignClassTeacher(w.db, s.head, s.orgId, '8a', memberId, T0);
  assert.deepEqual(
    (await L.schoolReminderDigest(w.db, t, s.cohortId, ORIGIN, T0)).students.map((x) => x.name),
    ['Kid A'],
  );
  assert.equal((await L.schoolReminderDigest(w.db, s.head, s.cohortId, ORIGIN, T0)).students.length, 2);
});

test('R6 + R19: a harm-review stop and ended access block every practice action, not only new weekly tasks', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const t = await L.ensureWeeklyTask(w.db, a, a.memberId, W(1));
  const c = await L.ensureCatchTask(w.db, a, a.memberId, W(1));
  const after = Date.parse('2027-11-03T00:00:00Z');
  await refused(L.submitTask(w.db, a, t.taskId, { note: 'x' }, after));
  await refused(L.submitCatch(w.db, a, c.taskId, [], after));
  await refused(L.submitAttempt(w.db, a, t.taskId, 'x', after));
  assert.ok((await L.taskView(w.db, a, t.taskId, after)).task, 'viewing stays possible');
});

test('R7: a later start group gets the same full year of access', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const people = await joinLearners(w, 4);
  await decide(
    w,
    'staggered.agreement',
    {
      agreementRef: 'x',
      groups: [
        { label: 'A', start: '2026-11-02' },
        { label: 'B', start: '2027-05-02' },
      ],
    },
    w.cohortId,
  );
  await L.setupStartGroups(w.db, w.admin, w.cohortId, T0);
  const b = (await w.raw(`SELECT id FROM loop_members WHERE cohort_id=? AND start_group='B'`, w.cohortId))[0];
  assert.ok(b, 'someone is in group B');
  assert.equal((await L.accessWindow(w.db, await L.memberById(w.db, b.id))).ends, '2028-05-02');
  assert.ok(people.length);
});

test('R8: an under-18 refusal stays deleted after a restore', async () => {
  const w = await textileWorld();
  await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    { list: 'Young,young@example.test,helper' },
    w.send,
    ORIGIN,
    T0,
  );
  const row = await w.one(`SELECT * FROM loop_members WHERE email='young@example.test'`);
  await L.declineUnder18(w.db, w.tokenFor('young@example.test'), T0);
  await w.db
    .prepare(
      `INSERT INTO loop_members(id,org_id,cohort_id,role,email,name,job_role,status,invited_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      row.id,
      row.org_id,
      row.cohort_id,
      row.role,
      row.email,
      row.name,
      row.job_role,
      'invited',
      row.invited_at,
    )
    .run(); // restored from backup
  await L.reapplyDeletionLog(w.db, T0 + DAY);
  assert.equal((await w.one(`SELECT count(*) n FROM loop_members WHERE email='young@example.test'`)).n, 0);
});

test('R13 + R14: placement cannot be resubmitted; prototype names are not actions', async () => {
  const w = await textileWorld();
  const [a] = await joinLearners(w, 1);
  await refused(L.submitPlacement(w.db, a, a.memberId, { q1: 'c', q2: 'b' }, T0), 409);
  for (const action of ['constructor', '__proto__', 'toString', 'hasOwnProperty'])
    await assert.rejects(
      L.dispatch({ db: w.db, actor: null, origin: ORIGIN, now: T0 }, { action }),
      (e) => e.status === 404,
    );
});
