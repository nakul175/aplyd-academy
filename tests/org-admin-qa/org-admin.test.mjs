/** BR-38: organisation overview is owner only, read only, counts only, and never shows or acts on a
 * workspace the user does not actively own. Real module bundle; synthetic people only. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectOrgOverview, isActiveOwner, ORG_LIMITS } from '../../.sites-runtime/wave4-qa/model.mjs';
import { apply, u, workspace, withReport, escalate, status, at, NOW, PROG_A } from './fixture.mjs';

const fp = (x) => JSON.stringify(x);
const attempt = (t, who, c) => status(() => apply(t, who, c));
const same = (a, b, label) => {
  assert.ok(a, label + ': denied call must fail');
  assert.ok(b, label + ': unknown call must fail');
  assert.deepEqual(a, b, label + ': denied and unknown must be indistinguishable');
};
const rich = (id, owner) => {
  let w = withReport(workspace(id, owner));
  w.t = escalate(w);
  w.t = apply(w.t, u(w, 'lrnA1'), {
    type: 'data-request-open',
    kind: 'export',
    detail: 'A fictional export request PRIVATE-REQUEST-TEXT.',
  });
  w.t = apply(w.t, u(w, 'plain'), {
    type: 'recovery-request',
    claimedEmail: 'old-person@example.test',
    cohortHint: 'PRIVATE-COHORT-HINT',
    activityHint: '',
    note: '',
  });
  w.t = apply(w.t, 'owner' === owner ? owner : owner, {
    type: 'invite',
    email: 'late@' + id + '.example.test',
    roles: ['learner'],
    scopes: [],
    tokenHash: '9'.repeat(64),
  });
  return w;
};
const ws = (o, id) => o.workspaces.find((w) => w.workspaceId === id);
const FAR = at(24 * 40);

test('an owner sees counts for the workspaces they own, and the counts are right', () => {
  const w = rich('ws-one', 'owner'),
    o = projectOrgOverview([w.t], 'owner', NOW),
    x = ws(o, 'ws-one');
  assert.equal(o.workspaces.length, 1);
  assert.equal(x.name, w.t.name);
  assert.equal(x.members.active, 11);
  assert.equal(x.members.removed, 0);
  assert.equal(x.members.byRole.admin, 1);
  assert.equal(x.members.byRole.learner, 6);
  assert.equal(x.members.byRole.moderator, 2);
  assert.equal(x.members.byRole.facilitator, 1);
  assert.equal(x.members.byRole.assessor, 2);
  assert.equal(x.members.byRole.reviewer, 1);
  assert.deepEqual(
    [x.cohorts.total, x.cohorts.open, x.cohorts.paused, x.cohorts.closed, x.cohorts.pathways],
    [2, 2, 0, 0, 2],
  );
  assert.deepEqual(x.seats, { occupied: 4, capacity: 20 });
  assert.deepEqual(x.invites, { pending: 1, expired: 0 });
  assert.deepEqual(x.escalations, { open: 1, overdue: 0 });
  assert.deepEqual(x.dataRequests, { open: 1, overdue: 0 });
  assert.equal(x.recoveryPending, 1);
  const late = projectOrgOverview([w.t], 'owner', FAR);
  const y = ws(late, 'ws-one');
  assert.deepEqual(y.escalations, { open: 1, overdue: 1 });
  assert.equal(y.dataRequests.overdue, 1);
  assert.deepEqual(y.invites, { pending: 0, expired: 1 });
  assert.equal(late.totals.overdueEscalations, 1);
  assert.equal(late.totals.overdueDataRequests, 1);
  assert.equal(late.totals.workspaces, 1);
});
test('the overview is counts only: no names, emails, user ids, post, support, request or recovery text', () => {
  const w = rich('ws-one', 'owner'),
    blob = fp(projectOrgOverview([w.t], 'owner', NOW));
  for (const s of [
    'example.test',
    'PRIVATE-REQUEST-TEXT',
    'PRIVATE-COHORT-HINT',
    'fictional discussion',
    'Needs the workspace owner',
    'lrnA1',
    'modA',
    'Cohort A',
    'userId',
    'tokenHash',
    'old-person',
  ])
    assert.ok(!blob.includes(s), 'leaked ' + s);
  assert.ok(!blob.includes(w.A) && !blob.includes(w.B), 'no cohort ids');
  const allowed = new Set([
    'workspaceId',
    'name',
    'context',
    'members',
    'cohorts',
    'seats',
    'invites',
    'escalations',
    'dataRequests',
    'recoveryPending',
  ]);
  for (const k of Object.keys(projectOrgOverview([w.t], 'owner', NOW).workspaces[0]))
    assert.ok(allowed.has(k), k);
});
test('non-owners get nothing: staff, learners, removed owners, strangers and owners of another workspace', () => {
  const one = rich('ws-one', 'owner'),
    two = rich('ws-two', 'owner2');
  for (const who of ['modA', 'facA', 'revA', 'lrnA1', 'plain', 'modB', 'assessB', 'nobody', 'owner2']) {
    assert.equal(projectOrgOverview([one.t], one.ids[who] ?? who, NOW).workspaces.length, 0, who);
    assert.equal(isActiveOwner(one.t, one.ids[who] ?? who), false, who);
  }
  // handing the function both workspaces (a server bug) still only describes the one the caller owns
  const both = projectOrgOverview([one.t, two.t], 'owner', NOW);
  assert.deepEqual(
    both.workspaces.map((w) => w.workspaceId),
    ['ws-one'],
  );
  assert.ok(!fp(both).includes('ws-two'));
  const other = projectOrgOverview([one.t, two.t], 'owner2', NOW);
  assert.deepEqual(
    other.workspaces.map((w) => w.workspaceId),
    ['ws-two'],
  );
  assert.ok(!fp(other).includes('ws-one') && !fp(other).includes('Fictional pilot ws-one'));
  // an admin of ws-one who is only a learner in ws-two does not see ws-two
  let t = apply(two.t, 'owner2', {
    type: 'invite',
    email: 'dual@x.example.test',
    roles: ['learner'],
    scopes: [],
    tokenHash: 'd'.repeat(64),
  });
  t = apply(
    t,
    { userId: 'owner', email: 'dual@x.example.test' },
    { type: 'accept', tokenHash: 'd'.repeat(64) },
  );
  assert.deepEqual(
    projectOrgOverview([one.t, t], 'owner', NOW).workspaces.map((w) => w.workspaceId),
    ['ws-one'],
  );
  // removed owner
  let t3 = apply(two.t, 'owner2', {
    type: 'invite',
    email: 'co@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  t3 = apply(t3, { userId: 'co', email: 'co@x.example.test' }, { type: 'accept', tokenHash: 'c'.repeat(64) });
  assert.equal(projectOrgOverview([t3], 'co', NOW).workspaces.length, 1);
  t3 = apply(t3, 'owner2', { type: 'member', userId: 'co', roles: ['admin'], scopes: [], active: false });
  assert.equal(projectOrgOverview([t3], 'co', NOW).workspaces.length, 0);
  // an owner who loses the admin role
  let t4 = apply(two.t, 'owner2', {
    type: 'invite',
    email: 'co@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'c'.repeat(64),
  });
  t4 = apply(t4, { userId: 'co', email: 'co@x.example.test' }, { type: 'accept', tokenHash: 'c'.repeat(64) });
  t4 = apply(t4, 'owner2', { type: 'member', userId: 'co', roles: ['moderator'], scopes: [], active: true });
  assert.equal(projectOrgOverview([t4], 'co', NOW).workspaces.length, 0);
});
test('malformed input is handled without throwing or leaking', () => {
  for (const bad of [null, undefined, 'x', {}, [null, {}], [{ members: 'x' }], [{ members: [null] }]])
    assert.deepEqual(projectOrgOverview(bad, 'owner', NOW).workspaces, []);
  const many = Array.from({ length: ORG_LIMITS.workspaces + 5 }, (_, i) => workspace('ws-' + i, 'owner').t);
  assert.equal(projectOrgOverview(many, 'owner', NOW).workspaces.length, ORG_LIMITS.workspaces);
});
test('admin actions are the existing protected commands and are refused outside an owned workspace', () => {
  const one = rich('ws-one', 'owner'),
    two = rich('ws-two', 'owner2'),
    unknown = '11111111-1111-4111-8111-111111111111';
  const invite = {
    type: 'invite',
    email: 'new@x.example.test',
    roles: ['learner'],
    scopes: [],
    tokenHash: 'a'.repeat(64),
  };
  const cmds = [
    invite,
    { type: 'revoke-invite', inviteId: one.t.invites.at(-1).id },
    { type: 'member', userId: one.ids.lrnA1, roles: ['admin'], scopes: [], active: true },
    { type: 'cohort-status', cohortId: one.A, status: 'paused' },
  ];
  // staff and learners of the workspace are refused (403), the same for every action
  for (const who of ['modA', 'facA', 'lrnA1', 'plain'])
    for (const c of cmds) assert.equal(attempt(one.t, u(one, who), c)?.status, 403, who + ' ' + c.type);
  // an owner of another workspace has no standing here (uniform 404, identical to any unknown id)
  for (const c of cmds)
    assert.equal(
      attempt(one.t, u(two, 'owner2') && { userId: 'owner2', email: 'owner2.example.test' }, c)?.status,
      404,
      c.type,
    );
  const probe = (c, id) =>
    attempt(
      one.t,
      { userId: 'owner2', email: 'owner2.example.test' },
      { ...c, ...(id ? { cohortId: id } : {}) },
    );
  same(probe(cmds[3]), probe(cmds[3], unknown), 'cohort-status');
  // a removed owner is refused
  let t = apply(one.t, 'owner', {
    type: 'invite',
    email: 'co@x.example.test',
    roles: ['admin'],
    scopes: [],
    tokenHash: 'b'.repeat(64),
  });
  t = apply(t, { userId: 'co', email: 'co@x.example.test' }, { type: 'accept', tokenHash: 'b'.repeat(64) });
  t = apply(t, 'owner', { type: 'member', userId: 'co', roles: ['admin'], scopes: [], active: false });
  for (const c of cmds)
    assert.equal(
      attempt(t, { userId: 'co', email: 'co@x.example.test' }, c)?.status,
      403,
      'removed ' + c.type,
    );
});
test('an owner can pause a cohort, change a role and scope, revoke an invitation; the overview follows', () => {
  let w = rich('ws-one', 'owner');
  w.t = apply(w.t, 'owner', { type: 'cohort-status', cohortId: w.A, status: 'paused' });
  let x = ws(projectOrgOverview([w.t], 'owner', NOW), 'ws-one');
  assert.deepEqual([x.cohorts.open, x.cohorts.paused], [1, 1]);
  w.t = apply(w.t, 'owner', { type: 'revoke-invite', inviteId: w.t.invites.at(-1).id });
  x = ws(projectOrgOverview([w.t], 'owner', NOW), 'ws-one');
  assert.equal(x.invites.pending, 0);
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.facA,
    roles: ['facilitator', 'reviewer'],
    scopes: [w.A, w.B],
    active: true,
  });
  x = ws(projectOrgOverview([w.t], 'owner', NOW), 'ws-one');
  assert.equal(x.members.byRole.reviewer, 2);
  w.t = apply(w.t, 'owner', {
    type: 'member',
    userId: w.ids.plain,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  x = ws(projectOrgOverview([w.t], 'owner', NOW), 'ws-one');
  assert.deepEqual([x.members.active, x.members.removed], [10, 1]);
  assert.equal(
    attempt(w.t, 'owner', { type: 'member', userId: 'owner', roles: ['learner'], scopes: [], active: true })
      ?.status,
    409,
    'the last active owner cannot be removed or demoted',
  );
});
test('the overview function reads and never changes the aggregate', () => {
  const w = rich('ws-one', 'owner'),
    before = fp(w.t);
  projectOrgOverview([w.t], 'owner', FAR);
  assert.equal(fp(w.t), before);
  assert.ok(PROG_A.id);
});
