// Database snapshot and restore for release.sh, run as the academy user through deploy/node/academy-admin.sh (the
// deploy user cannot open /var/lib/academy). Snapshots live beside the database, in <db folder>/snapshots.
// Usage: ACADEMY_DATABASE_PATH=... node scripts/db-snapshot.mjs save|restore|prune <name>|<keep>
//   save <name>     write a consistent copy (VACUUM INTO) as snapshots/<name>.sqlite; prints "none" if no database yet
//   restore <name>  put snapshots/<name>.sqlite back in place of the database (WAL files removed)
//   prune <keep>    keep only the newest <keep> snapshots
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const db = process.env.ACADEMY_DATABASE_PATH;
const [cmd, arg] = process.argv.slice(2);
if (!db || !cmd) {
  console.error('Set ACADEMY_DATABASE_PATH; usage: db-snapshot.mjs save|restore <name> | prune <keep>');
  process.exit(2);
}
const dir = join(dirname(db), 'snapshots');
const named = (n) => {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(n ?? '')) {
    console.error('invalid snapshot name');
    process.exit(2);
  }
  return join(dir, `${n}.sqlite`);
};

if (cmd === 'save') {
  const out = named(arg);
  if (!existsSync(db)) {
    console.log('none');
    process.exit(0);
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  rmSync(out, { force: true });
  const d = new DatabaseSync(db);
  d.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  d.close();
  console.log(out);
} else if (cmd === 'restore') {
  const src = named(arg);
  if (!existsSync(src)) {
    console.log('no snapshot to restore');
    process.exit(0);
  }
  copyFileSync(src, `${db}.restore`);
  rmSync(`${db}-wal`, { force: true });
  rmSync(`${db}-shm`, { force: true });
  renameSync(`${db}.restore`, db);
  console.log(`restored ${src}`);
} else if (cmd === 'prune') {
  const keep = Number(arg);
  if (!Number.isInteger(keep) || keep < 1) {
    console.error('keep must be a positive integer');
    process.exit(2);
  }
  if (!existsSync(dir)) process.exit(0);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const f of files.slice(keep)) rmSync(f, { force: true });
} else {
  console.error('unknown command');
  process.exit(2);
}
