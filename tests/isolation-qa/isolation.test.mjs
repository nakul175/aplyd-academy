/** BR-39 cross-boundary isolation: negative tests against the real team module bundle.
 * Two workspaces, and two cohorts inside one workspace. Everything is synthetic. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectTeam, deriveReportRollup, exportReport } from '../../.sites-runtime/wave3-qa/model.mjs';
import {
  NOW,
  at,
  apply,
  u,
  workspace,
  withReport,
  escalate,
  status,
  PROG_A,
  PROG_B,
  LONG,
} from '../escalation-qa/fixture.mjs';
import { projectOrgOverview } from '../../.sites-runtime/wave4-qa/model.mjs';

const same = (a, b, label) => {
  assert.ok(a, label + ': denied call must fail');
  assert.ok(b, label + ': unknown call must fail');
  assert.deepEqual(a, b, label + ': denied and unknown must be indistinguishable');
};
const attempt = (t, who, c) => status(() => apply(t, who, c));
const fp = (x) => JSON.stringify(x);

/** Workspace one with a report, a support thread, a network session/profile, a pending review. */
function rich(id = 'ws-one', ownerId = 'owner') {
  let w = withReport(workspace(id, ownerId)),
    t = w.t;
  const e = t.learners.find((l) => l.userId === w.ids.lrnA1).state.enrollments[0];
  for (const les of PROG_A.lessons)
    t = apply(t, u(w, 'lrnA1'), {
      type: 'lesson',
      enrollmentId: e.id,
      lessonId: les.id,
      practice: LONG,
      answers: les.quiz.map((q) => q.correctOptionIndex),
    });
  t = apply(t, u(w, 'lrnA1'), {
    type: 'draft',
    enrollmentId: e.id,
    fields: { task: 'PRIVATE-DRAFT-A1 not for anyone else.' },
  });
  t = apply(t, u(w, 'lrnA1'), {
    type: 'submit',
    enrollmentId: e.id,
    confirmed: true,
    fields: Object.fromEntries(
      PROG_A.practicalAssessment.submissionPrompts.map((f) => [f.id, 'SUBMITTED-A1 ' + LONG]),
    ),
  });
  const attemptId = t.learners.find((l) => l.userId === w.ids.lrnA1).state.enrollments[0].attempts[0].id;
  t = apply(t, u(w, 'lrnA1'), {
    type: 'support-open',
    category: 'learning',
    cohortId: w.A,
    subject: 'SUPPORT-SUBJECT-A1 help',
    body: 'SUPPORT-BODY-A1 a fictional request for help.',
    audienceAcknowledged: true,
  });
  const supportId = t.support[0].id;
  t = apply(t, u(w, 'modA'), {
    type: 'network-profile',
    enabled: true,
    bio: 'DIRECTORY-BIO-MODA a fictional bio.',
    focus: 'Checking AI drafts',
    cohortIds: [w.A],
  });
  t = apply(t, u(w, 'facA'), {
    type: 'session-create',
    cohortId: w.A,
    title: 'Session for cohort A',
    description: 'A fictional session purpose for cohort A.',
    startsAt: at(48),
    endsAt: at(49),
    capacity: 5,
    instructions: 'JOIN-INSTRUCTIONS-A secret link.',
  });
  const sessionId = t.network.sessions[0].id;
  t = escalate({ ...w, t }, 'modA', { reason: 'ESCALATION-REASON-A for the owner only.' });
  return { ...w, t, enrollmentId: e.id, attemptId, supportId, sessionId, escalationId: t.escalations[0].id };
}
const A_SECRETS = [
  'PRIVATE-DRAFT-A1',
  'SUBMITTED-A1',
  'SUPPORT-SUBJECT-A1',
  'SUPPORT-BODY-A1',
  'DIRECTORY-BIO-MODA',
  'JOIN-INSTRUCTIONS-A',
  'ESCALATION-REASON-A',
  'A fictional discussion body',
];

test('cohort B-only users receive none of cohort A private content in their projection', () => {
  const w = rich();
  for (const who of ['modB', 'assessB', 'lrnB1']) {
    const blob = fp(projectTeam(w.t, u(w, who)));
    for (const s of A_SECRETS) assert.ok(!blob.includes(s), `${who} saw ${s}`);
    assert.ok(!blob.includes(w.postId), who + ' saw cohort A post id');
  }
});
test('nobody but the learner sees draft and submitted evidence, even owner, facilitator and reviewer of the same cohort', () => {
  const w = rich();
  for (const who of ['owner', 'facA', 'modA', 'revA', 'lrnA2', 'plain']) {
    const blob = fp(projectTeam(w.t, u(w, who)));
    assert.ok(!blob.includes('PRIVATE-DRAFT-A1'), who + ' saw draft');
    if (who !== 'revA') assert.ok(!blob.includes('SUBMITTED-A1'), who + ' saw submission');
  }
});
test('posts, replies and reports: a member without board access gets the same error as an unknown id', () => {
  const w = rich(),
    unknown = '11111111-1111-4111-8111-111111111111';
  for (const who of ['modB', 'lrnB1', 'assessB'])
    for (const [type, extra] of [
      ['reply', { body: 'A fictional reply that is long enough.' }],
      ['report', { reason: 'A fictional reason that is long enough.' }],
      ['moderate', { status: 'hidden', reason: 'A fictional reason that is long enough.' }],
    ])
      same(
        attempt(w.t, u(w, who), { type, postId: w.postId, ...extra }),
        attempt(w.t, u(w, who), { type, postId: unknown, ...extra }),
        who + ' ' + type,
      );
  same(
    attempt(w.t, u(w, 'modB'), {
      type: 'post',
      cohortId: w.A,
      title: 'A fictional post title',
      body: 'A fictional body that is long enough to post.',
    }) && { status: 404, message: 'x' },
    { status: 404, message: 'x' },
    'post attempt fails',
  );
  assert.equal(
    attempt(w.t, u(w, 'modB'), {
      type: 'post',
      cohortId: w.A,
      title: 'A fictional post title',
      body: 'A fictional body that is long enough to post.',
    }).status,
    404,
  );
});
test('pending posts and replies stay with their author and in-scope moderators', () => {
  let w = rich();
  w.t = apply(w.t, u(w, 'lrnA2'), {
    type: 'post',
    cohortId: w.A,
    title: 'A pending fictional post',
    body: 'A pending fictional post body long enough.',
  });
  const pid = w.t.posts[0].id;
  for (const who of ['lrnA1', 'lrnA3', 'facA', 'modB', 'lrnB1', 'owner'])
    assert.ok(!projectTeam(w.t, u(w, who)).state.posts.some((p) => p.id === pid), who);
  for (const who of ['lrnA2', 'modA'])
    assert.ok(
      projectTeam(w.t, u(w, who)).state.posts.some((p) => p.id === pid),
      who,
    );
});
test('reports: only moderators of that cohort receive them, without reporter identity', () => {
  const w = rich();
  for (const who of ['modB', 'facA', 'lrnA2', 'lrnA1', 'owner', 'assessB', 'revA'])
    assert.equal(
      projectTeam(w.t, u(w, who)).state.reports.length,
      who === 'owner' ? projectTeam(w.t, u(w, who)).state.reports.length : 0,
      who,
    );
  const mod = projectTeam(w.t, u(w, 'modA')).state.reports;
  assert.equal(mod.length, 1);
  assert.ok(!fp(mod).includes(w.ids.lrnA2));
});
test('enrollments: out-of-scope staff, other-cohort learners and strangers cannot read or act on cohort A enrollment', () => {
  const w = rich(),
    cmd = {
      type: 'assess',
      learnerId: w.ids.lrnA1,
      enrollmentId: w.enrollmentId,
      attemptId: w.attemptId,
      scores: [4, 4, 4, 4],
      gates: [true, true, true],
      notes: Array(4).fill('Evidence checked against the fictional source packet.'),
      feedback:
        'Verified reasoning, careful data handling and the human approval route meet the practice standard.',
    };
  for (const who of ['modB', 'assessB', 'lrnB1', 'facA', 'lrnA2', 'plain', 'owner'])
    assert.ok(
      status(() => apply(w.t, u(w, who), cmd)),
      who,
    );
  for (const who of ['modB', 'assessB', 'lrnB1']) {
    const p = projectTeam(w.t, u(w, who));
    assert.equal(p.team.summaries.length, 0, who);
    assert.equal(p.team.assigned.length, 0, who);
    assert.equal(p.state.enrollments.length, who === 'lrnB1' ? 1 : 0);
  }
  assert.equal(
    projectTeam(w.t, u(w, 'facA')).team.summaries.every((s) => s.cohortId === w.A),
    true,
  );
  assert.equal(projectTeam(w.t, u(w, 'facA')).state.enrollments.length, 0);
  // own-learning commands cannot be aimed at another learner
  for (const who of ['lrnB1', 'facA', 'owner'])
    assert.equal(
      attempt(w.t, u(w, who), { type: 'withdraw', enrollmentId: w.enrollmentId, learnerId: w.ids.lrnA1 })
        .status,
      400,
      who,
    );
  assert.equal(
    status(() => apply(w.t, u(w, 'lrnB1'), { type: 'withdraw', enrollmentId: w.enrollmentId })).status,
    404,
  );
  const own = status(() => apply(w.t, u(w, 'lrnB1'), { type: 'withdraw', enrollmentId: w.enrollmentId })),
    unk = status(() =>
      apply(w.t, u(w, 'lrnB1'), { type: 'withdraw', enrollmentId: '22222222-2222-4222-8222-222222222222' }),
    );
  same(own, unk, 'withdraw another learner enrollment');
});
test('facilitator summaries are scoped to their cohorts and never include another cohort learner', () => {
  const w = rich(),
    s = projectTeam(w.t, u(w, 'facA')).team.summaries;
  assert.ok(s.length >= 3);
  assert.ok(!fp(s).includes(w.B));
  assert.ok(!s.some((x) => x.learnerId === w.ids.lrnB1));
  assert.equal(
    projectTeam(w.t, u(w, 'owner')).team.summaries.some((x) => x.learnerId === w.ids.lrnB1),
    true,
  );
});
test('support threads: other-cohort staff, other learners and strangers get the unknown-id error', () => {
  const w = rich(),
    unknown = '33333333-3333-4333-8333-333333333333';
  for (const who of ['modB', 'assessB', 'lrnB1', 'lrnA2', 'plain', 'revA'])
    for (const [type, extra] of [
      ['support-reply', { body: 'A fictional reply long enough.' }],
      ['support-claim', {}],
      ['support-resolve', { resolution: 'A fictional resolution that is long enough.' }],
      ['support-withdraw', {}],
      ['support-reopen', { body: 'A fictional reopen reason long enough.' }],
    ])
      same(
        attempt(w.t, u(w, who), { type, requestId: w.supportId, ...extra }),
        attempt(w.t, u(w, who), { type, requestId: unknown, ...extra }),
        who + ' ' + type,
      );
  for (const who of ['modB', 'assessB', 'lrnB1', 'lrnA2', 'plain', 'revA']) {
    const p = projectTeam(w.t, u(w, who)).team.support,
      blob = fp(p);
    assert.ok(!blob.includes('SUPPORT-'), who + ' read support text');
  }
  assert.ok(fp(projectTeam(w.t, u(w, 'facA')).team.support).includes('SUPPORT-SUBJECT-A1'));
  assert.ok(fp(projectTeam(w.t, u(w, 'owner')).team.support).includes('SUPPORT-SUBJECT-A1'));
});
test('support: staff scoped to another cohort cannot take over a facilitator-only request', () => {
  const w = rich();
  for (const who of ['modB', 'assessB'])
    assert.ok(attempt(w.t, u(w, who), { type: 'support-claim', requestId: w.supportId }));
  assert.ok(
    attempt(w.t, u(w, 'lrnA1'), { type: 'support-claim', requestId: w.supportId }),
    'requester cannot self-handle',
  );
});
test('network: directory and sessions of cohort A are invisible to cohort B members; RSVP and hosting are denied like unknown ids', () => {
  const w = rich();
  for (const who of ['modB', 'assessB', 'lrnB1']) {
    const n = projectTeam(w.t, u(w, who)).team.network;
    assert.equal(
      n.directory.some((d) => d.name && fp(d).includes('DIRECTORY-BIO')),
      false,
      who,
    );
    assert.equal(n.sessions.length, 0, who);
  }
  assert.ok(fp(projectTeam(w.t, u(w, 'lrnA2')).team.network).includes('DIRECTORY-BIO-MODA'));
  const unknown = '44444444-4444-4444-8444-444444444444';
  for (const who of ['modB', 'lrnB1', 'assessB'])
    for (const [type, extra] of [
      ['session-rsvp', { going: true }],
      ['session-cancel', { reason: 'A fictional cancellation reason.' }],
      [
        'session-attendance',
        { registrationId: 'x', status: 'attended', reason: 'A fictional attendance basis.' },
      ],
    ])
      same(
        attempt(w.t, u(w, who), { type, sessionId: w.sessionId, ...extra }),
        attempt(w.t, u(w, who), { type, sessionId: unknown, ...extra }),
        who + ' ' + type,
      );
  assert.equal(
    attempt(w.t, u(w, 'lrnB1'), {
      type: 'network-profile',
      enabled: true,
      bio: 'A fictional bio long enough.',
      focus: 'Checking AI drafts',
      cohortIds: [w.A],
    }).status,
    403,
  );
  same(
    attempt(w.t, u(w, 'lrnB1'), {
      type: 'network-profile',
      enabled: true,
      bio: 'A fictional bio long enough.',
      focus: 'Checking AI drafts',
      cohortIds: [w.A],
    }),
    attempt(w.t, u(w, 'lrnB1'), {
      type: 'network-profile',
      enabled: true,
      bio: 'A fictional bio long enough.',
      focus: 'Checking AI drafts',
      cohortIds: ['55555555-5555-4555-8555-555555555555'],
    }),
    'profile cohort',
  );
  same(
    attempt(w.t, u(w, 'modB'), {
      type: 'session-create',
      cohortId: w.A,
      title: 'A fictional session',
      description: 'A fictional description long enough.',
      startsAt: at(72),
      endsAt: at(73),
      capacity: 2,
      instructions: 'A fictional instruction.',
    }),
    attempt(w.t, u(w, 'modB'), {
      type: 'session-create',
      cohortId: '66666666-6666-4666-8666-666666666666',
      title: 'A fictional session',
      description: 'A fictional description long enough.',
      startsAt: at(72),
      endsAt: at(73),
      capacity: 2,
      instructions: 'A fictional instruction.',
    }),
    'session-create',
  );
});
test('escalations: other-cohort moderators and members cannot escalate, read or decide; same error as unknown ids', () => {
  const w = rich();
  for (const who of ['modB', 'assessB', 'lrnB1', 'facA', 'lrnA2', 'plain']) {
    same(
      attempt(w.t, u(w, who), {
        type: 'escalate-report',
        reportId: w.reportId,
        severity: 'low',
        reason: 'A fictional probing reason.',
      }),
      attempt(w.t, u(w, who), {
        type: 'escalate-report',
        reportId: '77777777-7777-4777-8777-777777777777',
        severity: 'low',
        reason: 'A fictional probing reason.',
      }),
      who + ' escalate',
    );
    same(
      attempt(w.t, u(w, who), {
        type: 'escalation-resolve',
        escalationId: w.escalationId,
        decision: 'dismiss',
        reason: 'A fictional probing reason.',
      }),
      attempt(w.t, u(w, who), {
        type: 'escalation-resolve',
        escalationId: '88888888-8888-4888-8888-888888888888',
        decision: 'dismiss',
        reason: 'A fictional probing reason.',
      }),
      who + ' resolve',
    );
    assert.ok(!fp(projectTeam(w.t, u(w, who)).team.escalations).includes('ESCALATION-REASON-A'), who);
  }
});
test('moderator of cohort B cannot see moderation history of cohort A', () => {
  const w = rich();
  assert.ok(projectTeam(w.t, u(w, 'modA')).team.moderationHistory.length >= 1);
  assert.equal(projectTeam(w.t, u(w, 'modB')).team.moderationHistory.length, 0);
});
test('reports and exports: out-of-scope roles and cohorts are denied identically; exports hold nothing of cohort A for cohort B staff', () => {
  const w = rich();
  for (const who of ['modB', 'lrnB1', 'lrnA1', 'plain', 'modA']) {
    const e = status(() => deriveReportRollup(w.t, w.ids[who] ?? who, NOW));
    assert.equal(e?.status, 404, who);
    assert.equal(projectTeam(w.t, u(w, who)).team.reports, null, who);
  }
  const b = deriveReportRollup(w.t, w.ids.assessB, NOW),
    blob = fp(b) + exportReport(b, 'csv').content + exportReport(b, 'json').content;
  assert.deepEqual(b.cohortIds, [w.B]);
  assert.ok(!blob.includes(w.A) && !blob.includes('Cohort A'));
  same(
    status(() => deriveReportRollup(w.t, w.ids.assessB, NOW, { cohortIds: [w.A] })),
    status(() =>
      deriveReportRollup(w.t, w.ids.assessB, NOW, { cohortIds: ['99999999-9999-4999-8999-999999999999'] }),
    ),
    'cohort filter',
  );
  const fac = deriveReportRollup(w.t, w.ids.facA, NOW);
  assert.deepEqual(fac.cohortIds, [w.A]);
  assert.ok(!fp(fac).includes(w.B));
});

/* Across workspaces */
function twoWorkspaces() {
  const one = rich('ws-one', 'owner'),
    two = rich('ws-two', 'owner2');
  return { one, two };
}
test('workspace boundary: a member of one workspace has no standing in another, for every command and projection', () => {
  const { one, two } = twoWorkspaces();
  const intruders = [u(one, 'owner'), u(one, 'modA'), u(one, 'facA'), u(one, 'lrnA1'), u(one, 'revA')];
  const cmds = [
    {
      type: 'post',
      cohortId: two.A,
      title: 'A fictional post title',
      body: 'A fictional body that is long enough to post.',
    },
    { type: 'enroll', programId: PROG_A.id, cohortId: two.A },
    { type: 'moderate', postId: two.postId, status: 'hidden', reason: 'A fictional reason long enough.' },
    {
      type: 'escalation-resolve',
      escalationId: two.escalationId,
      decision: 'resolve',
      reason: 'A fictional reason long enough.',
    },
    { type: 'support-reply', requestId: two.supportId, body: 'A fictional reply long enough.' },
    { type: 'session-rsvp', sessionId: two.sessionId, going: true },
    { type: 'member', userId: two.ids.modA, roles: ['admin'], scopes: [], active: true },
    { type: 'invite', email: 'a@b.example.test', roles: ['admin'], scopes: [], tokenHash: 'a'.repeat(64) },
    { type: 'cohort-create', title: 'Intruder cohort', programId: PROG_A.id, capacity: 5 },
  ];
  for (const who of intruders) {
    const pr = status(() => projectTeam(two.t, who));
    assert.equal(pr?.status, 404, 'project ' + who.userId);
    const msgs = new Set();
    for (const c of cmds) {
      const r = status(() => apply(two.t, who, c));
      assert.equal(r?.status, 404, who.userId + ' ' + c.type);
      msgs.add(r.message);
    }
    assert.equal(msgs.size, 1);
    assert.equal(status(() => deriveReportRollup(two.t, who.userId, NOW))?.status, 404);
  }
});
test('workspace boundary: ids replayed from workspace one inside workspace two (even by its owner and staff) fail like unknown ids', () => {
  const { one, two } = twoWorkspaces();
  const probes = [
    [
      'owner2',
      {
        type: 'escalation-resolve',
        escalationId: one.escalationId,
        decision: 'resolve',
        reason: 'A fictional replay of a foreign id.',
      },
    ],
    [
      'modA',
      {
        type: 'escalate-report',
        reportId: one.reportId,
        severity: 'low',
        reason: 'A fictional replay of a foreign id.',
      },
    ],
    [
      'modA',
      {
        type: 'moderate',
        postId: one.postId,
        status: 'hidden',
        reason: 'A fictional replay of a foreign id.',
      },
    ],
    ['lrnA2', { type: 'report', postId: one.postId, reason: 'A fictional replay of a foreign id.' }],
    ['lrnA2', { type: 'reply', postId: one.postId, body: 'A fictional replay of a foreign id.' }],
    [
      'lrnA1',
      { type: 'support-reply', requestId: one.supportId, body: 'A fictional replay of a foreign id.' },
    ],
    ['facA', { type: 'support-claim', requestId: one.supportId }],
    ['lrnA2', { type: 'session-rsvp', sessionId: one.sessionId, going: true }],
    [
      'facA',
      { type: 'session-cancel', sessionId: one.sessionId, reason: 'A fictional replay of a foreign id.' },
    ],
    ['lrnA3', { type: 'withdraw', enrollmentId: one.enrollmentId }],
  ];
  for (const [who, cmd] of probes) {
    const foreign = status(() => apply(two.t, u(two, who), cmd)),
      mutated = { ...cmd };
    for (const k of Object.keys(mutated))
      if (/Id$/.test(k) && k !== 'learnerId') mutated[k] = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    same(
      foreign,
      status(() => apply(two.t, u(two, who), mutated)),
      who + ' ' + cmd.type,
    );
  }
});
test('workspace boundary: one user may be staff in one workspace and a plain learner in another without any carry-over', () => {
  const one = rich('ws-one', 'owner'),
    twoBase = workspace('ws-two', 'owner2');
  let t = apply(twoBase.t, 'owner2', {
    type: 'invite',
    email: 'dual@x.example.test',
    roles: ['learner'],
    scopes: [],
    tokenHash: 'd'.repeat(64),
  });
  const dual = { userId: 'dual', email: 'dual@x.example.test' };
  t = apply(t, dual, { type: 'accept', tokenHash: 'd'.repeat(64) });
  let o = apply(one.t, 'owner', {
    type: 'invite',
    email: 'dual@x.example.test',
    roles: ['moderator', 'facilitator', 'assessor'],
    scopes: [one.A],
    tokenHash: 'e'.repeat(64),
  });
  o = apply(o, dual, { type: 'accept', tokenHash: 'e'.repeat(64) });
  const tProj = projectTeam(t, dual);
  assert.deepEqual(tProj.team.roles, ['learner']);
  assert.equal(tProj.team.reports, null);
  assert.equal(tProj.team.summaries.length, 0);
  assert.equal(
    status(() =>
      apply(t, dual, {
        type: 'moderate',
        postId: twoBase.t.posts[0]?.id ?? 'x',
        status: 'hidden',
        reason: 'A fictional reason long enough.',
      }),
    )?.status,
    404,
  );
  assert.ok(projectTeam(o, dual).team.reports);
});
test('workspace boundary: invitation tokens cannot be replayed in another workspace', () => {
  const one = workspace('ws-one', 'owner'),
    two = workspace('ws-two', 'owner2');
  let o = apply(one.t, 'owner', {
    type: 'invite',
    email: 'guest@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  assert.equal(
    status(() =>
      apply(
        two.t,
        { userId: 'guest', email: 'guest@x.example.test' },
        { type: 'accept', tokenHash: 'c'.repeat(64) },
      ),
    )?.status,
    404,
  );
  assert.ok(!two.t.members.some((m) => m.userId === 'guest'));
});
test('workspace boundary: projection and reports of one workspace never embed the other workspace data', () => {
  const { one, two } = twoWorkspaces(),
    a = fp(projectTeam(one.t, u(one, 'owner'))),
    b = fp(projectTeam(two.t, u(two, 'owner2')));
  assert.ok(
    !a.includes('ws-two') && !a.includes('Fictional pilot ws-two') && !b.includes('Fictional pilot ws-one'),
  );
  const ra = exportReport(deriveReportRollup(one.t, 'owner', NOW), 'csv'),
    rb = deriveReportRollup(two.t, 'owner2', NOW);
  assert.ok(!ra.content.includes('ws-two') && !fp(rb).includes(one.A) && !fp(rb).includes(one.B));
  assert.equal(rb.workspaceId, 'ws-two');
});
test('removed members lose staff reads immediately, keep only their own history', () => {
  let w = rich();
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.facA,
    roles: ['facilitator'],
    scopes: [w.A],
    active: false,
  });
  const p = projectTeam(w.t, u(w, 'facA'));
  assert.equal(p.team.summaries.length, 0);
  assert.equal(p.team.reports, null);
  assert.equal(p.team.escalations.items.length, 0);
  assert.deepEqual(p.state.posts, []);
  assert.equal(p.team.network.sessions.length, 0);
  assert.equal(status(() => deriveReportRollup(w.t, w.ids.facA, NOW))?.status, 404);
});
/* Regression: two existence oracles found by this suite and fixed in lib/academy-teams.ts. */
test('regression: assessing an existing but unassigned enrollment is indistinguishable from an unknown enrollment', () => {
  const w = rich(),
    e = w.enrollmentId,
    base = {
      type: 'assess',
      learnerId: w.ids.lrnA1,
      attemptId: w.attemptId,
      scores: [4, 4, 4, 4],
      gates: [true, true, true],
      notes: [],
      feedback: 'x',
    },
    unk = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  for (const who of ['modB', 'assessB', 'plain', 'owner', 'facA', 'lrnB1'])
    same(
      attempt(w.t, u(w, who), { ...base, enrollmentId: e }),
      attempt(w.t, u(w, who), { ...base, enrollmentId: unk }),
      who + ' assess',
    );
  for (const who of ['modB', 'owner'])
    same(
      attempt(w.t, u(w, who), { ...base, type: 'resolve', appealId: 'x', enrollmentId: e }),
      attempt(w.t, u(w, who), { ...base, type: 'resolve', appealId: 'x', enrollmentId: unk }),
      who + ' resolve',
    );
});
test('regression: posting to a cohort without board access is indistinguishable from an unknown cohort', () => {
  const w = rich(),
    body = {
      type: 'post',
      title: 'A fictional post title',
      body: 'A fictional body that is long enough to post.',
    };
  for (const who of ['modB', 'assessB'])
    same(
      attempt(w.t, u(w, who), { ...body, cohortId: w.A }),
      attempt(w.t, u(w, who), { ...body, cohortId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      who + ' post',
    );
});
/* Data requests (BR-44) and recovery requests (BR-04): boundaries across workspaces, cohorts and roles. */
const DR_SECRET = 'PRIVATE-REQUEST-DETAIL-A1';
function withRequests(id = 'ws-one', ownerId = 'owner') {
  let w = rich(id, ownerId);
  w.t = apply(w.t, u(w, 'lrnA2'), {
    type: 'draft',
    enrollmentId: w.t.learners.find((l) => l.userId === w.ids.lrnA2).state.enrollments[0].id,
    fields: { task: 'PRIVATE-DRAFT-A2 not for anyone else.' },
  });
  w.t = apply(w.t, u(w, 'lrnA1'), {
    type: 'data-request-open',
    kind: 'export',
    detail: DR_SECRET + ' please export my records.',
  });
  w.reqId = w.t.dataRequests.requests[0].id;
  w.t = apply(w.t, u(w, 'plain'), {
    type: 'recovery-request',
    claimedEmail: `lrnA3@${id}.example.test`,
    cohortHint: 'RECOVERY-HINT-PLAIN',
    activityHint: '',
    note: 'RECOVERY-NOTE-PLAIN',
  });
  w.recId = w.t.recovery[0].id;
  return w;
}
const U1 = '11111111-1111-4111-8111-111111111111';
const drCmds = (id, rev = 1) => [
  {
    type: 'data-request-verify',
    requestId: id,
    requestRev: rev,
    passed: ['account-email', 'roster-details'],
  },
  {
    type: 'data-request-decide',
    requestId: id,
    requestRev: rev,
    outcome: 'decline',
    reason: 'A fictional reason long enough.',
  },
  { type: 'data-request-withdraw', requestId: id, requestRev: rev },
  {
    type: 'data-request-restriction',
    requestId: id,
    requestRev: rev,
    restricted: true,
    reason: 'A fictional reason long enough.',
  },
];
test('data requests: other learners, staff and other-cohort users cannot read or act on a request; denied equals unknown', () => {
  const w = withRequests();
  for (const who of ['lrnA2', 'lrnA3', 'lrnB1', 'plain', 'modA', 'modB', 'facA', 'revA', 'assessB']) {
    const dr = projectTeam(w.t, u(w, who)).team.dataRequests,
      blob = fp(dr);
    assert.ok(!blob.includes(DR_SECRET), who + ' read request text');
    assert.equal(dr.queue.length, 0, who + ' has a queue');
    assert.ok(!dr.mine.some((r) => r.id === w.reqId), who);
    const real = drCmds(w.reqId),
      fake = drCmds(U1);
    real.forEach((c, i) =>
      same(attempt(w.t, u(w, who), c), attempt(w.t, u(w, who), fake[i]), who + ' ' + c.type),
    );
  }
  // the one request is visible to its requester and to the workspace owner only
  assert.ok(fp(projectTeam(w.t, u(w, 'lrnA1')).team.dataRequests.mine).includes(DR_SECRET));
  assert.ok(fp(projectTeam(w.t, u(w, 'owner')).team.dataRequests.queue).includes(DR_SECRET));
  // the requester cannot verify or decide their own request
  for (const c of drCmds(w.reqId).filter((c) =>
    ['data-request-verify', 'data-request-decide', 'data-request-restriction'].includes(c.type),
  ))
    assert.equal(attempt(w.t, u(w, 'lrnA1'), c)?.status, 403, c.type);
});
test('data requests: an export holds only the requester own records, and its body reaches the requester only', () => {
  let w = withRequests();
  w.t = apply(w.t, 'owner', {
    type: 'data-request-verify',
    requestId: w.reqId,
    requestRev: 1,
    passed: ['account-email', 'roster-details'],
  });
  w.t = apply(w.t, 'owner', {
    type: 'data-request-decide',
    requestId: w.reqId,
    requestRev: 2,
    outcome: 'approve',
    reason: 'Checks passed; fictional approval.',
  });
  const mine = projectTeam(w.t, u(w, 'lrnA1')).team.dataRequests.mine[0],
    json = mine.export?.json ?? '';
  assert.ok(json.length > 100, 'requester receives the export body');
  for (const s of [
    'PRIVATE-DRAFT-A2',
    'SUPPORT-SUBJECT-A1',
    'SUPPORT-BODY-A1',
    'ESCALATION-REASON-A',
    'DIRECTORY-BIO-MODA',
    'JOIN-INSTRUCTIONS-A',
    w.ids.lrnB1,
    w.ids.modA,
    'tokenHash',
  ])
    assert.ok(!json.includes(s), 'export leaked ' + s);
  const q = projectTeam(w.t, u(w, 'owner')).team.dataRequests.queue[0];
  assert.ok(q.export && !('json' in q.export), 'owner queue holds only the checksum, not the body');
  for (const who of ['lrnA2', 'modA', 'modB', 'lrnB1', 'facA'])
    assert.ok(
      !fp(projectTeam(w.t, u(w, who)).team.dataRequests).includes(mine.sha256),
      who + ' saw the export checksum',
    );
});
test('data requests: no standing across workspaces; ids replayed in another workspace fail like unknown ids', () => {
  const one = withRequests('ws-one', 'owner'),
    two = withRequests('ws-two', 'owner2');
  const intruders = [u(one, 'owner'), u(one, 'lrnA1'), u(one, 'modA')];
  for (const who of intruders)
    for (const c of [
      { type: 'data-request-open', kind: 'export', detail: 'A fictional probe from another workspace.' },
      ...drCmds(two.reqId),
    ])
      assert.equal(attempt(two.t, who, c)?.status, 404, who.userId + ' ' + c.type);
  for (const who of ['owner2', 'lrnA1', 'lrnA2', 'modA']) {
    const real = drCmds(one.reqId),
      fake = drCmds(U1);
    real.forEach((c, i) =>
      same(attempt(two.t, u(two, who), c), attempt(two.t, u(two, who), fake[i]), who + ' ' + c.type),
    );
  }
  assert.ok(
    !fp(projectTeam(two.t, u(two, 'owner2'))).includes('ws-one') &&
      !fp(projectTeam(two.t, u(two, 'owner2')).team.dataRequests).includes(one.reqId),
  );
  assert.equal(one.t.dataRequests.requests.length, 1);
  assert.equal(two.t.dataRequests.requests.length, 1);
});
test('data requests: removed members lose queue and filing rights; a removed owner can decide nothing; own history stays readable', () => {
  let w = withRequests();
  w.t = apply(w.t, 'owner', {
    type: 'invite',
    email: 'co@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  const co = { userId: 'co', email: 'co@x.example.test' };
  w.t = apply(w.t, co, { type: 'accept', tokenHash: 'c'.repeat(64) });
  assert.equal(projectTeam(w.t, co).team.dataRequests.queue.length, 1);
  w.t = apply(w.t, 'owner', { type: 'member', userId: 'co', roles: ['admin'], scopes: [], active: false });
  assert.equal(projectTeam(w.t, co).team.dataRequests.queue.length, 0);
  assert.ok(!fp(projectTeam(w.t, co).team.dataRequests).includes(DR_SECRET));
  for (const c of drCmds(w.reqId)) assert.equal(attempt(w.t, co, c)?.status, 403, 'removed ' + c.type);
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.lrnA1,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  assert.equal(
    attempt(w.t, u(w, 'lrnA1'), {
      type: 'data-request-open',
      kind: 'correction',
      detail: 'A fictional correction long enough.',
      proposed: { name: 'New Name' },
    })?.status,
    403,
  );
  assert.ok(
    fp(projectTeam(w.t, u(w, 'lrnA1')).team.dataRequests.mine).includes(DR_SECRET),
    'own history stays readable',
  );
});
test('recovery: requests, candidates and decisions are visible to owners and the requester only; outsiders get the unknown-id error', () => {
  const w = withRequests();
  const dec = (id) => ({
    type: 'recovery-decide',
    requestId: id,
    decision: 'decline',
    reason: 'A fictional reason long enough.',
    checklist: { cohort: true, email: true, lastActivity: false },
    reviewedVersion: 1,
  });
  for (const who of ['lrnA1', 'lrnA2', 'lrnA3', 'lrnB1', 'modA', 'modB', 'facA', 'revA', 'assessB']) {
    const r = projectTeam(w.t, u(w, who)).team.recovery,
      blob = fp(r);
    assert.equal(r.queue.length, 0, who);
    assert.ok(
      !blob.includes('RECOVERY-HINT-PLAIN') &&
        !blob.includes('RECOVERY-NOTE-PLAIN') &&
        !blob.includes(w.ids.lrnA3),
      who + ' read a recovery request',
    );
    assert.equal(r.mine.length, 0, who);
    same(
      attempt(w.t, u(w, who), { type: 'recovery-withdraw', requestId: w.recId }),
      attempt(w.t, u(w, who), { type: 'recovery-withdraw', requestId: U1 }),
      who + ' withdraw',
    );
    same(attempt(w.t, u(w, who), dec(w.recId)), attempt(w.t, u(w, who), dec(U1)), who + ' decide');
    assert.equal(attempt(w.t, u(w, who), dec(w.recId)).status, 403, who + ' decide is a plain refusal');
  }
  const own = projectTeam(w.t, u(w, 'plain')).team.recovery;
  assert.equal(own.mine.length, 1);
  assert.equal(own.queue.length, 0);
  assert.ok(!fp(own).includes(w.ids.lrnA3), 'the requester is not told which account matched');
  const q = projectTeam(w.t, u(w, 'owner')).team.recovery.queue;
  assert.equal(q.length, 1);
  assert.equal(q[0].candidate.email, 'lrna3@ws-one.example.test');
});
test('recovery: the same response whether the claimed email matches a member or not; the requester cannot decide their own request', () => {
  const w = withRequests(),
    hit = projectTeam(w.t, u(w, 'plain')).team.recovery.mine[0];
  let t = apply(w.t, u(w, 'plain'), { type: 'recovery-withdraw', requestId: w.recId });
  t = apply(t, u(w, 'plain'), {
    type: 'recovery-request',
    claimedEmail: 'nobody-here@example.test',
    cohortHint: '',
    activityHint: '',
    note: '',
  });
  const miss = projectTeam(t, u(w, 'plain')).team.recovery.mine.at(-1),
    shape = (r) => ({
      status: r.status,
      reason: r.reason,
      decidedAt: r.decidedAt,
      keys: Object.keys(r).sort(),
    });
  assert.deepEqual(shape(miss), shape({ ...hit, status: 'pending' }));
  assert.equal(
    attempt(t, u(w, 'plain'), {
      type: 'recovery-decide',
      requestId: t.recovery.at(-1).id,
      decision: 'approve',
      reason: 'A fictional self approval.',
      checklist: { cohort: true, email: true, lastActivity: true },
      reviewedVersion: t.recovery.at(-1).version,
    })?.status,
    403,
  );
});
test('recovery: no standing across workspaces; a foreign request id fails like an unknown id; a member of another workspace cannot be recovered into this one', () => {
  const one = withRequests('ws-one', 'owner'),
    two = withRequests('ws-two', 'owner2');
  for (const who of [u(one, 'owner'), u(one, 'plain'), u(one, 'modA')])
    for (const c of [
      {
        type: 'recovery-request',
        claimedEmail: 'a@b.example.test',
        cohortHint: '',
        activityHint: '',
        note: '',
      },
      { type: 'recovery-withdraw', requestId: two.recId },
      {
        type: 'recovery-decide',
        requestId: two.recId,
        decision: 'decline',
        reason: 'A fictional reason long enough.',
        checklist: { cohort: true, email: true, lastActivity: false },
        reviewedVersion: 1,
      },
    ])
      assert.equal(attempt(two.t, who, c)?.status, 404, who.userId + ' ' + c.type);
  const dec = (id) => ({
    type: 'recovery-decide',
    requestId: id,
    decision: 'approve',
    reason: 'A fictional approval long enough.',
    checklist: { cohort: true, email: true, lastActivity: true },
    reviewedVersion: 1,
  });
  same(
    attempt(two.t, u(two, 'owner2'), dec(one.recId)),
    attempt(two.t, u(two, 'owner2'), dec(U1)),
    'owner2 replays a ws-one id',
  );
  // lrnA2 in ws-one claims the email of a member who exists only in ws-two: nothing resolves and approval is refused
  const t = apply(one.t, u(one, 'lrnA2'), {
    type: 'recovery-request',
    claimedEmail: 'lrnA3@ws-two.example.test',
    cohortHint: '',
    activityHint: '',
    note: '',
  });
  const rid = t.recovery.at(-1).id;
  assert.equal(t.recovery.at(-1).oldMemberId, null);
  assert.equal(attempt(t, 'owner', { ...dec(rid), reviewedVersion: t.recovery.at(-1).version })?.status, 409);
  assert.equal(t.learners.find((l) => l.userId === one.ids.lrnA2).state.enrollments.length, 1);
});
test('recovery: staff access is never re-issued by recovery; a learner relink moves only that learner record', () => {
  const w = withRequests();
  const dec = (t, id) => ({
    type: 'recovery-decide',
    requestId: id,
    decision: 'approve',
    reason: 'A fictional approval long enough.',
    checklist: { cohort: true, email: true, lastActivity: true },
    reviewedVersion: t.recovery.find((r) => r.id === id).version,
  });
  let t = apply(w.t, u(w, 'plain'), { type: 'recovery-withdraw', requestId: w.recId });
  t = apply(t, u(w, 'plain'), {
    type: 'recovery-request',
    claimedEmail: 'modA@ws-one.example.test',
    cohortHint: '',
    activityHint: '',
    note: '',
  });
  assert.equal(attempt(t, 'owner', dec(t, t.recovery.at(-1).id))?.status, 409);
  const before = fp(t.learners.find((l) => l.userId === w.ids.lrnA2).state);
  t = apply(t, u(w, 'plain'), { type: 'recovery-withdraw', requestId: t.recovery.at(-1).id });
  t = apply(t, u(w, 'plain'), {
    type: 'recovery-request',
    claimedEmail: 'lrnA3@ws-one.example.test',
    cohortHint: '',
    activityHint: '',
    note: '',
  });
  t = apply(t, 'owner', dec(t, t.recovery.at(-1).id));
  assert.equal(
    fp(t.learners.find((l) => l.userId === w.ids.lrnA2).state),
    before,
    'another learner record is untouched',
  );
  assert.equal(
    t.learners.some((l) => l.userId === w.ids.lrnA3),
    false,
  );
  assert.equal(
    t.learners.some((l) => l.userId === w.ids.plain),
    true,
  );
  assert.equal(projectTeam(t, u(w, 'plain')).state.enrollments.length, 1);
  assert.equal(projectTeam(t, u(w, 'lrnA3')).team.active, false);
  assert.equal(
    projectTeam(t, u(w, 'lrnA3')).state.enrollments.length,
    0,
    'the old account no longer holds the record',
  );
  for (const who of ['lrnA2', 'modB', 'lrnB1'])
    assert.ok(!fp(projectTeam(t, u(w, who)).team.recovery).includes('lrnA3@'));
});

/* Programme spaces and organisation overview (BR-32, BR-38) */
const SP_A = 'programme:' + PROG_A.id,
  SPACE_TEXT = 'A fictional pathway room discussion body long enough.';
function withSpaces(id = 'ws-one', owner = 'owner') {
  let w = rich(id, owner);
  w.t = apply(w.t, u(w, 'lrnA1'), {
    type: 'space-post',
    spaceId: SP_A,
    title: 'SPACE-TITLE-A',
    body: SPACE_TEXT,
  });
  const pid = w.t.spaces.posts[0].id;
  w.t = apply(w.t, u(w, 'modA'), {
    type: 'space-moderate',
    postId: pid,
    status: 'visible',
    reason: 'Publishing a fictional room post.',
  });
  w.t = apply(w.t, u(w, 'lrnA2'), {
    type: 'space-report',
    postId: pid,
    reason: 'A fictional concern for the room moderators.',
  });
  w.spacePostId = pid;
  return w;
}
test('programme spaces: cohort B and other-pathway users never receive pathway A room content; denied equals unknown', () => {
  const w = withSpaces();
  for (const who of ['modB', 'assessB', 'lrnB1', 'plain']) {
    const blob = fp(projectTeam(w.t, u(w, who)));
    assert.ok(
      !blob.includes('SPACE-TITLE-A') && !blob.includes(SPACE_TEXT) && !blob.includes(w.spacePostId),
      who,
    );
    for (const [type, extra] of [
      ['space-reply', { body: 'A fictional reply long enough.' }],
      ['space-report', { reason: 'A fictional reason long enough.' }],
      ['space-moderate', { status: 'hidden', reason: 'A fictional reason long enough.' }],
    ])
      same(
        attempt(w.t, u(w, who), { type, postId: w.spacePostId, ...extra }),
        attempt(w.t, u(w, who), { type, postId: U1, ...extra }),
        who + ' ' + type,
      );
    same(
      attempt(w.t, u(w, who), {
        type: 'space-post',
        spaceId: SP_A,
        title: 'A fictional title',
        body: SPACE_TEXT,
      }),
      attempt(w.t, u(w, who), {
        type: 'space-post',
        spaceId: 'programme:nope',
        title: 'A fictional title',
        body: SPACE_TEXT,
      }),
      who + ' post',
    );
  }
  for (const who of ['lrnA1', 'lrnA3', 'facA'])
    assert.equal(projectTeam(w.t, u(w, who)).team.spaces.reports.length, 0, who + ' received reports');
  assert.equal(projectTeam(w.t, u(w, 'modA')).team.spaces.reports.length, 1);
  assert.equal(projectTeam(w.t, u(w, 'modB')).team.spaces.reports.length, 0);
});
test('programme and ecosystem spaces: no standing across workspaces; removed members keep nothing but attribution', () => {
  const one = withSpaces('ws-one', 'owner'),
    two = withSpaces('ws-two', 'owner2');
  one.t = apply(one.t, 'owner', { type: 'space-ecosystem', enabled: true });
  for (const who of [u(one, 'owner'), u(one, 'modA'), u(one, 'lrnA1'), u(one, 'plain')])
    for (const c of [
      { type: 'space-post', spaceId: SP_A, title: 'A fictional title', body: SPACE_TEXT },
      { type: 'space-post', spaceId: 'ecosystem', title: 'A fictional title', body: SPACE_TEXT },
      {
        type: 'space-moderate',
        postId: two.spacePostId,
        status: 'hidden',
        reason: 'A fictional reason long enough.',
      },
      { type: 'space-ecosystem', enabled: true },
    ])
      assert.equal(attempt(two.t, who, c)?.status, 404, who.userId + ' ' + c.type);
  for (const who of ['owner2', 'modA', 'lrnA1', 'plain'])
    same(
      attempt(two.t, u(two, who), {
        type: 'space-reply',
        postId: one.spacePostId,
        body: 'A fictional reply long enough.',
      }),
      attempt(two.t, u(two, who), {
        type: 'space-reply',
        postId: U1,
        body: 'A fictional reply long enough.',
      }),
      who + ' foreign space id',
    );
  assert.equal(two.t.spaces.ecosystemOpen, false);
  const t = apply(one.t, 'owner', {
    type: 'member',
    userId: one.ids.lrnA1,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  const gone = projectTeam(t, u(one, 'lrnA1')).team.spaces;
  assert.deepEqual([gone.items, gone.posts, gone.reports], [[], [], []]);
  assert.ok(
    projectTeam(t, u(one, 'lrnA2')).team.spaces.posts.some((p) => p.id === one.spacePostId && p.author),
  );
});
test('organisation overview: non-owners, owners of another workspace and removed owners get nothing; the overview carries no learner content', () => {
  const one = withSpaces('ws-one', 'owner'),
    two = withSpaces('ws-two', 'owner2');
  for (const who of ['modA', 'facA', 'lrnA1', 'plain', 'lrnB1', 'owner2'])
    assert.deepEqual(projectOrgOverview([one.t], one.ids[who] ?? who, NOW).workspaces, [], who);
  const o = projectOrgOverview([one.t, two.t], 'owner', NOW);
  assert.deepEqual(
    o.workspaces.map((w) => w.workspaceId),
    ['ws-one'],
  );
  const blob = fp(o);
  for (const s of [...A_SECRETS, 'SPACE-TITLE-A', SPACE_TEXT, 'ws-two', 'example.test', 'tokenHash'])
    assert.ok(!blob.includes(s), 'overview leaked ' + s);
  let t = apply(one.t, 'owner', {
    type: 'invite',
    email: 'co@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  t = apply(t, { userId: 'co', email: 'co@x.example.test' }, { type: 'accept', tokenHash: 'c'.repeat(64) });
  assert.equal(projectOrgOverview([t], 'co', NOW).workspaces.length, 1);
  t = apply(t, 'owner', { type: 'member', userId: 'co', roles: ['admin'], scopes: [], active: false });
  assert.equal(projectOrgOverview([t], 'co', NOW).workspaces.length, 0);
});
