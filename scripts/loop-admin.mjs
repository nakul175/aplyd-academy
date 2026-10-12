// Server-side bootstrap for the practice loop, run by someone with shell access to the Academy server.
// Usage (ACADEMY_DATABASE_PATH must point at the live database):
//   node scripts/loop-admin.mjs grant <email> owner|operator   person must have signed in once; granted_by = "server shell"
//   node scripts/loop-admin.mjs revoke <email>
//   node scripts/loop-admin.mjs notice <version> <file.md>     stores a notice text version (approval is a separate owner decision)
//   node scripts/loop-admin.mjs list-operators
// Never pass learner data on the command line. Every change is written to loop_audit with actor "server-shell".
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const file = process.env.ACADEMY_DATABASE_PATH;
if (!file) { console.error('Set ACADEMY_DATABASE_PATH.'); process.exit(2); }
const db = new DatabaseSync(file), now = new Date().toISOString(), [cmd, a, b] = process.argv.slice(2);
const auditRow = (action, target) => db.prepare(`INSERT INTO loop_audit(at,actor,org_id,action,target,outcome) VALUES(?, 'server-shell', NULL, ?, ?, 'ok')`).run(now, action, target);
const userId = email => db.prepare('SELECT id FROM academy_users WHERE email=?').get(String(email ?? '').trim().toLowerCase())?.id;
if (cmd === 'grant') {
  if (!['owner', 'operator'].includes(b)) { console.error('Role must be owner or operator.'); process.exit(2); }
  const id = userId(a); if (!id) { console.error('No account with that email. Ask them to sign in once first.'); process.exit(1); }
  if (b === 'owner' && db.prepare(`SELECT count(*) n FROM loop_operators WHERE role='owner' AND user_id!=?`).get(id).n > 0) { console.error('An owner already exists. Revoke them first if ownership has changed.'); process.exit(1); }
  db.prepare(`INSERT INTO loop_operators(user_id,role,granted_by,granted_at) VALUES(?,?, 'server-shell', ?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role, granted_at=excluded.granted_at`).run(id, b, now);
  auditRow('operator.grant_' + b, id); console.log(`Granted ${b}.`);
} else if (cmd === 'revoke') {
  const id = userId(a); if (!id) { console.error('No account with that email.'); process.exit(1); }
  db.prepare('DELETE FROM loop_operators WHERE user_id=?').run(id); auditRow('operator.revoke', id); console.log('Revoked.');
} else if (cmd === 'notice') {
  if (!a || !b) { console.error('Usage: notice <version> <file.md>'); process.exit(2); }
  const body = readFileSync(b, 'utf8').split('\n---\n').pop().trim();
  db.prepare('INSERT INTO loop_notices(version,body,created_at) VALUES(?,?,?)').run(a, body, now); auditRow('notice.store', a);
  console.log(`Stored notice ${a} (${body.length} characters). It is shown only after the owner records notice.approved = {"version":"${a}"}.`);
} else if (cmd === 'list-operators') {
  for (const r of db.prepare('SELECT u.email, o.role, o.granted_at FROM loop_operators o JOIN academy_users u ON u.id=o.user_id ORDER BY o.role').all()) console.log(`${r.role}\t${r.email}\t${r.granted_at}`);
} else { console.error('Commands: grant, revoke, notice, list-operators'); process.exit(2); }
