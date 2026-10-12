import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..');
export const app = resolve(
  process.env.ACADEMY_APP_PATH ??
    (existsSync(nearby + '/app/api/academy/route.ts')
      ? nearby
      : existsSync('app/api/academy/route.ts')
        ? '.'
        : 'work/aplyd-academy'),
);
export const output = resolve(
  process.env.ACADEMY_ROUTE_ERROR_QA_OUTPUT ??
    (here.includes('/tests/') ? app + '/.sites-runtime/route-errors' : here + '/runtime'),
);
mkdirSync(output, { recursive: true });
export const runtimeModule = (file) => pathToFileURL(output + '/' + file).href;
