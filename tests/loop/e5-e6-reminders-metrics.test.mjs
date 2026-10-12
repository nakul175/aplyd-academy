// ACA-E5 reminders (5.1-5.4) and ACA-E6 metrics, reports, export, deletion and retention (6.1-6.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
} from './harness.mjs';

process.env.ACADEMY_FILES_PATH = mkdtempSync(join(tmpdir(), 'loop-files-'));
const W = (n) => T0 + n * 7 * DAY + 3600_000; // start of week n (T0 is a Monday 04:00 UTC; workshop day)
const outbox = async (w) => w.raw('SELECT channel, to_address, body FROM loop_message_outbox ORDER BY id');

test('5.1: an opted-in learner gets one WhatsApp message a week with the task link, first name only; STOP ends it', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  await L.recordDecision(
    w.db,
    w.owner,
    'reminders.channel',
    'global',
    { channel: 'whatsapp' },
    OWNER_SOURCE,
    T0,
  );
  await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    { list: 'Asha Rao Kumari,asha@example.test,accountant,+919876543210' },
    w.send,
    ORIGIN,
    T0,
  );
  const asha = await w.user('asha@example.test');
  const { memberId } = await L.acceptInvite(
    w.db,
    asha,
    w.tokenFor('asha@example.test'),
    { adult: true, consents: { core: true, reminder_whatsapp: true } },
    T0,
  );
  await L.submitPlacement(w.db, asha, memberId, { q1: 'a', q2: 'a' }, T0);
  const senders = L.outboxSenders(w.db);
  const t1 = await L.runReminders(w.db, senders, ORIGIN, W(1));
  assert.equal(t1.weekly_sent, 1);
  await L.runReminders(w.db, senders, ORIGIN, W(1) + 3600_000);
  const msgs = await outbox(w);
  assert.equal(msgs.length, 1, 'one per week');
  assert.equal(msgs[0].channel, 'whatsapp');
  assert.equal(msgs[0].to_address, '+919876543210');
  assert.match(msgs[0].body, /^Hi Asha, .*\/loop\/task\/task-/s);
  assert.ok(
    !msgs[0].body.includes('Rao') && !msgs[0].body.includes('invoice'),
    'first name and link only, no work content',
  );
  await L.handleStop(w.db, 'whatsapp', '919876543210', W(1) + DAY);
  assert.equal(await L.hasConsent(w.db, memberId, 'reminder_whatsapp'), false);
  await L.runReminders(w.db, senders, ORIGIN, W(2));
  assert.equal((await outbox(w)).length, 1, 'no WhatsApp after STOP (and no other channel was chosen)');
});

test('5.1 AC3 + 5.2: no opt-in, no message; the owner switches channel and email-only learners get only email', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [none] = await joinLearners(w, 1, { consents: { core: true }, prefix: 'quiet' });
  const [mail] = await joinLearners(w, 1, { consents: { core: true, reminder_email: true }, prefix: 'mail' });
  await L.recordDecision(
    w.db,
    w.owner,
    'reminders.channel',
    w.cohortId,
    { channel: 'sms' },
    OWNER_SOURCE,
    T0,
  );
  const r = await L.runReminders(w.db, L.outboxSenders(w.db), ORIGIN, W(1));
  const msgs = await outbox(w);
  assert.deepEqual(
    msgs.map((m) => [m.channel, m.to_address]),
    [['email', 'mail1@example.test']],
  );
  assert.equal(r.weekly_skipped, 1);
  assert.equal(
    (await w.one(`SELECT reason FROM loop_reminders WHERE member_id=?`, none.memberId)).reason,
    'no opted-in channel',
  );
});

test('5.3: with approved cadences learners are assigned and recorded; S-01 is reported by cadence group', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const ls = await joinLearners(w, 6);
  await refused(L.assignCadences(w.db, w.admin, w.cohortId, T0), 409);
  await L.recordDecision(
    w.db,
    w.owner,
    'reminders.cadences',
    w.cohortId,
    {
      cadences: [
        { id: 'mon', days: [1] },
        { id: 'mon-thu', days: [1, 4] },
      ],
    },
    OWNER_SOURCE,
    T0,
  );
  assert.equal((await L.assignCadences(w.db, w.admin, w.cohortId, T0)).assigned, 6);
  const rows = await w.raw(
    'SELECT cadence, count(*) n, min(decision_ref) ref FROM loop_cadence_assignments GROUP BY cadence',
  );
  assert.deepEqual(
    rows.map((r) => [r.cadence, r.n]),
    [
      ['mon', 3],
      ['mon-thu', 3],
    ],
  );
  assert.match(rows[0].ref, /reminders.cadences@/);
  const t = await L.ensureWeeklyTask(w.db, ls[0], ls[0].memberId, W(2));
  await L.submitTask(w.db, ls[0], t.taskId, { note: 'x' }, W(2));
  const m = await L.weeklyMetrics(w.db, [w.cohortId], [2], 'cadence');
  assert.deepEqual(
    m[0].groups.map((g) => g.group),
    ['mon', 'mon-thu'],
  );
  assert.equal(
    m[0].groups.reduce((s, g) => s + g.S01.numerator, 0),
    1,
  );
});

test('5.4: learners inactive for the owner’s number of weeks appear on the list; a logged follow-up and new practice clear it', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  const tb = await L.ensureWeeklyTask(w.db, b, b.memberId, W(2));
  await L.submitTask(w.db, b, tb.taskId, { note: 'done' }, W(2));
  const list = await L.followUpList(w.db, w.facilitator, w.cohortId, W(3));
  assert.deepEqual(
    list.learners.map((l) => l.name),
    ['learner 1'],
  );
  await refused(L.followUpList(w.db, w.admin, w.cohortId, W(3)));
  await L.logFollowUp(
    w.db,
    w.facilitator,
    a.memberId,
    'Called; busy with orders, will practise Friday',
    W(3),
  );
  assert.match(
    (await L.followUpList(w.db, w.facilitator, w.cohortId, W(3))).learners[0].lastFollowUp.outcome,
    /Called/,
  );
  const ta = await L.ensureWeeklyTask(w.db, a, a.memberId, W(3));
  await L.submitTask(w.db, a, ta.taskId, { note: 'done' }, W(3) + DAY);
  assert.equal((await L.followUpList(w.db, w.facilitator, w.cohortId, W(3) + 2 * DAY)).learners.length, 0);
});

test('6.1: S-01 and S-02 equal hand-computed values on a synthetic cohort, including inactive learners and week 0', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const ls = await joinLearners(w, 5, {
    placeAnswers: (i) => (i <= 2 ? { q1: 'a', q2: 'a' } : { q1: 'c', q2: 'b' }),
  });
  await L.startWorkshop(w.db, w.facilitator, w.cohortId, T0);
  const ws = await w.one(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='workshop'`, ls[0].memberId);
  await L.submitTask(w.db, ls[0], ws.id, { note: 'week 0', link: 'https://example.test/a' }, T0 + 3600_000);
  // week 2: learners 1, 2 and 3 practise; 1 and 3 with an artefact. Learners 4 and 5 are inactive.
  for (const [i, link] of [
    [0, 'https://example.test/x'],
    [1, null],
    [2, 'https://example.test/y'],
  ]) {
    const t = await L.ensureWeeklyTask(w.db, ls[i], ls[i].memberId, W(2));
    await L.submitTask(w.db, ls[i], t.taskId, { note: 'n', ...(link ? { link } : {}) }, W(2));
  }
  const [wk0, wk2] = await L.weeklyMetrics(w.db, [w.cohortId], [0, 2]);
  assert.deepEqual([wk0.groups[0].S01.numerator, wk0.groups[0].S01.denominator], [1, 5]);
  assert.deepEqual(
    [wk2.groups[0].S01.numerator, wk2.groups[0].S01.denominator, wk2.groups[0].S01.value],
    [3, 5, 0.6],
  );
  assert.deepEqual([wk2.groups[0].S02.numerator, wk2.groups[0].S02.denominator], [2, 3]);
  const byLevel = (await L.weeklyMetrics(w.db, [w.cohortId], [2], 'starting_level'))[0].groups;
  assert.deepEqual(
    byLevel.map((g) => [g.group, g.S01.numerator, g.S01.denominator]),
    [
      ['L1', 2, 2],
      ['L3', 1, 3],
    ],
  );
  const ci = wk2.groups[0].S01;
  assert.ok(ci.low < 0.6 && ci.high > 0.6);
});

test('6.2: the admin sees aggregates for their own cohort only, small groups suppressed, no individual work', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const ls = await joinLearners(w, 4, {
    placeAnswers: (i) => (i <= 3 ? { q1: 'a', q2: 'a' } : { q1: 'c', q2: 'b' }),
  });
  const t = await L.ensureWeeklyTask(w.db, ls[0], ls[0].memberId, W(1));
  await L.submitTask(w.db, ls[0], t.taskId, { note: 'PRIVATE-NOTE' }, W(1));
  const d = await L.adminDashboard(w.db, w.admin, w.cohortId, W(1));
  assert.equal(d.weekly[1].groups[0].S01.numerator, 1);
  assert.equal(d.weekly[1].groups[0].S01.denominator, 4);
  const l3 = d.byStartingLevel[1].groups.find((g) => g.group === 'L3');
  assert.equal(l3.suppressed, true, 'a group of 1 person is hidden as a whole (minimum 3)');
  assert.ok(!('S02' in l3) && !('groupSize' in l3), 'no counts of a hidden group leak');
  assert.ok(!JSON.stringify(d).includes('PRIVATE-NOTE') && !JSON.stringify(d).includes('learner1@'));
  await refused(L.adminDashboard(w.db, w.facilitator, w.cohortId, W(1)));
});

test('6.3: the week-6 report applies the 35% rule and records no decision; only the owner records continue or redesign', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const ls = await joinLearners(w, 5);
  for (const i of [0, 1])
    for (const wk of [2, 4, 6]) {
      const t = await L.ensureWeeklyTask(w.db, ls[i], ls[i].memberId, W(wk));
      await L.submitTask(w.db, ls[i], t.taskId, { note: 'n' }, W(wk));
    }
  for (const wk of [2, 3]) {
    const t = await L.ensureWeeklyTask(w.db, ls[2], ls[2].memberId, W(wk));
    await L.submitTask(w.db, ls[2], t.taskId, { note: 'n' }, W(wk));
  }
  const r = await L.prepareWeek6Report(w.db, w.op, w.cohortId, W(7));
  assert.deepEqual(
    [r.body.result.share.numerator, r.body.result.share.denominator, r.body.result.meetsThreshold],
    [2, 5, true],
  );
  assert.equal(r.body.decision, null);
  assert.equal(
    await L.decision(w.db, 'a01.decision', w.cohortId),
    null,
    'the report records nothing by itself',
  );
  await refused(L.recordA01Decision(w.db, w.op, r.id, { decision: 'continue' }, W(7)));
  await L.recordA01Decision(w.db, w.owner, r.id, { decision: 'redesign', source: 'Synthetic test' }, W(7));
  const d = await L.decision(w.db, 'a01.decision', w.cohortId);
  assert.equal(d.value.decision, 'redesign');
  assert.match(d.value.linkedTo, /STRATEGY-ACADEMY-01/);
  await refused(L.createCohort(w.db, w.admin, w.orgId, { name: 'Cohort 2' }, W(8))); // S4 rule (10.5, 14.2)
  await L.recordDecision(
    w.db,
    w.owner,
    'a01.redesign_accepted',
    w.orgId,
    { loopVersion: 'loop-2' },
    OWNER_SOURCE,
    W(9),
  );
  assert.equal(
    (await L.createCohort(w.db, w.admin, w.orgId, { name: 'Cohort 2' }, W(9))).loopVersion,
    'loop-2',
  );
});

test('6.4: a learner exports a readable file and erasure deletes their loop records and files, logged for restores', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  const t = await L.ensureWeeklyTask(w.db, a, a.memberId, W(1));
  const data = Buffer.from('my private sheet');
  const sha = createHash('sha256').update(data).digest('hex');
  const up = await L.startUpload(
    w.db,
    a,
    a.memberId,
    { taskId: t.taskId, name: 'sheet.csv', mime: 'text/csv', size: data.length, sha256: sha },
    W(1),
  );
  await L.uploadChunk(w.db, a, up.fileId, 0, data, W(1));
  await L.submitTask(w.db, a, t.taskId, { note: 'my note', fileId: up.fileId }, W(1));
  const ex = await L.exportLoopData(w.db, a);
  assert.equal(ex.memberships[0].submissions[0].note, 'my note');
  assert.equal(ex.memberships[0].files[0].name, 'sheet.csv');
  assert.ok(!JSON.stringify(ex).includes('learner2@'), 'only my data');
  await L.eraseLoopData(w.db, a.userId, W(2));
  for (const tbl of [
    'loop_members',
    'loop_submissions',
    'loop_tasks',
    'loop_files',
    'loop_consents',
    'loop_levels',
  ])
    assert.equal(
      (
        await w.one(
          `SELECT count(*) n FROM ${tbl} WHERE ${tbl === 'loop_members' ? 'id' : 'member_id'}=?`,
          a.memberId,
        )
      ).n,
      0,
      tbl,
    );
  assert.equal(
    existsSync(join(process.env.ACADEMY_FILES_PATH, a.memberId)),
    false,
    'files removed from disk',
  );
  assert.equal(
    (await w.one(`SELECT count(*) n FROM loop_members WHERE id=?`, b.memberId)).n,
    1,
    'others untouched',
  );
  assert.deepEqual(
    (await w.raw(`SELECT tbl FROM loop_deletion_log ORDER BY id`)).map((r) => r.tbl),
    ['member', 'user'],
  );
  assert.equal((await w.one(`SELECT count(*) n FROM loop_audit WHERE actor=?`, a.userId)).n, 0);
});

test('6.5: the scheduled job deletes exactly the records past the owner’s periods, logs counts, and re-applies after a restore', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const t = await L.ensureWeeklyTask(w.db, a, a.memberId, W(1));
  await L.submitAttempt(w.db, a, t.taskId, 'old attempt', W(1));
  await L.submitAttempt(w.db, a, t.taskId, 'new attempt', W(1) + 40 * DAY);
  const none = await L.runRetention(w.db, 'test', W(1) + 41 * DAY);
  assert.deepEqual(none.counts, {}, 'no owner periods: nothing deleted');
  await L.recordDecision(
    w.db,
    w.owner,
    'retention.periods',
    'global',
    { days: { attempts: 30 } },
    OWNER_SOURCE,
    W(1),
  );
  const r = await L.runRetention(w.db, 'test', W(1) + 41 * DAY);
  assert.deepEqual(r.counts, { attempts: 1 });
  assert.deepEqual(
    (await w.raw('SELECT body FROM loop_attempts')).map((x) => x.body),
    ['new attempt'],
  );
  // simulate a restore: the old row comes back from a backup; re-applying the log removes it again
  const old = await w.one(`SELECT row_key FROM loop_deletion_log WHERE tbl='loop_attempts'`);
  await w.db
    .prepare(`INSERT INTO loop_attempts(id,task_id,member_id,body,at) VALUES(?,?,?,?,?)`)
    .bind(Number(old.row_key), t.taskId, a.memberId, 'old attempt', new Date(W(1)).toISOString())
    .run();
  const re = await L.reapplyDeletionLog(w.db, W(1) + 42 * DAY);
  assert.equal(re.reapplied, 1);
  assert.deepEqual(
    (await w.raw('SELECT body FROM loop_attempts')).map((x) => x.body),
    ['new attempt'],
  );
  const runs = await w.raw('SELECT trigger, counts FROM loop_deletion_runs ORDER BY id');
  assert.deepEqual(
    runs.map((x) => x.trigger),
    ['test', 'test', 'restore'],
  );
});
