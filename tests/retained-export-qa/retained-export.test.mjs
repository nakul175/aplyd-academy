import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..'),
  app = resolve(
    process.env.ACADEMY_APP_PATH ??
      (existsSync(nearby + '/app/api/academy/route.ts')
        ? nearby
        : existsSync('app/api/academy/route.ts')
          ? '.'
          : 'work/aplyd-academy'),
  );
const output = resolve(
  process.env.ACADEMY_RETAINED_EXPORT_QA_OUTPUT ??
    (existsSync(app + '/lib/academy-retained-export.ts')
      ? app + '/.sites-runtime/retained-export-qa'
      : resolve(here, '../runtime')),
);
mkdirSync(output, { recursive: true });
globalThis.fetch = () => {
  throw new Error('No network permitted in retained-export pure tests.');
};
const {
  retainedLearningExportCohort: select,
  tryResolvePinnedContent,
  LEGACY_CONTENT_VERSION,
} = await import(pathToFileURL(output + '/model.mjs'));
const workspace = 'tw-11111111-1111-4111-8111-111111111111',
  otherWorkspace = 'tw-22222222-2222-4222-8222-222222222222',
  programId = 'msme-customer-operations';
const pin = (scope, versionId) => ({ scope, programId, versionId });
const cohort = (id, ref, title = id) => ({
  id,
  title,
  programId: ref.programId,
  version: ref.versionId,
  contentRef: ref,
  status: 'open',
  contentOpen: true,
  capacity: 12,
  occupied: 1,
});
const oldRef = pin(workspace, 'private-v1'),
  newRef = pin(workspace, 'private-v2'),
  old = cohort('old-cohort', oldRef, 'Own old cohort'),
  newer = cohort('new-cohort', newRef, 'Newer first-open cohort');
const own = {
  id: 'own-enrollment',
  cohortId: old.id,
  programId,
  version: oldRef.versionId,
  contentRef: oldRef,
  completed: [],
  draft: {},
  attempts: [],
  withdrawn: false,
};
const input = (overrides = {}) => ({
  enrollment: own,
  team: { id: workspace, active: true, roles: ['learner'], cohorts: [newer, old] },
  activeWorkspace: workspace,
  previewCohort: newer,
  ...overrides,
});
let assertions = 0;
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected);
  assertions++;
};
test('own older cohort wins over independently selected newer first-open preview', () => {
  equal(select(input()), old);
});
test('matching metadata remains exportable when actual exact private snapshot is unavailable', () => {
  equal(tryResolvePinnedContent(own, [workspace]).available, false);
  equal(select(input()), old);
});
test('removal returns null rather than preview fallback', () =>
  equal(select(input({ team: { id: workspace, cohorts: [newer] } })), null));
test('same cohort id repointed to newer version returns null', () =>
  equal(select(input({ team: { id: workspace, cohorts: [cohort(old.id, newRef)] } })), null));
test('same version but different program returns null', () =>
  equal(
    select(
      input({
        team: {
          id: workspace,
          cohorts: [
            {
              ...old,
              programId: 'farmer-ai-records',
              contentRef: { ...oldRef, programId: 'farmer-ai-records' },
            },
          ],
        },
      }),
    ),
    null,
  ));
test('same program/version but different scope returns null', () =>
  equal(
    select(
      input({ team: { id: workspace, cohorts: [cohort(old.id, pin(otherWorkspace, oldRef.versionId))] } }),
    ),
    null,
  ));
test('current accepted workspace must match team even with identical cohort id and pin', () =>
  equal(select(input({ activeWorkspace: otherWorkspace })), null));
test('own foreign private scope cannot be exported through current team', () => {
  const ref = pin(otherWorkspace, 'private-v1');
  equal(
    select(
      input({
        enrollment: { ...own, contentRef: ref },
        team: { id: workspace, cohorts: [cohort(old.id, ref)] },
      }),
    ),
    null,
  );
});
test('personal lab enrollment without cohort returns null despite unrelated preview', () =>
  equal(
    select(input({ enrollment: { ...own, cohortId: undefined }, team: null, activeWorkspace: 'lab' })),
    null,
  ));
test('personal lab never adds cohort metadata even if malformed input supplies shared fields', () =>
  equal(select(input({ activeWorkspace: 'lab' })), null));
test('missing team returns null', () => equal(select(input({ team: null })), null));
test('missing cohort id returns null', () =>
  equal(select(input({ enrollment: { ...own, cohortId: undefined } })), null));
test('malformed own full pin is not replaced by preview', () =>
  equal(select(input({ enrollment: { ...own, contentRef: { ...oldRef, extra: true } } })), null));
test('inconsistent cohort legacy version and explicit pin fails closed', () =>
  equal(select(input({ team: { id: workspace, cohorts: [{ ...old, version: 'private-v9' }] } })), null));
test('inconsistent own legacy version and explicit pin fails closed', () =>
  equal(select(input({ enrollment: { ...own, version: 'private-v9' } })), null));
test('duplicate current cohort ids are ambiguous and excluded', () =>
  equal(select(input({ team: { id: workspace, cohorts: [old, { ...old, title: 'Duplicate' }] } })), null));
test('legacy global cohort pin matches using actual pinnedRef semantics', () => {
  const e = { ...own, version: LEGACY_CONTENT_VERSION };
  delete e.contentRef;
  const c = { ...old, version: LEGACY_CONTENT_VERSION };
  delete c.contentRef;
  equal(select(input({ enrollment: e, team: { id: workspace, cohorts: [c] } })), c);
});
test('removed membership retains exact accepted own metadata without granting new access', () =>
  equal(select(input({ team: { id: workspace, active: false, roles: [], cohorts: [old] } })), old));
test('retired or paused exact cohort metadata does not become newer or open', () => {
  const c = { ...old, status: 'paused', contentOpen: false };
  equal(select(input({ team: { id: workspace, cohorts: [c] } })), c);
});
test('preview-only export preserves selected unavailable cohort behavior', () => {
  const args = input({ enrollment: null });
  equal(select(args), newer);
  assert.equal(select(args), newer);
  assertions++;
});
test('preview-only with no selected cohort remains null', () =>
  equal(select(input({ enrollment: null, previewCohort: null })), null));
test('own result is detached and source inputs unchanged', () => {
  const args = input(),
    before = structuredClone(args),
    result = select(args);
  assert.notEqual(result, args.team.cohorts[1]);
  assertions++;
  result.title = 'Modified download object';
  result.contentRef.versionId = 'tampered';
  equal(args, before);
});
test.after(() =>
  writeFileSync(
    output + '/pure-test-evidence.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        groups: 22,
        assertions,
        source: JSON.parse(readFileSync(output + '/source-evidence.json', 'utf8')),
        limitations: [
          'Pure staged helper plus actual root pin/key/registry only. Projected metadata fixtures are in memory. Runtime browser acceptance NOT RUN.',
        ],
      },
      null,
      2,
    ),
  ),
);
