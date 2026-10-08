import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySupportCommand,
  projectSupport,
  SupportRuleError,
  eligibleSupportHandler,
  reconcileSupportAssignments,
} from '../.sites-runtime/support.mjs';
const now = '2026-10-05T10:00:00.000Z',
  later = '2026-10-05T10:05:00.000Z';
const makeMember = (userId, roles, scopes = [], active = true) => ({
  userId,
  name: 'Synthetic ' + userId,
  email: userId + '@support.test',
  roles,
  scopes,
  active,
});
function fixture() {
  return {
    members: [
      makeMember('owner', ['admin']),
      makeMember('owner-two', ['admin']),
      makeMember('facilitator', ['facilitator'], ['c-one']),
      makeMember('other-facilitator', ['facilitator'], ['c-two']),
      makeMember('requester', ['learner']),
      makeMember('other-learner', ['learner']),
      makeMember('assessor', ['assessor'], ['c-one']),
      makeMember('removed', ['facilitator'], ['c-one'], false),
    ],
    cohorts: [
      { id: 'c-one', title: 'Fictional first cohort', status: 'paused' },
      { id: 'c-two', title: 'Fictional second cohort', status: 'closed' },
    ],
    learners: [
      {
        userId: 'requester',
        state: { enrollments: [{ draft: { field: 'PRIVATE-LEARNING-DRAFT-CANARY' } }] },
      },
    ],
  };
}
const apply = (t, actor, c, clock = now) => applySupportCommand(t, actor, c, clock);
function open(t, actor = 'requester', override = {}) {
  assert.equal(
    apply(t, actor, {
      type: 'support-open',
      category: 'learning',
      cohortId: 'c-one',
      subject: 'A generic activity question',
      body: 'PRIVATE-SUPPORT-BODY-CANARY: I need help with the fictional activity.',
      audienceAcknowledged: true,
      ...override,
    }),
    true,
  );
  return t.support.at(-1).id;
}
const rejects = (f, status) => assert.throws(f, (e) => e instanceof SupportRuleError && e.status === status);
const claim = (t, id, actor = 'facilitator') => apply(t, actor, { type: 'support-claim', requestId: id });
test('old Team documents without support remain readable; unrelated commands are ignored', () => {
  const t = fixture(),
    before = JSON.stringify(t);
  assert.deepEqual(projectSupport(t, 'requester'), { mine: [], queue: [], assigned: [] });
  assert.equal(apply(t, 'requester', { type: 'lesson' }), false);
  assert.equal(JSON.stringify(t), before);
});
test('intake requires acknowledgement, exact keys and server-bound requester identity', () => {
  const t = fixture();
  for (const override of [
    { audienceAcknowledged: false },
    { requesterId: 'owner' },
    { assignedTo: 'owner' },
    { createdAt: later },
    { status: 'resolved' },
    { category: 'emergency' },
  ])
    rejects(
      () => open(t, 'requester', override),
      Object.keys(override).some((k) => ['requesterId', 'assignedTo', 'createdAt', 'status'].includes(k))
        ? 400
        : 422,
    );
  assert.equal(t.support, undefined);
  const id = open(t);
  assert.equal(t.support[0].requesterId, 'requester');
  assert.equal(t.support[0].createdAt, now);
  assert.equal(t.support[0].messages[0].actorId, 'requester');
  assert.equal(t.support[0].events[0].type, 'opened');
  assert.equal(projectSupport(t, 'requester').mine[0].id, id);
});
test('unenrolled learner can ask about an offering even when paused or closed', () => {
  const t = fixture();
  open(t, 'requester');
  open(t, 'requester', { cohortId: 'c-two' });
  open(t, 'requester', { category: 'access', cohortId: null });
  assert.equal(t.support.length, 3);
  rejects(() => open(t, 'requester', { cohortId: 'foreign-cohort' }), 404);
  rejects(() => open(t, 'requester', { cohortId: undefined }), 400);
});
test('staff intake uses actual current staff scope rather than broad board access', () => {
  const t = fixture();
  open(t, 'assessor');
  rejects(() => open(t, 'assessor', { cohortId: 'c-two' }), 403);
  open(t, 'owner', { cohortId: 'c-two' });
  rejects(() => open(t, 'removed'), 403);
  rejects(() => open(t, 'foreign'), 404);
});
test('owner and scoped facilitator queue reveals no message, resolution, email or private learning draft', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  apply(t, 'facilitator', {
    type: 'support-resolve',
    requestId: id,
    resolution: 'PRIVATE-RESOLUTION-CANARY: use the fictional source-packet instructions.',
  });
  for (const user of ['owner', 'owner-two']) {
    const projection = projectSupport(t, user),
      serialized = JSON.stringify(projection);
    assert.equal(projection.queue.length, 1);
    assert.equal(projection.assigned.length, 0);
    for (const secret of [
      'PRIVATE-SUPPORT-BODY-CANARY',
      'PRIVATE-RESOLUTION-CANARY',
      'PRIVATE-LEARNING-DRAFT-CANARY',
      '@support.test',
    ])
      assert.ok(!serialized.includes(secret));
    for (const field of ['messages', 'resolution', 'requesterId', 'assignedTo', 'email'])
      assert.ok(!(field in projection.queue[0]));
  }
  const own = projectSupport(t, 'requester');
  assert.ok(JSON.stringify(own.mine).includes('PRIVATE-SUPPORT-BODY-CANARY'));
  assert.ok(JSON.stringify(own.mine).includes('PRIVATE-RESOLUTION-CANARY'));
  assert.ok(!JSON.stringify(own).includes('actorId'));
  assert.ok(!JSON.stringify(own).includes('PRIVATE-LEARNING-DRAFT-CANARY'));
});
test('unrelated learners, other-cohort facilitators and assessors gain no support queue or body authority', () => {
  const t = fixture(),
    id = open(t);
  for (const actor of ['other-learner', 'other-facilitator', 'assessor']) {
    assert.deepEqual(projectSupport(t, actor), { mine: [], queue: [], assigned: [] });
    rejects(() => claim(t, id, actor), 404);
    rejects(
      () =>
        apply(t, actor, {
          type: 'support-reply',
          requestId: id,
          body: 'An attempted unauthorized private reply.',
        }),
      404,
    );
  }
  rejects(() => projectSupport(t, 'foreign'), 404);
});
test('sensitive categories route to owners even when they mention a cohort', () => {
  for (const category of ['access', 'technical', 'privacy', 'accessibility']) {
    const t = fixture(),
      id = open(t, 'requester', { category });
    assert.equal(projectSupport(t, 'facilitator').queue.length, 0);
    rejects(() => claim(t, id), 404);
    claim(t, id, 'owner');
    assert.equal(projectSupport(t, 'owner').assigned.length, 1);
  }
});
test('learning or content without a cohort needs owner handling', () => {
  const t = fixture(),
    id = open(t, 'requester', { category: 'content', cohortId: null });
  assert.equal(projectSupport(t, 'facilitator').queue.length, 0);
  claim(t, id, 'owner');
  assert.equal(projectSupport(t, 'owner').assigned[0].handlerName, 'Synthetic owner');
});
test('self handling is forbidden and queue identifies absence of another eligible handler', () => {
  const t = fixture();
  t.members = [makeMember('owner', ['admin'])];
  const id = open(t, 'owner', { category: 'privacy', cohortId: null });
  const p = projectSupport(t, 'owner');
  assert.equal(p.mine.length, 1);
  assert.equal(p.queue[0].canClaim, false);
  assert.equal(p.queue[0].eligibleHandlerAvailable, false);
  rejects(() => claim(t, id, 'owner'), 403);
  rejects(
    () =>
      apply(t, 'owner', {
        type: 'support-resolve',
        requestId: id,
        resolution: 'I cannot independently handle my own request.',
      }),
    403,
  );
});
test('claim is exclusive, and queue authority alone cannot reply or resolve', () => {
  const t = fixture(),
    id = open(t);
  rejects(
    () =>
      apply(t, 'owner', {
        type: 'support-reply',
        requestId: id,
        body: 'A queue owner cannot read or answer before claiming.',
      }),
    403,
  );
  claim(t, id);
  rejects(() => claim(t, id, 'owner'), 409);
  rejects(
    () =>
      apply(t, 'owner', {
        type: 'support-resolve',
        requestId: id,
        resolution: 'An owner without the assignment cannot resolve the private thread.',
      }),
    403,
  );
  assert.equal(projectSupport(t, 'owner').assigned.length, 0);
  assert.equal(projectSupport(t, 'facilitator').assigned.length, 1);
});
test('reply and lifecycle preserve immutable messages, resolutions and historical actor attribution', () => {
  const t = fixture(),
    id = open(t);
  const first = structuredClone(t.support[0].messages[0]);
  claim(t, id);
  apply(
    t,
    'facilitator',
    {
      type: 'support-reply',
      requestId: id,
      body: 'A fictional source-packet explanation from the assigned handler.',
    },
    later,
  );
  apply(
    t,
    'requester',
    {
      type: 'support-reply',
      requestId: id,
      body: 'Thank you. I checked the fictional packet and still have a question.',
    },
    later,
  );
  apply(
    t,
    'facilitator',
    {
      type: 'support-resolve',
      requestId: id,
      resolution: 'RESOLUTION-ONE: read the fictional instructions and retain the source references.',
    },
    later,
  );
  const originalResolution = structuredClone(t.support[0].resolution);
  rejects(
    () =>
      apply(t, 'requester', {
        type: 'support-reply',
        requestId: id,
        body: 'Resolved requests must first be reopened.',
      }),
    409,
  );
  apply(
    t,
    'requester',
    {
      type: 'support-reopen',
      requestId: id,
      body: 'I still need help finding the permitted fictional source reference.',
    },
    later,
  );
  assert.equal(t.support[0].resolution, null);
  assert.deepEqual(t.support[0].resolutions[0], originalResolution);
  assert.deepEqual(t.support[0].messages[0], first);
  apply(
    t,
    'facilitator',
    {
      type: 'support-resolve',
      requestId: id,
      resolution: 'RESOLUTION-TWO: the fictional packet names the reference in the first source field.',
    },
    later,
  );
  assert.equal(t.support[0].resolutions.length, 2);
  assert.deepEqual(t.support[0].resolutions[0], originalResolution);
  assert.deepEqual(
    t.support[0].events.map((e) => e.type),
    ['opened', 'claimed', 'resolved', 'reopened', 'resolved'],
  );
  assert.equal(t.support[0].messages[1].actorId, 'facilitator');
});
test('revoking handler membership immediately hides body and permits an independent replacement claim', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  t.members.find((m) => m.userId === 'facilitator').active = false;
  assert.deepEqual(projectSupport(t, 'facilitator'), { mine: [], queue: [], assigned: [] });
  assert.equal(projectSupport(t, 'requester').mine[0].handlerName, null);
  rejects(
    () =>
      apply(t, 'facilitator', {
        type: 'support-reply',
        requestId: id,
        body: 'A stale reply after removal must never be saved.',
      }),
    403,
  );
  claim(t, id, 'owner');
  const events = t.support[0].events;
  assert.equal(events.at(-1).previousHandlerId, 'facilitator');
  assert.equal(events.at(-1).handlerId, 'owner');
  assert.equal(projectSupport(t, 'owner').assigned.length, 1);
});
test('handler scope loss and owner role loss remove effective assignment without erasing history', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  t.members.find((m) => m.userId === 'facilitator').scopes = ['c-two'];
  assert.equal(projectSupport(t, 'facilitator').assigned.length, 0);
  rejects(
    () =>
      apply(t, 'facilitator', {
        type: 'support-reply',
        requestId: id,
        body: 'An old scoped reply is no longer authorized.',
      }),
    404,
  );
  claim(t, id, 'owner');
  t.members.find((m) => m.userId === 'owner').roles = ['assessor'];
  assert.equal(projectSupport(t, 'owner').assigned.length, 0);
  claim(t, id, 'owner-two');
  assert.equal(t.support[0].events.filter((e) => e.type === 'claimed').length, 3);
});
test('withdraw preserves own thread and forbids reopen or further replies', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  apply(t, 'requester', { type: 'support-withdraw', requestId: id });
  assert.equal(t.support[0].status, 'withdrawn');
  assert.equal(projectSupport(t, 'requester').mine[0].messages.length, 1);
  rejects(
    () =>
      apply(t, 'requester', {
        type: 'support-reopen',
        requestId: id,
        body: 'A withdrawn request cannot be reused as an open thread.',
      }),
    409,
  );
  rejects(
    () =>
      apply(t, 'facilitator', {
        type: 'support-reply',
        requestId: id,
        body: 'A withdrawn request is read only for everyone.',
      }),
    409,
  );
});
test('removed requester retains only their own historical thread and cannot write', () => {
  const t = fixture(),
    id = open(t);
  open(t, 'other-learner', { body: 'OTHER-REQUESTER-CANARY: separate fictional private support issue.' });
  t.members.find((m) => m.userId === 'requester').active = false;
  const p = projectSupport(t, 'requester');
  assert.equal(p.mine.length, 1);
  assert.deepEqual(p.queue, []);
  assert.deepEqual(p.assigned, []);
  assert.ok(!JSON.stringify(p).includes('OTHER-REQUESTER-CANARY'));
  for (const c of [
    { type: 'support-reply', requestId: id, body: 'A stale own reply after access removal.' },
    { type: 'support-withdraw', requestId: id },
    {
      type: 'support-open',
      category: 'access',
      cohortId: null,
      subject: 'New inaccessible request',
      body: 'A removed member cannot make a new shared request.',
      audienceAcknowledged: true,
    },
  ])
    rejects(() => apply(t, 'requester', c), 403);
});
test('five-open and 100-total case bounds are checked before state changes', () => {
  const t = fixture();
  for (let i = 0; i < 5; i++) open(t, 'requester', { subject: 'Fictional request ' + i });
  const before = JSON.stringify(t);
  rejects(() => open(t), 409);
  assert.equal(JSON.stringify(t), before);
  apply(t, 'requester', { type: 'support-withdraw', requestId: t.support[0].id });
  open(t);
  const cap = fixture(),
    id = open(cap);
  cap.support = Array.from({ length: 100 }, (_, i) => ({
    ...structuredClone(cap.support[0]),
    id: 'case-' + i,
    status: 'withdrawn',
  }));
  const saved = JSON.stringify(cap);
  rejects(() => open(cap, 'other-learner'), 409);
  assert.equal(JSON.stringify(cap), saved);
});
test('message bounds and oversized UTF-8 payload reject atomically without discarding old evidence', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  while (t.support[0].messages.length < 20)
    apply(t, 'requester', {
      type: 'support-reply',
      requestId: id,
      body: 'A bounded fictional follow-up question.',
    });
  let before = JSON.stringify(t);
  rejects(
    () =>
      apply(t, 'requester', {
        type: 'support-reply',
        requestId: id,
        body: 'This reply would exceed the per-case message cap.',
      }),
    409,
  );
  assert.equal(JSON.stringify(t), before);
  const large = fixture(),
    rid = open(large);
  large.support[0].messages = Array.from({ length: 19 }, (_, i) => ({
    id: 'message-' + i,
    actorId: 'requester',
    actorName: 'Synthetic requester',
    authorKind: 'requester',
    body: '界'.repeat(5000),
    createdAt: now,
  }));
  before = JSON.stringify(large);
  rejects(
    () =>
      apply(large, 'requester', {
        type: 'support-reply',
        requestId: rid,
        body: 'A small reply must still respect serialized UTF-8 support bytes.',
      }),
    413,
  );
  assert.equal(JSON.stringify(large), before);
});
test('all command payloads reject injected actor, scope, assignment or time fields', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  for (const [actor, c] of [
    [
      'requester',
      { type: 'support-reply', requestId: id, body: 'Fictional reply for exact-field validation.' },
    ],
    [
      'facilitator',
      {
        type: 'support-resolve',
        requestId: id,
        resolution: 'Fictional resolution for exact-field validation.',
      },
    ],
    ['requester', { type: 'support-withdraw', requestId: id }],
  ])
    for (const injected of [
      { actorId: 'owner' },
      { handlerId: 'owner' },
      { cohortId: 'c-two' },
      { createdAt: later },
    ])
      rejects(() => apply(t, actor, { ...c, ...injected }), 400);
  assert.equal(t.support[0].messages.length, 1);
  assert.equal(t.support[0].status, 'open');
});
test('requester and handler are independent from support owner/facilitator privileges', () => {
  const t = fixture(),
    id = open(t, 'facilitator');
  assert.equal(
    eligibleSupportHandler(
      t,
      t.members.find((m) => m.userId === 'facilitator'),
      t.support[0],
    ),
    false,
  );
  rejects(() => claim(t, id), 403);
  claim(t, id, 'owner');
  assert.equal(projectSupport(t, 'facilitator').mine.length, 1);
  assert.equal(projectSupport(t, 'facilitator').assigned.length, 0);
});
test('queue staff cannot withdraw or reopen another requester thread', () => {
  const t = fixture(),
    id = open(t);
  rejects(() => apply(t, 'owner', { type: 'support-withdraw', requestId: id }), 403);
  claim(t, id);
  apply(t, 'facilitator', {
    type: 'support-resolve',
    requestId: id,
    resolution: 'A useful fictional resolution by the independently assigned handler.',
  });
  rejects(
    () =>
      apply(t, 'owner', {
        type: 'support-reopen',
        requestId: id,
        body: 'Owner queue access cannot impersonate a requester reopening.',
      }),
    403,
  );
  assert.equal(t.support[0].status, 'resolved');
});
test('reconciliation prevents private-thread assignment resurrection after authority restoration', () => {
  const t = fixture(),
    id = open(t);
  claim(t, id);
  const originalClaim = structuredClone(t.support[0].events[1]);
  t.members.find((m) => m.userId === 'facilitator').active = false;
  assert.equal(reconcileSupportAssignments(t), 1);
  assert.equal(t.support[0].assignedTo, null);
  t.members.find((m) => m.userId === 'facilitator').active = true;
  assert.equal(projectSupport(t, 'facilitator').assigned.length, 0);
  assert.equal(projectSupport(t, 'facilitator').queue[0].canClaim, true);
  rejects(
    () =>
      apply(t, 'facilitator', {
        type: 'support-reply',
        requestId: id,
        body: 'Restored authority still requires a fresh explicit claim.',
      }),
    403,
  );
  claim(t, id);
  assert.deepEqual(t.support[0].events[1], originalClaim);
  assert.equal(t.support[0].events.filter((e) => e.type === 'claimed').length, 2);
});
