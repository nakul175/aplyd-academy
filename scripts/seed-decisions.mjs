// Record the owner decisions of 13 October 2026 and the notice text they approve, once (ACA-US-2.2, 2.3, 2.6, 5.x, 6.x, 7.x).
// Run by release.sh on every release through deploy/node/academy-admin.sh; safe to repeat:
//   - a decision is inserted only when no decision exists yet for that key and scope, so a later decision recorded
//     by the owner in Operations is never overwritten;
//   - the notice body is inserted only when that version is not stored yet.
// decided_by is "delegated:claude" and the source names the chat in which the owner delegated these values, so the
// audit trail never claims the owner recorded them himself (docs/decisions/owner-decisions-2026-10-13.md).
// Usage: ACADEMY_DATABASE_PATH=/var/lib/academy/academy.sqlite node scripts/seed-decisions.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.env.ACADEMY_DATABASE_PATH;
if (!file) {
  console.error('Set ACADEMY_DATABASE_PATH.');
  process.exit(2);
}
const root = resolve(import.meta.dirname, '..');
const spec = JSON.parse(
  readFileSync(resolve(root, 'docs/decisions/owner-decisions-2026-10-13.json'), 'utf8'),
);
const db = new DatabaseSync(file);
const now = new Date().toISOString();
const has = (table) =>
  db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table) !== undefined;
if (!has('loop_decisions') || !has('loop_notices')) {
  console.error('Practice-loop tables are missing; run migrations first.');
  process.exit(1);
}
const audit = (action, target) =>
  db
    .prepare(
      `INSERT INTO loop_audit(at,actor,org_id,action,target,outcome) VALUES(?, 'delegated:claude', NULL, ?, ?, 'ok')`,
    )
    .run(now, action, target);

let inserted = 0;
db.exec('BEGIN IMMEDIATE');
try {
  if (!db.prepare('SELECT 1 FROM loop_notices WHERE version=?').get(spec.notice.version)) {
    const body = readFileSync(resolve(root, spec.notice.file), 'utf8').split('\n---\n').pop().trim();
    db.prepare('INSERT INTO loop_notices(version,body,created_at) VALUES(?,?,?)').run(
      spec.notice.version,
      body,
      now,
    );
    audit('notice.store', spec.notice.version);
    inserted++;
  }
  const exists = db.prepare('SELECT 1 FROM loop_decisions WHERE key=? AND scope=? LIMIT 1');
  const insert = db.prepare(
    'INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)',
  );
  for (const d of spec.decisions) {
    if (exists.get(d.key, d.scope)) continue;
    insert.run(d.key, d.scope, JSON.stringify(d.value), 'delegated:claude', now, spec.source);
    audit('decision.record', `${d.key}@${d.scope}`);
    inserted++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
console.log(`seed-decisions: ${inserted} record(s) inserted, ${spec.decisions.length} decision(s) checked.`);
