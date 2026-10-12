import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMutationBudget, protectiveMutation, separateHistory } from '../.sites-runtime/storage.mjs';
import { createTeam, applyTeamCommand } from '../.sites-runtime/teams.mjs';
const u = { userId: 'owner', email: 'owner@example.test' },
  other = { userId: 'other', email: 'other@example.test' },
  now = '2026-10-05T08:00:00.000Z';
function fixture() {
  const t = createTeam(
    u,
    {
      name: 'Budget fixture',
      purpose: 'Test the availability of protective account changes.',
      context: 'msme',
    },
    'budget-fixture',
    now,
  );
  t.members.push({
    userId: other.userId,
    email: other.email,
    name: 'Fictional member',
    roles: ['learner'],
    scopes: [],
    active: true,
  });
  return t;
}
test('protective operations remain available for previously accepted near-full workspaces', () => {
  const before = fixture();
  before.posts = [{ body: 'x'.repeat(1_499_000) }];
  const after = applyTeamCommand(
    before,
    u,
    { type: 'member', userId: other.userId, roles: ['learner'], scopes: [], active: false },
    now,
  );
  const result = checkMutationBudget(before, after, {
    type: 'member',
    userId: other.userId,
    roles: ['learner'],
    scopes: [],
    active: false,
  });
  assert.equal(result.protective, true);
  assert.ok(result.newBytes > 1_499_000);
  assert.equal(after.members[1].active, false);
});
test('grants, restoration, extra scopes and new content cannot consume the protective reserve', () => {
  const before = fixture();
  before.posts = [{ body: 'x'.repeat(1_200_000) }];
  const after = structuredClone(before);
  after.posts.push({ body: 'Extra content' });
  for (const c of [
    { type: 'post' },
    { type: 'session-create' },
    { type: 'member', userId: other.userId, roles: ['learner', 'admin'], scopes: [], active: true },
    { type: 'cohort-status', status: 'open' },
  ])
    assert.throws(
      () => checkMutationBudget(before, after, c),
      (e) => e.status === 413,
    );
  before.members[1].active = false;
  assert.equal(
    protectiveMutation(before, {
      type: 'member',
      userId: other.userId,
      roles: ['learner'],
      scopes: [],
      active: true,
    }),
    false,
  );
});
test('shrinking writes and directory opt-out remain available above the ordinary limit', () => {
  const before = fixture();
  before.posts = [{ body: 'x'.repeat(1_500_000) }];
  const after = structuredClone(before);
  after.posts[0].body = 'short';
  assert.ok(checkMutationBudget(before, after, { type: 'post' }).newBytes < 1_200_000);
  assert.equal(protectiveMutation(before, { type: 'network-profile', enabled: false }), true);
  assert.equal(protectiveMutation(before, { type: 'session-rsvp', going: false }), true);
});
test('administrative history limit cannot block removal; archive separates without losing records', () => {
  let t = fixture();
  t.activity = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), action: 'fixture' }));
  t = applyTeamCommand(
    t,
    u,
    { type: 'member', userId: other.userId, roles: ['learner'], scopes: [], active: false },
    now,
  );
  assert.equal(t.members[1].active, false);
  const packet = separateHistory(t);
  assert.equal(t.activity.length, 200);
  assert.equal(packet.activity.length, 801);
  assert.equal(packet.activity[0].id, '0');
  assert.equal(t.activity.at(-1).action, 'member');
  assert.equal(packet.activity.length + t.activity.length, 1001);
});
