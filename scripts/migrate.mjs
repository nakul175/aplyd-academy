// Apply drizzle/*.sql migrations to the Academy SQLite database (ADR-0001, Option A).
// Each file is applied once, in name order, inside its own transaction, and recorded with its SHA-256.
// A recorded file whose content has changed stops the run: applied migrations are never edited.
// Usage: ACADEMY_DATABASE_PATH=/path/academy.sqlite node scripts/migrate.mjs
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const file = process.env.ACADEMY_DATABASE_PATH;
if (!file) {
  console.error('Set ACADEMY_DATABASE_PATH.');
  process.exit(2);
}
const dir = resolve(import.meta.dirname, '../drizzle');
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(
  'CREATE TABLE IF NOT EXISTS academy_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)',
);
const applied = new Map(
  db
    .prepare('SELECT name, sha256 FROM academy_migrations')
    .all()
    .map((r) => [r.name, r.sha256]),
);
const done = [];
for (const name of readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  const sql = readFileSync(join(dir, name), 'utf8');
  const sha = createHash('sha256').update(sql).digest('hex');
  if (applied.has(name)) {
    if (applied.get(name) !== sha) {
      console.error(`Applied migration ${name} has changed on disk. Stopping.`);
      process.exit(1);
    }
    continue;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const part of sql.split('--> statement-breakpoint')) if (part.trim()) db.exec(part);
    db.prepare('INSERT INTO academy_migrations (name, sha256, applied_at) VALUES (?, ?, ?)').run(
      name,
      sha,
      new Date().toISOString(),
    );
    db.exec('COMMIT');
    done.push(name);
  } catch (e) {
    db.exec('ROLLBACK');
    console.error(`Migration ${name} failed: ${e.message}`);
    process.exit(1);
  }
}
db.close();
console.log(JSON.stringify({ database: file, applied: done, alreadyApplied: applied.size }));
