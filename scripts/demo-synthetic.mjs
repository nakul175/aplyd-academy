// ACA-US-16.1: a demonstration database with a fictional association and synthetic learners only, for university
// and partner conversations. Never contains real people. Usage:
//   node scripts/demo-synthetic.mjs /tmp/academy-demo.sqlite
//   ACADEMY_DATABASE_PATH=/tmp/academy-demo.sqlite ACADEMY_MAIL_TRANSPORT=outbox ACADEMY_AUTH_SECRET=<32+ chars> npm start
// Sign in as owner@demo.example.test (the code appears in academy_mail_outbox; outbox is refused in production).
import {build} from 'esbuild';
import {readdirSync, readFileSync, existsSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..'), file = process.argv[2];
if (!file) { console.error('Usage: node scripts/demo-synthetic.mjs <new-database-file>'); process.exit(2); }
if (existsSync(file)) { console.error('Refusing to touch an existing file. Give a new path.'); process.exit(2); }
if (process.env.ACADEMY_ENVIRONMENT === 'production') { console.error('Not in production.'); process.exit(2); }
const out = join(root, '.sites-runtime/demo'); mkdirSync(out, {recursive: true});
await build({stdin: {contents: "export * from './lib/loop/index';export {openDatabase,applyMigrations} from './lib/sqlite-d1';", resolveDir: root, loader: 'ts'}, bundle: true, platform: 'node', format: 'esm', outfile: join(out, 'loop.mjs'), logLevel: 'warning', alias: {'@': root}});
const L = await import(join(out, 'loop.mjs'));
const db = L.openDatabase(file);
L.applyMigrations(db, readdirSync(join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort().map(f => readFileSync(join(root, 'drizzle', f), 'utf8')));
const DAY = 86_400_000, start = Date.now() - 56 * DAY, iso = t => new Date(t).toISOString();
const mails = []; const send = async (to, subject, body) => mails.push({to, body});
const user = async e => { const id = 'u-' + e.split('@')[0]; await db.prepare('INSERT OR IGNORE INTO academy_users(id,email_hash,email,created_at) VALUES(?,?,?,?)').bind(id, 'demo-' + e, e, iso(start)).run(); return {userId: id, email: e}; };
const tok = e => mails.filter(m => m.to === e).at(-1).body.match(/\/loop\/join\/([A-Za-z0-9_-]{43})/)[1];
const owner = await user('owner@demo.example.test');
await db.prepare(`INSERT INTO loop_operators VALUES(?, 'owner', 'demo', ?)`).bind(owner.userId, iso(start)).run();
await db.prepare('INSERT INTO loop_notices VALUES(?,?,?)').bind('demo-notice', 'DEMO NOTICE (fictional). This demonstration uses invented people only.', iso(start)).run();
const D = (k, v, s = 'global') => L.recordDecision(db, owner, k, s, v, 'Demonstration values, not owner decisions', start - DAY);
await D('notice.approved', {version: 'demo-notice'});
await D('placement.instrument', JSON.parse(readFileSync(join(root, 'docs/product/placement-instrument-draft.json'), 'utf8')));
await D('metrics.min_group_size', {size: 3}); await D('followup.inactive_weeks', {weeks: 2}); await D('access.notice_days', {days: 30});
const {id: orgId} = await L.createOrg(db, owner, {kind: 'association', name: 'Demo Weavers Association (fictional)', sector: 'textile'}, start);
await L.inviteStaff(db, owner, orgId, {email: 'admin@demo.example.test', name: 'Demo Admin', role: 'admin'}, send, 'http://localhost', start);
const admin = await user('admin@demo.example.test'); await L.acceptInvite(db, admin, tok(admin.email), {}, start);
await L.inviteStaff(db, admin, orgId, {email: 'expert@demo.example.test', name: 'Demo Expert', role: 'expert'}, send, 'http://localhost', start);
const expert = await user('expert@demo.example.test'); await L.acceptInvite(db, expert, tok(expert.email), {}, start);
const {id: cohortId} = await L.createCohort(db, admin, orgId, {name: 'Demo cohort', workshopDate: iso(start).slice(0, 10)}, start);
const {id: packId} = await L.createPack(db, owner, {sector: 'textile', title: 'Demo textile pack'}, start);
await L.assignReviewer(db, owner, packId, {email: expert.email}, start);
const src = [{title: 'Fictional demo source', url: 'https://example.org/demo'}];
const {ids} = await L.addDraftItems(db, owner, packId, [
  {kind: 'task', jobRole: '*', level: '*', title: 'Check a supplier bill with AI', body: 'Use AI to check one supplier bill for wrong totals.', sources: src},
  {kind: 'task', jobRole: '*', level: '*', title: 'Summarise a buyer message', body: 'Use AI to turn one buyer message into a list of actions.', sources: src},
  {kind: 'rule', jobRole: '*', level: '*', title: 'Re-add totals yourself', body: 'Always re-add any total an AI gives you.', sources: src}], {now: start});
for (const i of ids) await L.reviewItem(db, expert, i, {decision: 'approve'}, start);
await L.publishVersion(db, expert, packId, {now: start}); await L.attachPackToCohort(db, owner, cohortId, packId, start);
const names = ['Asha', 'Ravi', 'Meena', 'Imran', 'Kavita', 'Suresh', 'Lata', 'Farhan', 'Divya', 'Gopal', 'Nisha', 'Arjun', 'Pooja', 'Vikram', 'Sana', 'Rahul', 'Anita', 'Joseph', 'Rekha', 'Manoj'];
await L.enrolCohort(db, admin, cohortId, {list: names.map((n, i) => `${n} Demo,${n.toLowerCase()}@demo.example.test,${i % 2 ? 'merchandiser' : 'accountant'}`).join('\n')}, send, 'http://localhost', start);
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
for (const [i, n] of names.entries()) {
  const u = await user(`${n.toLowerCase()}@demo.example.test`);
  const {memberId} = await L.acceptInvite(db, u, tok(u.email), {adult: true, consents: {core: true, reminder_email: true, share_examples: i % 3 === 0}}, start);
  await L.submitPlacement(db, u, memberId, {use: ['never', 'month', 'week', 'day'][i % 4], tasks: ['none', 'write', 'data', 'process'][i % 4], check: ['use', 'sometimes', 'always'][i % 3], prompt: ['stop', 'retry', 'context'][i % 3], private: ['no', 'sometimes', 'yes'][i % 3]}, start);
  const keen = rnd();
  for (let w = 1; w <= 7; w++) if (rnd() < keen) { const t = await L.ensureWeeklyTask(db, u, memberId, start + w * 7 * DAY + 3600_000); if (t.state === 'ready') await L.submitTask(db, u, t.taskId, {note: `Demo note week ${w}`, ...(rnd() < 0.6 ? {link: 'https://example.org/demo-artefact'} : {})}, start + w * 7 * DAY + 7200_000); }
}
console.log(JSON.stringify({database: file, organisation: 'Demo Weavers Association (fictional)', learners: names.length, signInAs: owner.email}));
