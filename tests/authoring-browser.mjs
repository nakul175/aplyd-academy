import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture, base, headers, current, action, post, success, nonce } from './local-qa.mjs';

// Prepared for root's reviewed integration. This is NOT executed evidence until
// authoring-browser-result.json records a completed run. Local synthetic only.
const out = new URL('../.sites-runtime/', import.meta.url);
mkdirSync(out, { recursive: true });
const { owner, mod: reviewer, a: learner, b: newLearner, id, p: seed } = await fixture();
success(
  await action(owner, id, {
    type: 'member',
    userId: reviewer.id,
    roles: ['admin'],
    scopes: [],
    active: true,
  }),
);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const errors = [],
  scenarios = [],
  layout = [],
  checks = { sources: true, answers: true, rubric: true, safety: true, accessibility: true };
const checkLabels = [
  'Fictional source facts and references are coherent',
  'Every answer key and explanation was checked',
  'Practical prompts, anchors and weights match the work',
  'Information handling, uncertainty and human authority stay explicit',
  'Language, instructions and evidence expectations are clear',
];
const reviewDueAt = new Date(Date.now() + 365 * 86400000).toISOString();
const title1 = 'Private fictional customer practice ' + nonce.slice(0, 8),
  title2 = 'Private fictional customer practice revision two ' + nonce.slice(0, 8);
const draftCanary = 'UNPUBLISHED-PRIVATE-' + nonce,
  reviewCanary = 'OWNER-CONTENT-REVIEW-' + nonce;
const literalHtml = '<img src=x onerror=window.__authoringXss=1 data-authoring-xss="test">';
const draft = (x, did) => {
  const d = x.team.content?.drafts?.find((d) => d.id === did);
  assert.ok(d, 'Expected canonical owner draft');
  return d;
};
const versions = (x) => x.contentVersions ?? [];
const snapshot = (x, ref) => {
  const s = versions(x).find(
    (s) =>
      s.ref.scope === ref.scope && s.ref.programId === ref.programId && s.ref.versionId === ref.versionId,
  );
  assert.ok(s, 'Expected authorized exact private snapshot');
  return s;
};
const content = (u, type, payload) => action(u, id, { type, ...payload });
async function scenario(name, fn) {
  try {
    await fn();
    scenarios.push({ name, passed: true });
  } catch (e) {
    scenarios.push({ name, passed: false, error: String(e) });
    throw e;
  }
}
async function frames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function openPerson(u) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: headers(u),
      acceptDownloads: true,
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/?workspace=' + id + '#teams');
  await page.locator('[data-save-state="loaded"]').waitFor();
  return { context, page, u };
}
async function studio(page) {
  await page.evaluate(() => {
    location.hash = '#teams';
  });
  const tab = page.getByRole('tab', { name: 'Content studio', exact: true });
  await tab.waitFor();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await page.getByRole('heading', { name: 'Content studio', exact: true }).waitFor();
}
const editor = (page, did) => page.locator(`[data-content-editor-id="${did}"]`);
const card = (page, did) => page.locator(`[data-content-draft-id="${did}"]`);
const publication = (page, pid) => page.locator(`[data-content-publication-id="${pid}"]`);
async function selectDraft(page, did) {
  await studio(page);
  if (await editor(page, did).count()) return editor(page, did);
  if (await page.getByRole('button', { name: 'Back to content studio', exact: true }).count())
    await page.getByRole('button', { name: 'Back to content studio', exact: true }).click();
  await card(page, did).getByRole('button', { name: 'Open content draft', exact: true }).click();
  await editor(page, did).waitFor();
  return editor(page, did);
}
async function section(page, did, name) {
  await editor(page, did)
    .getByRole('navigation', { name: 'Content draft sections', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
}
async function mutation(page, button, expected = 200) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/teams') && r.request().method() === 'POST'),
    button.click(),
  ]);
  const data = await res.json();
  assert.equal(res.status(), expected, JSON.stringify(data));
  await frames(page);
  if (expected === 200) await page.locator('[data-save-state="loaded"]').waitFor();
  return data;
}
async function refreshStudio(page, did) {
  await page.reload();
  await page.locator('[data-save-state="loaded"]').waitFor();
  await studio(page);
  if (did) await selectDraft(page, did);
}
async function requestReview(page, did) {
  await section(page, did, 'Review & publication');
  await editor(page, did).getByRole('button', { name: 'Request content review', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Request independent content review', exact: true });
  await dialog.getByLabel('Independent owner reviewer', { exact: true }).selectOption(reviewer.id);
  await dialog.getByLabel('Next content review date', { exact: true }).fill(reviewDueAt.slice(0, 10));
  await mutation(page, dialog.getByRole('button', { name: 'Send for content review', exact: true }));
  await dialog.waitFor({ state: 'hidden' });
}
async function reviewDraft(page, did, decision = 'approve') {
  await refreshStudio(page, did);
  await section(page, did, 'Review & publication');
  assert.equal(
    await editor(page, did).getByRole('button', { name: 'Save content draft', exact: true }).count(),
    0,
  );
  await section(page, did, 'Overview');
  assert.equal(await editor(page, did).getByLabel('Pathway title', { exact: true }).isDisabled(), true);
  await section(page, did, 'Review & publication');
  await editor(page, did)
    .getByLabel('Content review note', { exact: true })
    .fill(
      'Independently checked the fictional sources, answer keys, rubric and responsible information boundaries. ' +
        reviewCanary,
    );
  if (decision === 'approve')
    for (const name of checkLabels)
      await editor(page, did).getByRole('checkbox', { name, exact: true }).check();
  return mutation(
    page,
    editor(page, did).getByRole('button', {
      name: decision === 'approve' ? 'Approve private practice draft' : 'Request content changes',
      exact: true,
    }),
  );
}
async function publishDraft(page, did) {
  await refreshStudio(page, did);
  await section(page, did, 'Review & publication');
  await editor(page, did)
    .getByRole('button', { name: 'Publish private practice version', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Publish this exact private practice version?',
    exact: true,
  });
  return mutation(page, dialog.getByRole('button', { name: 'Confirm private publication', exact: true }));
}

let did, ref1, ref2, doc1, cohort1, enrollment1, abandonedId;
const people = [];
try {
  const op = await openPerson(owner),
    rp = await openPerson(reviewer),
    lp = await openPerson(learner),
    np = await openPerson(newLearner);
  people.push(op, rp, lp, np);
  const o = op.page,
    r = rp.page,
    l = lp.page,
    n = np.page;
  await scenario('01 owner-only seed copying and private identity', async () => {
    assert.equal(await l.getByRole('tab', { name: 'Content studio', exact: true }).count(), 0);
    await studio(o);
    await o.getByLabel('Seed pathway', { exact: true }).selectOption(seed.id);
    const x = await mutation(o, o.getByRole('button', { name: 'Copy seed to private draft', exact: true }));
    const d = x.team.content.drafts.at(-1);
    did = d.id;
    assert.notEqual(d.programId, seed.id);
    await selectDraft(o, did);
  });
  await scenario('02 incomplete content saves but independent review stays blocked', async () => {
    await editor(o, did).getByLabel('Pathway title', { exact: true }).fill('');
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }));
    assert.equal(draft(success(await current(owner, id)), did).document.title, '');
    await section(o, did, 'Preview');
    assert.match(await editor(o, did).innerText(), /content issues? to resolve/);
    await section(o, did, 'Review & publication');
    assert.equal(
      await editor(o, did).getByRole('button', { name: 'Request content review', exact: true }).isDisabled(),
      true,
    );
    await section(o, did, 'Overview');
    await editor(o, did).getByLabel('Pathway title', { exact: true }).fill(title1);
    await editor(o, did)
      .getByLabel('Pathway summary', { exact: true })
      .fill(
        draftCanary +
          ' Fictional local practice with carefully checked records, human review and responsible information handling.',
      );
  });
  await scenario('03 stale workspace CAS retains own unsaved document', async () => {
    success(
      await action(owner, id, {
        type: 'member',
        userId: reviewer.id,
        roles: ['admin'],
        scopes: [],
        active: true,
      }),
    );
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }), 409);
    await selectDraft(o, did);
    await section(o, did, 'Overview');
    assert.equal(await editor(o, did).getByLabel('Pathway title', { exact: true }).inputValue(), title1);
    assert.ok(
      (await editor(o, did).getByLabel('Pathway summary', { exact: true }).inputValue()).includes(
        draftCanary,
      ),
    );
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }));
  });
  await scenario('04 real draft revision conflict requires explicit inspected rebase', async () => {
    const ownTitle = title1 + ' after explicit review';
    await editor(o, did).getByLabel('Pathway title', { exact: true }).fill(ownTitle);
    let x = success(await current(owner, id)),
      d = draft(x, did),
      document = structuredClone(d.document);
    document.promise =
      'Saved elsewhere: use fictional facts, check uncertainty and seek accountable human approval.';
    success(await content(owner, 'content-save', { draftId: did, revision: d.revision, document }));
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }), 409);
    await selectDraft(o, did);
    await section(o, did, 'Overview');
    assert.equal(await editor(o, did).getByLabel('Pathway title', { exact: true }).inputValue(), ownTitle);
    await editor(o, did)
      .getByText('The saved draft changed. Your unsaved document is still here.', { exact: true })
      .waitFor();
    const keep = editor(o, did).getByRole('button', {
      name: 'Keep my edits against current revision',
      exact: true,
    });
    assert.equal(await keep.isDisabled(), true);
    await editor(o, did)
      .getByRole('checkbox', {
        name: 'I checked the current saved document and want to save my edited version.',
        exact: true,
      })
      .check();
    await keep.click();
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }));
  });
  await scenario('05 lessons, answer keys and practical rubric edit with escaped HTML', async () => {
    await section(o, did, 'Lesson 1');
    await editor(o, did)
      .getByLabel('Lesson title', { exact: true })
      .fill('Version one fictional source inspection');
    await editor(o, did)
      .getByLabel('Lesson explanation', { exact: true })
      .fill(
        'Read the fictional records carefully. Trace each answer to a source and ask the accountable human when information is uncertain.',
      );
    await editor(o, did).getByLabel('Supplied AI draft', { exact: true }).fill(literalHtml);
    await editor(o, did)
      .getByLabel('Question 1 correct option', { exact: true })
      .selectOption(String((seed.lessons[0].quiz[0].correctOptionIndex + 1) % 4));
    await editor(o, did)
      .getByLabel('Question 1 explanation', { exact: true })
      .fill(
        'The synthetic local test answer key differs from the seed so exact version resolution can be verified.',
      );
    await section(o, did, 'Practical task');
    await editor(o, did)
      .getByLabel('Criterion 1 name', { exact: true })
      .fill('Version one reference tracing');
    await mutation(o, editor(o, did).getByRole('button', { name: 'Save content draft', exact: true }));
    await section(o, did, 'Preview');
    await editor(o, did).getByText('Ready for independent content review', { exact: true }).waitFor();
    await editor(o, did)
      .getByText('Lesson 1: Version one fictional source inspection', { exact: true })
      .click();
    assert.ok((await editor(o, did).innerText()).includes(literalHtml));
    assert.equal(await o.locator('img[data-authoring-xss]').count(), 0);
    assert.equal(await o.evaluate(() => window.__authoringXss), undefined);
  });
  await scenario(
    '06 owner editor, review dialog and preview responsive at true 200 percent text',
    async () => {
      for (const width of [1440, 768, 390])
        for (const enlarged of [false, true]) {
          await o.setViewportSize({ width, height: 1000 });
          const font = await o.evaluate((enlarged) => {
            document.documentElement.style.fontSize = '';
            document.body.style.fontSize = '';
            const root = parseFloat(getComputedStyle(document.documentElement).fontSize),
              body = parseFloat(getComputedStyle(document.body).fontSize);
            if (enlarged) {
              document.documentElement.style.fontSize = root * 2 + 'px';
              document.body.style.fontSize = body * 2 + 'px';
            }
            return { baselineBody: body, actualBody: parseFloat(getComputedStyle(document.body).fontSize) };
          }, enlarged);
          assert.ok(Math.abs(font.actualBody / font.baselineBody - (enlarged ? 2 : 1)) < 0.01);
          layout.push({
            width,
            enlarged,
            ...font,
            view: 'preview',
            overflow: await o.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          });
          await editor(o, did)
            .getByRole('heading', { name: 'Content preview', exact: true })
            .scrollIntoViewIfNeeded();
          if (width !== 768)
            await o.screenshot({
              path: new URL(`authoring-preview-${width}-${enlarged ? 'text200' : 'normal'}.png`, out)
                .pathname,
              fullPage: false,
              animations: 'disabled',
            });
          await section(o, did, 'Review & publication');
          const opener = editor(o, did).getByRole('button', { name: 'Request content review', exact: true });
          await opener.click();
          const dialog = o.getByRole('dialog', { name: 'Request independent content review', exact: true });
          await o.waitForFunction(() => {
            const d = document.querySelector('[role=dialog]');
            return d && Number(getComputedStyle(d).opacity) >= 0.99;
          });
          layout.push({
            width,
            enlarged,
            ...font,
            view: 'review-dialog',
            overflow: await o.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          });
          if (width !== 768)
            await o.screenshot({
              path: new URL(`authoring-review-dialog-${width}-${enlarged ? 'text200' : 'normal'}.png`, out)
                .pathname,
              fullPage: false,
              animations: 'disabled',
            });
          await o.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.equal(await opener.evaluate((el) => document.activeElement === el), true);
          await section(o, did, 'Preview');
        }
      assert.ok(!layout.some((x) => x.overflow), JSON.stringify(layout));
      await o.setViewportSize({ width: 1440, height: 1000 });
      await o.evaluate(() => {
        document.documentElement.style.fontSize = '';
        document.body.style.fontSize = '';
      });
    },
  );
  await scenario('07 independent reviewer requests changes, approval and author recall', async () => {
    await requestReview(o, did);
    await reviewDraft(r, did, 'changes');
    assert.equal(draft(success(await current(owner, id)), did).state, 'draft');
    await refreshStudio(o, did);
    await requestReview(o, did);
    await reviewDraft(r, did);
    await refreshStudio(o, did);
    await section(o, did, 'Review & publication');
    await editor(o, did).getByRole('button', { name: 'Recall for editing', exact: true }).click();
    const dialog = o.getByRole('dialog', { name: 'Recall this draft for editing?', exact: true });
    await dialog
      .getByLabel('Reason to recall content', { exact: true })
      .fill('Reconfirm this fictional practice before immutable publication.');
    await mutation(o, dialog.getByRole('button', { name: 'Confirm content recall', exact: true }));
    const d = draft(success(await current(owner, id)), did);
    assert.equal(d.state, 'draft');
    assert.ok(!d.approval);
    await requestReview(o, did);
    await reviewDraft(r, did);
  });
  await scenario('08 immutable private publication and learner-private drafts', async () => {
    const x = await publishDraft(o, did),
      d = draft(x, did);
    ref1 = d.publishedRef;
    doc1 = structuredClone(d.document);
    assert.deepEqual(snapshot(x, ref1).program, doc1);
    await publication(o, ref1.versionId).waitFor();
    await publication(o, ref1.versionId)
      .getByRole('button', { name: 'Preview publication', exact: true })
      .click();
    const dialog = o.getByRole('dialog', { name: 'Published private practice', exact: true });
    await dialog.getByRole('heading', { name: doc1.title, exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Save content draft', exact: true }).count(), 0);
    await o.keyboard.press('Escape');
    const mine = success(await current(learner, id));
    assert.equal(mine.team.content?.drafts?.length ?? 0, 0);
    assert.ok(!JSON.stringify(mine).includes(reviewCanary));
    assert.ok(!JSON.stringify(mine).includes(draftCanary));
  });
  await scenario(
    '09 publication offer opens an exact private cohort dialog and authored learner key',
    async () => {
      await publication(o, ref1.versionId)
        .getByRole('button', { name: 'Offer in new cohort', exact: true })
        .click();
      const offering = o.getByRole('dialog', { name: 'Create a learning cohort', exact: true });
      await offering.waitFor();
      assert.equal(
        await o
          .locator('[role=tab]')
          .filter({ hasText: /^Cohorts$/ })
          .getAttribute('aria-selected'),
        'true',
      );
      assert.equal(
        await offering.getByRole('combobox', { name: 'Draft pathway', exact: true }).innerText(),
        doc1.title + ' · private ' + ref1.versionId.slice(0, 11),
      );
      await offering.getByLabel('Cohort name', { exact: true }).fill('Exact private version one circle');
      await offering.getByLabel('Maximum learners (1–100)', { exact: true }).fill('10');
      let x = await mutation(o, offering.getByRole('button', { name: 'Open cohort', exact: true }));
      cohort1 = x.team.cohorts.at(-1).id;
      assert.deepEqual(x.team.cohorts.at(-1).contentRef, ref1);
      await l.reload();
      await l.locator('[data-save-state="loaded"]').waitFor();
      const cohort = l
        .locator('.cohort-card')
        .filter({ has: l.getByRole('heading', { name: 'Exact private version one circle', exact: true }) });
      await mutation(l, cohort.getByRole('button', { name: 'Enroll in this cohort', exact: true }));
      await l.getByRole('heading', { name: doc1.title, exact: true }).waitFor();
      await l.getByRole('heading', { name: doc1.lessons[0].title, exact: true }).waitFor();
      await l
        .getByLabel('Your corrected work and reasoning', { exact: true })
        .fill(
          'I checked the fictional source facts, removed unsupported claims and kept accountable human approval for real work.',
        );
      for (const q of doc1.lessons[0].quiz)
        await l
          .getByRole('radiogroup', { name: q.question, exact: true })
          .getByRole('radio')
          .nth(q.correctOptionIndex)
          .check();
      await l.getByRole('button', { name: 'Check my answers', exact: true }).click();
      await mutation(l, l.getByRole('button', { name: 'Complete lesson', exact: true }));
      x = success(await current(learner, id));
      const e = x.state.enrollments.find((e) => e.programId === ref1.programId);
      enrollment1 = e.id;
      assert.deepEqual(e.contentRef, ref1);
      assert.ok(e.completed.includes(doc1.lessons[0].id));
      assert.equal(await l.locator('img[data-authoring-xss]').count(), 0);
      assert.equal(await l.evaluate(() => window.__authoringXss), undefined);
    },
  );
  await scenario(
    '10 API revision two leaves old browser learner and assigned assessor on version one',
    async () => {
      let x = success(await content(owner, 'content-copy', { sourceRef: ref1 })),
        d = x.team.content.drafts.at(-1),
        document = structuredClone(d.document);
      document.title = title2;
      document.lessons[0].title = 'Version two source inspection';
      document.practicalAssessment.rubric[0].dimension = 'Version two reference tracing';
      x = success(await content(owner, 'content-save', { draftId: d.id, revision: d.revision, document }));
      d = draft(x, d.id);
      x = success(
        await content(owner, 'content-submit', {
          draftId: d.id,
          revision: d.revision,
          reviewerId: reviewer.id,
          reviewDueAt,
        }),
      );
      d = draft(x, d.id);
      x = success(
        await content(reviewer, 'content-review', {
          draftId: d.id,
          revision: d.revision,
          decision: 'approve',
          checks,
          note: 'Independently checked the revised fictional references, answer keys, practical rubric, safety boundaries and clear instructions.',
        }),
      );
      d = draft(x, d.id);
      x = success(await content(owner, 'content-publish', { draftId: d.id, revision: d.revision }));
      ref2 = draft(x, d.id).publishedRef;
      assert.notEqual(ref2.versionId, ref1.versionId);
      await l.goto(base + '/?workspace=' + id + '#learn/' + ref1.programId + '/learn/' + doc1.lessons[0].id);
      await l.reload();
      await l.locator('[data-save-state="loaded"]').waitFor();
      await l.getByRole('heading', { name: doc1.title, exact: true }).waitFor();
      assert.ok(!(await l.locator('main').innerText()).includes(title2));
      for (const lesson of doc1.lessons.slice(1))
        success(
          await action(learner, id, {
            type: 'lesson',
            enrollmentId: enrollment1,
            lessonId: lesson.id,
            practice:
              'Checked the fictional source facts and kept privacy, uncertainty and accountable human approval explicit.',
            answers: lesson.quiz.map((q) => q.correctOptionIndex),
          }),
        );
      const fields = Object.fromEntries(
        doc1.practicalAssessment.submissionPrompts.map((f) => [
          f.id,
          'Synthetic checked source references, careful privacy handling and explicit human approval remain required.',
        ]),
      );
      x = success(
        await action(learner, id, { type: 'submit', enrollmentId: enrollment1, fields, confirmed: true }),
      );
      const attemptId = x.state.enrollments.find((e) => e.id === enrollment1).attempts.at(-1).id;
      success(
        await action(owner, id, {
          type: 'member',
          userId: reviewer.id,
          roles: ['admin', 'assessor'],
          scopes: [cohort1],
          active: true,
        }),
      );
      success(
        await action(owner, id, {
          type: 'assign',
          kind: 'assessment',
          targetId: attemptId,
          staffId: reviewer.id,
        }),
      );
      await r.goto(base + '/?workspace=' + id + '#studio');
      await r.reload();
      await r.locator('[data-save-state="loaded"]').waitFor();
      await r.locator('.review-queue').getByRole('button').filter({ hasText: learner.name }).click();
      await r
        .getByRole('combobox', { name: doc1.practicalAssessment.rubric[0].dimension + ' score', exact: true })
        .waitFor();
      assert.ok(!(await r.locator('main').innerText()).includes('Version two reference tracing'));
    },
  );
  await scenario(
    '11 closing new enrollment preserves old learning and unchanged global catalog',
    async () => {
      await refreshStudio(o);
      await publication(o, ref1.versionId)
        .getByRole('button', { name: 'Close new enrollment', exact: true })
        .click();
      const dialog = o.getByRole('dialog', { name: 'Close this version to new enrollment?', exact: true });
      await dialog
        .getByLabel('Reason for closing new enrollment', { exact: true })
        .fill('Offer the revised fictional practice to new learners while preserving old cohort references.');
      await mutation(o, dialog.getByRole('button', { name: 'Confirm close new enrollment', exact: true }));
      assert.equal(
        (await action(newLearner, id, { type: 'enroll', programId: ref1.programId, cohortId: cohort1 }))
          .status,
        409,
      );
      await l.goto(base + '/?workspace=' + id + '#learn/' + ref1.programId + '/learn/' + doc1.lessons[0].id);
      await l.reload();
      await l.locator('[data-save-state="loaded"]').waitFor();
      await l.getByRole('heading', { name: doc1.title, exact: true }).waitFor();
      await l.goto(base + '/?workspace=' + id + '#programs');
      await l.locator('[data-save-state="loaded"]').waitFor();
      assert.equal(await l.locator('.pathway-card').count(), 4);
      await l.getByRole('heading', { name: doc1.title, exact: true }).waitFor();
      await l.getByRole('combobox', { name: 'Choose Academy workspace', exact: true }).click();
      await l.getByRole('option', { name: 'Personal practice lab', exact: true }).click();
      await l.locator('[data-save-state="loaded"]').waitFor();
      await l.getByRole('button', { name: 'Learning pathways', exact: true }).click();
      assert.equal(await l.locator('.pathway-card').count(), 3);
      const catalog = await l.locator('main').innerText();
      assert.ok(!catalog.includes(doc1.title));
      assert.ok(!catalog.includes(title2));
      const unrelated = success(await current(newLearner, id));
      assert.ok(!JSON.stringify(unrelated).includes(reviewCanary));
    },
  );
  await scenario(
    '12 revoked owner hides server content, preserves own unsent edit and scopes workspace switches',
    async () => {
      let x = success(await content(owner, 'content-copy', { sourceRef: ref2 })),
        d = x.team.content.drafts.at(-1),
        document = structuredClone(d.document);
      abandonedId = d.id;
      const savedPrivate = 'SAVED-OWNER-PRIVATE-' + nonce,
        ownUnsent = 'MY-UNSENT-OWNER-TITLE-' + nonce;
      document.title = savedPrivate;
      x = success(await content(owner, 'content-save', { draftId: d.id, revision: d.revision, document }));
      await refreshStudio(o, abandonedId);
      await section(o, abandonedId, 'Overview');
      await editor(o, abandonedId).getByLabel('Pathway title', { exact: true }).fill(ownUnsent);
      const otherName = 'Separate synthetic content domain ' + nonce.slice(0, 8),
        other = success(
          await post(
            owner,
            undefined,
            {
              type: 'create',
              name: otherName,
              purpose: 'A separate local fictional workspace to verify private content resolver isolation.',
              context: 'msme',
            },
            0,
          ),
        ),
        otherId = other.team.id;
      success(
        await action(reviewer, id, {
          type: 'member',
          userId: owner.id,
          roles: ['learner'],
          scopes: [],
          active: true,
        }),
      );
      await mutation(
        o,
        editor(o, abandonedId).getByRole('button', { name: 'Save content draft', exact: true }),
        409,
      );
      await o.waitForFunction(() => document.querySelectorAll('[data-content-editor-id]').length === 0);
      assert.ok(!(await o.locator('main').innerText()).includes(savedPrivate));
      assert.equal((await current(owner, id)).team.content?.drafts?.length ?? 0, 0);
      assert.equal(draft(success(await current(reviewer, id)), abandonedId).document.title, savedPrivate);
      success(
        await action(reviewer, id, {
          type: 'member',
          userId: owner.id,
          roles: ['admin', 'learner'],
          scopes: [],
          active: true,
        }),
      );
      await o.getByRole('button', { name: 'Retry connection', exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await selectDraft(o, abandonedId);
      await section(o, abandonedId, 'Overview');
      assert.equal(
        await editor(o, abandonedId).getByLabel('Pathway title', { exact: true }).inputValue(),
        ownUnsent,
      );
      const mainName = success(await current(owner, id)).team.name;
      const switcher = o.getByRole('combobox', { name: 'Choose Academy workspace', exact: true });
      await switcher.click();
      await o.getByRole('option', { name: otherName, exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await studio(o);
      assert.equal(await o.locator('[data-content-draft-id]').count(), 0);
      assert.equal(await o.locator('[data-content-publication-id]').count(), 0);
      await o.evaluate((pid) => {
        location.hash = '#learn/' + pid;
      }, ref1.programId);
      await frames(o);
      assert.ok(!(await o.locator('main').innerText()).includes(doc1.title));
      assert.ok(!JSON.stringify(success(await current(owner, otherId))).includes(ref1.versionId));
      await switcher.click();
      await o.getByRole('option', { name: mainName, exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await selectDraft(o, abandonedId);
      await section(o, abandonedId, 'Overview');
      assert.equal(
        await editor(o, abandonedId).getByLabel('Pathway title', { exact: true }).inputValue(),
        ownUnsent,
      );
    },
  );
  await scenario(
    '13 another owner archives an abandoned draft with read-only history and a freed slot',
    async () => {
      await refreshStudio(r, abandonedId);
      await section(r, abandonedId, 'Review & publication');
      await editor(r, abandonedId)
        .getByRole('button', { name: 'Archive this content draft', exact: true })
        .click();
      const dialog = r.getByRole('dialog', { name: 'Archive this unpublished draft?', exact: true });
      const reason =
        'Abandoned fictional local draft archived by another current owner, retaining its provenance.';
      await dialog.getByLabel('Reason to archive content', { exact: true }).fill(reason);
      await mutation(r, dialog.getByRole('button', { name: 'Confirm content archive', exact: true }));
      const x = success(await current(owner, id)),
        d = draft(x, abandonedId);
      assert.equal(d.state, 'archived');
      assert.ok(d.history.some((h) => h.note === reason));
      assert.equal(
        x.team.content.drafts.filter((d) => !['published', 'archived'].includes(d.state)).length,
        0,
      );
      await refreshStudio(r);
      await r.getByText('Archived content drafts (1)', { exact: true }).click();
      await card(r, abandonedId)
        .getByRole('button', { name: 'Read archived content draft', exact: true })
        .click();
      await section(r, abandonedId, 'Overview');
      assert.equal(
        await editor(r, abandonedId).getByLabel('Pathway title', { exact: true }).isDisabled(),
        true,
      );
      assert.equal(
        await editor(r, abandonedId).getByRole('button', { name: 'Save content draft', exact: true }).count(),
        0,
      );
      await section(r, abandonedId, 'Review & publication');
      await editor(r, abandonedId).getByText('Preserved draft history', { exact: true }).click();
      await editor(r, abandonedId).getByText(reason, { exact: false }).waitFor();
      await editor(r, abandonedId)
        .getByRole('button', { name: 'Back to content studio', exact: true })
        .click();
      assert.equal(
        await r.getByRole('button', { name: 'Copy seed to private draft', exact: true }).isEnabled(),
        true,
      );
      // Refresh the author's authority through an in-app workspace switch, keeping
      // their existing unsent scratch in memory. Terminal history must be canonical.
      const mainName = x.team.name,
        switcher = o.getByRole('combobox', { name: 'Choose Academy workspace', exact: true });
      await switcher.click();
      await o.getByRole('option', { name: 'Personal practice lab', exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await switcher.click();
      await o.getByRole('option', { name: mainName, exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await selectDraft(o, abandonedId);
      await section(o, abandonedId, 'Overview');
      assert.equal(
        await editor(o, abandonedId).getByLabel('Pathway title', { exact: true }).inputValue(),
        d.document.title,
        "Archived read-only content must use saved canonical text, not the author's previously unsent edit.",
      );
      await editor(o, abandonedId)
        .getByText('Your earlier unsent edits are separate from this preserved document.', { exact: true })
        .waitFor();
      await editor(o, abandonedId).getByText('My retained unsent editor text', { exact: true }).click();
      assert.ok((await editor(o, abandonedId).innerText()).includes('MY-UNSENT-OWNER-TITLE-' + nonce));
    },
  );
  assert.deepEqual(errors, []);
  const result = {
    preparedFor: 'v0.6 candidate integration',
    executedAt: new Date().toISOString(),
    passed: true,
    fixtureId: id,
    scenarios,
    responsiveChecks: layout.length,
    layout,
    pageErrors: errors,
    hybridFixtureSteps: [
      'Second publication lifecycle',
      'Remaining lesson completion and staff assignment',
      'Retired new-enrollment rejection',
    ],
    limits: [
      'Loopback synthetic identities only; no hosted authentication',
      'Second-version setup and assessor assignment are API fixtures; first authoring and publication lifecycle is browser-operated',
      'No accreditation, real participant sharing, notification or live AI behavior is tested',
    ],
  };
  writeFileSync(new URL('authoring-browser-result.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  for (const [i, person] of people.entries())
    await person.page
      .screenshot({
        path: new URL(`authoring-failure-${i + 1}.png`, out).pathname,
        fullPage: false,
        animations: 'disabled',
      })
      .catch(() => {});
  writeFileSync(
    new URL('authoring-browser-result.json', out),
    JSON.stringify(
      { passed: false, fixtureId: id, scenarios, layout, pageErrors: errors, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
