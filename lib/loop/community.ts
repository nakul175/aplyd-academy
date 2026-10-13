// ACA-E8 community: ACA-US-8.1 level-matched live sessions (invites in the app and on the reminder channel;
// attendance kept as context only, never a success measure) and ACA-US-8.2 a cohort-only follow-up thread per session
// with facilitator moderation (audited).
import {
  type Db,
  type Actor,
  type Member,
  LoopError,
  audit,
  refuse,
  requireRole,
  requireDecision,
  iso,
  newId,
  text,
} from './core';
import { cohortOf } from './enrolment';
import { learnersByLevel } from './levels';
import { channelFor, TEMPLATES, type Senders } from './reminders';

export async function scheduleSession(
  db: Db,
  actor: Actor,
  cohortId: string,
  input: { level?: unknown; title?: unknown; startsAt?: unknown; link?: unknown },
  senders: Senders,
  origin: string,
  now = Date.now(),
) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'session.schedule', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'session.schedule', { now });
  await requireDecision(db, 'sessions.format', cohortId);
  const level = text(input.level, 'Level', 20),
    title = text(input.title, 'Title', 120);
  const startsAt =
    typeof input.startsAt === 'string' && !Number.isNaN(Date.parse(input.startsAt))
      ? new Date(input.startsAt).toISOString()
      : null;
  if (!startsAt) throw new LoopError('Give the start date and time.');
  const link = text(input.link, 'Meeting link', 500);
  if (!/^https:\/\//.test(link)) throw new LoopError('The meeting link must start with https://.');
  const ids = (await learnersByLevel(db, cohortId)).get(level) ?? [];
  const id = newId('ses');
  await db.batch([
    db
      .prepare(
        'INSERT INTO loop_live_sessions(id,cohort_id,level,title,starts_at,link,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(id, cohortId, level, title, startsAt, link, actor.userId, iso(now)),
    ...ids.map((m) =>
      db
        .prepare('INSERT INTO loop_session_invites(session_id,member_id,at) VALUES(?,?,?)')
        .bind(id, m, iso(now)),
    ),
  ]);
  let messaged = 0;
  for (const mid of ids) {
    // the same opt-in channel rules as weekly reminders
    const m = (await db.prepare('SELECT * FROM loop_members WHERE id=?').bind(mid).first<Member>())!;
    const ch = await channelFor(db, m, senders);
    if (!ch) continue;
    try {
      await senders[ch]!({
        channel: ch,
        to: ch === 'email' ? m.email : m.phone!,
        template: 'session-1',
        body: TEMPLATES.session(
          m.name.split(' ')[0],
          startsAt.slice(0, 16).replace('T', ' ') + ' UTC',
          `${origin}/loop/sessions`,
        ),
      });
      await db
        .prepare(
          `INSERT OR IGNORE INTO loop_reminders(member_id,cohort_id,kind,slot,channel,status,at) VALUES(?,?,'session',?,?,'sent',?)`,
        )
        .bind(mid, cohortId, id, ch, iso(now))
        .run();
      messaged++;
    } catch {
      /* failure is visible in the session list as "not messaged" */
    }
  }
  await audit(db, actor.userId, 'session.schedule', { org: c.org_id, target: `${id}:${ids.length}`, now });
  return { id, invited: ids.length, messaged };
}

export async function mySessions(db: Db, actor: Actor, now = Date.now()) {
  return (
    await db
      .prepare(
        `SELECT s.id, s.title, s.starts_at, s.link, s.ended_at, s.level, t.id AS thread_id FROM loop_session_invites i JOIN loop_live_sessions s ON s.id=i.session_id
    JOIN loop_members m ON m.id=i.member_id LEFT JOIN loop_threads t ON t.session_id=s.id WHERE m.user_id=? AND m.status='joined' ORDER BY s.starts_at DESC`,
      )
      .bind(actor.userId)
      .all()
  ).results;
}

/** End a session: record attendance as context only and open the cohort's follow-up thread (ACA-US-8.2-AC1). */
export async function endSession(
  db: Db,
  actor: Actor,
  sessionId: string,
  attendedMemberIds: unknown,
  now = Date.now(),
) {
  const s = await db
    .prepare(
      'SELECT s.*, c.org_id FROM loop_live_sessions s JOIN loop_cohorts c ON c.id=s.cohort_id WHERE s.id=?',
    )
    .bind(sessionId)
    .first<{ id: string; cohort_id: string; org_id: string; title: string; ended_at: string | null }>();
  if (!s) return refuse(db, actor.userId, 'session.end', null, 'You do not have access to this.', now);
  await requireRole(db, actor, s.org_id, ['facilitator'], 'session.end', { now });
  if (s.ended_at) throw new LoopError('This session has already ended.', 409);
  const attended = new Set(
    Array.isArray(attendedMemberIds) ? attendedMemberIds.filter((x) => typeof x === 'string') : [],
  );
  const invited = (
    await db
      .prepare('SELECT member_id FROM loop_session_invites WHERE session_id=?')
      .bind(sessionId)
      .all<{ member_id: string }>()
  ).results;
  const threadId = newId('thr');
  await db.batch([
    db.prepare('UPDATE loop_live_sessions SET ended_at=? WHERE id=?').bind(iso(now), sessionId),
    ...invited.map((i) =>
      db
        .prepare('UPDATE loop_session_invites SET attended=? WHERE session_id=? AND member_id=?')
        .bind(attended.has(i.member_id) ? 1 : 0, sessionId, i.member_id),
    ),
    db
      .prepare('INSERT INTO loop_threads(id,cohort_id,session_id,title,created_at) VALUES(?,?,?,?,?)')
      .bind(threadId, s.cohort_id, sessionId, `After the session: ${s.title}`, iso(now)),
  ]);
  await audit(db, actor.userId, 'session.end', { org: s.org_id, target: sessionId, now });
  return { threadId };
}

/** Only joined members of the thread's cohort (and its facilitators) can read or post. */
async function threadAccess(db: Db, actor: Actor, threadId: string, action: string, now: number) {
  const t = await db
    .prepare('SELECT t.*, c.org_id FROM loop_threads t JOIN loop_cohorts c ON c.id=t.cohort_id WHERE t.id=?')
    .bind(threadId)
    .first<{ id: string; cohort_id: string; org_id: string; title: string }>();
  if (!t) return refuse(db, actor.userId, action, null, 'You do not have access to this.', now);
  const m = await db
    .prepare(
      `SELECT * FROM loop_members WHERE user_id=? AND status='joined' AND (cohort_id=? OR (org_id=? AND role='facilitator'))`,
    )
    .bind(actor.userId, t.cohort_id, t.org_id)
    .first<Member>();
  if (!m) return refuse(db, actor.userId, action, t.org_id, 'This thread is only for its cohort.', now);
  return { t, m };
}

export async function readThread(db: Db, actor: Actor, threadId: string, now = Date.now()) {
  const { t, m } = await threadAccess(db, actor, threadId, 'thread.read', now);
  const posts = (
    await db
      .prepare(
        'SELECT id, author_name, body, at, hidden, reported FROM loop_posts WHERE thread_id=? ORDER BY id',
      )
      .bind(threadId)
      .all<{ id: number; author_name: string; body: string; at: string; hidden: number; reported: number }>()
  ).results;
  const facilitator = m.role === 'facilitator';
  return {
    thread: { id: t.id, title: t.title },
    facilitator,
    posts: posts.map((p) =>
      p.hidden && !facilitator ? { ...p, body: 'This post was hidden by a facilitator.' } : p,
    ),
  };
}
export async function postToThread(db: Db, actor: Actor, threadId: string, body: unknown, now = Date.now()) {
  const { t, m } = await threadAccess(db, actor, threadId, 'thread.post', now);
  await db
    .prepare('INSERT INTO loop_posts(thread_id,member_id,author_name,body,at) VALUES(?,?,?,?,?)')
    .bind(threadId, m.id, m.name.split(' ')[0], text(body, 'Post', 2000), iso(now))
    .run();
  await audit(db, actor.userId, 'thread.post', { org: t.org_id, target: threadId, now });
}
export async function reportPost(db: Db, actor: Actor, postId: number, now = Date.now()) {
  const p = await db
    .prepare('SELECT thread_id FROM loop_posts WHERE id=?')
    .bind(postId)
    .first<{ thread_id: string }>();
  if (!p) throw new LoopError('Post not found.', 404);
  const { t } = await threadAccess(db, actor, p.thread_id, 'thread.report', now);
  await db.prepare('UPDATE loop_posts SET reported=1 WHERE id=?').bind(postId).run();
  await audit(db, actor.userId, 'thread.report', { org: t.org_id, target: String(postId), now });
}
/** ACA-US-8.2-AC2: the facilitator hides a reported post; the action is audited. */
export async function hidePost(db: Db, actor: Actor, postId: number, now = Date.now()) {
  const p = await db
    .prepare('SELECT thread_id FROM loop_posts WHERE id=?')
    .bind(postId)
    .first<{ thread_id: string }>();
  if (!p) throw new LoopError('Post not found.', 404);
  const { t, m } = await threadAccess(db, actor, p.thread_id, 'thread.hide', now);
  if (m.role !== 'facilitator')
    return refuse(db, actor.userId, 'thread.hide', t.org_id, 'Only facilitators can hide posts.', now);
  await db
    .prepare('UPDATE loop_posts SET hidden=1, hidden_by=?, hidden_at=? WHERE id=?')
    .bind(actor.userId, iso(now), postId)
    .run();
  await audit(db, actor.userId, 'thread.hide', { org: t.org_id, target: String(postId), now });
}
export async function cohortThreads(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'thread.list', null, 'You do not have access to this.', now);
  const m = await db
    .prepare(
      `SELECT 1 FROM loop_members WHERE user_id=? AND status='joined' AND (cohort_id=? OR (org_id=? AND role='facilitator'))`,
    )
    .bind(actor.userId, cohortId, c.org_id)
    .first();
  if (!m) return refuse(db, actor.userId, 'thread.list', c.org_id, 'This space is only for its cohort.', now);
  const threads = (
    await db
      .prepare(
        `SELECT t.id, t.title, t.created_at, (SELECT count(*) FROM loop_posts p WHERE p.thread_id=t.id) posts, (SELECT count(*) FROM loop_posts p WHERE p.thread_id=t.id AND p.reported=1 AND p.hidden=0) reported FROM loop_threads t WHERE t.cohort_id=? ORDER BY t.created_at DESC`,
      )
      .bind(cohortId)
      .all()
  ).results;
  const sessions = (
    await db
      .prepare(
        `SELECT s.id, s.level, s.title, s.starts_at, s.ended_at, (SELECT count(*) FROM loop_session_invites i WHERE i.session_id=s.id) invited FROM loop_live_sessions s WHERE s.cohort_id=? ORDER BY s.starts_at DESC`,
      )
      .bind(cohortId)
      .all()
  ).results;
  return { cohort: { id: c.id, name: c.name }, threads, sessions };
}
