import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url));
const nearby = resolve(here, '../..');
export const app = resolve(
  process.env.ACADEMY_APP_PATH ??
    (existsSync(nearby + '/lib/academy-job-templates.ts')
      ? nearby
      : existsSync('lib/academy-job-templates.ts')
        ? '.'
        : 'work/aplyd-academy'),
);
process.env.ACADEMY_APP_PATH = app;
export const output = resolve(
  process.env.ACADEMY_TEMPLATE_QA_OUTPUT ?? app + '/.sites-runtime/job-template-qa',
);
mkdirSync(output, { recursive: true });
export const rootModule = (file) => pathToFileURL(resolve(app, file)).href;
export async function localHelpers() {
  assert.equal(
    process.env.ACADEMY_TEMPLATE_WORKER_READY,
    '1',
    'Wait for root explicit stable Worker signal and set ACADEMY_TEMPLATE_WORKER_READY=1 before local API/browser QA.',
  );
  const m = await import(rootModule('tests/local-qa.mjs'));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(m.base).hostname));
  return m;
}
