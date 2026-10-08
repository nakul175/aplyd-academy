import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeam, applyTeamCommand, projectTeam } from '../../.sites-runtime/teams.mjs';
import { programs } from '../../.sites-runtime/engine.mjs';
const now = '2026-10-05T09:00:00.000Z',
  later = '2026-10-05T10:00:00.000Z';
const owner = { userId: 'owner', email: 'owner@example.test' },
  learner = { userId: 'learner', email: 'learner@example.test' },
  fac = { userId: 'fac', email: 'fac@example.test' },
  other = { userId: 'other', email: 'other@example.test' },
  peer = { userId: 'peer', email: 'peer@example.test' };
const p = programs[1],
  apply = (t, u, c, time = now) => applyTeamCommand(t, u, c, time),
  throws = (fn, status) => assert.throws(fn, (e) => e.status === status);
function setup() {
  let t = createTeam(
    owner,
    { name: 'Fictional pilot', purpose: 'A synthetic workspace for accommodation checks.', context: 'msme' },
    'team-acc',
    now,
  );
  t = apply(t, owner, { type: 'cohort-create', title: 'Customer-work cohort', programId: p.id, capacity: 3 });
  t = apply(t, owner, {
    type: 'cohort-create',
    title: 'Other cohort',
    programId: programs[0].id,
    capacity: 3,
  });
  const [c1, c2] = t.cohorts.map((c) => c.id);
  t = apply(t, owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner', 'assessor'],
    scopes: [c1],
    active: true,
  });
  [
    [learner, ['learner'], [], 'a'],
    [fac, ['facilitator'], [c1], 'b'],
    [other, ['facilitator', 'assessor'], [c2], 'c'],
    [peer, ['learner'], [], 'd'],
  ].forEach(([u, r, s, h]) => {
    const hash = h.repeat(64);
    t = apply(t, owner, { type: 'invite', email: u.email, roles: r, scopes: s, tokenHash: hash });
    t = apply(t, u, { type: 'accept', tokenHash: hash });
  });
  t = apply(t, learner, { type: 'enroll', programId: p.id, cohortId: c1 });
  return t;
}
const eid = (t) => t.learners.find((l) => l.userId === learner.userId).state.enrollments[0].id;
const request = (t) =>
  apply(t, learner, {
    type: 'accommodation-request',
    enrollmentId: eid(t),
    accommodationType: 'human-scribe',
    detail: 'I need someone to write what I dictate.',
  });
const decide = (t, u, o = {}) =>
  apply(
    t,
    u,
    {
      type: 'accommodation-decide',
      learnerId: learner.userId,
      enrollmentId: eid(t),
      requestId: t.learners.find((l) => l.userId === learner.userId).state.enrollments[0].accommodations?.[0]
        ?.id,
      outcome: 'approved',
      reason: 'Reasonable need; scribe must read back what was captured.',
      ...o,
    },
    later,
  );
test('learner files a request inside their own enrollment; others cannot file for them', () => {
  let t = request(setup());
  const a = t.learners[0].state.enrollments[0].accommodations;
  assert.equal(a.length, 1);
  assert.equal(a[0].status, 'requested');
  throws(
    () =>
      apply(t, fac, { type: 'accommodation-request', enrollmentId: eid(t), accommodationType: 'extra-time' }),
    404,
  );
  throws(
    () =>
      apply(t, learner, {
        type: 'accommodation-request',
        enrollmentId: eid(t),
        accommodationType: 'extra-time',
        learnerId: 'x',
      }),
    400,
  );
  throws(
    () =>
      apply(t, learner, { type: 'accommodation-request', enrollmentId: eid(t), accommodationType: 'nope' }),
    422,
  );
});
test('eligible non-requester decides; history is retained and immutable', () => {
  let t = request(setup());
  const before = structuredClone(t.learners[0].state.enrollments[0].accommodationHistory);
  t = decide(t, fac);
  const e = t.learners[0].state.enrollments[0];
  assert.equal(e.accommodations[0].status, 'approved');
  assert.equal(e.accommodations[0].decision.actor, fac.userId);
  assert.deepEqual(e.accommodationHistory.slice(0, before.length), before);
  assert.deepEqual(
    e.accommodationHistory.map((h) => h.event),
    ['requested', 'approved'],
  );
  throws(() => decide(t, owner, { outcome: 'declined' }), 409);
  assert.equal(t.learners[0].state.enrollments[0].accommodations[0].status, 'approved');
  // the learner sees the decision and reason
  const own = projectTeam(t, learner).state.enrollments[0];
  assert.equal(own.accommodations[0].decision.reason.length > 10, true);
});
test('requester cannot decide, even holding staff roles; admin without facilitator/assessor role is denied', () => {
  let t = request(setup());
  throws(() => decide(t, learner), 404);
  let t2 = apply(t, owner, {
    type: 'member',
    userId: learner.userId,
    roles: ['learner', 'facilitator'],
    scopes: [t.cohorts[0].id],
    active: true,
  });
  throws(() => decide(t2, learner), 404);
  let t3 = apply(t, owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner'],
    scopes: [],
    active: true,
  });
  throws(() => decide(t3, owner), 404);
  throws(() => decide(t, peer), 404);
});
test('staff from a different cohort are denied with the same error as an unknown enrollment', () => {
  const t = request(setup());
  let denied, unknown;
  try {
    decide(t, other);
  } catch (e) {
    denied = e;
  }
  try {
    decide(t, fac, { enrollmentId: 'does-not-exist' });
  } catch (e) {
    unknown = e;
  }
  assert.ok(denied && unknown);
  assert.equal(denied.status, unknown.status);
  assert.equal(denied.message, unknown.message);
  let again;
  try {
    decide(t, learner);
  } catch (e) {
    again = e;
  }
  assert.equal(again.message, unknown.message);
  assert.equal(t.learners[0].state.enrollments[0].accommodations[0].status, 'requested');
});
test('stale and malformed decisions fail without changing state', () => {
  const t = request(setup());
  const snap = JSON.stringify(t);
  throws(() => decide(t, fac, { requestId: 'gone' }), 404);
  throws(() => decide(t, fac, { outcome: 'maybe' }), 422);
  throws(() => decide(t, fac, { reason: 'no' }), 422);
  throws(() => decide(t, fac, { actor: 'assessor-a' }), 400);
  assert.equal(JSON.stringify(t), snap);
  const w = apply(t, learner, { type: 'withdraw', enrollmentId: eid(t) });
  throws(() => decide(w, fac), 409);
});
test('projection: pending queue only for eligible in-scope staff; details never reach others', () => {
  let t = request(setup());
  assert.equal(projectTeam(t, fac).team.accommodationQueue.length, 1);
  assert.equal(projectTeam(t, owner).team.accommodationQueue.length, 1);
  for (const u of [other, peer, learner]) assert.deepEqual(projectTeam(t, u).team.accommodationQueue, []);
  for (const u of [other, peer]) assert.ok(!JSON.stringify(projectTeam(t, u)).includes('dictate'));
  t = decide(t, fac);
  assert.equal(projectTeam(t, fac).team.accommodationQueue.length, 0);
});
test('assessor sees the approved accommodation at review time and the decision is unchanged by it', () => {
  const run = (withAcc) => {
    let t = setup();
    const id = eid(t);
    if (withAcc) {
      t = request(t);
      t = decide(t, fac);
    }
    for (const l of p.lessons)
      t = apply(t, learner, {
        type: 'lesson',
        enrollmentId: id,
        lessonId: l.id,
        practice: 'Fictional evidence with careful source mapping and verification.',
        answers: l.quiz.map((q) => q.correctOptionIndex),
      });
    t = apply(t, learner, {
      type: 'submit',
      enrollmentId: id,
      confirmed: true,
      fields: Object.fromEntries(
        p.practicalAssessment.submissionPrompts.map((f) => [
          f.id,
          'Synthetic submitted evidence with source references, verification and human approval.',
        ]),
      ),
    });
    const attemptId = t.learners[0].state.enrollments[0].attempts[0].id;
    t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: attemptId, staffId: owner.userId });
    const assigned = projectTeam(t, owner).team.assigned[0];
    t = apply(t, owner, {
      type: 'assess',
      learnerId: learner.userId,
      enrollmentId: id,
      attemptId,
      scores: [3, 3, 3, 3],
      gates: [true, true, true],
      method: 'observed',
      notes: Array(4).fill('Evidence checked against the fictional source packet.'),
      feedback:
        'Verified reasoning, careful data handling and the human approval route meet the practice standard.',
    });
    return { assigned, d: t.learners[0].state.enrollments[0].attempts[0].decision };
  };
  const a = run(true),
    b = run(false);
  assert.equal(a.assigned.e.accommodations[0].type, 'human-scribe');
  assert.equal(b.assigned.e.accommodations, undefined);
  assert.equal(a.d.score, b.d.score);
  assert.equal(a.d.passed, b.d.passed);
  assert.equal(a.d.method, 'observed');
  assert.equal(a.d.accommodationsConsidered[0].type, 'human-scribe');
});
