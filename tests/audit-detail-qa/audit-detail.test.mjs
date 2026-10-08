import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createD1, root } from './d1-shim.mjs';
const out = root + '/.sites-runtime/audit-detail-qa/',
  load = (f) => import(pathToFileURL(out + f).href);
const M = await load('model.mjs'),
  teamsRoute = await load('route-teams.mjs'),
  teamsAudit = await load('route-teams-audit.mjs'),
  personalRoute = await load('route-academy.mjs'),
  personalAudit = await load('route-academy-audit.mjs');
const {
  createTeam,
  applyTeamCommand,
  applyCommand,
  freshWorkspace,
  programs,
  summarizeTeamCommand,
  summarizePersonalCommand,
  pseudonymMap,
  parseDetail,
  projectAuditRow,
  buildAuditQuery,
  pageOf,
  auditCsv,
  safeDetailJson,
  commandType,
} = M;
const now = '2026-10-05T09:00:00.000Z',
  TEAM = 'tw-audit-detail-fixture-0001',
  p = programs[1];
const owner = { userId: 'usr-own-1', email: 'owner@example.test' },
  learner = { userId: 'usr-lrn-1', email: 'learner@example.test' },
  reviewer = { userId: 'usr-rev-1', email: 'reviewer@example.test' };
const LEAK = {
  practice: 'LEAK-PRACTICE-TEXT-9f2',
  email: 'leak.person@secret-mail.example',
  pass: 'hunter2-PASSPHRASE-LEAK',
  feedback: 'LEAK-FEEDBACK-BODY-77',
  token: 'f'.repeat(60) + 'beef',
  reason: 'LEAK-MODERATION-REASON',
  name: 'LEAK-DISPLAY-NAME',
};
const markers = Object.values(LEAK);
const noLeak = (x, label = '') => {
  const s = JSON.stringify(x);
  for (const m of markers) assert.ok(!s.includes(m), `${label} leaked ${m}`);
};
const apply = (t, u, c) => applyTeamCommand(t, u, c, now);
const refs = async (t) =>
  pseudonymMap([owner.userId, learner.userId, reviewer.userId, ...t.members.map((m) => m.userId)], TEAM);
async function step(t, u, c) {
  const before = t,
    after = await apply(t, u, c),
    refOf = await refs(after);
  return {
    after,
    detail: summarizeTeamCommand({ before, after, command: c, actorId: u.userId, refOf }),
    refOf,
  };
}

function setup() {
  let t = createTeam(
    owner,
    { name: 'Fictional pilot', purpose: 'A synthetic workspace for audit checks.', context: 'msme' },
    TEAM,
    now,
  );
  t = apply(t, owner, {
    type: 'cohort-create',
    title: 'Checked customer-work cohort',
    programId: p.id,
    capacity: 3,
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
const submission = (t, text) => {
  const e = t.learners[0].state.enrollments[0];
  for (const l of p.lessons)
    t = apply(t, learner, {
      type: 'lesson',
      enrollmentId: e.id,
      lessonId: l.id,
      practice: text,
      answers: l.quiz.map((q) => q.correctOptionIndex),
    });
  return apply(t, learner, {
    type: 'submit',
    enrollmentId: e.id,
    confirmed: true,
    fields: Object.fromEntries(
      p.practicalAssessment.submissionPrompts.map((f) => [
        f.id,
        text + ' source references verification human approval',
      ]),
    ),
  });
};
const assess = (
  t,
  scores = [4, 4, 4, 4],
  gates = [true, true, true],
  feedback = LEAK.feedback + ' verified reasoning careful data handling approval route meets the standard',
) => {
  const e = t.learners[0].state.enrollments[0];
  return {
    type: 'assess',
    learnerId: learner.userId,
    enrollmentId: e.id,
    attemptId: e.attempts.at(-1).id,
    scores,
    gates,
    notes: Array(4).fill(LEAK.practice + ' evidence checked against source packet'),
    feedback,
  };
};
const prepared = () => {
  let t = submission(setup(), LEAK.practice + ' fictional evidence');
  const c = assess(t);
  return apply(t, owner, {
    type: 'assign',
    kind: 'assessment',
    targetId: c.attemptId,
    staffId: owner.userId,
  });
};

test('role and scope change records who, what and a before/after summary without emails or names', async () => {
  const t = setup(),
    cid = t.cohorts[0].id,
    c = {
      type: 'member',
      userId: learner.userId,
      roles: ['learner', 'facilitator'],
      scopes: [cid],
      active: true,
    },
    { detail, refOf } = await step(t, owner, c);
  assert.equal(detail.type, 'member');
  assert.equal(detail.category, 'permissions');
  assert.equal(detail.actor, refOf(owner.userId));
  assert.equal(detail.outcome, 'applied');
  assert.equal(detail.target.memberRef, refOf(learner.userId));
  const ch = Object.fromEntries(detail.changes.map((x) => [x.field, x]));
  assert.deepEqual(ch.roles.before, ['learner']);
  assert.deepEqual(ch.roles.after, ['facilitator', 'learner']);
  assert.deepEqual(ch.scopes.before, []);
  assert.deepEqual(ch.scopes.after, [cid]);
  assert.ok(!ch.active);
  assert.ok(!JSON.stringify(detail).includes('learner@example.test'));
  assert.ok(!JSON.stringify(detail).includes(learner.userId + '"'), 'raw user ids are not stored in detail');
  const off = await step(t, owner, { ...c, roles: ['learner'], scopes: [], active: false });
  assert.deepEqual(
    off.detail.changes.find((x) => x.field === 'active'),
    { entity: 'member', id: refOf(learner.userId), field: 'active', before: true, after: false },
  );
});

test('invite, revoke and accept never store the email or token', async () => {
  let t = setup();
  const a = await step(t, owner, {
    type: 'invite',
    email: LEAK.email,
    roles: ['learner'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  noLeak(a.detail, 'invite');
  assert.ok(!JSON.stringify(a.detail).includes('c'.repeat(64)));
  assert.equal(a.detail.category, 'membership');
  assert.deepEqual(
    a.detail.changes.find((x) => x.entity === 'invite' && x.field === 'presence'),
    {
      entity: 'invite',
      id: a.after.invites.at(-1).id,
      field: 'presence',
      before: 'absent',
      after: 'present',
    },
  );
  assert.ok(
    a.detail.changes.some((x) => x.entity === 'invite' && x.field === 'status' && x.after === 'active'),
  );
  assert.equal(a.detail.target.inviteId, a.after.invites.at(-1).id);
  const r = await step(a.after, owner, { type: 'revoke-invite', inviteId: a.after.invites.at(-1).id });
  assert.deepEqual(
    r.detail.changes.map((x) => [x.field, x.before, x.after]),
    [['status', 'active', 'revoked']],
  );
  const acc = await step(t, reviewer, { type: 'accept', tokenHash: 'b'.repeat(64) });
  assert.equal(acc.detail.type, 'accept');
  const x = await step(t, owner, { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'paused' });
  assert.deepEqual(
    x.detail.changes.map((c) => [c.entity, c.field, c.before, c.after]),
    [['cohort', 'status', 'open', 'paused']],
  );
  assert.equal(x.detail.target.cohortId, t.cohorts[0].id);
});

test('assessment lifecycle: decision outcome, credential status and ids before/after, with no feedback or evidence text', async () => {
  const t = prepared(),
    c = assess(t),
    e = t.learners[0].state.enrollments[0],
    { detail, after, refOf } = await step(t, owner, c);
  noLeak(detail, 'assess');
  assert.equal(detail.category, 'assessment');
  assert.equal(detail.target.enrollmentId, e.id);
  assert.equal(detail.target.attemptId, c.attemptId);
  assert.equal(detail.target.learnerRef, refOf(learner.userId));
  const by = (f) => detail.changes.find((x) => x.entity === 'enrollment' && x.field === f);
  assert.deepEqual([by('decision').before, by('decision').after], ['none', 'passed']);
  assert.deepEqual([by('record').before, by('record').after], ['none', 'active']);
  assert.equal(by('score').after, 100);
  assert.equal(detail.target.credentialId, after.learners[0].state.enrollments[0].record.id);
  // failing gate: not-passed, no credential
  const fail = await step(t, owner, assess(t, [4, 4, 4, 4], [true, true, false]));
  assert.deepEqual(
    [
      fail.detail.changes.find((x) => x.field === 'decision').after,
      fail.detail.changes.find((x) => x.field === 'record'),
    ],
    ['not-passed', undefined],
  );
  // appeal then credential share toggle
  const a = await step(fail.after, learner, {
    type: 'appeal',
    enrollmentId: e.id,
    attemptId: c.attemptId,
    reason: LEAK.reason + ' please inspect the source mapping carefully',
  });
  noLeak(a.detail, 'appeal');
  assert.deepEqual(
    a.detail.changes.filter((x) => x.field === 'appeal').map((x) => [x.before, x.after]),
    [['none', 'open']],
  );
  const s1 = await step(after, learner, { type: 'share', enrollmentId: e.id, enabled: true });
  assert.deepEqual(
    s1.detail.changes.map((x) => [x.field, x.before, x.after]),
    [['shared', false, true]],
  );
  assert.equal(s1.detail.category, 'credential');
  assert.equal(s1.detail.target.credentialId, after.learners[0].state.enrollments[0].record.id);
  const base = setup(),
    w = await step(base, learner, {
      type: 'withdraw',
      enrollmentId: base.learners[0].state.enrollments[0].id,
    });
  assert.ok(w.detail.changes.some((x) => x.field === 'withdrawn' && x.after === true));
});

test('assignment, moderation and discussion record ids and states only', async () => {
  const setup0 = setup();
  let t = setup0,
    cid = t.cohorts[0].id;
  t = apply(t, learner, {
    type: 'post',
    cohortId: cid,
    title: 'A hostile title ' + LEAK.name,
    body: LEAK.practice + ' a long enough discussion body',
  });
  const post = t.posts[0];
  const posted = await step(setup0, learner, {
    type: 'post',
    cohortId: cid,
    title: 'A hostile title ' + LEAK.name,
    body: LEAK.practice + ' a long enough discussion body',
  });
  noLeak(posted.detail, 'post');
  const m = await step(t, reviewer, {
    type: 'moderate',
    postId: post.id,
    status: 'visible',
    reason: LEAK.reason + ' enough text here',
  });
  noLeak(m.detail, 'moderate');
  assert.deepEqual(
    m.detail.changes.filter((x) => x.entity === 'post').map((x) => [x.before, x.after]),
    [['pending', 'visible']],
  );
  assert.equal(m.detail.target.postId, post.id);
  const asg = await step(setup0, owner, { type: 'cohort-status', cohortId: cid, status: 'closed' });
  assert.equal(asg.detail.changes.length, 1);
  const t2 = submission(setup(), 'x'.repeat(30)),
    c2 = assess(t2),
    a = await step(t2, owner, {
      type: 'assign',
      kind: 'assessment',
      targetId: c2.attemptId,
      staffId: owner.userId,
    });
  assert.equal(a.detail.changes[0].entity, 'assignment');
  assert.equal(a.detail.target.reviewerRef, a.refOf(owner.userId));
});

test('content review and publication states map to draft and publication changes', () => {
  const refOf = (id) => 'a-' + Buffer.from(id).toString('hex').padEnd(12, '0').slice(0, 12),
    did = '11111111-1111-4111-8111-111111111111',
    pid = '22222222-2222-4222-8222-222222222222';
  const mk = (state, approved, availability) => ({
    id: TEAM,
    members: [
      { userId: 'u1', roles: ['admin'], scopes: [], active: true, name: LEAK.name, email: LEAK.email },
    ],
    invites: [],
    cohorts: [],
    learners: [],
    assignments: [],
    posts: [],
    content: {
      drafts: [
        {
          id: did,
          state,
          programId: p.id,
          approval: approved ? { note: LEAK.feedback, reviewerName: LEAK.name } : undefined,
          document: { lessons: [{ body: LEAK.practice }] },
        },
      ],
      publications: availability ? [{ id: pid, availability, snapshot: { secret: LEAK.practice } }] : [],
    },
  });
  const rev = summarizeTeamCommand({
    before: mk('in_review', false),
    after: mk('approved', true),
    command: {
      type: 'content-review',
      draftId: did,
      decision: 'approve',
      note: LEAK.feedback,
      checks: { a: true },
    },
    actorId: 'u1',
    refOf,
  });
  noLeak(rev, 'review');
  assert.equal(rev.category, 'content');
  assert.equal(rev.target.contentId, did);
  assert.deepEqual(
    rev.changes.map((c) => [c.entity, c.field, c.before, c.after]),
    [
      ['draft', 'state', 'in_review', 'approved'],
      ['draft', 'approved', false, true],
    ],
  );
  const pub = summarizeTeamCommand({
    before: mk('approved', true),
    after: mk('published', true, 'available'),
    command: { type: 'content-publish', draftId: did },
    actorId: 'u1',
    refOf,
  });
  assert.ok(
    pub.changes.some((c) => c.entity === 'publication' && c.field === 'presence' && c.after === 'present'),
  );
  assert.ok(pub.changes.some((c) => c.field === 'state' && c.after === 'published'));
  noLeak(pub, 'publish');
  const ret = summarizeTeamCommand({
    before: mk('published', true, 'available'),
    after: mk('published', true, 'retired'),
    command: { type: 'content-retire', publicationId: pid, reason: LEAK.reason },
    actorId: 'u1',
    refOf,
  });
  assert.deepEqual(
    ret.changes.map((c) => [c.field, c.before, c.after]),
    [['availability', 'available', 'retired']],
  );
  assert.equal(ret.target.contentId, pid);
  noLeak(ret, 'retire');
});

test('personal lab summary covers enroll, credential and reset with the same whitelist', async () => {
  const refOf = await pseudonymMap(['me'], 'personal');
  let s = freshWorkspace();
  const step1 = (before, c) => {
    const after = applyCommand(before, c, now);
    return { after, d: summarizePersonalCommand({ before, after, command: c, actorId: 'me', refOf }) };
  };
  const e = step1(s, { type: 'enroll', programId: p.id });
  assert.equal(e.d.scope, 'personal');
  assert.equal(e.d.category, 'enrollment');
  assert.ok(
    e.d.changes.some((c) => c.entity === 'enrollment' && c.field === 'presence' && c.after === 'present'),
  );
  assert.equal(e.d.target.contentId, p.id);
  const r = step1(e.after, { type: 'reset' });
  assert.equal(r.d.category, 'recovery');
  assert.ok(r.d.changes.some((c) => c.field === 'presence' && c.after === 'absent'));
  const bad = summarizePersonalCommand({
    before: s,
    after: e.after,
    command: { type: 'enroll', programId: 'hunter2-passphrase-leak' },
    actorId: 'me',
    refOf,
  });
  assert.ok(!JSON.stringify(bad).includes('hunter2'));
});

test('property: hostile payloads in commands and state never reach the stored detail', async () => {
  let seed = 12345;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const hostile = () =>
    [
      ...markers,
      '<script>alert(1)</script>',
      '=HYPERLINK("http://x")',
      'a@b.co',
      '{"nested":"' + LEAK.pass + '"}',
      'x'.repeat(5000) + LEAK.practice,
    ][rnd(markers.length + 4)];
  const refOf = await pseudonymMap(['u1', 'u2'], TEAM),
    types = [
      'member',
      'invite',
      'assess',
      'resolve',
      'submit',
      'draft',
      'lesson',
      'post',
      'moderate',
      'share',
      'content-review',
      'nonsense',
      LEAK.pass,
      5,
      null,
    ];
  for (let i = 0; i < 300; i++) {
    const cmd = { type: types[rnd(types.length)] };
    for (const k of [
      'feedback',
      'notes',
      'practice',
      'answers',
      'reason',
      'body',
      'title',
      'email',
      'passphrase',
      'token',
      'tokenHash',
      'name',
      'note',
      'fields',
      'roles',
      'scopes',
      'status',
      'enrollmentId',
      'cohortId',
      'userId',
      'learnerId',
      'staffId',
      'programId',
      'draftId',
      'inviteId',
      'targetId',
      'kind',
    ])
      if (rnd(3)) {
        const h = hostile();
        cmd[k] = rnd(2) ? h : [h, { deep: h }];
      }
    const member = {
      userId: 'u1',
      email: hostile(),
      name: hostile(),
      roles: [hostile(), 'admin'],
      scopes: [hostile()],
      active: rnd(2) === 0,
    };
    const mkTeam = () => ({
      id: TEAM,
      name: hostile(),
      members: [member, { userId: 'u2', email: hostile(), roles: [hostile()], scopes: [], active: true }],
      invites: [
        {
          id: hostile(),
          email: hostile(),
          tokenHash: hostile(),
          status: hostile(),
          roles: [hostile()],
          scopes: [hostile()],
        },
      ],
      cohorts: [{ id: hostile(), title: hostile(), status: hostile(), capacity: hostile() }],
      assignments: [{ kind: hostile(), targetId: hostile(), staffId: hostile() }],
      posts: [
        {
          id: hostile(),
          title: hostile(),
          body: hostile(),
          status: hostile(),
          replies: [{ id: hostile(), body: hostile(), status: hostile() }],
        },
      ],
      learners: [
        {
          userId: 'u2',
          state: {
            enrollments: [
              {
                id: hostile(),
                withdrawn: hostile(),
                completed: [hostile()],
                attempts: [
                  {
                    decision: {
                      score: hostile(),
                      passed: hostile(),
                      feedback: hostile(),
                      notes: [hostile()],
                    },
                    fields: { a: hostile() },
                  },
                ],
                appeals: [{ status: hostile(), reason: hostile(), resolution: { feedback: hostile() } }],
                record: { id: hostile(), status: hostile(), share: hostile(), claim: hostile() },
              },
            ],
            paused: [],
          },
        },
      ],
      content: {
        drafts: [{ id: hostile(), state: hostile(), document: hostile(), approval: { note: hostile() } }],
        publications: [{ id: hostile(), availability: hostile() }],
      },
    });
    const d = summarizeTeamCommand({ before: mkTeam(), after: mkTeam(), command: cmd, actorId: 'u1', refOf }),
      json = JSON.stringify(d);
    noLeak(d, 'fuzz ' + i);
    assert.ok(!/<script|HYPERLINK|a@b\.co|"nested"|xxxxxxxx/.test(json), 'fuzz ' + i);
    assert.ok(json.length <= 3500);
    noLeak(parseDetail(JSON.stringify(d)), 'reparse ' + i);
    const p2 = summarizePersonalCommand({
      before: { enrollments: [{ id: hostile(), record: { status: hostile() } }], paused: [hostile()] },
      after: { enrollments: [] },
      command: cmd,
      actorId: 'u1',
      refOf,
    });
    noLeak(p2, 'personal fuzz');
  }
  assert.equal(commandType(LEAK.pass), 'other');
  assert.equal(
    safeDetailJson(() => {
      throw new Error(LEAK.pass);
    }),
    null,
  );
});

test('stored detail is re-sanitised on read; old rows and corrupt rows stay readable', async () => {
  const refOf = await pseudonymMap(['u1'], TEAM),
    ref = refOf('u1');
  const forged = JSON.stringify({
    v: 1,
    scope: 'workspace',
    actor: ref,
    type: 'member',
    category: 'permissions',
    target: { cohortId: LEAK.email, enrollmentId: 'ok-1' },
    outcome: 'applied',
    changes: [
      { entity: 'member', id: ref, field: 'roles', before: [LEAK.practice, 'admin'], after: LEAK.pass },
      { entity: 'x', id: LEAK.email, field: 'y z', before: LEAK.feedback, after: true },
    ],
  });
  const d = parseDetail(forged);
  noLeak(d, 'forged');
  assert.deepEqual(d.target, { enrollmentId: 'ok-1' });
  assert.equal(parseDetail(null), null);
  assert.equal(parseDetail('{not json'), null);
  assert.equal(parseDetail(JSON.stringify({ v: 2 })), null);
  assert.equal(
    parseDetail(JSON.stringify({ v: 1, actor: 'raw-user-id' })),
    null,
    'unpseudonymised actor refused',
  );
  const old = projectAuditRow({ revision: 3, created_at: now, action: 'invite', detail: null }, ref);
  assert.deepEqual([old.legacy, old.detail, old.type, old.actor], [true, null, 'invite', ref]);
  const csv = auditCsv([
    old,
    projectAuditRow(
      {
        revision: 4,
        created_at: now,
        action: 'member',
        detail: JSON.stringify({
          v: 1,
          scope: 'workspace',
          actor: ref,
          type: 'member',
          category: 'permissions',
          target: {},
          outcome: 'applied',
          changes: [],
        }),
      },
      ref,
    ),
  ]);
  assert.match(csv, /^revision,time,actor/);
  assert.equal(csv.trim().split('\r\n').length, 3);
  assert.match(csv, /legacy/);
  assert.ok(
    auditCsv([{ revision: 1, at: '=cmd', type: 'x', actor: ref, detail: null, legacy: true }]).includes(
      "'=cmd",
    ),
    'formula prefix neutralised',
  );
});

test('actor display is pseudonymous, stable per scope and not reversible to the user id', async () => {
  const a = await pseudonymMap(['alice@example.test', 'bob'], 'ws-1'),
    b = await pseudonymMap(['alice@example.test'], 'ws-2');
  assert.match(a('alice@example.test'), /^a-[0-9a-f]{12}$/);
  assert.equal(a('alice@example.test'), a('alice@example.test'));
  assert.notEqual(a('alice@example.test'), a('bob'));
  assert.notEqual(a('alice@example.test'), b('alice@example.test'));
  assert.ok(!a('alice@example.test').includes('alice'));
  assert.equal(a('unknown-user'), 'a-unknown000');
});

// ---- Route level: real handlers, real migrations, node:sqlite D1 shim ----
const asUser = (u) => {
  globalThis.__auditUser = u
    ? { userId: u.userId, email: u.email, fullName: u.userId + ' Person', displayName: u.userId }
    : null;
};
const post = (handler, url, body) =>
  handler.POST(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const get = (handler, url) => handler.GET(new Request(url));
let aid = 0;
const actionId = () => 'act-audit-detail-' + String(++aid).padStart(6, '0') + '-xxxx';
function seed() {
  const db = createD1();
  globalThis.__auditDb = db;
  const t = prepared();
  db.sqlite
    .prepare('INSERT INTO academy_teams(id,created_by,data,revision,updated_at) VALUES(?,?,?,?,?)')
    .run(t.id, owner.userId, JSON.stringify(t), 1, now);
  return { db, t };
}

test('route writes detail atomically with the revision and admin read returns it; non-admins get a uniform 404', async () => {
  const { db, t } = seed(),
    c = assess(t);
  asUser(owner);
  let r = await post(teamsRoute, 'http://x/api/teams', {
    teamId: TEAM,
    revision: 1,
    actionId: actionId(),
    command: {
      type: 'member',
      userId: learner.userId,
      roles: ['learner', 'reviewer'],
      scopes: [t.cohorts[0].id],
      active: true,
    },
  });
  assert.equal(r.status, 200);
  r = await post(teamsRoute, 'http://x/api/teams', {
    teamId: TEAM,
    revision: 2,
    actionId: actionId(),
    command: c,
  });
  assert.equal(r.status, 200);
  const rows = db.sqlite
    .prepare('SELECT revision,actor,action,detail FROM academy_team_audit ORDER BY revision')
    .all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].actor, owner.userId, 'raw actor stays for idempotency');
  for (const row of rows) {
    noLeak(row.detail);
    assert.ok(!row.detail.includes(owner.userId) && !row.detail.includes(owner.email));
  }
  const assessed = JSON.parse(rows[1].detail);
  assert.equal(assessed.type, 'assess');
  assert.ok(assessed.changes.some((x) => x.field === 'decision' && x.after === 'passed'));
  assert.ok(assessed.target.credentialId);
  // replay is idempotent and writes no extra rows
  const id = actionId();
  await post(teamsRoute, 'http://x/api/teams', {
    teamId: TEAM,
    revision: 3,
    actionId: id,
    command: { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'paused' },
  });
  r = await post(teamsRoute, 'http://x/api/teams', {
    teamId: TEAM,
    revision: 3,
    actionId: id,
    command: { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'paused' },
  });
  assert.equal((await r.json()).replayed, true);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM academy_team_audit').get().n, 3);
  // admin read
  r = await get(teamsAudit, 'http://x/api/teams/audit?teamId=' + TEAM);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.items.length, 3);
  assert.equal(body.items[0].revision, 4);
  noLeak(body);
  assert.ok(!JSON.stringify(body).includes(owner.userId + '"'));
  assert.equal(body.actors[body.items[0].actor], 'owner Person'.length ? String(t.members[0].name) : '');
  // denied: learner, reviewer without admin, outsider, unknown workspace and missing id all look identical
  const denied = [];
  for (const [u, id] of [
    [learner, TEAM],
    [reviewer, TEAM],
    [{ userId: 'outsider', email: 'o@example.test' }, TEAM],
    [owner, 'tw-does-not-exist-anywhere-000'],
    [owner, null],
  ]) {
    asUser(u);
    const x = await get(teamsAudit, 'http://x/api/teams/audit' + (id ? '?teamId=' + id : ''));
    denied.push([x.status, JSON.stringify(await x.json())]);
  }
  assert.ok(
    denied.every((d) => d[0] === 404 && d[1] === denied[0][1]),
    JSON.stringify(denied),
  );
  asUser(null);
  assert.equal((await get(teamsAudit, 'http://x/api/teams/audit?teamId=' + TEAM)).status, 401);
  // removed owner loses access
  asUser(owner);
});

test('pagination, filters and old rows through the real handler', async () => {
  const { db, t } = seed();
  asUser(owner);
  const cid = t.cohorts[0].id;
  let rev = 1;
  for (const status of ['paused', 'open', 'closed', 'open', 'paused'])
    await post(teamsRoute, 'http://x/api/teams', {
      teamId: TEAM,
      revision: rev++,
      actionId: actionId(),
      command: { type: 'cohort-status', cohortId: cid, status },
    });
  db.sqlite
    .prepare(
      'INSERT INTO academy_team_audit(team_id,revision,actor,event_id,action,request_hash,created_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(TEAM, 100, learner.userId, 'legacy-event-0001-xxxxxxxx', 'enroll', 'h', '2026-01-02T00:00:00.000Z');
  const q = async (s) => {
    const r = await get(teamsAudit, 'http://x/api/teams/audit?teamId=' + TEAM + s);
    return { status: r.status, body: await r.json() };
  };
  let a = await q('&limit=3');
  assert.deepEqual(
    a.body.items.map((i) => i.revision),
    [100, 6, 5],
  );
  assert.equal(a.body.nextBefore, 5);
  let b = await q('&limit=3&before=' + a.body.nextBefore);
  assert.deepEqual(
    b.body.items.map((i) => i.revision),
    [4, 3, 2],
  );
  assert.equal(b.body.nextBefore, null);
  const legacy = a.body.items[0];
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.detail, null);
  assert.equal(legacy.type, 'enroll');
  assert.match(legacy.actor, /^a-[0-9a-f]{12}$/);
  assert.deepEqual(
    (await q('&type=enroll')).body.items.map((i) => i.revision),
    [100],
  );
  assert.equal((await q('&type=cohort-status')).body.items.length, 5);
  assert.equal((await q('&target=' + cid)).body.items.length, 5);
  assert.equal((await q('&target=11111111-1111-4111-8111-111111111111')).body.items.length, 0);
  const learnerRef = (await q('')).body.items.find((i) => i.type === 'enroll').actor;
  assert.deepEqual(
    (await q('&actor=' + learnerRef)).body.items.map((i) => i.revision),
    [100],
  );
  assert.deepEqual(
    (await q('&actor=' + learner.userId)).body.items.map((i) => i.revision),
    [100],
  );
  assert.equal((await q('&actor=a-000000000000')).body.items.length, 0);
  assert.equal((await q('&from=2026-01-02&to=2026-01-02')).body.items.length, 1);
  assert.equal((await q('&from=2026-01-03&to=2026-01-04')).body.items.length, 0);
  for (const bad of [
    '&limit=0',
    '&limit=51',
    '&before=-1',
    '&before=abc',
    '&type=hunter2',
    '&target=a%27%20OR%201%3D1',
    '&from=yesterday',
  ])
    assert.equal((await q(bad)).status, 400, bad);
  assert.equal((await q('&type=cohort-status%27%3B--')).status, 400);
});

test('personal lab: each learner reads only their own audit; detail is written by the real handler', async () => {
  const db = createD1();
  globalThis.__auditDb = db;
  asUser(learner);
  let r = await post(personalRoute, 'http://x/api/academy', {
    revision: 0,
    actionId: actionId(),
    command: { type: 'enroll', programId: p.id },
  });
  assert.equal(r.status, 200);
  r = await post(personalRoute, 'http://x/api/academy', {
    revision: 1,
    actionId: actionId(),
    command: { type: 'pause', programId: p.id, paused: true },
  });
  assert.equal(r.status, 200);
  asUser(reviewer);
  await post(personalRoute, 'http://x/api/academy', {
    revision: 0,
    actionId: actionId(),
    command: { type: 'enroll', programId: programs[0].id },
  });
  asUser(learner);
  r = await get(personalAudit, 'http://x/api/academy/audit?limit=1');
  let body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].type, 'pause');
  assert.equal(body.nextBefore, 2);
  assert.equal(body.items[0].detail.scope, 'personal');
  r = await get(personalAudit, 'http://x/api/academy/audit?before=2');
  body = await r.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].type, 'enroll');
  assert.ok(body.items[0].detail.changes.some((c) => c.field === 'presence'));
  assert.ok(!JSON.stringify(body).includes(learner.userId + '"'));
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM academy_audit').get().n, 3);
  asUser(reviewer);
  body = await (await get(personalAudit, 'http://x/api/academy/audit')).json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].detail.target.contentId, programs[0].id);
  asUser(null);
  assert.equal((await get(personalAudit, 'http://x/api/academy/audit')).status, 401);
});

test('query builder is parameterised: hostile filter text is never concatenated into SQL', () => {
  const q = buildAuditQuery('academy_team_audit', 'team-1', {
    type: 'member',
    target: 'abc-123',
    from: '2026-01-01',
    to: '2026-02-01',
    actorUserId: "x' OR '1'='1",
    limit: 10,
    before: 9,
  });
  assert.ok(!q.sql.includes('abc-123') && !/ OR '1/.test(q.sql) && q.sql.endsWith('LIMIT 11'));
  assert.equal(q.limit, 10);
  assert.ok(q.binds.includes("x' OR '1'='1"));
  assert.equal(pageOf([{ revision: 3 }, { revision: 2 }, { revision: 1 }], 2).nextBefore, 2);
  assert.equal(pageOf([{ revision: 1 }], 2).nextBefore, null);
  assert.throws(() => buildAuditQuery('academy_audit', 'o', { actorUserId: 'x' }), /workspaces only/);
});
