import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeam, applyTeamCommand, projectTeam } from '../.sites-runtime/teams.mjs';
import { programs } from '../.sites-runtime/engine.mjs';
const now = '2026-10-05T08:00:00.000Z',
  owner = { userId: 'network-owner', email: 'owner@test.example' },
  a = { userId: 'network-a', email: 'a@test.example' },
  b = { userId: 'network-b', email: 'b@test.example' },
  c = { userId: 'network-c', email: 'c@test.example' };
const action = (t, u, x, clock = now) => applyTeamCommand(t, u, x, clock),
  reject = (f, status) => assert.throws(f, (e) => e.status === status);
function fixture() {
  let t = createTeam(
    owner,
    {
      name: 'Network test workspace',
      purpose: 'Fictional sessions for careful collaborative practice.',
      context: 'msme',
    },
    'network-test',
    now,
  );
  t = action(t, owner, {
    type: 'cohort-create',
    title: 'MSME practice circle',
    programId: programs[1].id,
    capacity: 10,
  });
  const cid = t.cohorts[0].id;
  for (const [index, u] of [a, b, c].entries()) {
    const h = String(index + 1).repeat(64);
    t = action(t, owner, { type: 'invite', email: u.email, roles: ['learner'], scopes: [], tokenHash: h });
    t = action(t, u, { type: 'accept', tokenHash: h });
  }
  for (const u of [a, b]) t = action(t, u, { type: 'enroll', programId: programs[1].id, cohortId: cid });
  return t;
}
function scheduled() {
  let t = fixture();
  t = action(t, owner, {
    type: 'session-create',
    cohortId: t.cohorts[0].id,
    title: 'Checked draft practice',
    description: 'Compare fictional drafts with the source packet in a small group.',
    instructions: 'PRIVATE-JOIN: fictional classroom, no external provider.',
    startsAt: '2026-10-05T09:00:00.000Z',
    endsAt: '2026-10-05T10:00:00.000Z',
    capacity: 1,
  });
  return t;
}
test('old networking preference never publishes a directory profile; explicit choice has narrow projection', () => {
  let t = fixture();
  t = action(t, a, { type: 'profile', name: 'A learner', context: 'msme', reading: false, networking: true });
  assert.deepEqual(projectTeam(t, b).team.network.directory, []);
  t = action(t, a, {
    type: 'network-profile',
    enabled: true,
    bio: 'I practise checking fictional AI drafts.',
    focus: 'Checking AI drafts',
    cohortIds: [t.cohorts[0].id],
  });
  const card = projectTeam(t, b).team.network.directory[0];
  assert.equal(card.name, 'A learner');
  for (const forbidden of ['userId', 'email', 'consentedAt', 'roles', 'scopes'])
    assert.ok(!(forbidden in card));
  assert.equal(projectTeam(t, c).team.network.directory.length, 0);
  t = action(t, a, { type: 'network-profile', enabled: false });
  assert.equal(projectTeam(t, b).team.network.directory.length, 0);
});
test('directory and session access follow current cohort authorization rather than offering discovery', () => {
  let t = scheduled();
  reject(
    () =>
      action(t, c, {
        type: 'network-profile',
        enabled: true,
        bio: 'A not-yet-enrolled profile.',
        focus: 'Work records',
        cohortIds: [t.cohorts[0].id],
      }),
    403,
  );
  assert.equal(projectTeam(t, c).team.cohorts.length, 1);
  assert.equal(projectTeam(t, c).team.network.sessions.length, 0);
  reject(() => action(t, c, { type: 'session-rsvp', sessionId: t.network.sessions[0].id, going: true }), 404);
  reject(
    () =>
      action(t, a, {
        type: 'network-profile',
        enabled: true,
        bio: 'A fictional profile.',
        focus: 'Work records',
        cohortIds: ['another-cohort'],
      }),
    403,
  );
});
test('only owners or scoped facilitators host; learner cannot inject host or participant identity', () => {
  const t = scheduled(),
    s = t.network.sessions[0];
  reject(
    () =>
      action(t, a, {
        type: 'session-create',
        cohortId: s.cohortId,
        title: s.title,
        description: s.description,
        instructions: s.instructions,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        capacity: 2,
      }),
    403,
  );
  reject(() => action(t, a, { type: 'session-rsvp', sessionId: s.id, going: true, userId: b.userId }), 400);
  reject(
    () =>
      action(t, a, {
        type: 'session-cancel',
        sessionId: s.id,
        reason: 'An unauthorized cancellation attempt.',
      }),
    403,
  );
});
test('seat allocation is bounded and idempotent; instructions and roster are minimized', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  assert.ok(!JSON.stringify(projectTeam(t, a)).includes('PRIVATE-JOIN'));
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  assert.equal(t.network.sessions[0].registrations.length, 1);
  reject(() => action(t, b, { type: 'session-rsvp', sessionId: sid, going: true }), 409);
  const own = projectTeam(t, a).team.network.sessions[0],
    peer = projectTeam(t, b).team.network.sessions[0];
  assert.ok(own.instructions.includes('PRIVATE-JOIN'));
  assert.ok(!('registrations' in own));
  assert.ok(!('instructions' in peer));
  assert.ok(!('attendanceHistory' in peer));
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: false });
  t = action(t, b, { type: 'session-rsvp', sessionId: sid, going: true });
  assert.equal(projectTeam(t, b).team.network.sessions[0].occupied, 1);
});
test('membership removal and withdrawal release seats, remove directory access and hide joining data', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, a, {
    type: 'network-profile',
    enabled: true,
    bio: 'I enjoy careful fictional practice.',
    focus: 'Work records',
    cohortIds: [t.cohorts[0].id],
  });
  t = action(t, owner, { type: 'member', userId: a.userId, roles: ['learner'], scopes: [], active: false });
  assert.equal(projectTeam(t, b).team.network.directory.length, 0);
  assert.equal(projectTeam(t, a).team.network.sessions.length, 0);
  t = action(t, b, { type: 'session-rsvp', sessionId: sid, going: true });
  assert.equal(projectTeam(t, b).team.network.sessions[0].occupied, 1);
  const e = t.learners.find((l) => l.userId === b.userId).state.enrollments[0];
  t = action(t, b, { type: 'withdraw', enrollmentId: e.id });
  assert.equal(projectTeam(t, b).team.network.sessions.length, 0);
  assert.equal(projectTeam(t, owner).team.network.sessions[0].occupied, 0);
});
test('paused cohort blocks reservations and creation but cancellations remain available', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, owner, { type: 'cohort-status', cohortId: t.cohorts[0].id, status: 'paused' });
  reject(() => action(t, b, { type: 'session-rsvp', sessionId: sid, going: true }), 409);
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: false });
  t = action(t, owner, {
    type: 'session-cancel',
    sessionId: sid,
    reason: 'Paused to review the fictional practice source packet.',
  });
  assert.equal(t.network.sessions[0].status, 'cancelled');
  reject(() => action(t, a, { type: 'session-rsvp', sessionId: sid, going: true }), 409);
});
test('attendance is observed, retains correction history and never completes learning', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  const rid = t.network.sessions[0].registrations[0].id,
    cmd = {
      type: 'session-attendance',
      sessionId: sid,
      registrationId: rid,
      status: 'attended',
      reason: 'Observed the fictional source-check practice.',
    };
  reject(() => action(t, owner, cmd), 422);
  reject(() => action(t, a, cmd, '2026-10-05T09:30:00.000Z'), 403);
  t = action(t, owner, cmd, '2026-10-05T09:30:00.000Z');
  t = action(
    t,
    owner,
    { ...cmd, status: 'absent', reason: 'Correction after checking the observed participant list.' },
    '2026-10-05T10:05:00.000Z',
  );
  const projected = projectTeam(t, a);
  assert.equal(projected.team.network.sessions[0].myAttendance.status, 'absent');
  assert.equal(t.network.sessions[0].attendance.length, 2);
  assert.equal(projected.state.enrollments[0].completed.length, 0);
  assert.equal(projected.state.enrollments[0].record, null);
  assert.ok(!('registrations' in projected.team.network.sessions[0]));
});
test('time, bounds and unsupported fields reject invalid sessions without changing original', () => {
  const t = scheduled(),
    s = t.network.sessions[0],
    base = {
      type: 'session-create',
      cohortId: s.cohortId,
      title: s.title,
      description: s.description,
      instructions: s.instructions,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      capacity: 1,
    };
  for (const override of [
    { startsAt: 'bad' },
    { startsAt: now },
    { endsAt: '2026-10-05T08:59:00.000Z' },
    { endsAt: '2026-10-05T14:00:00.000Z' },
    { capacity: 0 },
    { hostId: a.userId },
  ])
    reject(() => action(t, owner, { ...base, ...override }), Object.hasOwn(override, 'hostId') ? 400 : 422);
  assert.equal(t.network.sessions.length, 1);
  reject(() => action(t, b, { type: 'session-rsvp', sessionId: s.id, going: true }, s.startsAt), 409);
});

test('restoring membership or re-enrolling cannot resurrect a released reservation or profile', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, a, {
    type: 'network-profile',
    enabled: true,
    bio: 'I practise careful fictional records.',
    focus: 'Work records',
    cohortIds: [t.cohorts[0].id],
  });
  t = action(t, owner, { type: 'member', userId: a.userId, roles: ['learner'], scopes: [], active: false });
  t = action(t, b, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, owner, { type: 'member', userId: a.userId, roles: ['learner'], scopes: [], active: true });
  const n = projectTeam(t, a).team.network;
  assert.equal(n.sessions[0].occupied, 1);
  assert.equal(n.sessions[0].myRsvp, 'cancelled');
  assert.equal(n.directory.length, 0);
  reject(() => action(t, a, { type: 'session-rsvp', sessionId: sid, going: true }), 409);
  const e = t.learners.find((l) => l.userId === b.userId).state.enrollments[0];
  t = action(t, b, { type: 'withdraw', enrollmentId: e.id });
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  t = action(t, b, { type: 'enroll', programId: programs[1].id, cohortId: t.cohorts[0].id });
  assert.equal(projectTeam(t, b).team.network.sessions[0].myRsvp, 'cancelled');
  assert.equal(projectTeam(t, b).team.network.sessions[0].occupied, 1);
});
test('calendar normalization never converts an impossible scheduled day silently', () => {
  const t = scheduled(),
    s = t.network.sessions[0];
  reject(
    () =>
      action(t, owner, {
        type: 'session-create',
        cohortId: s.cohortId,
        title: s.title,
        description: s.description,
        instructions: s.instructions,
        startsAt: '2026-11-31T09:00:00.000Z',
        endsAt: '2026-11-31T10:00:00.000Z',
        capacity: 1,
      }),
    422,
  );
});

test('former members retain only their own reservation and attendance history', () => {
  let t = scheduled(),
    sid = t.network.sessions[0].id;
  t = action(t, a, { type: 'session-rsvp', sessionId: sid, going: true });
  const rid = t.network.sessions[0].registrations[0].id;
  t = action(
    t,
    owner,
    {
      type: 'session-attendance',
      sessionId: sid,
      registrationId: rid,
      status: 'attended',
      reason: 'Observed fictional source checking in the practice room.',
    },
    '2026-10-05T09:30:00.000Z',
  );
  assert.ok(!('actor' in projectTeam(t, a).team.network.sessions[0].myAttendance));
  t = action(
    t,
    owner,
    { type: 'member', userId: a.userId, roles: ['learner'], scopes: [], active: false },
    '2026-10-05T10:30:00.000Z',
  );
  const n = projectTeam(t, a).team.network;
  assert.equal(n.sessions.length, 0);
  assert.equal(n.history.length, 1);
  assert.equal(n.history[0].attendance[0].status, 'attended');
  for (const key of ['hostId', 'instructions', 'registrations', 'userId']) assert.ok(!(key in n.history[0]));
  assert.ok(!JSON.stringify(n.history).includes('PRIVATE-JOIN'));
  assert.equal(projectTeam(t, b).team.network.history.length, 0);
});
