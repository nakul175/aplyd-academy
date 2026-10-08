/** Credential QA model: bundles the ACTUAL engine, credential and public-lookup sources into one pure module.
 * No network, SQL, Worker, browser or checkout edit. Sources are hashed before and after to prove stability. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..');
const app = resolve(
  process.env.ACADEMY_APP_PATH ?? (existsSync(nearby + '/app/api/academy/route.ts') ? nearby : '.'),
);
const output = resolve(process.env.ACADEMY_CREDENTIAL_QA_OUTPUT ?? app + '/.sites-runtime/credential-qa');
mkdirSync(output, { recursive: true });
const esbuild = createRequire(app + '/package.json')('esbuild');
const entry = output + '/model-entry.ts';
writeFileSync(
  entry,
  `export {applyCommand,freshWorkspace,programs,RuleError} from ${JSON.stringify(app + '/lib/academy-engine.ts')};export * from ${JSON.stringify(app + '/lib/academy-credential.ts')};export * from ${JSON.stringify(app + '/lib/academy-credential-public.ts')};`,
);
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const bundle = await esbuild.build({
  entryPoints: [entry],
  absWorkingDir: app,
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output + '/model.mjs',
  metafile: true,
  logLevel: 'warning',
});
const inputs = Object.keys(bundle.metafile.inputs)
  .map((f) => resolve(app, f))
  .filter((f) => f !== entry)
  .sort();
const hashes = () => inputs.map((f) => ({ file: relative(app, f), sha256: sha(f) }));
const model = hashes();
for (const need of ['lib/academy-engine.ts', 'lib/academy-credential.ts', 'lib/academy-credential-public.ts'])
  if (!model.some((m) => m.file === need)) throw new Error('Missing actual source ' + need);
if (JSON.stringify(model) !== JSON.stringify(hashes())) throw new Error('Sources changed during bundling.');
writeFileSync(
  output + '/source-evidence.json',
  JSON.stringify({ at: new Date().toISOString(), model, sourceStable: true }, null, 1),
);
console.log(`Credential model: ${model.length} actual sources bundled; sources stable.`);
