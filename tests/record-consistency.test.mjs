import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSavedPracticeRecord,
  parseRecordCheckRequest,
  acceptRecordCheckEnvelope,
  snapshotChecksum,
  RecordResponseError,
} from '../.sites-runtime/record-qa/record-check.mjs';
import {
  p,
  ws,
  time,
  checkedAt,
  owner,
  learner,
  reviewer,
  personal,
  shared,
  ownBody,
  decisionBody,
  ownExpectation,
  decisionExpectation,
} from './record-fixtures.mjs';
const check = (user, state, body) =>
  checkSavedPracticeRecord({
    user,
    row: { data: JSON.stringify(state), revision: 8 },
    request: parseRecordCheckRequest(body),
    checkedAt,
  });
const mutate = async (envelope, fn) => {
  const x = structuredClone(envelope);
  fn(x.result.snapshot);
  x.result.integrity.checksum = await snapshotChecksum(x.result.snapshot);
  return x;
};
export async function forgeryVectors() {
  const s = personal(),
    own = await check(learner, s, ownBody(s)),
    expected = await ownExpectation(s);
  const t = shared(true),
    assigned = await check(reviewer, t, decisionBody(t)),
    assignedExpected = await decisionExpectation(t);
  const vectors = [];
  for (const [name, fn] of [
    ['pinned language', (x) => (x.contentLanguage = 'hi')],
    ['pinned title', (x) => (x.title = 'Forged same-pin course title')],
    ['pinned claim', (x) => (x.claim = 'Forged same-pin completion claim')],
    ['pinned exclusions', (x) => (x.exclusions = ['Forged course exclusions'])],
    ['stored issuer display', (x) => (x.issuerDisplay = 'Forged Academy issuer label')],
    [
      'internally consistent initial issuance',
      (x) => {
        x.issuedAt = time(5);
        for (const d of [x.firstPassingDecision, x.effectiveDecision, ...x.decisionHistory])
          d.decidedAt = time(5);
      },
    ],
    [
      'invented resolved adverse appeal and suspended status',
      (x) => {
        const d = {
          ...x.effectiveDecision,
          decisionId: 'invented-resolution',
          kind: 'appeal',
          appealId: 'invented-appeal',
          actorRef: 'reviewer-b',
          actorDisplay: 'Sample Reviewer B',
          decidedAt: time(6),
          mode: 'manual sample-reviewer appeal',
          passed: false,
        };
        x.decisionHistory.push(d);
        x.effectiveDecision = { ...d };
        x.status = 'suspended';
      },
    ],
    ['invented open appeal flag', (x) => (x.hasOpenAppeal = true)],
    [
      'invented later pending assessment after false appeal',
      (x) => {
        const d = {
          ...x.effectiveDecision,
          decisionId: 'invented-resolution',
          kind: 'appeal',
          appealId: 'invented-appeal',
          actorRef: 'reviewer-b',
          actorDisplay: 'Sample Reviewer B',
          decidedAt: time(6),
          mode: 'manual sample-reviewer appeal',
          passed: false,
        };
        x.decisionHistory.push(d);
        x.effectiveDecision = { ...d };
        x.status = 'suspended';
        x.hasPendingAssessment = true;
      },
    ],
  ])
    vectors.push({ name, envelope: await mutate(own, fn), expected });
  for (const [name, fn] of [
    ['assigned original actor display', (x) => (x.decision.actorDisplay = 'Forged assigned assessor')],
    ['assigned original actor reference', (x) => (x.decision.actorRef = 'another-staff')],
    ['assigned original decision time', (x) => (x.decision.decidedAt = time(5))],
    ['assigned original result', (x) => (x.decision.passed = false)],
    ['assigned original attempt reference', (x) => (x.decision.attemptId = 'another-attempt')],
  ])
    vectors.push({ name, envelope: await mutate(assigned, fn), expected: assignedExpected });
  return vectors;
}
test('rehashed forgeries cannot alter pinned labels, exclusions, issuer or complete saved status/history', async () => {
  for (const v of await forgeryVectors())
    await assert.rejects(acceptRecordCheckEnvelope(v.envelope, v.expected), RecordResponseError, v.name);
});
test('mandatory captured derivation fails closed if absent or throws', async () => {
  const s = personal(),
    envelope = await check(learner, s, ownBody(s)),
    expected = await ownExpectation(s);
  for (const deriveExpectedResult of [
    undefined,
    () => {
      throw new Error('Untrusted local projection');
    },
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(envelope, { ...expected, deriveExpectedResult }),
      RecordResponseError,
    );
});
test('a well-shaped unavailable result cannot replace a captured checked result', async () => {
  const s = personal(),
    envelope = await check(learner, s, ownBody(s)),
    expected = await ownExpectation(s);
  await assert.rejects(
    acceptRecordCheckEnvelope(
      { ...envelope, result: { outcome: 'unavailable', message: 'Invented support direction.' } },
      expected,
    ),
    RecordResponseError,
  );
});
test('unavailable agreement requires the exact derived reason and never produces a snapshot', async () => {
  const s = personal();
  s.enrollments[0].record.status = 'suspended';
  const envelope = await check(learner, s, ownBody(s)),
    expected = await ownExpectation(s);
  assert.equal(envelope.result.outcome, 'unavailable');
  assert.equal((await acceptRecordCheckEnvelope(envelope, expected)).result.outcome, 'unavailable');
  await assert.rejects(
    acceptRecordCheckEnvelope(
      { ...envelope, result: { outcome: 'unavailable', message: 'Altered bounded reason.' } },
      expected,
    ),
    RecordResponseError,
  );
});
test('body mutation while trusted derivation awaits does not rewrite accepted response bytes', async () => {
  const s = personal(),
    envelope = structuredClone(await check(learner, s, ownBody(s))),
    expected = await ownExpectation(s);
  let started, reply;
  const entered = new Promise((r) => (started = r)),
    gate = new Promise((r) => (reply = r));
  const pending = acceptRecordCheckEnvelope(envelope, {
    ...expected,
    deriveExpectedResult: async (at) => {
      started();
      await gate;
      return expected.deriveExpectedResult(at);
    },
  });
  await entered;
  envelope.result.snapshot.title = 'Changed during await';
  reply();
  assert.equal((await pending).result.snapshot.title, p.title);
});
test('server checkedAt is reused for expected chronology instead of the browser clock', async () => {
  const s = personal(),
    body = ownBody(s),
    later = time(58),
    envelope = await checkSavedPracticeRecord({
      user: learner,
      row: { data: JSON.stringify(s), revision: 8 },
      request: parseRecordCheckRequest(body),
      checkedAt: later,
    }),
    expected = await ownExpectation(s);
  assert.equal((await acceptRecordCheckEnvelope(envelope, expected)).result.snapshot.checkedAt, later);
});
test('legitimate open appeal, adverse resolution, pending retry and passing retry all agree with their exact full captured history', async () => {
  const { applyCommand } = await import('../.sites-runtime/record-qa/record-check.mjs');
  let s = personal(),
    e = s.enrollments[0];
  const fields = Object.fromEntries(
    p.practicalAssessment.submissionPrompts.map((f) => [
      f.id,
      'PRIVATE_EVIDENCE source checks and careful human approval.',
    ]),
  );
  const review = (type, passed) => ({
    type,
    enrollmentId: e.id,
    actor: type === 'resolve' ? 'reviewer-b' : 'assessor-a',
    scores: p.practicalAssessment.rubric.map(() => 4),
    gates: p.practicalAssessment.rubric.filter((r) => r.criticalGate).map((_, i) => passed || i !== 0),
    notes: p.practicalAssessment.rubric.map(() => 'PRIVATE_NOTES exact source evidence inspected carefully.'),
    feedback: 'PRIVATE_FEEDBACK detailed exact source and human safety checks.',
  });
  const verify = async (status, open, pending, history) => {
    const env = await check(learner, s, ownBody(s)),
      accepted = await acceptRecordCheckEnvelope(env, await ownExpectation(s));
    assert.equal(accepted.result.snapshot.status, status);
    assert.equal(accepted.result.snapshot.hasOpenAppeal, open);
    assert.equal(accepted.result.snapshot.hasPendingAssessment, pending);
    assert.equal(accepted.result.snapshot.decisionHistory.length, history);
    return { env, expected: await ownExpectation(s) };
  };
  s = applyCommand(
    s,
    {
      type: 'appeal',
      enrollmentId: e.id,
      attemptId: e.attempts[0].id,
      reason: 'PRIVATE_APPEAL independent original source and safety review.',
    },
    time(4),
  );
  await verify('active', true, false, 1);
  s = applyCommand(s, { ...review('resolve', false), appealId: s.enrollments[0].appeals[0].id }, time(5));
  await verify('suspended', false, false, 2);
  s = applyCommand(s, { type: 'submit', enrollmentId: e.id, fields, confirmed: true }, time(6));
  await verify('suspended', false, true, 2);
  s = applyCommand(s, { ...review('assess', true), attemptId: s.enrollments[0].attempts[1].id }, time(7));
  const { env, expected } = await verify('active', false, false, 3);
  const forged = await mutate(env, (x) => {
    x.decisionHistory = [x.firstPassingDecision];
    x.effectiveDecision = { ...x.firstPassingDecision };
  });
  await assert.rejects(acceptRecordCheckEnvelope(forged, expected), RecordResponseError);
});
