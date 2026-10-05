// Candidate only: no test evidence is claimed until this runs against a local build.
import {chromium} from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const origin = process.env.ACADEMY_QA_ORIGIN || 'http://127.0.0.1:8787';
const target = new URL(origin);
if (!['http:', 'https:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) {
  throw new Error('This candidate audit is restricted to a loopback preview.');
}
const nonce = crypto.randomUUID();
const output = join(dirname(fileURLToPath(import.meta.url)), '../.sites-runtime/network-accessibility.json');
const checks = [], errors = [];
const record = (name, passed, detail = null) => checks.push({name, passed: Boolean(passed), detail});
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, extraHTTPHeaders: {
  'oai-authenticated-user-id': 'network-accessibility-' + nonce,
  'oai-authenticated-user-email': 'network-accessibility-' + nonce + '@academy.test',
  'oai-authenticated-user-full-name': 'Accessibility%20fixture',
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
}});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
let projection;
async function command(value) {
  const response = await context.request.post(origin + '/api/teams', {data: {
    ...(value.type === 'create' ? {} : {teamId: projection.team.id}),
    revision: value.type === 'create' ? 0 : projection.revision,
    actionId: crypto.randomUUID(), command: value,
  }});
  const data = await response.json();
  if (!response.ok()) throw new Error('Synthetic fixture setup failed: ' + response.status() + ' ' + data.error);
  projection = data;
  return data;
}
try {
  await command({type: 'create', name: 'Accessibility fixture ' + nonce.slice(0, 6), purpose: 'A synthetic adult learning group for keyboard and enlarged-text checks.', context: 'msme'});
  await command({type: 'cohort-create', title: 'Checked customer-work practice', programId: 'msme-customer-operations', capacity: 5});
  const cohortId = projection.team.cohorts[0].id;
  await command({type: 'network-profile', enabled: true, bio: 'I practise checking fictional customer-work drafts against a source packet.', focus: 'Checking AI drafts', cohortIds: [cohortId]});
  for (const [index, title] of ['Checked draft practice', 'A deliberately longer session title to test wrapping on smaller displays'].entries()) {
    const start = Date.now() + (index + 1) * 86400000;
    await command({type: 'session-create', cohortId, title, description: 'Compare fictional customer-work drafts and explain the source checks that prevent unsupported promises.', instructions: 'Synthetic classroom instructions. No external provider or meeting link.', startsAt: new Date(start).toISOString(), endsAt: new Date(start + 3600000).toISOString(), capacity: 2});
  }
  const workspaceUrl = origin + '/?workspace=' + encodeURIComponent(projection.team.id);
  await page.goto(workspaceUrl + '#network');
  await page.getByRole('heading', {name: 'Practise together. Learn from each other.', exact: true}).waitFor();
  record('single main landmark', await page.getByRole('main').count() === 1, await page.locator('main').count());
  await page.getByRole('button', {name: 'Learning pathways', exact: true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', {name: 'Choose a skill. Make it useful.', exact: true}).waitFor();
  record('keyboard navigation moves focus into main', await page.evaluate(() => document.activeElement?.id === 'main' || Boolean(document.activeElement?.closest('#main'))), await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 300)));
  await page.getByRole('button', {name: 'People & opportunities', exact: true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', {name: 'Practise together. Learn from each other.', exact: true}).waitFor();

  const profileOpener = page.getByRole('button', {name: 'My directory profile', exact: true});
  await profileOpener.focus();
  await page.keyboard.press('Enter');
  const profile = page.getByRole('dialog', {name: 'Your cohort directory profile', exact: true});
  await profile.waitFor();
  record('dialog receives focus', await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))));
  record('directory checkbox has a name', await profile.getByRole('checkbox', {name: 'Share my profile with selected cohorts', exact: true}).count() === 1);
  record('learning focus control has a name', await profile.getByRole('combobox', {name: 'Learning focus', exact: true}).count() === 1);
  record('introduction control has a label', await profile.getByLabel('Introduction · up to 300 characters', {exact: true}).count() === 1);
  record('cohort checkbox has a name', await profile.getByRole('checkbox', {name: 'Checked customer-work practice', exact: true}).count() === 1);
  const trapped = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press(i % 4 === 0 ? 'Shift+Tab' : 'Tab');
    trapped.push(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))));
  }
  record('keyboard focus stays in profile dialog', trapped.every(Boolean), trapped);
  await page.keyboard.press('Escape');
  await profile.waitFor({state: 'hidden'});
  await page.waitForTimeout(30);
  record('Escape restores directory opener focus', await profileOpener.evaluate(element => element === document.activeElement), await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 300)));

  const schedule = page.getByRole('button', {name: 'Schedule a session', exact: true});
  await schedule.click();
  const session = page.getByRole('dialog', {name: 'Schedule a practice session', exact: true});
  for (const label of ['Session title', 'What will people practise?', 'Start date and time', 'End date and time', 'Available places', 'Where and how to join']) {
    record('session field labelled: ' + label, await session.getByLabel(label, {exact: true}).count() === 1);
  }
  await session.getByLabel('Session title', {exact: true}).fill('Invalid duration fixture');
  await session.getByLabel('What will people practise?', {exact: true}).fill('A synthetic source-check practice task for accessible error recovery.');
  await session.getByLabel('Where and how to join', {exact: true}).fill('Synthetic classroom only; no external meeting.');
  const datetimeLocal = milliseconds => {
    const date = new Date(milliseconds);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  await session.getByLabel('Start date and time', {exact: true}).fill(datetimeLocal(Date.now() + 86400000));
  await session.getByLabel('End date and time', {exact: true}).fill(datetimeLocal(Date.now() + 86400000 + 5 * 3600000));
  await session.getByRole('button', {name: 'Schedule session', exact: true}).click();
  await page.getByRole('alert').first().waitFor();
  record('invalid form remains open with input', await session.isVisible() && await session.getByLabel('Session title', {exact: true}).inputValue() === 'Invalid duration fixture');
  record('validation error is accessible', /three hours|duration|end|180/i.test(await page.getByRole('alert').first().innerText()));
  await page.keyboard.press('Escape');

  for (const width of [1440, 768, 390]) for (const doubled of [false, true]) {
    await page.setViewportSize({width, height: 1000});
    await page.evaluate(enlarged => {
      document.documentElement.style.fontSize = enlarged ? '32px' : '16px';
      document.body.style.fontSize = enlarged ? '32px' : '16px';
    }, doubled);
    const prefix = `${width}px/${doubled ? '200%' : '100%'} text`;
    record(prefix + ': no page horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await profileOpener.click();
    await profile.waitFor();
    const metrics = await profile.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const textarea = element.querySelector('textarea');
      return {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowY: getComputedStyle(element).overflowY, bodyFont: parseFloat(getComputedStyle(document.body).fontSize), inputFont: textarea ? parseFloat(getComputedStyle(textarea).fontSize) : null, viewportWidth: innerWidth, viewportHeight: innerHeight};
    });
    record(prefix + ': body text actually resized', metrics.bodyFont === (doubled ? 32 : 16), metrics);
    record(prefix + ': input text actually resized', metrics.inputFont >= (doubled ? 30 : 15), metrics.inputFont);
    record(prefix + ': dialog contained horizontally', metrics.left >= -1 && metrics.right <= width + 1 && metrics.scrollWidth <= metrics.clientWidth + 1, metrics);
    record(prefix + ': dialog visible and scrollable', metrics.top >= -1 && metrics.bottom <= 1001 && ['auto', 'scroll'].includes(metrics.overflowY), metrics);
    await profile.getByRole('button', {name: 'Save directory choice', exact: true}).scrollIntoViewIfNeeded();
    record(prefix + ': profile action reachable', await profile.getByRole('button', {name: 'Save directory choice', exact: true}).isVisible());
    await page.keyboard.press('Escape');
    await profile.waitFor({state: 'hidden'});
  }
  await page.emulateMedia({reducedMotion: 'reduce'});
  record('reduced motion honored by spinner', await page.evaluate(() => {const probe = document.createElement('span'); probe.className = 'spin'; document.body.append(probe); const disabled = getComputedStyle(probe).animationName === 'none'; probe.remove(); return disabled;}));
} catch (error) {
  errors.push(error.stack || error.message);
} finally {
  const result = {candidate: true, executedAt: new Date().toISOString(), origin, syntheticLocalFixture: true, checks, errors, passed: checks.every(check => check.passed) && !errors.length, limits: ['No production identity or published access tested.', 'No screen-reader certification or offline support claim.', 'Text enlargement is explicit CSS resizing; real browser zoom needs manual verification.']};
  writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: result.passed, checks: checks.length, failed: checks.filter(check => !check.passed), errors, output}));
  await browser.close();
  if (!result.passed) process.exitCode = 1;
}
