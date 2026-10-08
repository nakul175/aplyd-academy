import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
const runtime = new URL(
  process.env.ACADEMY_READINESS_RUNTIME ?? '../.sites-runtime/partner-readiness-qa/readiness.mjs',
  import.meta.url,
);
const compilation = JSON.parse(readFileSync(new URL('./compilation-evidence.json', runtime), 'utf8'));
if (!compilation.passed)
  throw new Error('Readiness runtime compilation must pass before pure evidence is collected.');
const {
  derivePartnerInspection: inspect,
  buildPartnerDiscussionBrief: brief,
  applyCommand,
  freshWorkspace,
  programs,
  CONTENT_VERSION,
  ONBOARDING_QUESTIONS,
  readTestGrants,
  readTestReceipts,
} = await import(runtime.href);
const now = '2030-01-01T12:00:00.000Z',
  later = '2030-01-01T13:00:00.000Z';
const cases = [];
function run(name, fn) {
  test(name, () => {
    fn();
    cases.push(name);
  });
}
function command(s, c, time = now) {
  return applyCommand(s, c, time);
}
function fixture(partner = 'msme', scopes = ['learning.progress', 'practice.record']) {
  const pathway = {
    agri: 'farmer-work-records',
    msme: 'msme-customer-operations',
    public: 'public-servant-source-briefs',
  }[partner];
  let s = command(freshWorkspace(), { type: 'enroll', programId: pathway });
  s = command(s, {
    type: 'ecosystem-grant',
    partner,
    enrollmentId: s.enrollments[0].id,
    scopes,
    durationDays: 1,
  });
  return s;
}
const view = (s, partner = 'msme', time = now, workspace = 'lab') =>
  inspect({ workspace, state: s, now: time }, partner);
function localOnly(m) {
  assert.equal(m.liveExchangeEnabled, false);
  assert.equal(m.recipientConnected, false);
  assert.equal(m.authorizesDelivery, false);
  assert.equal(m.authorizesLocalTest, false);
  assert.equal(m.clockBasis, 'informational-only');
}
run('Fresh lab has no inferred choice or permission', () => {
  const m = view(freshWorkspace());
  localOnly(m);
  assert.equal(m.localReadiness, 'no-choice');
  assert.equal(m.choice, null);
  assert.equal(m.summary, null);
  assert.equal(m.history.receipts, 0);
});
run('Legacy Boolean and earlier payload never become scoped choice', () => {
  const s = freshWorkspace();
  s.connections.msme = true;
  s.deliveries = [{ id: 'earlier', payload: { recipient: 'PRIVATE-LEGACY' } }];
  const m = view(s);
  assert.equal(m.legacyPreference, true);
  assert.equal(m.choice, null);
  assert.equal(m.summary, null);
  assert.ok(!JSON.stringify(m).includes('PRIVATE-LEGACY'));
});
run('Each available adapter has only its exact mapped saved learning', () => {
  for (const a of ['agri', 'msme', 'public']) {
    const m = view(fixture(a), a);
    localOnly(m);
    assert.equal(m.localReadiness, 'inspectable');
    assert.equal(m.choice.contentVersion, CONTENT_VERSION);
    assert.equal(m.summary.learning.completed_lessons, 0);
    assert.equal(m.summary.practice_record.status, 'not-issued');
  }
});
run('Health stays unconfigured with no summary, even legacy true', () => {
  const s = freshWorkspace();
  s.connections.health = true;
  const m = view(s, 'health');
  localOnly(m);
  assert.equal(m.state, 'domain-review-needed');
  assert.equal(m.choice, null);
  assert.equal(m.summary, null);
  assert.equal(m.legacyPreference, true);
  assert.equal(m.history.state, 'not-inspected');
  assert.deepEqual(brief('health').supportedLocalSummaryFields, []);
});
run('Shared view does not traverse or retain private supplied state', () => {
  const s = new Proxy(
    {},
    {
      get() {
        throw new Error('Private traversal');
      },
    },
  );
  const m = view(s, 'msme', now, 'tw-synthetic');
  assert.equal(m.state, 'shared-unavailable');
  assert.equal(m.choice, null);
  assert.equal(m.history.state, 'not-inspected');
  localOnly(m);
});
run('Progress-only summary excludes practice record and private fields', () => {
  const s = fixture('msme', ['learning.progress']);
  s.enrollments[0].record = { status: 'suspended', notes: 'PRIVATE-RECORD' };
  s.enrollments[0].draft = { task: 'PRIVATE-TASK' };
  s.profile.name = 'PRIVATE-NAME';
  s.followups = [{ reflection: 'PRIVATE-REFLECTION' }];
  const m = view(s);
  assert.deepEqual(Object.keys(m.summary), ['learning']);
  for (const c of ['PRIVATE-RECORD', 'PRIVATE-TASK', 'PRIVATE-NAME', 'PRIVATE-REFLECTION'])
    assert.ok(!JSON.stringify(m).includes(c));
  assert.ok(m.choice.includedFields.every((f) => f.startsWith('learning.')));
});
run('Record-only summary excludes progress values', () => {
  const s = fixture('msme', ['practice.record']);
  const m = view(s);
  assert.deepEqual(Object.keys(m.summary), ['practice_record']);
  assert.ok(m.choice.includedFields.every((f) => f.startsWith('practice_record.')));
  assert.ok(!Object.hasOwn(m.summary, 'learning'));
});
run('Record-only still refuses invented underlying lesson IDs', () => {
  const s = fixture('msme', ['practice.record']);
  s.enrollments[0].completed = ['invented'];
  const m = view(s);
  assert.equal(m.localReadiness, 'unavailable');
  assert.equal(m.summary, null);
});
run('Duplicate saved progress refuses rather than inflating completion', () => {
  const s = fixture();
  s.enrollments[0].completed = [
    programs.find((p) => p.id === 'msme-customer-operations').lessons[0].id,
  ].flatMap((id) => [id, id]);
  assert.equal(view(s).summary, null);
});
run('Exact expiry boundary stops inspection summary but preserves history', () => {
  let s = fixture();
  s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  const before = structuredClone(s);
  assert.equal(view(s, 'msme', '2030-01-02T11:59:59.999Z').localReadiness, 'inspectable');
  const m = view(s, 'msme', s.ecosystemGrants[0].expiresAt);
  assert.equal(m.localReadiness, 'expired');
  assert.equal(m.history.receipts, 1);
  assert.equal(m.summary, null);
  assert.deepEqual(s, before);
});
run('Withdrawal stops current summary without rewriting receipt', () => {
  let s = fixture();
  s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  const r = structuredClone(s.ecosystemReceipts[0]);
  s = command(s, { type: 'ecosystem-withdraw', grantId: s.ecosystemGrants[0].id }, later);
  const m = view(s, 'msme', later);
  assert.equal(m.localReadiness, 'withdrawn');
  assert.equal(m.history.receipts, 1);
  assert.deepEqual(s.ecosystemReceipts[0], r);
});
run('Current suspended status does not promote older active receipt', () => {
  let s = fixture();
  s.enrollments[0].record = { status: 'active' };
  s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  const r = structuredClone(s.ecosystemReceipts[0]);
  s.enrollments[0].record.status = 'suspended';
  const m = view(s, 'msme', later);
  assert.equal(m.summary.practice_record.status, 'suspended');
  assert.equal(s.ecosystemReceipts[0].payload.practice_record.status, 'active');
  assert.deepEqual(s.ecosystemReceipts[0], r);
});
run('Paused pathway retains choice and historical count but no summary', () => {
  const s = fixture();
  s.paused = ['msme-customer-operations'];
  const m = view(s);
  assert.equal(m.localReadiness, 'paused');
  assert.ok(m.choice);
  assert.equal(m.summary, null);
});
run('Withdrawn enrollment retains choice but no new local summary', () => {
  const s = fixture();
  s.enrollments[0].withdrawn = true;
  const m = view(s);
  assert.equal(m.localReadiness, 'withdrawn');
  assert.equal(m.choice.status, 'active');
  assert.equal(m.summary, null);
});
run('Unknown historical pin is retained and not replaced with current', () => {
  const s = fixture();
  s.enrollments[0].version = 'unknown-version';
  s.enrollments[0].contentRef.versionId = 'unknown-version';
  s.ecosystemGrants[0].contentVersion = 'unknown-version';
  s.ecosystemGrants[0].contentRef.versionId = 'unknown-version';
  const m = view(s);
  assert.equal(m.localReadiness, 'unavailable');
  assert.equal(m.choice.contentVersion, 'unknown-version');
  assert.equal(m.summary, null);
});
run('Private, mismatched or missing enrollment cannot be summarized', () => {
  for (const variant of ['private', 'mismatch', 'missing', 'duplicate']) {
    const s = fixture();
    if (variant === 'private') s.enrollments[0].contentRef.scope = 'tw-private';
    if (variant === 'mismatch') s.enrollments[0].programId = 'farmer-work-records';
    if (variant === 'missing') s.enrollments = [];
    if (variant === 'duplicate') s.enrollments.push(structuredClone(s.enrollments[0]));
    assert.equal(view(s).summary, null, variant);
  }
});
run('Missing basic view containers produce plain unavailable result', () => {
  for (const prop of ['enrollments', 'paused']) {
    const s = fixture();
    s[prop] = null;
    assert.equal(view(s).localReadiness, 'unavailable');
  }
});
run('Malformed state, saved choice or time has no inferred summary', () => {
  assert.equal(view(null).state, 'unavailable');
  for (const bad of [null, {}, [{ id: 'broken' }]]) {
    const s = fixture();
    s.ecosystemGrants = bad;
    assert.equal(view(s).summary, null);
  }
  assert.equal(view(fixture(), 'msme', 'not-time').summary, null);
});
run('Future choice or future withdrawal fails closed', () => {
  const s = fixture();
  assert.equal(view(s, 'msme', '2029-12-31T12:00:00.000Z').state, 'unavailable');
  s.ecosystemGrants[0].revokedAt = later;
  assert.equal(view(s, 'msme', now).state, 'unavailable');
});
run('Future or malformed receipt is not rendered; retained valid choice inspectable for withdrawal', () => {
  let s = fixture();
  s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  for (const bad of ['future', 'extra']) {
    const x = structuredClone(s);
    if (bad === 'future') {
      x.ecosystemReceipts[0].createdAt = later;
      x.ecosystemReceipts[0].payload.occurred_at = later;
    } else x.ecosystemReceipts[0].payload.privateNote = 'PRIVATE-HISTORY';
    const m = view(x);
    assert.equal(m.history.state, 'unavailable');
    assert.equal(m.history.receipts, null);
    assert.equal(m.summary, null);
    assert.ok(m.choice);
    assert.ok(!JSON.stringify(m).includes('PRIVATE-HISTORY'));
  }
});
run('Duplicate active partner choices fail closed without leaking IDs', () => {
  const s = fixture();
  s.ecosystemGrants.push({ ...structuredClone(s.ecosystemGrants[0]), id: 'PRIVATE-GRANT-DUPLICATE' });
  const m = view(s);
  assert.equal(m.state, 'unavailable');
  assert.equal(m.choice, null);
  assert.ok(!JSON.stringify(m).includes('PRIVATE-GRANT-DUPLICATE'));
});
run('Array order cannot promote older withdrawn choice over active one', () => {
  let s = fixture();
  s = command(
    s,
    {
      type: 'ecosystem-grant',
      partner: 'msme',
      enrollmentId: s.enrollments[0].id,
      scopes: ['practice.record'],
      durationDays: 7,
    },
    later,
  );
  s.ecosystemGrants.reverse();
  const m = view(s, 'msme', later);
  assert.equal(m.choice.status, 'active');
  assert.deepEqual(m.choice.scopes, ['practice.record']);
});
run('Retained receipt count is partner-filtered but capacity applies across partners', () => {
  let s = fixture();
  s = command(s, { type: 'enroll', programId: 'farmer-work-records' });
  s = command(s, {
    type: 'ecosystem-grant',
    partner: 'agri',
    enrollmentId: s.enrollments.find((e) => e.programId === 'farmer-work-records').id,
    scopes: ['learning.progress'],
    durationDays: 7,
  });
  const g = s.ecosystemGrants[0];
  s = command(s, { type: 'ecosystem-test', grantId: g.id });
  const template = s.ecosystemReceipts[0];
  s.ecosystemReceipts = Array.from({ length: 100 }, (_, i) => ({
    ...structuredClone(template),
    id: `receipt-${i}`,
    payload: { ...structuredClone(template.payload), event_id: `receipt-${i}` },
  }));
  const m = view(s);
  assert.equal(m.history.receipts, 0);
  assert.equal(m.localReadiness, 'receipt-limit');
  assert.equal(m.summary, null);
});
run('Inspection detaches fields and never mutates canonical input', () => {
  const s = fixture(),
    before = structuredClone(s),
    m = view(s);
  m.choice.scopes.push('learning.progress');
  m.choice.includedFields.push('unexpected');
  m.summary.learning.completed_lessons = 999;
  assert.deepEqual(s, before);
});
run('Generic brief has fixed exact shape and zero learner data by construction', () => {
  const b = brief('msme');
  assert.deepEqual(
    Object.keys(b).sort(),
    [
      'format',
      'partner',
      'partnerName',
      'mode',
      'liveExchangeEnabled',
      'recipientConnected',
      'notPermission',
      'localContractVersion',
      'localPurpose',
      'mapping',
      'supportedLocalSummaryFields',
      'fixedLocalEnvelopeFields',
      'excludedFields',
      'missingPartnerDecisions',
      'domainReviewRequired',
      'note',
    ].sort(),
  );
  assert.equal(b.liveExchangeEnabled, false);
  assert.equal(b.notPermission, true);
  assert.equal(b.mode, 'discussion-only');
  assert.equal(b.missingPartnerDecisions.length, 7);
  assert.ok(b.missingPartnerDecisions.every((x) => x.status === 'not-established'));
  for (const key of [
    'actor',
    'accountId',
    'enrollmentId',
    'grantId',
    'receiptId',
    'createdAt',
    'expiresAt',
    'progress',
    'practice_record',
    'endpoint',
    'url',
  ])
    assert.ok(!Object.hasOwn(b, key));
});
run('Metadata names are disclosed without exposing actual event or enrollment references', () => {
  let s = fixture();
  s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
  const m = view(s);
  assert.deepEqual(m.choice.envelopeFields, [
    'contract_version',
    'mode',
    'partner',
    'event_id',
    'occurred_at',
    'enrollment_ref',
    'pathway_id',
    'content_version',
    'purpose',
    'scopes',
  ]);
  for (const value of [s.enrollments[0].id, s.ecosystemGrants[0].id, s.ecosystemReceipts[0].id])
    assert.ok(!JSON.stringify(m).includes(value));
  assert.deepEqual(brief('health').fixedLocalEnvelopeFields, []);
});
run('Legacy explicit global version remains resolvable without inventing a current pin', () => {
  const s = fixture();
  delete s.enrollments[0].contentRef;
  assert.equal(view(s).localReadiness, 'inspectable');
  s.enrollments[0].version = 'missing-old';
  assert.equal(view(s).localReadiness, 'unavailable');
});
run('Selected record cannot claim a private workspace record as personal', () => {
  const s = fixture('msme', ['practice.record']);
  s.enrollments[0].record = { status: 'active', workspaceId: 'tw-private' };
  assert.equal(view(s).summary, null);
});
run('Download brief objects cannot mutate shared governance definitions', () => {
  const b = brief('agri');
  b.missingPartnerDecisions[0].title = 'Changed';
  b.supportedLocalSummaryFields.push('secret');
  assert.notEqual(brief('agri').missingPartnerDecisions[0].title, 'Changed');
  assert.equal(ONBOARDING_QUESTIONS[0].id, 'recipient');
  assert.ok(!brief('agri').supportedLocalSummaryFields.includes('secret'));
});
run('Unsupported and prototype-like partner IDs reject without fallback', () => {
  for (const id of ['other', 'toString', '__proto__', null]) assert.throws(() => brief(id));
});
run(
  'Existing receipt reader rejects future-created receipts when passed the current informational clock',
  () => {
    let s = fixture();
    s = command(s, { type: 'ecosystem-test', grantId: s.ecosystemGrants[0].id });
    const future = structuredClone(s);
    future.ecosystemReceipts[0].createdAt = later;
    future.ecosystemReceipts[0].payload.occurred_at = later;
    const grants = readTestGrants(future.ecosystemGrants);
    assert.equal(readTestReceipts(future.ecosystemReceipts, grants).length, 1);
    assert.throws(() => readTestReceipts(future.ecosystemReceipts, grants, now));
    assert.equal(readTestReceipts(future.ecosystemReceipts, grants, later).length, 1);
    assert.equal(view(future).history.state, 'unavailable');
    assert.equal(view(future).summary, null);
  },
);
process.on('beforeExit', () =>
  writeFileSync(
    new URL('./test-evidence.json', runtime),
    JSON.stringify(
      {
        passed: process.exitCode !== 1,
        groups: cases.length,
        cases,
        mode: compilation.mode,
        at: new Date().toISOString(),
        limits: [
          'Pure tests against the compiler manifest selected source only. No Worker/API/browser execution or outbound transport.',
        ],
      },
      null,
      2,
    ),
  ),
);
