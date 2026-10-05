import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
  CONTENT_VERSION, LEGACY_CONTENT_VERSION, LEGACY_SOURCE_SHA256, curriculum,
  programs, curriculumRegistry, createCurriculumRegistry, contentRef, contentKey,
  pinnedRef, resolvePinnedContent, resolvePinnedProgram, resolveCurrentProgram,
  tryResolvePinnedContent, ContentResolutionError,
} from '../.sites-runtime/curriculum.mjs';

const programId = 'msme-customer-operations';
const legacy = {programId, version: LEGACY_CONTENT_VERSION};
const error = (fn, status = 409) => assert.throws(fn, e => e instanceof ContentResolutionError && e.status === status);

test('archived seed has its original byte length and SHA256; original source remains untouched', async () => {
  const raw = await readFile(new URL('../lib/curriculum-versions/0.1-review-draft.json', import.meta.url));
  const source = await readFile(new URL('../lib/curriculum.json', import.meta.url));
  const manifest = {sourceByteLength:65054,sourceSha256:LEGACY_SOURCE_SHA256};
  assert.equal(raw.length, manifest.sourceByteLength);
  assert.equal(createHash('sha256').update(raw).digest('hex'), LEGACY_SOURCE_SHA256);
  assert.equal(manifest.sourceSha256, LEGACY_SOURCE_SHA256);
  assert.deepEqual(raw, source);
});

test('current discovery version remains exactly the existing legacy version', () => {
  assert.equal(CONTENT_VERSION, '0.1-review-draft');
  assert.equal(curriculum.contentVersion, CONTENT_VERSION);
  assert.equal(programs.length, 3);
  assert.equal(resolveCurrentProgram(programId).title, resolvePinnedProgram(legacy).title);
  error(() => resolveCurrentProgram('unknown-program'), 404);
});

test('legacy rows resolve exact global reference without mutation', () => {
  const row = {...legacy, attempts: [{id: 'saved-attempt'}], draft: {'private-work': 'saved'}};
  const copy = structuredClone(row);
  const snapshot = resolvePinnedContent(row);
  assert.deepEqual(snapshot.ref, {scope: 'global', programId, versionId: CONTENT_VERSION});
  assert.deepEqual(row, copy);
});

test('missing version and unknown version never fall back to current', () => {
  error(() => resolvePinnedContent({programId}));
  error(() => resolvePinnedContent({programId, version: '9.9-unavailable'}));
  error(() => resolvePinnedContent({programId: 'unknown-program', version: CONTENT_VERSION}));
  const result = tryResolvePinnedContent({programId, version: '9.9-unavailable'});
  assert.equal(result.available, false);
  assert.match(result.message, /pinned curriculum version is unavailable/i);
});

test('explicit reference must agree with both legacy compatibility fields', () => {
  const ref = contentRef({scope: 'global', programId, versionId: CONTENT_VERSION});
  assert.deepEqual(pinnedRef({...legacy, contentRef: ref}), ref);
  error(() => pinnedRef({...legacy, version: 'different-version', contentRef: ref}));
  error(() => pinnedRef({...legacy, programId: 'different-program', contentRef: ref}));
  error(() => pinnedRef({...legacy, contentRef: null}));
});

test('malformed references and delimiter-bearing identities cannot form keys', () => {
  for (const ref of [null, [], {scope: 'global', programId, versionId: CONTENT_VERSION, foreign: true},
    {scope: 'global', programId: 'a|b', versionId: 'c'},
    {scope: 'global', programId, versionId: ''},
    {scope: 'other-workspace', programId, versionId: CONTENT_VERSION}]) error(() => contentRef(ref));
  assert.equal(contentKey(contentRef({scope: 'global', programId, versionId: CONTENT_VERSION})),
    JSON.stringify(['global', programId, CONTENT_VERSION]));
});

test('deeply nested published content and registry returns cannot be mutated', () => {
  const program = resolvePinnedProgram(legacy), originalTitle = program.title;
  assert.ok(Object.isFrozen(program));
  assert.ok(Object.isFrozen(program.lessons));
  assert.ok(Object.isFrozen(program.lessons[0].quiz[0].options));
  assert.throws(() => { program.title = 'Edited history'; }, TypeError);
  assert.throws(() => { program.lessons[0].quiz[0].options[0] = 'Changed answer'; }, TypeError);
  assert.equal(resolvePinnedProgram(legacy).title, originalTitle);
});

test('registry owns detached content even when its caller later changes source objects', () => {
  const input = structuredClone(resolvePinnedContent(legacy));
  const registry = createCurriculumRegistry([input]);
  input.program.title = 'Caller changed title';
  input.program.lessons[0].lessonText = 'Caller edited instruction';
  assert.notEqual(registry.resolve(input.ref).program.title, input.program.title);
  assert.notEqual(registry.resolve(input.ref).program.lessons[0].lessonText, input.program.lessons[0].lessonText);
});

test('same program/version in two scopes are distinct, and workspace content needs explicit allowed scope', () => {
  const global = structuredClone(resolvePinnedContent(legacy));
  const workspace = structuredClone(global);
  workspace.ref.scope = 'tw-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  workspace.program.title = 'Workspace-only fixture title';
  const registry = createCurriculumRegistry([global, workspace]);
  error(() => registry.resolve(workspace.ref), 404);
  assert.equal(registry.resolve(workspace.ref, ['global', workspace.ref.scope]).program.title, workspace.program.title);
  assert.notEqual(registry.resolve(global.ref).program.title, workspace.program.title);
});

test('multiple explicit versions coexist and old decisions keep their original standard', () => {
  const old = structuredClone(resolvePinnedContent(legacy));
  const next = structuredClone(old);
  next.ref.versionId = 'test-fixture-v2';
  next.program.title = 'A changed future title';
  next.program.practicalAssessment.rubric[0].dimension = 'Changed rubric label';
  const registry = createCurriculumRegistry([old, next]);
  const e = {...legacy, attempts: [{id: 'unchanged-attempt', decision: {scores: [3,3,3,3]}}]};
  assert.equal(registry.resolve(pinnedRef(e)).program.title, old.program.title);
  assert.equal(registry.resolve(pinnedRef(e)).program.practicalAssessment.rubric[0].dimension,
    old.program.practicalAssessment.rubric[0].dimension);
  assert.equal(registry.resolve(next.ref).program.title, next.program.title);
  assert.deepEqual(e.attempts[0].decision.scores, [3,3,3,3]);
});

test('immutable registry rejects duplicate reference keys and mismatched pathway identity', () => {
  const snapshot = resolvePinnedContent(legacy);
  error(() => createCurriculumRegistry([snapshot, snapshot]));
  const wrong = structuredClone(snapshot);
  wrong.ref.programId = 'different-program';
  error(() => createCurriculumRegistry([wrong]));
});

test('has and safe UI result do not invent availability', () => {
  const ref = pinnedRef(legacy);
  assert.equal(curriculumRegistry.has(ref), true);
  assert.equal(curriculumRegistry.has({...ref, versionId: 'unknown'}), false);
  assert.equal(tryResolvePinnedContent(legacy).available, true);
});
