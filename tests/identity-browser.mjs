import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {
  identityFixture,
  base,
  headers,
  current,
  action,
  get,
  success,
  record,
  out,
  nonce,
} from './identity-fixture.mjs';

// Deterministic local response-order faults exercise the real application code.
// They do not change production authentication, server code or persisted data.
const f = await identityFixture(),
  { a, b, id, da, db, names, ownA, ownB } = f;
const scenarios = [],
  pageErrors = [],
  contexts = [],
  startedAt = new Date().toISOString();
const browser = await chromium.launch({
  executablePath:
    process.env.ACADEMY_QA_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const directoryRequest = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && !u.search;
};
const selectedRequest = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && u.searchParams.get('id') === id;
};
const personalRequest = (r) => new URL(r.url()).pathname === '/api/academy' && r.method() === 'GET';
const isTeamsPost = (r) => new URL(r.url()).pathname === '/api/teams' && r.method() === 'POST';
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
async function wait(p, label) {
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out: ' + label)), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function frames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function test(name, fn) {
  try {
    await fn();
    scenarios.push({ name, passed: true });
  } catch (error) {
    scenarios.push({ name, passed: false, error: String(error) });
    throw error;
  }
}
async function person(user, path = '/?workspace=' + id + '#teams', setup) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: headers(user),
    }),
    page = await context.newPage();
  contexts.push(context);
  page.on('pageerror', (e) => pageErrors.push(e.message));
  if (setup) await setup(page);
  await page.goto(base + path);
  return page;
}
async function ready(page) {
  await page.locator('[data-save-state="loaded"]').waitFor();
  await frames(page);
}
async function support(page) {
  await page.evaluate(() => {
    location.hash = '#support';
  });
  await page.getByRole('heading', { name: 'Help with your learning', exact: true }).waitFor();
}
async function refresh(page, { directoryStatus = 200, selectedStatus = 200 } = {}) {
  await support(page);
  const read = page.waitForResponse((r) => selectedRequest(r.request()) && r.status() === selectedStatus),
    dir =
      selectedStatus === 200
        ? page.waitForResponse((r) => directoryRequest(r.request()) && r.status() === directoryStatus)
        : null;
  await page.getByRole('button', { name: 'Refresh requests', exact: true }).click();
  await read;
  if (dir) await dir;
  await frames(page);
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
async function draft(page, did) {
  await studio(page);
  if (!(await editor(page, did).count())) {
    if (await page.getByRole('button', { name: 'Back to content studio', exact: true }).count())
      await page.getByRole('button', { name: 'Back to content studio', exact: true }).click();
    await page
      .locator(`[data-content-draft-id="${did}"]`)
      .getByRole('button', { name: 'Open content draft', exact: true })
      .click();
    await editor(page, did).waitFor();
  }
  await editor(page, did)
    .getByRole('navigation', { name: 'Content draft sections', exact: true })
    .getByRole('button', { name: 'Overview', exact: true })
    .click();
  return editor(page, did).getByLabel('Pathway title', { exact: true });
}
async function rendered(page) {
  return page.evaluate(
    () =>
      document.body.innerText +
      '\n' +
      [...document.querySelectorAll('input,textarea')].map((e) => e.value).join('\n'),
  );
}
async function absent(page, canaries) {
  const text = await rendered(page);
  for (const c of canaries) assert.ok(!text.includes(c), 'Former account/private value rendered: ' + c);
}
async function choices(page) {
  const picker = page.getByRole('combobox', { name: 'Choose Academy workspace', exact: true });
  await picker.click();
  const values = await page.getByRole('option').allTextContents();
  await page.keyboard.press('Escape');
  return values;
}
async function switchAccount(page, user) {
  await page.setExtraHTTPHeaders(headers(user));
  await refresh(page);
  await ready(page);
}
async function masked(page, canaries) {
  await page.getByRole('alert').first().waitFor();
  await frames(page);
  await absent(page, canaries);
  assert.equal(await page.locator('[data-content-editor-id]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
  const options = await choices(page);
  assert.equal(options.length, 1);
  assert.match(options[0], /Personal practice lab/);
}

try {
  await test('same-page subject switch clears owner editor scratch and shows canonical own state', async () => {
    const p = await person(a);
    await ready(p);
    const unsentA = 'UNSENT-ACCOUNT-A-' + nonce,
      unsentB = 'UNSENT-ACCOUNT-B-' + nonce;
    await (await draft(p, da.id)).fill(unsentA);
    await switchAccount(p, b);
    await absent(p, [unsentA, names.sharedA]);
    assert.equal(await (await draft(p, da.id)).inputValue(), da.document.title);
    assert.equal(await (await draft(p, da.id)).isDisabled(), true);
    await (await draft(p, db.id)).fill(unsentB);
    await switchAccount(p, a);
    await absent(p, [unsentB]);
    assert.equal(
      await (await draft(p, da.id)).inputValue(),
      da.document.title,
      'Returning after a different account must not revive that prior account scratch.',
    );
    const options = await choices(p);
    assert.ok(options.some((x) => x === ownA.name));
    assert.ok(!options.some((x) => x === ownB.name));
  });
  await test('directory canonical subject mismatch masks the earlier permitted payload before retry', async () => {
    const p = await person(a);
    await ready(p);
    const ownUnsent = 'MISMATCH-UNSENT-A-' + nonce;
    await (await draft(p, da.id)).fill(ownUnsent);
    const bDirectory = success(await get(b));
    let mismatch = true;
    await p.route('**/api/teams*', async (route) => {
      if (mismatch && directoryRequest(route.request())) {
        mismatch = false;
        return route.fulfill({ status: 200, contentType: 'application/json', json: bDirectory });
      }
      return route.continue();
    });
    await refresh(p);
    await p
      .getByRole('alert')
      .first()
      .getByText('Your signed-in account changed. Refresh to open its learning space.', { exact: true })
      .waitFor();
    await masked(p, [ownUnsent, da.document.title, names.sharedA]);
    await p.unroute('**/api/teams*');
    await p.setExtraHTTPHeaders(headers(b));
    await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await ready(p);
    await (await draft(p, db.id)).fill('ONLY-B-AFTER-MISMATCH-' + nonce);
    await absent(p, [ownUnsent]);
    const options = await choices(p);
    assert.ok(options.some((x) => x === ownB.name));
    assert.ok(!options.some((x) => x === ownA.name));
  });
  for (const lateStatus of [200, 403])
    await test(
      'older directory ' + lateStatus + ' cannot change newer subject, scratch or directory',
      async () => {
        const p = await person(a);
        await ready(p);
        await support(p);
        const captured = deferred(),
          release = deferred(),
          delivered = deferred();
        let holding = true;
        await p.route('**/api/teams*', async (route) => {
          if (!holding || !directoryRequest(route.request())) return route.continue();
          holding = false;
          const response = await route.fetch(),
            snapshot = await response.json();
          assert.equal(snapshot.user.id, a.id);
          captured.resolve();
          await release.promise;
          if (lateStatus === 200) await route.fulfill({ response, json: snapshot });
          else
            await route.fulfill({
              status: lateStatus,
              contentType: 'application/json',
              json: { error: 'Synthetic earlier directory authority expired.' },
            });
          delivered.resolve();
        });
        try {
          await p.getByRole('button', { name: 'Refresh requests', exact: true }).click();
          await wait(captured.promise, 'earlier directory captured');
          await switchAccount(p, b);
          const unsentB = 'NEWER-B-SCRATCH-' + lateStatus + '-' + nonce;
          await (await draft(p, db.id)).fill(unsentB);
          release.resolve();
          await wait(delivered.promise, 'late directory delivered');
          await frames(p);
          assert.equal(
            await editor(p, db.id).getByLabel('Pathway title', { exact: true }).inputValue(),
            unsentB,
          );
          assert.equal(await p.getByRole('alert').count(), 0);
          await ready(p);
          const options = await choices(p);
          assert.ok(options.some((x) => x === ownB.name));
          assert.ok(!options.some((x) => x === ownA.name));
          await absent(p, [names.sharedA]);
        } finally {
          release.resolve();
          await p.unroute('**/api/teams*');
        }
      },
    );
  await test('same-account denied read hides retained scratch until a current owner read succeeds', async () => {
    const p = await person(a);
    await ready(p);
    const unsent = 'SAME-ACCOUNT-OWN-UNSENT-' + nonce;
    await (await draft(p, da.id)).fill(unsent);
    let deny = true;
    await p.route('**/api/teams*', async (route) => {
      if (deny && selectedRequest(route.request())) {
        deny = false;
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          json: { error: 'Synthetic current shared read denied.' },
        });
      }
      return route.continue();
    });
    await refresh(p, { selectedStatus: 403 });
    await masked(p, [unsent, da.document.title, names.sharedA]);
    await p.evaluate(() => {
      location.hash = '#teams';
    });
    await frames(p);
    assert.equal(await p.getByRole('tab', { name: 'Content studio', exact: true }).count(), 0);
    await absent(p, [unsent, da.document.title]);
    await p.unroute('**/api/teams*');
    success(
      await action(b, id, { type: 'member', userId: a.id, roles: ['learner'], scopes: [], active: true }),
    );
    await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await ready(p);
    assert.equal(await p.getByRole('tab', { name: 'Content studio', exact: true }).count(), 0);
    await absent(p, [unsent, da.document.title]);
    success(
      await action(b, id, {
        type: 'member',
        userId: a.id,
        roles: ['admin', 'learner'],
        scopes: [],
        active: true,
      }),
    );
    await refresh(p);
    await ready(p);
    assert.equal(await (await draft(p, da.id)).inputValue(), unsent);
    assert.equal(await (await draft(p, da.id)).isDisabled(), false);
    assert.equal(
      success(await current(a, id)).team.content.drafts.find((d) => d.id === da.id).document.title,
      da.document.title,
      'Unsent restoration must not persist itself.',
    );
  });
  for (const status of [401, 403, 404])
    await test(
      'personal ' + status + ' read remount clears cached preference input and old directory',
      async () => {
        let directoryFault = true;
        const p = await person(a, '/#settings', async (page) => {
          await page.route('**/api/teams*', (route) => {
            if (directoryFault && directoryRequest(route.request())) {
              directoryFault = false;
              return route.fulfill({
                status: 503,
                contentType: 'application/json',
                json: { error: 'Synthetic retry trigger after an authorized personal read.' },
              });
            }
            return route.continue();
          });
        });
        const input = p.getByLabel('Display name', { exact: true });
        await input.waitFor();
        assert.equal(await input.inputValue(), names.a);
        const unsent = 'PERSONAL-CACHED-UNSENT-' + status + '-' + nonce;
        await input.fill(unsent);
        let denied = true;
        await p.route('**/api/academy*', (route) => {
          if (denied && personalRequest(route.request())) {
            denied = false;
            return route.fulfill({
              status,
              contentType: 'application/json',
              json: { error: 'Synthetic denied personal read ' + status },
            });
          }
          return route.continue();
        });
        const read = p.waitForResponse((r) => personalRequest(r.request()) && r.status() === status);
        await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
        await read;
        await frames(p);
        assert.equal(await p.getByLabel('Display name', { exact: true }).inputValue(), 'Learner');
        await masked(p, [names.a, unsent, da.document.title]);
        await p.unroute('**/api/academy*');
        await p.unroute('**/api/teams*');
        await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
        await p.locator('[data-save-state="loaded"]').waitFor();
        await p.evaluate(() => {
          location.hash = '#home';
        });
        await frames(p);
        await p.evaluate(() => {
          location.hash = '#settings';
        });
        assert.equal(await p.getByLabel('Display name', { exact: true }).inputValue(), names.a);
        assert.equal(success(await current(a, id)).team.currentUserId, a.id);
      },
    );
  await test('acknowledged shared POST remains saved when directory refresh is denied; retry sends only reads', async () => {
    const p = await person(a);
    await ready(p);
    await p.getByRole('tab', { name: 'Invitations', exact: true }).click();
    const email = 'fictional-ack-' + nonce + '@academy.test';
    await p.getByLabel('Sign-in account email', { exact: true }).fill(email);
    let posts = 0,
      capturedBody;
    p.on('request', (r) => {
      if (isTeamsPost(r)) {
        posts++;
        capturedBody = r.postDataJSON();
      }
    });
    let deny = true;
    await p.route('**/api/teams*', (route) => {
      if (deny && directoryRequest(route.request())) {
        deny = false;
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          json: { error: 'Synthetic directory denial after acknowledged save.' },
        });
      }
      return route.continue();
    });
    const written = p.waitForResponse((r) => isTeamsPost(r.request()) && r.status() === 200);
    await p.getByRole('button', { name: 'Create invitation link', exact: true }).click();
    const saved = await (await written).json();
    assert.equal(saved.team.currentUserId, a.id);
    await p
      .getByText('Invitation created. Nothing sent. · Refresh access before continuing', { exact: true })
      .waitFor();
    await masked(p, [da.document.title]);
    assert.equal(posts, 1);
    assert.equal(success(await current(a, id)).team.invites.filter((i) => i.email === email).length, 1);
    await p.unroute('**/api/teams*');
    await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await ready(p);
    await p.getByRole('tab', { name: 'Invitations', exact: true }).click();
    assert.equal(await p.getByLabel('Sign-in account email', { exact: true }).inputValue(), '');
    assert.ok(
      (await p.getByLabel('New invitation link', { exact: true }).inputValue()).includes('/join?token='),
    );
    assert.equal(posts, 1);
    assert.equal(capturedBody.command.type, 'invite');
    assert.equal(success(await current(a, id)).team.invites.filter((i) => i.email === email).length, 1);
  });
  assert.deepEqual(pageErrors, []);
  const result = {
    passed: true,
    startedAt,
    completedAt: new Date().toISOString(),
    fixtureId: id,
    scenarios,
    pageErrors,
    limits: [
      'Loopback synthetic identities and deterministic intercepted GET ordering/status faults only',
      'The browser really uses the application identity guards, hook scratch and API writes',
      'No real sign-in, external invitation delivery, notification or production request is exercised',
      'No React internal state inspection; assertions cover rendered controls, authorized API state and request counts',
    ],
  };
  record('identity-browser-result.json', result);
  console.log(JSON.stringify(result));
} catch (error) {
  for (const [i, c] of contexts.entries())
    for (const p of c.pages())
      await p
        .screenshot({ path: resolve(out, 'identity-failure-' + i + '.png'), fullPage: false })
        .catch(() => {});
  record('identity-browser-result.json', {
    passed: false,
    startedAt,
    completedAt: new Date().toISOString(),
    fixtureId: id,
    scenarios,
    pageErrors,
    error: String(error),
  });
  throw error;
} finally {
  await browser.close();
}
