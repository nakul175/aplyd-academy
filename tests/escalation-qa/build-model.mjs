/** Bundles the actual team, escalation, reports and engine sources into one pure ESM module
 * shared by the escalation, reports and isolation QA suites (wave 3). No network, SQL,
 * Worker or browser. Output: .sites-runtime/wave3-qa/model.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const app = resolve(
    process.env.ACADEMY_APP_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  ),
  out = resolve(app, '.sites-runtime/wave3-qa');
mkdirSync(out, { recursive: true });
const { build } = await import(pathToFileURL(resolve(app, 'node_modules/esbuild/lib/main.js')).href);
const entry = resolve(out, 'entry.ts');
writeFileSync(
  entry,
  [
    `export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app + '/lib/academy-teams.ts')};`,
    `export {programs} from ${JSON.stringify(app + '/lib/academy-engine.ts')};`,
    `export * from ${JSON.stringify(app + '/lib/academy-escalation.ts')};`,
    `export * from ${JSON.stringify(app + '/lib/academy-reports.ts')};`,
  ].join('\n'),
);
await build({
  entryPoints: [entry],
  outfile: resolve(out, 'model.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
});
console.log('Wave 3 QA model bundled from actual sources.');
