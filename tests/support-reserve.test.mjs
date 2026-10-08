import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const app = resolve(process.env.ACADEMY_APP_PATH ?? '.');
const runtime = resolve(process.env.ACADEMY_SECURITY_RUNTIME ?? resolve(app, '.sites-runtime'));
const support = await import(pathToFileURL(resolve(runtime, 'support.mjs')).href);
const storage = await import(pathToFileURL(resolve(runtime, 'storage.mjs')).href);
const { applySupportCommand, projectSupport, reconcileSupportAssignments, supportClosureReserve } = support;
const { checkMutationBudget } = storage;
const now = '2026-10-05T10:00:00.000Z',
  bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
const member = (id, roles, scopes = []) => ({
  userId: id,
  name: 'Synthetic ' + id,
  active: true,
  roles,
  scopes,
});
const fixture = () => ({
  id: 'tw-' + crypto.randomUUID(),
  name: 'Synthetic capacity fixture',
  context: 'msme',
  members: [
    member('owner', ['admin']),
    member('handler', ['facilitator'], ['c-one']),
    ...Array.from({ length: 98 }, (_, i) => member('requester-' + i, ['learner'])),
  ],
  cohorts: [{ id: 'c-one', title: 'Synthetic source practice' }],
  support: [],
  learners: [],
  activity: [],
  moderation: [],
});
const open = (t, i = 0, body = 'A fictional bounded source question.') => {
  applySupportCommand(
    t,
    'requester-' + (i % 98),
    {
      type: 'support-open',
      category: 'learning',
      cohortId: 'c-one',
      subject: 'Generic synthetic issue ' + i,
      body,
      audienceAcknowledged: true,
    },
    now,
  );
  return t.support.at(-1).id;
};
function atDynamicBoundary() {
  let t = fixture();
  for (let i = 0; i < 100; i++) open(t, i, 'B'.repeat(10));
  const first = t.support[0];
  for (let i = 0; i < 19; i++)
    applySupportCommand(
      t,
      first.requesterId,
      { type: 'support-reply', requestId: first.id, body: 'B'.repeat(10) },
      now,
    );
  let reachedBytes = false;
  for (let rounds = 0; rounds < 2000; rounds++) {
    const r = t.support.find((r) => r.messages.length < 20);
    assert.ok(r, 'Byte reserve should bind before all 100 threads exhaust messages.');
    const canAppend = (len) => {
      const copy = structuredClone(t);
      try {
        applySupportCommand(
          copy,
          r.requesterId,
          { type: 'support-reply', requestId: r.id, body: 'B'.repeat(len) },
          now,
        );
        return copy;
      } catch (e) {
        assert.equal(e.status, 413, 'Expected byte reserve, not an unrelated rule failure.');
        return null;
      }
    };
    const minimum = canAppend(10);
    if (!minimum) {
      reachedBytes = true;
      break;
    }
    let low = 10,
      high = 2000,
      best = minimum;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2),
        candidate = canAppend(mid);
      if (candidate) {
        best = candidate;
        low = mid + 1;
      } else high = mid - 1;
    }
    t = best;
    assert.ok(bytes(t.support) + supportClosureReserve(t) <= 250000);
  }
  assert.equal(reachedBytes, true);
  return t;
}

test('all 100 own open requests can withdraw at the dynamic byte boundary, including a 20-message thread', () => {
  const t = atDynamicBoundary();
  assert.equal(t.support[0].messages.length, 20);
  assert.equal(t.support.length, 100);
  const histories = t.support.map((r) => structuredClone(r.messages));
  // A permitted later display-name edit must already fit the reserved worst case.
  for (const m of t.members)
    if (m.userId.startsWith('requester-')) m.name = String.fromCharCode(0).repeat(80);
  let previousReserve = supportClosureReserve(t);
  assert.ok(previousReserve > 0);
  for (const [i, r] of t.support.entries()) {
    assert.equal(
      applySupportCommand(t, r.requesterId, { type: 'support-withdraw', requestId: r.id }, now),
      true,
    );
    assert.equal(t.support[i].status, 'withdrawn');
    assert.deepEqual(t.support[i].messages, histories[i]);
    const reserve = supportClosureReserve(t);
    assert.ok(reserve < previousReserve);
    previousReserve = reserve;
    assert.ok(bytes(t.support) + reserve <= 250000, 'Remaining closures must retain their own capacity.');
  }
  assert.equal(supportClosureReserve(t), 0);
  assert.ok(bytes(t.support) <= 250000);
});

test('every support write retains exact future closure capacity; rejected growth remains atomic', () => {
  const t = atDynamicBoundary(),
    r = t.support.find((r) => r.messages.length < 20),
    before = JSON.stringify(t);
  assert.throws(
    () =>
      applySupportCommand(
        t,
        r.requesterId,
        { type: 'support-reply', requestId: r.id, body: 'One more fictional question at the boundary.' },
        now,
      ),
    (e) => e.status === 413,
  );
  assert.equal(JSON.stringify(t), before);
  assert.ok(bytes(t.support) + supportClosureReserve(t) <= 250000);
});

test('global protective actions cannot consume support closure reserve and valid final withdrawal still works', () => {
  const t = fixture(),
    id = open(t),
    r = t.support[0];
  t.members.find((m) => m.userId === r.requesterId).name = String.fromCharCode(0).repeat(80);
  const reserve = supportClosureReserve(t);
  t.padding = '';
  t.padding = 'x'.repeat(1800000 - reserve - bytes(t));
  assert.equal(bytes(t) + supportClosureReserve(t), 1800000);
  const growth = structuredClone(t);
  growth.extraProtectiveEvent = 'x'.repeat(50);
  assert.throws(
    () =>
      checkMutationBudget(t, growth, {
        type: 'member',
        userId: 'handler',
        roles: ['facilitator'],
        scopes: ['c-one'],
        active: false,
      }),
    (e) => e.status === 413,
  );
  const final = structuredClone(t);
  applySupportCommand(final, r.requesterId, { type: 'support-withdraw', requestId: id }, now);
  assert.equal(checkMutationBudget(t, final, { type: 'support-withdraw', requestId: id }).protective, true);
  assert.ok(bytes(final) + supportClosureReserve(final) <= 1800000);
});

test('revoked assignment cannot revive after restoration when reconciliation is persisted', () => {
  const t = fixture(),
    id = open(t);
  applySupportCommand(t, 'handler', { type: 'support-claim', requestId: id }, now);
  t.members[1].roles = ['moderator'];
  assert.equal(reconcileSupportAssignments(t), 1);
  assert.equal(t.support[0].assignedTo, null);
  t.members[1].roles = ['facilitator'];
  assert.equal(projectSupport(t, 'handler').assigned.length, 0);
  assert.throws(
    () =>
      applySupportCommand(
        t,
        'handler',
        { type: 'support-reply', requestId: id, body: 'Restored authority requires a fresh claim.' },
        now,
      ),
    (e) => e.status === 403,
  );
  applySupportCommand(t, 'handler', { type: 'support-claim', requestId: id }, now);
  assert.equal(projectSupport(t, 'handler').assigned.length, 1);
});

test('name snapshots are bounded and clocks are canonical before storing support events', () => {
  const t = fixture();
  t.members.find((m) => m.userId === 'requester-0').name = 'N'.repeat(1000);
  applySupportCommand(
    t,
    'requester-0',
    {
      type: 'support-open',
      category: 'learning',
      cohortId: 'c-one',
      subject: 'Generic clock and name fixture',
      body: 'A fictional name and clock validation fixture.',
      audienceAcknowledged: true,
    },
    '2026-10-05T15:30:00+05:30',
  );
  const r = t.support[0];
  assert.ok(r.requesterName.length <= 80);
  assert.ok(r.messages[0].actorName.length <= 80);
  assert.ok(r.events[0].actorName.length <= 80);
  assert.equal(r.createdAt, '2026-10-05T10:00:00.000Z');
  assert.equal(r.updatedAt.length, 24);
  assert.equal(r.events[0].createdAt.length, 24);
});

test('extended-year clocks are rejected atomically instead of exceeding the 24-character reserve invariant', () => {
  const t = fixture(),
    before = JSON.stringify(t);
  assert.throws(
    () =>
      applySupportCommand(
        t,
        'requester-0',
        {
          type: 'support-open',
          category: 'learning',
          cohortId: 'c-one',
          subject: 'Generic extended clock fixture',
          body: 'A fictional extended clock validation fixture.',
          audienceAcknowledged: true,
        },
        '+020000-01-01T00:00:00.000Z',
      ),
    (e) => e.status === 400,
  );
  assert.equal(JSON.stringify(t), before);
});

test('100 lifecycle events block ordinary claim growth while the final 101st withdrawal event remains available', () => {
  const t = fixture(),
    id = open(t);
  for (let i = 0; i < 99; i++) {
    applySupportCommand(t, 'handler', { type: 'support-claim', requestId: id }, now);
    t.members[1].roles = ['moderator'];
    assert.equal(reconcileSupportAssignments(t), 1);
    t.members[1].roles = ['facilitator'];
  }
  assert.equal(t.support[0].events.length, 100);
  const before = JSON.stringify(t);
  assert.throws(
    () => applySupportCommand(t, 'handler', { type: 'support-claim', requestId: id }, now),
    (e) => e.status === 409,
  );
  assert.equal(JSON.stringify(t), before);
  applySupportCommand(t, 'requester-0', { type: 'support-withdraw', requestId: id }, now);
  assert.equal(t.support[0].status, 'withdrawn');
  assert.equal(t.support[0].events.length, 101);
  assert.equal(t.support[0].events.at(-1).type, 'withdrawn');
  assert.equal(supportClosureReserve(t), 0);
  assert.ok(bytes(t.support) <= 250000);
});
