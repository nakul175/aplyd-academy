import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  projectTeam,
  deriveReportRollup,
  projectReportRollup,
  exportReport,
  verifyReportExport,
  sha256Hex,
  suppressRow,
  METRIC_DICTIONARY,
  EXPORT_COLUMNS,
  SUPPRESSED,
  SMALL_CELL_THRESHOLD,
  ReportError,
  canViewReports,
  programs,
} from '../../.sites-runtime/wave3-qa/model.mjs';
import {
  NOW,
  at,
  apply,
  u,
  workspace,
  withReport,
  denied,
  PROG_A,
  PROG_B,
  LONG,
} from '../escalation-qa/fixture.mjs';

const DAY = 86400000;
/** Hand-built synthetic Team: exact control of every cell. */
function synth({
  a = [],
  b = [],
  reports = 0,
  support = 0,
  titleA = 'Cohort A',
  extraCohortSameProgram = false,
} = {}) {
  const mk = (cid, n, i) => ({
    userId: `${cid}-l${i}`,
    state: {
      enrollments: [n(i)].map((e) => ({
        cohortId: cid,
        withdrawn: false,
        completed: [],
        attempts: [],
        appeals: [],
        ...e,
      })),
    },
  });
  const members = [
    ['owner', ['admin']],
    ['facA', ['facilitator'], ['cA']],
    ['asrA', ['assessor'], ['cA']],
    ['asrB', ['assessor'], ['cB']],
    ['revA', ['reviewer'], ['cA']],
    ['modA', ['moderator'], ['cA']],
    ['lrn', ['learner']],
    ['gone', ['admin'], [], false],
  ].map(([userId, roles, scopes = [], active = true]) => ({
    userId,
    roles,
    scopes,
    active,
    name: userId,
    email: userId + '@x',
  }));
  const cohorts = [
    { id: 'cA', title: titleA, programId: 'pA' },
    { id: 'cB', title: 'Cohort B', programId: extraCohortSameProgram ? 'pA' : 'pB' },
  ];
  const learners = [...a.map((e, i) => mk('cA', () => e, i)), ...b.map((e, i) => mk('cB', () => e, i))];
  const posts = [
    { id: 'p1', cohortId: 'cA' },
    { id: 'p2', cohortId: 'cB' },
  ];
  return {
    id: 'ws-synth',
    cohorts,
    members,
    learners,
    posts,
    reports: Array.from({ length: reports }, (_, i) => ({ id: 'r' + i, postId: 'p1' })),
    support: Array.from({ length: support }, (_, i) => ({ id: 's' + i, cohortId: 'cA' })),
    invites: [],
    assignments: [],
    moderation: [],
    activity: [],
  };
}
const decided = (passed, days = 1, id = 'x') => ({
  id,
  submittedAt: at(0),
  decision: { passed, decidedAt: new Date(Date.parse(at(0)) + days * DAY).toISOString() },
});
const n = (count, make) => Array.from({ length: count }, (_, i) => make(i));
const cohort = (r, id = 'cA') => r.cohorts.find((c) => c.cohortId === id);

test('metric dictionary is complete, unique and covers every exported column', () => {
  const ids = METRIC_DICTIONARY.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of METRIC_DICTIONARY) {
    for (const k of ['id', 'name', 'definition', 'formula', 'source', 'limits'])
      assert.ok(typeof m[k] === 'string' && m[k].length > 5, m.id + '.' + k);
    assert.ok(
      m.visibleTo.length && m.visibleTo.every((r) => ['owner', 'facilitator', 'assessor'].includes(r)),
      m.id,
    );
  }
  const manifestIds = exportReport(deriveReportRollup(synth({ a: [{}] }), 'owner', NOW), 'json').manifest
    .metricIds;
  for (const id of manifestIds) assert.ok(ids.includes(id), id);
  for (const id of [
    'enrolled',
    'active',
    'completed_lessons',
    'submitted',
    'passed',
    'needs_retry',
    'appeal_rate',
    'median_days_to_review',
    'support_requests',
    'discussion_reports',
    'ops_pending_reviews',
    'escalations_overdue',
  ])
    assert.ok(ids.includes(id), id);
  assert.equal(METRIC_DICTIONARY.find((m) => m.id === 'ops_unassigned_reviews').visibleTo.join(), 'owner');
});

test('permission matrix: owner all cohorts; facilitator/assessor only scoped; every other role denied', () => {
  const t = synth({ a: n(4, () => ({})), b: n(4, () => ({})) });
  assert.deepEqual(deriveReportRollup(t, 'owner', NOW).cohortIds, ['cA', 'cB']);
  assert.equal(deriveReportRollup(t, 'owner', NOW).audience, 'owner');
  for (const who of ['facA', 'asrA'])
    assert.deepEqual(deriveReportRollup(t, who, NOW).cohortIds, ['cA'], who);
  assert.deepEqual(deriveReportRollup(t, 'asrB', NOW).cohortIds, ['cB']);
  const msgs = ['revA', 'modA', 'lrn', 'gone', 'nobody'].map((w) => {
    try {
      deriveReportRollup(t, w, NOW);
      return null;
    } catch (e) {
      assert.ok(e instanceof ReportError);
      assert.equal(e.status, 404);
      return e.message;
    }
  });
  assert.ok(msgs.every(Boolean));
  assert.equal(new Set(msgs).size, 1);
  for (const [w, ok] of [
    ['owner', true],
    ['facA', true],
    ['asrA', true],
    ['revA', false],
    ['modA', false],
    ['lrn', false],
    ['gone', false],
  ])
    assert.equal(canViewReports(t.members.find((m) => m.userId === w)), ok, w);
});

test('scoped viewers never receive another cohort: ids, titles, counts or pathway rows', () => {
  const t = synth({ a: n(5, () => ({ completed: ['l1', 'l2'] })), b: n(7, () => ({ completed: ['l1'] })) }),
    r = deriveReportRollup(t, 'facA', NOW),
    blob = JSON.stringify(r);
  assert.ok(!blob.includes('cB') && !blob.includes('Cohort B') && !blob.includes('pB'));
  assert.equal(r.total.enrolled, 5);
  assert.equal(r.total.completedLessons, 10);
  assert.deepEqual(
    r.pathways.map((p) => p.programId),
    ['pA'],
  );
  const exported = exportReport(r, 'csv');
  assert.ok(!exported.content.includes('Cohort B') && !exported.manifestJson.includes('cB'));
  const o = deriveReportRollup(t, 'owner', NOW);
  assert.equal(o.total.enrolled, 12);
  assert.equal(o.total.completedLessons, 17);
});

test('unknown and out-of-scope cohort filters are indistinguishable', () => {
  const t = synth({ a: n(3, () => ({})), b: n(3, () => ({})) });
  const x = (w, ids) => {
    try {
      deriveReportRollup(t, w, NOW, { cohortIds: ids });
      return null;
    } catch (e) {
      return [e.status, e.message];
    }
  };
  assert.deepEqual(x('facA', ['cB']), x('facA', ['no-such']));
  assert.deepEqual(x('facA', ['cB'])?.[0], 404);
  assert.deepEqual(x('owner', ['cA']), null);
  assert.deepEqual(deriveReportRollup(t, 'owner', NOW, { cohortIds: ['cB'] }).cohortIds, ['cB']);
  assert.ok(x('facA', [42]));
  assert.ok(x('facA', 'cA'));
});

test('small-cell suppression is exact at the boundary for every count', () => {
  for (const size of [0, 1, 2, 3, 4, 10]) {
    const t = synth({
        a: n(size, (i) => ({ completed: ['l1'], attempts: [decided(true, 2, 'a' + i)], appeals: [] })),
      }),
      c = cohort(deriveReportRollup(t, 'owner', NOW));
    const expect = size < SMALL_CELL_THRESHOLD ? SUPPRESSED : size;
    for (const k of ['enrolled', 'submitted', 'passed']) assert.equal(c[k], expect, `${k} size ${size}`);
    assert.equal(c.active, SUPPRESSED, 'zero active is suppressed too');
    assert.equal(c.completedLessons, size < 3 ? SUPPRESSED : size);
    assert.equal(c.medianDaysToReview, size < 3 ? SUPPRESSED : 2);
  }
  assert.equal(SUPPRESSED, '<3');
  assert.equal(SMALL_CELL_THRESHOLD, 3);
});

test('appeal rate and counts: numerator below 3 stays hidden even when the rate would reveal it', () => {
  const mk = (appeals) =>
    synth({
      a: n(10, (i) => ({
        attempts: [{ id: 'a' + i, submittedAt: at(0), decision: { passed: false, decidedAt: at(24) } }],
        appeals: i < appeals ? [{ attemptId: 'a' + i, status: 'open' }] : [],
      })),
    });
  for (const [k, rate, count] of [
    [0, SUPPRESSED, SUPPRESSED],
    [1, SUPPRESSED, SUPPRESSED],
    [2, SUPPRESSED, SUPPRESSED],
    [3, 30, 3],
    [5, 50, 5],
  ]) {
    const c = cohort(deriveReportRollup(mk(k), 'owner', NOW));
    assert.equal(c.appealRate, rate, 'appeals ' + k);
    assert.equal(c.appeals, count);
  }
});

test('totals and pathway rows are suppressed from raw sums, not from suppressed parts', () => {
  const t = synth({ a: n(2, () => ({})), b: n(2, () => ({})), extraCohortSameProgram: true }),
    r = deriveReportRollup(t, 'owner', NOW);
  assert.equal(cohort(r, 'cA').enrolled, SUPPRESSED);
  assert.equal(cohort(r, 'cB').enrolled, SUPPRESSED);
  assert.equal(r.pathways.length, 1);
  assert.equal(r.pathways[0].enrolled, 4);
  assert.equal(r.total.enrolled, 4);
});

test('withdrawn learners are excluded and passing/needs-retry follow the latest decision after any appeal', () => {
  const t = synth({
      a: [
        { withdrawn: true, completed: ['x'], attempts: [decided(true, 1, 'w')] },
        ...n(3, (i) => ({
          completed: ['l'],
          attempts: [
            decided(false, 1, 'f' + i),
            { id: 'n' + i, submittedAt: at(5), decision: { passed: true, decidedAt: at(30) } },
          ],
        })),
        ...n(3, (i) => ({
          attempts: [decided(false, 1, 'g' + i)],
          appeals: [{ attemptId: 'g' + i, status: 'resolved', resolution: { passed: true } }],
        })),
        ...n(3, (i) => ({ attempts: [decided(false, 1, 'h' + i)] })),
        ...n(3, (i) => ({ attempts: [{ id: 'p' + i, submittedAt: at(0), decision: null }] })),
      ],
    }),
    c = cohort(deriveReportRollup(t, 'owner', NOW));
  assert.equal(c.enrolled, 12);
  assert.equal(c.passed, 6);
  assert.equal(c.needsRetry, 3);
  assert.equal(c.submitted, 12);
  assert.equal(c.active, 6);
});

test('support and discussion report counts attribute to the cohort and are suppressed below 3', () => {
  const t = synth({ a: n(4, () => ({})), reports: 2, support: 3 }),
    c = cohort(deriveReportRollup(t, 'owner', NOW));
  assert.equal(c.discussionReports, SUPPRESSED);
  assert.equal(c.supportRequests, 3);
});

test('sha256Hex matches the platform implementation across padding boundaries and unicode', () => {
  const samples = [
    '',
    'a',
    'abc',
    'é',
    '日本語 ✓',
    'x'.repeat(55),
    'x'.repeat(56),
    'x'.repeat(63),
    'x'.repeat(64),
    'x'.repeat(65),
    'line\r\n'.repeat(500),
    JSON.stringify({ a: [1, 2, 3], b: '<3' }),
  ];
  for (let i = 1; i <= 130; i++) samples.push('k'.repeat(i));
  for (const s of samples)
    assert.equal(
      sha256Hex(s),
      createHash('sha256').update(s, 'utf8').digest('hex'),
      JSON.stringify(s.slice(0, 20)) + s.length,
    );
});

test('CSV export: header, one row per cohort, pathway and total, manifest checksum verifies and detects edits', () => {
  const t = synth({ a: n(4, () => ({ completed: ['l'] })), b: n(3, () => ({})) }),
    r = deriveReportRollup(t, 'owner', '2026-10-05T09:00:00.000Z'),
    x = exportReport(r, 'csv');
  const lines = x.content.trimEnd().split('\r\n');
  assert.equal(lines[0], EXPORT_COLUMNS.join(','));
  assert.equal(lines.length, 1 + 2 + 2 + 1);
  assert.equal(x.manifest.checksum.value, createHash('sha256').update(x.content, 'utf8').digest('hex'));
  assert.equal(x.manifest.rowCount, 5);
  assert.equal(x.manifest.format, 'csv');
  assert.deepEqual(x.manifest.suppression, { threshold: 3, marker: '<3' });
  assert.ok(x.manifest.limits.length >= 3);
  assert.equal(x.filename, 'aplyd-academy-report-2026-10-05.csv');
  assert.ok(verifyReportExport(x.content, 'csv', x.manifest));
  assert.ok(!verifyReportExport(x.content.replace('4', '5'), 'csv', x.manifest));
  assert.ok(!verifyReportExport(x.content, 'csv'));
  assert.equal(JSON.parse(x.manifestJson).checksum.value, x.manifest.checksum.value);
});

test('JSON export embeds the manifest and its checksum covers exactly the data array', () => {
  const t = synth({ a: n(5, () => ({})) }),
    x = exportReport(deriveReportRollup(t, 'facA', NOW), 'json'),
    p = JSON.parse(x.content);
  assert.equal(
    p.manifest.checksum.value,
    createHash('sha256').update(JSON.stringify(p.data), 'utf8').digest('hex'),
  );
  assert.ok(verifyReportExport(x.content, 'json'));
  p.data[0].enrolled = 99;
  assert.ok(!verifyReportExport(JSON.stringify(p), 'json'));
  assert.deepEqual(p.manifest.cohortIds, ['cA']);
  assert.equal(p.manifest.audience, 'scoped');
  assert.throws(
    () => exportReport(deriveReportRollup(t, 'owner', NOW), 'xml'),
    (e) => e.status === 400,
  );
});

test('exports are re-suppressed even from a hand-built rollup with exact small counts', () => {
  const base = deriveReportRollup(synth({ a: n(5, () => ({})) }), 'owner', NOW),
    forged = {
      ...base,
      cohorts: [{ ...base.cohorts[0], enrolled: 1, passed: 2, completedLessons: 7, appeals: 0 }],
      pathways: [],
      total: { ...base.total, enrolled: 2 },
    };
  const rows = JSON.parse(exportReport(forged, 'json').content).data;
  assert.equal(rows[0].enrolled, SUPPRESSED);
  assert.equal(rows[0].passed, SUPPRESSED);
  assert.equal(rows[0].completedLessons, SUPPRESSED);
  assert.equal(rows[0].appeals, SUPPRESSED);
  assert.equal(rows.at(-1).enrolled, SUPPRESSED);
  assert.equal(suppressRow({ ...base.total, enrolled: 3, passed: 3 }).passed, 3);
});

test('exports and rollups contain no learner identity, names, evidence or message text', () => {
  const t = synth({ a: n(4, () => ({ completed: ['l'] })) });
  t.learners.forEach((l, i) => {
    l.state.profile = { name: 'Fictional Person ' + i };
    l.state.enrollments[0].draft = { task: 'SECRET evidence' };
  });
  const out =
    JSON.stringify(deriveReportRollup(t, 'owner', NOW)) +
    exportReport(deriveReportRollup(t, 'owner', NOW), 'csv').content +
    exportReport(deriveReportRollup(t, 'owner', NOW), 'json').content;
  for (const s of ['cA-l0', 'Fictional Person', 'SECRET', '@x', 'userId', 'learnerId'])
    assert.ok(!out.includes(s), s);
});

test('CSV neutralises spreadsheet formulas and quotes embedded separators in titles', () => {
  const t = synth({ a: n(3, () => ({})), titleA: '=HYPERLINK("http://example.test","x"),+cmd' }),
    x = exportReport(deriveReportRollup(t, 'owner', NOW), 'csv');
  assert.ok(x.content.includes('"\'=HYPERLINK(""http://example.test"",""x""),+cmd"'));
  assert.ok(!/(^|\r\n|,)=HYPERLINK/.test(x.content));
});

test('derivation is deterministic, does not mutate the Team and is stable for repeated calls', () => {
  const t = synth({ a: n(4, (i) => ({ attempts: [decided(i % 2 === 0, i + 1)] })) }),
    snap = JSON.stringify(t);
  const a = exportReport(deriveReportRollup(t, 'owner', NOW), 'csv'),
    b = exportReport(deriveReportRollup(t, 'owner', NOW), 'csv');
  assert.equal(a.content, b.content);
  assert.equal(a.manifest.checksum.value, b.manifest.checksum.value);
  assert.equal(JSON.stringify(t), snap);
});

test('real team: projection carries the rollup only for permitted roles and stays within scope', () => {
  const w = withReport(workspace());
  for (const [who, ok] of [
    ['owner', true],
    ['facA', true],
    ['revA', true],
    ['assessB', true],
    ['modA', false],
    ['lrnA1', false],
    ['plain', false],
  ]) {
    const p = projectTeam(w.t, u(w, who));
    assert.equal(!!p.team.reports, ok, who);
  }
  const fac = projectTeam(w.t, u(w, 'facA')).team.reports,
    blob = JSON.stringify(fac);
  assert.deepEqual(fac.cohortIds, [w.A]);
  assert.ok(!blob.includes(w.B) && !blob.includes('Cohort B'));
  assert.equal(projectTeam(w.t, u(w, 'owner')).team.reports.cohorts.length, 2);
  assert.equal(
    projectReportRollup(
      w.t,
      w.t.members.find((m) => m.userId === w.ids.plain),
      NOW,
    ),
    null,
  );
});

test('real team lifecycle: lessons, submission, independent decision and appeal flow into the rollup', () => {
  let w = withReport(workspace()),
    t = w.t;
  const l = PROG_A.lessons;
  for (const who of ['lrnA1', 'lrnA2', 'lrnA3']) {
    const e = t.learners.find((x) => x.userId === w.ids[who]).state.enrollments[0];
    for (const les of l)
      t = apply(t, u(w, who), {
        type: 'lesson',
        enrollmentId: e.id,
        lessonId: les.id,
        practice: LONG,
        answers: les.quiz.map((q) => q.correctOptionIndex),
      });
    t = apply(t, u(w, who), {
      type: 'submit',
      enrollmentId: e.id,
      confirmed: true,
      fields: Object.fromEntries(PROG_A.practicalAssessment.submissionPrompts.map((f) => [f.id, LONG])),
    });
  }
  const decide = (who, ok, time) => {
    const e = t.learners.find((x) => x.userId === w.ids[who]).state.enrollments[0],
      a = e.attempts.at(-1);
    t = apply(t, 'owner', { type: 'assign', kind: 'assessment', targetId: a.id, staffId: w.ids.revA });
    t = apply(
      t,
      u(w, 'revA'),
      {
        type: 'assess',
        learnerId: w.ids[who],
        enrollmentId: e.id,
        attemptId: a.id,
        scores: ok ? [4, 4, 4, 4] : [1, 1, 1, 1],
        gates: ok ? [true, true, true] : [false, false, false],
        notes: Array(4).fill('Evidence checked against the fictional source packet.'),
        feedback:
          'Verified reasoning, careful data handling and the human approval route meet the practice standard.',
      },
      time,
    );
  };
  decide('lrnA1', true, at(48));
  decide('lrnA2', false, at(24));
  decide('lrnA3', false, at(72));
  const c = cohort(deriveReportRollup(t, 'owner', at(100)), w.A);
  assert.equal(c.enrolled, 3);
  assert.equal(c.submitted, 3);
  assert.equal(c.passed, SUPPRESSED);
  assert.equal(c.completedLessons, 3 * l.length);
  assert.equal(c.medianDaysToReview, 2);
  assert.equal(c.needsRetry, SUPPRESSED);
  assert.equal(c.appeals, SUPPRESSED);
  assert.equal(cohort(deriveReportRollup(t, 'owner', at(100)), w.B).enrolled, SUPPRESSED);
});
