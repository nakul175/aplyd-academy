import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  kit = resolve(here, '..'),
  nearby = resolve(here, '../..');
const app = resolve(
  process.env.ACADEMY_APP_PATH ??
    (existsSync(nearby + '/app/api/academy/route.ts')
      ? nearby
      : existsSync('app/api/academy/route.ts')
        ? '.'
        : 'work/aplyd-academy'),
);
const candidate = resolve(
  process.env.ACADEMY_RETAINED_EXPORT_MODEL ??
    (existsSync(app + '/lib/academy-retained-export.ts')
      ? app + '/lib/academy-retained-export.ts'
      : kit + '/lib/academy-retained-export.ts'),
);
const output = resolve(
  process.env.ACADEMY_RETAINED_EXPORT_QA_OUTPUT ??
    (candidate.startsWith(app + '/') ? app + '/.sites-runtime/retained-export-qa' : kit + '/runtime'),
);
mkdirSync(output, { recursive: true });
const require = createRequire(app + '/package.json'),
  esbuild = require('esbuild'),
  ts = require('typescript'),
  entry = output + '/entry.ts';
writeFileSync(
  entry,
  `export * from ${JSON.stringify(candidate)};export {pinnedRef,contentKey,tryResolvePinnedContent,curriculumRegistry,LEGACY_CONTENT_VERSION} from ${JSON.stringify(app + '/lib/academy-curriculum.ts')};`,
);
const result = await esbuild.build({
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
  defaultResolve = (name, file) => ts.resolveModuleName(name, file, options, host).resolvedModule;
host.resolveModuleNames = (names, file) =>
  names.map((name) =>
    name === './academy-curriculum' && file === candidate
      ? {
          resolvedFileName: app + '/lib/academy-curriculum.ts',
          extension: ts.Extension.Ts,
          isExternalLibraryImport: false,
        }
      : defaultResolve(name, file),
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
const sources = Object.keys(result.metafile.inputs)
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
      limits: [
        'Actual root contentKey/pinnedRef and immutable registry; staged pure helper. In-memory tests only. No Worker, browser, API, SQL, checkout edits or app build.',
      ],
    },
    null,
    2,
  ),
);
console.log(`Typed retained-export helper; ${sources.length} actual/candidate inputs.`);
