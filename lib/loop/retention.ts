// ACA-US-6.4 export and delete my data (practice-loop part) and ACA-US-6.5 retention with automatic deletion.
// Owner decision of 12 October 2026: keep data as long as the law requires or allows, and delete it when the learner
// asks. Retention periods per record type come from the owner's decision "retention.periods"; a type without a
// period is kept. Every deletion is logged by internal id (never by name or email) so a restore can re-apply it.
import {type Db, type Actor, type Member, requireOperator, decision, iso, DAY} from './core';
import {removeMemberFiles, removeFileFromDisk} from './files';

/** Everything the loop holds about one person, as a readable JSON document (ACA-US-6.4-AC1). */
export async function exportLoopData(db: Db, actor: Actor) {
  const members = (await db.prepare(`SELECT m.id, m.role, m.name, m.email, m.phone, m.job_role, m.status, m.start_group, m.invited_at, m.joined_at, o.name AS organisation, c.name AS cohort
    FROM loop_members m JOIN loop_orgs o ON o.id=m.org_id LEFT JOIN loop_cohorts c ON c.id=m.cohort_id WHERE m.user_id=?`).bind(actor.userId).all<Member & {organisation: string}>()).results;
  const per = async (sql: string, id: string) => (await db.prepare(sql).bind(id).all()).results;
  const out = [];
  for (const m of members) {
    out.push({
      membership: m,
      consents: await per('SELECT purpose, granted, notice_version, at FROM loop_consents WHERE member_id=? ORDER BY id', m.id),
      levels: await per('SELECT level, source, reason, at FROM loop_levels WHERE member_id=? ORDER BY id', m.id),
      tasks: await per('SELECT id, kind, week, title, prompt, status, created_at FROM loop_tasks WHERE member_id=? ORDER BY created_at', m.id),
      attempts: await per('SELECT task_id, body, at FROM loop_attempts WHERE member_id=? ORDER BY id', m.id),
      coachMessages: await per('SELECT task_id, role, mode, body, at FROM loop_coach_messages WHERE member_id=? ORDER BY id', m.id),
      submissions: await per('SELECT task_id, week, note, link, file_id, at FROM loop_submissions WHERE member_id=? ORDER BY at', m.id),
      files: await per(`SELECT id, name, mime, size, status, created_at FROM loop_files WHERE member_id=? ORDER BY created_at`, m.id),
      unaidedChecks: await per('SELECT score, max_score, at FROM loop_check_results WHERE member_id=?', m.id),
      catchTheAi: await per('SELECT month, shown, caught, false_marks, at FROM loop_catch_results WHERE member_id=?', m.id),
      reminders: await per('SELECT kind, channel, status, at FROM loop_reminders WHERE member_id=? ORDER BY id', m.id),
      flags: await per('SELECT item_id, reason, at, status FROM loop_flags WHERE member_id=?', m.id),
      confirmationsRequested: await per('SELECT relation, shared_text, status, created_at, decided_at FROM loop_confirmations WHERE member_id=?', m.id),
      communityPosts: await per('SELECT body, at, hidden FROM loop_posts WHERE member_id=?', m.id),
      sessionInvites: await per('SELECT session_id, attended, at FROM loop_session_invites WHERE member_id=?', m.id),
      helpReports: await per('SELECT screen, kind, body, at, status, resolution FROM loop_help_reports WHERE member_id=?', m.id),
      interviews: await per('SELECT activity_band, consent_at, held_at, notes, summary FROM loop_interviews WHERE member_id=?', m.id),
      guardianConsent: await per('SELECT status, method, created_at, decided_at FROM loop_guardian_consents WHERE member_id=?', m.id),
      annotations: await per('SELECT item_id, quote, note, at, status FROM loop_annotations WHERE member_id=?', m.id),
    });
  }
  return {exportedAt: iso(Date.now()), note: 'Your Aplyd Academy practice data. Files you uploaded can be downloaded one by one from each task.', memberships: out};
}

const LEARNER_TABLES: [string, string][] = [
  ['loop_coach_messages', 'member_id'], ['loop_attempts', 'member_id'], ['loop_submissions', 'member_id'], ['loop_check_results', 'member_id'],
  ['loop_catch_results', 'member_id'], ['loop_files', 'member_id'], ['loop_tasks', 'member_id'], ['loop_reminders', 'member_id'],
  ['loop_cadence_assignments', 'member_id'], ['loop_followups', 'member_id'], ['loop_level_requests', 'member_id'], ['loop_levels', 'member_id'],
  ['loop_consents', 'member_id'], ['loop_invites', 'member_id'],
];
const optionalTables = ['loop_confirmations', 'loop_posts', 'loop_session_invites', 'loop_help_reports', 'loop_interviews', 'loop_guardian_consents'];

async function tableExists(db: Db, t: string) { return !!(await db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).bind(t).first()); }

/** Delete a member who has no account (never joined) and log it so a restore cannot bring the row back. */
export async function deleteMemberRows(db: Db, memberId: string, now = Date.now(), {log = false} = {}) {
  const statements = [db.prepare('UPDATE loop_flags SET member_id=NULL WHERE member_id=?').bind(memberId)];
  for (const [t, col] of LEARNER_TABLES) statements.push(db.prepare(`DELETE FROM ${t} WHERE ${col}=?`).bind(memberId));
  for (const t of optionalTables) if (await tableExists(db, t)) statements.push(db.prepare(`DELETE FROM ${t} WHERE member_id=?`).bind(memberId));
  statements.push(db.prepare('DELETE FROM loop_members WHERE id=?').bind(memberId));
  if (log) statements.push(db.prepare('INSERT INTO loop_deletion_log(at,tbl,row_key) VALUES(?,?,?)').bind(iso(now), 'member', memberId));
  await db.batch(statements);
}

/** Erase one person's practice-loop data (ACA-US-6.4-AC2). Learner records are deleted; staff records are
 * anonymised because other people's records (reviews, follow-ups) point at them. */
export async function eraseLoopData(db: Db, userId: string, now = Date.now(), {log = true} = {}) {
  const members = (await db.prepare('SELECT * FROM loop_members WHERE user_id=?').bind(userId).all<Member>()).results;
  for (const m of members) {
    const statements = [db.prepare('UPDATE loop_flags SET member_id=NULL WHERE member_id=?').bind(m.id)];
    for (const [t, col] of LEARNER_TABLES) statements.push(db.prepare(`DELETE FROM ${t} WHERE ${col}=?`).bind(m.id));
    for (const t of optionalTables) if (await tableExists(db, t)) statements.push(db.prepare(`DELETE FROM ${t} WHERE member_id=?`).bind(m.id));
    if (['admin', 'facilitator', 'expert', 'reviewer'].includes(m.role))
      statements.push(db.prepare(`UPDATE loop_members SET name='Former staff member', email='erased-'||id, phone=NULL, user_id=NULL, status='removed' WHERE id=?`).bind(m.id));
    else statements.push(db.prepare('DELETE FROM loop_members WHERE id=?').bind(m.id));
    if (log) statements.push(db.prepare('INSERT INTO loop_deletion_log(at,tbl,row_key) VALUES(?,?,?)').bind(iso(now), 'member', m.id));
    await db.batch(statements);
    try { removeMemberFiles(m.id); } catch { /* no file store configured: nothing on disk */ }
  }
  await db.batch([
    db.prepare(`UPDATE loop_audit SET actor='erased' WHERE actor=?`).bind(userId),
    db.prepare(`UPDATE loop_annotations SET user_id='erased', member_id=NULL WHERE user_id=?`).bind(userId),
    db.prepare('DELETE FROM loop_user_prefs WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM loop_help_reports WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM loop_sponsor_viewers WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM loop_pack_reviewers WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM loop_operators WHERE user_id=?').bind(userId),
    ...(log ? [db.prepare('INSERT INTO loop_deletion_log(at,tbl,row_key) VALUES(?,?,?)').bind(iso(now), 'user', userId)] : []),
  ]);
  return {members: members.length};
}

// ---- ACA-US-6.5: scheduled deletion by record type ----
type Rule = {table: string; at: string; key?: string; files?: boolean};
export const RECORD_TYPES: Record<string, Rule> = {
  coach_messages: {table: 'loop_coach_messages', at: 'at'},
  attempts: {table: 'loop_attempts', at: 'at'},
  files: {table: 'loop_files', at: 'created_at', files: true},
  submissions: {table: 'loop_submissions', at: 'at'},
  reminders: {table: 'loop_reminders', at: 'at'},
  message_outbox: {table: 'loop_message_outbox', at: 'created_at'},
  audit: {table: 'loop_audit', at: 'at'},
  sessions: {table: 'academy_sessions', at: 'expires_at', key: 'token_hash'},
  login_codes: {table: 'academy_login_codes', at: 'expires_at'},
  invites: {table: 'loop_invites', at: 'expires_at', key: 'token_hash'},
  help_reports: {table: 'loop_help_reports', at: 'at'},
  community_posts: {table: 'loop_posts', at: 'at'},
};

export async function runRetention(db: Db, trigger = 'schedule', now = Date.now()) {
  const d = await decision<{days: Record<string, number>}>(db, 'retention.periods');
  const counts: Record<string, number> = {};
  if (d) for (const [type, days] of Object.entries(d.value.days ?? {})) {
    const rule = RECORD_TYPES[type];
    if (!rule || !Number.isFinite(days) || days <= 0 || !(await tableExists(db, rule.table))) continue;
    const cutoff = iso(now - days * DAY);
    const idCol = rule.key ?? 'id';
    const rows = (await db.prepare(`SELECT ${idCol} AS k${rule.files ? ', member_id' : ''} FROM ${rule.table} WHERE ${rule.at} < ?`).bind(cutoff).all<{k: string; member_id?: string}>()).results;
    if (rows.length === 0) { counts[type] = 0; continue; }
    if (rule.files) for (const r of rows) await removeFileFromDisk(db, String(r.k));
    await db.batch([
      db.prepare(`DELETE FROM ${rule.table} WHERE ${rule.at} < ?`).bind(cutoff),
      ...rows.map(r => db.prepare('INSERT INTO loop_deletion_log(at,tbl,row_key) VALUES(?,?,?)').bind(iso(now), rule.table, String(r.k))),
    ]);
    counts[type] = rows.length;
  }
  await db.prepare('INSERT INTO loop_deletion_runs(at,trigger,counts) VALUES(?,?,?)').bind(iso(now), trigger, JSON.stringify(counts)).run();
  return {counts, periods: d?.value.days ?? null};
}

/** ACA-US-6.5-AC2: after a restore from backup, re-apply every logged deletion so deleted records do not return. */
export async function reapplyDeletionLog(db: Db, now = Date.now()) {
  const log = (await db.prepare('SELECT tbl, row_key FROM loop_deletion_log ORDER BY id').all<{tbl: string; row_key: string}>()).results;
  let reapplied = 0;
  for (const e of log) {
    if (e.tbl === 'user') {
      reapplied += (await eraseLoopData(db, e.row_key, now, {log: false})).members;
      const u = await db.prepare('SELECT email, email_hash FROM academy_users WHERE id=?').bind(e.row_key).first<{email: string; email_hash: string}>();
      for (const [t, c, v] of [['academy_sessions', 'user_id', e.row_key], ['academy_workspaces', 'owner', e.row_key], ['academy_audit', 'owner', e.row_key], ['academy_login_codes', 'email_hash', u?.email_hash], ['academy_login_locks', 'email_hash', u?.email_hash], ['academy_mail_outbox', 'to_address', u?.email], ['academy_users', 'id', e.row_key]] as [string, string, string | undefined][])
        if (v && await tableExists(db, t)) reapplied += (await db.prepare(`DELETE FROM ${t} WHERE ${c}=?`).bind(v).run()).meta.changes;
      continue;
    }
    if (e.tbl === 'member') {
      const m = await db.prepare('SELECT user_id FROM loop_members WHERE id=?').bind(e.row_key).first<{user_id: string | null}>();
      if (m?.user_id) reapplied += (await eraseLoopData(db, m.user_id, now, {log: false})).members;
      else if (m) { await deleteMemberRows(db, e.row_key); reapplied++; } // invited but never joined (under-18 refusal, guardian refusal, end of pilot)
      continue;
    }
    const rule = Object.values(RECORD_TYPES).find(r => r.table === e.tbl);
    if (!rule || !(await tableExists(db, e.tbl))) continue;
    const idCol = rule.key ?? 'id';
    if (rule.files) await removeFileFromDisk(db, e.row_key);
    const r = await db.prepare(`DELETE FROM ${e.tbl} WHERE ${idCol}=?`).bind(e.row_key).run();
    reapplied += r.meta.changes;
  }
  await db.prepare('INSERT INTO loop_deletion_runs(at,trigger,counts) VALUES(?,?,?)').bind(iso(now), 'restore', JSON.stringify({reapplied})).run();
  return {entries: log.length, reapplied};
}

export async function retentionRuns(db: Db, actor: Actor, now = Date.now()) {
  await requireOperator(db, actor, 'retention.view', now);
  return (await db.prepare('SELECT * FROM loop_deletion_runs ORDER BY id DESC LIMIT 100').all()).results;
}
