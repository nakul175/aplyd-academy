// Regression test for the acceptance fix: the audit viewer showed recovery / data-request / escalation /
// accommodation / credential-lifecycle actions as "other / learning". Pure; no server needed.
//   node --experimental-transform-types --test tests/demo-browser-qa/audit-types.test.mjs
import { canonicalSource } from '../support/source.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const M = await import(resolve(root, 'lib/academy-audit-detail.ts'));
const NEW = [
  'recovery-request',
  'recovery-withdraw',
  'recovery-decide',
  'data-request-open',
  'data-request-verify',
  'data-request-decide',
  'data-request-restriction',
  'data-request-withdraw',
  'escalate-report',
  'escalation-resolve',
  'accommodation-request',
  'accommodation-decide',
  'credential-issue',
  'credential-lifecycle',
];
test('new action types survive commandType instead of collapsing to other', () => {
  for (const t of NEW) assert.equal(M.commandType(t), t, t);
  assert.equal(M.commandType('definitely-not-a-command'), 'other');
});
test('shared-workspace Studio mounts the staff accommodation decision panel', () => {
  const ui = readFileSync(resolve(root, 'app/academy-teams-ui.tsx'), 'utf8');
  assert.ok(ui.includes('<AccommodationDecisions entries={team.accommodationQueue'));
  assert.ok(ui.includes('value="accommodations"'));
});
test('audit filter selects shrink to their column on phones', () => {
  const ui = readFileSync(resolve(root, 'app/academy-audit.tsx'), 'utf8');
  assert.equal(
    canonicalSource(ui).split(canonicalSource("<select style={{maxWidth:'100%',minWidth:0}}")).length - 1,
    2,
  );
});
test("no server code uses fetch redirect:'error' (workerd throws Invalid redirect value)", () => {
  for (const f of ['lib/academy-partner-dummy-service.ts']) {
    const src = readFileSync(resolve(root, f), 'utf8');
    assert.ok(!/redirect:\s*'error'/.test(src), f);
  }
});
test('partner payload validation accepts a completed learner and still rejects malformed completion', async () => {
  const P = await import(resolve(root, 'lib/academy-partner-dummy.ts'));
  const base = {
    contract: 'aplyd.dummy-partner/1',
    member_code: 'DEMO-AAA001',
    pathway_id: 'msme-customer-operations',
    edition: '0.1-review-draft',
    event_id: 'ev-1234567890abcdef',
    occurred_at: '2026-10-07T10:00:00.000Z',
    scopes: ['completion'],
  };
  P.validatePayload({ ...base, completion: { completed: true, completed_at: '2026-10-06T10:00:00.000Z' } });
  P.validatePayload({ ...base, completion: { completed: false, completed_at: null } });
  assert.throws(() =>
    P.validatePayload({
      ...base,
      completion: { completed: false, completed_at: '2026-10-06T10:00:00.000Z' },
    }),
  );
  assert.throws(() => P.validatePayload({ ...base, completion: { completed: true, completed_at: null } }));
  assert.throws(() => P.validatePayload({ ...base, completion: { completed: 'yes', completed_at: null } }));
});
test('the audit viewer filter offers every new action type', () => {
  const ui = readFileSync(resolve(root, 'app/academy-audit.tsx'), 'utf8');
  for (const t of NEW) assert.ok(ui.includes(`'${t}'`), t);
});
