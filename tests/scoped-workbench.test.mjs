import { canonical, canonicalPattern } from './support/source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const app = path.resolve(process.env.ACADEMY_APP_PATH ?? '.'),
  runtime = path.resolve(
    process.env.ACADEMY_SCOPED_RUNTIME ?? path.join(app, '.sites-runtime/scoped-workbench/runtime.mjs'),
  );
const {
  freshWorkspace,
  applyCommand,
  RuleError,
  programs,
  grantStatus,
  readTestGrants,
  readTestReceipts,
  validateReturnPayload,
  AdapterError,
  personalSizing,
  ensurePersonalSizing,
  PersonalSizingError,
  createTeam,
  applyTeamCommand,
  SCOPED_LIMITS,
  WITHDRAWAL_GROWTH_BYTES,
} = await import(pathToFileURL(runtime));
const NOW = '2026-10-05T10:00:00.000Z',
  LATER = '2026-10-05T10:01:00.000Z',
  DAY = 86400000;
const domain = (s, c, now = NOW) => applyCommand(s, c, now);
const apply = (s, c, now = NOW) => {
  const after = domain(s, c, now);
  ensurePersonalSizing(after);
  return after;
};
const reject = (fn, status) =>
  assert.throws(
    fn,
    (e) =>
      (e instanceof RuleError || e instanceof PersonalSizingError || e instanceof AdapterError) &&
      e.status === status,
  );
function learning() {
  let s = freshWorkspace();
  for (const p of programs) s = apply(s, { type: 'enroll', programId: p.id });
  return s;
}
const grant = (s, partner = 'msme', scopes = ['learning.progress'], days = 7, now = NOW) =>
  apply(
    s,
    {
      type: 'ecosystem-grant',
      partner,
      enrollmentId: s.enrollments.find(
        (e) =>
          e.programId === { agri: programs[0].id, msme: programs[1].id, public: programs[2].id }[partner],
      )?.id,
      scopes,
      durationDays: days,
    },
    now,
  );
const run = (s, id = s.ecosystemGrants[0].id, now = NOW) =>
  apply(s, { type: 'ecosystem-test', grantId: id }, now);
const withdraw = (s, id = s.ecosystemGrants[0].id, now = LATER) =>
  apply(s, { type: 'ecosystem-withdraw', grantId: id }, now);
function reviewed() {
  let s = learning(),
    e = s.enrollments[1],
    p = programs[1];
  for (const l of p.lessons)
    s = apply(s, {
      type: 'lesson',
      enrollmentId: e.id,
      lessonId: l.id,
      practice: 'Fictional checked source note with human verification before use.',
      answers: l.quiz.map((q) => q.correctOptionIndex),
    });
  s = apply(s, {
    type: 'submit',
    enrollmentId: e.id,
    confirmed: true,
    fields: Object.fromEntries(
      p.practicalAssessment.submissionPrompts.map((f) => [
        f.id,
        'PRIVATE-CANARY Evidence for a fictional response, facts and human approval.',
      ]),
    ),
  });
  s = apply(s, {
    type: 'assess',
    enrollmentId: e.id,
    attemptId: s.enrollments[1].attempts[0].id,
    actor: 'assessor-a',
    scores: p.practicalAssessment.rubric.map(() => 4),
    gates: p.practicalAssessment.rubric.filter((r) => r.criticalGate).map(() => true),
    notes: p.practicalAssessment.rubric.map(() => 'PRIVATE-CANARY checked submitted field'),
    feedback: 'PRIVATE-CANARY Careful evidence with fictional sources and explicit human approval.',
  });
  return s;
}
function fillTo(s, target) {
  let i = 0;
  const chunk = '\u0000"\\\n😀'.repeat(350);
  while (target - personalSizing(s).effectiveBytes > 8000) {
    s = apply(s, {
      type: 'post',
      title: 'Fictional capacity source ' + String(i++).padStart(3, '0'),
      body: chunk,
    });
    assert.ok(s.posts.length < 200);
  }
  while (target - personalSizing(s).effectiveBytes > 3200)
    s = apply(s, { type: 'post', title: 'Fictional capacity padding', body: 'x'.repeat(2800) });
  const small = domain(s, { type: 'post', title: 'Fictional exact capacity', body: 'x'.repeat(30) }),
    overhead = personalSizing(small).effectiveBytes - personalSizing(s).effectiveBytes - 30,
    len = target - personalSizing(s).effectiveBytes - overhead;
  assert.ok(len >= 20 && len <= 3000, { len });
  s = apply(s, { type: 'post', title: 'Fictional exact capacity', body: 'x'.repeat(len) });
  assert.equal(personalSizing(s).effectiveBytes, target);
  return s;
}
for (const [partner, index] of [
  ['agri', 0],
  ['msme', 1],
  ['public', 2],
])
  test('actual integrated command creates exact mapped global choice for ' + partner, () => {
    const s = grant(learning(), partner),
      g = s.ecosystemGrants[0];
    assert.deepEqual(g.contentRef, s.enrollments[index].contentRef);
    assert.equal(g.contentVersion, s.enrollments[index].version);
    assert.equal(g.durationDays, 7);
    assert.equal(Date.parse(g.expiresAt) - Date.parse(g.createdAt), 7 * DAY);
    assert.match(g.id, /^[a-f0-9-]{36}$/);
    assert.equal(g.revokedAt, null);
    assert.equal(g.purpose, 'local-return-contract-review');
  });
test('exact command duration allowlist and server timestamp exclude caller refs/expiry/actor', () => {
  const s = learning(),
    base = {
      type: 'ecosystem-grant',
      partner: 'msme',
      enrollmentId: s.enrollments[1].id,
      scopes: ['learning.progress'],
    };
  for (const durationDays of [0, 2, 31, '7', null]) reject(() => apply(s, { ...base, durationDays }), 422);
  for (const key of ['actor', 'owner', 'payload', 'grantId', 'expiresAt', 'contentRef', 'createdAt'])
    reject(() => apply(s, { ...base, durationDays: 7, [key]: 'forged' }), 400);
  for (const days of [1, 7, 30])
    assert.equal(
      Date.parse(grant(s, 'msme', undefined, days).ecosystemGrants[0].expiresAt) - Date.parse(NOW),
      days * DAY,
    );
});
test('Health and all six cross-mapping combinations reject, Boolean preferences never create choice authority', () => {
  const s = learning();
  reject(
    () =>
      apply(s, {
        type: 'ecosystem-grant',
        partner: 'health',
        enrollmentId: s.enrollments[1].id,
        scopes: ['learning.progress'],
        durationDays: 7,
      }),
    409,
  );
  for (const [partner, index] of [
    ['agri', 0],
    ['msme', 1],
    ['public', 2],
  ])
    for (let j = 0; j < 3; j++)
      if (j !== index)
        reject(
          () =>
            apply(s, {
              type: 'ecosystem-grant',
              partner,
              enrollmentId: s.enrollments[j].id,
              scopes: ['learning.progress'],
              durationDays: 7,
            }),
          409,
        );
  const old = apply(s, { type: 'connection', partner: 'msme', enabled: true });
  assert.equal(old.ecosystemGrants, undefined);
  reject(() => apply(old, { type: 'ecosystem-test', grantId: 'boolean-preference' }), 404);
});
test('scopes reject empty/duplicate/unsupported values and preserve explicit canonical field order', () => {
  for (const scopes of [
    [],
    ['learning.progress', 'learning.progress'],
    ['evidence'],
    ['practice.record', 'profile'],
  ])
    reject(() => grant(learning(), 'msme', scopes), 422);
  assert.deepEqual(
    grant(learning(), 'msme', ['practice.record', 'learning.progress']).ecosystemGrants[0].scopes,
    ['learning.progress', 'practice.record'],
  );
});
for (const scopes of [['learning.progress'], ['practice.record'], ['learning.progress', 'practice.record']])
  test('actual scoped receipt includes only explicit selected fields ' + scopes.join('+'), () => {
    const s = run(grant(learning(), 'msme', scopes)),
      r = s.ecosystemReceipts[0];
    assert.equal(r.status, 'simulated');
    assert.equal(r.payload.mode, 'local-test');
    assert.equal(Object.hasOwn(r.payload, 'learning'), scopes.includes('learning.progress'));
    assert.equal(Object.hasOwn(r.payload, 'practice_record'), scopes.includes('practice.record'));
    validateReturnPayload(r.payload);
    assert.ok(!JSON.stringify(r).includes('Learner'));
    assert.equal(r.grantId, s.ecosystemGrants[0].id);
  });
test('receipt excludes actual own evidence/score/note/plan/reflection canaries', () => {
  let s = reviewed();
  s = apply(s, { type: 'learning-plan', personalGoal: 'PRIVATE-CANARY personal target' });
  s = apply(s, {
    type: 'followup',
    enrollmentId: s.enrollments[1].id,
    reflection: 'PRIVATE-CANARY private reflection about permitted fictional work.',
  });
  s.profile.name = 'PRIVATE-CANARY identity';
  s = run(grant(s, 'msme', ['learning.progress', 'practice.record']));
  const json = JSON.stringify(s.ecosystemReceipts);
  assert.ok(!json.includes('PRIVATE-CANARY'));
  for (const field of ['scores', 'feedback', 'actorName', 'fields', 'reflection', 'email', 'learner_ref'])
    assert.ok(!json.includes('"' + field + '"'));
  assert.equal(s.ecosystemReceipts[0].payload.practice_record.claim_type, 'nonaccredited-practice');
  assert.equal(s.ecosystemReceipts[0].payload.practice_record.review_mode, 'sample-workflow');
});
test('actual adverse appeal updates fresh status while original local receipt remains historical', () => {
  let s = run(grant(reviewed(), 'msme', ['practice.record']));
  const old = structuredClone(s.ecosystemReceipts[0]),
    e = s.enrollments[1],
    p = programs[1];
  s = apply(
    s,
    {
      type: 'appeal',
      enrollmentId: e.id,
      attemptId: e.attempts[0].id,
      reason: 'Independent review of a fictional safety gate is requested.',
    },
    LATER,
  );
  s = run(s, undefined, LATER);
  assert.equal(s.ecosystemReceipts[0].payload.practice_record.status, 'active');
  s = apply(
    s,
    {
      type: 'resolve',
      enrollmentId: e.id,
      appealId: s.enrollments[1].appeals[0].id,
      actor: 'reviewer-b',
      scores: p.practicalAssessment.rubric.map(() => 0),
      gates: p.practicalAssessment.rubric.filter((r) => r.criticalGate).map(() => false),
      notes: p.practicalAssessment.rubric.map(
        () => 'The fictional evidence misses the independent critical check.',
      ),
      feedback:
        'A critical factual check was not demonstrated; revise this fictional response before acting.',
    },
    LATER,
  );
  s = run(s, undefined, LATER);
  assert.equal(s.ecosystemReceipts[0].payload.practice_record.status, 'suspended');
  assert.deepEqual(s.ecosystemReceipts.at(-1), old);
});
test('expiry exactly at boundary and withdrawal deny future tests without deleting receipts', () => {
  let s = run(grant(learning(), 'msme', undefined, 1));
  const history = structuredClone(s.ecosystemReceipts),
    expiry = s.ecosystemGrants[0].expiresAt;
  reject(() => run(s, undefined, expiry), 403);
  s = withdraw(s);
  reject(() => run(s, undefined, LATER), 403);
  assert.deepEqual(s.ecosystemReceipts, history);
  assert.equal(withdraw(s).ecosystemGrants[0].revokedAt, LATER);
});
test('new same-partner choice explicitly withdraws predecessor and keeps one active choice', () => {
  let s = grant(learning()),
    old = s.ecosystemGrants[0];
  s = grant(s, 'msme', ['practice.record'], 30, LATER);
  assert.equal(s.ecosystemGrants.length, 2);
  assert.equal(s.ecosystemGrants[1].revokedAt, LATER);
  assert.equal(s.ecosystemGrants[1].id, old.id);
  assert.equal(s.ecosystemGrants.filter((g) => grantStatus(g, LATER) === 'active').length, 1);
  reject(() => run(s, old.id, LATER), 403);
});
test('choices are own enrollment references, cannot access another owner ID or inject selector fields', () => {
  const a = grant(learning()),
    b = learning();
  reject(
    () =>
      apply(b, {
        type: 'ecosystem-grant',
        partner: 'msme',
        enrollmentId: a.enrollments[1].id,
        scopes: ['learning.progress'],
        durationDays: 7,
      }),
    404,
  );
  reject(() => run(b, a.ecosystemGrants[0].id), 404);
  reject(() => withdraw(b, a.ecosystemGrants[0].id), 404);
  reject(
    () => apply(a, { type: 'ecosystem-test', grantId: a.ecosystemGrants[0].id, learnerId: 'other' }),
    400,
  );
  reject(
    () => apply(a, { type: 'ecosystem-withdraw', grantId: a.ecosystemGrants[0].id, actor: 'other' }),
    400,
  );
});
for (const mutation of ['unknown', 'mixed', 'missing', 'private', 'inventedLesson', 'duplicateLesson'])
  test('trusted actual resolver rejects ' + mutation + ' saved pin/progress', () => {
    const s = learning(),
      e = s.enrollments[1];
    if (mutation === 'unknown') {
      e.version = 'unknown';
      e.contentRef.versionId = 'unknown';
    }
    if (mutation === 'mixed') e.version = 'unknown';
    if (mutation === 'missing') {
      delete e.version;
      delete e.contentRef;
    }
    if (mutation === 'private') e.contentRef.scope = 'tw-private';
    if (mutation === 'inventedLesson') e.completed = ['invented'];
    if (mutation === 'duplicateLesson') e.completed = [programs[1].lessons[0].id, programs[1].lessons[0].id];
    assert.throws(
      () => grant(s),
      (e) => e instanceof RuleError,
    );
  });
test('testing rechecks exact pinned content even after choice exists; withdrawal remains possible', () => {
  const s = grant(learning()),
    e = s.enrollments[1];
  e.version = 'missing';
  e.contentRef.versionId = 'missing';
  reject(() => run(s), 409);
  assert.equal(withdraw(s).ecosystemGrants[0].revokedAt, LATER);
});
test('paused/withdrawn own learning blocks grant/test but does not block protective withdrawal', () => {
  for (const state of ['paused', 'withdrawn']) {
    const s = grant(learning());
    if (state === 'paused') s.paused = [programs[1].id];
    else s.enrollments[1].withdrawn = true;
    reject(() => run(s), 409);
    reject(() => grant(s), 409);
    assert.equal(withdraw(s).ecosystemGrants[0].revokedAt, LATER);
  }
});
test('shared Team actual dispatcher rejects all three workbench commands for current owner', () => {
  const owner = { userId: 'fixture-owner', email: 'owner@fixture.test', fullName: 'Owner' },
    t = createTeam(
      owner,
      { name: 'Scoped refusal fixture', purpose: 'Test personal-only command boundary.', context: 'msme' },
      'tw-11111111-1111-1111-1111-111111111111',
      NOW,
    );
  for (const c of [
    {
      type: 'ecosystem-grant',
      partner: 'msme',
      enrollmentId: 'x',
      scopes: ['learning.progress'],
      durationDays: 7,
    },
    { type: 'ecosystem-test', grantId: 'x' },
    { type: 'ecosystem-withdraw', grantId: 'x' },
  ])
    reject(() => applyTeamCommand(t, owner, c, NOW), 400);
});
test('legacy values and historical receipts stay unchanged; new legacy deliver requires explicit renewal', () => {
  let s = learning();
  s.connections = { msme: true, health: true };
  s.deliveries = [
    {
      id: 'historical-health',
      partner: 'health',
      createdAt: NOW,
      payload: { learner_ref: 'earlier-local-reference' },
      note: 'Historical simulation',
    },
  ];
  const before = structuredClone({ connections: s.connections, deliveries: s.deliveries });
  s = run(grant(s));
  assert.deepEqual({ connections: s.connections, deliveries: s.deliveries }, before);
  reject(() => apply(s, { type: 'deliver', partner: 'msme', enrollmentId: s.enrollments[1].id }), 409);
  s = apply(s, { type: 'connection', partner: 'health', enabled: false });
  assert.equal(s.connections.health, false);
  assert.deepEqual(s.deliveries, before.deliveries);
});
test('grant and receipt retained caps do not block withdrawal or erase history', () => {
  let s = learning();
  for (let i = 0; i < 24; i++) s = grant(s);
  reject(() => grant(s), 409);
  assert.equal(withdraw(s).ecosystemGrants.length, 24);
  s = grant(learning());
  for (let i = 0; i < 100; i++) s = run(s);
  reject(() => run(s), 409);
  assert.equal(withdraw(s).ecosystemReceipts.length, 100);
});
test('strict saved choice and runtime payload refuse malformed/extraneous data', () => {
  const s = run(grant(learning()));
  for (const change of [
    { expiresAt: '2026-10-06T10:00:00Z' },
    { revokedAt: 'unsafe' },
    { contentRef: { scope: 'global', programId: 'other', versionId: s.ecosystemGrants[0].contentVersion } },
    { durationDays: 2 },
    { actor: 'forged' },
  ])
    reject(
      () => readTestGrants([{ ...s.ecosystemGrants[0], ...change }]),
      change.actor ? 400 : change.durationDays || change.contentRef ? 409 : 422,
    );
  const payload = { ...s.ecosystemReceipts[0].payload, evidence: 'private' };
  reject(() => validateReturnPayload(payload), 422);
});
test('canonical withdrawal closure is exactly22 bytes, reserved for every null including expired choice', () => {
  let s = grant(learning(), 'msme', undefined, 1);
  const before = personalSizing(s);
  assert.equal(before.reservedBytes, 22);
  const after = personalSizing(withdraw(s));
  assert.equal(after.actualBytes - before.actualBytes, WITHDRAWAL_GROWTH_BYTES);
  assert.equal(after.effectiveBytes, before.effectiveBytes);
  assert.equal(after.reservedBytes, 0);
  assert.equal(personalSizing(s).reservedBytes, 22);
  const expired = withdraw(s, undefined, '2026-10-07T10:00:00.000Z');
  assert.equal(personalSizing(expired).effectiveBytes, before.effectiveBytes);
});
test('actual near-cap state with JSON escaping and Unicode can withdraw every current choice at exact1MB', () => {
  let s = learning();
  for (const partner of ['agri', 'msme', 'public']) s = grant(s, partner);
  s = fillTo(s, 1000000);
  const before = personalSizing(s);
  assert.equal(before.reservedBytes, 66);
  assert.ok(JSON.stringify(s).includes('\\u0000'));
  for (const g of s.ecosystemGrants) s = withdraw(s, g.id);
  const after = personalSizing(s);
  assert.equal(after.actualBytes, 1000000);
  assert.equal(after.reservedBytes, 0);
  assert.equal(after.effectiveBytes, before.effectiveBytes);
});
test('all other personal growth, including early-return plan path, must respect choice closure reserve', () => {
  let s = fillTo(grant(learning()), 1000000);
  assert.equal(personalSizing(s).actualBytes, 999978);
  const commands = [
    { type: 'learning-plan', personalGoal: 'A permitted personal learning goal that adds state.' },
    { type: 'plan-task', kind: 'practice', title: 'A fictional additional work practice' },
    {
      type: 'post',
      title: 'Extra fictional post',
      body: 'A fictional checked message with no private information.',
    },
    { type: 'profile', ...s.profile, name: 'A longer synthetic learner display name' },
  ];
  for (const c of commands) reject(() => apply(s, c), 413);
  const after = withdraw(s);
  ensurePersonalSizing(after);
  assert.equal(personalSizing(after).effectiveBytes, 1000000);
});
test('exact effective boundary accepts, one escaped growth byte over rejects; reset removes choices explicitly', () => {
  const s = fillTo(grant(learning()), 1000000);
  ensurePersonalSizing(s);
  const changed = structuredClone(s);
  changed.posts[0].body += 'x';
  reject(() => ensurePersonalSizing(changed), 413);
  const reset = apply(s, { type: 'reset' });
  assert.equal(reset.ecosystemGrants, undefined);
  assert.ok(personalSizing(reset).effectiveBytes < 1000000);
});
test('actual integrated personal API applies the unified sizing check after every domain action before durable update', () => {
  const api = fs.readFileSync(path.join(app, 'app/api/academy/route.ts'), 'utf8');
  assert.match(
    canonical(api),
    canonicalPattern(
      /const state=applyCommand\(x.state,input.command\);try\{ensurePersonalSizing\(state\)\}/,
    ),
  );
  assert.ok(
    canonical(api).indexOf(canonical('ensurePersonalSizing(state)')) <
      canonical(api).indexOf(canonical('const update=')),
  );
  assert.doesNotMatch(canonical(api), canonicalPattern(/JSON.stringify\(state\)\)\.length>1000000/));
  assert.match(
    canonical(api),
    canonicalPattern(/PersonalSizingError\)throw new RuleError\(e.message,e.status\)/),
  );
});
test('corrupt duplicate current partner choices fail closed, while each protective withdrawal remains possible', () => {
  let s = grant(learning()),
    second = { ...structuredClone(s.ecosystemGrants[0]), id: 'duplicate-active-fixture' };
  s.ecosystemGrants.push(second);
  reject(() => run(s), 409);
  reject(() => grant(s), 409);
  s = withdraw(s, second.id);
  s = run(s, undefined, LATER);
  assert.equal(s.ecosystemReceipts.length, 1);
  assert.equal(s.ecosystemGrants[1].revokedAt, LATER);
});
test('all24 retained null choices reserve528 bytes including expired history and close at exact1MB', () => {
  let s = grant(learning(), 'msme', undefined, 1),
    template = s.ecosystemGrants[0];
  s.ecosystemGrants = Array.from({ length: 24 }, (_, i) => ({
    ...structuredClone(template),
    id: 'expired-choice-' + String(i).padStart(2, '0'),
    createdAt: '2026-10-01T10:00:00.000Z',
    expiresAt: '2026-10-02T10:00:00.000Z',
  }));
  assert.ok(s.ecosystemGrants.every((g) => grantStatus(g, NOW) === 'expired'));
  s = fillTo(s, 1000000);
  assert.equal(personalSizing(s).reservedBytes, 528);
  const before = personalSizing(s);
  for (const g of s.ecosystemGrants) s = withdraw(s, g.id);
  const after = personalSizing(s);
  assert.equal(after.actualBytes, 1000000);
  assert.equal(after.actualBytes - before.actualBytes, 528);
  assert.equal(after.reservedBytes, 0);
  assert.equal(after.effectiveBytes, before.effectiveBytes);
});

test('legacy preview still rejects injected fields400 before explicit-choice409 guidance', () => {
  const s = learning();
  for (const key of ['payload', 'actor', 'scopes', 'grantId', 'url'])
    reject(
      () =>
        apply(s, { type: 'deliver', partner: 'msme', enrollmentId: s.enrollments[1].id, [key]: 'injected' }),
      400,
    );
});

test('strict saved receipt read refuses private extra fields, mismatched identities and duplicate/oversized history', () => {
  const s = run(grant(learning())),
    r = s.ecosystemReceipts[0],
    cases = [
      { payload: { ...r.payload, private_evidence: 'PRIVATE-RECEIPT-CANARY' } },
      { id: 'other-event' },
      { enrollmentId: 'other-enrollment' },
      { partner: 'agri' },
      { contractVersion: 'other-contract' },
      { createdAt: LATER },
      { grantId: 'other-grant' },
      { payload: { ...r.payload, occurred_at: '2026-10-05T10:00:00Z' } },
      { payload: { ...r.payload, scopes: ['practice.record'] } },
    ];
  for (const change of cases) {
    const bad = structuredClone(s);
    bad.ecosystemReceipts = [{ ...r, ...change }];
    reject(() => readTestReceipts(bad.ecosystemReceipts, bad.ecosystemGrants), 409);
    reject(() => run(bad), 409);
    reject(() => grant(bad), 409);
    assert.deepEqual(bad.ecosystemReceipts, [{ ...r, ...change }]);
  }
  reject(() => readTestReceipts([r, r], s.ecosystemGrants), 409);
  reject(() => readTestReceipts(Array(101).fill(r), s.ecosystemGrants), 409);
  assert.deepEqual(readTestReceipts(s.ecosystemReceipts, s.ecosystemGrants), s.ecosystemReceipts);
});
test('malformed own receipt is unavailable authority but raw sizing and valid protective withdrawal remain possible', () => {
  let s = run(grant(learning()));
  s.ecosystemReceipts[0].payload.private_evidence = 'PRIVATE-RECEIPT-CANARY';
  const before = structuredClone(s.ecosystemReceipts),
    size = personalSizing(s);
  assert.equal(size.receiptHistoryValid, false);
  ensurePersonalSizing(s);
  s = withdraw(s);
  assert.equal(s.ecosystemGrants[0].revokedAt, LATER);
  assert.deepEqual(s.ecosystemReceipts, before);
  assert.equal(personalSizing(s).effectiveBytes, size.effectiveBytes);
  assert.ok(JSON.stringify(s).includes('PRIVATE-RECEIPT-CANARY'));
  reject(() => run(s), 409);
});
test('future existing withdrawal refuses rather than claiming success; past legitimate withdrawal is idempotent', () => {
  const s = grant(learning());
  s.ecosystemGrants[0].revokedAt = '2026-10-06T10:00:00.000Z';
  reject(() => withdraw(s, undefined, LATER), 409);
  const past = withdraw(grant(learning()), undefined, LATER),
    again = withdraw(past, undefined, '2026-10-05T10:02:00.000Z');
  assert.equal(again.ecosystemGrants[0].revokedAt, LATER);
});
