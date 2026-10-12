#!/usr/bin/env node
// Pure test runner: `pnpm test`.
//
// 1. Runs the builder scripts that bundle the application modules into .sites-runtime/ (git-ignored) with esbuild,
//    in the order the as-built evidence records them. Nothing is installed, no browser or network is used, and no
//    tracked file is written.
// 2. Runs every tests/**/*.test.mjs under node:test, except the files listed in EXCLUDED, with type stripping on so
//    the suites that import lib/*.ts directly can load them.
// 3. Runs the read-only routing guard suite on its own, as the release evidence has always counted it separately.
//
//   node scripts/test.mjs                 build bundles, run the suites, run the guard
//   node scripts/test.mjs --no-build      reuse the bundles already in .sites-runtime/
//   node scripts/test.mjs engine plan     only suites whose path contains one of the words (guard still runs)
//
// Not covered here, on purpose: the browser harnesses (tests/**/*-browser*.mjs, tests/demo-browser-qa/acceptance.mjs)
// need Playwright, Chromium and a running local stack; the API harnesses (tests/*-api.mjs) need a running Worker.
// Run those by hand following tests/demo-browser-qa/README.md and docs/CLAUDE-HANDOFF.md.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const filters = args.filter((a) => !a.startsWith('--'));

// Builders, in the order docs/as-built-v0.15.1/release-evidence.json records the first fifteen; the rest were added
// with the v0.15.2 to v0.17.0 test folders and bundle from the same checkout sources.
const BUILDERS = [
  'tests/build-domain-tests.mjs',
  'tests/build-authoring-security.mjs',
  'tests/compile-offline.mjs',
  'tests/compile-partner-readiness-tests.mjs',
  'tests/compile-record-tests.mjs',
  'tests/compile-scoped-workbench.mjs',
  'tests/library-test-compiler.mjs',
  'tests/job-template-qa/build-actual-model.mjs',
  'tests/content-readiness-qa/build-models.mjs',
  'tests/before-start-qa/build-model.mjs',
  'tests/exact-offering-qa/build-model.mjs',
  'tests/retained-export-qa/build-model.mjs',
  'tests/operations-qa/bundle-operations.mjs',
  'tests/scoped-workbench-qa/bundle-domain.mjs',
  'tests/reflection-completion-qa/build-model.mjs',
  'tests/assessment-qa/build-model.mjs',
  'tests/audit-detail-qa/build-model.mjs',
  'tests/content-qa/build-model.mjs',
  'tests/credential-qa/build-model.mjs',
  'tests/data-request-qa/build-model.mjs',
  'tests/discovery-qa/build-model.mjs',
  'tests/escalation-qa/build-model.mjs',
  'tests/isolation-qa/build-model.mjs',
  'tests/onboarding-qa/build-model.mjs',
  'tests/org-admin-qa/build-model.mjs',
  'tests/partner-dummy-qa/build-model.mjs',
  'tests/programme-spaces-qa/build-model.mjs',
  'tests/recovery-qa/build-model.mjs',
  'tests/reports-qa/build-model.mjs',
  'tests/route-errors/build-route-model.mjs',
];

// Suites that pass but are not run by `pnpm test`, with the reason. Remove an entry when the reason is gone.
const EXCLUDED = new Map([
  [
    'tests/partner-review-pack-qa/tests/pack-domain.test.mjs',
    'rewrites the tracked tests/partner-review-pack-qa/domain-test-evidence.json on every run',
  ],
  [
    'tests/partner-review-pack-qa/tests/pack-static.test.mjs',
    'rewrites the tracked tests/partner-review-pack-qa/static-test-evidence.json on every run',
  ],
]);

const GUARD = 'tests/exact-offering-qa/read-only-routing.test.mjs';
const NODE_FLAGS = ['--experimental-transform-types', '--disable-warning=ExperimentalWarning'];
const REPORTER = ['--test-reporter=spec', '--test-reporter-destination=stdout'];

function run(label, nodeArgs) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(process.execPath, nodeArgs, {
    cwd: root,
    stdio: 'inherit',
    timeout: 15 * 60 * 1000,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function discover() {
  const found = [];
  for (const entry of readdirSync(join(root, 'tests'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.test.mjs')) continue;
    found.push(
      relative(root, join(entry.parentPath ?? entry.path, entry.name))
        .split(sep)
        .join('/'),
    );
  }
  return found.sort();
}

let failures = 0;

if (!noBuild) {
  for (const builder of BUILDERS) {
    if (!existsSync(builder)) {
      console.error(`builder missing: ${builder}`);
      failures++;
      continue;
    }
    if (run(`node ${builder}`, [builder]) !== 0) {
      console.error(`builder failed: ${builder}`);
      failures++;
    }
  }
  if (failures) {
    console.error(`\n${failures} builder(s) failed; not running the suites.`);
    process.exit(1);
  }
}

const all = discover();
const suites = all.filter(
  (f) => f !== GUARD && !EXCLUDED.has(f) && (filters.length === 0 || filters.some((w) => f.includes(w))),
);
for (const [file, reason] of EXCLUDED) if (all.includes(file)) console.log(`excluded: ${file} (${reason})`);

if (suites.length === 0) {
  console.error('no suite matched the filter');
  process.exit(1);
}
const suiteStatus = run(`node --test on ${suites.length} suite file(s)`, [
  ...NODE_FLAGS,
  '--test',
  ...REPORTER,
  ...suites,
]);
const guardStatus = run(`node --test ${GUARD} (read-only routing guard)`, [
  ...NODE_FLAGS,
  '--test',
  ...REPORTER,
  GUARD,
]);

if (suiteStatus !== 0 || guardStatus !== 0) {
  console.error(`\nFAILED: suites exit ${suiteStatus}, guard exit ${guardStatus}`);
  process.exit(1);
}
console.log(`\nOK: ${suites.length} suite file(s) and the guard suite passed.`);
