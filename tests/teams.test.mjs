import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeam, applyTeamCommand, projectTeam, invitation } from '../.sites-runtime/teams.mjs';
import { programs } from '../.sites-runtime/engine.mjs';
const now = '2026-10-05T09:00:00.000Z',
  owner = { userId: 'owner', email: 'owner@example.test' },
  learner = { userId: 'learner', email: 'learner@example.test' },
  reviewer = { userId: 'reviewer', email: 'reviewer@example.test' },
  p = programs[1];
const apply = (t, u, c, time = now) => applyTeamCommand(t, u, c, time),
  throws = (fn, status) => assert.throws(fn, (e) => e.status === status);
function setup() {
  let t = createTeam(
    owner,
    {
      name: 'Fictional pilot',
      purpose: 'A synthetic workspace for access boundary checks.',
      context: 'msme',
    },
    'team-test',
    now,
  );
  t = apply(t, owner, {
    type: 'cohort-create',
    title: 'Checked customer-work cohort',
    programId: p.id,
    capacity: 1,
  });
  const cid = t.cohorts[0].id;
  t = apply(t, owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner', 'assessor', 'reviewer', 'moderator'],
    scopes: [cid],
    active: true,
  });
  for (const [u, r, s, h] of [
    [learner, ['learner'], [], 'a'.repeat(64)],
    [reviewer, ['learner', 'reviewer', 'facilitator', 'moderator'], [cid], 'b'.repeat(64)],
  ]) {
    t = apply(t, owner, { type: 'invite', email: u.email, roles: r, scopes: s, tokenHash: h });
    t = apply(t, u, { type: 'accept', tokenHash: h });
  }
  t = apply(t, learner, { type: 'enroll', programId: p.id, cohortId: cid });
  return t;
}
function prepared() {
  let t = setup(),
    e = t.learners[0].state.enrollments[0];
  for (const l of p.lessons)
    t = apply(t, learner, {
      type: 'lesson',
      enrollmentId: e.id,
      lessonId: l.id,
      practice: 'Fictional evidence with careful source mapping and verification.',
      answers: l.quiz.map((q) => q.correctOptionIndex),
    });
  t = apply(t, learner, {
    type: 'submit',
    enrollmentId: e.id,
    confirmed: true,
    fields: Object.fromEntries(
      p.practicalAssessment.submissionPrompts.map((f) => [
        f.id,
        'Synthetic submitted evidence with source references, verification and human approval.',
      ]),
    ),
  });
  t = apply(t, learner, {
    type: 'draft',
    enrollmentId: e.id,
    fields: { task: 'SECRET private draft: not part of submitted evidence.' },
  });
  return t;
}
function assessment(t) {
  const e = t.learners.find((l) => l.userId === learner.userId).state.enrollments[0];
  return {
    type: 'assess',
    learnerId: learner.userId,
    enrollmentId: e.id,
    attemptId: e.attempts.at(-1).id,
    scores: [4, 4, 4, 4],
    gates: [true, true, true],
    notes: Array(4).fill('Evidence checked against the fictional source packet.'),
    feedback:
      'Verified reasoning, careful data handling and the human approval route meet the practice standard.',
  };
}
test('invitation binds trusted account email and refuses expiry, role injection and removed access', () => {
  const t = setup(),
    i = t.invites[0];
  throws(() => invitation(t, i.tokenHash, reviewer, now), 404);
  let x = structuredClone(t);
  x.invites[0].status = 'active';
  delete x.invites[0].acceptedBy;
  throws(() => invitation(x, i.tokenHash, learner, '2026-10-13T09:00:00Z'), 409);
  throws(() => apply(x, learner, { type: 'accept', tokenHash: i.tokenHash, roles: ['admin'] }), 400);
  x.members.find((m) => m.userId === learner.userId).active = false;
  throws(() => apply(x, learner, { type: 'accept', tokenHash: i.tokenHash }), 403);
});
test('removed invitation issuer invalidates outstanding grants', () => {
  let t = setup();
  t = apply(t, owner, {
    type: 'member',
    userId: reviewer.userId,
    roles: ['admin', 'reviewer'],
    scopes: [t.cohorts[0].id],
    active: true,
  });
  t = apply(t, owner, {
    type: 'invite',
    email: 'new@example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  t = apply(t, reviewer, {
    type: 'member',
    userId: owner.userId,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  assert.equal(t.invites.at(-1).status, 'revoked');
  throws(
    () =>
      apply(t, { userId: 'new', email: 'new@example.test' }, { type: 'accept', tokenHash: 'c'.repeat(64) }),
    409,
  );
});
test('last owner, invalid roles and cross-cohort staff scopes cannot bypass rules', () => {
  const t = setup();
  throws(
    () =>
      apply(t, owner, { type: 'member', userId: owner.userId, roles: ['learner'], scopes: [], active: true }),
    409,
  );
  throws(
    () =>
      apply(t, owner, {
        type: 'member',
        userId: reviewer.userId,
        roles: ['superuser'],
        scopes: [],
        active: true,
      }),
    422,
  );
  throws(
    () =>
      apply(t, owner, {
        type: 'member',
        userId: reviewer.userId,
        roles: ['moderator'],
        scopes: ['other-team-cohort'],
        active: true,
      }),
    422,
  );
});
test('capacity counts enrollment and withdrawal releases a place', () => {
  let t = setup();
  throws(() => apply(t, reviewer, { type: 'enroll', programId: p.id, cohortId: t.cohorts[0].id }), 409);
  const e = t.learners[0].state.enrollments[0];
  t = apply(t, learner, { type: 'withdraw', enrollmentId: e.id });
  t = apply(t, reviewer, { type: 'enroll', programId: p.id, cohortId: t.cohorts[0].id });
  assert.equal(projectTeam(t, reviewer).team.cohorts[0].occupied, 1);
  throws(() => apply(t, learner, { type: 'draft', enrollmentId: e.id, fields: {} }), 409);
});
test('closed cohorts allow existing learning; paused cohorts block learning but permit timely appeals', () => {
  let t = prepared(),
    c = assessment(t);
  t = apply(t, owner, { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'closed' });
  t = apply(t, learner, {
    type: 'draft',
    enrollmentId: c.enrollmentId,
    fields: { task: 'Closed cohort retains learning for existing members.' },
  });
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  t = apply(t, owner, c);
  t = apply(t, owner, { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'paused' });
  throws(() => apply(t, learner, { type: 'draft', enrollmentId: c.enrollmentId, fields: {} }), 409);
  t = apply(t, learner, {
    type: 'appeal',
    enrollmentId: c.enrollmentId,
    attemptId: c.attemptId,
    reason: 'Please inspect the source mapping and review independence carefully.',
  });
  assert.equal(t.learners[0].state.enrollments[0].appeals[0].status, 'open');
});
test('admin and facilitator projections exclude private evidence; assigned assessor gets only submitted snapshot', () => {
  let t = prepared(),
    c = assessment(t);
  const admin = JSON.stringify(projectTeam(t, owner)),
    facilitator = JSON.stringify(projectTeam(t, reviewer));
  assert.ok(!admin.includes('Synthetic submitted evidence'));
  assert.ok(!facilitator.includes('Synthetic submitted evidence'));
  assert.equal(projectTeam(t, reviewer).team.summaries.length, 1);
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  const projection = projectTeam(t, owner);
  assert.equal(projection.team.assigned.length, 1);
  assert.ok(!('draft' in projection.team.assigned[0].e));
  assert.equal(projection.state.enrollments.length, 0);
  assert.ok(!JSON.stringify(projection).includes('SECRET'));
});
test('self-review, unassigned review and client sample actor never confer authority', () => {
  const t = prepared(),
    c = assessment(t);
  throws(() => apply(t, owner, c), 404);
  throws(() => apply(t, learner, c), 403);
  throws(() => apply(t, owner, { ...c, actor: 'assessor-a' }), 400);
  throws(
    () =>
      apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: learner.userId }),
    403,
  );
});
test('appeals require assigned independence against immutable original assessor', () => {
  let t = prepared(),
    c = assessment(t);
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  t = apply(t, owner, c);
  const original = JSON.stringify(t.learners[0].state.enrollments[0].attempts[0].decision);
  t = apply(t, learner, {
    type: 'appeal',
    enrollmentId: c.enrollmentId,
    attemptId: c.attemptId,
    reason: 'Please recheck the verification evidence and the claimed safety gate.',
  });
  const ap = t.learners[0].state.enrollments[0].appeals[0],
    r = { ...c, type: 'resolve', appealId: ap.id, gates: [false, true, true] };
  delete r.attemptId;
  throws(
    () => apply(t, owner, { type: 'assign', kind: 'appeal', targetId: ap.id, staffId: owner.userId }),
    403,
  );
  throws(() => apply(t, owner, r), 403);
  throws(() => apply(t, reviewer, r), 404);
  t = apply(t, owner, { type: 'assign', kind: 'appeal', targetId: ap.id, staffId: reviewer.userId });
  t = apply(t, reviewer, r);
  const e = t.learners[0].state.enrollments[0];
  assert.equal(e.record.status, 'suspended');
  assert.equal(JSON.stringify(e.attempts[0].decision), original);
  assert.equal(e.appeals[0].resolution.actor, reviewer.userId);
  assert.equal(e.record.decisionId, e.appeals[0].resolution.id);
});
test('passing retry records its current assessor instead of an older failed appeal', () => {
  let t = prepared(),
    c = assessment(t);
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  t = apply(t, owner, c);
  t = apply(t, learner, {
    type: 'appeal',
    enrollmentId: c.enrollmentId,
    attemptId: c.attemptId,
    reason: 'Please recheck this verification gate and preserve the decision history.',
  });
  let e = t.learners[0].state.enrollments[0],
    ap = e.appeals[0];
  t = apply(t, owner, { type: 'assign', kind: 'appeal', targetId: ap.id, staffId: reviewer.userId });
  t = apply(t, reviewer, {
    ...c,
    type: 'resolve',
    attemptId: undefined,
    appealId: ap.id,
    gates: [false, true, true],
  });
  t = apply(t, learner, {
    type: 'submit',
    enrollmentId: e.id,
    confirmed: true,
    fields: e.attempts[0].fields,
  });
  c = assessment(t);
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  t = apply(t, owner, c);
  e = t.learners[0].state.enrollments[0];
  assert.equal(e.record.status, 'active');
  assert.equal(e.record.decisionId, e.attempts[1].decision.id);
  assert.notEqual(e.record.decisionId, e.appeals[0].resolution.id);
});
test('removing staff permission clears assignments and blocks stale finalization', () => {
  let t = prepared(),
    c = assessment(t);
  t = apply(t, owner, { type: 'assign', kind: 'assessment', targetId: c.attemptId, staffId: owner.userId });
  t = apply(t, owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner'],
    scopes: [],
    active: true,
  });
  assert.equal(t.assignments.length, 0);
  throws(() => apply(t, owner, c), 404);
});
test('cohort posts protect author email and report identity, and moderation preserves reasoned history', () => {
  let t = setup(),
    cid = t.cohorts[0].id;
  t = apply(t, learner, {
    type: 'post',
    cohortId: cid,
    title: 'A checked draft question',
    body: 'How can we check this fictional AI draft carefully before using it?',
  });
  const id = t.posts[0].id;
  assert.equal(t.posts[0].author, 'Academy member');
  throws(
    () =>
      apply(t, learner, {
        type: 'moderate',
        postId: id,
        status: 'visible',
        reason: 'Checked the fictional source references.',
      }),
    403,
  );
  throws(() => apply(t, reviewer, { type: 'moderate', postId: id, status: 'visible' }), 422);
  t = apply(t, reviewer, {
    type: 'moderate',
    postId: id,
    status: 'visible',
    reason: 'The fictional question fits this learning circle.',
  });
  t = apply(t, learner, {
    type: 'report',
    postId: id,
    reason: 'Please inspect the parent claim and its source reference.',
  });
  t = apply(t, learner, {
    type: 'reply',
    postId: id,
    body: 'A fictional reply showing a careful source check.',
  });
  t = apply(t, reviewer, {
    type: 'moderate',
    postId: id,
    replyId: t.posts[0].replies[0].id,
    status: 'visible',
    reason: 'A helpful fictional reply without private information.',
  });
  assert.equal(t.reports[0].status, 'open');
  assert.equal(projectTeam(t, learner).state.reports.length, 0);
  const mod = projectTeam(t, reviewer);
  assert.ok(!('reporterId' in mod.state.reports[0]));
  assert.equal(mod.team.moderationHistory.length, 2);
  t = apply(t, reviewer, {
    type: 'moderate',
    postId: id,
    status: 'hidden',
    reason: 'Parent source reference needs correction before republication.',
  });
  assert.equal(t.reports[0].status, 'resolved');
});
test('removed member retains own history, receives no cohort discussion and cannot mutate', () => {
  let t = prepared();
  t = apply(t, owner, {
    type: 'member',
    userId: learner.userId,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  const x = projectTeam(t, learner);
  assert.equal(x.team.active, false);
  assert.equal(x.state.enrollments.length, 1);
  assert.equal(x.state.posts.length, 0);
  throws(
    () =>
      apply(t, learner, {
        type: 'profile',
        name: 'Changed',
        context: 'msme',
        reading: false,
        networking: false,
      }),
    403,
  );
});

test('an invitation token cannot be reused within a workspace', () => {
  const t = setup();
  throws(
    () =>
      apply(t, owner, {
        type: 'invite',
        email: 'new@example.test',
        roles: ['learner'],
        scopes: [],
        tokenHash: t.invites[0].tokenHash,
      }),
    409,
  );
});

test('a moderator cannot read or moderate another existing cohort without its scope', () => {
  let t = setup();
  t = apply(t, owner, {
    type: 'cohort-create',
    title: 'Another actual cohort',
    programId: programs[0].id,
    capacity: 2,
  });
  const cid = t.cohorts[1].id;
  t = apply(t, owner, {
    type: 'post',
    cohortId: cid,
    title: 'A differently scoped question',
    body: 'A fictional post limited to this other actual cohort.',
  });
  const id = t.posts[0].id;
  throws(
    () =>
      apply(t, reviewer, {
        type: 'moderate',
        postId: id,
        status: 'visible',
        reason: 'Attempted out-of-scope moderation of a real cohort.',
      }),
    404,
  );
  assert.ok(!projectTeam(t, reviewer).state.posts.some((p) => p.id === id));
});
