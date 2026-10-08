import { out, runtimeModuleHref } from './qa-paths.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const { deriveWorkspaceOperations } = await import(runtimeModuleHref);
import { operationsFixture } from './operations-fixture.mjs';
import { action, current, post, success } from '../local-qa.mjs';
const f = await operationsFixture(),
  {
    owner,
    a,
    b,
    c,
    fac,
    backup,
    nonmember,
    id,
    cid,
    otherCid,
    enrollments,
    attempts,
    appealId,
    supports,
    sessions,
    content,
    canaries,
  } = f;
let count = 0;
const eq = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  count++;
};
const ok = (value, label) => {
  assert.ok(value, label);
  count++;
};
const ids = (rows) => rows.map((r) => r.id).sort();
const model = (x) => {
  const m = deriveWorkspaceOperations(x.team, new Date().toISOString());
  ok(m, 'Expected current operational authority');
  return m;
};
function privateExcluded(m) {
  const serialized = JSON.stringify(m);
  for (const canary of Object.values(canaries))
    ok(!serialized.includes(canary), 'Read-only operations excludes ' + canary.split(':')[0]);
  for (const forbidden of [
    'fields',
    'notes',
    'feedback',
    'reason',
    'messages',
    'resolution',
    'personalGoal',
    'registrations',
    'attendanceHistory',
    'document',
    'reviewHistory',
  ])
    ok(!new RegExp('"' + forbidden + '"\\s*:').test(serialized), 'No protected body key ' + forbidden);
}
const ownerRead = success(await current(owner, id)),
  facRead = success(await current(fac, id));
let om = model(ownerRead),
  fm = model(facRead);
// These raw fields are legitimate because this owner is the assigned appeal
// reviewer/handler and author. The operations model must still discard them.
ok(
  JSON.stringify(ownerRead.team.assigned).includes(canaries.evidenceA),
  'Actually exercised assigned-owner evidence canary',
);
ok(
  JSON.stringify(ownerRead.team.assigned).includes(canaries.assessorNote),
  'Actually exercised original decision notes',
);
ok(
  JSON.stringify(ownerRead.team.support.assigned).includes(canaries.supportReply),
  'Actually exercised assigned-owner support body',
);
ok(
  JSON.stringify(ownerRead.team.content).includes(canaries.contentReview),
  'Actually exercised owner content review note',
);
ok(JSON.stringify(ownerRead.state).includes(canaries.ownerGoal), 'Actually exercised own private goal');
ok(
  JSON.stringify(ownerRead.team.network).includes(canaries.sessionInstructions),
  'Actually exercised current host joining instructions',
);
ok(
  JSON.stringify(facRead.team.assigned).includes(canaries.evidenceB),
  'Actually exercised assigned facilitator evidence',
);
ok(
  JSON.stringify(facRead.team.support.assigned).includes(canaries.supportReply),
  'Actually exercised assigned facilitator body',
);
privateExcluded(om);
privateExcluded(fm);
eq(om.audience, 'owner');
eq(om.totals, { cohorts: 2, nonWithdrawnEnrollments: 3, practiceRecords: 1, savedLessons: 10 });
eq(ids(om.cohorts), [cid, otherCid].sort());
eq(om.reviews.scope, 'workspace');
eq(om.reviews.total, 3);
eq(om.reviews.assessments, 2);
eq(om.reviews.appeals, 1);
eq(om.reviews.unassigned, 1);
eq(om.reviews.withoutEligibleStaff, 1);
eq(ids(om.reviews.items), [attempts.b, attempts.c, appealId].sort());
eq(om.reviews.items.find((q) => q.id === appealId).assignment, 'mine');
eq(om.reviews.items.find((q) => q.id === appealId).destination, { view: 'studio', id: appealId });
eq(om.reviews.items.find((q) => q.id === attempts.c).eligibleStaffCount, 0);
ok(
  om.reviews.items.every((q) => q.ageDays === 0),
  'Real newly created queues have zero elapsed full days',
);
const co = om.cohorts.find((co) => co.id === cid);
eq(
  {
    enrollments: co.enrollments,
    nonWithdrawn: co.nonWithdrawn,
    practiceCompleted: co.practiceCompleted,
    appealPending: co.appealPending,
    reviewPending: co.reviewPending,
    withdrawn: co.withdrawn,
    savedLessons: co.savedLessons,
  },
  {
    enrollments: 4,
    nonWithdrawn: 2,
    practiceCompleted: 1,
    appealPending: 1,
    reviewPending: 1,
    withdrawn: 2,
    savedLessons: 7,
  },
  'Actual enrollment rows may overlap record/appeal, count repeated withdrawn rows and retain saved lesson observations',
);
const aSummary = ownerRead.team.summaries.find((r) => r.learnerId === a.id);
eq(
  {
    status: aSummary.status,
    practiceRecordStatus: aSummary.practiceRecordStatus,
    hasOpenAppeal: aSummary.hasOpenAppeal,
    hasPendingAssessment: aSummary.hasPendingAssessment,
  },
  {
    status: 'Practice completed',
    practiceRecordStatus: 'active',
    hasOpenAppeal: true,
    hasPendingAssessment: false,
  },
  'Integrated thin metadata preserves older status and current independent facts',
);
const ownAfter = success(await current(a, id)).state.enrollments.find((e) => e.id === enrollments.a);
eq(ownAfter.record, f.recordBefore, 'Opening an appeal preserves record and issuedAt');
eq(ownAfter.attempts[0].decision, f.decisionBefore, 'Original assessment stays immutable');
eq(fm.audience, 'facilitator');
eq(fm.totals, { cohorts: 1, nonWithdrawnEnrollments: 2, practiceRecords: 1, savedLessons: 7 });
eq(ids(fm.cohorts), [cid]);
eq(fm.reviews.scope, 'my_assignments');
eq(fm.reviews.total, 1);
eq(fm.reviews.assessments, 1);
eq(fm.reviews.appeals, 0);
eq(fm.reviews.unassigned, null);
eq(fm.reviews.withoutEligibleStaff, null);
eq(ids(fm.reviews.items), [attempts.b]);
eq(fm.reviews.items[0].destination, { view: 'studio', id: attempts.b });
eq(fm.content.available, false);
eq(fm.content.items, []);
eq(facRead.team.pending, undefined, 'Facilitator does not receive owner queue');
eq(facRead.team.members, undefined, 'Facilitator does not receive owner membership roster');
eq(om.support.totalOpen, 4);
eq(om.support.needsHandler, 1);
eq(om.support.handledByMe, 2);
eq(ids(om.support.items), Object.values(supports).sort());
eq(fm.support.totalOpen, 2);
eq(fm.support.handledByMe, 1);
eq(ids(fm.support.items), [supports.reopened, supports.facHandled].sort());
const reopened = ownerRead.team.support.queue.find((r) => r.id === supports.reopened),
  reopenedModel = om.support.items.find((r) => r.id === supports.reopened);
eq(reopenedModel.createdAt, reopened.createdAt);
eq(
  reopenedModel.openedDaysAgo,
  Math.floor((Date.now() - Date.parse(reopened.createdAt)) / 86400000),
  'Age starts at initial opening',
);
ok(Date.parse(reopened.updatedAt) >= Date.parse(reopened.createdAt));
eq(om.sessions.total, 3);
eq(om.sessions.nextSevenDays, 3);
eq(om.sessions.hostUnavailable, 1);
eq(om.sessions.attendanceToRecord, 0);
eq(ids(om.sessions.items), Object.values(sessions).sort());
eq(fm.sessions.total, 2);
eq(ids(fm.sessions.items), [sessions.ownerHosted, sessions.facHosted].sort());
eq(
  fm.sessions.items.find((s) => s.id === sessions.ownerHosted).unrecordedAttendance,
  null,
  'Another host roster cannot invent attendance counts',
);
eq(
  om.sessions.items.find((s) => s.id === sessions.ownerHosted).unrecordedAttendance,
  2,
  'Current host eligible roster becomes a count only',
);
eq(om.content.reviewDue, 0);
eq(om.content.reviewDateUnknown, 0);
eq(om.content.reviewSoon, 1);
eq(om.content.awaitingReview, 1);
eq(om.content.approved, 1);
eq(
  ids(om.content.items),
  [content.publication.publicationId, content.inReview.draftId, content.approved.draftId].sort(),
);
for (const u of [a, b, c])
  eq(
    deriveWorkspaceOperations(success(await current(u, id)).team, new Date().toISOString()),
    null,
    'Learner/assessor alone cannot open operations',
  );
eq((await current(nonmember, id)).status, 404, 'Unjoined identity cannot read workspace');
// Existing command authority remains server checked; metadata gives no new role.
eq(
  (await action(a, id, { type: 'assign', kind: 'assessment', targetId: attempts.c, staffId: c.id })).status,
  403,
);
eq((await action(fac, id, { type: 'cohort-status', cohortId: cid, status: 'paused' })).status, 403);
eq(
  (
    await action(owner, id, {
      type: 'assess',
      learnerId: c.id,
      enrollmentId: enrollments.c,
      attemptId: attempts.c,
      scores: [4, 4, 4, 4],
      gates: [true, true, true],
      notes: Array(4).fill('Fictional source reference.'),
      feedback: 'A fictional reference remains subject to independent review.',
    })
  ).status,
  404,
  'Owner queue access is not assessor authority',
);
success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'paused' }));
om = model(success(await current(owner, id)));
fm = model(success(await current(fac, id)));
eq(om.reviews.paused, 2);
eq(fm.reviews.paused, 1);
eq(om.cohorts.find((c) => c.id === cid).newEnrollmentBlocked, true);
eq(om.sessions.total, 3, 'Pause marks existing scheduled observations without inventing cancellation');
eq(om.sessions.items.filter((s) => s.paused).length, 2);
eq(
  (
    await action(fac, id, {
      type: 'assess',
      learnerId: b.id,
      enrollmentId: enrollments.b,
      attemptId: attempts.b,
      scores: [4, 4, 4, 4],
      gates: [true, true, true],
      notes: Array(4).fill('Fictional source reference.'),
      feedback: 'A fictional reference remains subject to independent review.',
    })
  ).status,
  409,
  'Paused review cannot finalize',
);
success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
// Same role, changed scope: cannot retain prior evidence/handler/session scope.
success(
  await action(owner, id, {
    type: 'member',
    userId: fac.id,
    roles: ['facilitator', 'assessor', 'reviewer'],
    scopes: [otherCid],
    active: true,
  }),
);
const changed = success(await current(fac, id));
fm = model(changed);
eq(ids(fm.cohorts), [otherCid]);
eq(fm.reviews.total, 0);
eq(changed.team.assigned, []);
eq(changed.team.support.assigned, []);
eq(ids(fm.support.items), [supports.otherScope]);
eq(ids(fm.sessions.items), [sessions.unavailableHost]);
eq(fm.cohorts[0].reviewPending, 1);
privateExcluded(fm);
eq(
  (
    await action(fac, id, {
      type: 'support-reply',
      requestId: supports.facHandled,
      body: 'Retained stale staff authority must not post a reply.',
    })
  ).status,
  404,
  'Out-of-scope support request is hidden, and cannot be replied to',
);
success(
  await action(owner, id, {
    type: 'member',
    userId: fac.id,
    roles: ['facilitator', 'assessor', 'reviewer'],
    scopes: [otherCid],
    active: false,
  }),
);
const removed = success(await current(fac, id));
eq(removed.team.active, false);
eq(removed.team.roles, []);
eq(removed.team.summaries, []);
eq(removed.team.assigned, []);
eq(removed.team.support.queue, []);
eq(removed.team.network.sessions, []);
eq(deriveWorkspaceOperations(removed.team, new Date().toISOString()), null);
eq(
  (
    await post(
      fac,
      id,
      {
        type: 'session-create',
        cohortId: otherCid,
        title: 'Removed role session',
        description: 'A removed account must not create a synthetic practice session.',
        instructions: 'A fictional instruction remains unavailable.',
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString(),
        capacity: 10,
      },
      removed.revision,
    )
  ).status,
  403,
);
success(
  await action(owner, id, {
    type: 'member',
    userId: fac.id,
    roles: ['facilitator', 'assessor', 'reviewer'],
    scopes: [cid],
    active: true,
  }),
);
success(
  await action(owner, id, { type: 'assign', kind: 'assessment', targetId: attempts.b, staffId: fac.id }),
);
success(await action(fac, id, { type: 'support-claim', requestId: supports.facHandled }));
// A former owner keeps only their own learner/history projection; backup owns
// this mutation and can restore the original fixture for later browser runs.
success(
  await action(backup, id, {
    type: 'member',
    userId: owner.id,
    roles: ['learner'],
    scopes: [],
    active: true,
  }),
);
const former = success(await current(owner, id));
eq(former.team.content, undefined);
eq(former.team.members, undefined);
eq(former.team.pending, undefined);
eq(former.team.assigned, []);
eq(deriveWorkspaceOperations(former.team, new Date().toISOString()), null);
success(
  await action(backup, id, {
    type: 'member',
    userId: owner.id,
    roles: ['admin', 'learner', 'reviewer'],
    scopes: [cid],
    active: true,
  }),
);
success(await action(owner, id, { type: 'assign', kind: 'appeal', targetId: appealId, staffId: owner.id }));
success(await action(owner, id, { type: 'support-claim', requestId: supports.reopened }));
success(await action(owner, id, { type: 'support-claim', requestId: supports.workspacePrivacy }));
writeFileSync(new URL('operations-fixture.json', out), JSON.stringify(f, null, 2));
writeFileSync(
  new URL('operations-api-result.json', out),
  JSON.stringify(
    {
      passed: true,
      assertions: count,
      at: new Date().toISOString(),
      workspace: id,
      source: JSON.parse(readFileSync(new URL('runtime/source.json', out), 'utf8')),
      tested:
        'Actual existing local /api/teams identity projection and pure integrated operations model; no new endpoint assumed.',
    },
    null,
    2,
  ),
);
console.log(`Operations actual local API + model passed ${count} assertions.`);
