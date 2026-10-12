// D1-compatible database over Node's built-in SQLite (ADR-0001, Option A).
// Implements the D1 surface the v0.17 code uses: prepare().bind().first()/all()/run()/raw(), batch() and exec().
// batch() is one transaction, like D1: every statement commits or none does. SQLite's changes() therefore
// sees the previous statement of the same batch, which the v0.17 "INSERT ... WHERE changes()=1" guards rely on.
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';

export type D1Like = D1Database;
type Row = Record<string, unknown>;
type Result = {success: true; results: Row[]; meta: {changes: number; last_row_id: number}};

const returnsRows = (sql: string) => /^\s*(select|with|pragma)\b/i.test(sql) || /\breturning\b/i.test(sql);

class Statement {
  constructor(private readonly db: DatabaseSync, readonly sql: string, private readonly params: SQLInputValue[] = []) {}
  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params.map(p => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p)) as SQLInputValue[]);
  }
  execute(): Result {
    const stmt = this.db.prepare(this.sql);
    if (returnsRows(this.sql)) {
      const before = this.totalChanges();
      const results = stmt.all(...this.params).map(r => ({...r}));
      return {success: true, results, meta: {changes: this.totalChanges() - before, last_row_id: 0}};
    }
    const info = stmt.run(...this.params);
    return {success: true, results: [], meta: {changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid)}};
  }
  private totalChanges() { return Number((this.db.prepare('SELECT total_changes() AS n').get() as Row).n); }
  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Row | undefined;
    if (!row) return null;
    return (column ? (row[column] ?? null) : {...row}) as T;
  }
  async all<T = Row>() { const r = this.execute(); return {...r, results: r.results as T[]}; }
  async run() { return this.execute(); }
  async raw<T = unknown[]>() { return this.execute().results.map(r => Object.values(r)) as T[]; }
}

class SqliteD1 {
  constructor(readonly db: DatabaseSync) {}
  prepare(sql: string) { return new Statement(this.db, sql); }
  async batch(statements: Statement[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = statements.map(s => s.execute());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql: string) { this.db.exec(sql); return {count: 1, duration: 0}; }
}

export function openDatabase(file: string): D1Like {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;');
  return new SqliteD1(db) as unknown as D1Like;
}

/** Apply drizzle migration files (contents, in order) to a database opened with openDatabase. */
export function applyMigrations(d1: D1Like, files: string[]) {
  const db = (d1 as unknown as SqliteD1).db;
  for (const sql of files) for (const part of sql.split('--> statement-breakpoint')) if (part.trim()) db.exec(part);
}
