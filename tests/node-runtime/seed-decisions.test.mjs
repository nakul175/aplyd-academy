// scripts/seed-decisions.mjs: the 13 October 2026 decisions and notice v1.0 are inserted once into a fresh database,
// never twice, and never over a decision that already exists for the same key and scope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '../..');
const run = (script, db) =>
  spawnSync(process.execPath, ['--no-warnings', join(root, 'scripts', script)], {
    env: { ...process.env, ACADEMY_DATABASE_PATH: db },
    encoding: 'utf8',
  });

test('seed-decisions inserts each decision and the notice once and keeps an existing decision', () => {
  const db = join(mkdtempSync(join(tmpdir(), 'seed-')), 'academy.sqlite');
  assert.equal(run('migrate.mjs', db).status, 0, 'migrations apply');
  const spec = JSON.parse(readFileSync(join(root, 'docs/decisions/owner-decisions-2026-10-13.json'), 'utf8'));

  // A decision the owner recorded earlier must survive the seed.
  const d = new DatabaseSync(db);
  d.prepare(
    `INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source)
     VALUES('metrics.min_group_size','global','{"size":7}','u-owner','2026-10-12T00:00:00.000Z','owner in Operations')`,
  ).run();

  const first = run('seed-decisions.mjs', db);
  assert.equal(first.status, 0, first.stderr);
  assert.match(
    first.stdout,
    new RegExp(`${spec.decisions.length} record\\(s\\) inserted`),
    'notice + all but the pre-existing decision',
  );

  const second = run('seed-decisions.mjs', db);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /0 record\(s\) inserted/, 'a second run changes nothing');

  const rows = d.prepare('SELECT key, scope, value, decided_by FROM loop_decisions ORDER BY id').all();
  assert.equal(rows.length, spec.decisions.length, 'one row per decision, the owner one included');
  assert.equal(rows.find((r) => r.key === 'metrics.min_group_size').value, '{"size":7}', 'owner value kept');
  assert.ok(rows.filter((r) => r.decided_by === 'delegated:claude').length === spec.decisions.length - 1);
  for (const r of rows) assert.ok(r.decided_by !== 'delegated:claude' || JSON.parse(r.value), 'JSON values');

  const notice = d.prepare('SELECT version, body FROM loop_notices').all();
  assert.deepEqual(notice.map((n) => n.version), ['v1.0']);
  assert.match(notice[0].body, /^\*\*How Aplyd Academy uses your data\*\*/, 'body follows the front matter');
  assert.match(notice[0].body, /Notice version: v1\.0$/);
  assert.equal(
    d.prepare(`SELECT count(*) n FROM loop_audit WHERE actor='delegated:claude'`).get().n,
    spec.decisions.length,
    'every insert is audited under the delegated actor',
  );
});
