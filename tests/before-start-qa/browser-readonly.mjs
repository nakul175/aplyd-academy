import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { app, output, modelUrl } from './qa-paths.mjs';
assert.equal(
  process.env.ACADEMY_BEFORE_START_WORKER_READY,
  '1',
  'Wait for root stable M4 Worker signal before any browser/network action.',
);
const fixturePath = resolve(
  process.env.ACADEMY_READONLY_FIXTURES ??
    'outputs/aplyd-academy-eight-hour/record-verification/integrated/evidence/fixtures.json',
);
const f = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.ok(
  f.person?.id && f.other?.id && f.personTeam?.id,
  'Use already approved existing fictional readers; this suite never creates one.',
);
const base = process.env.ACADEMY_LOCAL_URL ?? 'http://127.0.0.1:8787',
  origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname));
const headers = (u) => ({
  'oai-authenticated-user-id': u.id,
  'oai-authenticated-user-email': u.email,
  'oai-authenticated-user-full-name': encodeURIComponent(u.name),
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
});
const httpRequests = [];
async function get(u, path) {
  assert.ok(path.startsWith('/api/'));
  const r = await fetch(base + path, { method: 'GET', headers: headers(u), redirect: 'manual' });
  httpRequests.push({ method: 'GET', path, status: r.status });
  assert.equal(r.status, 200, `Existing reader GET ${path}`);
  return r.json();
}
const { createTeam, applyTeamCommand, projectTeam, applyWorkspaceContentCommand, freshWorkspace } =
  await import(modelUrl);
const { chromium, browserOptions } = await import(
  pathToFileURL(app + '/tests/scoped-workbench-qa/browser-runtime.mjs')
);
const seed = JSON.parse(readFileSync(app + '/lib/curriculum-versions/0.1-review-draft.json', 'utf8'));
const evidence = resolve(process.env.ACADEMY_BEFORE_START_BROWSER_OUTPUT ?? output + '/browser');
mkdirSync(evidence, { recursive: true });
const save = (file, v) => writeFileSync(evidence + '/' + file, JSON.stringify(v, null, 2) + '\n');
const files = [
  'app/academy-learning.tsx',
  'lib/academy-before-start.mjs',
  'lib/academy-before-start.d.mts',
  'app/academy.tsx',
  'app/academy-acceptance.ts',
  'lib/academy-engine.ts',
  'lib/academy-authoring.ts',
  'lib/academy-curriculum.ts',
  'lib/curriculum-versions/0.1-review-draft.json',
];
const hashes = () =>
  Object.fromEntries(
    files.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(app + '/' + file))
        .digest('hex'),
    ]),
  );
const now = new Date().toISOString(),
  due = new Date(Date.now() + 180 * 86400000).toISOString(),
  user = { userId: f.person.id, email: f.person.email, fullName: f.person.name };
let t = createTeam(
  user,
  {
    name: f.personTeam.name,
    purpose: 'Ephemeral display-only private course editions; never saved.',
    context: 'msme',
  },
  f.personTeam.id,
  now,
);
t.members.push({
  userId: 'display-independent-reviewer',
  name: 'In-memory reviewer',
  email: 'display-reviewer@academy.test',
  active: true,
  roles: ['admin'],
  scopes: [],
  joinedAt: now,
});
async function publication(sourceRef, title, prerequisite) {
  t = await applyWorkspaceContentCommand(t, user, { type: 'content-copy', sourceRef }, now);
  let d = t.content.drafts.at(-1),
    doc = structuredClone(d.document);
  doc.title = title;
  doc.prerequisites = [
    prerequisite,
    'Use the fictional packet and ask the named reviewer when a source is uncertain.',
  ];
  t = await applyWorkspaceContentCommand(
    t,
    user,
    { type: 'content-save', draftId: d.id, revision: d.revision, document: doc },
    now,
  );
  d = t.content.drafts.at(-1);
  t = await applyWorkspaceContentCommand(
    t,
    user,
    {
      type: 'content-submit',
      draftId: d.id,
      revision: d.revision,
      reviewerId: 'display-independent-reviewer',
      reviewDueAt: due,
    },
    now,
  );
  d = t.content.drafts.at(-1);
  t = await applyWorkspaceContentCommand(
    t,
    { userId: 'display-independent-reviewer' },
    {
      type: 'content-review',
      draftId: d.id,
      revision: d.revision,
      decision: 'approve',
      note: 'Read-only in-memory fixture review of fictional source, rubric, answers and safety.',
      checks: { sources: true, answers: true, rubric: true, safety: true, accessibility: true },
    },
    now,
  );
  d = t.content.drafts.at(-1);
  t = await applyWorkspaceContentCommand(
    t,
    user,
    { type: 'content-publish', draftId: d.id, revision: d.revision },
    now,
  );
  return t.content.publications.at(-1).snapshot;
}
const old = await publication(
  { scope: 'global', programId: seed.pathways[1].id, versionId: seed.contentVersion },
  'Display fixture — earlier customer practice',
  'Earlier edition: read the fictional order policy before making a promise.',
);
const newer = await publication(
  old.ref,
  'Display fixture — revised customer practice',
  'Revised edition: read the revised source checklist before making a promise.',
);
t = await applyTeamCommand(
  t,
  user,
  {
    type: 'cohort-create',
    title: 'Earlier display cohort',
    programId: old.ref.programId,
    contentRef: old.ref,
    capacity: 5,
  },
  now,
);
t = await applyTeamCommand(
  t,
  user,
  {
    type: 'cohort-create',
    title: 'Revised display cohort',
    programId: newer.ref.programId,
    contentRef: newer.ref,
    capacity: 5,
  },
  now,
);
const oldCohort = t.cohorts[0].id;
function teamVariant(kind = 'normal') {
  let team = structuredClone(t);
  if (['withdrawn', 'removed'].includes(kind)) {
    team = applyTeamCommand(
      team,
      user,
      { type: 'enroll', programId: old.ref.programId, cohortId: oldCohort },
      now,
    );
    const e = team.learners[0].state.enrollments[0];
    team = applyTeamCommand(team, user, { type: 'withdraw', enrollmentId: e.id }, now);
    if (kind === 'removed') team.members.find((m) => m.userId === user.userId).active = false;
  }
  const projected = projectTeam(team, user);
  if (kind === 'missing-policy') for (const s of projected.contentVersions) delete s.policy;
  if (kind === 'unsupported-policy')
    for (const s of projected.contentVersions) s.policy.minimumWeightedScore = 75;
  if (kind === 'high-rubric')
    for (const s of projected.contentVersions)
      s.program.practicalAssessment.rubric.forEach((r) => (r.weight *= 2));
  if (kind === 'literal')
    for (const s of projected.contentVersions)
      s.program.prerequisites = ['<img src=x onerror=window.__beforeStartXss=1> is literal fictional text.'];
  if (kind === 'unknown-pin') {
    projected.contentVersions = [];
    for (const c of projected.team.cohorts) {
      c.version = 'unknown-retained-version';
      c.contentRef.versionId = c.version;
      c.contentOpen = false;
      c.contentNotice = 'Saved exact publication unavailable.';
    }
  }
  return projected;
}
const sourceHashes = hashes(),
  cases = [],
  requests = [],
  forbidden = [],
  errors = [],
  contexts = [],
  verifiedGlobalPrograms = [];
const runtimeDist = process.env.ACADEMY_BEFORE_START_RUNTIME_DIST;
const runtimeHashes = () =>
  runtimeDist
    ? Object.fromEntries(
        ['server/index.js', 'server/wrangler.json'].map((file) => [
          file,
          createHash('sha256')
            .update(readFileSync(resolve(runtimeDist, file)))
            .digest('hex'),
        ]),
      )
    : null;
const copiedRuntimeHashes = runtimeHashes();
let browser,
  passed = false;
async function scenario(name, fn) {
  try {
    await fn();
    cases.push({ name, passed: true });
    console.log(name + ': passed');
  } catch (e) {
    cases.push({ name, passed: false, error: String(e) });
    throw e;
  }
}
const panel = (p) =>
  p
    .locator('section.source-packet')
    .filter({ has: p.getByRole('heading', { name: 'Before you start', exact: true }) });
const frames = (p) =>
  p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function page({
  u = f.other,
  workspace = null,
  variant = null,
  empty = false,
  width = 1440,
  pathway = null,
} = {}) {
  const c = await browser.newContext({ extraHTTPHeaders: headers(u), viewport: { width, height: 1000 } }),
    p = await c.newPage();
  contexts.push(c);
  p.setDefaultTimeout(12000);
  await p.route('**/*', (route) => {
    const r = route.request(),
      url = new URL(r.url());
    if (url.origin !== origin || !['GET', 'HEAD'].includes(r.method())) {
      forbidden.push({ method: r.method(), path: url.pathname, origin: url.origin });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  if (empty)
    await p.route('**/api/academy', async (route) => {
      const response = await route.fetch(),
        json = await response.json();
      assert.equal(json.currentUserId, u.id);
      const state = freshWorkspace();
      state.profile = { ...state.profile, ...json.state.profile };
      json.state = state;
      return route.fulfill({ response, json });
    });
  if (variant)
    await p.route('**/api/teams?*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('id') !== workspace) return route.continue();
      const response = await route.fetch(),
        json = await response.json();
      assert.equal(json.team.currentUserId, u.id);
      assert.equal(json.team.id, workspace);
      return route.fulfill({ response, json: { ...json, ...structuredClone(variant) } });
    });
  p.on('request', (r) => requests.push({ method: r.method(), path: new URL(r.url()).pathname }));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(
    base +
      '/' +
      (workspace ? '?workspace=' + encodeURIComponent(workspace) : '') +
      (pathway ? '#learn/' + encodeURIComponent(pathway) : '#programs'),
  );
  await p.locator('[data-save-state="loaded"]').waitFor();
  return { p, c };
}
async function choose(p, title) {
  await p
    .locator('.pathway-card')
    .filter({ has: p.getByRole('heading', { name: title, exact: true }) })
    .click();
  await panel(p).waitFor();
}
async function textEquals(p, snapshot) {
  const section = panel(p),
    summary = (await import(modelUrl)).deriveBeforeStartSummary({ snapshot, globalSeed: seed });
  assert.ok(summary);
  assert.deepEqual(await section.locator('li').allTextContents(), summary.prerequisites);
  assert.ok(
    (await section.innerText()).includes(
      summary.passRule ??
        'The assessment rule for this edition is unavailable. Ask for support before starting.',
    ),
  );
}
try {
  const personalBefore = await get(f.person, '/api/academy'),
    otherBefore = await get(f.other, '/api/academy'),
    teamBefore = await get(f.person, '/api/teams?id=' + encodeURIComponent(f.personTeam.id));
  browser = await chromium.launch(browserOptions);
  await scenario(
    'actual pre-enrollment archived pathways show exact own prerequisites and exact global rule',
    async () => {
      const { p, c } = await page();
      for (const program of seed.pathways) {
        if (otherBefore.state.enrollments.some((e) => e.programId === program.id && !e.withdrawn)) continue;
        await choose(p, program.title);
        await textEquals(p, {
          ref: { scope: 'global', programId: program.id, versionId: seed.contentVersion },
          program,
        });
        verifiedGlobalPrograms.push(program.id);
        assert.ok((await panel(p).innerText()).includes('an AI account is optional'));
        await p.getByRole('button', { name: 'All pathways', exact: true }).click();
      }
      await c.close();
    },
  );
  await scenario(
    'GET-only private display uses exact earlier pin and changes only after an explicit cohort selection',
    async () => {
      const { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant: teamVariant() });
      await choose(p, newer.program.title);
      await p.getByRole('heading', { name: old.program.title, exact: true }).waitFor();
      await textEquals(p, old);
      assert.ok(!(await panel(p).innerText()).includes(newer.program.prerequisites[0]));
      await p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true }).click();
      await p.getByRole('option', { name: 'Revised display cohort · 5 places', exact: true }).click();
      await p.getByRole('heading', { name: newer.program.title, exact: true }).waitFor();
      await textEquals(p, newer);
      await c.close();
    },
  );
  for (const kind of ['missing-policy', 'unsupported-policy', 'high-rubric'])
    await scenario(
      'GET-only ' + kind + ' private display preserves own prerequisites and shows unavailable rule',
      async () => {
        const variant = teamVariant(kind),
          { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant });
        await choose(p, newer.program.title);
        await textEquals(
          p,
          variant.contentVersions.find((s) => s.ref.versionId === old.ref.versionId),
        );
        assert.ok(!(await panel(p).innerText()).includes(seed.assessmentPolicy.passingRule));
        assert.ok(!(await panel(p).innerText()).includes('out of 200'));
        await c.close();
      },
    );
  await scenario(
    'missing exact private pin shows unavailable saved content without readiness or newer/global fallback',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant('unknown-pin'),
        pathway: old.ref.programId,
      });
      await p
        .getByRole('heading', { name: 'Your saved learning content is unavailable', exact: true })
        .waitFor();
      assert.equal(await panel(p).count(), 0);
      assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
      assert.ok(!(await p.locator('main').innerText()).includes(newer.program.prerequisites[0]));
      await c.close();
    },
  );
  await scenario(
    'withdrawn retained display can read its selected offering without silently enrolling or changing old history',
    async () => {
      const variant = teamVariant('withdrawn'),
        { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant });
      await choose(p, newer.program.title);
      await textEquals(p, old);
      assert.equal(variant.state.enrollments[0].withdrawn, true);
      assert.deepEqual(variant.state.enrollments[0].contentRef, old.ref);
      await c.close();
    },
  );
  await scenario(
    'removed own-history display remains read-only while useful prerequisites remain visible',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant('removed'),
        pathway: old.ref.programId,
      });
      await panel(p).waitFor();
      await textEquals(p, old);
      assert.equal(
        await p.getByRole('button', { name: 'Start this pathway', exact: true }).isDisabled(),
        true,
      );
      assert.ok((await p.locator('main').innerText()).includes('Workspace access removed'));
      await c.close();
    },
  );
  await scenario(
    'active existing learner sees learning rather than a second pre-enrollment readiness block',
    async () => {
      const enrollment = personalBefore.state.enrollments.find(
        (e) => !e.withdrawn && seed.pathways.some((p) => p.id === e.programId),
      );
      assert.ok(enrollment, 'Use existing approved learned enrollment, never create one.');
      const { p, c } = await page({ u: f.person, pathway: enrollment.programId });
      await p.getByRole('tab', { name: 'Learn & practise', exact: true }).waitFor();
      assert.equal(await panel(p).count(), 0);
      await c.close();
    },
  );
  await scenario('private prerequisites render literal text without executable markup', async () => {
    const variant = teamVariant('literal'),
      { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant });
    await choose(p, newer.program.title);
    assert.ok((await panel(p).innerText()).includes('<img src=x'));
    assert.equal(await panel(p).locator('img').count(), 0);
    assert.equal(await p.evaluate(() => window.__beforeStartXss), undefined);
    await c.close();
  });
  for (const width of [390, 768, 1440])
    for (const doubled of [false, true])
      await scenario(
        `${width}px ${doubled ? 'true200%' : 'normal'} prerequisites are readable without overflow and cohort selection works by keyboard`,
        async () => {
          const { p, c } = await page({
            u: f.person,
            workspace: f.personTeam.id,
            variant: teamVariant(),
            width,
          });
          await choose(p, newer.program.title);
          if (doubled) await p.addStyleTag({ content: 'html, body { font-size:32px !important; }' });
          await frames(p);
          if (doubled) assert.equal(await p.evaluate(() => getComputedStyle(document.body).fontSize), '32px');
          assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          for (const li of await panel(p).locator('li').all())
            assert.equal(
              await li.evaluate((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.left >= 0 && r.right <= innerWidth;
              }),
              true,
            );
          const picker = p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true });
          await picker.focus();
          await p.keyboard.press('Enter');
          await p.getByRole('option', { name: 'Earlier display cohort · 5 places', exact: true }).waitFor();
          await p.keyboard.press('Home');
          await p.keyboard.press('Enter');
          await p.waitForFunction(
            () =>
              document
                .querySelector('[role=combobox][aria-label="Cohort for this pathway"]')
                ?.getAttribute('aria-expanded') === 'false',
          );
          await frames(p);
          await panel(p).waitFor();
          await textEquals(p, old);
          assert.equal(await picker.evaluate((e) => document.activeElement === e), true);
          await panel(p).evaluate((e) => e.scrollIntoView({ block: 'start' }));
          await p.evaluate(() => window.scrollBy(0, -90));
          await frames(p);
          await p.screenshot({
            path: evidence + `/before-start-${width}-${doubled ? '200' : 'normal'}.png`,
            fullPage: false,
          });
          await c.close();
        },
      );
  assert.equal(
    verifiedGlobalPrograms.length,
    3,
    'Actual existing reader must expose all three pre-enrollment pathways without a mutated fixture',
  );
  const personalAfter = await get(f.person, '/api/academy'),
    otherAfter = await get(f.other, '/api/academy'),
    teamAfter = await get(f.person, '/api/teams?id=' + encodeURIComponent(f.personTeam.id));
  for (const [before, after] of [
    [personalBefore, personalAfter],
    [otherBefore, otherAfter],
    [teamBefore, teamAfter],
  ]) {
    assert.deepEqual(after.state, before.state);
    assert.equal(after.revision, before.revision);
  }
  assert.deepEqual(forbidden, []);
  assert.deepEqual(errors, []);
  assert.ok(requests.every((r) => ['GET', 'HEAD'].includes(r.method)));
  assert.deepEqual(hashes(), sourceHashes);
  assert.deepEqual(runtimeHashes(), copiedRuntimeHashes);
  passed = true;
} catch (e) {
  for (const [i, c] of contexts.entries())
    for (const p of c.pages())
      await p.screenshot({ path: evidence + '/failure-' + i + '.png', fullPage: false }).catch(() => {});
  throw e;
} finally {
  if (browser) await browser.close();
  save('browser-evidence.json', {
    passed,
    at: new Date().toISOString(),
    worker: process.env.ACADEMY_QA_WORKER ?? null,
    base,
    runtimeDist: runtimeDist ?? null,
    copiedRuntimeHashes,
    fixtureScope:
      'Existing previously approved fictional reader IDs; all authored publications/cohorts and policy changes are clearly labelled in-memory GET display variants, never persisted.',
    cases,
    verifiedGlobalPrograms,
    requests,
    httpRequests,
    forbidden,
    pageErrors: errors,
    sourceHashes,
    limits: [
      'Read-only same-origin loopback GET/HEAD only; no fixture/account, enrollment or other mutation.',
      'Private display fixtures exercise integrated rendering/resolution, not D1/publishing/authorization commands.',
      'True200% body text and keyboard checks do not establish screen-reader or formal accessibility conformance.',
      'All real personal/shared state and revision must remain exactly equal before/after.',
    ],
  });
  console.log(
    JSON.stringify({ passed, cases: cases.length, forbidden: forbidden.length, pageErrors: errors.length }),
  );
}
