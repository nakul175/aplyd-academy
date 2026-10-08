/** Reflection completion regression model: the actual checkout only.
 * Adopted from docs/candidates/reflection-completion (M6). The candidate kit's
 * staged-plan override and BEFORE bundle are not used here; reproduce-before.mjs
 * stays with the preserved candidate evidence because it requires the unfixed plan.
 * Bundles the actual engine, plan and weekly review sources into one pure module,
 * proves the sources did not change while bundling, and strict-typechecks the plan.
 * No network, SQL, persisted fixture, Worker, browser or checkout edit. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..');
const app = resolve(
  process.env.ACADEMY_APP_PATH ??
    (existsSync(nearby + '/app/api/academy/route.ts')
      ? nearby
      : existsSync('app/api/academy/route.ts')
        ? '.'
        : 'work/aplyd-academy'),
);
const output = resolve(
  process.env.ACADEMY_REFLECTION_QA_OUTPUT ?? app + '/.sites-runtime/reflection-completion-qa',
);
mkdirSync(output, { recursive: true });
const require = createRequire(app + '/package.json'),
  esbuild = require('esbuild'),
  ts = require('typescript');
const plan = app + '/lib/academy-plan.ts',
  entry = output + '/model-entry.ts';
writeFileSync(
  entry,
  `export {applyCommand,freshWorkspace,planOptions,RuleError,programs} from ${JSON.stringify(app + '/lib/academy-engine.ts')};export {applyLearningPlanCommand,taskProgress,learningPlanSummary,projectPlanTasks} from ${JSON.stringify(plan)};export {deriveOwnWeeklyReview,prepareOwnWeeklyRecap,renderOwnWeeklyRecapHtml} from ${JSON.stringify(app + '/lib/academy-weekly-review.mjs')};`,
);
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
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
  .map((file) => resolve(app, file))
  .filter((file) => file !== entry)
  .sort();
const hashes = () => inputs.map((file) => ({ file: relative(app, file), sha256: sha(file) }));
const model = hashes();
if (!model.some((s) => s.file === 'lib/academy-plan.ts'))
  throw new Error('The actual plan source is missing from the bundle.');
const options = {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  types: [],
};
const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram([plan], options, ts.createCompilerHost(options)),
);
if (diagnostics.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => app,
      getCanonicalFileName: (f) => f,
      getNewLine: () => '\n',
    }),
  );
if (JSON.stringify(model) !== JSON.stringify(hashes()))
  throw new Error('Model sources changed during bundling.');
writeFileSync(
  output + '/source-evidence.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      model,
      sourceStable: true,
      strictPlanTypecheck: true,
      limits: [
        'Actual checkout engine, plan, curriculum and weekly review bundled as one pure module; no staged override. No network, SQL, persisted fixtures, Worker, browser or checkout edit.',
      ],
    },
    null,
    2,
  ),
);
console.log(`Strict actual plan check; ${model.length} actual sources bundled; sources stable.`);
