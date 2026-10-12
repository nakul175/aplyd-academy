import './qa-paths.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import {
  own,
  ownPost,
  ownAction,
  enrolled,
  choice,
  pass,
  mappings,
  identity,
  curriculum,
  out,
  protectedAbsent,
  base,
} from './personal-qa.mjs';
import { post, action, current } from '../local-qa.mjs';
let checks = 0;
const cases = [];
const eq = (a, b, message) => {
    assert.deepEqual(a, b, message);
    checks++;
  },
  ok = (a, message) => {
    assert.ok(a, message);
    checks++;
  };
async function scenario(name, fn) {
  await fn();
  cases.push({ name, passed: true });
}
const owner = identity('scoped-owner'),
  other = identity('scoped-other'),
  ids = await enrolled(owner),
  foreign = await enrolled(other),
  canaries = {
    draft: 'SCOPED-PRIVATE-DRAFT: fictional owner evidence with no return authority.',
    practice: 'SCOPED-PRIVATE-PRACTICE: fictional checked lesson response remains personal.',
    notes: 'SCOPED-PRIVATE-NOTES: verified fictional source references retained only in sample review.',
    feedback: 'SCOPED-PRIVATE-FEEDBACK: actionable fictional review kept in the personal lab.',
    appeal: 'SCOPED-PRIVATE-APPEAL: reconsider the fictional evidence using an independent review.',
    goal: 'SCOPED-PRIVATE-GOAL: improve a fictional workflow without publishing this personal goal.',
  };
const values = Object.values(canaries).concat(owner.id, owner.email, owner.name, 'assessor-a', 'reviewer-b');
const p = curriculum.pathways.find((p) => p.id === mappings[1].programId),
  lessonIds = p.lessons.map((l) => l.id);
let recordBefore, decisionBefore, activeReceipt;
try {
  await scenario(
    'Legacy booleans do not create an explicit choice and legacy delivery is blocked',
    async () => {
      let x = await ownAction(owner, { type: 'connection', partner: 'msme', enabled: true });
      eq(x.state.connections.msme, true);
      eq(x.state.ecosystemGrants ?? [], []);
      eq(x.state.ecosystemReceipts ?? [], []);
      const prior = structuredClone(x.state.deliveries);
      eq(
        (await ownPost(owner, { type: 'deliver', partner: 'msme', enrollmentId: ids.msme }, x.revision))
          .status,
        409,
      );
      x = pass(await own(owner));
      eq(x.state.deliveries, prior);
      eq(x.state.ecosystemGrants ?? [], []);
    },
  );
  await scenario('Duration allowlist is strict and exact expiry is computed by the server', async () => {
    for (const days of [1, 7, 30]) {
      const x = await ownAction(owner, choice('msme', ids.msme, ['learning.progress'], days)),
        g = x.state.ecosystemGrants[0];
      eq(g.durationDays, days);
      eq(Date.parse(g.expiresAt) - Date.parse(g.createdAt), days * 86400000);
      ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(g.createdAt));
      eq(g.contentRef, { scope: 'global', programId: p.id, versionId: g.contentVersion });
      eq(g.purpose, 'local-return-contract-review');
      eq(g.contractVersion, 'aplyd.learning-return/1.0-test');
    }
    const before = pass(await own(owner));
    for (const days of [0, 2, 8, 31, -1, 1.5, '7', null])
      eq(
        (await ownPost(owner, choice('msme', ids.msme, ['learning.progress'], days), before.revision)).status,
        422,
      );
    const after = pass(await own(owner));
    eq(after.state, before.state);
    eq(after.revision, before.revision);
  });
  await scenario(
    'Exact command keys, scope allowlist, Health, own identity and partner mapping are enforced',
    async () => {
      const x = pass(await own(owner)),
        g = x.state.ecosystemGrants[0];
      for (const type of ['ecosystem-grant', 'ecosystem-test', 'ecosystem-withdraw'])
        for (const key of ['actor', 'payload', 'url', 'expiresAt', 'contentRef', 'learnerId']) {
          const c = type === 'ecosystem-grant' ? choice('msme', ids.msme) : { type, grantId: g.id };
          eq((await ownPost(owner, { ...c, [key]: 'unsupported' }, x.revision)).status, 400);
        }
      for (const scopes of [
        [],
        ['evidence'],
        ['learning.progress', 'learning.progress'],
        ['practice.record', 'support.reply'],
      ])
        eq((await ownPost(owner, choice('msme', ids.msme, scopes), x.revision)).status, 422);
      eq((await ownPost(owner, choice('health', ids.msme), x.revision)).status, 409);
      eq((await ownPost(owner, choice('toString', ids.msme), x.revision)).status, 404);
      for (const from of mappings)
        for (const to of mappings)
          if (from.partner !== to.partner)
            eq((await ownPost(owner, choice(to.partner, ids[from.partner]), x.revision)).status, 409);
      eq((await ownPost(owner, choice('msme', foreign.msme), x.revision)).status, 404);
      eq(
        (await ownPost(other, { type: 'ecosystem-test', grantId: g.id }, (await own(other)).revision)).status,
        404,
      );
      eq(
        (await ownPost(other, { type: 'ecosystem-withdraw', grantId: g.id }, (await own(other)).revision))
          .status,
        404,
      );
      const after = pass(await own(owner));
      eq(after.state, x.state);
      eq(after.revision, x.revision);
      const anonymous = await fetch(base + '/api/academy');
      eq(anonymous.status, 401);
    },
  );
  await scenario(
    'Progress-only and record-only receipts include exactly the selected summary fields',
    async () => {
      await ownAction(owner, { type: 'draft', enrollmentId: ids.msme, fields: { task: canaries.draft } });
      await ownAction(owner, { type: 'learning-plan', personalGoal: canaries.goal });
      for (const [scopes, present, absent] of [
        [['learning.progress'], 'learning', 'practice_record'],
        [['practice.record'], 'practice_record', 'learning'],
      ]) {
        let x = await ownAction(owner, choice('msme', ids.msme, scopes));
        x = await ownAction(owner, { type: 'ecosystem-test', grantId: x.state.ecosystemGrants[0].id });
        const r = x.state.ecosystemReceipts[0];
        ok(Object.hasOwn(r.payload, present));
        ok(!Object.hasOwn(r.payload, absent));
        eq(r.payload.scopes, scopes);
        eq(r.payload.mode, 'local-test');
        eq(r.status, 'simulated');
        protectedAbsent(r, values);
        checks += values.length;
        eq(
          Object.keys(r).sort(),
          [
            'id',
            'partner',
            'enrollmentId',
            'grantId',
            'contractVersion',
            'createdAt',
            'status',
            'payload',
            'note',
          ].sort(),
        );
      }
      const x = pass(await own(owner)),
        r = x.state.ecosystemReceipts[0];
      eq(r.payload.practice_record, {
        status: 'not-issued',
        claim_type: 'nonaccredited-practice',
        review_mode: 'not-reviewed',
      });
      const bad = await ownPost(
        owner,
        {
          type: 'lesson',
          enrollmentId: ids.msme,
          lessonId: 'foreign-pinned-lesson',
          answers: [0, 0, 0],
          practice: canaries.practice,
        },
        x.revision,
      );
      eq(bad.status, 404);
      eq((await own(owner)).state.enrollments.find((e) => e.id === ids.msme).completed, []);
    },
  );
  await scenario(
    'Current adverse appeal status is suspended while the historical active receipt and decision remain unchanged',
    async () => {
      for (const l of p.lessons)
        await ownAction(owner, {
          type: 'lesson',
          enrollmentId: ids.msme,
          lessonId: l.id,
          answers: l.quiz.map((q) => q.correctOptionIndex),
          practice: canaries.practice,
        });
      let x = await ownAction(owner, {
        type: 'submit',
        enrollmentId: ids.msme,
        fields: Object.fromEntries(
          p.practicalAssessment.submissionPrompts.map((f) => [f.id, canaries.draft]),
        ),
        confirmed: true,
      });
      const attemptId = x.state.enrollments.find((e) => e.id === ids.msme).attempts[0].id,
        scores = p.practicalAssessment.rubric.map(() => 4),
        gates = p.practicalAssessment.rubric.filter((r) => r.criticalGate).map(() => true),
        notes = scores.map(() => canaries.notes);
      x = await ownAction(owner, {
        type: 'assess',
        enrollmentId: ids.msme,
        attemptId,
        actor: 'assessor-a',
        scores,
        gates,
        notes,
        feedback: canaries.feedback,
      });
      recordBefore = structuredClone(x.state.enrollments.find((e) => e.id === ids.msme).record);
      decisionBefore = structuredClone(
        x.state.enrollments.find((e) => e.id === ids.msme).attempts[0].decision,
      );
      x = await ownAction(owner, choice('msme', ids.msme, ['learning.progress', 'practice.record']));
      const grantId = x.state.ecosystemGrants[0].id;
      x = await ownAction(owner, { type: 'ecosystem-test', grantId });
      activeReceipt = structuredClone(x.state.ecosystemReceipts[0]);
      eq(activeReceipt.payload.practice_record.status, 'active');
      eq(activeReceipt.payload.learning.completed_lessons, lessonIds.length);
      eq(activeReceipt.payload.learning.total_lessons, lessonIds.length);
      x = await ownAction(owner, {
        type: 'appeal',
        enrollmentId: ids.msme,
        attemptId,
        reason: canaries.appeal,
      });
      const appealId = x.state.enrollments.find((e) => e.id === ids.msme).appeals[0].id;
      x = await ownAction(owner, {
        type: 'resolve',
        enrollmentId: ids.msme,
        appealId,
        actor: 'reviewer-b',
        scores,
        gates: gates.map((g, i) => (i === 0 ? false : g)),
        notes,
        feedback: canaries.feedback,
      });
      eq(x.state.enrollments.find((e) => e.id === ids.msme).record.status, 'suspended');
      eq(x.state.enrollments.find((e) => e.id === ids.msme).record.issuedAt, recordBefore.issuedAt);
      eq(x.state.enrollments.find((e) => e.id === ids.msme).attempts[0].decision, decisionBefore);
      x = await ownAction(owner, { type: 'ecosystem-test', grantId });
      eq(x.state.ecosystemReceipts[0].payload.practice_record.status, 'suspended');
      eq(
        x.state.ecosystemReceipts.find((r) => r.id === activeReceipt.id),
        activeReceipt,
      );
      protectedAbsent(x.state.ecosystemReceipts[0], values);
      checks += values.length;
    },
  );
  await scenario(
    'Personal and shared learning are separate; shared workbench commands are unavailable',
    async () => {
      let t = pass(
          await post(
            owner,
            undefined,
            {
              type: 'create',
              name: 'Synthetic scoped workbench separation',
              purpose: 'Fictional local scope test only.',
              context: 'msme',
            },
            0,
          ),
        ),
        teamId = t.team.id;
      t = pass(
        await action(owner, teamId, {
          type: 'cohort-create',
          title: 'Shared local customer practice',
          programId: p.id,
          capacity: 5,
        }),
      );
      const cid = t.team.cohorts[0].id;
      t = pass(await action(owner, teamId, { type: 'enroll', programId: p.id, cohortId: cid }));
      const sharedEnrollment = t.state.enrollments[0].id,
        personal = pass(await own(owner));
      for (const command of [
        choice('msme', sharedEnrollment),
        { type: 'ecosystem-test', grantId: personal.state.ecosystemGrants[0].id },
        { type: 'ecosystem-withdraw', grantId: personal.state.ecosystemGrants[0].id },
      ])
        eq((await post(owner, teamId, command, t.revision)).status, 400);
      eq((await ownPost(owner, choice('msme', sharedEnrollment), personal.revision)).status, 404);
      eq((await own(owner)).state, personal.state);
      eq((await current(owner, teamId)).state.ecosystemGrants ?? [], []);
      writeFileSync(
        new URL('shared-fixture.json', out),
        JSON.stringify({ owner, teamId, cid, sharedEnrollment }, null, 2),
      );
    },
  );
  await scenario(
    'Actual same-revision withdrawal/test race saves once; action replay never creates a second receipt',
    async () => {
      const racer = identity('scoped-race'),
        e = await enrolled(racer);
      let x = await ownAction(racer, choice('msme', e.msme)),
        g = x.state.ecosystemGrants[0],
        revision = x.revision,
        withdrawId = crypto.randomUUID(),
        testId = crypto.randomUUID();
      const w = { type: 'ecosystem-withdraw', grantId: g.id },
        t = { type: 'ecosystem-test', grantId: g.id },
        results = await Promise.all([
          ownPost(racer, w, revision, withdrawId),
          ownPost(racer, t, revision, testId),
        ]);
      eq(results.map((r) => r.status).sort(), [200, 409]);
      x = pass(await own(racer));
      eq(x.revision, revision + 1);
      eq(x.state.ecosystemReceipts?.length ?? 0, results[1].status === 200 ? 1 : 0);
      const winner = results[0].status === 200 ? 0 : 1,
        replay = pass(
          await ownPost(racer, winner === 0 ? w : t, revision, winner === 0 ? withdrawId : testId),
        );
      eq(replay.replayed, true);
      eq(replay.state, x.state);
      eq(replay.revision, x.revision);
      eq(
        (
          await ownPost(
            racer,
            { type: 'profile', name: 'Changed replay', context: 'msme', reading: false, networking: false },
            x.revision,
            winner === 0 ? withdrawId : testId,
          )
        ).status,
        409,
      );
      eq(
        (
          await ownPost(
            other,
            winner === 0 ? w : t,
            (await own(other)).revision,
            winner === 0 ? withdrawId : testId,
          )
        ).status,
        404,
        'An action reference from another subject is not replay authority',
      );
      if (winner === 1) x = await ownAction(racer, w);
      const receipts = structuredClone(x.state.ecosystemReceipts ?? []);
      eq((await ownPost(racer, t, x.revision)).status, 403);
      eq((await own(racer)).state.ecosystemReceipts ?? [], receipts);
      ok((await own(racer)).state.ecosystemGrants[0].revokedAt !== null);
    },
  );
  await scenario(
    'Retained choices and separate receipts reach their exact limits without erasing history',
    async () => {
      const choices = identity('scoped-choice-capacity'),
        e = await enrolled(choices);
      let x;
      for (let i = 0; i < 24; i++)
        x = await ownAction(choices, choice('msme', e.msme, ['learning.progress'], [1, 7, 30][i % 3]));
      eq(x.state.ecosystemGrants.length, 24);
      eq(x.state.ecosystemGrants.filter((g) => g.revokedAt === null).length, 1);
      const first = structuredClone(x.state.ecosystemGrants.at(-1));
      eq((await ownPost(choices, choice('msme', e.msme), x.revision)).status, 409);
      x = await ownAction(choices, { type: 'ecosystem-withdraw', grantId: x.state.ecosystemGrants[0].id });
      eq(x.state.ecosystemGrants.length, 24);
      eq(x.state.ecosystemGrants.at(-1), first);
      eq((await ownPost(choices, choice('msme', e.msme), x.revision)).status, 409);
      const receipts = identity('scoped-receipt-capacity'),
        ri = await enrolled(receipts);
      let r = await ownAction(receipts, choice('msme', ri.msme)),
        grantId = r.state.ecosystemGrants[0].id;
      for (let i = 0; i < 100; i++) r = await ownAction(receipts, { type: 'ecosystem-test', grantId });
      eq(r.state.ecosystemReceipts.length, 100);
      eq(r.state.ecosystemGrants.length, 1);
      const history = structuredClone(r.state.ecosystemReceipts);
      eq((await ownPost(receipts, { type: 'ecosystem-test', grantId }, r.revision)).status, 409);
      r = await ownAction(receipts, { type: 'ecosystem-withdraw', grantId });
      eq(r.state.ecosystemReceipts, history);
      writeFileSync(new URL('capacity-fixture.json', out), JSON.stringify({ choices, receipts }, null, 2));
    },
  );
  // A small current saved choice is left available for independent browser fixtures.
  await ownAction(owner, choice('msme', ids.msme, ['learning.progress'], 7));
  const fixture = {
    owner,
    other,
    ids,
    foreign,
    canaries,
    recordBefore,
    decisionBefore,
    activeReceipt,
    at: new Date().toISOString(),
  };
  writeFileSync(new URL('scoped-workbench-fixture.json', out), JSON.stringify(fixture, null, 2));
  writeFileSync(
    new URL('scoped-workbench-api-result.json', out),
    JSON.stringify(
      {
        passed: true,
        checks,
        cases,
        at: new Date().toISOString(),
        limits: [
          'Synthetic local trusted-header identities only.',
          'Nonempty pre-upgrade delivery history and corrupt stored pins are covered by pure candidate fixtures, not API database injection.',
          'No external partner, identity provider or transport is invoked.',
        ],
      },
      null,
      2,
    ),
  );
  console.log(`Scoped workbench API passed ${checks} assertions across ${cases.length} cases.`);
} catch (error) {
  writeFileSync(
    new URL('scoped-workbench-api-result.json', out),
    JSON.stringify(
      { passed: false, checks, cases, error: String(error), at: new Date().toISOString() },
      null,
      2,
    ),
  );
  throw error;
}
