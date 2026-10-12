// ACA-US-1.4: rules of email one-time-code sign-in (owner decision 12 Oct 2026, "Standard"), tested against
// the real SQLite adapter and migrations with a fake clock. Synthetic addresses only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readdirSync, readFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), out = join(root, '.sites-runtime/email-otp');
mkdirSync(out, {recursive: true});
await build({stdin: {contents: "export * from './lib/auth/email-otp';export {openDatabase,applyMigrations} from './lib/sqlite-d1';", resolveDir: root, loader: 'ts'},
  bundle: true, platform: 'node', format: 'esm', outfile: join(out, 'model.mjs'), logLevel: 'warning'});
process.env.ACADEMY_AUTH_SECRET = 'test-secret-'.padEnd(48, 'x');
const M = await import(join(out, 'model.mjs'));
const migrations = readdirSync(join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort().map(f => readFileSync(join(root, 'drizzle', f), 'utf8'));
const MIN = 60_000, DAY = 86_400_000, T0 = Date.parse('2026-11-02T04:00:00Z');

function setup() {
  const db = M.openDatabase(':memory:'); M.applyMigrations(db, migrations);
  const mails = []; const send = async (to, subject, body) => { mails.push({to, subject, body}); };
  const lastCode = () => mails.at(-1).body.match(/\b(\d{6})\b/)[1];
  return {db, mails, send, lastCode};
}
const rejects = (p, status) => assert.rejects(p, e => e instanceof M.SignInError && e.status === status);

test('a code signs in once, creates the user, and stores no plain code', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, '  Learner@Example.test ', send, T0);
  const code = lastCode();
  const s = await M.verifyCode(db, 'learner@example.test', code, T0 + MIN);
  assert.match(s.token, /^[A-Za-z0-9_-]{43}$/); assert.equal(s.maxAgeSeconds, 30 * 86400);
  assert.equal((await M.sessionUser(db, s.token, T0 + 2 * MIN)).email, 'learner@example.test');
  await rejects(M.verifyCode(db, 'learner@example.test', code, T0 + 2 * MIN), 401); // single use
  const stored = JSON.stringify((await db.prepare('SELECT * FROM academy_login_codes').all()).results);
  assert.ok(!stored.includes(code) && !stored.includes('learner@example.test'));
  const sessions = JSON.stringify((await db.prepare('SELECT * FROM academy_sessions').all()).results);
  assert.ok(!sessions.includes(s.token));
});

test('the same user returns on the next sign-in', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, 'a@example.test', send, T0); const one = await M.verifyCode(db, 'a@example.test', lastCode(), T0);
  await M.requestCode(db, 'A@EXAMPLE.TEST', send, T0 + DAY); const two = await M.verifyCode(db, 'a@example.test', lastCode(), T0 + DAY);
  assert.equal(one.userId, two.userId);
});

test('a code expires after 10 minutes', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, 'b@example.test', send, T0);
  await rejects(M.verifyCode(db, 'b@example.test', lastCode(), T0 + 10 * MIN + 1), 401);
});

test('5 wrong codes lock the email for 15 minutes, even with the right code', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, 'c@example.test', send, T0); const good = lastCode(), bad = good === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) await rejects(M.verifyCode(db, 'c@example.test', bad, T0 + i * 1000), 401);
  await rejects(M.verifyCode(db, 'c@example.test', bad, T0 + 5000), 429);
  await rejects(M.verifyCode(db, 'c@example.test', good, T0 + 6000), 429);
  await rejects(M.requestCode(db, 'c@example.test', send, T0 + 7000), 429);
  await M.requestCode(db, 'c@example.test', send, T0 + 16 * MIN);
  assert.ok(await M.verifyCode(db, 'c@example.test', lastCode(), T0 + 16 * MIN + 1000));
});

test('at most 3 codes per email in 15 minutes', async () => {
  const {db, send} = setup();
  for (let i = 0; i < 3; i++) await M.requestCode(db, 'd@example.test', send, T0 + i * MIN);
  await rejects(M.requestCode(db, 'd@example.test', send, T0 + 3 * MIN), 429);
  await M.requestCode(db, 'd@example.test', send, T0 + 16 * MIN);
});

test('sessions end after 7 idle days, after 30 days, and on sign-out', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, 'e@example.test', send, T0); const s = await M.verifyCode(db, 'e@example.test', lastCode(), T0);
  assert.ok(await M.sessionUser(db, s.token, T0 + 6 * DAY));            // used on day 6
  assert.ok(await M.sessionUser(db, s.token, T0 + 12 * DAY));           // 6 idle days later: still valid
  assert.equal(await M.sessionUser(db, s.token, T0 + 19 * DAY + MIN), null); // 7 idle days: ended
  await M.requestCode(db, 'e@example.test', send, T0 + 20 * DAY); const t = await M.verifyCode(db, 'e@example.test', lastCode(), T0 + 20 * DAY);
  for (let d = 26; d < 50; d += 6) await M.sessionUser(db, t.token, T0 + d * DAY);
  assert.equal(await M.sessionUser(db, t.token, T0 + 50 * DAY + MIN), null); // 30-day cap
  await M.requestCode(db, 'e@example.test', send, T0 + 60 * DAY); const u = await M.verifyCode(db, 'e@example.test', lastCode(), T0 + 60 * DAY);
  await M.endSession(db, u.token, T0 + 60 * DAY + MIN);
  assert.equal(await M.sessionUser(db, u.token, T0 + 60 * DAY + 2 * MIN), null);
});

test('requests do not reveal whether an email has an account; malformed input is refused', async () => {
  const {db, send, lastCode} = setup();
  await M.requestCode(db, 'known@example.test', send, T0); await M.verifyCode(db, 'known@example.test', lastCode(), T0);
  assert.deepEqual(await M.requestCode(db, 'known@example.test', send, T0 + DAY), await M.requestCode(db, 'new@example.test', send, T0 + DAY));
  await rejects(M.requestCode(db, 'not-an-email', send, T0), 400);
  assert.equal(await M.sessionUser(db, 'short', T0), null);
});

test('sign-in refuses to run without a server secret', async () => {
  const {db, send} = setup(); const saved = process.env.ACADEMY_AUTH_SECRET; delete process.env.ACADEMY_AUTH_SECRET;
  try { await rejects(M.requestCode(db, 'f@example.test', send, T0), 503); } finally { process.env.ACADEMY_AUTH_SECRET = saved; }
});

test('an email that fails to send does not use up the code limit', async () => {
  const {db, send} = setup(); const failing = async () => { throw new M.SignInError('We could not send the email. Please try again in a minute.', 503); };
  for (let i = 0; i < 4; i++) await rejects(M.requestCode(db, 'g@example.test', failing, T0 + i * 1000), 503);
  for (let i = 0; i < 3; i++) await M.requestCode(db, 'g@example.test', send, T0 + 10_000 + i * 1000);
});
