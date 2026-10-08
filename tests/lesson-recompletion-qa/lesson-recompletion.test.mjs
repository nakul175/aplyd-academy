// M7 regression: a completed lesson cannot be completed again. Pure in-memory, synthetic fixtures only, no network.
// Uses the actual-checkout model bundle built by tests/reflection-completion-qa/build-model.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  app = resolve(process.env.ACADEMY_APP_PATH ?? resolve(here, '../..'));
const bundle =
  resolve(process.env.ACADEMY_REFLECTION_QA_OUTPUT ?? app + '/.sites-runtime/reflection-completion-qa') +
  '/model.mjs';
assert.ok(existsSync(bundle), 'Build the model first: node tests/reflection-completion-qa/build-model.mjs');
globalThis.fetch = () => {
  throw new Error('Network disabled in lesson regression tests.');
};
const { applyCommand, freshWorkspace, planOptions, RuleError, programs, taskProgress } = await import(
  pathToFileURL(bundle)
);
const p = programs.find((x) => x.id === 'msme-customer-operations'),
  [l1, l2] = p.lessons;
const answers = (l) => l.quiz.map((q) => q.correctOptionIndex);
const run = (
  s,
  id,
  l,
  at,
  practice = 'I checked this fictional packet against every source and kept unsupported claims out.',
) => applyCommand(s, { type: 'lesson', enrollmentId: id, lessonId: l.id, answers: answers(l), practice }, at);
function setup() {
  let s = applyCommand(freshWorkspace(), { type: 'enroll', programId: p.id }, '2026-10-04T06:00:00.000Z');
  const id = s.enrollments[0].id;
  s = applyCommand(
    s,
    {
      type: 'plan-task',
      kind: 'lesson',
      enrollmentId: id,
      lessonId: l1.id,
      dueDate: '2026-10-06',
      plannedMinutes: 20,
    },
    '2026-10-05T08:00:00.000Z',
  );
  return { s, id, task: s.learningPlan.tasks.at(-1) };
}
const conflict = (e) => e instanceof RuleError && e.status === 409 && /already complete/.test(e.message);

test('repeat completion of a completed lesson is refused with a 409 rule error', () => {
  const { s, id } = setup(),
    done = run(s, id, l1, '2026-10-06T09:00:00.000Z');
  assert.throws(() => run(done, id, l1, '2026-10-12T10:00:00.000Z'), conflict);
});
test('refusal leaves the saved completion date, practice response and plan completion untouched', () => {
  const { s, id, task } = setup(),
    done = run(s, id, l1, '2026-10-06T09:00:00.000Z'),
    before = JSON.stringify(done),
    opts = planOptions('2026-10-13T12:00:00.000Z');
  const first = taskProgress(done, task, opts).completedAt;
  assert.throws(
    () =>
      run(
        done,
        id,
        l1,
        '2026-10-12T10:00:00.000Z',
        'A different revised practice answer written a week later for the same lesson.',
      ),
    conflict,
  );
  assert.equal(JSON.stringify(done), before);
  assert.equal(done.enrollments[0].practice[l1.id].completedAt, '2026-10-06T09:00:00.000Z');
  assert.equal(taskProgress(done, task, opts).completedAt, first);
  assert.equal(done.enrollments[0].completed.filter((x) => x === l1.id).length, 1);
});
test('first completion and the next lesson still work, and a wrong answer on the first attempt is still refused as before', () => {
  const { s, id } = setup();
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: 'lesson',
          enrollmentId: id,
          lessonId: l1.id,
          answers: answers(l1).map(() => 99),
          practice: 'x'.repeat(40),
        },
        '2026-10-06T09:00:00.000Z',
      ),
    (e) => e instanceof RuleError && !conflict(e),
  );
  const a = run(s, id, l1, '2026-10-06T09:00:00.000Z'),
    b = run(a, id, l2, '2026-10-07T09:00:00.000Z');
  assert.deepEqual(b.enrollments[0].completed, [l1.id, l2.id]);
  assert.equal(b.enrollments[0].practice[l1.id].completedAt, '2026-10-06T09:00:00.000Z');
});
test('completing out of order still reports the previous-lesson rule, not the repeat rule', () => {
  const { s, id } = setup();
  assert.throws(
    () => run(s, id, l2, '2026-10-06T09:00:00.000Z'),
    (e) => e instanceof RuleError && /previous lesson/.test(e.message),
  );
});
