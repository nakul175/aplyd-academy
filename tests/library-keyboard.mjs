import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const app = resolve(process.env.ACADEMY_APP_PATH ?? new URL('../', import.meta.url).pathname);
process.env.ACADEMY_APP_PATH = app;
const out = resolve(process.env.ACADEMY_LIBRARY_KEYBOARD_OUT ?? app + '/.sites-runtime/library-keyboard');
mkdirSync(out, { recursive: true });
const { base, headers, identity } = await import(pathToFileURL(app + '/tests/local-qa.mjs'));
const { chromium, browserOptions } = await import(
  pathToFileURL(app + '/tests/scoped-workbench-qa/browser-runtime.mjs')
);
const browser = await chromium.launch(browserOptions),
  contexts = [],
  views = [],
  errors = [];
let posts = 0;
const frames = (p) =>
  p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function own(context) {
  const response = await context.request.get(base + '/api/academy');
  assert.equal(response.status(), 200);
  const data = await response.json();
  return { currentUserId: data.currentUserId, revision: data.revision, state: data.state };
}
function assertVisible(focus, width) {
  assert.ok(focus.focusVisible, focus.label + ' must retain a visible keyboard focus state');
  assert.ok(
    focus.outlineWidth >= 2 && focus.outlineStyle !== 'none',
    focus.label + ' must show its focus ring',
  );
  assert.ok(focus.rect.left >= -1 && focus.rect.right <= width + 1, focus.label + ' must fit horizontally');
  assert.ok(
    focus.rect.top >= -1 && focus.rect.bottom <= focus.viewportHeight + 1,
    focus.label + ' must scroll fully into the viewport',
  );
  assert.ok(focus.hit, focus.label + ' must not be obscured at its center');
  assert.ok(focus.documentWidth <= width + 1, 'No horizontal page overflow');
}
async function focused(p) {
  return p.evaluate(() => {
    const e = document.activeElement,
      b = e.getBoundingClientRect(),
      style = getComputedStyle(e),
      hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return {
      tag: e.tagName,
      id: e.id,
      label: e.getAttribute('aria-label') || [...(e.labels ?? [])].map((l) => l.textContent.trim()).join(' '),
      resourceId: e.closest('[data-library-resource-id]')?.getAttribute('data-library-resource-id') ?? null,
      href: e.getAttribute('href'),
      focusVisible: e.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      rect: { left: b.left, right: b.right, top: b.top, bottom: b.bottom },
      hit: hit === e || e.contains(hit),
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
}
try {
  for (const [width, scale] of [
    [1440, 1],
    [768, 2],
    [390, 2],
  ]) {
    const user = identity('library-keyboard-' + width),
      context = await browser.newContext({
        viewport: { width, height: 1000 },
        extraHTTPHeaders: headers(user),
      });
    contexts.push(context);
    const before = await own(context),
      p = await context.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    context.on('request', (r) => {
      if (r.method() === 'POST') posts++;
    });
    await p.goto(base + '/#library');
    await p.getByRole('heading', { name: 'Learning for the work ahead', exact: true }).waitFor();
    await p.locator('[data-save-state="loaded"]').waitFor();
    await p.evaluate((scale) => {
      document.documentElement.style.fontSize = scale === 2 ? '32px' : '16px';
      document.body.style.fontSize = scale === 2 ? '32px' : '16px';
    }, scale);
    await frames(p);
    const expected = await p.locator('[data-library-view]').evaluate((region) =>
      [...region.querySelectorAll('input,select,a,button')]
        .filter((e) => e.getClientRects().length && !e.disabled && e.tabIndex >= 0)
        .map((e) => ({
          tag: e.tagName,
          id: e.id,
          label:
            e.getAttribute('aria-label') || [...(e.labels ?? [])].map((l) => l.textContent.trim()).join(' '),
          resourceId:
            e.closest('[data-library-resource-id]')?.getAttribute('data-library-resource-id') ?? null,
          href: e.getAttribute('href'),
        })),
    );
    assert.equal(expected.length, 43);
    assert.deepEqual(
      expected.slice(0, 3).map((e) => e.label),
      ['Search the library', 'Collection', 'Suggested audience'],
    );
    assert.equal(expected.slice(3).filter((e) => e.tag === 'A').length, 40);
    assert.equal(new Set(expected.slice(3).map((e) => e.resourceId)).size, 20);
    await p.locator('#main').focus();
    assert.equal(await p.evaluate(() => document.activeElement.id), 'main');
    const route = [];
    for (const [index, target] of expected.entries()) {
      await p.keyboard.press('Tab');
      await frames(p);
      const actual = await focused(p);
      assert.deepEqual(
        {
          tag: actual.tag,
          id: actual.id,
          label: actual.label,
          resourceId: actual.resourceId,
          href: actual.href,
        },
        target,
        'Actual Tab event follows rendered DOM order at index ' + index,
      );
      assertVisible(actual, width);
      route.push(actual);
      if ([0, 3, 42].includes(index))
        await p.screenshot({
          path: resolve(out, 'keyboard-' + width + '-text' + scale + '-target' + index + '.png'),
          fullPage: false,
          animations: 'disabled',
        });
    }
    await p.keyboard.press('Shift+Tab');
    await frames(p);
    const reverse = await focused(p);
    assert.equal(reverse.label, expected[41].label);
    assertVisible(reverse, width);
    const after = await own(context);
    assert.deepEqual(after, before, 'Keyboard-only browsing cannot alter learning state or revision');
    views.push({
      width,
      textScale: scale,
      targets: route.length,
      actualTabRoute: route,
      reverseLastTarget: reverse.label,
      stateAndRevisionUnchanged: true,
    });
    await context.close();
  }
  assert.equal(posts, 0);
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    at: new Date().toISOString(),
    worker: process.env.ACADEMY_QA_WORKER ?? null,
    views,
    actualTabTargets: views.reduce((n, v) => n + v.targets, 0),
    posts,
    pageErrors: errors,
    limits: [
      'Synthetic loopback reader; no learning writes or production calls.',
      'Actual Tab and Shift+Tab events with geometry, hit testing, accessible labels and CSS focus-ring checks.',
      'This is a bounded keyboard acceptance test, not a screen-reader or accessibility-conformance claim.',
    ],
  };
  writeFileSync(resolve(out, 'library-keyboard-result.json'), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({ passed: true, views: views.length, actualTabTargets: result.actualTabTargets, posts }),
  );
} catch (error) {
  writeFileSync(
    resolve(out, 'library-keyboard-result.json'),
    JSON.stringify(
      {
        passed: false,
        at: new Date().toISOString(),
        worker: process.env.ACADEMY_QA_WORKER ?? null,
        views,
        posts,
        pageErrors: errors,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await Promise.allSettled(contexts.map((c) => c.close()));
  await browser.close();
}
