import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const app = resolve(process.env.ACADEMY_APP_PATH ?? process.cwd());
const out = resolve(
  process.env.ACADEMY_HTTP_DENIAL_QA_OUT ?? resolve(app, '.sites-runtime/eight-hour/nonjson-read-evidence'),
);
mkdirSync(out, { recursive: true });
process.env.ACADEMY_APP_PATH = app;
const { identityFixture, base, headers } = await import(pathToFileURL(app + '/tests/identity-fixture.mjs'));
const { chromium, browserOptions } = await import(
  pathToFileURL(app + '/tests/scoped-workbench-qa/browser-runtime.mjs')
);
process.env.ACADEMY_IDENTITY_QA_OUT = out + '/fixture';
if (!process.env.ACADEMY_QA_WORKER) throw new Error('A parent-confirmed stable Worker is required.');
const f = await identityFixture(),
  browser = await chromium.launch(browserOptions),
  cases = [],
  errors = [];
const target = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && u.searchParams.get('id') === f.id;
};
const directory = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && !u.search;
};
const settled = (p) =>
  p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  for (const kind of ['primary', 'directory'])
    for (const status of [401, 403, 404, 503]) {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          extraHTTPHeaders: headers(f.a),
        }),
        p = await context.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + '/?workspace=' + f.id + '#operations');
      await p.locator('[data-save-state="loaded"]').waitFor();
      await p.locator('[data-operations-workspace]').waitFor();
      assert.equal(await p.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 1);
      assert.equal(await p.locator(`[data-operations-cohort-id="${f.cid}"]`).count(), 1);
      let intercepted = 0;
      await p.route('**/api/teams*', async (route) => {
        if ((kind === 'primary' ? target : directory)(route.request())) {
          intercepted++;
          return route.fulfill(
            status === 503
              ? {
                  status,
                  contentType: 'application/json',
                  json: { error: 'Synthetic temporary service unavailable.' },
                }
              : {
                  status,
                  contentType: status === 403 ? 'text/html' : 'text/plain',
                  body:
                    status === 403
                      ? '<html><body>Access denied</body></html>'
                      : 'Synthetic access unavailable.',
                },
          );
        }
        return route.continue();
      });
      const denied = p.waitForResponse(
        (r) => (kind === 'primary' ? target : directory)(r.request()) && r.status() === status,
      );
      await p.getByRole('button', { name: 'Refresh work', exact: true }).click();
      await denied;
      await p.getByRole('alert').first().waitFor();
      await settled(p);
      const alerts = await p.getByRole('alert').allTextContents(),
        ownerNavigationPresent =
          (await p.getByRole('button', { name: 'Workspace operations', exact: true }).count()) > 0,
        privateMetadataVisible = (await p.locator(`[data-operations-cohort-id="${f.cid}"]`).count()) > 0;
      await p.evaluate(() => (location.hash = '#teams'));
      await settled(p);
      let privateDraftAvailable = false,
        privateDraftTitle = null;
      const tab = p.getByRole('tab', { name: 'Content studio', exact: true });
      if (ownerNavigationPresent) await tab.waitFor();
      if (await tab.count()) {
        await tab.click();
        const card = p.locator(`[data-content-draft-id="${f.da.id}"]`);
        await card.waitFor();
        await card.getByRole('button', { name: 'Open content draft', exact: true }).click();
        const title = p
          .locator(`[data-content-editor-id="${f.da.id}"]`)
          .getByLabel('Pathway title', { exact: true });
        await title.waitFor();
        privateDraftTitle = await title.inputValue();
        privateDraftAvailable = privateDraftTitle === f.da.document.title;
      }
      const expectedMask = status !== 503,
        authorityCleared = !ownerNavigationPresent && !privateMetadataVisible && !privateDraftAvailable,
        safeError = alerts.every((s) => !/(SyntaxError|Unexpected token|not valid JSON)/i.test(s));
      cases.push({
        kind,
        status,
        bodyFormat: status === 503 ? 'JSON' : status === 403 ? 'HTML' : 'plain text',
        intercepted,
        alerts,
        ownerNavigationPresent,
        privateMetadataVisible,
        privateDraftAvailable,
        authorityCleared,
        safeError,
        expectedMask,
        passed:
          safeError && (expectedMask ? authorityCleared : ownerNavigationPresent && privateDraftAvailable),
      });
      await p.screenshot({
        path: resolve(out, `nonjson-${kind}-${status}.png`),
        fullPage: false,
        animations: 'disabled',
      });
      await context.close();
    }
  for (const status of [401, 403, 404, 503]) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: headers(f.a),
      }),
      p = await context.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    let initialDirectoryFault = true;
    await p.route('**/api/teams*', (route) => {
      if (initialDirectoryFault && directory(route.request())) {
        initialDirectoryFault = false;
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          json: { error: 'Synthetic personal retry trigger.' },
        });
      }
      return route.continue();
    });
    await p.goto(base + '/#settings');
    const input = p.getByLabel('Display name', { exact: true });
    await input.waitFor();
    await p.getByRole('button', { name: 'Retry connection', exact: true }).waitFor();
    assert.equal(await input.inputValue(), f.names.a);
    const unsent = 'NONJSON-PERSONAL-UNSENT-' + status;
    await input.fill(unsent);
    let intercepted = 0;
    await p.route('**/api/academy*', (route) => {
      if (route.request().method() === 'GET') {
        intercepted++;
        return route.fulfill(
          status === 503
            ? {
                status,
                contentType: 'application/json',
                json: { error: 'Synthetic personal temporary service unavailable.' },
              }
            : {
                status,
                contentType: status === 403 ? 'text/html' : 'text/plain',
                body:
                  status === 403
                    ? '<html><body>Access denied</body></html>'
                    : 'Synthetic personal access unavailable.',
              },
        );
      }
      return route.continue();
    });
    const response = p.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/academy' &&
        r.request().method() === 'GET' &&
        r.status() === status,
    );
    await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await response;
    await settled(p);
    const actualName = await p.getByLabel('Display name', { exact: true }).inputValue(),
      alerts = await p.getByRole('alert').allTextContents(),
      expectedMask = status !== 503,
      authorityCleared = actualName === 'Learner',
      safeError = alerts.every((s) => !/(SyntaxError|Unexpected token|not valid JSON)/i.test(s));
    cases.push({
      kind: 'personal-primary',
      status,
      bodyFormat: status === 503 ? 'JSON' : status === 403 ? 'HTML' : 'plain text',
      intercepted,
      alerts,
      privateUnsentVisible: actualName === unsent,
      authorityCleared,
      safeError,
      expectedMask,
      passed: safeError && (expectedMask ? authorityCleared : actualName === unsent),
    });
    await p.screenshot({
      path: resolve(out, `nonjson-personal-${status}.png`),
      fullPage: false,
      animations: 'disabled',
    });
    await context.close();
  }
} finally {
  await browser.close();
}
const result = {
  at: new Date().toISOString(),
  worker: process.env.ACADEMY_QA_WORKER ?? '60889',
  passed: cases.every((c) => c.passed),
  cases,
  pageErrors: errors,
  limits: [
    'Deterministic intercepted GET faults only; all fixture writes use fictional local identities.',
    'No protected React internals inspected; only rendered owner navigation, metadata and canonical private editor input.',
    '503 control keeps the existing authorized cache by design.',
    'No hosted calls or uncertain POST retry.',
  ],
};
writeFileSync(resolve(out, 'nonjson-read-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (process.env.ACADEMY_QA_ALLOW_BASELINE !== '1')
  assert.equal(result.passed, true, 'Every non-JSON denied read must clear prior private authority.');
