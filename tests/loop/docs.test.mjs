// ACA-US-12.4-AC2: the generated data dictionary and API contract match the code in the same change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './harness.mjs';

test('data dictionary and API contract are up to date and every loop table is described', () => {
  const out = execFileSync(
    process.execPath,
    ['--no-warnings', join(root, 'scripts/gen-loop-docs.mjs'), '--check'],
    { encoding: 'utf8' },
  );
  assert.deepEqual(JSON.parse(out).stale, []);
});

test('the standing documentation set exists (S8)', () => {
  const required = [
    'README.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'OWNERS.md',
    'LICENSE',
    'docs/environment.md',
    'docs/architecture/practice-loop.md',
    'docs/decisions/ADR-0001-production-runtime.md',
    'docs/decisions/ADR-0002-practice-loop-module.md',
    'docs/api/practice-loop-api.md',
    'docs/data/data-dictionary-loop.md',
    'docs/operations/runbook-practice-loop.md',
    'docs/operations/slo.md',
    'docs/operations/incident-and-postmortem.md',
    'deploy/node/README.md',
    'docs/testing/test-strategy.md',
    'docs/operations/release-process.md',
    'docs/guides/learner-guide.md',
    'docs/guides/staff-guides.md',
    'docs/sbom.cdx.json',
    'docs/security/threat-model.md',
    'docs/security/access-model.md',
    'docs/security/secrets-register.md',
    'docs/security/findings.md',
    'docs/privacy/notice-draft-v0.1.md',
    'docs/privacy/compliance-mapping.md',
    'docs/accessibility/statement.md',
    'docs/ai/AIA-ACADEMY-01.json',
    'docs/ai/evaluation-set-draft.json',
    'docs/privacy/student-tracker-check.md',
    'docs/research/interview-guide.md',
    'docs/ai/evaluation-set-pharma-draft.json',
    'scripts/demo-synthetic.mjs',
  ];
  const missing = required.filter((f) => !existsSync(join(root, f)));
  assert.deepEqual(missing, []);
});
