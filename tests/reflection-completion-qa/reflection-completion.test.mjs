import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  reviewedWorkspace,
  addReflectionTask,
  saveReflection,
  twoReflections,
  recap,
  CREATED,
  FIRST,
  SECOND,
  FIRST_WEEK,
  SECOND_WEEK,
} from './workflow.mjs';
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
// Adopted regression: always the actual checkout model built by ./build-model.mjs.
const output = resolve(
  process.env.ACADEMY_REFLECTION_QA_OUTPUT ?? app + '/.sites-runtime/reflection-completion-qa',
);
mkdirSync(output, { recursive: true });
globalThis.fetch = () => {
  throw new Error('Network disabled in reflection regression tests.');
};
const model = await import(pathToFileURL(output + '/model.mjs'));
const passedCases = [];
const test = (name, fn) =>
  nodeTest(name, () => {
    fn();
    passedCases.push(name);
  });
let assertions = 0;
const eq = (a, b) => {
    assert.deepEqual(a, b);
    assertions++;
  },
  ok = (a) => {
    assert.ok(a);
    assertions++;
  },
  raises = (fn, matcher) => {
    assert.throws(fn, matcher);
    assertions++;
  };
const progress = (state, task, extra = {}) =>
  model.taskProgress(state, task, model.planOptions(SECOND_WEEK, extra));
function planned() {
  const f = reviewedWorkspace(model),
    p = addReflectionTask(model, f.state, f.enrollmentId);
  return { ...f, ...p };
}

test('actual engine newest-first followups retain first qualifying completion after second save', () => {
  const f = planned(),
    first = saveReflection(model, f.state, f.enrollmentId, FIRST),
    second = saveReflection(model, first, f.enrollmentId, SECOND);
  eq(progress(first, f.task).completedAt, FIRST);
  eq(progress(second, f.task).completedAt, FIRST);
  eq(progress(second, f.task).status, 'done');
  eq(progress(second, f.task).label, 'Reflection saved');
  eq(
    second.followups.map((r) => r.createdAt),
    [SECOND, FIRST],
  );
  eq(second.learningPlan.tasks.length, 1);
  eq(second.learningPlan.tasks[0].completedAt, null);
});
test('actual weekly recap keeps old task in original week and never recounts it for later reflection', () => {
  const f = twoReflections(model),
    first = recap(model, f.state, FIRST_WEEK),
    second = recap(model, f.state, SECOND_WEEK);
  eq(first.evidence.reflections, 1);
  eq(first.evidence.total, 1);
  eq(second.evidence.reflections, 0);
  eq(second.evidence.total, 0);
  eq(model.learningPlanSummary(f.state, model.planOptions(FIRST_WEEK)).completedActivitiesThisWeek, 1);
  eq(model.learningPlanSummary(f.state, model.planOptions(SECOND_WEEK)).completedActivitiesThisWeek, 0);
  eq(f.state.followups.length, 2);
});
test('earliest qualifying date is independent of history ordering and derivation leaves inputs unchanged', () => {
  const f = twoReflections(model),
    original = structuredClone(f.state);
  for (const rows of [
    f.state.followups,
    [...f.state.followups].reverse(),
    [f.state.followups[1], f.state.followups[0], { ...f.state.followups[0], id: 'same-date-copy' }],
  ]) {
    const s = { ...f.state, followups: rows },
      before = structuredClone(s);
    eq(progress(s, f.task).completedAt, FIRST);
    eq(s, before);
  }
  eq(f.state, original);
});
test('same-enrollment reflection before task creation is excluded', () => {
  let f = reviewedWorkspace(model);
  f.state = saveReflection(model, f.state, f.enrollmentId, '2026-10-05T07:59:59.999Z');
  const p = addReflectionTask(model, f.state, f.enrollmentId);
  f = { ...f, ...p };
  eq(progress(f.state, f.task).status, 'planned');
  const s = saveReflection(model, f.state, f.enrollmentId, FIRST);
  eq(progress(s, f.task).completedAt, FIRST);
  eq(s.followups.length, 2);
});
test('actual separately enrolled/reviewed pathway reflection cannot move exact own task date', () => {
  const f = twoReflections(model),
    other = reviewedWorkspace(model, f.state, 'farmer-work-records'),
    s = saveReflection(model, other.state, other.enrollmentId, '2026-10-14T11:00:00.000Z');
  eq(s.enrollments.length, 2);
  eq(s.followups[0].enrollmentId, other.enrollmentId);
  eq(progress(s, f.task).completedAt, FIRST);
});
test('explicit new later plan item binds to the first action after its own creation', () => {
  let f = planned(),
    s = saveReflection(model, f.state, f.enrollmentId, FIRST);
  const next = addReflectionTask(model, s, f.enrollmentId, '2026-10-12T09:00:00.000Z');
  eq(progress(next.state, next.task).status, 'planned');
  s = saveReflection(model, next.state, f.enrollmentId, SECOND);
  eq(progress(s, f.task).completedAt, FIRST);
  eq(progress(s, next.task).completedAt, SECOND);
  eq(s.learningPlan.tasks.length, 2);
  eq(recap(model, s, SECOND_WEEK).evidence.reflections, 1);
});
test('skipped item remains skipped despite legitimate later reflections and contributes no completion', () => {
  const f = planned();
  let s = model.applyCommand(
    f.state,
    { type: 'plan-task-status', taskId: f.task.id, status: 'skipped' },
    '2026-10-05T09:00:00.000Z',
  );
  s = saveReflection(model, s, f.enrollmentId, FIRST);
  s = saveReflection(model, s, f.enrollmentId, SECOND);
  const task = s.learningPlan.tasks[0];
  eq(progress(s, task).status, 'skipped');
  eq(progress(s, task).completedAt, null);
  eq(recap(model, s, FIRST_WEEK).evidence.reflections, 0);
  eq(s.followups.length, 2);
});
test('retained completed history and existing blocked reasons survive suspension/authority/lifecycle changes', () => {
  const done = twoReflections(model),
    s = structuredClone(done.state);
  s.enrollments[0].record.status = 'suspended';
  s.enrollments[0].withdrawn = true;
  eq(progress(s, done.task, { memberActive: false, canLearn: false }).completedAt, FIRST);
  eq(progress(s, done.task, { memberActive: false }).blocked, false);
  eq(s.followups.length, 2);
  const f = planned();
  eq(
    progress(f.state, f.task, { memberActive: false }).blockedReason,
    'Workspace access was removed. Your own history remains available.',
  );
  const withdrawn = structuredClone(f.state);
  withdrawn.enrollments[0].withdrawn = true;
  eq(progress(withdrawn, f.task).blockedReason, 'This enrollment was withdrawn.');
  const suspended = structuredClone(f.state);
  suspended.enrollments[0].record.status = 'suspended';
  eq(
    progress(suspended, f.task).blockedReason,
    'An active reviewed practice record is needed for a new reflection.',
  );
  const before = structuredClone(suspended);
  raises(
    () => saveReflection(model, suspended, f.enrollmentId, FIRST),
    (e) => e instanceof model.RuleError && e.status === 422,
  );
  eq(suspended, before);
});
test('no match/malformed dates never fabricate completion; future-only history keeps existing recap diagnostic', () => {
  const f = planned(),
    s = {
      ...f.state,
      followups: [
        { enrollmentId: f.enrollmentId, createdAt: 'not-a-date' },
        { enrollmentId: f.enrollmentId, createdAt: '' },
        { enrollmentId: 'unrelated', createdAt: FIRST },
      ],
    };
  eq(progress(s, f.task).status, 'planned');
  eq(progress(s, f.task).completedAt, null);
  const future = saveReflection(model, f.state, f.enrollmentId, '2026-10-20T09:00:00.000Z'),
    review = recap(model, future, FIRST_WEEK);
  eq(progress(future, f.task).completedAt, '2026-10-20T09:00:00.000Z');
  eq(review.completionDateNeedsCheck, 1);
  eq(review.evidence.reflections, 0);
});
test('exact creation instant qualifies; one millisecond earlier does not; ties retain all raw history', () => {
  const f = planned(),
    early = saveReflection(model, f.state, f.enrollmentId, '2026-10-05T07:59:59.999Z');
  eq(progress(early, f.task).status, 'planned');
  let s = saveReflection(model, early, f.enrollmentId, CREATED);
  s = saveReflection(model, s, f.enrollmentId, CREATED);
  s = saveReflection(model, s, f.enrollmentId, FIRST);
  eq(progress(s, f.task).completedAt, CREATED);
  eq(s.followups.length, 4);
  eq(
    s.followups.map((f) => f.createdAt),
    [FIRST, CREATED, CREATED, '2026-10-05T07:59:59.999Z'],
  );
});
test('completed exact history does not require a newer pin and private reflection bodies stay out of recap exports', () => {
  const f = twoReflections(model),
    s = structuredClone(f.state);
  s.enrollments[0].version = 'unavailable-retained-version';
  s.enrollments[0].contentRef.versionId = s.enrollments[0].version;
  s.followups[0].reflection = 'PRIVATE_REFLECTION_BODY_CANARY';
  s.learningPlan.personalGoal = 'PRIVATE_GOAL_CANARY';
  s.learningPlan.tasks[0].note = 'PRIVATE_NOTE_CANARY';
  const before = structuredClone(s);
  eq(progress(s, f.task).completedAt, FIRST);
  const review = recap(model, s, FIRST_WEEK);
  eq(review.evidence.reflections, 1);
  const exported = JSON.stringify(model.prepareOwnWeeklyRecap(review));
  for (const canary of [
    'PRIVATE_REFLECTION_BODY_CANARY',
    'PRIVATE_GOAL_CANARY',
    'PRIVATE_NOTE_CANARY',
    f.enrollmentId,
    f.task.id,
  ])
    ok(!exported.includes(canary));
  eq(s, before);
  eq(s.enrollments[0].version, 'unavailable-retained-version');
});
nodeTest.after(() =>
  writeFileSync(
    output + '/after-test-evidence.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        groups: 11,
        passed: passedCases.length,
        passedCases,
        assertions,
        source: JSON.parse(readFileSync(output + '/source-evidence.json', 'utf8')).model,
        strictPlanTypecheck: true,
        limits: [
          'Actual engine lifecycle and immutable curriculum sample review in memory; actual checkout plan and weekly recap. Some explicitly marked lifecycle/read variants change own in-memory projection fields only. Fetch disabled; no API, browser, SQL, app build, persisted fixtures or checkout edits.',
        ],
      },
      null,
      2,
    ),
  ),
);
