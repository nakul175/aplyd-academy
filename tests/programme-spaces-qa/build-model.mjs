/** Bundles the actual team layer, programme spaces, org overview, data requests and recovery
 * sources into one pure ESM module for the wave 4 QA suites (BR-32, BR-38, BR-39).
 * No network, SQL, Worker or browser. Output: .sites-runtime/wave4-qa/model.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const app = resolve(
    process.env.ACADEMY_APP_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  ),
  out = resolve(app, '.sites-runtime/wave4-qa');
mkdirSync(out, { recursive: true });
const { build } = await import(pathToFileURL(resolve(app, 'node_modules/esbuild/lib/main.js')).href);
const entry = resolve(out, 'entry.ts');
writeFileSync(
  entry,
  [
    `export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app + '/lib/academy-teams.ts')};`,
    `export {programs} from ${JSON.stringify(app + '/lib/academy-engine.ts')};`,
    `export * from ${JSON.stringify(app + '/lib/academy-programme-spaces.ts')};`,
    `export * from ${JSON.stringify(app + '/lib/academy-org-admin.ts')};`,
    `export {projectDataRequests,isOverdue} from ${JSON.stringify(app + '/lib/academy-data-requests.ts')};`,
    `export {projectRecovery} from ${JSON.stringify(app + '/lib/academy-recovery.ts')};`,
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
console.log('Wave 4 QA model bundled from actual sources.');
