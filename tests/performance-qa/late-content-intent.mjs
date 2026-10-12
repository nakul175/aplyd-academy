import assert from 'node:assert/strict';
import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {
  performanceFixture,
  emittedAssets,
  base,
  headers,
  current,
  action,
  success,
  record,
  nonce,
} from './performance-fixture.mjs';
const f = await performanceFixture(),
  { assets } = emittedAssets(),
  timeline = [],
  scenarios = [];
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
async function frames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function pageFor() {
  const context = await browser.newContext({
      extraHTTPHeaders: headers(f.owner),
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  return { context, page };
}
async function held(page) {
  const captured = deferred(),
    release = deferred(),
    delivered = deferred();
  let once = true;
  await page.route('**' + assets.content, async (route) => {
    if (!once) return route.continue();
    once = false;
    const response = await route.fetch();
    captured.resolve();
    await release.promise;
    await route.fulfill({ response });
    delivered.resolve();
  });
  return {
    captured: captured.promise,
    release: async () => {
      release.resolve();
      await delivered.promise;
      await frames(page);
    },
    cancel: () => release.resolve(),
  };
}
async function openTarget(page, target) {
  await page.goto(base + '/?workspace=' + f.id + '#operations');
  await page.locator('[data-save-state="loaded"]').waitFor();
  const button = page
    .locator(`[data-operations-content-id="${target}"]`)
    .getByRole('button', { name: 'Open content studio', exact: true });
  await button.waitFor();
  await button.click();
}
async function stamp(page, label, extra = {}) {
  timeline.push({
    label,
    ...extra,
    ui: await page.evaluate(() => ({
      hash: location.hash,
      focusId: document.activeElement?.id,
      focusLabel:
        document.activeElement?.id === 'main' ? null : document.activeElement?.textContent?.slice(0, 100),
      selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
      editors: [...document.querySelectorAll('[data-content-editor-id]')].map((x) =>
        x.getAttribute('data-content-editor-id'),
      ),
    })),
  });
}
try {
  const one = await pageFor(),
    h = await held(one.page);
  try {
    await openTarget(one.page, f.targetDraft.id);
    await h.captured;
    await stamp(one.page, 'original content target pending', {
      target: { workspaceId: f.id, view: 'teams', section: 'content', id: f.targetDraft.id },
    });
    await one.page.getByRole('tab', { name: 'Invitations', exact: true }).click();
    const email = one.page.getByLabel('Sign-in account email', { exact: true }),
      own = 'own-intent-' + nonce + '@academy.test';
    await email.fill(own);
    await stamp(one.page, 'manual Invitations and typing supersede target');
    await h.release();
    await stamp(one.page, 'code delivered while Invitations active');
    assert.equal(await email.inputValue(), own);
    assert.equal(await email.evaluate((e) => e === document.activeElement), true);
    assert.equal(await one.page.locator('[data-content-editor-id]').count(), 0);
    await one.page.getByRole('tab', { name: 'Content studio', exact: true }).click();
    await one.page.getByRole('heading', { name: 'Content studio', exact: true }).waitFor();
    await frames(one.page);
    await stamp(one.page, 'manual return to Content studio');
    const staleSelection = await one.page.locator(`[data-content-editor-id="${f.targetDraft.id}"]`).count();
    scenarios.push({
      name: 'manual tab/type intent cancels earlier delayed content destination',
      passed: staleSelection === 0,
      staleSelectionOnManualReturn: staleSelection > 0,
      typingPreserved: true,
    });
  } finally {
    h.cancel();
    await one.context.close();
  }
  // A publication destination calls focusOperationItem in the lazy consumer.
  let x = success(await current(f.owner, f.id)),
    d = x.team.content.drafts.find((d) => d.id === f.targetDraft.id);
  x = success(
    await action(f.owner, f.id, {
      type: 'content-recall',
      draftId: d.id,
      revision: d.revision,
      reason: 'Fictional local late-focus probe changes only its review schedule.',
    }),
  );
  d = x.team.content.drafts.find((d) => d.id === f.targetDraft.id);
  x = success(
    await action(f.owner, f.id, {
      type: 'content-submit',
      draftId: d.id,
      revision: d.revision,
      reviewerId: f.backup.id,
      reviewDueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    }),
  );
  d = x.team.content.drafts.find((d) => d.id === f.targetDraft.id);
  x = success(
    await action(f.backup, f.id, {
      type: 'content-review',
      draftId: d.id,
      revision: d.revision,
      decision: 'approve',
      checks: { sources: true, answers: true, rubric: true, safety: true, accessibility: true },
      note: 'Independent fictional sources, answer keys, rubric, safety and accessibility checked for this local focus probe.',
    }),
  );
  d = x.team.content.drafts.find((d) => d.id === f.targetDraft.id);
  x = success(await action(f.owner, f.id, { type: 'content-publish', draftId: d.id, revision: d.revision }));
  const publication = x.team.content.publications.at(-1);
  const two = await pageFor(),
    hp = await held(two.page);
  try {
    await openTarget(two.page, publication.id);
    await hp.captured;
    await stamp(two.page, 'publication target pending', {
      target: { workspaceId: f.id, view: 'teams', section: 'content', id: publication.id },
    });
    const chosen = two.page.getByRole('button', { name: 'New workspace', exact: true });
    await chosen.focus();
    await stamp(two.page, 'user focuses another control during held code');
    await hp.release();
    await two.page.locator(`[data-content-publication-id="${publication.id}"]`).waitFor();
    await frames(two.page);
    await stamp(two.page, 'publication code delivered after independent focus');
    const retained = await chosen.evaluate((e) => e === document.activeElement);
    scenarios.push({
      name: 'manual focus intent before lazy consumer mount is respected',
      passed: retained,
      lateFocusStolen: !retained,
    });
  } finally {
    hp.cancel();
    await two.context.close();
  }
  for (const long of [false, true]) {
    const person = await pageFor(),
      hold = await held(person.page);
    try {
      await openTarget(person.page, publication.id);
      await hold.captured;
      await stamp(
        person.page,
        long
          ? 'original publication intent held past original1s deadline'
          : 'original publication intent with short delay',
      );
      if (long) await new Promise((resolve) => setTimeout(resolve, 1200));
      await hold.release();
      const row = person.page.locator(`[data-content-publication-id="${publication.id}"]`);
      await row.waitFor();
      await frames(person.page);
      await stamp(
        person.page,
        long
          ? 'authorized publication available with expired original focus deadline'
          : 'authorized publication available with original focus intent',
      );
      const focus = await person.page.evaluate(() => ({
          id: document.activeElement?.id,
          label: document.activeElement?.textContent?.slice(0, 100),
        })),
        inRow = await row.evaluate((e) => e.contains(document.activeElement));
      scenarios.push({
        name: long
          ? 'original deadline is not restarted at lazy mount'
          : 'short current-authorized publication focus remains available',
        passed: long ? focus.id === 'main' : inRow,
        heldPastOriginalDeadline: long,
        focus,
        focusInAuthorizedPublication: inRow,
      });
    } finally {
      hold.cancel();
      await person.context.close();
    }
  }
  const result = {
    executedAt: new Date().toISOString(),
    passed: scenarios.every((s) => s.passed),
    scenarios,
    timeline,
    limits: [
      'Actual current local v0.8 UI with held genuine authoring chunk',
      'Only fictional local source publication and typing',
      'Targets contain item IDs and route metadata, not bodies or command rights',
    ],
  };
  record(process.env.ACADEMY_LATE_INTENT_RESULT ?? 'late-content-intent-result.json', result);
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
