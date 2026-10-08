import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const proposed = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const appRoot = resolve(
  process.env.ACADEMY_APP_PATH ??
    (existsSync(resolve(proposed, 'package.json')) ? proposed : 'work/aplyd-academy'),
);
process.env.ACADEMY_APP_PATH ??= appRoot;
export const evidenceRoot = resolve(
  process.env.ACADEMY_OPERATIONS_QA_OUT ?? resolve(appRoot, '.sites-runtime/operations-qa'),
);
mkdirSync(evidenceRoot, { recursive: true });
export const out = pathToFileURL(evidenceRoot + '/');
export const runtimeModuleHref = pathToFileURL(resolve(evidenceRoot, 'runtime/operations.mjs')).href;
