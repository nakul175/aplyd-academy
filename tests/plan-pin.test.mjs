import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const app = resolve(process.env.ACADEMY_APP_PATH ?? '.');
const engine = await import(pathToFileURL(resolve(app, '.sites-runtime/engine.mjs')).href);
const plan = await import(pathToFileURL(resolve(app, '.sites-runtime/plan.mjs')).href);
const { applyCommand, freshWorkspace, programs, RuleError, planOptions } = engine;
const { learnerNextAction, projectPlanTasks } = plan;
const now = '2026-10-05T08:00:00.000Z',
  p = programs[1];
const prepare = () => {
  let s = applyCommand(freshWorkspace(), { type: 'enroll', programId: p.id }, now);
  return applyCommand(
    s,
    {
      type: 'plan-task',
      kind: 'lesson',
      enrollmentId: s.enrollments[0].id,
      lessonId: p.lessons[0].id,
      dueDate: null,
    },
    now,
  );
};
const mismatchVariants = [
  [
    'unknown version with agreeing explicit ref',
    (e) => {
      e.version = 'unavailable-training-version';
      e.contentRef.versionId = e.version;
    },
  ],
  [
    'legacy version disagrees with explicit ref',
    (e) => {
      e.version = 'different-legacy-version';
    },
  ],
  [
    'explicit ref version disagrees with legacy version',
    (e) => {
      e.contentRef.versionId = 'different-ref-version';
    },
  ],
  [
    'known other program ref disagrees with enrollment',
    (e) => {
      e.contentRef.programId = programs[0].id;
    },
  ],
  [
    'private scope cannot fall back to global snapshot',
    (e) => {
      e.contentRef.scope = 'tw-' + crypto.randomUUID();
    },
  ],
  [
    'malformed explicit ref cannot silently fall back',
    (e) => {
      e.contentRef.extraAuthority = 'admin';
    },
  ],
];
for (const [name, corrupt] of mismatchVariants)
  test('whole-record plan adapter blocks ' + name, () => {
    const original = prepare(),
      s = structuredClone(original),
      e = s.enrollments[0];
    corrupt(e);
    const before = JSON.stringify(s);
    assert.equal(planOptions(now).resolveProgram(e.programId, e.version, e), undefined);
    assert.equal(learnerNextAction(s, planOptions(now)).kind, 'unavailable');
    const projected = projectPlanTasks(s, s.learningPlan, planOptions(now));
    assert.equal(projected[0].blocked, true);
    assert.match(projected[0].blockedReason, /pinned/);
    assert.throws(
      () =>
        applyCommand(
          s,
          { type: 'plan-task', kind: 'lesson', enrollmentId: e.id, lessonId: p.lessons[1].id },
          now,
        ),
      (x) => x instanceof RuleError && x.status === 409,
    );
    assert.equal(JSON.stringify(s), before);
    assert.equal(s.learningPlan.tasks[0].title, original.learningPlan.tasks[0].title);
  });
test('legacy exact version stays readable; missing legacy version never selects current content', () => {
  let s = applyCommand(freshWorkspace(), { type: 'enroll', programId: p.id }, now);
  delete s.enrollments[0].contentRef;
  assert.equal(learnerNextAction(s, planOptions(now)).kind, 'lesson');
  const valid = applyCommand(
    s,
    { type: 'plan-task', kind: 'lesson', enrollmentId: s.enrollments[0].id, lessonId: p.lessons[0].id },
    now,
  );
  assert.equal(valid.learningPlan.tasks.length, 1);
  delete s.enrollments[0].version;
  assert.equal(learnerNextAction(s, planOptions(now)).kind, 'unavailable');
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: 'plan-task', kind: 'lesson', enrollmentId: s.enrollments[0].id, lessonId: p.lessons[0].id },
        now,
      ),
    (x) => x instanceof RuleError && x.status === 409,
  );
});
