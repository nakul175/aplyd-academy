import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRecordCheckRequest,
  assertRecordRevision,
  checkSavedPracticeRecord,
  acceptRecordCheckEnvelope,
  snapshotChecksum,
  RecordResponseError,
} from '../.sites-runtime/record-qa/record-check.mjs';
import {
  p,
  ws,
  time,
  checkedAt,
  owner,
  learner,
  reviewer,
  other,
  personal,
  shared,
  ownBody,
  decisionBody,
  ownExpectation,
  decisionExpectation,
  applyTeamCommand,
  projectTeam,
} from './record-fixtures.mjs';
const row = (state, revision = 8) => ({ data: JSON.stringify(state), revision });
const check = (user, state, body) =>
  checkSavedPracticeRecord({
    user,
    row: state === null ? null : row(state),
    request: parseRecordCheckRequest(body),
    checkedAt,
  });
const own = async (s = personal()) => ({
  s,
  body: ownBody(s),
  envelope: await check(learner, s, ownBody(s)),
  expected: await ownExpectation(s),
});
const mutate = async (envelope, fn, recompute = true) => {
  const clone = structuredClone(envelope);
  fn(clone);
  if (recompute && clone.result.outcome === 'checked')
    clone.result.integrity.checksum = await snapshotChecksum(clone.result.snapshot);
  return clone;
};
test('read request accepts one exact target and trusted revision precondition', () => {
  const r = parseRecordCheckRequest({ workspaceId: null, sourceRevision: 0, recordId: 'record-1' });
  assert.deepEqual(r, { workspaceId: null, sourceRevision: 0, target: { kind: 'record', id: 'record-1' } });
  assert.ok(Object.isFrozen(r.target));
});
test('read request rejects caller authority, extra fields, both/neither targets and unbounded IDs', () => {
  for (const v of [
    { workspaceId: null, sourceRevision: 8 },
    { workspaceId: null, sourceRevision: 8, recordId: 'r', decisionId: 'd' },
    { workspaceId: null, sourceRevision: 8, recordId: 'r', learnerId: 'other' },
    { workspaceId: null, sourceRevision: 8, recordId: 'r', issuer: 'Official' },
    { workspaceId: null, sourceRevision: 8, recordId: 'x'.repeat(121) },
    { workspaceId: null, sourceRevision: 8, recordId: 'r\nother' },
    { workspaceId: null, sourceRevision: 8, recordId: 'r', contentRef: { scope: 'global' } },
  ])
    assert.throws(
      () => parseRecordCheckRequest(v),
      (e) => e.status === 400,
    );
});
test('read request rejects missing workspace/revision, malformed workspace and personal staff decision', () => {
  for (const v of [
    { sourceRevision: 8, recordId: 'r' },
    { workspaceId: null, recordId: 'r' },
    { workspaceId: 'team', sourceRevision: 8, recordId: 'r' },
    { workspaceId: null, sourceRevision: -1, recordId: 'r' },
    { workspaceId: null, sourceRevision: NaN, recordId: 'r' },
    { workspaceId: null, sourceRevision: Number.MAX_SAFE_INTEGER + 1, recordId: 'r' },
    { workspaceId: null, sourceRevision: 8, decisionId: 'd' },
  ])
    assert.throws(
      () => parseRecordCheckRequest(v),
      (e) => e.status === 400,
    );
});
test('revision precondition uses 409 and malformed canonical revision uses 503', () => {
  assert.doesNotThrow(() => assertRecordRevision(8, 8));
  assert.throws(
    () => assertRecordRevision(9, 8),
    (e) => e.status === 409,
  );
  for (const v of [null, '8', NaN, -1])
    assert.throws(
      () => assertRecordRevision(v, 8),
      (e) => e.status === 503,
    );
});
test('actual personal saved record produces detached context-bound envelope and recomputable snapshot', async () => {
  const { envelope, expected, s } = await own();
  const accepted = await acceptRecordCheckEnvelope(envelope, expected);
  assert.equal(accepted.result.snapshot.status, 'active');
  assert.equal(accepted.currentUserId, 'learner');
  assert.equal(accepted.sourceRevision, 8);
  assert.ok(Object.isFrozen(accepted.result.snapshot));
  assert.equal(envelope.result.integrity.checksum, await snapshotChecksum(envelope.result.snapshot));
  assert.ok(!JSON.stringify(accepted).includes('PRIVATE_'));
  assert.equal(s.enrollments[0].record.contentRef, undefined);
});
test('no saved personal row or unknown exact own record uses masked 404', async () => {
  await assert.rejects(
    check(learner, null, { workspaceId: null, sourceRevision: 0, recordId: 'missing' }),
    (e) => e.status === 404,
  );
  const s = personal();
  await assert.rejects(
    check(learner, s, { workspaceId: null, sourceRevision: 8, recordId: 'other-record' }),
    (e) => e.status === 404,
  );
});
test('saved revision mismatch cannot return current status onto an old view', async () => {
  const s = personal();
  await assert.rejects(check(learner, s, ownBody(s, null, 7)), (e) => e.status === 409);
});
test('shared outsider membership is checked before revision comparison; no own or staff lookup', async () => {
  const t = shared(true);
  for (const body of [ownBody(t.learners[0].state, ws, 0), decisionBody(t, 0)])
    await assert.rejects(check(other, t, body), (e) => e.status === 404);
});
test('shared owner cannot check another learner record even with known record ID', async () => {
  const t = shared();
  await assert.rejects(check(owner, t, ownBody(t.learners[0].state, ws)), (e) => e.status === 404);
});
test('inactive member retains own record status and source pin without staff access', async () => {
  let t = shared();
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: 'learner', roles: ['learner'], scopes: [], active: false },
    time(6),
  );
  const s = projectTeam(t, learner).state,
    envelope = await check(learner, t, ownBody(s, ws));
  assert.equal(
    (await acceptRecordCheckEnvelope(envelope, await ownExpectation(s, 'learner', ws))).result.snapshot
      .status,
    'active',
  );
});
test('currently assigned open appeal derives learner server-side and returns only original metadata', async () => {
  const t = shared(true),
    envelope = await check(reviewer, t, decisionBody(t));
  const r = await acceptRecordCheckEnvelope(envelope, await decisionExpectation(t));
  assert.equal(r.result.snapshot.kind, 'private-assigned-original-decision');
  assert.ok(!('recordId' in r.result.snapshot));
  assert.ok(!('status' in r.result.snapshot));
  assert.equal(r.result.snapshot.contentFingerprint, await snapshotChecksum(p));
  assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
});
test('past assessor and owner role do not gain current assigned-original access', async () => {
  const t = shared(true);
  await assert.rejects(check(owner, t, decisionBody(t)), (e) => e.status === 404);
});
test('current scope revocation removes assigned decision lookup without retained assignment authority', async () => {
  let t = shared(true);
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: 'reviewer', roles: ['reviewer'], scopes: [], active: true },
    time(6),
  );
  assert.equal(projectTeam(t, reviewer).team.assigned.length, 0);
  await assert.rejects(check(reviewer, t, decisionBody(t)), (e) => e.status === 404);
});
test('unknown exact pinned version returns unavailable with no substitute status snapshot', async () => {
  const s = personal();
  s.enrollments[0].version = 'unknown';
  s.enrollments[0].contentRef.versionId = 'unknown';
  s.enrollments[0].record.contentVersion = 'unknown';
  const envelope = await check(learner, s, ownBody(s));
  assert.equal(envelope.result.outcome, 'unavailable');
  assert.ok(!('snapshot' in envelope.result));
  const e = await ownExpectation(s);
  assert.equal((await acceptRecordCheckEnvelope(envelope, e)).result.outcome, 'unavailable');
});
test('wrong subject/workspace/revision/target responses are rejected independently of valid checksum', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.currentUserId = 'other'),
    (x) => (x.workspaceId = ws),
    (x) => (x.sourceRevision = 9),
    (x) => (x.target.id = 'different'),
    (x) => (x.target.kind = 'decision'),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('snapshot target/enrollment/exact pin/source fingerprint must match captured canonical view', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.result.snapshot.recordId = 'other'),
    (x) => (x.result.snapshot.enrollmentId = 'other'),
    (x) => (x.result.snapshot.contentRef.versionId = 'newest'),
    (x) => (x.result.snapshot.contentRef.scope = ws),
    (x) => (x.result.snapshot.contentFingerprint = 'f'.repeat(64)),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('envelope/snapshot/decision/integrity extras cannot smuggle evidence even with recomputed checksum', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.learnerName = 'PRIVATE_NAME'),
    (x) => (x.result.snapshot.evidence = 'PRIVATE_EVIDENCE'),
    (x) => (x.result.snapshot.firstPassingDecision.notes = ['PRIVATE_NOTE']),
    (x) => (x.result.snapshot.decisionHistory[0].email = 'PRIVATE_EMAIL'),
    (x) => (x.result.integrity.extra = 'PRIVATE_SECRET'),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('invalid JSON-shaped containers, null nested fields, wrong arrays and unsupported formats fail closed', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.formatVersion = 2),
    (x) => (x.result.snapshot = null),
    (x) => (x.result.integrity = null),
    (x) => (x.result.snapshot.decisionHistory = {}),
    (x) => (x.result.snapshot.exclusions = [null]),
    (x) => (x.result.snapshot.firstPassingDecision.passed = 'true'),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change, false), expected),
      RecordResponseError,
    );
});
test('current saved status cannot acquire accredited classification or issuer authority', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.result.snapshot.classification = 'Accredited certificate'),
    (x) => (x.result.snapshot.issuerAuthority = 'Recognised qualification'),
    (x) => (x.result.integrity.meaning = 'Signed by issuer'),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('status/issuance/effective review chronology cannot disagree even with a recomputed checksum', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.result.snapshot.status = 'suspended'),
    (x) => (x.result.snapshot.issuedAt = time(5)),
    (x) => (x.result.snapshot.effectiveDecision.actorDisplay = 'Other'),
    (x) => (x.result.snapshot.checkedAt = time(56)),
    (x) => (x.result.snapshot.asOfRevision = 9),
    (x) => (x.result.snapshot.hasPendingAssessment = true),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('personal sample identities and modes cannot be promoted to authenticated staff', async () => {
  const { envelope, expected } = await own();
  for (const change of [
    (x) => (x.result.snapshot.decisionHistory[0].actorRef = 'staff'),
    (x) => (x.result.snapshot.decisionHistory[0].mode = 'authenticated assigned assessment'),
    (x) => (x.result.snapshot.firstPassingDecision.actorDisplay = 'Official Issuer'),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('assigned decision cannot disclose record status, change appeal or declare reviewer as original assessor', async () => {
  const t = shared(true),
    envelope = await check(reviewer, t, decisionBody(t)),
    expected = await decisionExpectation(t);
  for (const change of [
    (x) => (x.result.snapshot.status = 'active'),
    (x) => (x.result.snapshot.openAssignedAppealId = 'other-appeal'),
    (x) => (x.result.snapshot.decision.actorRef = 'reviewer'),
    (x) => (x.result.snapshot.decision.kind = 'appeal'),
    (x) => (x.result.snapshot.contentFingerprint = 'f'.repeat(64)),
  ])
    await assert.rejects(
      acceptRecordCheckEnvelope(await mutate(envelope, change), expected),
      RecordResponseError,
    );
});
test('changed export bytes fail integrity; field key order can vary without changing semantic digest', async () => {
  const { envelope, expected } = await own();
  const bad = await mutate(envelope, (x) => (x.result.snapshot.title += ' changed'), false);
  await assert.rejects(acceptRecordCheckEnvelope(bad, expected), RecordResponseError);
  const clone = structuredClone(envelope);
  clone.result.snapshot.firstPassingDecision = Object.fromEntries(
    Object.entries(clone.result.snapshot.firstPassingDecision).reverse(),
  );
  assert.equal((await acceptRecordCheckEnvelope(clone, expected)).result.outcome, 'checked');
});
test('unavailable result is shape-checked and never admits a hidden export snapshot', async () => {
  const { envelope, expected } = await own();
  for (const result of [
    { outcome: 'unavailable', message: 'Contact support.', snapshot: { secret: 'PRIVATE' } },
    { outcome: 'unavailable', message: '' },
    { outcome: 'unavailable', message: 'x'.repeat(1001) },
  ])
    await assert.rejects(acceptRecordCheckEnvelope({ ...envelope, result }, expected), RecordResponseError);
});
test('accepted response detaches from later caller-owned edits', async () => {
  const { envelope, expected } = await own(),
    mutable = structuredClone(envelope);
  const accepted = await acceptRecordCheckEnvelope(mutable, expected);
  mutable.result.snapshot.title = 'Changed afterwards';
  assert.equal(accepted.result.snapshot.title, p.title);
  assert.ok(Object.isFrozen(accepted.target));
});
