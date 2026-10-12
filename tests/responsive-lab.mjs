import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const qaBuilt = process.env.ACADEMY_QA_BUILT === '1',
  qaOrigin = qaBuilt ? 'http://127.0.0.1:8787' : 'http://127.0.0.1:5173',
  qaHeaders = qaBuilt
    ? {
        'oai-authenticated-user-id': 'lab-responsive-' + crypto.randomUUID(),
        'oai-authenticated-user-email': 'synthetic@academy.test',
      }
    : {};
const b = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await b.newPage({ extraHTTPHeaders: qaHeaders });
await page.goto(qaOrigin + '/');
await page.locator('[data-save-state="loaded"]').waitFor();
const rows = [];
for (const width of [1440, 768, 390])
  for (const enlarged of [false, true]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate((v) => (document.documentElement.style.fontSize = v ? '200%' : ''), enlarged);
    for (const view of [
      'home',
      'programs',
      'learn/msme-customer-operations',
      'community',
      'network',
      'credentials',
      'connections',
      'studio',
      'settings',
    ]) {
      await page.evaluate((v) => (location.hash = v), view);
      await page.waitForTimeout(80);
      rows.push({
        width,
        enlarged,
        view,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
    }
  }
const modelContext = await page.evaluate(() => !!document.modelContext?.registerTool);
const out = {
  checks: rows.length,
  overflow: rows.filter((x) => x.overflow),
  webmcpBrowserSupport: modelContext,
};
writeFileSync('.sites-runtime/responsive.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
await b.close();
if (out.overflow.length) process.exitCode = 1;
