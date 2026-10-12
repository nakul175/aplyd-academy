// ACA-E4 practice loop: 4.1 weekly task and resumable own-work upload, 4.2 hint-first, 4.3 unaided checks,
// 4.4 submissions and history, 4.5 catch-the-AI, 4.6 workshop week 0. Synthetic data, fake AI, temp file store.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {L, T0, DAY, textileWorld, joinLearners, refused, publishedPack, enableAi, fakeCoach, OWNER_SOURCE} from './harness.mjs';

process.env.ACADEMY_FILES_PATH = mkdtempSync(join(tmpdir(), 'loop-files-'));
const W1 = T0 + 8 * DAY, W2 = T0 + 15 * DAY;

test('4.1 AC1: a new week brings a task for the learner’s role and level that asks for their own work; tasks rotate', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  assert.equal((await L.ensureWeeklyTask(w.db, a, a.memberId, T0 + DAY)).state, 'not_started'); // week 0 is the workshop
  const t1 = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  assert.equal(t1.state, 'ready'); assert.equal(t1.week, 1);
  const again = await L.ensureWeeklyTask(w.db, a, a.memberId, W1 + DAY);
  assert.equal(again.taskId, t1.taskId, 'one task per week');
  const v = await L.taskView(w.db, a, t1.taskId, W1);
  assert.match(v.task.prompt, /Bring your own work/); assert.match(v.task.title, /invoice|reminder|buyer email/i);
  const t2 = await L.ensureWeeklyTask(w.db, a, a.memberId, W2);
  assert.notEqual((await L.taskView(w.db, a, t2.taskId, W2)).task.item_id, v.task.item_id, 'the next week rotates to another task');
});

test('4.1 AC2: a file uploads in chunks, survives a dropped connection by resuming from the server offset, and is checked', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const {taskId} = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  const data = Buffer.alloc(1_200_000, 7); data.write('synthetic invoice', 0);
  const sha = createHash('sha256').update(data).digest('hex');
  const s = await L.startUpload(w.db, a, a.memberId, {taskId, name: 'invoice.pdf', mime: 'application/pdf', size: data.length, sha256: sha}, W1);
  let r = await L.uploadChunk(w.db, a, s.fileId, 0, data.subarray(0, s.chunk), W1);
  assert.equal(r.received, s.chunk);
  // connection drops; the client starts again and is told where to resume
  const resumed = await L.startUpload(w.db, a, a.memberId, {taskId, name: 'invoice.pdf', mime: 'application/pdf', size: data.length, sha256: sha}, W1);
  assert.equal(resumed.fileId, s.fileId); assert.equal(resumed.received, s.chunk);
  const stale = await L.uploadChunk(w.db, a, s.fileId, 0, data.subarray(0, 10), W1);
  assert.equal(stale.resumeAt, s.chunk, 'a repeated chunk is not written twice');
  let off = resumed.received;
  while (off < data.length) { r = await L.uploadChunk(w.db, a, s.fileId, off, data.subarray(off, off + s.chunk), W1); off = r.received; }
  assert.equal(r.complete, true);
  const back = await L.readOwnFile(w.db, a, s.fileId, W1);
  assert.ok(Buffer.compare(back.data, data) === 0);
  await refused(L.startUpload(w.db, a, a.memberId, {name: 'x.exe', mime: 'application/x-msdownload', size: 10, sha256: sha}, W1), 415);
  const bad = await L.startUpload(w.db, a, a.memberId, {name: 'b.txt', mime: 'text/plain', size: 4, sha256: '0'.repeat(64)}, W1);
  await refused(L.uploadChunk(w.db, a, bad.fileId, 0, Buffer.from('abcd'), W1), 422);
});

test('4.1 AC3: a work file is not visible to other learners, the admin or the facilitator', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  const data = Buffer.from('private work'); const sha = createHash('sha256').update(data).digest('hex');
  const s = await L.startUpload(w.db, a, a.memberId, {name: 'mine.txt', mime: 'text/plain', size: data.length, sha256: sha}, W1);
  await L.uploadChunk(w.db, a, s.fileId, 0, data, W1);
  for (const other of [b, w.admin, w.facilitator]) await refused(L.readOwnFile(w.db, other, s.fileId, W1));
  const roster = await L.cohortRoster(w.db, w.admin, w.cohortId, W1);
  assert.ok(!JSON.stringify(roster).includes('mine.txt'));
});

test('4.2: hints first; the worked answer only after an attempt; files go to the AI only when AIA-ACADEMY-01 allows', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const sent = []; const gen = async r => { sent.push(r); return fakeCoach(r); };
  await enableAi(w);
  const {taskId} = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  const h = await L.askCoach(w.db, a, taskId, {message: 'Just tell me the answer'}, gen, W1);
  assert.equal(h.mode, 'hint'); assert.match(sent[0].system, /NOT yet submitted/); assert.match(h.reply, /\?/);
  assert.match(sent[0].system, /CHECKED CONTENT:\n- Check numbers yourself/, 'only checked content is given as facts');
  await L.submitAttempt(w.db, a, taskId, 'My totals: 1,180', W1);
  const f = await L.askCoach(w.db, a, taskId, {message: 'Is this right?'}, gen, W1);
  assert.equal(f.mode, 'feedback'); assert.match(f.reply, /Worked answer/); assert.match(sent[1].messages.at(-1).content, /My attempt:\n1,180|My attempt:\nMy totals/);
  const data = Buffer.from('Invoice total 1180'); const sha = createHash('sha256').update(data).digest('hex');
  const up = await L.startUpload(w.db, a, a.memberId, {taskId, name: 'inv.txt', mime: 'text/plain', size: data.length, sha256: sha}, W1);
  await L.uploadChunk(w.db, a, up.fileId, 0, data, W1);
  await refused(L.askCoach(w.db, a, taskId, {message: 'Look at my file', includeFileId: up.fileId}, gen, W1));
  assert.ok(sent.every(r => !JSON.stringify(r).includes('Invoice total 1180')), 'no file content was sent');
  await L.recordDecision(w.db, w.owner, 'ai.files_to_provider', 'global', {allowed: true, aiaVersion: 'synthetic'}, OWNER_SOURCE, W1);
  await L.askCoach(w.db, a, taskId, {message: 'Look at my file', includeFileId: up.fileId}, gen, W1);
  assert.match(sent.at(-1).messages.at(-1).content, /Invoice total 1180/);
});

test('4.3: during an unaided check AI help is off everywhere; results are stored and reported by starting level', async () => {
  const w = await textileWorld(); const {ids} = await publishedPack(w);
  const [a, b] = await joinLearners(w, 2, {placeAnswers: i => i === 1 ? {q1: 'a', q2: 'a'} : {q1: 'c', q2: 'b'}});
  await enableAi(w);
  const weekly = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  await refused(L.scheduleCheck(w.db, a, w.cohortId, ids[4], W1));
  assert.equal((await L.scheduleCheck(w.db, w.facilitator, w.cohortId, ids[4], W1)).created, 2);
  const ct = await w.one(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='check'`, a.memberId);
  const started = await L.startCheck(w.db, a, ct.id, W1);
  assert.equal(started.aiOff, true); assert.ok(!JSON.stringify(started).includes('correct'));
  await refused(L.askCoach(w.db, a, weekly.taskId, {message: 'help'}, fakeCoach, W1 + 60_000), 409);
  assert.equal((await L.taskView(w.db, a, weekly.taskId, W1)).ai.available, false);
  assert.deepEqual(await L.finishCheck(w.db, a, ct.id, {c1: 'b', c2: 'a'}, W1 + 120_000), {score: 2, max: 2});
  const ok = await L.askCoach(w.db, a, weekly.taskId, {message: 'help'}, fakeCoach, W1 + 180_000);
  assert.equal(ok.paused, false, 'AI back after the check');
  const cb = await w.one(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='check'`, b.memberId);
  await L.startCheck(w.db, b, cb.id, W1); await L.finishCheck(w.db, b, cb.id, {c1: 'a', c2: 'a'}, W1);
  const rep = await L.checkReport(w.db, w.cohortId);
  assert.deepEqual(rep.map(r => [r.starting_level, r.learners, r.mean_share]), [['L1', 1, 1], ['L3', 1, 0.5]]);
});

test('4.4: a submission with a note and artefact counts as one cycle; history groups cycles by week', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const t1 = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  await L.submitTask(w.db, a, t1.taskId, {note: 'Found a wrong total', link: 'https://example.test/sheet'}, W1);
  await refused(L.submitTask(w.db, a, t1.taskId, {note: 'again'}, W1), 409);
  const t2 = await L.ensureWeeklyTask(w.db, a, a.memberId, W2);
  await L.submitTask(w.db, a, t2.taskId, {note: 'Reminder sent'}, W2);
  const h = await L.history(w.db, a, a.memberId, W2);
  assert.deepEqual(h.map(x => [x.week, x.cycles.length]), [[2, 1], [1, 1]]);
  const subs = await w.raw('SELECT week, has_artefact FROM loop_submissions ORDER BY week');
  assert.deepEqual(subs.map(s => [s.week, s.has_artefact]), [[1, 1], [2, 0]]);
});

test('4.5: catch-the-AI records caught ÷ shown per learner and keeps month 1 as the baseline', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const c = await L.ensureCatchTask(w.db, a, a.memberId, T0 + 3 * DAY);
  assert.equal(c.month, 1);
  const view = await L.catchView(w.db, a, c.taskId, T0 + 3 * DAY);
  assert.ok(view.segments.every(s => !('planted' in s)), 'answers are hidden until submitted');
  const r = await L.submitCatch(w.db, a, c.taskId, ['s2', 's3'], T0 + 3 * DAY);
  assert.deepEqual(r, {shown: 2, caught: 1, falseMarks: 1, baseline: true});
  const after = await L.catchView(w.db, a, c.taskId, T0 + 3 * DAY);
  assert.equal(after.segments.find(s => s.id === 's4').planted, true);
  const m3 = await L.ensureCatchTask(w.db, a, a.memberId, T0 + 65 * DAY);
  assert.equal(m3.month, 3);
  const r3 = await L.submitCatch(w.db, a, m3.taskId, ['s2', 's4'], T0 + 65 * DAY);
  assert.equal(r3.baseline, false);
  const rows = await w.raw('SELECT month, caught, shown, baseline FROM loop_catch_results ORDER BY month');
  assert.deepEqual(rows.map(x => [x.month, x.caught, x.shown, x.baseline]), [[1, 1, 2, 1], [3, 2, 2, 0]]);
});

test('4.6: the facilitator starts the workshop session; first cycles are week 0; the session view shows completion only', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  await refused(L.startWorkshop(w.db, a, w.cohortId, T0));
  const s = await L.startWorkshop(w.db, w.facilitator, w.cohortId, T0);
  assert.equal(s.created, 2);
  const ta = await w.one(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='workshop'`, a.memberId);
  const data = Buffer.from('my workshop file'); const sha = createHash('sha256').update(data).digest('hex');
  const up = await L.startUpload(w.db, a, a.memberId, {taskId: ta.id, name: 'secret-plan.txt', mime: 'text/plain', size: data.length, sha256: sha}, T0);
  await L.uploadChunk(w.db, a, up.fileId, 0, data, T0);
  const sub = await L.submitTask(w.db, a, ta.id, {note: 'First try done', fileId: up.fileId}, T0 + 3600_000);
  assert.equal(sub.week, 0);
  const view = await L.workshopView(w.db, w.facilitator, w.cohortId, T0);
  assert.deepEqual(view.participants.map(p => [p.name, p.finished]), [['learner 1', true], ['learner 2', false]]);
  const shown = JSON.stringify(view);
  assert.ok(!shown.includes('secret-plan') && !shown.includes('First try done'), 'no files or answers in the facilitator view');
});

test('2.6 AC3 in the loop: after access ends no new cycle starts, history stays readable', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const t = await L.ensureWeeklyTask(w.db, a, a.memberId, W1);
  await L.submitTask(w.db, a, t.taskId, {note: 'done'}, W1);
  const after = Date.parse('2027-11-03T00:00:00Z');
  await refused(L.ensureWeeklyTask(w.db, a, a.memberId, after));
  assert.equal((await L.history(w.db, a, a.memberId, after)).length, 1);
});
