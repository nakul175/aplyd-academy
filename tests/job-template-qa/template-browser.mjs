import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app, output, rootModule, localHelpers } from './qa-paths.mjs';
// Root must have both a stable Worker and the explicit user approval before execution.
const q = await localHelpers(),
  { chromium, browserOptions } = await import(rootModule('tests/scoped-workbench-qa/browser-runtime.mjs'));
const { owner, mod: reviewer, a: learner, id } = await q.fixture();
q.success(
  await q.action(owner, id, {
    type: 'member',
    userId: reviewer.id,
    roles: ['admin'],
    scopes: [],
    active: true,
  }),
);
const browser = await chromium.launch(browserOptions),
  people = [],
  scenarios = [],
  layouts = [],
  pageErrors = [],
  startedAt = new Date().toISOString();
let firstId, heldId;
const defer = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  },
  cards = (page) => page.locator('[data-content-draft-id]'),
  picker = (page) => page.locator('[data-job-template-picker]'),
  editor = (page, did) => page.locator(`[data-content-editor-id="${did}"]`);
async function ready(page) {
  await page.locator('[data-save-state="loaded"]').first().waitFor();
  await frames(page);
}
async function frames(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function open(u) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: q.headers(u),
    }),
    page = await context.newPage();
  people.push({ context, page, u });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(q.base + '/?workspace=' + encodeURIComponent(id) + '#teams');
  await ready(page);
  return page;
}
async function studio(page) {
  const tab = page.getByRole('tab', { name: 'Content studio', exact: true });
  await tab.waitFor();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await page.getByRole('heading', { name: 'Content studio', exact: true }).waitFor();
  await frames(page);
}
async function refreshStudio(page) {
  await page.reload();
  await ready(page);
  await studio(page);
}
async function mutation(page, button, status = 200) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/teams') && r.request().method() === 'POST'),
    button.click(),
  ]);
  const body = await res.json();
  assert.equal(res.status(), status, JSON.stringify(body));
  await frames(page);
  if (status === 200) await ready(page);
  return body;
}
async function create(page, templateId) {
  await picker(page).getByLabel('Job-practice starting point', { exact: true }).selectOption(templateId);
  return mutation(
    page,
    picker(page).getByRole('button', { name: 'Create private job-practice draft', exact: true }),
  );
}
async function select(page, did) {
  if (await editor(page, did).count()) return;
  if (await page.getByRole('button', { name: 'Back to content studio', exact: true }).count())
    await page.getByRole('button', { name: 'Back to content studio', exact: true }).click();
  await page
    .locator(`[data-content-draft-id="${did}"]`)
    .getByRole('button', { name: 'Open content draft', exact: true })
    .click();
  await editor(page, did).waitFor();
}
async function section(page, did, label) {
  await editor(page, did)
    .getByRole('navigation', { name: 'Content draft sections', exact: true })
    .getByRole('button', { name: label, exact: true })
    .click();
}
async function scenario(name, fn) {
  try {
    await fn();
    scenarios.push({ name, passed: true });
  } catch (error) {
    scenarios.push({ name, passed: false, error: String(error) });
    throw error;
  }
}
try {
  const o = await open(owner),
    l = await open(learner);
  await studio(o);
  await scenario('01 picker exists only for a current owner in new-draft studio', async () => {
    assert.equal(await l.getByRole('tab', { name: 'Content studio', exact: true }).count(), 0);
    await picker(o).waitFor();
    assert.equal(
      await picker(o).getByLabel('Job-practice starting point', { exact: true }).locator('option').count(),
      4,
    );
    await picker(o).getByLabel('Job-practice starting point', { exact: true }).focus();
    await o.keyboard.press('ArrowDown');
    assert.equal(
      await picker(o)
        .getByLabel('Job-practice starting point', { exact: true })
        .evaluate((e) => document.activeElement === e),
      true,
    );
  });
  await scenario(
    '02 explicit create acknowledges one complete saved draft without publication or enrollment',
    async () => {
      const x = await create(o, 'msme-customer-commitments'),
        d = x.team.content.drafts.at(-1);
      firstId = d.id;
      assert.equal(d.state, 'draft');
      assert.equal(d.revision, 2);
      assert.equal(d.documentRevision, 2);
      assert.equal(d.approval, undefined);
      assert.equal(d.publishedRef, undefined);
      assert.equal(x.team.content.publications.length, 0);
      assert.equal(x.state.enrollments.length, 0);
      await o.locator(`[data-content-draft-id="${d.id}"]`).waitFor();
      await select(o, d.id);
      assert.equal(await picker(o).count(), 0);
      assert.equal(
        await editor(o, d.id).getByLabel('Pathway title', { exact: true }).inputValue(),
        d.document.title,
      );
      await editor(o, d.id).locator('[data-job-template-origin]').waitFor();
      await section(o, d.id, 'Lesson 1');
      assert.equal(
        await editor(o, d.id).getByLabel('Supplied AI draft', { exact: true }).inputValue(),
        d.document.lessons[0].exercise.suppliedAiDraft,
      );
      assert.equal(
        await editor(o, d.id).getByLabel('Question 1 correct option', { exact: true }).inputValue(),
        String(d.document.lessons[0].quiz[0].correctOptionIndex),
      );
      await section(o, d.id, 'Review & publication');
      assert.equal(
        await editor(o, d.id)
          .getByRole('button', { name: 'Publish private practice version', exact: true })
          .count(),
        0,
      );
    },
  );
  await scenario('03 independent review dialog uses real keyboard Escape and returns focus', async () => {
    const button = editor(o, firstId).getByRole('button', { name: 'Request content review', exact: true });
    await button.focus();
    await o.keyboard.press('Enter');
    const dialog = o.getByRole('dialog', { name: 'Request independent content review', exact: true });
    await dialog.waitFor();
    await o.waitForFunction(() => {
      const d = document.querySelector('[role=dialog]');
      return d && Number(getComputedStyle(d).opacity) >= 0.99;
    });
    await o.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await button.evaluate((e) => document.activeElement === e), true);
    await editor(o, firstId).getByRole('button', { name: 'Back to content studio', exact: true }).click();
  });
  await scenario(
    '04 held create locks choice and commits only the captured selected starting point',
    async () => {
      const captured = defer(),
        release = defer();
      let posts = 0;
      await o.route('**/api/teams', async (route) => {
        const r = route.request();
        if (r.method() !== 'POST' || r.postDataJSON()?.command?.type !== 'content-job-template')
          return route.continue();
        posts++;
        captured.resolve();
        await release.promise;
        return route.continue();
      });
      try {
        await picker(o)
          .getByLabel('Job-practice starting point', { exact: true })
          .selectOption('farmer-expert-brief');
        const wait = o.waitForResponse(
          (r) => r.url().endsWith('/api/teams') && r.request().method() === 'POST',
        );
        await picker(o)
          .getByRole('button', { name: 'Create private job-practice draft', exact: true })
          .click();
        await captured.promise;
        assert.equal(
          await picker(o).getByLabel('Job-practice starting point', { exact: true }).isDisabled(),
          true,
        );
        assert.equal(
          await picker(o).getByRole('button', { name: 'Creating private draft…', exact: true }).isDisabled(),
          true,
        );
        release.resolve();
        const response = await wait,
          body = await response.json();
        assert.equal(response.status(), 200);
        heldId = body.team.content.drafts.at(-1).id;
        assert.equal(body.team.content.drafts.at(-1).templateOrigin.templateId, 'farmer-expert-brief');
        await ready(o);
        assert.equal(posts, 1);
      } finally {
        release.resolve();
        await o.unroute('**/api/teams');
      }
    },
  );
  await scenario(
    '05 all four role drafts remain distinct and active capacity disables further creation',
    async () => {
      for (const templateId of ['public-source-brief', 'frontline-spot-override-flag']) {
        const x = await create(o, templateId),
          d = x.team.content.drafts.at(-1);
        assert.equal(d.templateOrigin.templateId, templateId);
        assert.equal(d.baseRef.programId, 'public-servant-source-briefs');
        assert.equal(d.document.role, 'Public servant');
        assert.equal(d.state, 'draft');
        assert.equal(x.team.content.publications.length, 0);
      }
      const x = q.success(await q.current(owner, id));
      assert.equal(x.team.content.drafts.length, 4);
      assert.equal(new Set(x.team.content.drafts.map((d) => d.programId)).size, 4);
      assert.equal(
        await picker(o)
          .getByRole('button', { name: 'Create private job-practice draft', exact: true })
          .isDisabled(),
        true,
      );
    },
  );
  await scenario(
    '06 native selection and actions fit desktop/tablet/mobile at normal and true200% text',
    async () => {
      for (const width of [390, 768, 1440])
        for (const scale of [1, 2]) {
          await o.setViewportSize({ width, height: 1000 });
          await o.evaluate((scale) => {
            document.documentElement.style.fontSize = scale === 2 ? '32px' : '16px';
            document.body.style.fontSize = scale === 2 ? '32px' : '16px';
          }, scale);
          await frames(o);
          await picker(o).scrollIntoViewIfNeeded();
          const geometry = await picker(o).evaluate((region) => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
            rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
            controls: [...region.querySelectorAll('select,button')]
              .filter((e) => e.getClientRects().length)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return {
                  label: e.getAttribute('aria-label') || e.textContent,
                  left: r.left,
                  right: r.right,
                  height: r.height,
                };
              }),
          }));
          assert.ok(geometry.scrollWidth <= width + 1, JSON.stringify(geometry));
          assert.ok(
            geometry.controls.every((r) => r.left >= -1 && r.right <= width + 1 && r.height >= 44),
            JSON.stringify(geometry),
          );
          assert.equal(geometry.bodyFont, scale * 16);
          assert.equal(geometry.rootFont, scale * 16);
          await o.screenshot({
            path: resolve(output, `template-picker-${width}-text${scale}.png`),
            fullPage: false,
            animations: 'disabled',
          });
          layouts.push({ width, textScale: scale, passed: true, geometry });
        }
      await o.setViewportSize({ width: 1440, height: 1000 });
      await o.evaluate(() => {
        document.documentElement.style.fontSize = '16px';
        document.body.style.fontSize = '16px';
      });
    },
  );
  await scenario(
    '07 revoked owner loses canonical draft body while own unsent editor text returns only after current restoration',
    async () => {
      await select(o, firstId);
      await section(o, firstId, 'Overview');
      const unsent = 'OWN-UNSENT-TEMPLATE-' + crypto.randomUUID();
      await editor(o, firstId).getByLabel('Pathway title', { exact: true }).fill(unsent);
      q.success(
        await q.action(reviewer, id, {
          type: 'member',
          userId: owner.id,
          roles: ['learner'],
          scopes: [],
          active: true,
        }),
      );
      await mutation(
        o,
        editor(o, firstId).getByRole('button', { name: 'Save content draft', exact: true }),
        409,
      );
      await o.waitForFunction(() => !document.querySelector('[data-content-editor-id]'));
      assert.equal(await o.locator('[data-job-template-origin]').count(), 0);
      assert.ok(!(await o.locator('main').innerText()).includes(unsent));
      assert.equal(q.success(await q.current(owner, id)).team.content, undefined);
      q.success(
        await q.action(reviewer, id, {
          type: 'member',
          userId: owner.id,
          roles: ['admin', 'learner'],
          scopes: [],
          active: true,
        }),
      );
      await o.getByRole('button', { name: 'Refresh saved progress', exact: true }).click();
      await ready(o);
      await studio(o);
      await select(o, firstId);
      await section(o, firstId, 'Overview');
      assert.equal(
        await editor(o, firstId).getByLabel('Pathway title', { exact: true }).inputValue(),
        unsent,
      );
      assert.equal(await picker(o).count(), 0);
    },
  );
  await scenario(
    '08 acknowledged but wrong-workspace response is uncertain with no automatic second draft',
    async () => {
      const before = q.success(await q.current(owner, id)),
        d = before.team.content.drafts.find((d) => d.id === heldId);
      q.success(
        await q.action(reviewer, id, {
          type: 'content-archive',
          draftId: d.id,
          revision: d.revision,
          reason: 'Free one active slot while preserving the fictional draft history.',
        }),
      );
      await refreshStudio(o);
      const original = q.success(await q.current(owner, id)),
        ids = original.team.content.drafts.map((d) => d.id);
      let posts = 0;
      await o.route('**/api/teams', async (route) => {
        const r = route.request();
        if (r.method() !== 'POST' || r.postDataJSON()?.command?.type !== 'content-job-template')
          return route.continue();
        posts++;
        const response = await route.fetch(),
          body = await response.json();
        assert.equal(response.status(), 200);
        body.team.id = 'tw-wrong-workspace-acknowledgement';
        return route.fulfill({ response, json: body });
      });
      try {
        await picker(o)
          .getByLabel('Job-practice starting point', { exact: true })
          .selectOption('msme-customer-commitments');
        await picker(o)
          .getByRole('button', { name: 'Create private job-practice draft', exact: true })
          .click();
        await o.locator('[data-save-state="attention"]').waitFor();
        assert.equal(await picker(o).count(), 0);
        assert.equal(await editor(o, firstId).count(), 0);
        await frames(o);
        assert.equal(posts, 1);
        await o.getByRole('button', { name: 'Refresh saved progress', exact: true }).click();
        await ready(o);
        await studio(o);
        const actual = q.success(await q.current(owner, id)),
          fresh = actual.team.content.drafts.filter((d) => !ids.includes(d.id));
        assert.equal(fresh.length, 1);
        assert.equal(fresh[0].state, 'draft');
        assert.equal(fresh[0].approval, undefined);
        assert.equal(actual.team.content.publications.length, 0);
        assert.equal(posts, 1);
      } finally {
        await o.unroute('**/api/teams');
      }
    },
  );
  assert.deepEqual(pageErrors, []);
  writeFileSync(
    resolve(output, 'template-browser-result.json'),
    JSON.stringify(
      {
        passed: true,
        startedAt,
        completedAt: new Date().toISOString(),
        fixtureId: id,
        scenarios,
        layouts,
        pageErrors,
        limits: [
          'Actual synthetic loopback only after root stable confirmation and explicit user approval',
          'No provider/production/hosted calls or recognized/domain approval',
          'Browser checks create drafts only; exact reviewed publication/pin behavior is separate API evidence',
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, scenarios: scenarios.length, layouts: layouts.length }));
} catch (error) {
  for (const [i, p] of people.entries())
    await p.page
      .screenshot({
        path: resolve(output, 'template-browser-failure-' + i + '.png'),
        fullPage: false,
        animations: 'disabled',
      })
      .catch(() => {});
  writeFileSync(
    resolve(output, 'template-browser-result.json'),
    JSON.stringify(
      {
        passed: false,
        startedAt,
        completedAt: new Date().toISOString(),
        scenarios,
        layouts,
        pageErrors,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await Promise.allSettled(people.map((p) => p.context.close()));
  await browser.close();
}
