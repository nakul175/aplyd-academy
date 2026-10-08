/** Data request QA model: bundles the actual team commands, projection, engine and data-request module
 * into one pure ESM module. No network, SQL, Worker, browser or checkout edit. */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..');
const app = resolve(
  process.env.ACADEMY_APP_PATH ?? (existsSync(nearby + '/app/api/academy/route.ts') ? nearby : '.'),
);
const output = resolve(process.env.ACADEMY_DATA_REQUEST_QA_OUTPUT ?? app + '/.sites-runtime/data-request-qa');
mkdirSync(output, { recursive: true });
const esbuild = createRequire(app + '/package.json')('esbuild'),
  entry = output + '/model-entry.ts';
writeFileSync(
  entry,
  `export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app + '/lib/academy-teams.ts')};export {freshWorkspace} from ${JSON.stringify(app + '/lib/academy-engine.ts')};export * from ${JSON.stringify(app + '/lib/academy-data-requests.ts')};`,
);
await esbuild.build({
  entryPoints: [entry],
  absWorkingDir: app,
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output + '/model.mjs',
  logLevel: 'warning',
});
console.log('Data request model bundled from actual checkout sources.');
