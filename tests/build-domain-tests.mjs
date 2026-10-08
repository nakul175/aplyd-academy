import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const app = resolve(process.env.ACADEMY_APP_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')),
  runtime = resolve(app, '.sites-runtime');
const { build } = await import(pathToFileURL(resolve(app, 'node_modules/esbuild/lib/main.js')).href);
const files = readdirSync(resolve(app, 'lib'))
  .filter((f) => /\.(ts|json)$/.test(f))
  .sort();
const hashes = () =>
  Object.fromEntries(
    files.map((f) => [
      f,
      createHash('sha256')
        .update(readFileSync(resolve(app, 'lib', f)))
        .digest('hex'),
    ]),
  );
const before = hashes();
mkdirSync(runtime, { recursive: true });
const names = [
  'engine',
  'teams',
  'storage',
  'curriculum',
  'plan',
  'ecosystem-guard',
  'authoring',
  'support',
  'operations',
];
await Promise.all(
  names.map((name) =>
    build({
      entryPoints: [resolve(app, 'lib/academy-' + name + '.ts')],
      outfile: resolve(runtime, name + '.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'warning',
    }),
  ),
);
await build({
  entryPoints: [resolve(app, 'tests/operations-integration-entry.ts')],
  outfile: resolve(runtime, 'operations-integration.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});
if (JSON.stringify(before) !== JSON.stringify(hashes()))
  throw new Error('Domain sources changed during bundling.');
writeFileSync(
  resolve(runtime, 'domain-source-evidence.json'),
  JSON.stringify(
    {
      bundledAt: new Date().toISOString(),
      app,
      sourceStable: true,
      sourceHashes: before,
      scope: 'Actual integrated pure modules; no API or hosted claim',
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ sourceStable: true, bundles: names.length + 1 }));
