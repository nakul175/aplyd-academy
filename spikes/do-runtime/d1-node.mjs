// Spike for ACA-US-1.1 (not production code): a Cloudflare D1-compatible database object backed by
// Node's built-in SQLite (node:sqlite), so the v0.17 route code can run unchanged on a Node server.
// Covers the D1 surface the v0.17 code uses: prepare().bind().first()/all()/run(), batch() and exec().
import { DatabaseSync } from 'node:sqlite';

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }
  _stmt() {
    return this.db.prepare(this.sql);
  }
  _first() {
    const row = this._stmt().get(...this.params);
    return row === undefined ? null : { ...row };
  }
  _all() {
    return this._stmt()
      .all(...this.params)
      .map((r) => ({ ...r }));
  }
  _run() {
    const info = this._stmt().run(...this.params);
    return {
      success: true,
      results: [],
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    };
  }
  async first(column) {
    const row = this._first();
    return column ? (row ? row[column] : null) : row;
  }
  async all() {
    return { success: true, results: this._all(), meta: {} };
  }
  async run() {
    return this._run();
  }
  async raw() {
    return this._all().map((r) => Object.values(r));
  }
}

export class D1Node {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  }
  prepare(sql) {
    return new Statement(this.db, sql);
  }
  // D1 runs a batch as one transaction: all statements commit or none do.
  async batch(statements) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = statements.map((s) =>
        /^\s*select/i.test(s.sql) ? { success: true, results: s._all(), meta: {} } : s._run(),
      );
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql) {
    this.db.exec(sql);
    return { count: 1, duration: 0 };
  }
  close() {
    this.db.close();
  }
}

/** Apply the repository's drizzle migrations in file order. */
export function migrate(d1, files) {
  for (const sql of files)
    for (const part of sql.split('--> statement-breakpoint')) if (part.trim()) d1.db.exec(part);
}
