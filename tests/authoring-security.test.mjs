import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  runtime = resolve(
    process.env.ACADEMY_INTEGRATED_SECURITY_RUNTIME ?? resolve(here, '../.sites-runtime/integrated-security'),
  );
const core = await import(pathToFileURL(resolve(runtime, 'core.mjs')).href);
const {
  createTeam,
  applyTeamCommand,
  projectTeam,
  checkMutationBudget,
  separateHistory,
  RuleError,
  programs,
  previewDraft,
  validateDocument,
  documentHash,
  authoringClosureReserve,
  supportClosureReserve,
  utf8JsonBytes,
  createCurriculumRegistry,
  curriculumRegistry,
  resolvePinnedContent,
  applyCommand,
  freshWorkspace,
  planOptions,
  contentKey,
} = core;
const now = '2026-10-05T10:00:00.000Z',
  due = '2027-10-05T10:00:00.000Z',
  a = { userId: 'author', email: 'author@academy.test' },
  r = { userId: 'reviewer', email: 'reviewer@academy.test' },
  l = { userId: 'learner', email: 'learner@academy.test' };
const checks = { sources: true, answers: true, rubric: true, safety: true, accessibility: true };
const last = (t) => t.content.drafts.at(-1),
  active = (t) => t.content.drafts.filter((d) => ['draft', 'in_review', 'approved'].includes(d.state));
async function action(t, u, c, time = now) {
  const next = await applyTeamCommand(t, u, c, time);
  separateHistory(next);
  checkMutationBudget(t, next, c);
  return next;
}
async function fixture() {
  let t = createTeam(
    a,
    {
      name: 'Synthetic integrated content security',
      purpose: 'Fictional owner review, storage closure and scoped content tests.',
      context: 'msme',
    },
    'tw-11111111-1111-1111-1111-111111111111',
    now,
  );
  for (const [u, roles, tokenHash] of [
    [r, ['admin'], 'a'.repeat(64)],
    [l, ['learner'], 'b'.repeat(64)],
  ]) {
    t = await action(t, a, { type: 'invite', email: u.email, roles, scopes: [], tokenHash });
    t = await action(t, u, { type: 'accept', tokenHash });
  }
  return t;
}
const copy = (t, p = programs[1]) =>
  action(t, a, {
    type: 'content-copy',
    sourceRef: { scope: 'global', programId: p.id, versionId: '0.1-review-draft' },
  });
async function submit(t, id = last(t).id) {
  const d = t.content.drafts.find((d) => d.id === id);
  return action(t, a, {
    type: 'content-submit',
    draftId: id,
    revision: d.revision,
    reviewerId: r.userId,
    reviewDueAt: due,
  });
}
async function approve(t, id = last(t).id) {
  const d = t.content.drafts.find((d) => d.id === id);
  return action(t, r, {
    type: 'content-review',
    draftId: id,
    revision: d.revision,
    decision: 'approve',
    note: 'Checked fictional sources, answers, rubric, safety and accessible plain text.',
    checks,
  });
}
async function publish(t) {
  t = await approve(await submit(await copy(t)));
  return action(t, a, { type: 'content-publish', draftId: last(t).id, revision: last(t).revision });
}
async function archive(t, id, u = r) {
  const d = t.content.drafts.find((d) => d.id === id);
  return action(t, u, {
    type: 'content-archive',
    draftId: id,
    revision: d.revision,
    reason: String.fromCharCode(0).repeat(1000),
  });
}
const retire = (t, id) =>
  action(t, r, { type: 'content-retire', publicationId: id, reason: String.fromCharCode(0).repeat(1000) });
function padContent(t) {
  t.content.padding = '';
  t.content.padding = 'x'.repeat(650000 - authoringClosureReserve(t) - utf8JsonBytes(t.content));
  assert.equal(utf8JsonBytes(t.content) + authoringClosureReserve(t), 650000);
}
function padTeam(t) {
  t.padding = '';
  t.padding = 'x'.repeat(1800000 - authoringClosureReserve(t) - supportClosureReserve(t) - utf8JsonBytes(t));
  assert.equal(utf8JsonBytes(t) + authoringClosureReserve(t) + supportClosureReserve(t), 1800000);
}
async function allClosureKinds() {
  let t = await fixture();
  for (let i = 0; i < 8; i++) t = await publish(t);
  for (let i = 0; i < 4; i++) t = await copy(t);
  const ids = active(t).map((d) => d.id);
  for (let i = 0; i < 98; i++) {
    const d = t.content.drafts.find((d) => d.id === ids[0]);
    t = await action(t, a, {
      type: 'content-save',
      draftId: d.id,
      revision: d.revision,
      document: d.document,
    });
  }
  t = await submit(t, ids[0]);
  t = await submit(t, ids[2]);
  t = await approve(await submit(t, ids[3]), ids[3]);
  t.members.find((m) => m.userId === r.userId).name = String.fromCharCode(0).repeat(80);
  return { t, ids };
}
test('actual Team archive translates errors, retains history100 as101 and never restores publication authority', async () => {
  let t = await copy(await fixture());
  for (let i = 0; i < 98; i++)
    t = await action(t, a, {
      type: 'content-save',
      draftId: last(t).id,
      revision: last(t).revision,
      document: last(t).document,
    });
  t = await submit(t);
  const before = structuredClone(last(t)),
    activityCount = t.activity.length;
  assert.equal(before.history.length, 100);
  t = await archive(t, before.id);
  const d = last(t);
  assert.equal(d.state, 'archived');
  assert.equal(d.history.length, 101);
  assert.deepEqual(d.history.slice(0, 100), before.history);
  assert.deepEqual(d.document, before.document);
  assert.equal(d.revision, before.revision + 1);
  assert.equal(d.history.at(-1).actor, r.userId);
  assert.equal(t.activity.length, activityCount);
  for (const [u, c] of [
    [a, { type: 'content-publish', draftId: d.id, revision: d.revision }],
    [a, { type: 'content-save', draftId: d.id, revision: d.revision, document: d.document }],
    [
      a,
      { type: 'content-submit', draftId: d.id, revision: d.revision, reviewerId: r.userId, reviewDueAt: due },
    ],
    [
      a,
      {
        type: 'content-recall',
        draftId: d.id,
        revision: d.revision,
        reason: 'An archived draft must not reopen for editing.',
      },
    ],
    [
      r,
      {
        type: 'content-review',
        draftId: d.id,
        revision: d.revision,
        decision: 'approve',
        note: 'An archived draft cannot be approved again.',
        checks,
      },
    ],
    [
      r,
      {
        type: 'content-archive',
        draftId: d.id,
        revision: d.revision,
        reason: 'A repeated terminal command must not add another event.',
      },
    ],
  ])
    await assert.rejects(action(t, u, c), (e) => e instanceof RuleError && e.status === 409);
  await assert.rejects(
    action(t, r, {
      type: 'content-archive',
      draftId: d.id,
      revision: before.revision,
      reason: 'A stale terminal command must not overwrite current history.',
    }),
    (e) => e instanceof RuleError && e.status === 409,
  );
  await assert.rejects(
    action(t, r, {
      type: 'content-archive',
      draftId: d.id,
      revision: d.revision,
      reason: 'Forged actor must never grant an archive permission.',
      actor: a.userId,
    }),
    (e) => e instanceof RuleError && e.status === 400,
  );
  await assert.rejects(archive(t, d.id, l), (e) => e instanceof RuleError && e.status === 403);
  t = await copy(t);
  assert.equal(last(t).state, 'draft');
});
test('actual archive keeps an approved attestation as history while terminal state prevents every publication', async () => {
  let t = await approve(await submit(await copy(await fixture()))),
    approval = structuredClone(last(t).approval),
    id = last(t).id;
  t = await archive(t, id);
  assert.equal(last(t).state, 'archived');
  assert.deepEqual(last(t).approval, approval);
  await assert.rejects(
    action(t, a, { type: 'content-publish', draftId: id, revision: last(t).revision }),
    (e) => e instanceof RuleError && e.status === 409,
  );
});
test('actual eight publications and four active drafts all close at effective650KB without body/hash/history loss', async () => {
  let { t, ids } = await allClosureKinds();
  padContent(t);
  const docs = Object.fromEntries(
      ids.map((id) => [id, JSON.stringify(t.content.drafts.find((d) => d.id === id).document)]),
    ),
    snapshots = t.content.publications.map((p) => JSON.stringify(p.snapshot)),
    hashes = t.content.publications.map((p) => p.documentHash),
    activityCount = t.activity.length;
  for (const id of ids) {
    t = await archive(t, id);
    assert.equal(JSON.stringify(t.content.drafts.find((d) => d.id === id).document), docs[id]);
    assert.ok(utf8JsonBytes(t.content) + authoringClosureReserve(t) <= 650000);
  }
  for (const [i, p] of t.content.publications.entries()) {
    t = await retire(t, p.id);
    assert.equal(JSON.stringify(t.content.publications[i].snapshot), snapshots[i]);
    assert.equal(t.content.publications[i].documentHash, hashes[i]);
    assert.equal(await documentHash(t.content.publications[i].snapshot.program), hashes[i]);
    assert.ok(utf8JsonBytes(t.content) + authoringClosureReserve(t) <= 650000);
  }
  assert.equal(authoringClosureReserve(t), 0);
  assert.equal(t.activity.length, activityCount);
  assert.ok(utf8JsonBytes(t.content) <= 650000);
});
test('actual global budget protects all content/support closures and rejects unrelated protective growth at1.8MB', async () => {
  let { t, ids } = await allClosureKinds();
  t.members.find((m) => m.userId === l.userId).name = String.fromCharCode(0).repeat(80);
  t = await action(t, l, {
    type: 'support-open',
    category: 'access',
    cohortId: null,
    subject: 'Generic integrated capacity fixture',
    body: 'A fictional access question without real private records.',
    audienceAcknowledged: true,
  });
  padTeam(t);
  const before = JSON.stringify(t);
  await assert.rejects(
    action(t, a, { type: 'member', userId: l.userId, roles: ['learner'], scopes: [], active: false }),
    (e) => e instanceof RuleError && e.status === 413,
  );
  assert.equal(JSON.stringify(t), before);
  for (const id of ids) t = await archive(t, id);
  for (const p of t.content.publications) t = await retire(t, p.id);
  t = await action(t, l, { type: 'support-withdraw', requestId: t.support[0].id });
  assert.equal(authoringClosureReserve(t) + supportClosureReserve(t), 0);
  assert.ok(utf8JsonBytes(t) <= 1800000);
});
test('actual scoped engine and plan context deny a foreign snapshot even if a mixed registry was mistakenly assembled', async () => {
  const t = await publish(await fixture()),
    p = t.content.publications[0],
    foreign = {
      ...structuredClone(p.snapshot),
      ref: { ...p.snapshot.ref, scope: 'tw-22222222-2222-2222-2222-222222222222' },
      program: { ...structuredClone(p.snapshot.program), title: 'FOREIGN-SCOPE-PRIVATE-CANARY' },
    };
  const globals = programs.map((program) =>
      curriculumRegistry.resolve({ scope: 'global', programId: program.id, versionId: '0.1-review-draft' }),
    ),
    registry = createCurriculumRegistry([...globals, p.snapshot, foreign]),
    context = { registry, allowedScopes: ['global', t.id] },
    record = { programId: foreign.ref.programId, version: foreign.ref.versionId, contentRef: foreign.ref };
  assert.throws(
    () => resolvePinnedContent(record, context.allowedScopes, registry),
    (e) => e.status === 404,
  );
  assert.throws(
    () =>
      applyCommand(
        freshWorkspace(),
        { type: 'enroll', programId: foreign.ref.programId },
        now,
        undefined,
        foreign.ref,
        context,
      ),
    (e) => e instanceof RuleError && e.status === 404,
  );
  assert.equal(
    planOptions(now, {}, context).resolveProgram(record.programId, record.version, record),
    undefined,
  );
  assert.equal(
    resolvePinnedContent(
      { programId: p.snapshot.ref.programId, version: p.snapshot.ref.versionId, contentRef: p.snapshot.ref },
      context.allowedScopes,
      registry,
    ).program.title,
    p.snapshot.program.title,
  );
  assert.ok(!JSON.stringify(projectTeam(t, l)).includes('FOREIGN-SCOPE-PRIVATE-CANARY'));
});
test('private seed copies preserve archive bytes and require explicit justified markers for intentional teaching duplicates', async () => {
  const metadata = JSON.parse(readFileSync(resolve(runtime, 'source-evidence.json'), 'utf8')),
    archivePath = resolve(metadata.app, 'lib/curriculum-versions/0.1-review-draft.json'),
    before = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  let t = await fixture();
  for (const p of programs) {
    t = await copy(t, p);
    assert.deepEqual(previewDraft(t, a, last(t).id).issues, [], p.id);
  }
  const farmer = t.content.drafts.find((d) => d.baseRef.programId === programs[0].id),
    rows = farmer.document.lessons[0].exercise.sourcePacket,
    duplicate = rows.find((row, i) => rows.findIndex((r) => r.sourceId.trim() === row.sourceId.trim()) !== i);
  assert.ok(duplicate, 'The farmer exercise intentionally teaches a copied transaction.');
  assert.equal(duplicate.duplicateOf, duplicate.sourceId);
  assert.ok(duplicate.sourceNote.trim().length >= 10);
  const bad = structuredClone(farmer.document);
  delete bad.lessons[0].exercise.sourcePacket[rows.indexOf(duplicate)].duplicateOf;
  assert.ok(validateDocument(bad, farmer.document).some((i) => i.path.includes('sourcePacket')));
  const mismatched = structuredClone(farmer.document);
  mismatched.lessons[0].exercise.sourcePacket[rows.indexOf(duplicate)].duplicateOf = 'another-reference';
  assert.ok(validateDocument(mismatched, farmer.document).some((i) => i.path.includes('sourcePacket')));
  assert.equal(createHash('sha256').update(readFileSync(archivePath)).digest('hex'), before);
});
test('actual archived drafts free active slots but total24 retained documents cannot grow without bound', async () => {
  let t = await fixture();
  for (let i = 0; i < 24; i++) {
    t = await copy(t);
    t = await action(t, r, {
      type: 'content-archive',
      draftId: last(t).id,
      revision: last(t).revision,
      reason: 'Retain this fictional draft as history and release its active authoring slot.',
    });
  }
  assert.equal(t.content.drafts.length, 24);
  assert.equal(active(t).length, 0);
  assert.ok(t.content.drafts.every((d) => d.state === 'archived'));
  assert.ok(
    utf8JsonBytes(t.content) + 30000 < 650000,
    'The total-draft guard should bind before the content budget in this fixture.',
  );
  const before = JSON.stringify(t);
  await assert.rejects(copy(t), (e) => e instanceof RuleError && e.status === 409);
  assert.equal(JSON.stringify(t), before);
});
test('actual authoring validates visible quiz choices, substantive source facts and total-time consistency', async () => {
  const t = await copy(await fixture()),
    expected = structuredClone(last(t).document);
  const changes = [
    (doc) => (doc.lessons[0].quiz[0].options[1] = ' ' + doc.lessons[0].quiz[0].options[0] + ' '),
    (doc) =>
      (doc.lessons[0].exercise.sourcePacket = [
        {
          sourceId: 'M-1',
          content: '',
          sourceNote: 'Only metadata is present here.',
          type: 'fictional',
          missing: null,
        },
      ]),
    (doc) => (doc.estimatedMinutes = 5),
  ];
  for (const change of changes) {
    const document = structuredClone(expected);
    change(document);
    let saved = await action(t, a, {
      type: 'content-save',
      draftId: last(t).id,
      revision: last(t).revision,
      document,
    });
    assert.ok(previewDraft(saved, a, last(saved).id).issues.length > 0);
    await assert.rejects(submit(saved), (e) => e instanceof RuleError && e.status === 422);
  }
  for (const value of [0, false]) {
    const document = structuredClone(expected);
    document.lessons[0].exercise.sourcePacket = [{ sourceId: 'M-1', fact: value }];
    assert.deepEqual(
      validateDocument(document, expected),
      [],
      'Zero and false are legitimate supplied facts.',
    );
  }
});
test('actual authoring names and clocks remain bounded across drafts, approvals, publication and hot metadata', async () => {
  let t = await fixture();
  t.members.find((m) => m.userId === a.userId).name = 'A'.repeat(1000);
  t.members.find((m) => m.userId === r.userId).name = 'R'.repeat(1000);
  t = await action(
    t,
    a,
    {
      type: 'content-copy',
      sourceRef: { scope: 'global', programId: programs[1].id, versionId: '0.1-review-draft' },
    },
    '2026-10-05T15:30:00+05:30',
  );
  assert.equal(last(t).createdAt, now);
  assert.ok(last(t).authorName.length <= 80);
  t = await approve(await submit(t));
  assert.ok(last(t).approval.reviewerName.length <= 80);
  t = await action(t, a, { type: 'content-publish', draftId: last(t).id, revision: last(t).revision });
  const p = t.content.publications[0];
  for (const name of [p.authorName, p.reviewerName, p.publishedByName]) assert.ok(name.length <= 80);
  for (const d of t.content.drafts)
    for (const event of d.history) {
      assert.ok(event.actorName.length <= 80);
      assert.equal(event.at.length, 24);
    }
  for (const event of t.activity.filter((e) => e.action.startsWith('content-'))) {
    assert.ok(event.actorName.length <= 80, 'Hot content action metadata also needs bounded name snapshots.');
    assert.equal(event.createdAt.length, 24);
  }
  const before = JSON.stringify(t);
  await assert.rejects(
    action(
      t,
      a,
      {
        type: 'content-copy',
        sourceRef: { scope: 'global', programId: programs[1].id, versionId: '0.1-review-draft' },
      },
      '+020000-01-01T00:00:00.000Z',
    ),
    (e) => e instanceof RuleError && e.status === 400,
  );
  assert.equal(JSON.stringify(t), before);
});
test('actual member acceptance cannot spend650KB closure capacity by introducing a wider future actor ID', async () => {
  let t = await copy(await fixture());
  const newcomer = {
      userId: 'new-owner-' + String.fromCharCode(0).repeat(1000),
      email: 'new-owner@academy.test',
    },
    tokenHash = 'c'.repeat(64);
  t = await action(t, a, {
    type: 'invite',
    email: newcomer.email,
    roles: ['learner'],
    scopes: [],
    tokenHash,
  });
  padContent(t);
  const before = JSON.stringify(t),
    oldReserve = authoringClosureReserve(t);
  const accepted = await applyTeamCommand(t, newcomer, { type: 'accept', tokenHash }, now);
  assert.ok(authoringClosureReserve(accepted) > oldReserve);
  assert.throws(
    () => checkMutationBudget(t, accepted, { type: 'accept', tokenHash }),
    (e) => e instanceof RuleError && e.status === 413,
  );
  assert.equal(JSON.stringify(t), before);
});
