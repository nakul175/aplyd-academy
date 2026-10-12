// The practice-loop migrations only add loop_* tables and indexes; they never change or drop v0.17 tables or rows.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './harness.mjs';

test('0010 onwards are additive: CREATE TABLE/INDEX of loop_* objects only', () => {
  const files = readdirSync(join(root, 'drizzle')).filter(f => /^00(1\d|[2-9]\d)_/.test(f) && f.endsWith('.sql'));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const sql = readFileSync(join(root, 'drizzle', f), 'utf8').replace(/^--.*$/gm, '');
    for (const st of sql.split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean)) {
      assert.match(st, /^CREATE (UNIQUE )?(TABLE|INDEX) `(loop_|idx_loop_)/, `${f}: ${st.slice(0, 60)}`);
      assert.ok(!/\b(DROP|ALTER|DELETE|UPDATE)\b/i.test(st), `${f} changes existing data`);
    }
  }
});
