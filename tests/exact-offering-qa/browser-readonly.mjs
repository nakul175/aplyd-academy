import assert from 'node:assert/strict';
import { withReadOnlyRoute, fetchReadOnlyResponse } from './read-only-routing.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..'),
  app = resolve(
    process.env.ACADEMY_APP_PATH ??
      (existsSync(nearby + '/app/api/academy/route.ts')
        ? nearby
        : existsSync('app/api/academy/route.ts')
          ? '.'
          : 'work/aplyd-academy'),
  ),
  output = resolve(process.env.ACADEMY_OFFERING_QA_OUTPUT ?? here + '/../runtime'),
  modelUrl = pathToFileURL(resolve(process.env.ACADEMY_OFFERING_MODEL_BUNDLE ?? output + '/model.mjs')).href;
assert.equal(
  process.env.ACADEMY_EXACT_OFFERING_WORKER_READY,
  '1',
  'Wait for root stable exact-offering integration Worker signal before any browser/network action.',
);
assert.equal(
  process.env.ACADEMY_RETAINED_EXPORT_WORKER_READY,
  '1',
  'Wait for root fresh retained-export source/model/build/frozen Worker signal before any browser/network action.',
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
const {
  createTeam,
  applyTeamCommand,
  projectTeam,
  applyWorkspaceContentCommand,
  freshWorkspace,
  learningNavigationHash,
} = await import(modelUrl);
const { chromium, browserOptions } = await import(
  pathToFileURL(app + '/tests/scoped-workbench-qa/browser-runtime.mjs')
);
const seed = JSON.parse(readFileSync(app + '/lib/curriculum-versions/0.1-review-draft.json', 'utf8'));
const evidence = resolve(process.env.ACADEMY_OFFERING_BROWSER_OUTPUT ?? output + '/browser');
mkdirSync(evidence, { recursive: true });
const save = (file, v) => writeFileSync(evidence + '/' + file, JSON.stringify(v, null, 2) + '\n');
const files = [
  'app/academy-learning.tsx',
  'lib/academy-offering-navigation.ts',
  'lib/academy-retained-export.ts',
  'app/academy-download.ts',
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
  if (['withdrawn', 'removed', 'own-active'].includes(kind)) {
    team = applyTeamCommand(
      team,
      user,
      { type: 'enroll', programId: old.ref.programId, cohortId: oldCohort },
      now,
    );
    const e = team.learners[0].state.enrollments[0];
    if (kind !== 'own-active')
      team = applyTeamCommand(team, user, { type: 'withdraw', enrollmentId: e.id }, now);
    if (kind === 'removed') team.members.find((m) => m.userId === user.userId).active = false;
  }
  if (kind === 'no-learner') team.members.find((m) => m.userId === user.userId).roles = ['admin'];
  if (kind === 'closed') team.cohorts[1].status = 'closed';
  if (kind === 'paused') team.cohorts[1].status = 'paused';
  if (kind === 'full') {
    team.cohorts[1].capacity = 1;
    team.members.find((m) => m.userId === 'display-independent-reviewer').roles = ['admin', 'learner'];
    team = applyTeamCommand(
      team,
      {
        userId: 'display-independent-reviewer',
        email: 'display-reviewer@academy.test',
        fullName: 'In-memory reviewer',
      },
      { type: 'enroll', programId: newer.ref.programId, cohortId: team.cohorts[1].id },
      now,
    );
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
  focusChecks = [],
  downloadChecks = [];
const harnessFiles = ['browser-readonly.mjs', 'read-only-routing.mjs'];
const harnessHashes = () =>
  Object.fromEntries(
    harnessFiles.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(here + '/' + file))
        .digest('hex'),
    ]),
  );
const inspectedHarnessHashes = harnessHashes(),
  modelHash = createHash('sha256')
    .update(readFileSync(fileURLToPath(modelUrl)))
    .digest('hex');
const runtimeDist = process.env.ACADEMY_OFFERING_RUNTIME_DIST;
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
assert.ok(runtimeDist, 'Root frozen dist path is required before browser acceptance.');
assert.ok(process.env.ACADEMY_QA_WORKER, 'Root stable Worker session is required.');
const copiedRuntimeHashes = runtimeHashes(),
  builtEntry = resolve(process.env.ACADEMY_OFFERING_BUILT_ENTRY ?? app + '/dist/server/index.js');
const builtEntryHash = () => createHash('sha256').update(readFileSync(builtEntry)).digest('hex');
const sourceBuildHash = builtEntryHash();
assert.equal(
  copiedRuntimeHashes['server/index.js'],
  sourceBuildHash,
  'Root built entry must equal frozen preview entry.',
);
let browser,
  passed = false,
  baselineInvarianceChecked = false;
const projectionHashes = { before: null, after: null };
const projectionHash = (value) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        state: value.state,
        revision: value.revision,
        team: value.team,
        contentVersions: value.contentVersions,
      }),
    )
    .digest('hex');
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
const focusedOption = (p, text) =>
  p.waitForFunction(
    (text) =>
      document.activeElement?.getAttribute('role') === 'option' &&
      document.activeElement.textContent?.trim() === text,
    text,
  );
async function mainHasFocus(p, stage) {
  await frames(p);
  const info = await p.evaluate(() => ({
    id: document.activeElement?.id ?? null,
    tag: document.activeElement?.tagName ?? null,
    role: document.activeElement?.getAttribute('role') ?? null,
    mainExists: !!document.getElementById('main'),
  }));
  focusChecks.push({ stage, ...info });
  assert.equal(
    info.id,
    'main',
    stage + ': existing full-route navigation should focus main; actual ' + JSON.stringify(info),
  );
}
async function page({
  u = f.other,
  workspace = null,
  variant = null,
  personalVariant = null,
  empty = false,
  width = 1440,
  pathway = null,
  hash = null,
} = {}) {
  const c = await browser.newContext({
      extraHTTPHeaders: headers(u),
      viewport: { width, height: 1000 },
      acceptDownloads: true,
    }),
    p = await c.newPage();
  contexts.push(c);
  p.setDefaultTimeout(12000);
  await p.route('**/*', (route) =>
    withReadOnlyRoute(route, origin, forbidden, async (safe) => {
      const response = await fetchReadOnlyResponse(safe, origin, forbidden);
      if (response) return safe.fulfill({ response });
    }),
  );
  if (empty)
    await p.route('**/api/academy', (route) =>
      withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        const response = await fetchReadOnlyResponse(safe, origin, forbidden);
        if (!response) return;
        const json = await response.json();
        assert.equal(json.currentUserId, u.id);
        const state = freshWorkspace();
        state.profile = { ...state.profile, ...json.state.profile };
        json.state = state;
        return safe.fulfill({ response, json });
      }),
    );
  if (personalVariant)
    await p.route('**/api/academy', (route) =>
      withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        const response = await fetchReadOnlyResponse(safe, origin, forbidden);
        if (!response) return;
        const json = await response.json();
        assert.equal(json.currentUserId, u.id);
        return safe.fulfill({ response, json: { ...json, state: structuredClone(personalVariant) } });
      }),
    );
  if (variant)
    await p.route('**/api/teams?*', (route) =>
      withReadOnlyRoute(route, origin, forbidden, async (safe) => {
        const url = new URL(safe.request().url());
        if (url.searchParams.get('id') !== workspace) {
          const response = await fetchReadOnlyResponse(safe, origin, forbidden);
          if (response) return safe.fulfill({ response });
          return;
        }
        const response = await fetchReadOnlyResponse(safe, origin, forbidden);
        if (!response) return;
        const json = await response.json();
        assert.equal(json.team.currentUserId, u.id);
        assert.equal(json.team.id, workspace);
        return safe.fulfill({ response, json: { ...json, ...structuredClone(variant) } });
      }),
    );
  p.on('request', (r) => requests.push({ method: r.method(), path: new URL(r.url()).pathname }));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(
    base +
      '/' +
      (workspace ? '?workspace=' + encodeURIComponent(workspace) : '') +
      (hash ? '#' + hash : pathway ? '#learn/' + encodeURIComponent(pathway) : '#programs'),
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
  const section = panel(p);
  await section.waitFor();
  assert.deepEqual(await section.locator('li').allTextContents(), snapshot.program.prerequisites);
  await p.getByRole('heading', { name: snapshot.program.title, exact: true }).waitFor();
}

async function unavailableOwnView(p) {
  await p.getByRole('heading', { name: 'Your saved learning content is unavailable', exact: true }).waitFor();
  assert.equal(await panel(p).count(), 0);
  assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
  assert.equal(await p.getByRole('button', { name: 'Export my retained learning', exact: true }).count(), 1);
}
async function inspectRetainedDownload(p, { name, enrollment, cohort, kind }) {
  const beforeUrl = p.url(),
    path = resolve(evidence, 'downloads', name + '.json');
  mkdirSync(resolve(evidence, 'downloads'), { recursive: true });
  const downloadEvent = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Export my retained learning', exact: true }).click();
  const downloaded = await downloadEvent;
  assert.equal(downloaded.suggestedFilename(), 'aplyd-retained-learning.json');
  const blobUrl = new URL(downloaded.url());
  assert.equal(blobUrl.protocol, 'blob:');
  assert.equal(blobUrl.origin, origin);
  assert.equal(await downloaded.failure(), null);
  await downloaded.saveAs(path);
  const raw = readFileSync(path, 'utf8'),
    value = JSON.parse(raw);
  assert.deepEqual(Object.keys(value).sort(), ['cohort', 'enrollment', 'exportedAt']);
  assert.equal(typeof value.exportedAt, 'string');
  assert.ok(Number.isFinite(Date.parse(value.exportedAt)));
  assert.deepEqual(value.enrollment, enrollment);
  assert.deepEqual(value.cohort, cohort);
  assert.equal(p.url(), beforeUrl);
  assert.ok(requests.every((r) => ['GET', 'HEAD'].includes(r.method)));
  assert.deepEqual(forbidden, []);
  downloadChecks.push({
    name,
    kind,
    filename: downloaded.suggestedFilename(),
    file: path,
    fileSha256: createHash('sha256').update(raw).digest('hex'),
    enrollmentHash:
      enrollment === null ? null : createHash('sha256').update(JSON.stringify(enrollment)).digest('hex'),
    cohortHash: cohort === null ? null : createHash('sha256').update(JSON.stringify(cohort)).digest('hex'),
    enrollmentUnchanged: true,
    cohortMatchesExpected: true,
    localBlob: true,
    routeUnchanged: true,
  });
  return value;
}
function ownUnavailableExportVariant(change = 'matching') {
  const variant = teamVariant('own-active'),
    enrollment = variant.state.enrollments.find((e) => !e.withdrawn && e.programId === old.ref.programId);
  assert.ok(enrollment);
  assert.deepEqual(enrollment.contentRef, old.ref);
  variant.contentVersions = variant.contentVersions.filter(
    (snapshot) => snapshot.ref.versionId !== old.ref.versionId,
  );
  assert.ok(variant.contentVersions.some((snapshot) => snapshot.ref.versionId === newer.ref.versionId));
  const older = variant.team.cohorts.find((cohort) => cohort.id === enrollment.cohortId),
    revised = variant.team.cohorts.find((cohort) => cohort.id === target(newer).cohortId);
  older.contentOpen = false;
  older.contentNotice = 'Display fixture: own retained exact publication is unavailable.';
  variant.team.cohorts = [revised, older];
  if (change === 'removed')
    variant.team.cohorts = variant.team.cohorts.filter((cohort) => cohort.id !== enrollment.cohortId);
  if (change === 'repointed') {
    older.version = newer.ref.versionId;
    older.contentRef = structuredClone(newer.ref);
  }
  assert.equal(
    variant.team.cohorts.find((cohort) => cohort.contentOpen && cohort.status === 'open').id,
    revised.id,
    'Concrete regression setup keeps newer cohort as first-open preview',
  );
  return {
    variant,
    enrollment: structuredClone(enrollment),
    cohort: change === 'matching' ? structuredClone(older) : null,
  };
}
const target = (snapshot) => ({
  workspaceId: f.personTeam.id,
  cohortId: t.cohorts.find((c) => c.contentRef.versionId === snapshot.ref.versionId).id,
  contentRef: snapshot.ref,
});
const hash = (snapshot) =>
  learningNavigationHash('learn', snapshot.ref.programId, { offering: target(snapshot) });
try {
  assert.ok(
    existsSync(app + '/lib/academy-offering-navigation.ts'),
    'Root must adopt and freeze the exact-offering integration before this run.',
  );
  const personalBefore = await get(f.person, '/api/academy'),
    otherBefore = await get(f.other, '/api/academy'),
    teamBefore = await get(f.person, '/api/teams?id=' + encodeURIComponent(f.personTeam.id));
  projectionHashes.before = {
    personal: projectionHash(personalBefore),
    otherPersonal: projectionHash(otherBefore),
    workspace: projectionHash(teamBefore),
  };
  browser = await chromium.launch(browserOptions);
  await scenario(
    'actual existing direct global lesson URLs keep saved learning and enrolment unchanged',
    async () => {
      const e = personalBefore.state.enrollments.find(
        (e) => !e.withdrawn && seed.pathways.some((p) => p.id === e.programId),
      );
      assert.ok(e);
      const { p, c } = await page({ u: f.person, hash: 'learn/' + e.programId + '/feedback' });
      await p.getByRole('tab', { name: 'Feedback & appeals', exact: true }).waitFor();
      assert.equal(
        await p.getByRole('tab', { name: 'Feedback & appeals', exact: true }).getAttribute('aria-selected'),
        'true',
      );
      await c.close();
    },
  );
  await scenario(
    'legacy private direct URL keeps first-open preview and requires a deliberate cohort choice',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant(),
        pathway: old.ref.programId,
      });
      await textEquals(p, old);
      assert.equal(new URL(p.url()).hash, '#learn/' + old.ref.programId);
      assert.equal(
        await p.getByRole('button', { name: 'Start this pathway', exact: true }).isDisabled(),
        true,
      );
      await c.close();
    },
  );
  await scenario(
    'clicked private catalog card previews the same exact current cohort and edition',
    async () => {
      const { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant: teamVariant() });
      const card = p.locator('.pathway-card[data-offering-cohort-id="' + target(newer).cohortId + '"]');
      await card.waitFor();
      assert.ok((await card.innerText()).includes(newer.program.title));
      assert.ok((await card.innerText()).includes('Revised display cohort'));
      await card.click();
      await textEquals(p, newer);
      assert.equal(new URL(p.url()).hash, '#' + hash(newer));
      assert.equal(
        await p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true }).innerText(),
        'Revised display cohort · 5 places',
      );
      assert.equal(
        await p.getByRole('button', { name: 'Start this pathway', exact: true }).isEnabled(),
        true,
      );
      await p.screenshot({ path: evidence + '/exact-card-to-preview.png', fullPage: false });
      await c.close();
    },
  );

  for (const key of ['Enter', 'Space'])
    await scenario(
      'native private catalog card ' + key + ' activation carries exact offering and focuses main',
      async () => {
        const { p, c } = await page({
          u: f.person,
          workspace: f.personTeam.id,
          variant: teamVariant(),
          width: 390,
        });
        const card = p.locator('.pathway-card[data-offering-cohort-id="' + target(newer).cohortId + '"]');
        await card.waitFor();
        assert.equal(await card.evaluate((e) => e.tagName), 'BUTTON');
        await card.focus();
        assert.equal(await card.evaluate((e) => e === document.activeElement), true);
        await p.keyboard.press(key);
        await textEquals(p, newer);
        assert.equal(new URL(p.url()).hash, '#' + hash(newer));
        assert.equal(
          await p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true }).innerText(),
          'Revised display cohort · 5 places',
        );
        await mainHasFocus(p, 'private card ' + key + ' activation');
        await p.screenshot({
          path: evidence + '/exact-card-keyboard-' + key.toLowerCase() + '.png',
          fullPage: false,
        });
        await c.close();
      },
    );
  await scenario('reload preserves clicked exact current offering', async () => {
    const { p, c } = await page({
      u: f.person,
      workspace: f.personTeam.id,
      variant: teamVariant(),
      hash: hash(newer),
    });
    await textEquals(p, newer);
    await p.reload();
    await p.locator('[data-save-state="loaded"]').waitFor();
    await textEquals(p, newer);
    assert.equal(new URL(p.url()).hash, '#' + hash(newer));
    await mainHasFocus(p, 'exact offering reload');
    await c.close();
  });
  await scenario(
    'manual choice records its exact hash and browser back/forward select their own editions',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant(),
        hash: hash(newer),
      });
      await textEquals(p, newer);
      const picker = p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true });
      await picker.click();
      await p.getByRole('option', { name: 'Earlier display cohort · 5 places', exact: true }).click();
      await textEquals(p, old);
      assert.equal(new URL(p.url()).hash, '#' + hash(old));
      await p.goBack();
      await textEquals(p, newer);
      await mainHasFocus(p, 'exact offering Back');
      await p.goForward();
      await textEquals(p, old);
      await mainHasFocus(p, 'exact offering Forward');
      await p.reload();
      await p.locator('[data-save-state="loaded"]').waitFor();
      await textEquals(p, old);
      await mainHasFocus(p, 'manually chosen offering reload');
      await c.close();
    },
  );
  for (const kind of ['repoint', 'remove'])
    await scenario(
      'current accepted GET ' + kind + ' never silently changes the clicked exact offering',
      async () => {
        const variant = teamVariant(),
          { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant, hash: hash(newer) });
        await textEquals(p, newer);
        if (kind === 'remove')
          variant.team.cohorts = variant.team.cohorts.filter((c) => c.id !== target(newer).cohortId);
        else {
          const cohort = variant.team.cohorts.find((c) => c.id === target(newer).cohortId);
          cohort.version = old.ref.versionId;
          cohort.contentRef = old.ref;
        }
        variant.contentVersions = variant.contentVersions.filter(
          (s) => s.ref.versionId !== newer.ref.versionId,
        );
        await p.reload();
        await p.locator('[data-save-state="loaded"]').waitFor();
        await p.getByRole('heading', { name: 'Your selected cohort is unavailable', exact: true }).waitFor();
        assert.equal(await panel(p).count(), 0);
        assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
        assert.ok(!(await p.locator('main').innerText()).includes(old.program.prerequisites[0]));
        await c.close();
      },
    );

  await scenario(
    'selected cohort keeps its exact pin but missing snapshot never substitutes the available earlier edition',
    async () => {
      const variant = teamVariant(),
        cohort = variant.team.cohorts.find((c) => c.id === target(newer).cohortId),
        originalPin = structuredClone(cohort.contentRef),
        { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant, hash: hash(newer) });
      await textEquals(p, newer);
      variant.contentVersions = variant.contentVersions.filter(
        (s) => s.ref.versionId !== newer.ref.versionId,
      );
      assert.ok(
        variant.contentVersions.some((s) => s.ref.versionId === old.ref.versionId),
        'Earlier exact source remains available in the accepted display projection',
      );
      cohort.contentOpen = false;
      cohort.contentNotice = 'Display fixture: this exact publication is unavailable.';
      assert.deepEqual(cohort.contentRef, originalPin);
      await p.reload();
      await p.locator('[data-save-state="loaded"]').waitFor();
      await p
        .getByRole('heading', { name: 'Your saved learning content is unavailable', exact: true })
        .waitFor();
      assert.equal(new URL(p.url()).hash, '#' + hash(newer));
      assert.equal(await panel(p).count(), 0);
      assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
      const shown = await p.locator('main').innerText();
      for (const snapshot of [old, newer]) {
        assert.ok(!shown.includes(snapshot.program.title));
        assert.ok(!shown.includes(snapshot.program.prerequisites[0]));
      }
      await mainHasFocus(p, 'selected snapshot unavailable reload');
      await p.screenshot({ path: evidence + '/selected-snapshot-unavailable.png', fullPage: false });
      await c.close();
    },
  );
  await scenario(
    'unavailable own active older pin takes precedence over a present revised offering',
    async () => {
      const variant = teamVariant('own-active'),
        own = variant.state.enrollments.find((e) => !e.withdrawn && e.programId === old.ref.programId),
        saved = structuredClone(own);
      assert.ok(own);
      assert.deepEqual(own.contentRef, old.ref);
      variant.contentVersions = variant.contentVersions.filter((s) => s.ref.versionId !== old.ref.versionId);
      assert.ok(
        variant.contentVersions.some((s) => s.ref.versionId === newer.ref.versionId),
        'Revised exact source remains available',
      );
      const olderCohort = variant.team.cohorts.find((c) => c.id === target(old).cohortId);
      olderCohort.contentOpen = false;
      olderCohort.contentNotice = 'Display fixture: own retained exact publication is unavailable.';
      const { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant, hash: hash(newer) });
      await p
        .getByRole('heading', { name: 'Your saved learning content is unavailable', exact: true })
        .waitFor();
      assert.equal(new URL(p.url()).hash, '#' + hash(newer));
      assert.equal(await panel(p).count(), 0);
      assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
      assert.equal(await p.getByRole('tab', { name: 'Learn & practise', exact: true }).count(), 0);
      assert.equal(
        await p.getByRole('button', { name: 'Export my retained learning', exact: true }).count(),
        1,
      );
      const shown = await p.locator('main').innerText();
      for (const snapshot of [old, newer]) {
        assert.ok(!shown.includes(snapshot.program.title));
        assert.ok(!shown.includes(snapshot.program.prerequisites[0]));
      }
      assert.deepEqual(
        variant.state.enrollments.find((e) => e.id === saved.id),
        saved,
        'Display navigation leaves retained own pin/progress unchanged',
      );
      await p.screenshot({ path: evidence + '/own-active-pin-unavailable.png', fullPage: false });
      await c.close();
    },
  );
  await scenario('cross-workspace URL metadata grants no preview or enrolment', async () => {
    const bad = {
        ...target(newer),
        workspaceId: 'tw-' + 'b'.repeat(24),
        contentRef: { ...newer.ref, scope: 'tw-' + 'b'.repeat(24) },
      },
      h = learningNavigationHash('learn', newer.ref.programId, { offering: bad }),
      { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant: teamVariant(), hash: h });
    await p.getByRole('heading', { name: 'Your selected cohort is unavailable', exact: true }).waitFor();
    assert.equal(await panel(p).count(), 0);
    assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
    await c.close();
  });
  await scenario('own active exact older enrollment wins with concise learner explanation', async () => {
    const { p, c } = await page({
      u: f.person,
      workspace: f.personTeam.id,
      variant: teamVariant('own-active'),
      hash: hash(newer),
    });
    await p.getByRole('heading', { name: old.program.title, exact: true }).waitFor();
    await p
      .getByText('You’re continuing your enrolled edition. Your saved course has not changed.', {
        exact: true,
      })
      .waitFor();
    assert.equal(await panel(p).count(), 0);
    assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
    assert.equal(await p.getByRole('tab', { name: 'Learn & practise', exact: true }).count(), 1);
    await c.close();
  });
  for (const kind of ['no-learner', 'closed', 'paused', 'full'])
    await scenario(
      'explicit URL ' + kind + ' current authority/availability never opens enrolment',
      async () => {
        const { p, c } = await page({
          u: f.person,
          workspace: f.personTeam.id,
          variant: teamVariant(kind),
          hash: hash(newer),
        });
        await textEquals(p, newer);
        assert.equal(
          await p.getByRole('button', { name: 'Start this pathway', exact: true }).isDisabled(),
          true,
        );
        await c.close();
      },
    );
  await scenario(
    'removed current own-history never offers a replacement or an enrolment action',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant('removed'),
        hash: hash(newer),
      });
      await p.getByRole('heading', { name: 'Your selected cohort is unavailable', exact: true }).waitFor();
      assert.equal(await p.getByRole('button', { name: 'Start this pathway', exact: true }).count(), 0);
      await c.close();
    },
  );
  await scenario(
    'malformed bounded offering marker cannot default to an otherwise available course',
    async () => {
      const { p, c } = await page({
        u: f.person,
        workspace: f.personTeam.id,
        variant: teamVariant(),
        hash: 'learn/' + old.ref.programId + '/offering',
      });
      await p.getByRole('heading', { name: 'Your selected cohort is unavailable', exact: true }).waitFor();
      assert.equal(await panel(p).count(), 0);
      await c.close();
    },
  );
  for (const width of [390, 768, 1440])
    for (const doubled of [false, true])
      await scenario(
        `${width}px ${doubled ? 'enlarged body32px' : 'normal'} exact offering chooser preserves keyboard focus and current hash`,
        async () => {
          const { p, c } = await page({
            u: f.person,
            workspace: f.personTeam.id,
            variant: teamVariant(),
            width,
            hash: hash(newer),
          });
          await textEquals(p, newer);
          if (doubled) await p.addStyleTag({ content: 'html, body { font-size:32px !important; }' });
          await frames(p);
          if (doubled) assert.equal(await p.evaluate(() => getComputedStyle(document.body).fontSize), '32px');
          assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          const picker = p.getByRole('combobox', { name: 'Cohort for this pathway', exact: true });
          await picker.focus();
          await p.keyboard.press('Enter');
          await p.getByRole('option', { name: 'Earlier display cohort · 5 places', exact: true }).waitFor();
          await focusedOption(p, 'Revised display cohort · 5 places');
          await p.keyboard.press('Home');
          await focusedOption(p, 'Earlier display cohort · 5 places');
          await p.keyboard.press('Enter');
          await p.waitForFunction(
            () =>
              document
                .querySelector('[role=combobox][aria-label="Cohort for this pathway"]')
                ?.getAttribute('aria-expanded') === 'false',
          );
          await frames(p);
          await textEquals(p, old);
          assert.equal(new URL(p.url()).hash, '#' + hash(old));
          assert.equal(await picker.evaluate((e) => e === document.activeElement), true);
          await panel(p).evaluate((e) => e.scrollIntoView({ block: 'start' }));
          await p.evaluate(() => window.scrollBy(0, -90));
          await frames(p);
          await p.screenshot({
            path: evidence + `/exact-offering-${width}-${doubled ? 'body32' : 'normal'}.png`,
            fullPage: false,
          });
          await c.close();
        },
      );

  for (const change of ['matching', 'removed', 'repointed'])
    await scenario(
      'actual retained download keeps own older enrollment and ' +
        change +
        ' exact cohort metadata despite newer first-open',
      async () => {
        const fixture = ownUnavailableExportVariant(change),
          { p, c } = await page({
            u: f.person,
            workspace: f.personTeam.id,
            variant: fixture.variant,
            hash: hash(newer),
            width: 390,
          });
        await unavailableOwnView(p);
        const before = structuredClone(
          fixture.variant.state.enrollments.find((e) => e.id === fixture.enrollment.id),
        );
        await inspectRetainedDownload(p, {
          name: 'own-older-' + change,
          enrollment: fixture.enrollment,
          cohort: fixture.cohort,
          kind: change === 'matching' ? 'matching-old-metadata' : 'null-when-' + change,
        });
        assert.deepEqual(
          fixture.variant.state.enrollments.find((e) => e.id === fixture.enrollment.id),
          before,
        );
        await c.close();
      },
    );
  await scenario(
    'actual personal unavailable own enrollment download contains no shared cohort metadata',
    async () => {
      const state = structuredClone(personalBefore.state),
        enrollment = state.enrollments.find(
          (e) => !e.withdrawn && seed.pathways.some((program) => program.id === e.programId),
        );
      assert.ok(enrollment, 'Approved personal fixture already has an own enrollment');
      enrollment.version = 'display-unavailable-personal-edition';
      enrollment.contentRef = {
        scope: 'global',
        programId: enrollment.programId,
        versionId: enrollment.version,
      };
      const expected = structuredClone(enrollment),
        { p, c } = await page({
          u: f.person,
          personalVariant: state,
          hash: 'learn/' + enrollment.programId,
          width: 390,
        });
      await unavailableOwnView(p);
      await inspectRetainedDownload(p, {
        name: 'personal-unavailable',
        enrollment: expected,
        cohort: null,
        kind: 'personal-cohort-null',
      });
      assert.deepEqual(
        state.enrollments.find((e) => e.id === expected.id),
        expected,
      );
      await c.close();
    },
  );
  await scenario(
    'actual preview-only unknown-body download retains only explicitly selected cohort with no enrollment',
    async () => {
      const variant = teamVariant(),
        preview = variant.team.cohorts.find((cohort) => cohort.id === target(old).cohortId);
      assert.equal(variant.state.enrollments.length, 0);
      preview.version = 'display-unavailable-preview-body';
      preview.contentRef = { ...preview.contentRef, versionId: preview.version };
      preview.contentOpen = false;
      preview.contentNotice = 'Display fixture: explicitly selected preview has no available exact body.';
      variant.contentVersions = variant.contentVersions.filter(
        (snapshot) => snapshot.ref.versionId !== old.ref.versionId,
      );
      assert.ok(variant.contentVersions.some((snapshot) => snapshot.ref.versionId === newer.ref.versionId));
      const expected = structuredClone(preview),
        intent = { workspaceId: variant.team.id, cohortId: preview.id, contentRef: preview.contentRef },
        url = learningNavigationHash('learn', preview.programId, { offering: intent }),
        { p, c } = await page({ u: f.person, workspace: f.personTeam.id, variant, hash: url, width: 390 });
      await unavailableOwnView(p);
      await inspectRetainedDownload(p, {
        name: 'preview-only-unknown-body',
        enrollment: null,
        cohort: expected,
        kind: 'selected-preview-only',
      });
      assert.equal(new URL(p.url()).hash, '#' + url);
      assert.deepEqual(
        variant.team.cohorts.find((cohort) => cohort.id === expected.id),
        expected,
      );
      await c.close();
    },
  );
  const personalAfter = await get(f.person, '/api/academy'),
    otherAfter = await get(f.other, '/api/academy'),
    teamAfter = await get(f.person, '/api/teams?id=' + encodeURIComponent(f.personTeam.id));
  projectionHashes.after = {
    personal: projectionHash(personalAfter),
    otherPersonal: projectionHash(otherAfter),
    workspace: projectionHash(teamAfter),
  };
  for (const [before, after] of [
    [personalBefore, personalAfter],
    [otherBefore, otherAfter],
    [teamBefore, teamAfter],
  ]) {
    assert.deepEqual(after.state, before.state);
    assert.equal(after.revision, before.revision);
    assert.deepEqual(after.team, before.team);
    assert.deepEqual(after.contentVersions, before.contentVersions);
  }
  assert.deepEqual(projectionHashes.after, projectionHashes.before);
  baselineInvarianceChecked = true;
  assert.deepEqual(forbidden, []);
  assert.deepEqual(errors, []);
  assert.ok(requests.every((r) => ['GET', 'HEAD'].includes(r.method)));
  assert.deepEqual(hashes(), sourceHashes);
  assert.deepEqual(runtimeHashes(), copiedRuntimeHashes);
  assert.equal(builtEntryHash(), sourceBuildHash);
  assert.deepEqual(harnessHashes(), inspectedHarnessHashes);
  assert.equal(
    cases.length,
    30,
    'All25 inherited exact-offering scenarios and5 actual local retained-download scenarios ran',
  );
  assert.equal(downloadChecks.length, 5);
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
    builtEntry,
    sourceBuildHash,
    modelHash,
    inspectedHarnessHashes,
    focusChecks,
    downloadChecks,
    plannedCases: 30,
    baselineInvarianceChecked,
    projectionHashes,
    fixtureScope:
      'Existing approved fictional readers; publication/cohort/status/enrollment variants are current actual pure-domain in-memory GET display projections only, never saved.',
    cases,
    requests,
    httpRequests,
    forbidden,
    pageErrors: errors,
    sourceHashes,
    limits: [
      'Local same-origin GET/HEAD only; no account, enrolment, membership or other persisted mutation.',
      'Rendering/navigation and metadata guards; not server command authority/CAS UAT.',
      'No external/provider transport.',
      baselineInvarianceChecked
        ? 'Actual baseline state/team/contentVersions/revision equality was completed and passed.'
        : 'Actual baseline state/team/contentVersions/revision equality was not completed; this report makes no invariance claim.',
      'The 32px enlarged body matrix tests text enlargement, not actual browser zoom.',
      'Layout/keyboard checks do not establish formal accessibility or screen-reader conformance.',
    ],
  });
  console.log(
    JSON.stringify({ passed, cases: cases.length, forbidden: forbidden.length, pageErrors: errors.length }),
  );
}
