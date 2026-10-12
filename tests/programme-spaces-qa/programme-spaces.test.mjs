/** BR-32: programme-level and ecosystem discussion spaces respect membership boundaries.
 * Real team module bundle; synthetic people only. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectTeam } from '../../.sites-runtime/wave4-qa/model.mjs';
import { apply, u, workspace, withReport, status, PROG_A, PROG_B } from './fixture.mjs';

const SP_A = 'programme:' + PROG_A.id,
  SP_B = 'programme:' + PROG_B.id,
  UNKNOWN_SPACE = 'programme:no-such-pathway',
  UNK = '11111111-1111-4111-8111-111111111111';
const fp = (x) => JSON.stringify(x);
const attempt = (t, who, c) => status(() => apply(t, who, c));
const same = (a, b, label) => {
  assert.ok(a, label + ': denied call must fail');
  assert.ok(b, label + ': unknown call must fail');
  assert.deepEqual(a, b, label + ': denied and unknown must be indistinguishable');
};
const spaces = (t, w, who) => projectTeam(t, u(w, who)).team.spaces;
const ids = (t, w, who) =>
  spaces(t, w, who)
    .items.map((i) => i.id)
    .sort();
const POST = {
  title: 'A fictional pathway discussion',
  body: 'A fictional pathway discussion body long enough to post.',
};
const REASON = 'A fictional moderation reason long enough.';

/** Workspace with a second cohort of pathway A (staff 'facA2' and 'modA2' scoped only to it) and an enrolled learner base. */
function base(id = 'ws-one', owner = 'owner') {
  let w = withReport(workspace(id, owner)),
    t = w.t;
  t = apply(t, owner, {
    type: 'cohort-create',
    title: 'Cohort A2 ' + id,
    programId: PROG_A.id,
    capacity: 10,
  });
  const A2 = t.cohorts.at(-1).id;
  for (const [n, roles] of [
    ['facA2', ['facilitator']],
    ['modA2', ['moderator']],
  ]) {
    const h = (n === 'facA2' ? 'f1' : 'f2').repeat(32);
    t = apply(t, owner, {
      type: 'invite',
      email: n + '@' + id + '.example.test',
      roles,
      scopes: [A2],
      tokenHash: h,
    });
    t = apply(
      t,
      { userId: n + '@' + id, email: n + '@' + id + '.example.test' },
      { type: 'accept', tokenHash: h },
    );
    w.ids[n] = n + '@' + id;
  }
  return { ...w, t, A2 };
}
const publish = (t, w, postId, spaceModerator = 'modA') =>
  apply(t, u(w, spaceModerator), { type: 'space-moderate', postId, status: 'visible', reason: REASON });
function withPost(w, spaceId = SP_A, author = 'lrnA1') {
  const t = apply(w.t, u(w, author), { type: 'space-post', spaceId, ...POST });
  return { ...w, t, spacePostId: t.spaces.posts[0].id };
}

test('programme space: only owners, staff scoped to a cohort of that pathway and enrolled learners see it', () => {
  const w = base();
  for (const who of ['owner', 'modA', 'facA', 'revA', 'facA2', 'modA2', 'lrnA1', 'lrnA2', 'lrnA3'])
    assert.ok(ids(w.t, w, who).includes(SP_A), who + ' should see the pathway A room');
  for (const who of ['modB', 'assessB', 'lrnB1', 'plain'])
    assert.ok(!ids(w.t, w, who).includes(SP_A), who + ' must not see the pathway A room');
  assert.deepEqual(ids(w.t, w, 'lrnB1'), [SP_B]);
  assert.deepEqual(ids(w.t, w, 'plain'), []);
  assert.deepEqual(ids(w.t, w, 'owner'), [SP_A, SP_B].sort());
  assert.deepEqual(ids(w.t, w, 'modB'), [SP_B]);
});
test('programme space: a learner of another pathway cannot read, post, reply, report or moderate; same error as an unknown id', () => {
  let w = withPost(base());
  w.t = publish(w.t, w, w.spacePostId);
  for (const who of ['lrnB1', 'modB', 'assessB', 'plain'])
    same(
      attempt(w.t, u(w, who), { type: 'space-post', spaceId: SP_A, ...POST }),
      attempt(w.t, u(w, who), { type: 'space-post', spaceId: UNKNOWN_SPACE, ...POST }),
      who + ' post',
    );
  for (const who of ['lrnB1', 'modB', 'assessB', 'plain'])
    for (const [type, extra] of [
      ['space-reply', { body: 'A fictional reply long enough.' }],
      ['space-report', { reason: 'A fictional reason long enough.' }],
      ['space-moderate', { status: 'hidden', reason: REASON }],
    ])
      same(
        attempt(w.t, u(w, who), { type, postId: w.spacePostId, ...extra }),
        attempt(w.t, u(w, who), { type, postId: UNK, ...extra }),
        who + ' ' + type,
      );
  for (const who of ['lrnB1', 'modB', 'assessB', 'plain']) {
    const blob = fp(spaces(w.t, w, who));
    assert.ok(!blob.includes(POST.title), who + ' read a pathway A post');
    assert.ok(!blob.includes(w.spacePostId));
  }
});
test('programme space: a pathway that has no cohort here is not a space, and malformed ids fail like unknown ones', () => {
  const w = base();
  for (const sid of [
    'programme:',
    'programme:' + 'x'.repeat(200),
    'programme:__proto__',
    7,
    null,
    {},
    ['programme:' + PROG_A.id],
  ])
    assert.equal(
      attempt(w.t, u(w, 'owner'), { type: 'space-post', spaceId: sid, ...POST })?.status,
      404,
      String(sid).slice(0, 20),
    );
});
test('programme space: posts wait for a scoped moderator; moderator scope is the cohorts of that pathway', () => {
  let w = withPost(base());
  for (const who of ['lrnA2', 'lrnA3', 'facA', 'revA', 'lrnB1'])
    assert.ok(
      !spaces(w.t, w, who).posts.some((p) => p.id === w.spacePostId),
      who + ' must not see a pending post',
    );
  for (const who of ['lrnA1', 'modA', 'modA2', 'owner'])
    assert.ok(
      spaces(w.t, w, who).posts.some((p) => p.id === w.spacePostId),
      who + ' should see it',
    );
  // owners moderate every space of their own workspace, so they see pending posts too
  assert.ok(spaces(w.t, w, 'owner').items.find((i) => i.id === SP_A).canModerate);
  // a facilitator, assessor or reviewer of the pathway is not a moderator
  for (const who of ['facA', 'revA', 'facA2'])
    assert.equal(
      attempt(w.t, u(w, who), {
        type: 'space-moderate',
        postId: w.spacePostId,
        status: 'visible',
        reason: REASON,
      }).status,
      403,
      who,
    );
  // another pathway's moderator gets the unknown-id error, not 403
  assert.equal(
    attempt(w.t, u(w, 'modB'), {
      type: 'space-moderate',
      postId: w.spacePostId,
      status: 'visible',
      reason: REASON,
    }).status,
    404,
  );
  // moderators scoped to either cohort of the pathway can publish
  const t = publish(w.t, w, w.spacePostId, 'modA2');
  assert.ok(spaces(t, w, 'lrnA3').posts.some((p) => p.id === w.spacePostId && p.status === 'visible'));
  assert.equal(spaces(t, w, 'modA2').moderationHistory.length, 1);
  assert.equal(spaces(t, w, 'modB').moderationHistory.length, 0);
  assert.equal(spaces(t, w, 'lrnA1').moderationHistory.length, 0);
});
test('programme space: a moderator of pathway A has no moderation power in the pathway B space', () => {
  let w = withPost(base(), SP_B, 'lrnB1');
  assert.equal(
    attempt(w.t, u(w, 'modA'), {
      type: 'space-moderate',
      postId: w.spacePostId,
      status: 'visible',
      reason: REASON,
    }).status,
    404,
  );
  assert.equal(
    attempt(w.t, u(w, 'modB'), {
      type: 'space-moderate',
      postId: w.spacePostId,
      status: 'visible',
      reason: REASON,
    }),
    null,
  );
});
test('replies and reports: pending replies stay with the author and moderators; reporter identity is never projected; reports only reach moderators', () => {
  let w = withPost(base());
  w.t = publish(w.t, w, w.spacePostId);
  w.t = apply(w.t, u(w, 'lrnA2'), {
    type: 'space-reply',
    postId: w.spacePostId,
    body: 'A pending fictional reply long enough.',
  });
  const rid = w.t.spaces.posts[0].replies[0].id;
  for (const who of ['lrnA3', 'facA'])
    assert.ok(!spaces(w.t, w, who).posts[0].replies.some((r) => r.id === rid), who);
  for (const who of ['lrnA2', 'modA', 'owner'])
    assert.ok(
      spaces(w.t, w, who).posts[0].replies.some((r) => r.id === rid),
      who,
    );
  w.t = apply(w.t, u(w, 'modA'), {
    type: 'space-moderate',
    postId: w.spacePostId,
    replyId: rid,
    status: 'visible',
    reason: REASON,
  });
  assert.ok(spaces(w.t, w, 'lrnA3').posts[0].replies.some((r) => r.id === rid));
  w.t = apply(w.t, u(w, 'lrnA3'), {
    type: 'space-report',
    postId: w.spacePostId,
    reason: 'A fictional concern long enough.',
  });
  assert.equal(
    attempt(w.t, u(w, 'lrnA3'), {
      type: 'space-report',
      postId: w.spacePostId,
      reason: 'A fictional concern long enough.',
    }).status,
    409,
  );
  for (const who of ['lrnA1', 'lrnA2', 'lrnA3', 'facA', 'revA', 'modB', 'lrnB1'])
    assert.equal(spaces(w.t, w, who).reports.length, 0, who);
  const r = spaces(w.t, w, 'modA').reports;
  assert.equal(r.length, 1);
  assert.ok(!fp(r).includes(w.ids.lrnA3));
  assert.ok(!fp(r).includes('reporterId'));
  for (const who of ['lrnA1', 'modA', 'owner', 'modB'])
    assert.ok(!fp(spaces(w.t, w, who)).includes('authorId'), who + ' saw authorId');
  w.t = apply(w.t, u(w, 'modA'), {
    type: 'space-moderate',
    postId: w.spacePostId,
    status: 'hidden',
    reason: REASON,
  });
  assert.equal(spaces(w.t, w, 'modA').reports[0].status, 'resolved');
  assert.ok(!spaces(w.t, w, 'lrnA3').posts.some((p) => p.id === w.spacePostId));
  assert.equal(
    attempt(w.t, u(w, 'lrnA3'), {
      type: 'space-reply',
      postId: w.spacePostId,
      body: 'A fictional reply long enough.',
    }).status,
    404,
    'hidden posts cannot be replied to',
  );
});
test('removed members lose access at once; their historic posts stay attributed', () => {
  let w = withPost(base());
  w.t = publish(w.t, w, w.spacePostId);
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.lrnA1,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  const p = spaces(w.t, w, 'lrnA1');
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.posts, []);
  assert.deepEqual(p.reports, []);
  assert.equal(p.ecosystem, null);
  for (const type of ['space-post', 'space-reply', 'space-report'])
    assert.equal(
      attempt(w.t, u(w, 'lrnA1'), {
        type,
        spaceId: SP_A,
        postId: w.spacePostId,
        ...POST,
        body: 'A fictional reply long enough.',
        reason: 'A fictional reason long enough.',
      }).status,
      403,
      type,
    );
  const seen = spaces(w.t, w, 'lrnA2').posts.find((x) => x.id === w.spacePostId);
  assert.ok(seen, 'historic post remains');
  assert.equal(seen.author, w.t.members.find((m) => m.userId === w.ids.lrnA1).name);
  // removed staff stop moderating
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.modA,
    roles: ['moderator'],
    scopes: [w.A],
    active: false,
  });
  assert.equal(spaces(w.t, w, 'modA').items.length, 0);
  assert.equal(
    attempt(w.t, u(w, 'modA'), {
      type: 'space-moderate',
      postId: w.spacePostId,
      status: 'hidden',
      reason: REASON,
    }).status,
    403,
  );
});
test('a withdrawn learner loses the pathway room; scope removal removes staff access', () => {
  let w = withPost(base());
  w.t = publish(w.t, w, w.spacePostId);
  const e = w.t.learners.find((l) => l.userId === w.ids.lrnA2).state.enrollments[0].id;
  w.t = apply(w.t, u(w, 'lrnA2'), { type: 'withdraw', enrollmentId: e });
  assert.ok(!ids(w.t, w, 'lrnA2').includes(SP_A));
  same(
    attempt(w.t, u(w, 'lrnA2'), { type: 'space-post', spaceId: SP_A, ...POST }),
    attempt(w.t, u(w, 'lrnA2'), { type: 'space-post', spaceId: UNKNOWN_SPACE, ...POST }),
    'withdrawn',
  );
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.facA,
    roles: ['facilitator'],
    scopes: [w.B],
    active: true,
  });
  assert.ok(!ids(w.t, w, 'facA').includes(SP_A));
  assert.ok(ids(w.t, w, 'facA').includes(SP_B));
});
test('space posts are separate from cohort boards in both directions', () => {
  let w = withPost(base());
  w.t = publish(w.t, w, w.spacePostId);
  assert.equal(w.t.posts.length, 1, 'only the cohort board post from the fixture');
  for (const who of ['owner', 'modA', 'lrnA1', 'lrnA2'])
    assert.ok(
      !projectTeam(w.t, u(w, who)).state.posts.some((p) => p.title === POST.title),
      who + ' cohort board shows a space post',
    );
  // cohort commands cannot address a space post and the reverse
  assert.equal(
    attempt(w.t, u(w, 'lrnA2'), {
      type: 'reply',
      postId: w.spacePostId,
      body: 'A fictional reply long enough.',
    }).status,
    404,
  );
  assert.equal(
    attempt(w.t, u(w, 'modA'), { type: 'space-moderate', postId: w.postId, status: 'hidden', reason: REASON })
      .status,
    404,
  );
  assert.equal(
    attempt(w.t, u(w, 'lrnA2'), { type: 'space-post', spaceId: w.A, ...POST }).status,
    404,
    'a cohort id is not a space id',
  );
});
test('ecosystem room: opt-in, owner only, active members of this workspace only', () => {
  let w = base();
  for (const who of ['lrnA1', 'plain', 'modB', 'owner'])
    assert.equal(
      attempt(w.t, u(w, who), { type: 'space-post', spaceId: 'ecosystem', ...POST }).status,
      404,
      who + ' closed room',
    );
  assert.equal(spaces(w.t, w, 'plain').ecosystem, null);
  assert.equal(spaces(w.t, w, 'owner').ecosystem.enabled, false);
  assert.equal(spaces(w.t, w, 'owner').ecosystem.canManage, true);
  for (const who of ['modA', 'facA', 'lrnA1', 'plain'])
    assert.equal(attempt(w.t, u(w, who), { type: 'space-ecosystem', enabled: true }).status, 403, who);
  w.t = apply(w.t, 'owner', { type: 'space-ecosystem', enabled: true });
  assert.equal(w.t.activity.at(-1).action, 'space-ecosystem');
  // every ACTIVE member sees it, including one enrolled in no pathway
  for (const who of ['plain', 'lrnB1', 'modB', 'facA', 'owner'])
    assert.ok(ids(w.t, w, who).includes('ecosystem'), who);
  w.t = apply(w.t, u(w, 'plain'), { type: 'space-post', spaceId: 'ecosystem', ...POST });
  const pid = w.t.spaces.posts[0].id;
  assert.equal(
    attempt(w.t, u(w, 'modA'), { type: 'space-moderate', postId: pid, status: 'visible', reason: REASON })
      .status,
    403,
    'a cohort moderator does not moderate the whole-workspace room',
  );
  w.t = apply(w.t, 'owner', { type: 'space-moderate', postId: pid, status: 'visible', reason: REASON });
  assert.ok(spaces(w.t, w, 'lrnB1').posts.some((p) => p.id === pid));
  // a removed member loses it, and closing it hides it again for everybody
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.lrnB1,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  assert.deepEqual(spaces(w.t, w, 'lrnB1').items, []);
  assert.equal(
    attempt(w.t, u(w, 'lrnB1'), { type: 'space-reply', postId: pid, body: 'A fictional reply long enough.' })
      .status,
    403,
  );
  w.t = apply(w.t, 'owner', { type: 'space-ecosystem', enabled: false });
  for (const who of ['plain', 'modB']) assert.ok(!spaces(w.t, w, who).posts.some((p) => p.id === pid), who);
  assert.equal(
    attempt(w.t, u(w, 'plain'), { type: 'space-reply', postId: pid, body: 'A fictional reply long enough.' })
      .status,
    404,
  );
});
test('ecosystem room never crosses workspaces: no standing in the other workspace, no shared state, ids replay as unknown', () => {
  let one = base('ws-one', 'owner'),
    two = base('ws-two', 'owner2');
  one.t = apply(one.t, 'owner', { type: 'space-ecosystem', enabled: true });
  one.t = apply(one.t, u(one, 'plain'), { type: 'space-post', spaceId: 'ecosystem', ...POST });
  const pid = one.t.spaces.posts[0].id;
  // ws-one's room being open says nothing about ws-two
  assert.equal(two.t.spaces?.ecosystemOpen ?? false, false);
  for (const who of ['plain', 'owner2']) assert.ok(!ids(two.t, two, who).includes('ecosystem'), who);
  // a member of ws-one (even its owner) has no standing in ws-two
  for (const who of [u(one, 'owner'), u(one, 'plain'), u(one, 'modA')]) {
    assert.equal(status(() => projectTeam(two.t, who))?.status, 404);
    assert.equal(attempt(two.t, who, { type: 'space-post', spaceId: 'ecosystem', ...POST }).status, 404);
    assert.equal(attempt(two.t, who, { type: 'space-ecosystem', enabled: true }).status, 404);
  }
  // ids from ws-one replayed inside ws-two behave like unknown ids, even for ws-two's owner and members
  const spid = one.t.spaces.posts[0].id;
  for (const [who, cmd] of [
    ['owner2', { type: 'space-moderate', postId: spid, status: 'hidden', reason: REASON }],
    ['plain', { type: 'space-reply', postId: spid, body: 'A fictional reply long enough.' }],
    ['lrnA1', { type: 'space-report', postId: spid, reason: 'A fictional reason long enough.' }],
  ])
    same(
      attempt(two.t, u(two, who), cmd),
      attempt(two.t, u(two, who), { ...cmd, postId: UNK }),
      who + ' ' + cmd.type,
    );
  // an enabled ws-two room does not show ws-one's posts
  two.t = apply(two.t, 'owner2', { type: 'space-ecosystem', enabled: true });
  for (const who of ['owner2', 'plain', 'lrnA1'])
    assert.ok(
      !fp(spaces(two.t, two, who)).includes(POST.title) && !fp(projectTeam(two.t, u(two, who))).includes(pid),
      who,
    );
});
test('projection and commands: unsupported fields are refused and a single person cannot be told apart from an outsider by response shape', () => {
  const w = base();
  assert.equal(
    attempt(w.t, u(w, 'lrnA1'), { type: 'space-post', spaceId: SP_A, ...POST, authorId: 'someone' }).status,
    400,
  );
  assert.equal(attempt(w.t, u(w, 'owner'), { type: 'space-ecosystem', enabled: true, extra: 1 }).status, 400);
  assert.equal(attempt(w.t, u(w, 'owner'), { type: 'space-ecosystem', enabled: 'yes' }).status, 422);
  const out = spaces(w.t, w, 'plain');
  assert.deepEqual(Object.keys(out).sort(), [
    'canOpenEcosystem',
    'ecosystem',
    'items',
    'moderationHistory',
    'note',
    'posts',
    'reports',
  ]);
  assert.match(out.note, /does not connect you to people in other workspaces/);
});
