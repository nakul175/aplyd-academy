/** Minimal D1 stand-in over node:sqlite (Node 22+). Applies every drizzle/0*.sql migration in order, exactly as scripts/demo/run-demo.sh does. */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const migrationFiles = () =>
  readdirSync(root + '/drizzle')
    .filter((f) => /^0\d+_.*\.sql$/.test(f))
    .sort();
export function applyMigrations(sqlite, upTo) {
  for (const f of migrationFiles()) {
    if (upTo && f > upTo) break;
    sqlite.exec(readFileSync(root + '/drizzle/' + f, 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
}
const returns = (sql) => /^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
class Statement {
  constructor(db, sql, binds = []) {
    this.db = db;
    this.sql = sql;
    this.binds = binds;
  }
  bind(...b) {
    return new Statement(this.db, this.sql, b);
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.binds) ?? null;
  }
  async all() {
    return this.exec();
  }
  async run() {
    return this.exec();
  }
  exec() {
    const s = this.db.prepare(this.sql);
    if (returns(this.sql)) {
      const results = s.all(...this.binds);
      return {
        results,
        meta: {
          changes:
            results.length && /^\s*(UPDATE|INSERT|DELETE)/i.test(this.sql)
              ? results.length
              : Number(this.db.prepare('SELECT changes() c').get().c),
        },
      };
    }
    const r = s.run(...this.binds);
    return { results: [], meta: { changes: Number(r.changes) } };
  }
}
export function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite);
  return {
    sqlite,
    prepare: (sql) => new Statement(sqlite, sql),
    async batch(list) {
      sqlite.exec('BEGIN');
      try {
        const out = list.map((s) => s.exec());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
