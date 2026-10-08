import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(app + '/package.json'),
  esbuild = require('esbuild');
const out = app + '/.sites-runtime/content-qa';
mkdirSync(out, { recursive: true });
const files = [
  'lib/academy-curriculum.ts',
  'lib/academy-engine.ts',
  'lib/academy-authoring.ts',
  'lib/academy-inclusive-learning.ts',
];
const hashes = () =>
  Object.fromEntries(
    files.map((f) => [
      f,
      createHash('sha256')
        .update(readFileSync(app + '/' + f))
        .digest('hex'),
    ]),
  );
const before = hashes();
for (const [file, name] of [
  ['lib/academy-curriculum.ts', 'curriculum'],
  ['lib/academy-engine.ts', 'engine'],
  ['lib/academy-authoring.ts', 'authoring'],
  ['lib/academy-inclusive-learning.ts', 'inclusive'],
])
  await esbuild.build({
    entryPoints: [app + '/' + file],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out + '/' + name + '.mjs',
    logLevel: 'warning',
  });
if (JSON.stringify(before) !== JSON.stringify(hashes()))
  throw new Error('Sources changed during content-qa compilation');
writeFileSync(
  out + '/source-evidence.json',
  JSON.stringify(
    {
      passed: true,
      files: before,
      limits: ['Pure model compilation only; no network, browser, Worker or storage mutation.'],
    },
    null,
    2,
  ) + '\n',
);
console.log('Bundled content-qa models.');
