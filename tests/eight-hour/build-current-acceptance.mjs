import { resolve, dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  app = resolve(process.env.ACADEMY_APP_PATH ?? process.cwd());
const out = resolve(process.env.ACADEMY_ACCEPTANCE_QA_OUT ?? app + '/.sites-runtime/eight-hour/runtime');
mkdirSync(out, { recursive: true });
const require = createRequire(app + '/package.json');
await require('esbuild').build({
  entryPoints: [app + '/app/academy-acceptance.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out + '/academy-acceptance.mjs',
});
const files = [
  'app/academy.tsx',
  'app/academy-acceptance.ts',
  'app/academy-response.ts',
  'app/academy-context.tsx',
  'app/academy-inclusive-learning.tsx',
  'app/academy-learning.tsx',
  'app/academy-offline.tsx',
  'app/api/academy/route.ts',
  'app/api/teams/route.ts',
  'lib/academy-inclusive-learning.ts',
  'lib/academy-engine.ts',
  'lib/academy-teams.ts',
  'drizzle/0005_tearful_angel.sql',
];
writeFileSync(
  out + '/source-evidence.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      files: Object.fromEntries(
        files.map((f) => [
          f,
          createHash('sha256')
            .update(readFileSync(app + '/' + f))
            .digest('hex'),
        ]),
      ),
      limits: [
        'Actual checkout model compilation only. Build/Worker identity is confirmed separately by root.',
      ],
    },
    null,
    2,
  ),
);
console.log('Current integrated acceptance module compiled to the selected evidence directory.');
