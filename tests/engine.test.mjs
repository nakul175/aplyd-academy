import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommand,
  freshWorkspace,
  scoreDecision,
  programs,
  RuleError,
  resumeLearning,
} from '../.sites-runtime/engine.mjs';
const p = programs[1],
  evidence = () =>
    Object.fromEntries(
      p.practicalAssessment.submissionPrompts.map((f) => [
        f.id,
        'Synthetic checked evidence. Sources are verified and private fields excluded.',
      ]),
    );
const apply = (s, c) => applyCommand(s, c, '2026-10-05T12:00:00.000Z');
const enroll = () => apply(freshWorkspace(), { type: 'enroll', programId: p.id });
function prepared() {
  let s = enroll(),
    id = s.enrollments[0].id;
  for (const l of p.lessons)
    s = apply(s, {
      type: 'lesson',
      enrollmentId: id,
      lessonId: l.id,
      practice: 'I used the fictional packet and checked the source references carefully.',
      answers: l.quiz.map((q) => q.correctOptionIndex),
    });
  s = apply(s, { type: 'submit', enrollmentId: id, fields: evidence(), confirmed: true });
  return s;
}
const assessment = (s, scores = [4, 4, 4, 4], gates = [true, true, true]) => ({
  type: 'assess',
  enrollmentId: s.enrollments[0].id,
  attemptId: s.enrollments[0].attempts.at(-1).id,
  actor: 'assessor-a',
  scores,
  gates,
  notes: Array(4).fill('Checked submitted evidence against fictional source packet.'),
  feedback: 'Clear work with source verification, privacy handling and an appropriate human approval route.',
});
test('critical gates override a maximum score', () => {
  assert.deepEqual(scoreDecision(p, [4, 4, 4, 4], [true, true, true]), { score: 100, passed: true });
  assert.deepEqual(scoreDecision(p, [4, 4, 4, 4], [true, false, true]), { score: 100, passed: false });
});
test('70 passes; 68.75 fails without rounding up', () => {
  assert.equal(scoreDecision(p, [3, 2, 4, 2], [true, true, true]).score, 70);
  assert.equal(scoreDecision(p, [3, 2, 4, 2], [true, true, true]).passed, true);
  let v;
  for (let a = 0; a <= 4; a++)
    for (let b = 0; b <= 4; b++)
      for (let c = 0; c <= 4; c++)
        for (let d = 0; d <= 4; d++) {
          let r = scoreDecision(p, [a, b, c, d], [true, true, true]);
          if (r.score === 68.75) v = r;
        }
  assert.equal(v.passed, false);
});
test('invalid scores and malformed gates reject', () => {
  for (const scores of [
    [4, 4, 4],
    [4, 4, 4, 5],
    [4, 4, 4, -1],
    [4, 4, 4, 3.5],
  ])
    assert.throws(() => scoreDecision(p, scores, [true, true, true]), RuleError);
  assert.throws(() => scoreDecision(p, [4, 4, 4, 4], [true, true]), RuleError);
});
test('duplicate enrollment is idempotent', () => {
  let s = enroll();
  assert.equal(apply(s, { type: 'enroll', programId: p.id }).enrollments.length, 1);
});
test('lessons enforce prerequisites and answer key', () => {
  const s = enroll(),
    id = s.enrollments[0].id;
  assert.throws(
    () =>
      apply(s, {
        type: 'lesson',
        enrollmentId: id,
        lessonId: p.lessons[1].id,
        practice: 'Long enough fictional practice response.',
        answers: [0, 0, 0],
      }),
    RuleError,
  );
  assert.throws(
    () =>
      apply(s, {
        type: 'lesson',
        enrollmentId: id,
        lessonId: p.lessons[0].id,
        practice: 'Long enough fictional practice response.',
        answers: [0, 0, 0],
      }),
    RuleError,
  );
});
test('quiz alone and incomplete evidence cannot issue a record', () => {
  const s = enroll();
  assert.throws(
    () =>
      apply(s, { type: 'submit', enrollmentId: s.enrollments[0].id, fields: evidence(), confirmed: true }),
    RuleError,
  );
  assert.equal(s.enrollments[0].record, null);
});
test('partial drafts preserve fields and oversized text rejects atomically', () => {
  let s = enroll(),
    id = s.enrollments[0].id;
  s = apply(s, {
    type: 'draft',
    enrollmentId: id,
    fields: { task: 'A saved task', final: 'A saved response' },
  });
  let n = apply(s, { type: 'draft', enrollmentId: id, fields: { task: 'Changed task' } });
  assert.equal(n.enrollments[0].draft.final, 'A saved response');
  assert.throws(
    () => apply(n, { type: 'draft', enrollmentId: id, fields: { task: 'x'.repeat(10001) } }),
    RuleError,
  );
  assert.equal(n.enrollments[0].draft.task, 'Changed task');
});
test('immutable evidence and decisions retained; second review rejects', () => {
  let s = prepared();
  const snapshot = JSON.stringify(s.enrollments[0].attempts[0].fields);
  s = apply(s, {
    type: 'draft',
    enrollmentId: s.enrollments[0].id,
    fields: { task: 'Changed working draft' },
  });
  assert.equal(JSON.stringify(s.enrollments[0].attempts[0].fields), snapshot);
  s = apply(s, assessment(s));
  assert.throws(() => apply(s, assessment(s)), RuleError);
  assert.equal(s.enrollments[0].record.status, 'active');
});
test('failed critical gate blocks record; independent appeal can supersede', () => {
  let s = prepared();
  s = apply(s, assessment(s, [4, 4, 4, 4], [false, true, true]));
  assert.equal(s.enrollments[0].record, null);
  s = apply(s, {
    type: 'appeal',
    enrollmentId: s.enrollments[0].id,
    attemptId: s.enrollments[0].attempts[0].id,
    reason: 'The source mapping warrants a second independent examination.',
  });
  const resolve = {
    ...assessment(s),
    type: 'resolve',
    appealId: s.enrollments[0].appeals[0].id,
    actor: 'assessor-a',
  };
  assert.throws(() => apply(s, resolve), RuleError);
  s = apply(s, { ...resolve, actor: 'reviewer-b' });
  assert.equal(s.enrollments[0].record.status, 'active');
  assert.equal(s.enrollments[0].attempts[0].decision.passed, false);
});
test('adverse appeal suspends an already issued record', () => {
  let s = prepared();
  s = apply(s, assessment(s));
  s = apply(s, {
    type: 'appeal',
    enrollmentId: s.enrollments[0].id,
    attemptId: s.enrollments[0].attempts[0].id,
    reason: 'Important verification evidence may have been overlooked here.',
  });
  s = apply(s, {
    ...assessment(s),
    type: 'resolve',
    appealId: s.enrollments[0].appeals[0].id,
    actor: 'reviewer-b',
    gates: [false, true, true],
  });
  assert.equal(s.enrollments[0].record.status, 'suspended');
});
test('legacy delivery always refuses explicit-choice guidance and preferences never mint authority', () => {
  let s = enroll(),
    id = s.enrollments[0].id;
  const deny = (c, status) =>
    assert.throws(
      () => apply(s, c),
      (e) => e instanceof RuleError && e.status === status,
    );
  for (const partner of ['msme', 'toString', '__proto__'])
    deny({ type: 'deliver', partner, enrollmentId: id }, 409);
  s = apply(s, { type: 'connection', partner: 'msme', enabled: true });
  assert.deepEqual(s.ecosystemGrants ?? [], []);
  assert.deepEqual(s.ecosystemReceipts ?? [], []);
  deny({ type: 'deliver', partner: 'msme', enrollmentId: id }, 409);
  for (const key of ['payload', 'actor', 'scopes', 'grantId', 'url'])
    deny({ type: 'deliver', partner: 'msme', enrollmentId: id, [key]: 'unsupported' }, 400);
  s = apply(s, { type: 'connection', partner: 'msme', enabled: false });
  deny({ type: 'deliver', partner: 'msme', enrollmentId: id }, 409);
  assert.deepEqual(s.deliveries, []);
  deny({ type: 'profile', name: 'A', context: 'toString', reading: false, networking: false }, 422);
});
test('explicit scoped return is minimal, independent of old preference, and denied after its own withdrawal', () => {
  let s = enroll(),
    id = s.enrollments[0].id;
  const deny = (c, status) =>
    assert.throws(
      () => apply(s, c),
      (e) => e instanceof RuleError && e.status === status,
    );
  deny({ type: 'ecosystem-test', grantId: 'missing-choice' }, 404);
  for (const partner of ['toString', '__proto__'])
    deny(
      { type: 'ecosystem-grant', partner, enrollmentId: id, scopes: ['learning.progress'], durationDays: 7 },
      404,
    );
  s = apply(s, {
    type: 'draft',
    enrollmentId: id,
    fields: { task: 'PRIVATE-SCOPED-ENGINE-CANARY: fictional task stays private.' },
  });
  s = apply(s, {
    type: 'ecosystem-grant',
    partner: 'msme',
    enrollmentId: id,
    scopes: ['learning.progress', 'practice.record'],
    durationDays: 7,
  });
  const grantId = s.ecosystemGrants[0].id;
  s = apply(s, { type: 'ecosystem-test', grantId });
  const receipt = structuredClone(s.ecosystemReceipts[0]);
  assert.equal(receipt.status, 'simulated');
  assert.equal(receipt.payload.mode, 'local-test');
  assert.deepEqual(receipt.payload.learning, {
    completed_lessons: 0,
    total_lessons: p.lessons.length,
    status: 'in-progress',
  });
  assert.deepEqual(receipt.payload.practice_record, {
    status: 'not-issued',
    claim_type: 'nonaccredited-practice',
    review_mode: 'not-reviewed',
  });
  for (const key of ['fields', 'practice', 'email', 'name', 'notes', 'scores'])
    assert.ok(!Object.hasOwn(receipt.payload, key));
  assert.ok(!JSON.stringify(receipt).includes('PRIVATE-SCOPED-ENGINE-CANARY'));
  s = apply(s, { type: 'connection', partner: 'msme', enabled: false });
  assert.equal(s.ecosystemGrants[0].revokedAt, null);
  s = apply(s, { type: 'ecosystem-test', grantId });
  assert.equal(s.ecosystemReceipts.length, 2);
  s = apply(s, { type: 'ecosystem-withdraw', grantId });
  deny({ type: 'ecosystem-test', grantId }, 403);
  assert.deepEqual(s.ecosystemReceipts[1], receipt);
  assert.deepEqual(s.deliveries, []);
});
test('withdrawal and pause prevent later progress', () => {
  let s = enroll(),
    id = s.enrollments[0].id;
  s = apply(s, { type: 'withdraw', enrollmentId: id });
  assert.throws(() => apply(s, { type: 'draft', enrollmentId: id, fields: {} }), RuleError);
  s = enroll();
  s = apply(s, { type: 'pause', programId: p.id, paused: true });
  assert.throws(() => apply(s, { type: 'draft', enrollmentId: s.enrollments[0].id, fields: {} }), RuleError);
});
test('unsupported pinned version blocks instead of mislabelling current content', () => {
  const s = enroll();
  s.enrollments[0].version = 'future-v2';
  assert.throws(
    () => apply(s, { type: 'draft', enrollmentId: s.enrollments[0].id, fields: { task: 'text' } }),
    RuleError,
  );
});
test('moderating a reply does not close a report on its parent', () => {
  let s = freshWorkspace();
  s = apply(s, {
    type: 'post',
    title: 'A useful practice question',
    body: 'A fictional discussion about checking a draft carefully.',
  });
  const id = s.posts[0].id;
  s = apply(s, { type: 'moderate', postId: id, status: 'visible' });
  s = apply(s, {
    type: 'report',
    postId: id,
    reason: 'This parent claim needs a moderator to review its accuracy.',
  });
  s = apply(s, { type: 'reply', postId: id, body: 'A useful reply with a cautious source check.' });
  s = apply(s, { type: 'moderate', postId: id, replyId: s.posts[0].replies[0].id, status: 'visible' });
  assert.equal(s.reports[0].status, 'open');
  s = apply(s, { type: 'moderate', postId: id, status: 'hidden' });
  assert.equal(s.reports[0].status, 'resolved');
});
test('reset removes learner content, legacy preferences and explicit scoped choices/receipts', () => {
  let s = prepared();
  s = apply(s, { type: 'connection', partner: 'msme', enabled: true });
  s = apply(s, {
    type: 'ecosystem-grant',
    partner: 'msme',
    enrollmentId: s.enrollments[0].id,
    scopes: ['learning.progress'],
    durationDays: 7,
  });
  s = apply(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  assert.equal(s.ecosystemReceipts.length, 1);
  assert.deepEqual(apply(s, { type: 'reset' }), freshWorkspace());
});

test('resume chooses the next unfinished lesson, practical task or pending feedback', () => {
  let s = enroll(),
    e = s.enrollments[0];
  assert.deepEqual(resumeLearning(e, p), { tab: 'learn', lessonIndex: 0 });
  e.completed = [p.lessons[0].id];
  assert.deepEqual(resumeLearning(e, p), { tab: 'learn', lessonIndex: 1 });
  e.completed = p.lessons.map((l) => l.id);
  assert.equal(resumeLearning(e, p).tab, 'assessment');
  e.attempts = [{ decision: null }];
  assert.equal(resumeLearning(e, p).tab, 'feedback');
  e.attempts = [{ decision: { passed: false } }];
  assert.equal(resumeLearning(e, p).tab, 'assessment');
  e.appeals = [{ status: 'open' }];
  assert.equal(resumeLearning(e, p).tab, 'feedback');
  e.appeals = [];
  e.record = { status: 'suspended' };
  assert.equal(resumeLearning(e, p).tab, 'feedback');
});
test('blank reflection estimates remain missing while explicit zero remains zero', () => {
  let s = prepared();
  s = apply(s, assessment(s));
  const c = {
    type: 'followup',
    enrollmentId: s.enrollments[0].id,
    reflection: 'Fictional work reflection that includes my checks and human approval.',
  };
  s = apply(s, { ...c, before: '', after: '0' });
  assert.equal(s.followups[0].minutesBefore, null);
  assert.equal(s.followups[0].minutesAfter, 0);
  assert.throws(() => apply(s, { ...c, before: true }), RuleError);
  assert.throws(() => apply(s, { ...c, after: '-1' }), RuleError);
});
