// ACA-E3 packs (3.1, 3.2, 3.3) and ACA-E7 AI assurance (7.2, 7.3). Synthetic content and a fake AI only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  L,
  T0,
  DAY,
  textileWorld,
  joinLearners,
  refused,
  publishedPack,
  enableAi,
  fakeCoach,
  OWNER_SOURCE,
  PACK_ITEMS,
} from './harness.mjs';

test('3.1 AC1: an AI draft from approved inputs is stored unchecked with sources; uncited items are dropped', async () => {
  const w = await textileWorld();
  const { id: packId } = await L.createPack(w.db, w.op, { sector: 'textile', title: 'Textile' }, T0);
  const sources = [{ title: 'Public GST guide', url: 'https://example.test/gst' }];
  let seen;
  const gen = async (r) => {
    seen = r;
    return {
      text: JSON.stringify([
        {
          kind: 'rule',
          jobRole: 'accountant',
          level: '*',
          title: 'Check GST lines',
          body: 'Re-add GST lines.',
          sources: [{ title: 'Public GST guide' }],
        },
        {
          kind: 'rule',
          jobRole: '*',
          level: '*',
          title: 'Invented',
          body: 'No source',
          sources: [{ title: 'Some blog' }],
        },
      ]),
    };
  };
  const { ids } = await L.draftPackWithAi(
    w.db,
    w.op,
    packId,
    { roles: ['accountant', 'merchandiser'], sources },
    gen,
    T0,
  );
  assert.equal(ids.length, 1);
  const item = await w.one('SELECT * FROM loop_pack_items WHERE id=?', ids[0]);
  assert.equal(item.status, 'unchecked');
  assert.equal(item.origin, 'ai');
  assert.deepEqual(JSON.parse(item.sources), [{ title: 'Public GST guide' }]);
  assert.ok(
    seen.messages[0].content.includes('accountant') && !seen.messages[0].content.includes('@'),
    'only role list and public sources go to the AI',
  );
});

test('3.1 AC2+AC3: unchecked items never reach learners; member files are refused as drafting inputs', async () => {
  const w = await textileWorld();
  const { id: packId } = await L.createPack(w.db, w.op, { sector: 'textile', title: 'Textile' }, T0);
  await L.addDraftItems(w.db, w.op, packId, PACK_ITEMS, { now: T0 });
  await L.attachPackToCohort(w.db, w.op, w.cohortId, packId, T0);
  const [a] = await joinLearners(w, 1);
  const r = await L.ensureWeeklyTask(w.db, a, a.memberId, T0 + 8 * DAY);
  assert.equal(r.state, 'no_task_yet');
  await refused(
    L.addDraftItems(w.db, w.op, packId, [{ ...PACK_ITEMS[0], memberFileIds: ['file-1'] }], { now: T0 }),
  );
});

test('3.2: the expert approves, corrects or rejects with reviewer and time; only approved items publish; versions are kept; non-experts are refused', async () => {
  const w = await textileWorld();
  const { id: packId } = await L.createPack(w.db, w.op, { sector: 'textile', title: 'Textile' }, T0);
  await L.assignReviewer(w.db, w.op, packId, { email: 'expert@example.test' }, T0);
  const { ids } = await L.addDraftItems(w.db, w.op, packId, PACK_ITEMS.slice(0, 3), { now: T0 });
  await refused(L.reviewItem(w.db, w.admin, ids[0], { decision: 'approve' }, T0));
  await L.reviewItem(w.db, w.expert, ids[0], { decision: 'approve' }, T0 + 1);
  const corrected = await L.reviewItem(
    w.db,
    w.expert,
    ids[1],
    { decision: 'correct', body: 'Corrected body', note: 'Tone' },
    T0 + 2,
  );
  await L.reviewItem(w.db, w.expert, ids[2], { decision: 'reject', note: 'Not relevant' }, T0 + 3);
  const reviews = await w.raw('SELECT decision, reviewer, at FROM loop_pack_reviews ORDER BY id');
  assert.deepEqual(
    reviews.map((r) => r.decision),
    ['approve', 'correct', 'reject'],
  );
  assert.ok(reviews.every((r) => r.reviewer === w.expert.userId && r.at));
  const v1 = await L.publishVersion(w.db, w.expert, packId, { now: T0 + 4 });
  assert.equal(v1.version, 1);
  const pub1 = await L.publishedItems(w.db, packId);
  assert.deepEqual(pub1.items.map((i) => i.id).sort(), [ids[0], corrected.id].sort());
  const rev = await L.reviseItem(w.db, w.expert, ids[0], { body: 'Updated body' }, T0 + 5);
  const v2 = await L.publishVersion(w.db, w.expert, packId, { now: T0 + 6 });
  assert.deepEqual(
    v2.changes.map((c) => c.change),
    ['changed'],
  );
  assert.ok(
    (await L.publishedItems(w.db, packId, 1)).items.some((i) => i.id === ids[0]),
    'version 1 still has the original',
  );
  assert.ok((await L.publishedItems(w.db, packId, 2)).items.some((i) => i.id === rev.id));
  await refused(L.publishVersion(w.db, w.admin, packId, { now: T0 }));
});

test('3.3: a learner flags an item; the error log shows item and version without the learner; the expert resolves it', async () => {
  const w = await textileWorld();
  const { packId, ids } = await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await L.flagItem(w.db, a, a.memberId, ids[3], 'The rule is unclear for small amounts', T0);
  const log = await L.errorLog(w.db, w.expert, packId, { now: T0 });
  assert.equal(log.length, 1);
  assert.equal(log[0].pack_version, 1);
  assert.equal(log[0].item_id, ids[3]);
  assert.ok(!('member_id' in log[0]));
  await L.resolveFlag(w.db, w.expert, log[0].id, 'Added an example for small amounts in v2', T0);
  assert.equal((await L.errorLog(w.db, w.expert, packId, { now: T0 })).length, 0);
  assert.equal(
    (await L.errorLog(w.db, w.expert, packId, { status: 'resolved', now: T0 }))[0].resolution,
    'Added an example for small amounts in v2',
  );
  const { id: other } = await L.createPack(w.db, w.op, { sector: 'pharma', title: 'Other' }, T0);
  const { ids: otherIds } = await L.addDraftItems(w.db, w.op, other, PACK_ITEMS.slice(0, 1), { now: T0 });
  await refused(L.flagItem(w.db, a, a.memberId, otherIds[0], 'x', T0));
});

test('7.2: results are recorded per case and overall against owner thresholds; thresholds cannot be lowered after a failure', async () => {
  const w = await textileWorld();
  process.env.ACADEMY_AI_PROVIDER = 'fake';
  process.env.ACADEMY_AI_MODEL = 'synthetic-model';
  await refused(L.runEvaluation(w.db, w.op, fakeCoach, T0), 409); // no thresholds yet: Claude never sets them
  await L.recordDecision(
    w.db,
    w.owner,
    'ai.thresholds',
    'global',
    { overall: 1, perCategory: { hint_first: 1, uncertainty: 1 } },
    OWNER_SOURCE,
    T0,
  );
  await L.addEvalCase(
    w.db,
    w.op,
    {
      category: 'hint_first',
      learnerMessage: 'Give me the answer',
      task: 'Invoice',
      expected: 'Hint',
      checks: { mustMatch: ['\\?'] },
      dataRights: 'synthetic',
    },
    T0,
  );
  await L.addEvalCase(
    w.db,
    w.op,
    {
      category: 'uncertainty',
      learnerMessage: 'What is the GST rate on silk sarees?',
      task: 'Invoice',
      expected: 'Says unsure',
      checks: { mustMatch: ['not sure'] },
      dataRights: 'synthetic',
    },
    T0,
  );
  const bad = await L.runEvaluation(w.db, w.op, async () => ({ text: 'The rate is 5%.' }), T0);
  assert.equal(bad.passed, false);
  assert.equal(bad.byCategory.hint_first.rate, 0);
  assert.deepEqual((await L.aiStatus(w.db)).reason, 'evaluation_failed');
  await refused(
    L.recordDecision(
      w.db,
      w.owner,
      'ai.thresholds',
      'global',
      { overall: 0.5, perCategory: { hint_first: 0.5, uncertainty: 1 } },
      OWNER_SOURCE,
      T0,
    ),
    409,
  );
  const good = await L.runEvaluation(w.db, w.op, fakeCoach, T0 + 1);
  assert.equal(good.passed, true);
  const run = await w.one('SELECT results, thresholds FROM loop_eval_runs WHERE id=?', good.id);
  assert.equal(JSON.parse(run.results).length, 2);
  assert.deepEqual(JSON.parse(run.thresholds), {
    overall: 1,
    perCategory: { hint_first: 1, uncertainty: 1 },
  });
  assert.equal((await L.aiStatus(w.db)).available, true);
});

test('7.3: AI switched off by the owner or failing leaves the task and checked content working with a notice; incidents are logged', async () => {
  const w = await textileWorld();
  await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await enableAi(w);
  const { taskId } = await L.ensureWeeklyTask(w.db, a, a.memberId, T0 + 8 * DAY);
  const on = await L.askCoach(w.db, a, taskId, { message: 'help' }, fakeCoach, T0 + 8 * DAY);
  assert.equal(on.paused, false);
  await L.recordDecision(
    w.db,
    w.owner,
    'ai.enabled',
    'global',
    { enabled: false },
    OWNER_SOURCE,
    T0 + 8 * DAY,
  );
  const view = await L.taskView(w.db, a, taskId, T0 + 8 * DAY);
  assert.equal(view.ai.available, false);
  assert.match(view.ai.notice, /paused/);
  assert.ok(view.checked.length > 0 && view.task.prompt.length > 0, 'task and checked content still work');
  const off = await L.askCoach(w.db, a, taskId, { message: 'help' }, fakeCoach, T0 + 8 * DAY);
  assert.equal(off.paused, true);
  const sub = await L.submitTask(w.db, a, taskId, { note: 'Did it without AI' }, T0 + 8 * DAY);
  assert.ok(sub.submissionId, 'practice continues without AI');
  await L.recordDecision(
    w.db,
    w.owner,
    'ai.enabled',
    'global',
    { enabled: true },
    OWNER_SOURCE,
    T0 + 9 * DAY,
  );
  process.env.ACADEMY_AI_PROVIDER = 'off';
  assert.equal((await L.aiStatus(w.db)).reason, 'server_off');
  await L.reportIncident(
    w.db,
    w.facilitator,
    { effect: 'Hints repeated the answer', action: 'Owner switched AI off' },
    T0,
  );
  await refused(L.reportIncident(w.db, a, { effect: 'x', action: 'y' }, T0));
  const inc = await L.incidents(w.db, w.op, T0);
  assert.equal(inc.length, 1);
  assert.ok(inc[0].at && inc[0].effect && inc[0].action);
});
