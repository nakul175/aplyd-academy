import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  kit = resolve(here, '..'),
  nearby = resolve(here, '../..'),
  app = resolve(
    process.env.ACADEMY_APP_PATH ??
      (existsSync(nearby + '/app/api/academy/route.ts')
        ? nearby
        : existsSync('app/api/academy/route.ts')
          ? '.'
          : 'work/aplyd-academy'),
  ),
  adopted = existsSync(app + '/lib/academy-offering-navigation.ts'),
  output = resolve(
    process.env.ACADEMY_OFFERING_QA_OUTPUT ??
      (adopted ? app + '/.sites-runtime/exact-offering-qa' : kit + '/runtime'),
  );
mkdirSync(output, { recursive: true });
const require = createRequire(app + '/package.json'),
  esbuild = require('esbuild'),
  ts = require('typescript'),
  candidate = resolve(
    process.env.ACADEMY_OFFERING_MODEL ??
      (adopted ? app + '/lib/academy-offering-navigation.ts' : kit + '/lib/academy-offering-navigation.ts'),
  );
const entry = output + '/entry.ts';
writeFileSync(
  entry,
  `export * from ${JSON.stringify(candidate)};export {createCurriculumRegistry,curriculumRegistry,tryResolvePinnedContent,currentRef,pinnedRef,contentKey,LEGACY_CONTENT_VERSION,programs} from ${JSON.stringify(app + '/lib/academy-curriculum.ts')};export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app + '/lib/academy-teams.ts')};export {applyWorkspaceContentCommand} from ${JSON.stringify(app + '/lib/academy-authoring.ts')};export {freshWorkspace} from ${JSON.stringify(app + '/lib/academy-engine.ts')};`,
);
const bundled = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output + '/model.mjs',
  metafile: true,
  plugins: [
    {
      name: 'actual-curriculum',
      setup(build) {
        build.onResolve({ filter: /^\.\/academy-curriculum$/ }, (args) =>
          args.importer === candidate ? { path: app + '/lib/academy-curriculum.ts' } : undefined,
        );
      },
    },
  ],
});
const options = {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolveJsonModule: true,
  esModuleInterop: true,
  skipLibCheck: true,
  types: [],
};
const host = ts.createCompilerHost(options),
  defaultResolver = (name, file) => ts.resolveModuleName(name, file, options, host).resolvedModule;
host.resolveModuleNames = (names, file) =>
  names.map((name) =>
    name === './academy-curriculum' && file === candidate
      ? {
          resolvedFileName: app + '/lib/academy-curriculum.ts',
          extension: ts.Extension.Ts,
          isExternalLibraryImport: false,
        }
      : defaultResolver(name, file),
  );
const program = ts.createProgram([candidate], options, host),
  diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (f) => f,
      getNewLine: () => '\n',
    }),
  );
for (const file of ['app/academy.tsx', 'app/academy-learning.tsx'])
  await esbuild.transform(readFileSync((adopted ? app : kit) + '/' + file, 'utf8'), {
    loader: 'tsx',
    jsx: 'preserve',
    sourcefile: file,
  });
const sources = Object.keys(bundled.metafile.inputs)
  .filter((file) => resolve(file) !== entry)
  .map((file) => ({
    file: relative(app, file),
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }));
writeFileSync(
  output + '/source-evidence.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      sources,
      typedHelper: true,
      uiSyntax: true,
      limits: [
        'Actual root curriculum/pin resolver plus isolated candidate helper. Strict helper typecheck and TSX parsing only; no application build, root edits, Worker, network, SQL or persisted mutation.',
      ],
    },
    null,
    2,
  ),
);
console.log(`Candidate typed helper + UI syntax pass; pure bundle has ${sources.length} inputs.`);
