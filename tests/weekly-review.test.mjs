import test from 'node:test';
import assert from 'node:assert/strict';
import { freshLearningPlan, learningPlanSummary, applyLearningPlanCommand } from '../lib/academy-plan.ts';
import {
  deriveOwnWeeklyReview,
  prepareOwnWeeklyRecap,
  renderOwnWeeklyRecapHtml,
} from '../lib/academy-weekly-review.mjs';

const NOW = '2026-10-06T08:00:00.000Z',
  MONDAY = '2026-10-05T10:00:00.000Z',
  OLD = '2026-10-03T08:00:00.000Z';
const program = {
  id: 'memory-course',
  title: 'Pinned synthetic course',
  lessons: [
    { id: 'lesson-1', title: 'Original saved lesson' },
    { id: 'lesson-2', title: 'Next saved lesson' },
  ],
  practicalAssessment: { title: 'Saved submission' },
};
const options = (overrides = {}) => ({
  now: NOW,
  resolveProgram: (id, version, record) =>
    id === program.id && (record?.contentRef?.versionId ?? version) === 'exact-old' ? program : undefined,
  ...overrides,
});
const enrollment = (overrides = {}) => ({
  id: 'own-e',
  programId: program.id,
  version: 'exact-old',
  contentRef: { scope: 'global', programId: program.id, versionId: 'exact-old' },
  completed: [],
  practice: {},
  attempts: [],
  appeals: [],
  withdrawn: false,
  ...overrides,
});
function task(id, kind = 'practice', overrides = {}) {
  return {
    id,
    kind,
    enrollmentId: kind === 'practice' ? null : 'own-e',
    lessonId: kind === 'lesson' ? 'lesson-1' : null,
    title: 'OWN_TITLE_CANARY ' + id,
    dueDate: '2026-10-06',
    plannedMinutes: 15,
    note: 'OWN_NOTE_CANARY',
    status: 'planned',
    createdAt: OLD,
    updatedAt: OLD,
    completedAt: null,
    ...overrides,
  };
}
function state(tasks = [], overrides = {}) {
  return {
    profile: { context: 'msme', name: 'OWN_IDENTITY_CANARY' },
    enrollments: [enrollment()],
    followups: [],
    paused: [],
    learningPlan: { ...freshLearningPlan(), personalGoal: 'OWN_GOAL_CANARY', timeZone: 'UTC', tasks },
    ...overrides,
  };
}
const review = (s, opts = options()) => deriveOwnWeeklyReview(learningPlanSummary(s, opts), opts.now);

test('empty own plan gives distinct zero counts and saved timezone without mutation', () => {
  const s = state(),
    before = JSON.stringify(s),
    m = review(s);
  assert.ok(m);
  assert.equal(m.planned.activities, 0);
  assert.equal(m.evidence.total, 0);
  assert.equal(m.selfReported.practice, 0);
  assert.equal(m.week.timeZone, 'UTC');
  assert.equal(JSON.stringify(s), before);
});
test('actual planning commands retain permitted long linked titles without suppressing the recap', () => {
  const p = {
    id: 'long-title-course',
    title: 'C'.repeat(160),
    lessons: [{ id: 'l1', title: 'L'.repeat(160) }],
    practicalAssessment: { title: 'S'.repeat(160) },
  };
  for (const kind of ['lesson', 'practical', 'reflection']) {
    const s = {
      enrollments: [
        {
          id: 'own-long',
          programId: p.id,
          version: 'exact',
          completed: kind === 'lesson' ? [] : ['l1'],
          practice: {},
          attempts: [],
          appeals: [],
          record: kind === 'reflection' ? { status: 'active', title: p.title } : undefined,
        },
      ],
      followups: [],
      paused: [],
    };
    const opts = { now: NOW, resolveProgram: () => p, newId: () => kind + '-long' };
    const command = {
      type: 'plan-task',
      kind,
      enrollmentId: 'own-long',
      ...(kind === 'lesson' ? { lessonId: 'l1' } : {}),
    };
    s.learningPlan = applyLearningPlanCommand(s, command, opts);
    assert.equal(s.learningPlan.tasks[0].title.length, kind === 'reflection' ? 171 : 160);
    const m = review(s, opts);
    assert.ok(m);
    assert.equal(m.attention.undatedOpen, 1);
    assert.equal(m.attentionRows[0].title, s.learningPlan.tasks[0].title);
    assert.ok(!JSON.stringify(prepareOwnWeeklyRecap(m)).includes(s.learningPlan.tasks[0].title));
  }
});
test('oversized private practice and excessive linked titles remain unavailable for review', () => {
  for (const [kind, length] of [
    ['practice', 101],
    ['lesson', 201],
  ]) {
    const summary = learningPlanSummary(
      state([task('oversized-' + kind, kind, { title: 'X'.repeat(length) })]),
      options(),
    );
    assert.equal(deriveOwnWeeklyReview(summary, NOW), null);
  }
});
test('weekly intention follows due dates and includes completed scheduled items but excludes skipped', () => {
  const s = state([
      task('open'),
      task('done', 'practice', { status: 'done', completedAt: MONDAY }),
      task('skipped', 'practice', { status: 'skipped' }),
      task('old', 'practice', { dueDate: '2026-10-04' }),
      task('undated', 'practice', { dueDate: null }),
    ]),
    m = review(s);
  assert.equal(m.planned.activities, 2);
  assert.equal(m.planned.minutes, 30);
  assert.equal(m.planned.stillOpen, 1);
  assert.equal(m.attention.skippedThisWeek, 1);
  assert.equal(m.attention.undatedOpen, 1);
  assert.equal(m.attention.earlierOpen, 1);
});
test('self-reported practice completion never becomes saved course evidence', () => {
  const s = state([task('private', 'practice', { status: 'done', completedAt: MONDAY })]),
    m = review(s);
  assert.equal(m.selfReported.practice, 1);
  assert.equal(m.evidence.total, 0);
  assert.deepEqual(s.enrollments[0].completed, []);
});
test('actual projected lesson/submission/reflection actions remain distinct from practice', () => {
  const s = state([
    task('lesson', 'lesson'),
    task('submission', 'practical'),
    task('reflection', 'reflection'),
    task('private', 'practice', { status: 'done', completedAt: MONDAY }),
  ]);
  s.enrollments[0] = enrollment({
    completed: ['lesson-1'],
    practice: { 'lesson-1': { answer: 'PRIVATE_EVIDENCE_CANARY', completedAt: MONDAY } },
    attempts: [
      {
        id: 'attempt',
        submittedAt: MONDAY,
        fields: { secret: 'PRIVATE_EVIDENCE_CANARY' },
        decision: { passed: false, score: 0 },
      },
    ],
    record: { status: 'suspended' },
  });
  s.followups = [
    { id: 'reflection', enrollmentId: 'own-e', createdAt: MONDAY, reflection: 'PRIVATE_REFLECTION_CANARY' },
  ];
  const m = review(s);
  assert.deepEqual(m.evidence, { lessons: 1, submissions: 1, reflections: 1, total: 3 });
  assert.equal(m.selfReported.practice, 1);
  assert.equal(m.attention.openTotal, 0);
  assert.ok(!JSON.stringify(m).includes('PRIVATE_EVIDENCE_CANARY'));
  assert.ok(!JSON.stringify(m).includes('PRIVATE_REFLECTION_CANARY'));
});
test('forged stored linked done flag is ignored by actual existing projection', () => {
  const m = review(state([task('forged', 'lesson', { status: 'done', completedAt: MONDAY })]));
  assert.equal(m.evidence.total, 0);
  assert.equal(m.selfReported.practice, 0);
  assert.equal(m.planned.stillOpen, 1);
});
test('planned dates and completion dates are independent across week boundaries', () => {
  const s = state([
      task('earlier-plan', 'practice', { dueDate: '2026-10-04', status: 'done', completedAt: MONDAY }),
      task('planned-here-done-old', 'practice', { status: 'done', completedAt: OLD }),
    ]),
    m = review(s);
  assert.equal(m.planned.activities, 1);
  assert.equal(m.selfReported.practice, 1);
  assert.equal(m.planned.minutes, 15);
});
test('saved timezone places Sunday UTC evidence into Monday local week', () => {
  const now = '2026-10-05T01:00:00.000Z',
    completedAt = '2026-10-04T20:00:00.000Z';
  const s = state([
    task('cross-midnight', 'practice', { dueDate: '2026-10-05', status: 'done', completedAt }),
  ]);
  s.learningPlan.timeZone = 'Asia/Kolkata';
  let m = review(s, options({ now }));
  assert.deepEqual(m.week, {
    start: '2026-10-05',
    end: '2026-10-11',
    timeZone: 'Asia/Kolkata',
    today: '2026-10-05',
  });
  assert.equal(m.selfReported.practice, 1);
  s.learningPlan.timeZone = 'UTC';
  m = review(s, options({ now }));
  assert.equal(m.selfReported.practice, 0);
});
test('DST repeated hour does not invent duplicate practice or elapsed time', () => {
  const now = '2026-11-01T07:00:00.000Z',
    s = state([
      task('dst', 'practice', {
        dueDate: '2026-11-01',
        status: 'done',
        completedAt: '2026-11-01T06:30:00.000Z',
      }),
    ]);
  s.learningPlan.timeZone = 'America/New_York';
  const m = review(s, options({ now }));
  assert.equal(m.selfReported.practice, 1);
  assert.equal(m.planned.minutes, 15);
  assert.ok(!Object.hasOwn(m, 'actualMinutes'));
  assert.ok(!Object.hasOwn(m, 'streak'));
});
test('blocked, undated and earlier open attention counts overlap explicitly', () => {
  const s = state([
    task('missing', 'lesson', { dueDate: null }),
    task('earlier', 'lesson', { lessonId: 'lesson-2', dueDate: '2026-10-04' }),
    task('skipped', 'lesson', { status: 'skipped', dueDate: null }),
  ]);
  s.enrollments[0].version = 'unknown-exact';
  s.enrollments[0].contentRef.versionId = 'unknown-exact';
  const m = review(s);
  assert.equal(m.attention.blockedOpen, 2);
  assert.equal(m.attention.undatedOpen, 1);
  assert.equal(m.attention.earlierOpen, 1);
  assert.equal(m.attention.openTotal, 2);
  assert.equal(m.attentionRows.length, 2);
  assert.match(m.attentionRows[0].blockedReason, /pinned learning content/);
});
test('unknown exact pin never resolves a newer title but retains existing saved evidence', () => {
  const s = state([
    task('history', 'lesson'),
    task('next', 'lesson', { lessonId: 'lesson-2', dueDate: null }),
  ]);
  s.enrollments[0] = enrollment({
    version: 'unknown-exact',
    contentRef: { scope: 'global', programId: program.id, versionId: 'unknown-exact' },
    completed: ['lesson-1'],
    practice: { 'lesson-1': { completedAt: MONDAY } },
  });
  let newerAsked = false;
  const m = review(
    s,
    options({
      resolveProgram: (id, version) => {
        if (version === 'latest') newerAsked = true;
        return undefined;
      },
    }),
  );
  assert.equal(m.evidence.lessons, 1);
  assert.equal(m.attention.blockedOpen, 1);
  assert.equal(newerAsked, false);
  assert.equal(m.attentionRows[0].title, 'OWN_TITLE_CANARY next');
});
test('inactive and removed learner role preserve history without relaxing current blocks', () => {
  const s = state([
    task('history', 'practice', { status: 'done', completedAt: MONDAY }),
    task('open', 'lesson'),
  ]);
  let m = review(s, options({ memberActive: false, canLearn: false }));
  assert.equal(m.selfReported.practice, 1);
  assert.equal(m.attention.blockedOpen, 1);
  assert.match(m.attentionRows[0].blockedReason, /access was removed/);
  m = review(state([task('role', 'lesson')]), options({ canLearn: false }));
  assert.equal(m.attention.blockedOpen, 1);
  assert.match(m.attentionRows[0].blockedReason, /membership/);
});
test('paused lesson and open appeal practical keep existing blocked gates', () => {
  const s = state([task('paused', 'lesson'), task('appeal', 'practical')]);
  s.paused = [program.id];
  let m = review(s);
  assert.equal(m.attention.blockedOpen, 2);
  s.paused = [];
  s.enrollments[0].completed = ['lesson-1', 'lesson-2'];
  s.enrollments[0].appeals = [{ id: 'open-appeal', status: 'open' }];
  m = review(s);
  assert.equal(m.attention.blockedOpen, 1);
  assert.match(m.attentionRows[0].blockedReason, /review or appeal/);
});
test('missing and future completion times are separate and cannot inflate this week', () => {
  const s = state([
      task('missing', 'practice', { status: 'done', completedAt: null }),
      task('future', 'practice', { status: 'done', completedAt: '2026-10-07T08:00:00.000Z' }),
    ]),
    m = review(s);
  assert.equal(m.selfReported.practice, 0);
  assert.equal(m.completionDateNeedsCheck, 2);
});
test('six-row attention preview keeps full counts and existing source is unchanged', () => {
  const s = state(Array.from({ length: 10 }, (_, i) => task('private-' + i, 'practice', { dueDate: null }))),
    before = JSON.stringify(s),
    m = review(s);
  assert.equal(m.attentionRows.length, 6);
  assert.equal(m.attentionRowsTotal, 10);
  assert.equal(m.attention.undatedOpen, 10);
  assert.equal(JSON.stringify(s), before);
});
test('malformed week/timezone/task/date/duplicate/oversized projection is refused', () => {
  const base = learningPlanSummary(state([task('valid')]), options());
  for (const alter of [
    (m) => (m.plan.timeZone = 'Invented/Zone'),
    (m) => (m.week.start = '2026-10-04'),
    (m) => (m.today = '2026-10-07'),
    (m) => (m.tasks[0].dueDate = '2026-02-30'),
    (m) => (m.tasks[0].plannedMinutes = NaN),
    (m) => (m.tasks[0].status = 'passed'),
    (m) => (m.tasks[0].blocked = undefined),
    (m) => m.tasks.push({ ...m.tasks[0] }),
    (m) => (m.tasks = Array.from({ length: 201 }, (_, i) => ({ ...m.tasks[0], id: String(i) }))),
  ]) {
    const j = structuredClone(base);
    alter(j);
    assert.equal(deriveOwnWeeklyReview(j, NOW), null);
  }
});
test('recap strictly omits free text/evidence/contact/account/workspace/task/pin fields', () => {
  const s = state([task('SECRET_TASK_ID', 'practice', { status: 'done', completedAt: MONDAY })]);
  s.contact = 'SECRET_CONTACT';
  s.accountId = 'SECRET_ACCOUNT';
  s.workspaceId = 'SECRET_WORKSPACE';
  const m = review(s);
  Object.assign(m, {
    body: 'SECRET_BODY',
    email: 'SECRET_EMAIL',
    state: s,
    accountId: 'SECRET_ACCOUNT',
    contentRef: { versionId: 'SECRET_PIN' },
  });
  const recap = prepareOwnWeeklyRecap(m),
    j = JSON.stringify(recap);
  for (const marker of [
    'OWN_TITLE_CANARY',
    'OWN_NOTE_CANARY',
    'OWN_GOAL_CANARY',
    'OWN_IDENTITY_CANARY',
    'SECRET_',
  ])
    assert.ok(!j.includes(marker));
  assert.equal(recap.selfReportedPractice, 1);
  assert.equal(recap.week.timeZone, 'UTC');
  assert.equal(recap.format, 'aplyd-academy-own-weekly-plan-recap');
});
test('recap is detached and cannot mutate saved own plan through returned fields', () => {
  const s = state([task('safe')]),
    before = JSON.stringify(s),
    m = review(s),
    recap = prepareOwnWeeklyRecap(m);
  recap.week.start = '2000-01-01';
  recap.planned.activities = 900;
  assert.equal(m.planned.activities, 1);
  assert.equal(JSON.stringify(s), before);
});
test('invalid export count/budget/evidence total cannot produce a fabricated recap', () => {
  for (const alter of [
    (m) => (m.planned.minutes = -1),
    (m) => (m.planned.budgetMinutes = 0),
    (m) => (m.evidence.total = 1),
    (m) => (m.selfReported.practice = 201),
    (m) => (m.attention.openTotal = NaN),
  ]) {
    const m = review(state([task('safe')]));
    alter(m);
    assert.throws(() => prepareOwnWeeklyRecap(m));
  }
});
test('printable HTML contains only aggregate whitelist and no scripts/external assets', () => {
  const m = review(state([task('SECRET_TASK_ID')])),
    html = renderOwnWeeklyRecapHtml(m);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<th scope="row">'));
  assert.ok(html.includes('Use your browser’s Print command'));
  for (const marker of [
    'OWN_TITLE_CANARY',
    'OWN_NOTE_CANARY',
    'OWN_GOAL_CANARY',
    'SECRET_TASK_ID',
    '<script',
    'src=',
    'href=',
    'onclick=',
    'onload=',
    'window.print',
    'fetch(',
  ])
    assert.ok(!html.includes(marker));
  assert.ok(html.includes('@media print'));
});
test('recap carries no saved permission, command, network or qualification fields', () => {
  const recap = prepareOwnWeeklyRecap(review(state([task('safe')]))),
    keys = Object.keys(recap);
  for (const field of [
    'roles',
    'authority',
    'accountId',
    'workspaceId',
    'revision',
    'command',
    'actionId',
    'grade',
    'score',
    'streak',
    'actualMinutes',
    'record',
    'certification',
  ])
    assert.ok(!keys.includes(field));
  assert.ok(recap.limits.some((s) => s.includes('not verified time spent')));
  assert.ok(recap.limits.some((s) => s.includes('self-reported')));
});
