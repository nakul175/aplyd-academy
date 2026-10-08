import { out, runtimeModuleHref } from './qa-paths.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, browserOptions } from './browser-runtime.mjs';
import { base, headers, action, current, success, post } from '../local-qa.mjs';
const { deriveWorkspaceOperations } = await import(runtimeModuleHref);
const f = JSON.parse(readFileSync(new URL('operations-fixture.json', out), 'utf8'));
const {
  owner,
  a,
  fac,
  backup,
  id,
  cid,
  otherCid,
  attempts,
  appealId,
  supports,
  sessions,
  content,
  canaries,
} = f;
const browser = await chromium.launch(browserOptions);
const errors = [],
  scenarios = [],
  layouts = [],
  browserWrites = [];
const attr = (page, kind, item) => page.locator(`[data-${kind}-id="${item}"]`),
  ops = (page) => page.locator('[data-operations-workspace]');
async function scenario(name, fn) {
  try {
    await fn();
    scenarios.push({ name, passed: true });
  } catch (e) {
    scenarios.push({ name, passed: false, error: String(e) });
    throw e;
  }
}
async function settled(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function person(u) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: headers(u),
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.url().includes('/api/'))
      browserWrites.push({ method: r.method(), path: new URL(r.url()).pathname });
  });
  await page.goto(base + '/?workspace=' + id + '#operations');
  await page.locator('[data-save-state="loaded"]').waitFor();
  return { context, page };
}
async function operations(page) {
  await page.evaluate(() => {
    location.hash = '#operations';
  });
  await ops(page).waitFor();
  await settled(page);
}
async function press(button) {
  await button.focus();
  await button.press('Enter');
}
async function selectedTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.waitFor();
  assert.equal(await tab.getAttribute('aria-selected'), 'true', name + ' is selected');
}
async function rowIds(page, kind) {
  return (
    await page
      .locator('[data-operations-' + kind + '-id]')
      .evaluateAll((rows, attr) => rows.map((r) => r.getAttribute(attr)), 'data-operations-' + kind + '-id')
  ).sort();
}
async function assertRows(page, u) {
  const x = success(await current(u, id)),
    m = deriveWorkspaceOperations(x.team, new Date().toISOString());
  assert.ok(m);
  assert.equal(await ops(page).getAttribute('data-operations-workspace'), id);
  for (const [kind, rows] of [
    ['cohort', m.cohorts],
    ['review', m.reviews.items],
    ['support', m.support.items],
    ['session', m.sessions.items],
    ['content', m.content.items],
  ])
    assert.deepEqual(
      await rowIds(page, kind),
      rows.map((r) => r.id).sort(),
      kind + ' rows match current scope',
    );
  const text = await ops(page).innerText();
  for (const value of Object.values(canaries))
    assert.ok(!text.includes(value), 'Protected body omitted from operations DOM');
  for (const row of m.cohorts) {
    const dl = attr(page, 'operations-cohort', row.id).locator('dl');
    for (const [label, value] of [
      ['Learning', row.learning],
      ['Review pending', row.reviewPending],
      ['Appeal pending', row.appealPending],
      ['Practice records', row.practiceCompleted],
      ['Withdrawn', row.withdrawn],
    ])
      assert.equal(
        await dl
          .locator('div')
          .filter({ has: page.locator('dt', { hasText: new RegExp('^' + label + '$') }) })
          .locator('dd')
          .innerText(),
        String(value),
      );
  }
  return m;
}
async function refresh(page) {
  const response = page.waitForResponse(
    (r) => r.request().method() === 'GET' && r.url().includes('/api/teams?id=' + id),
  );
  await press(page.getByRole('button', { name: 'Refresh work', exact: true }));
  await response;
  await page.locator('[data-save-state="loaded"]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-operations-workspace] button')?.disabled);
  await settled(page);
}
const { context: oc, page: o } = await person(owner),
  { context: fc, page: p } = await person(fac),
  { context: lc, page: l } = await person(a);
try {
  await scenario(
    'Operations are a current-owner or scoped-facilitator view; learner Overview remains separate',
    async () => {
      await assertRows(o, owner);
      await assertRows(p, fac);
      assert.equal(await ops(l).count(), 0);
      await l.getByRole('heading', { name: 'Workspace operations are unavailable', exact: true }).waitFor();
      assert.equal(await l.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
      await l.evaluate(() => {
        location.hash = '#home';
      });
      await l.getByRole('heading', { name: 'Good to see you, ' + a.name + '.', exact: true }).waitFor();
    },
  );
  await scenario(
    'Actual active practice record and timely open appeal both appear without suspending or rewriting record',
    async () => {
      const row = attr(o, 'operations-cohort', cid);
      assert.ok((await row.innerText()).includes('Appeal pending'));
      const x = success(await current(a, id)),
        e = x.state.enrollments.find((e) => e.id === f.enrollments.a);
      assert.deepEqual(e.record, f.recordBefore);
      assert.deepEqual(e.attempts[0].decision, f.decisionBefore);
      assert.equal(e.appeals.at(-1).status, 'open');
      assert.ok((await ops(o).innerText()).includes('counts can overlap'));
    },
  );
  await scenario(
    'Keyboard cohort and progress destinations open their exact Teams section and cohort',
    async () => {
      await press(
        attr(o, 'operations-cohort', cid).getByRole('button', { name: 'Open cohort', exact: true }),
      );
      await selectedTab(o, 'Cohorts');
      await attr(o, 'cohort', cid).waitFor();
      await o.waitForFunction(
        (id) => document.activeElement?.closest('[data-cohort-id]')?.getAttribute('data-cohort-id') === id,
        cid,
        { timeout: 1500 },
      );
      assert.equal(
        await o.evaluate(() =>
          document.activeElement?.closest('[data-cohort-id]')?.getAttribute('data-cohort-id'),
        ),
        cid,
      );
      await operations(o);
      await press(o.getByRole('button', { name: 'Open progress summaries', exact: true }));
      await selectedTab(o, 'Progress');
      await o.getByRole('columnheader', { name: 'Learner', exact: true }).waitFor();
    },
  );
  await scenario(
    'Keyboard owner assignment row opens matching unassigned work and exact Review assignments tab',
    async () => {
      await operations(o);
      await press(
        attr(o, 'operations-review', attempts.c).getByRole('button', {
          name: 'Arrange assignment',
          exact: true,
        }),
      );
      await selectedTab(o, 'Review assignments');
      await attr(o, 'assignment', attempts.c).waitFor();
      assert.ok((await attr(o, 'assignment', attempts.c).innerText()).includes('No eligible staff account'));
    },
  );
  await scenario(
    'Owner and facilitator assigned-review routes select correct protected work, then operations omits it',
    async () => {
      await operations(o);
      await press(
        attr(o, 'operations-review', appealId).getByRole('button', { name: 'Open my review', exact: true }),
      );
      await o.getByRole('heading', { name: 'Give feedback you can stand behind.', exact: true }).waitFor();
      assert.ok((await o.locator('main').innerText()).includes(canaries.evidenceA));
      assert.ok((await o.locator('.review-queue button.active').innerText()).includes(a.name));
      await operations(o);
      await assertRows(o, owner);
      await press(
        attr(p, 'operations-review', attempts.b).getByRole('button', { name: 'Open my review', exact: true }),
      );
      await p.getByRole('heading', { name: 'Give feedback you can stand behind.', exact: true }).waitFor();
      assert.ok((await p.locator('main').innerText()).includes(canaries.evidenceB));
      await operations(p);
      await assertRows(p, fac);
    },
  );
  await scenario(
    'Support metadata routes to handled thread for current handler and queue for other request',
    async () => {
      await operations(o);
      await press(
        attr(o, 'operations-support', supports.reopened).getByRole('button', {
          name: 'Open support queue',
          exact: true,
        }),
      );
      await selectedTab(o, 'My handled requests');
      await attr(o, 'support-thread', supports.reopened).waitFor();
      assert.ok(
        (await attr(o, 'support-thread', supports.reopened).innerText()).includes(canaries.supportReply),
      );
      await operations(o);
      await press(
        attr(o, 'operations-support', supports.otherScope).getByRole('button', {
          name: 'Open support queue',
          exact: true,
        }),
      );
      await selectedTab(o, 'Staff queue');
      await attr(o, 'support-request', supports.otherScope).waitFor();
      assert.equal(await attr(o, 'support-thread', supports.otherScope).count(), 0);
      await operations(o);
      await assertRows(o, owner);
    },
  );
  await scenario(
    'Content row selects actual independent-review section and publication row selects preserved version card',
    async () => {
      await press(
        attr(o, 'operations-content', content.inReview.draftId).getByRole('button', {
          name: 'Open content studio',
          exact: true,
        }),
      );
      await selectedTab(o, 'Content studio');
      await attr(o, 'content-editor', content.inReview.draftId).waitFor();
      await o.getByRole('heading', { name: 'Independent review and publication', exact: true }).waitFor();
      await operations(o);
      await press(
        attr(o, 'operations-content', content.publication.publicationId).getByRole('button', {
          name: 'Open content studio',
          exact: true,
        }),
      );
      await selectedTab(o, 'Content studio');
      await attr(o, 'content-publication', content.publication.publicationId).waitFor();
      await o.waitForFunction(
        (id) =>
          document.activeElement
            ?.closest('[data-content-publication-id]')
            ?.getAttribute('data-content-publication-id') === id,
        content.publication.publicationId,
        { timeout: 1500 },
      );
      assert.equal(
        await o.evaluate(() =>
          document.activeElement
            ?.closest('[data-content-publication-id]')
            ?.getAttribute('data-content-publication-id'),
        ),
        content.publication.publicationId,
      );
      await operations(o);
    },
  );
  await scenario('Practice session row opens Sessions tab and focuses the actual session card', async () => {
    await press(
      attr(o, 'operations-session', sessions.ownerHosted).getByRole('button', {
        name: 'Open practice sessions',
        exact: true,
      }),
    );
    await selectedTab(o, 'Practice sessions');
    await attr(o, 'session', sessions.ownerHosted).waitFor();
    await o.waitForFunction(
      (id) => document.activeElement?.closest('[data-session-id]')?.getAttribute('data-session-id') === id,
      sessions.ownerHosted,
      { timeout: 1500 },
    );
    assert.equal(
      await o.evaluate(() =>
        document.activeElement?.closest('[data-session-id]')?.getAttribute('data-session-id'),
      ),
      sessions.ownerHosted,
    );
    await operations(o);
  });
  await scenario(
    'Manual and visible-view refresh make no writes; fresh same-role scope removes old operational rows',
    async () => {
      await refresh(p);
      success(
        await action(owner, id, {
          type: 'member',
          userId: fac.id,
          roles: ['facilitator', 'assessor', 'reviewer'],
          scopes: [otherCid],
          active: true,
        }),
      );
      await refresh(p);
      await assertRows(p, fac);
      assert.deepEqual(await rowIds(p, 'cohort'), [otherCid]);
      assert.equal(await attr(p, 'operations-review', attempts.b).count(), 0);
      assert.equal(await attr(p, 'operations-support', supports.facHandled).count(), 0);
      assert.equal(await attr(p, 'operations-session', sessions.facHosted).count(), 0);
      assert.ok(!(await ops(p).innerText()).includes('Local customer practice circle'));
      success(
        await action(owner, id, {
          type: 'member',
          userId: fac.id,
          roles: ['facilitator', 'assessor', 'reviewer'],
          scopes: [cid],
          active: true,
        }),
      );
      success(
        await action(owner, id, {
          type: 'assign',
          kind: 'assessment',
          targetId: attempts.b,
          staffId: fac.id,
        }),
      );
      success(await action(fac, id, { type: 'support-claim', requestId: supports.facHandled }));
      await refresh(p);
      await assertRows(p, fac);
    },
  );
  await scenario(
    'Removed facilitator refresh hides entire operational projection and navigation; restoration uses current scope',
    async () => {
      success(
        await action(owner, id, {
          type: 'member',
          userId: fac.id,
          roles: ['facilitator', 'assessor', 'reviewer'],
          scopes: [cid],
          active: false,
        }),
      );
      await refresh(p);
      await p.getByRole('heading', { name: 'Workspace operations are unavailable', exact: true }).waitFor();
      assert.equal(await ops(p).count(), 0);
      assert.equal(await p.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
      for (const value of Object.values(canaries))
        assert.ok(!(await p.locator('main').innerText()).includes(value));
      success(
        await action(owner, id, {
          type: 'member',
          userId: fac.id,
          roles: ['facilitator', 'assessor', 'reviewer'],
          scopes: [cid],
          active: true,
        }),
      );
      success(
        await action(owner, id, {
          type: 'assign',
          kind: 'assessment',
          targetId: attempts.b,
          staffId: fac.id,
        }),
      );
      success(await action(fac, id, { type: 'support-claim', requestId: supports.facHandled }));
      await press(p.getByRole('button', { name: 'Refresh workspace', exact: true }));
      await ops(p).waitFor();
      await assertRows(p, fac);
    },
  );
  await scenario(
    'All major collection routes work with keyboard activation and current eligibility',
    async () => {
      for (const [label, view, tab] of [
        ['Open review assignments', 'teams', 'Review assignments'],
        ['Open support', 'support', 'Staff queue'],
        ['Open sessions', 'network', 'Practice sessions'],
      ]) {
        await operations(o);
        await press(o.getByRole('button', { name: label, exact: true }));
        await selectedTab(o, tab);
        assert.equal(new URL(o.url()).hash, '#' + view);
      }
      await operations(p);
      await press(p.getByRole('button', { name: 'Open review studio', exact: true }));
      await p.getByRole('heading', { name: 'Give feedback you can stand behind.', exact: true }).waitFor();
      await operations(p);
    },
  );
  await scenario(
    'Dedicated operation target clears across workspace change and personal lab cannot retain private operational rows',
    async () => {
      await operations(o);
      await o.getByRole('combobox', { name: 'Choose Academy workspace', exact: true }).click();
      await o.getByRole('option', { name: 'Personal practice lab', exact: true }).click();
      await o.locator('[data-save-state="loaded"]').waitFor();
      assert.equal(await ops(o).count(), 0);
      assert.equal(await o.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
      await o.goto(base + '/?workspace=' + id + '#operations');
      await o.reload();
      await o.locator('[data-save-state="loaded"]').waitFor();
      await assertRows(o, owner);
    },
  );
  for (const [audience, page, u] of [
    ['owner', o, owner],
    ['facilitator', p, fac],
  ])
    for (const width of [1440, 768, 390])
      for (const text200 of [false, true]) {
        await page.setViewportSize({ width, height: 1000 });
        await operations(page);
        await page.evaluate((large) => {
          document.documentElement.style.fontSize = large ? '32px' : '';
          document.body.style.fontSize = large ? '32px' : '';
        }, text200);
        await settled(page);
        await assertRows(page, u);
        const measured = await page.evaluate(() => ({
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
          rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
          heading: [...document.querySelectorAll('h1')].map((e) => ({
            text: e.textContent,
            width: e.getBoundingClientRect().width,
          })),
          buttons: [...document.querySelector('[data-operations-workspace]').querySelectorAll('button')].map(
            (e) => {
              const r = e.getBoundingClientRect();
              return { label: e.textContent, left: r.left, right: r.right, width: r.width, height: r.height };
            },
          ),
        }));
        assert.ok(
          measured.documentWidth <= width + 1,
          'Page has no horizontal overflow at ' + width + ' ' + text200,
        );
        if (text200) assert.equal(measured.bodyFont, 32, 'True body text size 200%');
        assert.ok(
          measured.buttons.every((b) => b.left >= -1 && b.right <= width + 1 && b.height >= 32),
          'Operations controls stay within viewport and usable',
        );
        await refresh(page);
        await ops(page).waitFor();
        await settled(page);
        await page.screenshot({
          path: new URL(`operations-${audience}-${width}-${text200 ? 'text200' : 'normal'}.png`, out)
            .pathname,
          fullPage: true,
          animations: 'disabled',
        });
        layouts.push({ audience, width, text200, passed: true, measured });
      }
  assert.deepEqual(browserWrites, [], 'All browser dashboard refresh/navigation activity is read-only');
  assert.deepEqual(errors, [], 'No page errors');
  writeFileSync(
    new URL('operations-browser-result.json', out),
    JSON.stringify(
      {
        passed: true,
        workspace: id,
        at: new Date().toISOString(),
        scenarios,
        layouts,
        errors,
        browserWrites,
      },
      null,
      2,
    ),
  );
  console.log(`Operations browser passed ${scenarios.length} scenarios and ${layouts.length} layouts.`);
} catch (e) {
  writeFileSync(
    new URL('operations-browser-result.json', out),
    JSON.stringify(
      {
        passed: false,
        workspace: id,
        at: new Date().toISOString(),
        scenarios,
        layouts,
        errors,
        browserWrites,
        error: String(e),
      },
      null,
      2,
    ),
  );
  await o.screenshot({
    path: new URL('operations-owner-failure.png', out).pathname,
    fullPage: true,
    animations: 'disabled',
  });
  await p.screenshot({
    path: new URL('operations-facilitator-failure.png', out).pathname,
    fullPage: true,
    animations: 'disabled',
  });
  throw e;
} finally {
  await browser.close();
}
