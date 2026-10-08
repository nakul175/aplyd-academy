import { out, runtimeModuleHref } from './qa-paths.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, browserOptions } from './browser-runtime.mjs';
import { base, headers, action, success } from '../local-qa.mjs';
const f = JSON.parse(readFileSync(new URL('operations-fixture.json', out), 'utf8'));
const { id, fac, owner, cid, otherCid, attempts, supports } = f;
const browser = await chromium.launch(browserOptions),
  cases = [];
async function restore() {
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
    await action(owner, id, { type: 'assign', kind: 'assessment', targetId: attempts.b, staffId: fac.id }),
  );
  const x = await action(fac, id, { type: 'support-claim', requestId: supports.facHandled });
  assert.ok([200, 409].includes(x.status), 'Synthetic handler is already owned or legitimately reclaimed');
}
async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
try {
  for (const kind of ['same-role-scope', 'denied-refresh', 'workspace-switch']) {
    await restore();
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: headers(fac),
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/?workspace=' + id + '#operations');
    await page.locator('[data-save-state="loaded"]').waitFor();
    await page.locator('[data-operations-workspace]').waitFor();
    let hold = true,
      deny = false,
      capturedResolve,
      releaseResolve;
    const captured = new Promise((resolve) => (capturedResolve = resolve)),
      release = new Promise((resolve) => (releaseResolve = resolve));
    let oldResponse;
    await page.route('**/api/teams?*', async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (r.method() !== 'GET' || u.searchParams.get('id') !== id) {
        await route.continue();
        return;
      }
      if (hold) {
        hold = false;
        oldResponse = await route.fetch();
        capturedResolve();
        await release;
        await route.fulfill({ response: oldResponse });
        return;
      }
      if (deny) {
        deny = false;
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Synthetic current workspace read no longer permitted.' }),
        });
        return;
      }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Refresh work', exact: true }).click();
    await captured;
    if (kind === 'workspace-switch') {
      await page.getByRole('combobox', { name: 'Choose Academy workspace', exact: true }).click();
      await page.getByRole('option', { name: 'Personal practice lab', exact: true }).click();
      await page.locator('[data-save-state="loaded"]').waitFor();
      releaseResolve();
      await settle(page);
      await page.waitForTimeout(80);
      assert.equal(await page.locator('[data-operations-workspace]').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
      assert.ok(!(await page.locator('main').innerText()).includes('Local customer practice circle'));
      assert.equal(new URL(page.url()).searchParams.get('workspace'), null);
    } else {
      if (kind === 'same-role-scope')
        success(
          await action(owner, id, {
            type: 'member',
            userId: fac.id,
            roles: ['facilitator', 'assessor', 'reviewer'],
            scopes: [otherCid],
            active: true,
          }),
        );
      else deny = true;
      await page.evaluate(() => {
        location.hash = '#support';
      });
      await page.getByRole('button', { name: 'Refresh requests', exact: true }).waitFor();
      const response = page.waitForResponse(
        (r) => r.request().method() === 'GET' && r.url().includes('/api/teams?id=' + id),
      );
      await page.getByRole('button', { name: 'Refresh requests', exact: true }).click();
      await response;
      await settle(page);
      if (kind === 'denied-refresh')
        await page.getByRole('button', { name: 'Retry connection', exact: true }).waitFor();
      await page.evaluate(() => {
        location.hash = '#operations';
      });
      await settle(page);
      releaseResolve();
      await page.waitForTimeout(80);
      await settle(page);
      if (kind === 'same-role-scope') {
        await page.locator('[data-operations-workspace]').waitFor();
        assert.deepEqual(
          await page
            .locator('[data-operations-cohort-id]')
            .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-operations-cohort-id'))),
          [otherCid],
        );
        assert.equal(await page.locator(`[data-operations-review-id="${attempts.b}"]`).count(), 0);
        assert.equal(await page.locator(`[data-operations-support-id="${supports.facHandled}"]`).count(), 0);
      } else {
        assert.equal(await page.locator('[data-operations-workspace]').count(), 0);
        assert.equal(
          await page.getByRole('button', { name: 'Workspace operations', exact: true }).count(),
          0,
        );
        await page
          .getByRole('heading', { name: 'Workspace operations are unavailable', exact: true })
          .waitFor();
      }
    }
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: new URL(`operations-race-${kind}.png`, out).pathname,
      fullPage: true,
      animations: 'disabled',
    });
    cases.push({ kind, passed: true, errors });
    await context.close();
  }
  await restore();
  writeFileSync(
    new URL('operations-client-races-result.json', out),
    JSON.stringify({ passed: true, at: new Date().toISOString(), workspace: id, cases }, null, 2),
  );
  console.log('Three real delayed-authorized-read operations races passed.');
} catch (e) {
  writeFileSync(
    new URL('operations-client-races-result.json', out),
    JSON.stringify(
      { passed: false, at: new Date().toISOString(), workspace: id, cases, error: String(e) },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await restore().catch(() => {});
  await browser.close();
}
