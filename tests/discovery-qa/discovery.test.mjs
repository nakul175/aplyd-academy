import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  app = resolve(process.env.ACADEMY_APP_PATH ?? here + '/../..'),
  output = resolve(process.env.ACADEMY_DISCOVERY_QA_OUTPUT ?? app + '/.sites-runtime/discovery-qa');
const m = await import(pathToFileURL(output + '/model.mjs').href);
const seed = JSON.parse(readFileSync(app + '/lib/curriculum.json', 'utf8'));
const programs = seed.pathways,
  ids = programs.map((p) => p.id);
const items = m.indexCatalog(programs, seed.language);
const run = (sel) => m.filterCatalog(items, { query: '', ...sel }).map((i) => i.program.id);

test('facets are derived from pathway metadata, with missing data as Not stated', () => {
  const f = items[0].facets;
  assert.equal(f.role, 'Farmer');
  assert.equal(f.level, 'Foundation to applied');
  assert.equal(f.language, 'English');
  assert.equal(f.effort, '1 to 2 hours');
  assert.equal(f.topic, 'Agriculture records');
  const bare = m.deriveFacets({ id: 'x' });
  for (const k of m.FACET_KEYS) assert.equal(bare[k], m.NOT_STATED, k);
  assert.equal(m.effortBand(60), 'Up to 1 hour');
  assert.equal(m.effortBand(241), 'More than 4 hours');
  assert.equal(m.effortBand('x'), m.NOT_STATED);
});
test('no filters keeps catalog order; every facet is an exact AND filter', () => {
  assert.deepEqual(run({}), ids);
  assert.deepEqual(run({ role: 'Farmer' }), [ids[0]]);
  assert.deepEqual(run({ role: 'Farmer', topic: 'Public administration' }), []);
  assert.deepEqual(run({ level: 'Foundation to applied' }), ids);
  assert.deepEqual(run({ language: 'English', effort: '1 to 2 hours', format: items[0].facets.format }), ids);
  assert.deepEqual(run({ effort: 'More than 4 hours' }), []);
});
test('search covers title, summary, outcomes, role and topic; words are AND-ed and case-insensitive', () => {
  assert.deepEqual(run({ query: 'FARM RECORDS' }), [ids[0]]);
  assert.deepEqual(run({ query: 'customer' }), [ids[1]]);
  assert.ok(run({ query: 'duplicate transaction' }).includes(ids[0]), 'outcome text');
  assert.deepEqual(run({ query: 'public servant' }), [ids[2]], 'role');
  assert.deepEqual(run({ query: 'Small business' }), [ids[1]], 'derived topic');
  assert.deepEqual(run({ query: '  ' }), ids);
  assert.deepEqual(run({ query: 'farm customer' }), []);
  assert.deepEqual(run({ query: 'customer', role: 'Farmer' }), []);
});
test('facet option counts reflect the other active filters and sum to the visible results', () => {
  const opts = m.facetOptions(items, { query: 'customer' }, 'role');
  assert.equal(opts.find((o) => o.value === 'MSME owner or team member').count, 1);
  assert.equal(opts.find((o) => o.value === 'Farmer').count, 0);
  const all = m.facetOptions(items, { query: '' }, 'level');
  assert.equal(
    all.reduce((s, o) => s + o.count, 0),
    3,
  );
});
test('empty state and announcement text', () => {
  const sel = { query: 'zzzz' };
  assert.deepEqual(run(sel), []);
  assert.equal(m.activeFilterCount(sel), 1);
  assert.equal(m.activeFilterCount({ query: '' }), 0);
  assert.equal(m.activeFilterCount({ query: '', role: 'Farmer', effort: 'x' }), 2);
  assert.match(m.resultsAnnouncement(0, 3, sel), /No pathways match.*Clear filters/);
  assert.equal(m.resultsAnnouncement(3, 3, { query: '' }), '3 of 3 pathways shown.');
  assert.equal(m.resultsAnnouncement(1, 1, { query: '' }), '1 of 1 pathway shown.');
  assert.deepEqual(run(m.EMPTY_SELECTION), ids, 'clearing restores everything');
});
test('derived facets are labelled and the facet module does not mutate the seed', () => {
  assert.match(m.DERIVED_LABEL, /Derived label/);
  for (const k of ['topic', 'format', 'effort', 'language']) assert.ok(m.DERIVED_FACETS.includes(k));
  const frozen = structuredClone(programs[0]);
  m.deriveFacets(programs[0], seed.language);
  assert.deepEqual(programs[0], frozen);
});

const snap = (p) => ({
  ref: { scope: 'global', programId: p.id, versionId: seed.contentVersion },
  program: p,
});
test('pre-enrolment info reuses the before-start module output and shows the exact edition', () => {
  for (const p of programs) {
    const before = m.deriveBeforeStartSummary({ snapshot: snap(p), globalSeed: seed }),
      info = m.derivePreEnrollmentInfo({ snapshot: snap(p), globalSeed: seed });
    assert.deepEqual(info.prerequisites, before.prerequisites);
    assert.equal(info.passRule, before.passRule);
    assert.ok(info.passRule);
    assert.equal(info.edition.versionId, seed.contentVersion);
    assert.match(info.edition.label, /0\.1-review-draft/);
    assert.match(info.edition.label, /Review draft: not approved/);
    assert.deepEqual(info.outcomes, [...p.outcomes]);
    assert.equal(info.effort.totalMinutes, p.estimatedMinutes);
    assert.equal(info.effort.sessions, 3);
    assert.equal(info.credential.claims, p.credentialClaim);
    assert.deepEqual(info.credential.doesNotClaim, p.credentialExclusions);
    assert.ok(info.credential.doesNotClaim.length > 0);
    assert.match(info.credential.notAccredited, /nonaccredited/);
    assert.match(info.assessmentMethod, new RegExp(p.practicalAssessment.title));
    assert.match(info.effort.pacingNote, /not a commitment/);
    assert.equal(info.cohorts, null);
  }
});
test('pre-enrolment info is unavailable (null) wherever the before-start module refuses, and never borrows another edition', () => {
  const p = programs[0];
  assert.equal(
    m.derivePreEnrollmentInfo({
      snapshot: { ref: { scope: 'global', programId: p.id, versionId: '9.9-other' }, program: p },
      globalSeed: seed,
    }),
    null,
  );
  assert.equal(m.derivePreEnrollmentInfo({ snapshot: null, globalSeed: seed }), null);
  const unknownPolicy = m.derivePreEnrollmentInfo({
    snapshot: snap(p),
    globalSeed: { ...seed, assessmentPolicy: { ...seed.assessmentPolicy, passingRule: '' } },
  });
  assert.equal(unknownPolicy.passRule, null);
});
test('cohort availability lists only open cohorts with places for this pathway', () => {
  const p = programs[1],
    cohorts = [
      { id: 'a', title: 'Spring', programId: p.id, status: 'open', capacity: 10, occupied: 7 },
      { id: 'b', title: 'Full', programId: p.id, status: 'open', capacity: 5, occupied: 5 },
      { id: 'c', title: 'Closed', programId: p.id, status: 'closed', capacity: 5, occupied: 0 },
      { id: 'd', title: 'Other', programId: programs[0].id, status: 'open', capacity: 5, occupied: 0 },
      {
        id: 'e',
        title: 'Not open',
        programId: p.id,
        status: 'open',
        contentOpen: false,
        capacity: 5,
        occupied: 0,
      },
    ];
  assert.deepEqual(m.derivePreEnrollmentInfo({ snapshot: snap(p), globalSeed: seed, cohorts }).cohorts, [
    { id: 'a', title: 'Spring', placesLeft: 3 },
  ]);
  assert.deepEqual(
    m.derivePreEnrollmentInfo({ snapshot: snap(p), globalSeed: seed, cohorts: [] }).cohorts,
    [],
  );
});

const ctx = { farmer: ids[0], msme: ids[1], public: ids[2] };
const rec = (o) => m.recommend({ programs, contextPrograms: ctx, ...o });
test('recommendation basis: profile with nothing saved', () => {
  const r = rec({});
  assert.deepEqual(
    r.items.map((i) => i.programId),
    ids,
  );
  assert.deepEqual(r.items[0].basis, [m.NO_SIGNAL_BASIS]);
  assert.deepEqual(r.usedSignals, []);
  assert.match(r.note, /not personalised advice/);
});
test('recommendation basis: work context and goal', () => {
  const r = rec({ profileContext: 'farmer', goal: 'records' });
  assert.equal(r.items[0].programId, ids[0]);
  assert.ok(r.items[0].basis.some((b) => /saved work context: Farmer/.test(b)));
  assert.ok(r.items[0].basis.some((b) => /Keep better records.*record/.test(b)));
  assert.deepEqual([...r.usedSignals].sort(), ['goal', 'profile context']);
  const g = rec({ goal: 'clear-response' });
  assert.equal(g.items[0].programId, ids[1]);
  assert.deepEqual(
    rec({ goal: 'bogus' }).items.map((i) => i.programId),
    ids,
  );
});
test('recommendation basis: started pathway and assigned plan work outrank context, with plain-words basis', () => {
  const r = rec({
    profileContext: 'farmer',
    enrollments: [{ id: 'e1', programId: ids[2], completed: ['l1'], record: null }],
    planTasks: [
      { enrollmentId: 'e1', status: 'planned' },
      { enrollmentId: 'e1', status: 'done' },
    ],
  });
  assert.equal(r.items[0].programId, ids[2]);
  assert.deepEqual(r.items[0].basis, [
    'You started this pathway and finished 1 of 3 lessons.',
    'Your learning plan has 1 open task for it.',
  ]);
  assert.ok(r.usedSignals.includes('assigned work') && r.usedSignals.includes('completed lessons'));
  const c = rec({ cohortProgramIds: [ids[1]] });
  assert.equal(c.items[0].programId, ids[1]);
  assert.match(c.items[0].basis[0], /open cohort/);
});
test('recommendation basis: completed pathway is listed lower and says why; withdrawn is ignored; deterministic', () => {
  const input = {
    profileContext: 'farmer',
    enrollments: [
      { id: 'e1', programId: ids[0], completed: ['a', 'b', 'c'], record: { status: 'active' } },
      { id: 'e2', programId: ids[1], withdrawn: true, completed: [] },
    ],
  };
  const r = rec(input);
  assert.equal(r.items.at(-1).programId, ids[0]);
  assert.equal(r.items.at(-1).completed, true);
  assert.match(r.items.at(-1).basis[0], /already completed/);
  assert.ok(!r.items.find((i) => i.programId === ids[1]).basis.some((b) => /started/.test(b)));
  assert.deepEqual(rec(input), r);
});
test('every recommendation always carries a plain-words basis and the note', () => {
  for (const o of [
    {},
    { profileContext: 'public', goal: 'check-draft' },
    { goal: 'expert-questions', cohortProgramIds: [ids[0]] },
  ]) {
    const r = rec(o);
    assert.ok(
      r.items.every(
        (i) => i.basis.length > 0 && i.basis.every((b) => typeof b === 'string' && b.length > 10),
      ),
    );
    assert.match(r.note, /not personalised advice/);
  }
});

test('extra view gating: recovery and audit admin only, requests any active member, nothing otherwise', () => {
  const t = (roles) => ({ active: true, roles }),
    all = ['recovery', 'requests', 'audit'];
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, t(['admin']))),
    [true, true, true],
  );
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, t(['learner']))),
    [false, true, false],
  );
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, t(['facilitator', 'assessor']))),
    [false, true, false],
  );
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, t([]))),
    [false, false, false],
  );
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, { active: false, roles: ['admin'] })),
    [false, false, false],
  );
  assert.deepEqual(
    all.map((v) => m.canShowExtraView(v, null)),
    [false, false, false],
  );
  assert.equal(m.canShowExtraView('operations', t(['admin'])), false);
});
