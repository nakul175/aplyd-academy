// ACA-US-6.4 (owner decision 12 Oct 2026): a learner can ask for their data to be deleted, and it is deleted.
// Scope: the personal account and personal practice lab. Shared team workspaces hold other people's records
// too (reviews, cohorts), so a member of any team workspace is refused here and handled by a workspace admin
// through the existing data-request flow; nothing is half-deleted.
import {pseudonymMap} from '@/lib/academy-audit-detail';
import {eraseLoopData} from '@/lib/loop/retention';

type Db = D1Database;
export type ErasureResult = {erased: true} | {erased: false; reason: 'team-member'; teams: number};

export async function eraseAccount(db: Db, userId: string): Promise<ErasureResult> {
  const teams = await db.prepare('SELECT count(*) AS n FROM academy_team_directory WHERE user_id=?').bind(userId).first<{n: number}>();
  if ((teams?.n ?? 0) > 0) return {erased: false, reason: 'team-member', teams: teams!.n};
  const user = await db.prepare('SELECT email_hash, email FROM academy_users WHERE id=?').bind(userId).first<{email_hash: string; email: string}>();
  const refusalRef = (await pseudonymMap([userId], 'refusal'))(userId);
  await eraseLoopData(db, userId); // practice-loop records and files (ACA-US-6.4, practice loop)
  await db.batch([
    db.prepare('DELETE FROM academy_workspaces WHERE owner=?').bind(userId),
    db.prepare('DELETE FROM academy_audit WHERE owner=?').bind(userId),
    db.prepare('DELETE FROM academy_access_refusals WHERE actor_ref=?').bind(refusalRef),
    db.prepare('DELETE FROM academy_sessions WHERE user_id=?').bind(userId),
    db.prepare('DELETE FROM academy_login_codes WHERE email_hash=?').bind(user?.email_hash ?? ''),
    db.prepare('DELETE FROM academy_login_locks WHERE email_hash=?').bind(user?.email_hash ?? ''),
    db.prepare('DELETE FROM academy_mail_outbox WHERE to_address=?').bind(user?.email ?? ''),
    db.prepare('DELETE FROM academy_users WHERE id=?').bind(userId),
  ]);
  // Record that an erasure happened, with no reference that could identify the person.
  await db.prepare('INSERT INTO academy_erasures(erased_at) VALUES(?)').bind(new Date().toISOString()).run();
  return {erased: true};
}
