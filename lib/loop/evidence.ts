// ACA-E10 evidence of changed work and learning: ACA-US-10.1 supervisor or peer confirmation (S-04), 10.3 day-90
// interviews with consent and anonymised summaries, 10.5 change list after the A-01 decision; ACA-US-14.1 a proposed
// fix (or a recorded reason for no change) for every logged error before pack version 2.
import {type Db, type Actor, LoopError, audit, refuse, requireSelf, requireOperator, decision, iso, DAY, newId, newToken, sha256, isToken, text, oneOf} from './core';
import {hasConsent, type Send} from './enrolment';
import {requireReviewer, reviewerRole} from './packs';
import {s04} from './metrics';
import {generate, type AiRequest} from '@/lib/ai/provider';

// ---- ACA-US-10.1 ----
export const CONFIRM_DAYS = 21;
/** Only the learner can ask (AC3). The confirmer sees only the text the learner writes for them (AC1). */
export async function requestConfirmation(db: Db, actor: Actor, submissionId: string, input: {email?: unknown; relation?: unknown; sharedText?: unknown}, send: Send, origin: string, now = Date.now()) {
  const sub = await db.prepare('SELECT id, member_id FROM loop_submissions WHERE id=?').bind(submissionId).first<{id: string; member_id: string}>();
  if (!sub) return refuse(db, actor.userId, 'confirm.request', null, 'You do not have access to this.', now);
  const m = await requireSelf(db, actor, sub.member_id, 'confirm.request', now);
  const email = text(input.email, 'Their email', 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LoopError('Enter a valid email address.');
  if (email === m.email) throw new LoopError('Ask someone else to confirm your work.');
  const relation = oneOf(input.relation, ['supervisor', 'peer'] as const, 'Who they are');
  const shared = text(input.sharedText, 'What you want them to see', 1500);
  const token = newToken(), id = newId('conf');
  await db.prepare('INSERT INTO loop_confirmations(id,submission_id,member_id,confirmer_email,relation,token_hash,shared_text,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id, sub.id, m.id, email, relation, sha256(token), shared, iso(now), iso(now + CONFIRM_DAYS * DAY)).run();
  await send(email, `${m.name.split(' ')[0]} asks you to confirm a change in their work`, `${m.name.split(' ')[0]} is practising using AI at work with Aplyd Academy and asks you, as their ${relation}, to confirm a change they made.\n\nOpen this link to see what they shared and confirm or decline (it works once, for ${CONFIRM_DAYS} days):\n${origin}/loop/confirm/${token}\n\nYou do not need an account. If you do not know this person, ignore this email.`);
  await audit(db, actor.userId, 'confirm.request', {org: m.org_id, target: id, now});
  return {id};
}
async function liveConfirmation(db: Db, token: unknown, now: number) {
  if (!isToken(token)) throw new LoopError('This link is not valid.', 404);
  const c = await db.prepare('SELECT c.*, m.name FROM loop_confirmations c JOIN loop_members m ON m.id=c.member_id WHERE c.token_hash=?').bind(sha256(token)).first<{id: string; status: string; expires_at: string; shared_text: string; relation: string; name: string; member_id: string}>();
  if (!c) throw new LoopError('This link is not valid.', 404);
  if (c.status !== 'pending') throw new LoopError('This request has already been answered.', 410);
  if (Date.parse(c.expires_at) <= now) throw new LoopError('This request has expired.', 410);
  return c;
}
export async function openConfirmation(db: Db, token: unknown, now = Date.now()) {
  const c = await liveConfirmation(db, token, now);
  return {learner: c.name.split(' ')[0], relation: c.relation, shared: c.shared_text};
}
export async function decideConfirmation(db: Db, token: unknown, decisionInput: unknown, now = Date.now()) {
  const c = await liveConfirmation(db, token, now);
  const d = oneOf(decisionInput, ['confirmed', 'declined'] as const, 'Answer');
  const r = await db.prepare(`UPDATE loop_confirmations SET status=?, decided_at=? WHERE id=? AND status='pending'`).bind(d, iso(now), c.id).run();
  if (r.meta.changes !== 1) throw new LoopError('This request has already been answered.', 410);
  await audit(db, 'confirmer', `confirm.${d}`, {target: c.id, now});
  return {status: d};
}
export async function myConfirmations(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  await requireSelf(db, actor, memberId, 'confirm.list', now);
  return (await db.prepare('SELECT id, submission_id, relation, status, created_at, decided_at FROM loop_confirmations WHERE member_id=? ORDER BY created_at DESC').bind(memberId).all()).results;
}
/** ACA-US-10.1-AC2: S-04 as of months 3 and 6 after the workshop. */
export async function s04AtMonths(db: Db, cohortId: string) {
  const c = await db.prepare('SELECT workshop_date FROM loop_cohorts WHERE id=?').bind(cohortId).first<{workshop_date: string | null}>();
  if (!c?.workshop_date) throw new LoopError('The cohort has no workshop date.', 409);
  const at = (months: number) => Date.parse(c.workshop_date + 'T00:00:00Z') + months * 30 * DAY;
  return {month3: await s04(db, [cohortId], 'all', at(3)), month6: await s04(db, [cohortId], 'all', at(6))};
}

// ---- ACA-US-10.3 ----
/** Most and least active learners who consented to an interview, for the owner to invite. */
export async function interviewCandidates(db: Db, actor: Actor, cohortId: string, perBand = 3, now = Date.now()) {
  await requireOperator(db, actor, 'interview.candidates', now);
  const rows = (await db.prepare(`SELECT m.id, m.name, m.email, (SELECT count(*) FROM loop_submissions s WHERE s.member_id=m.id) cycles FROM loop_members m WHERE m.cohort_id=? AND m.status='joined' AND m.role IN ('learner','teacher','officer','faculty','student') ORDER BY cycles DESC, m.id`).bind(cohortId).all<{id: string; name: string; email: string; cycles: number}>()).results;
  const consenting = [];
  for (const r of rows) if (await hasConsent(db, r.id, 'research_interview')) consenting.push(r);
  const most = consenting.slice(0, perBand), least = consenting.slice(perBand).slice(-perBand).reverse();
  return {mostActive: most, leastActive: least, consenting: consenting.length, enrolled: rows.length};
}
export async function recordInterview(db: Db, actor: Actor, input: {memberId?: unknown; band?: unknown; consentConfirmed?: unknown; notes?: unknown}, now = Date.now()) {
  await requireOperator(db, actor, 'interview.record', now);
  const m = await db.prepare('SELECT id, cohort_id FROM loop_members WHERE id=?').bind(input.memberId).first<{id: string; cohort_id: string}>();
  if (!m) throw new LoopError('Learner not found.', 404);
  if (!(await hasConsent(db, m.id, 'research_interview')) || input.consentConfirmed !== true) throw new LoopError('An interview is recorded only with the learner’s consent, given in Settings and confirmed again at the start of the interview.', 403);
  const id = newId('int');
  await db.prepare('INSERT INTO loop_interviews(id,member_id,cohort_id,activity_band,consent_at,held_at,notes,recorded_by) VALUES(?,?,?,?,?,?,?,?)')
    .bind(id, m.id, m.cohort_id, oneOf(input.band, ['most_active', 'least_active'] as const, 'Group'), iso(now), iso(now), text(input.notes, 'Notes', 20_000), actor.userId).run();
  await audit(db, actor.userId, 'interview.record', {target: id, now});
  return {id};
}
/** The summary used in the day-90 review must not name the learner. */
export async function summariseInterview(db: Db, actor: Actor, id: string, summary: unknown, now = Date.now()) {
  await requireOperator(db, actor, 'interview.summary', now);
  const r = await db.prepare('SELECT i.id, m.name, m.email FROM loop_interviews i LEFT JOIN loop_members m ON m.id=i.member_id WHERE i.id=?').bind(id).first<{id: string; name: string | null; email: string | null}>();
  if (!r) throw new LoopError('Interview not found.', 404);
  const s = text(summary, 'Summary', 5000);
  const names = [...(r.name ?? '').split(/\s+/).filter(x => x.length > 2), r.email ?? ''].filter(Boolean);
  if (names.some(n => s.toLowerCase().includes(n.toLowerCase()))) throw new LoopError('Remove the learner’s name or email from the summary.', 400);
  await db.prepare('UPDATE loop_interviews SET summary=? WHERE id=?').bind(s, id).run();
  await audit(db, actor.userId, 'interview.summary', {target: id, now});
}
export async function interviewSummaries(db: Db, cohortId: string) {
  return (await db.prepare('SELECT activity_band, summary FROM loop_interviews WHERE cohort_id=? AND summary IS NOT NULL ORDER BY activity_band').bind(cohortId).all<{activity_band: string; summary: string}>()).results;
}

// ---- ACA-US-10.5 ----
export async function addChange(db: Db, actor: Actor, cohortId: string, input: {change?: unknown; evidence?: unknown; expectedSignal?: unknown}, now = Date.now()) {
  await requireOperator(db, actor, 'change.add', now);
  const d = await decision<{decision: string; reportId: string}>(db, 'a01.decision', cohortId);
  if (!d) throw new LoopError('A change list follows the owner’s week-6 decision; none is recorded for this cohort.', 409);
  const r = await db.prepare('INSERT INTO loop_change_list(cohort_id,decision_ref,change,evidence,expected_signal,created_by,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(cohortId, `a01.decision ${d.value.decision} @ ${d.decided_at} (report ${d.value.reportId})`, text(input.change, 'Change', 1000), text(input.evidence, 'Evidence behind it', 1000), text(input.expectedSignal, 'Signal expected to move', 200), actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'change.add', {target: String(r.meta.last_row_id), now});
  return {id: r.meta.last_row_id};
}
export async function updateChange(db: Db, actor: Actor, id: number, input: {status?: unknown; comparison?: unknown}, now = Date.now()) {
  await requireOperator(db, actor, 'change.update', now);
  const status = oneOf(input.status, ['planned', 'built', 'compared'] as const, 'Status');
  if (status === 'compared' && !input.comparison) throw new LoopError('Record the before-and-after comparison.');
  await db.prepare('UPDATE loop_change_list SET status=?, comparison=COALESCE(?, comparison) WHERE id=?').bind(status, typeof input.comparison === 'string' ? input.comparison.slice(0, 3000) : null, id).run();
  await audit(db, actor.userId, 'change.update', {target: String(id), now});
}
export async function changeList(db: Db, cohortId: string) {
  return (await db.prepare('SELECT * FROM loop_change_list WHERE cohort_id=? ORDER BY id').bind(cohortId).all()).results;
}

// ---- ACA-US-14.1 ----
export async function proposeFixes(db: Db, actor: Actor, packId: string, gen: (r: AiRequest) => Promise<{text: string}> = generate, now = Date.now()) {
  if (!(await reviewerRole(db, packId, actor.userId))) await requireOperator(db, actor, 'pack.propose_fixes', now); // one audited refusal at most
  const flags = (await db.prepare(`SELECT f.id, f.reason, i.title, i.body FROM loop_flags f JOIN loop_pack_items i ON i.id=f.item_id WHERE i.pack_id=? AND f.id NOT IN (SELECT flag_id FROM loop_fix_proposals)`).bind(packId).all<{id: number; reason: string; title: string; body: string}>()).results;
  let made = 0;
  for (const f of flags) {
    const r = await gen({purpose: 'pack-fix', maxTokens: 800, temperature: 0.2, system: 'A learner flagged a context-pack item as wrong or unhelpful. Reply with JSON only: {"kind":"fix","text":"<corrected item text>"} or {"kind":"no_change","text":"<reason>"}. Do not invent facts; if the item is correct, choose no_change and say why.', messages: [{role: 'user', content: JSON.stringify({item: {title: f.title, body: f.body}, flag: f.reason})}]});
    let p: {kind?: string; text?: string};
    try { p = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { continue; }
    if ((p.kind !== 'fix' && p.kind !== 'no_change') || typeof p.text !== 'string' || !p.text.trim()) continue;
    await db.prepare(`INSERT INTO loop_fix_proposals(flag_id,kind,text,origin,at) VALUES(?,?,?,'ai',?)`).bind(f.id, p.kind, p.text.slice(0, 8000), iso(now)).run();
    made++;
  }
  await audit(db, actor.userId, 'pack.propose_fixes', {target: `${packId}:${made}`, now});
  return {proposed: made, remaining: flags.length - made};
}
export async function decideProposal(db: Db, actor: Actor, flagId: number, input: {decision?: unknown; kind?: unknown; text?: unknown}, now = Date.now()) {
  const f = await db.prepare('SELECT i.pack_id FROM loop_flags f JOIN loop_pack_items i ON i.id=f.item_id WHERE f.id=?').bind(flagId).first<{pack_id: string}>();
  if (!f) throw new LoopError('Flag not found.', 404);
  await requireReviewer(db, actor, f.pack_id, 'pack.decide_proposal', now);
  if (input.decision === 'own') { // the expert writes their own proposal or reason
    await db.prepare(`INSERT OR REPLACE INTO loop_fix_proposals(flag_id,kind,text,origin,decided,decided_by,at) VALUES(?,?,?,'expert','accepted',?,?)`).bind(flagId, oneOf(input.kind, ['fix', 'no_change'] as const, 'Kind'), text(input.text, 'Text', 8000), actor.userId, iso(now)).run();
  } else await db.prepare('UPDATE loop_fix_proposals SET decided=?, decided_by=? WHERE flag_id=?').bind(oneOf(input.decision, ['accepted', 'rejected'] as const, 'Decision'), actor.userId, flagId).run();
  await audit(db, actor.userId, 'pack.decide_proposal', {target: String(flagId), now});
}
/** ACA-US-14.1-AC1: version 2 is ready to draft when every logged error has a proposed fix or a reason for no change. */
export async function v2Readiness(db: Db, actor: Actor, packId: string, now = Date.now()) {
  await requireReviewer(db, actor, packId, 'pack.v2_readiness', now);
  const rows = (await db.prepare(`SELECT f.id, f.reason, i.title, p.kind, p.text, p.decided FROM loop_flags f JOIN loop_pack_items i ON i.id=f.item_id LEFT JOIN loop_fix_proposals p ON p.flag_id=f.id WHERE i.pack_id=? ORDER BY f.id`).bind(packId).all<{id: number; kind: string | null; decided: string | null}>()).results;
  return {flags: rows, missing: rows.filter(r => !r.kind || r.decided === 'rejected').map(r => r.id), ready: rows.every(r => r.kind && r.decided !== 'rejected')};
}
