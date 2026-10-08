import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const app = resolve(process.env.ACADEMY_APP_PATH ?? new URL('../../', import.meta.url).pathname);
process.env.ACADEMY_APP_PATH = app;
const out = resolve(process.env.ACADEMY_HTTP_DENIAL_QA_OUT ?? app + '/.sites-runtime/http-denial-qa');
mkdirSync(out, { recursive: true });
const { identityFixture, base, headers, current, success } = await import(
  pathToFileURL(app + '/tests/identity-fixture.mjs')
);
const { chromium, browserOptions } = await import(
  pathToFileURL(app + '/tests/scoped-workbench-qa/browser-runtime.mjs')
);
const f = await identityFixture(),
  browser = await chromium.launch(browserOptions),
  cases = [],
  errors = [];
const selected = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && u.searchParams.get('id') === f.id;
};
const directory = (r) => {
  const u = new URL(r.url());
  return r.method() === 'GET' && u.pathname === '/api/teams' && !u.search;
};
const post = (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/teams';
const frames = (p) =>
  p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
async function person(view = 'operations') {
  const c = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: headers(f.a),
    }),
    p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '/?workspace=' + f.id + '#' + view);
  await p.locator('[data-save-state="loaded"]').waitFor();
  if (view === 'operations') await p.locator('[data-operations-workspace]').waitFor();
  return { p, c };
}
async function masked(p) {
  await p.getByRole('alert').first().waitFor();
  await frames(p);
  assert.equal(await p.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 0);
  assert.equal(await p.locator(`[data-operations-cohort-id="${f.cid}"]`).count(), 0);
  assert.ok(!(await p.locator('main').innerText()).includes(f.da.document.title));
  assert.ok(
    !(await p.getByRole('alert').allTextContents()).some((s) =>
      /(SyntaxError|Unexpected token|not valid JSON)/i.test(s),
    ),
  );
}
async function invitations(p) {
  const tab = p.getByRole('tab', { name: 'Invitations', exact: true });
  await tab.waitFor();
  await tab.click();
  await p.getByLabel('Sign-in account email', { exact: true }).waitFor();
}
async function scenario(name, fn) {
  await fn();
  cases.push({ name, passed: true });
  console.log(name + ': passed');
}
try {
  for (const kind of ['primary', 'directory'])
    for (const shape of ['empty object', 'missing UID'])
      await scenario(kind + '200 ' + shape + ' masks private authority', async () => {
        const { p, c } = await person();
        let fault = true;
        await p.route('**/api/teams*', async (route) => {
          if (fault && (kind === 'primary' ? selected : directory)(route.request())) {
            fault = false;
            let json = {};
            if (shape === 'missing UID') {
              const response = await route.fetch();
              json = await response.json();
              if (kind === 'primary') delete json.team.currentUserId;
              else delete json.user.id;
            }
            return route.fulfill({ status: 200, contentType: 'application/json', json });
          }
          return route.continue();
        });
        await p.getByRole('button', { name: 'Refresh work', exact: true }).click();
        await masked(p);
        await p.evaluate(() => (location.hash = '#teams'));
        await frames(p);
        assert.equal(await p.getByRole('tab', { name: 'Content studio', exact: true }).count(), 0);
        await c.close();
      });
  await scenario('Malformed profile200 is masked without a render crash', async () => {
    const { p, c } = await person();
    await p.route('**/api/teams*', async (route) => {
      if (selected(route.request())) {
        const response = await route.fetch(),
          json = await response.json();
        json.state.profile = { ...json.state.profile, name: null, context: 'invented' };
        return route.fulfill({ status: 200, contentType: 'application/json', json });
      }
      return route.continue();
    });
    await p.getByRole('button', { name: 'Refresh work', exact: true }).click();
    await masked(p);
    await c.close();
  });
  await scenario('An older nonJSON directory403 cannot mask a newer workspace', async () => {
    const { p, c } = await person(),
      captured = deferred(),
      release = deferred(),
      delivered = deferred();
    let hold = true;
    await p.route('**/api/teams*', async (route) => {
      if (hold && directory(route.request())) {
        hold = false;
        captured.resolve();
        await release.promise;
        await route.fulfill({
          status: 403,
          contentType: 'text/html',
          body: '<html>Old access denied</html>',
        });
        delivered.resolve();
        return;
      }
      return route.continue();
    });
    try {
      await p.getByRole('button', { name: 'Refresh work', exact: true }).click();
      await captured.promise;
      const picker = p.getByRole('combobox', { name: 'Choose Academy workspace', exact: true });
      await picker.click();
      const switched = p.waitForResponse(
        (r) =>
          new URL(r.url()).searchParams.get('id') === f.ownA.id &&
          r.request().method() === 'GET' &&
          r.status() === 200,
      );
      await p.getByRole('option', { name: f.ownA.name, exact: true }).click();
      await switched;
      await p.locator('.profile small').filter({ hasText: f.ownA.name }).waitFor();
      await p.getByRole('button', { name: 'Workspace operations', exact: true }).waitFor();
      await p.locator('[data-save-state="loaded"]').waitFor();
      release.resolve();
      await delivered.promise;
      await frames(p);
      assert.equal(await p.getByRole('button', { name: 'Workspace operations', exact: true }).count(), 1);
      assert.equal(await p.getByRole('alert').count(), 0);
      assert.ok((await picker.innerText()).includes(f.ownA.name));
      assert.equal(new URL(p.url()).searchParams.get('workspace'), f.ownA.id);
    } finally {
      release.resolve();
      await c.close();
    }
  });
  await scenario('Acknowledged JSON save plus nonJSON directory403 stays saved exactly once', async () => {
    const { p, c } = await person('teams');
    await invitations(p);
    const email = 'parser-ack-' + crypto.randomUUID() + '@academy.test';
    await p.getByLabel('Sign-in account email', { exact: true }).fill(email);
    let posts = 0,
      deny = true;
    p.on('request', (r) => {
      if (post(r)) posts++;
    });
    await p.route('**/api/teams*', (route) => {
      if (deny && directory(route.request())) {
        deny = false;
        return route.fulfill({
          status: 403,
          contentType: 'text/plain',
          body: 'Synthetic current directory denied.',
        });
      }
      return route.continue();
    });
    const saved = p.waitForResponse((r) => post(r.request()) && r.status() === 200);
    await p.getByRole('button', { name: 'Create invitation link', exact: true }).click();
    await saved;
    await p
      .getByText('Invitation created. Nothing sent. · Refresh access before continuing', { exact: true })
      .waitFor();
    await masked(p);
    assert.equal(posts, 1);
    assert.equal(success(await current(f.a, f.id)).team.invites.filter((i) => i.email === email).length, 1);
    await p.unroute('**/api/teams*');
    await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await p.locator('[data-save-state="loaded"]').waitFor();
    await invitations(p);
    assert.equal(await p.getByLabel('Sign-in account email', { exact: true }).inputValue(), '');
    assert.equal(posts, 1);
    assert.equal(success(await current(f.a, f.id)).team.invites.filter((i) => i.email === email).length, 1);
    await c.close();
  });
  await scenario(
    'Unreadable2xx save retains own invitation scratch behind masking and never retries itself',
    async () => {
      const { p, c } = await person('teams');
      await invitations(p);
      const email = 'parser-uncertain-' + crypto.randomUUID() + '@academy.test';
      await p.getByLabel('Sign-in account email', { exact: true }).fill(email);
      let posts = 0,
        fault = true;
      p.on('request', (r) => {
        if (post(r)) posts++;
      });
      await p.route('**/api/teams*', async (route) => {
        if (fault && post(route.request())) {
          fault = false;
          const committed = await route.fetch();
          assert.equal(committed.status(), 200);
          return route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html>Unknown save acknowledgement</html>',
          });
        }
        return route.continue();
      });
      const saved = p.waitForResponse((r) => post(r.request()) && r.status() === 200);
      await p.getByRole('button', { name: 'Create invitation link', exact: true }).click();
      await saved;
      await masked(p);
      assert.match(
        (await p.getByRole('alert').allTextContents()).join(' '),
        /save response could not be verified/i,
      );
      assert.equal(posts, 1);
      assert.equal(success(await current(f.a, f.id)).team.invites.filter((i) => i.email === email).length, 1);
      await p.unroute('**/api/teams*');
      await p.getByRole('button', { name: 'Retry connection', exact: true }).click();
      await p.locator('[data-save-state="loaded"]').waitFor();
      await invitations(p);
      assert.equal(
        await p.getByLabel('Sign-in account email', { exact: true }).inputValue(),
        email,
        'Uncertain acknowledgement does not erase own unsent scratch',
      );
      assert.equal(posts, 1);
      assert.equal(success(await current(f.a, f.id)).team.invites.filter((i) => i.email === email).length, 1);
      await c.close();
    },
  );
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    at: new Date().toISOString(),
    worker: process.env.ACADEMY_QA_WORKER ?? '75176',
    cases,
    pageErrors: errors,
    limits: [
      'Synthetic local fixtures only; two invitation links are saved locally and nothing is sent.',
      'The unreadable2xx case commits once through route.fetch before replacing only the acknowledgement.',
      'No uncertain POST retry, production call or React internal inspection.',
    ],
  };
  writeFileSync(resolve(out, 'response-recovery-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  writeFileSync(
    resolve(out, 'response-recovery-result.json'),
    JSON.stringify(
      { passed: false, at: new Date().toISOString(), cases, pageErrors: errors, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
