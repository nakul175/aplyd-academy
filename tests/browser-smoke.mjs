import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const qaBuilt = process.env.ACADEMY_QA_BUILT === '1',
  qaOrigin = qaBuilt ? 'http://127.0.0.1:8787' : 'http://127.0.0.1:5173',
  qaHeaders = qaBuilt
    ? {
        'oai-authenticated-user-id': 'lab-browser-' + crypto.randomUUID(),
        'oai-authenticated-user-email': 'synthetic@academy.test',
      }
    : {};
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: qaHeaders,
  }),
  page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(qaOrigin + '/');
await page.getByText('What will you put to work today?').waitFor();
await page.locator('[data-save-state="loaded"]').waitFor();
await page.screenshot({ path: '.sites-runtime/desktop.png', fullPage: true });
const checked = [];
for (const [hash, title] of [
  ['programs', 'Choose a skill. Make it useful.'],
  ['community', 'Good questions make better work.'],
  ['network', 'Keep learning through connection.'],
  ['credentials', 'A skill you can explain and apply.'],
  ['connections', 'Choose the summary. Check the contract.'],
  ['studio', 'Feedback that makes learning credible.'],
  ['settings', 'Make learning work for you.'],
]) {
  await page.evaluate((hash) => (location.hash = hash), hash);
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  if (hash === 'connections') {
    const health = page.locator('[data-ecosystem-adapter=health]');
    if (
      (await health.getByRole('combobox').count()) ||
      (await health.getByRole('checkbox').count()) ||
      (await health.getByRole('button').count())
    )
      throw new Error('Fresh Health card must have no contract controls');
    const run = page.getByRole('button', { name: 'Run local contract test', exact: true });
    if ((await run.count()) !== 3) throw new Error('Three approved ecosystem test controls expected');
    for (const button of await run.all())
      if (!(await button.isDisabled())) throw new Error('A fresh empty lab cannot run a contract test');
    const receipts = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Local contract receipts', exact: true }) });
    if (await receipts.locator('details').count())
      throw new Error('A fresh lab has no scoped receipt history');
  }
  checked.push(hash);
}
await page.evaluate(() => (location.hash = 'learn/msme-customer-operations'));
await page.getByRole('button', { name: 'Start this pathway', exact: true }).click();
await page.getByRole('button', { name: 'Open practical assessment', exact: true }).waitFor();
await page.screenshot({ path: '.sites-runtime/lesson.png', fullPage: true });
await page.reload();
await page.getByText('0 of 3 lessons complete', { exact: true }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => (location.hash = 'home'));
await page.getByText('What will you put to work today?').waitFor();
await page.screenshot({ path: '.sites-runtime/mobile.png', fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const result = {
  routes: checked,
  lessonEnrollmentReload: true,
  mobileOverflow: overflow,
  pageErrors: errors,
};
writeFileSync('.sites-runtime/browser-smoke.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
if (errors.length || overflow) process.exitCode = 1;
