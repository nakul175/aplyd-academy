import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lookupOwnPracticeRecord,
  lookupAssignedDecision,
  snapshotChecksum,
  programs,
  currentRef,
  curriculumRegistry,
  createCurriculumRegistry,
  applyCommand,
  freshWorkspace,
  createTeam,
  applyTeamCommand,
  projectTeam,
} from '../.sites-runtime/record-qa/record-check.mjs';
const p = programs[1],
  ws = 'tw-' + 'c'.repeat(24),
  time = (n) => `2026-10-05T19:${String(n).padStart(2, '0')}:00.000Z`,
  checkedAt = time(55);
const C = (
  space = 'personal',
  actorId = 'learner',
  learnerId = 'learner',
  revision = 8,
  content = { registry: curriculumRegistry, allowedScopes: ['global', ws] },
) => ({
  space,
  actorId,
  learnerId,
  workspaceId: space === 'personal' ? null : ws,
  revision,
  checkedAt,
  content,
});
const fields = () =>
  Object.fromEntries(
    p.practicalAssessment.submissionPrompts.map((f) => [
      f.id,
      'PRIVATE_EVIDENCE synthetic task source checks and human approval details.',
    ]),
  );
const review = (type, id, passed = true, actor = type === 'assess' ? 'assessor-a' : 'reviewer-b') => ({
  type,
  enrollmentId: id,
  actor,
  scores: p.practicalAssessment.rubric.map(() => 4),
  gates: p.practicalAssessment.rubric.filter((r) => r.criticalGate).map((_, i) => passed || i !== 0),
  notes: p.practicalAssessment.rubric.map(
    () => 'PRIVATE_NOTES checked evidence and fictional source references.',
  ),
  feedback: 'PRIVATE_FEEDBACK evidence checked carefully against the exact source packet and safety gates.',
});
function prepared() {
  let s = applyCommand(freshWorkspace(), { type: 'enroll', programId: p.id }, time(0));
  const id = s.enrollments[0].id;
  for (const l of p.lessons)
    s = applyCommand(
      s,
      {
        type: 'lesson',
        enrollmentId: id,
        lessonId: l.id,
        practice: 'PRIVATE_PRACTICE fictional source mapping and verification.',
        answers: l.quiz.map((q) => q.correctOptionIndex),
      },
      time(1),
    );
  s = applyCommand(s, { type: 'submit', enrollmentId: id, confirmed: true, fields: fields() }, time(2));
  return s;
}
function assessed() {
  let s = prepared(),
    e = s.enrollments[0];
  return applyCommand(s, { ...review('assess', e.id), attemptId: e.attempts[0].id }, time(3));
}
function appealed(s = assessed()) {
  const e = s.enrollments[0];
  return applyCommand(
    s,
    {
      type: 'appeal',
      enrollmentId: e.id,
      attemptId: e.attempts.at(-1).id,
      reason: 'PRIVATE_APPEAL the source and safety gate merit an independent recheck.',
    },
    time(4),
  );
}
function resolved(s = appealed(), passed = false) {
  const e = s.enrollments[0];
  return applyCommand(s, { ...review('resolve', e.id, passed), appealId: e.appeals.at(-1).id }, time(5));
}
const check = (s, c = C()) => lookupOwnPracticeRecord(s, { recordId: s.enrollments[0].record.id }, c);
const unavailable = async (s) => assert.equal((await check(s)).outcome, 'unavailable');
const alter = (s, fn) => {
  const v = structuredClone(s);
  fn(v.enrollments[0], v);
  return v;
};
const owner = { userId: 'owner', email: 'owner@example.test', fullName: 'Synthetic Owner' },
  learner = { userId: 'learner', email: 'learner@example.test', fullName: 'Synthetic Learner' },
  reviewer = { userId: 'reviewer', email: 'reviewer@example.test', fullName: 'Synthetic Reviewer' },
  owner2 = { userId: 'owner2', email: 'owner2@example.test', fullName: 'Synthetic Second Owner' };
function teamPrepared() {
  let t = createTeam(
    owner,
    {
      name: 'Synthetic nonaccredited workspace',
      purpose: 'Synthetic access boundary fixtures for private records.',
      context: 'msme',
    },
    ws,
    time(0),
  );
  const cmd = (u, c, n = 0) => (t = applyTeamCommand(t, u, c, time(n)));
  cmd(owner, { type: 'cohort-create', title: 'Synthetic practice cohort', programId: p.id, capacity: 3 });
  const cid = t.cohorts[0].id;
  cmd(owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner', 'assessor', 'reviewer'],
    scopes: [cid],
    active: true,
  });
  for (const [u, roles, scopes, h] of [
    [learner, ['learner'], [], 'a'.repeat(64)],
    [reviewer, ['reviewer'], [cid], 'b'.repeat(64)],
    [owner2, ['admin'], [], 'd'.repeat(64)],
  ]) {
    cmd(owner, { type: 'invite', email: u.email, roles, scopes, tokenHash: h });
    cmd(u, { type: 'accept', tokenHash: h });
  }
  cmd(learner, { type: 'enroll', programId: p.id, cohortId: cid });
  const e = t.learners[0].state.enrollments[0];
  for (const l of p.lessons)
    cmd(
      learner,
      {
        type: 'lesson',
        enrollmentId: e.id,
        lessonId: l.id,
        practice: 'PRIVATE_TEAM_PRACTICE with careful source mapping and verification.',
        answers: l.quiz.map((q) => q.correctOptionIndex),
      },
      1,
    );
  cmd(learner, { type: 'submit', enrollmentId: e.id, confirmed: true, fields: fields() }, 2);
  const targetId = t.learners[0].state.enrollments[0].attempts[0].id;
  cmd(owner, { type: 'assign', kind: 'assessment', targetId, staffId: owner.userId }, 2);
  const r = review('assess', e.id);
  delete r.actor;
  cmd(owner, { ...r, learnerId: learner.userId, attemptId: targetId }, 3);
  return t;
}
function teamAppealed() {
  let t = teamPrepared(),
    e = t.learners[0].state.enrollments[0];
  t = applyTeamCommand(
    t,
    learner,
    {
      type: 'appeal',
      enrollmentId: e.id,
      attemptId: e.attempts[0].id,
      reason: 'PRIVATE_TEAM_APPEAL independently check this source and safety decision.',
    },
    time(4),
  );
  e = t.learners[0].state.enrollments[0];
  return applyTeamCommand(
    t,
    owner,
    { type: 'assign', kind: 'appeal', targetId: e.appeals[0].id, staffId: reviewer.userId },
    time(4),
  );
}
const ownTeam = (t) => projectTeam(t, learner).state;
const staffCheck = (t, u = reviewer) =>
  lookupAssignedDecision(
    projectTeam(t, u),
    { decisionId: t.learners[0].state.enrollments[0].attempts[0].decision.id },
    C('shared', u.userId),
  );

test('actual personal pass yields a frozen thin nonaccredited sample status, without mutation', async () => {
  const s = assessed(),
    before = JSON.stringify(s),
    r = await check(s);
  assert.equal(r.outcome, 'checked');
  assert.equal(r.snapshot.status, 'active');
  assert.equal(r.snapshot.classification, 'Nonaccredited practice record');
  assert.equal(r.snapshot.effectiveDecision.actorDisplay, 'Sample Assessor A');
  assert.ok(Object.isFrozen(r.snapshot.decisionHistory));
  assert.equal(JSON.stringify(s), before);
});
test('snapshot excludes all evidence, drafts, notes, feedback, appeal reasons and preference bodies', async () => {
  const s = appealed();
  s.enrollments[0].draft.secret = 'PRIVATE_DRAFT';
  s.learningAccess = { privatePreference: 'PRIVATE_PREF' };
  const r = await check(s),
    text = JSON.stringify(r);
  for (const marker of [
    'PRIVATE_EVIDENCE',
    'PRIVATE_NOTES',
    'PRIVATE_FEEDBACK',
    'PRIVATE_APPEAL',
    'PRIVATE_DRAFT',
    'PRIVATE_PRACTICE',
    'PRIVATE_PREF',
  ])
    assert.ok(!text.includes(marker));
  assert.equal(r.snapshot.hasOpenAppeal, true);
});
test('active record and open appeal are independent observations', async () => {
  const r = await check(appealed());
  assert.equal(r.snapshot.status, 'active');
  assert.equal(r.snapshot.hasOpenAppeal, true);
  assert.equal(r.snapshot.effectiveDecision.kind, 'assessment');
});
test('adverse independent appeal suspends record and preserves initial passing provenance', async () => {
  const s = resolved(),
    r = await check(s);
  assert.equal(r.snapshot.status, 'suspended');
  assert.equal(r.snapshot.hasOpenAppeal, false);
  assert.equal(r.snapshot.firstPassingDecision.passed, true);
  assert.equal(r.snapshot.effectiveDecision.passed, false);
  assert.equal(r.snapshot.decisionHistory.length, 2);
  assert.equal(r.snapshot.issuedAt, time(3));
  assert.equal(r.snapshot.effectiveDecision.actorDisplay, 'Sample Reviewer B');
});
test('a pending retry preserves suspended status and identifies pending work separately', async () => {
  let s = resolved(),
    e = s.enrollments[0];
  s = applyCommand(s, { type: 'submit', enrollmentId: e.id, confirmed: true, fields: fields() }, time(6));
  const r = await check(s);
  assert.equal(r.snapshot.status, 'suspended');
  assert.equal(r.snapshot.hasPendingAssessment, true);
  assert.equal(r.snapshot.effectiveDecision.kind, 'appeal');
});
test('a passing retry reactivates same record, never rewriting initial issue time or old decisions', async () => {
  let s = resolved(),
    e = s.enrollments[0],
    id = e.record.id,
    history = JSON.stringify(e.attempts[0].decision);
  s = applyCommand(s, { type: 'submit', enrollmentId: e.id, confirmed: true, fields: fields() }, time(6));
  e = s.enrollments[0];
  s = applyCommand(s, { ...review('assess', e.id), attemptId: e.attempts[1].id }, time(7));
  const r = await check(s);
  assert.equal(r.snapshot.status, 'active');
  assert.equal(r.snapshot.recordId, id);
  assert.equal(r.snapshot.issuedAt, time(3));
  assert.equal(r.snapshot.effectiveDecision.decidedAt, time(7));
  assert.equal(JSON.stringify(s.enrollments[0].attempts[0].decision), history);
});
test('a passing appeal after an initial fail establishes first issuance at the appeal decision', async () => {
  let s = prepared(),
    e = s.enrollments[0];
  s = applyCommand(s, { ...review('assess', e.id, false), attemptId: e.attempts[0].id }, time(3));
  s = resolved(appealed(s), true);
  const r = await check(s);
  assert.equal(r.snapshot.issuedAt, time(5));
  assert.equal(r.snapshot.firstPassingDecision.kind, 'appeal');
});
test('old active export keeps a valid integrity checksum after current saved record suspends', async () => {
  const a = await check(assessed()),
    s = resolved(),
    b = await check(s);
  assert.equal(await snapshotChecksum(a.snapshot), a.integrity.checksum);
  assert.equal(a.snapshot.status, 'active');
  assert.equal(b.snapshot.status, 'suspended');
  assert.notEqual(a.integrity.checksum, b.integrity.checksum);
  assert.match(a.integrity.meaning, /not a signature/);
});
test('exact revision and check time participate in checksum; key order does not', async () => {
  const s = assessed(),
    a = await check(s),
    b = await check(s, C('personal', 'learner', 'learner', 9));
  assert.notEqual(a.integrity.checksum, b.integrity.checksum);
  assert.equal(await snapshotChecksum({ b: 2, a: 1 }), await snapshotChecksum({ a: 1, b: 2 }));
  assert.notEqual(await snapshotChecksum([1, 2]), await snapshotChecksum([2, 1]));
});
test('hash helper rejects undefined, nonfinite numbers and circular values', async () => {
  for (const x of [undefined, NaN, Infinity, { a: undefined }]) await assert.rejects(snapshotChecksum(x));
  const cycle = {};
  cycle.x = cycle;
  await assert.rejects(snapshotChecksum(cycle));
});
test('another account cannot check learner-owned record and missing IDs use same 404', async () => {
  const s = assessed();
  await assert.rejects(check(s, C('personal', 'other')), (e) => e.status === 404);
  await assert.rejects(lookupOwnPracticeRecord(s, { recordId: 'not-present' }, C()), (e) => e.status === 404);
});
test('request cannot inject actor, trusted scope, issuer or public share permission', async () => {
  const s = assessed();
  for (const key of ['actorId', 'allowedScopes', 'issuer', 'share'])
    await assert.rejects(
      lookupOwnPracticeRecord(s, { recordId: s.enrollments[0].record.id, [key]: true }, C()),
      (e) => e.status === 400,
    );
});
test('unknown explicit pin fails closed while retaining own raw record', async () => {
  const s = alter(assessed(), (e) => {
      e.version = 'unknown';
      e.contentRef.versionId = 'unknown';
      e.record.contentVersion = 'unknown';
    }),
    before = JSON.stringify(s);
  await unavailable(s);
  assert.equal(JSON.stringify(s), before);
});
test('missing version and mixed explicit reference fail closed rather than latest fallback', async () => {
  await unavailable(
    alter(assessed(), (e) => {
      delete e.version;
      delete e.contentRef;
    }),
  );
  await unavailable(
    alter(assessed(), (e) => {
      e.version = 'different';
    }),
  );
});
test('stored title, claims and fingerprint use exact historical registry, not current discovery', async () => {
  const s = assessed(),
    copy = structuredClone(p);
  copy.title = 'New discovery title';
  const newRef = { ...currentRef(p.id), versionId: 'v-future' };
  const registry = createCurriculumRegistry([
    { ref: currentRef(p.id), program: p, language: 'en', audience: 'msme', classification: 'draft' },
    { ref: newRef, program: copy, language: 'en', audience: 'msme', classification: 'draft' },
  ]);
  const r = await check(s, C('personal', 'learner', 'learner', 8, { registry, allowedScopes: ['global'] }));
  assert.equal(r.snapshot.title, p.title);
  assert.deepEqual(r.snapshot.contentRef, currentRef(p.id));
  assert.equal(r.snapshot.contentFingerprint, await snapshotChecksum(p));
});
test('unavailable private scope cannot be promoted by a stored content reference', async () => {
  const s = alter(assessed(), (e) => {
    e.contentRef.scope = ws;
  });
  await unavailable(s);
});
test('cached score/pass disagreement, wrong safety gates and injected decision fields fail closed', async () => {
  for (const mutation of [
    (e) => (e.attempts[0].decision.score = 99),
    (e) => (e.attempts[0].decision.gates[0] = false),
    (e) => (e.attempts[0].decision.private_evidence = 'leak'),
  ])
    await unavailable(alter(assessed(), mutation));
});
test('issuer, classification, title/claim and exact content-version tampering cannot produce validated status', async () => {
  for (const mutation of [
    (e) => (e.record.issuer = 'Recognised issuer'),
    (e) => (e.record.kind = 'Accredited certificate'),
    (e) => (e.record.claim = 'Licensed for professional decisions'),
    (e) => (e.record.title = 'New current title'),
    (e) => (e.record.contentVersion = 'other'),
  ])
    await unavailable(alter(assessed(), mutation));
});
test('personal sample cannot be relabelled as authenticated staff review or acquire shared record metadata', async () => {
  await unavailable(
    alter(assessed(), (e) => (e.attempts[0].decision.mode = 'authenticated assigned assessment')),
  );
  await unavailable(alter(assessed(), (e) => (e.record.reviewedBy = 'Official authority')));
  await unavailable(alter(assessed(), (e) => (e.attempts[0].decision.actor = 'real-staff')));
});
test('stored active/suspended state must agree with latest settled assessment or appeal', async () => {
  await unavailable(alter(resolved(), (e) => (e.record.status = 'active')));
  await unavailable(alter(assessed(), (e) => (e.record.status = 'suspended')));
});
test('future/noncanonical timestamps, altered initial issuance and withdrawal with a record fail closed', async () => {
  for (const mutation of [
    (e) => (e.record.issuedAt = '2027-01-01T00:00:00.000Z'),
    (e) => (e.attempts[0].decision.decidedAt = '2026-10-05T19:03:00Z'),
    (e) => (e.record.issuedAt = time(4)),
    (e) => (e.withdrawn = true),
  ])
    await unavailable(alter(assessed(), mutation));
});
test('duplicate record and decision IDs cannot produce a validated check', async () => {
  const s = assessed();
  s.enrollments.push(structuredClone(s.enrollments[0]));
  await unavailable(s);
  await unavailable(alter(resolved(), (e) => (e.appeals[0].resolution.id = e.attempts[0].decision.id)));
});
test('an active record with forged pending retry is unavailable', async () => {
  await unavailable(
    alter(assessed(), (e) =>
      e.attempts.push({ id: 'forged-attempt', number: 2, submittedAt: time(6), decision: null }),
    ),
  );
});
test('appeal independence and reference order must remain exact', async () => {
  await unavailable(alter(resolved(), (e) => (e.appeals[0].resolution.actor = 'assessor-a')));
  await unavailable(alter(resolved(), (e) => (e.appeals[0].attemptId = 'missing')));
  await unavailable(alter(resolved(), (e) => (e.appeals[0].createdAt = time(1))));
});
test('actual shared assigned assessment checks as nonaccredited with saved reviewer metadata', async () => {
  const t = teamPrepared(),
    r = await check(ownTeam(t), C('shared'));
  assert.equal(r.outcome, 'checked');
  assert.equal(r.snapshot.effectiveDecision.actorRef, owner.userId);
  assert.equal(r.snapshot.effectiveDecision.actorDisplay, owner.fullName);
  assert.equal(
    r.snapshot.issuerAuthority,
    'Workspace display label only; no recognised issuer authority asserted',
  );
  assert.equal(r.snapshot.workspaceId, ws);
});
test('actual current assigned appeal exposes only its original decision metadata', async () => {
  const t = teamAppealed(),
    r = await staffCheck(t);
  assert.equal(r.outcome, 'checked');
  assert.equal(r.snapshot.decision.actorRef, owner.userId);
  assert.equal(r.snapshot.openAssignedAppealId, t.learners[0].state.enrollments[0].appeals[0].id);
  assert.ok(!('status' in r.snapshot));
  assert.ok(!('recordId' in r.snapshot));
  assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
});
test('actual owner role alone and original assessor identity do not grant record check', async () => {
  const t = teamAppealed();
  await assert.rejects(staffCheck(t, owner2), (e) => e.status === 404);
  await assert.rejects(staffCheck(t, owner), (e) => e.status === 404);
});
test('actual role/scope revocation removes assigned decision immediately from projectTeam', async () => {
  let t = teamAppealed();
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: reviewer.userId, roles: ['reviewer'], scopes: [], active: true },
    time(6),
  );
  assert.equal(projectTeam(t, reviewer).team.assigned.length, 0);
  await assert.rejects(staffCheck(t), (e) => e.status === 404);
});
test('actual reassignment replaces current reviewer access, without disclosing to old actor', async () => {
  let t = teamAppealed();
  const cid = t.cohorts[0].id;
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: owner2.userId, roles: ['admin', 'reviewer'], scopes: [cid], active: true },
    time(6),
  );
  t = applyTeamCommand(
    t,
    owner,
    {
      type: 'assign',
      kind: 'appeal',
      targetId: t.learners[0].state.enrollments[0].appeals[0].id,
      staffId: owner2.userId,
    },
    time(6),
  );
  await assert.rejects(staffCheck(t), (e) => e.status === 404);
  assert.equal((await staffCheck(t, owner2)).outcome, 'checked');
});
test('finalizing actual shared appeal removes staff pending access while learner sees current suspension', async () => {
  let t = teamAppealed(),
    e = t.learners[0].state.enrollments[0];
  const r = review('resolve', e.id, false);
  delete r.actor;
  t = applyTeamCommand(t, reviewer, { ...r, learnerId: learner.userId, appealId: e.appeals[0].id }, time(6));
  await assert.rejects(staffCheck(t), (e) => e.status === 404);
  const result = await check(ownTeam(t), C('shared'));
  assert.equal(result.snapshot.status, 'suspended');
  assert.equal(result.snapshot.effectiveDecision.actorRef, reviewer.userId);
});
test('removed learner retains own private history but gets no staff access', async () => {
  let t = teamPrepared();
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: learner.userId, roles: ['learner'], scopes: [], active: false },
    time(6),
  );
  const projection = projectTeam(t, learner);
  assert.equal(projection.team.active, false);
  assert.equal((await check(projection.state, C('shared'))).outcome, 'checked');
  await assert.rejects(staffCheck(t, learner), (e) => e.status === 404);
});
test('shared effective record decision reference, time and actor display must agree', async () => {
  const t = teamPrepared(),
    s = ownTeam(t);
  for (const fn of [
    (e) => (e.record.decisionId = 'other-decision'),
    (e) => (e.record.lastReviewedAt = time(4)),
    (e) => (e.record.reviewedBy = 'Other authority'),
  ])
    assert.equal((await check(alter(s, fn), C('shared'))).outcome, 'unavailable');
});
test('trusted opaque account subjects are not restricted to record-ID syntax', async () => {
  const s = assessed();
  assert.equal((await check(s, C('personal', 'identity|opaque', 'identity|opaque'))).outcome, 'checked');
});

async function privateAssessed() {
  const { workspaceRegistry, requireAvailablePublication } = await import(
    '../.sites-runtime/record-qa/record-check.mjs'
  );
  let t = teamPrepared();
  const action = async (u, c, n = 10) => (t = await applyTeamCommand(t, u, c, time(n))),
    last = () => t.content.drafts.at(-1);
  await action(owner, { type: 'content-copy', sourceRef: currentRef(p.id) });
  let d = last(),
    document = structuredClone(d.document);
  document.title = 'Private exact edition before later revision';
  await action(owner, { type: 'content-save', draftId: d.id, revision: d.revision, document });
  d = last();
  await action(owner, {
    type: 'content-submit',
    draftId: d.id,
    revision: d.revision,
    reviewerId: owner2.userId,
    reviewDueAt: '2027-01-05T19:00:00.000Z',
  });
  d = last();
  await action(owner2, {
    type: 'content-review',
    draftId: d.id,
    revision: d.revision,
    decision: 'approve',
    note: 'Independently checked fictional source facts, rubric, answers and accessible safety boundaries.',
    checks: { sources: true, answers: true, rubric: true, safety: true, accessibility: true },
  });
  d = last();
  await action(owner, { type: 'content-publish', draftId: d.id, revision: d.revision });
  const pub = t.content.publications[0],
    program = pub.snapshot.program;
  await action(owner, {
    type: 'cohort-create',
    title: 'Private publication practice cohort',
    programId: program.id,
    contentRef: pub.snapshot.ref,
    capacity: 2,
  });
  const cid = t.cohorts.at(-1).id;
  await action(owner, {
    type: 'member',
    userId: owner.userId,
    roles: ['admin', 'learner', 'assessor', 'reviewer'],
    scopes: t.cohorts.map((c) => c.id),
    active: true,
  });
  await action(learner, { type: 'enroll', programId: program.id, cohortId: cid });
  let e = t.learners[0].state.enrollments.at(-1);
  for (const l of program.lessons)
    await action(
      learner,
      {
        type: 'lesson',
        enrollmentId: e.id,
        lessonId: l.id,
        practice: 'PRIVATE_LESSON practice source checks and carefully bounded human approval.',
        answers: l.quiz.map((q) => q.correctOptionIndex),
      },
      11,
    );
  await action(
    learner,
    {
      type: 'submit',
      enrollmentId: e.id,
      confirmed: true,
      fields: Object.fromEntries(
        program.practicalAssessment.submissionPrompts.map((f) => [
          f.id,
          'PRIVATE_EVIDENCE checked source references and a careful human review route.',
        ]),
      ),
    },
    12,
  );
  e = t.learners[0].state.enrollments.at(-1);
  await action(
    owner,
    { type: 'assign', kind: 'assessment', targetId: e.attempts[0].id, staffId: owner.userId },
    12,
  );
  const r = review('assess', e.id);
  delete r.actor;
  await action(owner, { ...r, learnerId: learner.userId, attemptId: e.attempts[0].id }, 13);
  const checkPrivate = (t, contextTime = checkedAt) =>
    lookupOwnPracticeRecord(
      projectTeam(t, learner).state,
      { recordId: t.learners[0].state.enrollments.at(-1).record.id },
      {
        ...C('shared'),
        checkedAt: contextTime,
        content: { registry: workspaceRegistry(t), allowedScopes: ['global', ws] },
      },
    );
  return { t, pub, program, checkPrivate, requireAvailablePublication, workspaceRegistry };
}
test('actual private publication retains exact pin and current record check after retirement closes new offers', async () => {
  let { t, pub, program, checkPrivate, requireAvailablePublication } = await privateAssessed();
  const before = await checkPrivate(t);
  t = await applyTeamCommand(
    t,
    owner,
    {
      type: 'content-retire',
      publicationId: pub.id,
      reason: 'Close new offerings while preserving existing learners and exact immutable records.',
    },
    time(14),
  );
  assert.throws(
    () => requireAvailablePublication(t, pub.snapshot.ref, time(15)),
    (e) => e.status === 409,
  );
  const after = await checkPrivate(t);
  assert.equal(after.outcome, 'checked');
  assert.equal(after.snapshot.title, program.title);
  assert.deepEqual(after.snapshot.contentRef, pub.snapshot.ref);
  assert.equal(after.snapshot.contentFingerprint, before.snapshot.contentFingerprint);
});
test('actual content-review due date blocks new offerings without voiding own existing record provenance', async () => {
  const { t, pub, checkPrivate, requireAvailablePublication } = await privateAssessed(),
    future = '2027-01-06T19:00:00.000Z';
  assert.throws(
    () => requireAvailablePublication(t, pub.snapshot.ref, future),
    (e) => e.status === 409,
  );
  assert.equal((await checkPrivate(t, future)).outcome, 'checked');
});
test('actual new private publication never substitutes title, rubric or claim in prior record check', async () => {
  let { t, pub, program, checkPrivate } = await privateAssessed();
  const act = async (u, c) => (t = await applyTeamCommand(t, u, c, time(15))),
    last = () => t.content.drafts.at(-1);
  await act(owner, { type: 'content-copy', sourceRef: pub.snapshot.ref });
  let d = last(),
    document = structuredClone(d.document);
  document.title = 'New private edition must not replace saved title';
  document.practicalAssessment.rubric[0].dimension = 'New edition dimension';
  await act(owner, { type: 'content-save', draftId: d.id, revision: d.revision, document });
  d = last();
  await act(owner, {
    type: 'content-submit',
    draftId: d.id,
    revision: d.revision,
    reviewerId: owner2.userId,
    reviewDueAt: '2027-01-05T19:00:00.000Z',
  });
  d = last();
  await act(owner2, {
    type: 'content-review',
    draftId: d.id,
    revision: d.revision,
    decision: 'approve',
    note: 'Checked the revised fictional title and rubric without changing prior publications.',
    checks: { sources: true, answers: true, rubric: true, safety: true, accessibility: true },
  });
  d = last();
  await act(owner, { type: 'content-publish', draftId: d.id, revision: d.revision });
  assert.equal(t.content.publications.length, 2);
  const result = await checkPrivate(t);
  assert.equal(result.outcome, 'checked');
  assert.equal(result.snapshot.title, program.title);
  assert.deepEqual(result.snapshot.contentRef, pub.snapshot.ref);
  assert.equal(result.snapshot.contentFingerprint, await snapshotChecksum(program));
});
test('saved completion requires all exact-pinned lesson IDs once, without newest lesson substitution', async () => {
  for (const mutation of [
    (e) => e.completed.pop(),
    (e) => (e.completed[1] = e.completed[0]),
    (e) => (e.completed[0] = 'newer-lesson'),
  ])
    await unavailable(alter(assessed(), mutation));
});
test('actual projected staff decision also fails closed on malformed stored appeal chronology or cached score', async () => {
  for (const change of [
    (e) => (e.appeals[0].createdAt = time(1)),
    (e) => (e.attempts[0].decision.score = 99),
    (e) => (e.appeals[0].resolution = { private_evidence: 'PRIVATE_INJECTED' }),
  ]) {
    const t = teamAppealed();
    change(t.learners[0].state.enrollments[0]);
    assert.equal((await staffCheck(t)).outcome, 'unavailable');
  }
});
