// ACA-US-1.4: email one-time-code sign-in. Rules are the owner's decision of 12 October 2026 ("Standard"):
// a code is valid for 10 minutes; 5 wrong codes lock the email for 15 minutes; at most 3 codes per email in
// 15 minutes; a session lasts 30 days and ends after 7 days without use.
// Stored data: emails as an HMAC (plus the address on the user row, needed to send codes), codes as an HMAC,
// session tokens as SHA-256. The plain code exists only in the email.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const RULES = {
  codeMinutes: 10,
  maxFailures: 5,
  lockMinutes: 15,
  maxCodes: 3,
  codeWindowMinutes: 15,
  sessionDays: 30,
  idleDays: 7,
} as const;

type Db = D1Database;
export type MailSender = (to: string, subject: string, body: string) => Promise<void>;
export class SignInError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

const MIN = 60_000,
  DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function secret(): string {
  const s = process.env.ACADEMY_AUTH_SECRET;
  if (!s || s.length < 32) throw new SignInError('Sign-in is not set up on this server.', 503);
  return s;
}
const keyed = (kind: string, value: string) =>
  createHmac('sha256', secret())
    .update(kind + '|' + value)
    .digest('hex');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function normaliseEmail(input: unknown): string {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new SignInError('Enter a valid email address.');
  return email;
}

async function lockState(db: Db, emailHash: string, now: number) {
  const row = await db
    .prepare('SELECT failures, window_started_at, locked_until FROM academy_login_locks WHERE email_hash=?')
    .bind(emailHash)
    .first<{ failures: number; window_started_at: string; locked_until: string | null }>();
  return { row, locked: !!row?.locked_until && Date.parse(row.locked_until) > now };
}

/** Step 1: send a code. The answer never reveals whether the email has an account. */
export async function requestCode(db: Db, emailInput: unknown, send: MailSender, now = Date.now()) {
  const email = normaliseEmail(emailInput),
    emailHash = keyed('email', email);
  if ((await lockState(db, emailHash, now)).locked)
    throw new SignInError(`Too many wrong codes. Try again in ${RULES.lockMinutes} minutes.`, 429);
  const recent = await db
    .prepare('SELECT count(*) AS n FROM academy_login_codes WHERE email_hash=? AND created_at>?')
    .bind(emailHash, iso(now - RULES.codeWindowMinutes * MIN))
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= RULES.maxCodes)
    throw new SignInError(`Too many codes requested. Try again in ${RULES.codeWindowMinutes} minutes.`, 429);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const row = await db
    .prepare('INSERT INTO academy_login_codes(email_hash,code_hash,created_at,expires_at) VALUES(?,?,?,?)')
    .bind(emailHash, keyed('code', emailHash + '|' + code), iso(now), iso(now + RULES.codeMinutes * MIN))
    .run();
  try {
    await send(
      email,
      'Your Aplyd Academy sign-in code',
      `Your sign-in code is ${code}. It works for ${RULES.codeMinutes} minutes.\n\nIf you did not ask for this code, you can ignore this email.`,
    );
  } catch (e) {
    // an unsent code must not count against the learner's limit
    await db.prepare('DELETE FROM academy_login_codes WHERE id=?').bind(row.meta.last_row_id).run();
    throw e;
  }
  return { sent: true };
}

async function recordFailure(db: Db, emailHash: string, now: number) {
  const { row } = await lockState(db, emailHash, now);
  const windowExpired = !row || Date.parse(row.window_started_at) < now - RULES.lockMinutes * MIN;
  const failures = (windowExpired ? 0 : row!.failures) + 1;
  const lockedUntil = failures >= RULES.maxFailures ? iso(now + RULES.lockMinutes * MIN) : null;
  await db
    .prepare(
      'INSERT INTO academy_login_locks(email_hash,failures,window_started_at,locked_until) VALUES(?,?,?,?) ' +
        'ON CONFLICT(email_hash) DO UPDATE SET failures=excluded.failures, window_started_at=excluded.window_started_at, locked_until=excluded.locked_until',
    )
    .bind(emailHash, failures, windowExpired ? iso(now) : row!.window_started_at, lockedUntil)
    .run();
  return lockedUntil;
}

/** Step 2: check the code; on success create the user if new and return a session token for the cookie. */
export async function verifyCode(db: Db, emailInput: unknown, codeInput: unknown, now = Date.now()) {
  const email = normaliseEmail(emailInput),
    emailHash = keyed('email', email);
  const code = typeof codeInput === 'string' ? codeInput.replace(/\s/g, '') : '';
  if ((await lockState(db, emailHash, now)).locked)
    throw new SignInError(`Too many wrong codes. Try again in ${RULES.lockMinutes} minutes.`, 429);
  const candidates = await db
    .prepare(
      'SELECT id, code_hash FROM academy_login_codes WHERE email_hash=? AND used_at IS NULL AND expires_at>? ORDER BY id DESC LIMIT ?',
    )
    .bind(emailHash, iso(now), RULES.maxCodes)
    .all<{ id: number; code_hash: string }>();
  const want = Buffer.from(keyed('code', emailHash + '|' + code), 'hex');
  const match = /^\d{6}$/.test(code)
    ? candidates.results.find((c) => timingSafeEqual(Buffer.from(c.code_hash, 'hex'), want))
    : undefined;
  if (!match) {
    const lockedUntil = await recordFailure(db, emailHash, now);
    throw new SignInError(
      lockedUntil
        ? `Too many wrong codes. Try again in ${RULES.lockMinutes} minutes.`
        : 'That code is wrong or has expired.',
      lockedUntil ? 429 : 401,
    );
  }
  const used = await db
    .prepare('UPDATE academy_login_codes SET used_at=? WHERE id=? AND used_at IS NULL')
    .bind(iso(now), match.id)
    .run();
  if (used.meta.changes !== 1) throw new SignInError('That code is wrong or has expired.', 401);
  await db.prepare('DELETE FROM academy_login_locks WHERE email_hash=?').bind(emailHash).run();
  await db
    .prepare('INSERT OR IGNORE INTO academy_users(id,email_hash,email,created_at) VALUES(?,?,?,?)')
    .bind('u-' + crypto.randomUUID(), emailHash, email, iso(now))
    .run();
  const user = await db
    .prepare('SELECT id, email FROM academy_users WHERE email_hash=?')
    .bind(emailHash)
    .first<{ id: string; email: string }>();
  const token = randomBytes(32).toString('base64url');
  await db
    .prepare(
      'INSERT INTO academy_sessions(token_hash,user_id,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?)',
    )
    .bind(sha256(token), user!.id, iso(now), iso(now), iso(now + RULES.sessionDays * DAY))
    .run();
  return { token, userId: user!.id, maxAgeSeconds: RULES.sessionDays * 86_400 };
}

/** Resolve a session cookie to its user; ends sessions that expired or were idle for 7 days. */
export async function sessionUser(db: Db, token: string | undefined, now = Date.now()) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await db
    .prepare(
      'SELECT s.user_id, s.last_seen_at, s.expires_at, s.revoked_at, u.email FROM academy_sessions s JOIN academy_users u ON u.id=s.user_id WHERE s.token_hash=?',
    )
    .bind(sha256(token))
    .first<{
      user_id: string;
      last_seen_at: string;
      expires_at: string;
      revoked_at: string | null;
      email: string;
    }>();
  if (
    !row ||
    row.revoked_at ||
    Date.parse(row.expires_at) <= now ||
    Date.parse(row.last_seen_at) <= now - RULES.idleDays * DAY
  )
    return null;
  if (Date.parse(row.last_seen_at) < now - 5 * MIN)
    // touch at most every 5 minutes
    await db
      .prepare('UPDATE academy_sessions SET last_seen_at=? WHERE token_hash=?')
      .bind(iso(now), sha256(token))
      .run();
  return { userId: row.user_id, email: row.email };
}

export async function endSession(db: Db, token: string | undefined, now = Date.now()) {
  if (!token) return;
  await db
    .prepare('UPDATE academy_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
    .bind(iso(now), sha256(token))
    .run();
}
