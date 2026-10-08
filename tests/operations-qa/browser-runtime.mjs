import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
const asModule = (value) => (isAbsolute(value) ? pathToFileURL(value).href : value);
let runtime;
if (process.env.ACADEMY_PLAYWRIGHT_MODULE)
  runtime = await import(asModule(process.env.ACADEMY_PLAYWRIGHT_MODULE));
else {
  try {
    runtime = await import('playwright');
  } catch {
    const bundled = resolve(
      homedir(),
      '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
    );
    if (!existsSync(bundled))
      throw new Error(
        'Provide an installed Playwright module through ACADEMY_PLAYWRIGHT_MODULE or install Playwright in the test environment.',
      );
    runtime = await import(pathToFileURL(bundled).href);
  }
}
export const chromium = runtime.chromium;
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath =
  process.env.ACADEMY_CHROME_EXECUTABLE ?? (existsSync(macChrome) ? macChrome : undefined);
export const browserOptions = { headless: true, ...(executablePath ? { executablePath } : {}) };
