// ACA-E5 reminders: ACA-US-5.1 weekly WhatsApp reminder (opt-in, STOP), 5.2 SMS or email fallback behind the same
// opt-in, 5.3 recorded cadence assignment, 5.4 facilitator follow-up list; ACA-US-2.6-AC2 access-ending notice;
// ACA-US-11.4 never any direct message to students. Messages carry the first name and a link only.
import {type Db, type Actor, type Member, LoopError, audit, refuse, requireRole, requireOperator, decision, scopedDecision, requireDecision, iso, DAY, sha256, text} from './core';
import {cohortOf, currentConsents, startDateOf} from './enrolment';
import {accessStatus} from './levels';
import {ensureWeeklyTask} from './practice';

export type Channel = 'whatsapp' | 'sms' | 'email';
export type Message = {channel: Channel; to: string; template: string; body: string};
export type Senders = Partial<Record<Channel, (m: Message) => Promise<void>>>;
const CONSENT: Record<Channel, string> = {whatsapp: 'reminder_whatsapp', sms: 'reminder_sms', email: 'reminder_email'};

/** Delivery adapters. WhatsApp and SMS providers are not chosen yet (owner decision pending), so only the local
 * outbox exists for them; email uses the Academy's mail transport. Production refuses the outbox. */
export function outboxSenders(db: Db, channels: Channel[] = ['whatsapp', 'sms', 'email']): Senders {
  if (process.env.ACADEMY_ENVIRONMENT === 'production') throw new LoopError('The message outbox is for local tests only.', 503);
  const s: Senders = {};
  for (const c of channels) s[c] = async (m) => { await db.prepare('INSERT INTO loop_message_outbox(channel,to_address,template,body,created_at) VALUES(?,?,?,?,?)').bind(m.channel, m.to, m.template, m.body, iso(Date.now())).run(); };
  return s;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0].slice(0, 30);
export const TEMPLATES = {
  weekly: (name: string, link: string) => `Hi ${name}, your Aplyd Academy practice task for this week is ready: ${link}\nReply STOP to stop these messages.`,
  access_notice: (name: string, ends: string, link: string) => `Hi ${name}, your Aplyd Academy practice access ends on ${ends}. See what happens to your data and how to download it: ${link}\nReply STOP to stop these messages.`,
  session: (name: string, when: string, link: string) => `Hi ${name}, you are invited to a live Aplyd Academy session on ${when}: ${link}\nReply STOP to stop these messages.`,
  brief: (name: string, link: string) => `Hi ${name}, this month's short AI brief for your work is ready: ${link}\nReply STOP to stop these messages.`,
} as const;

/** The channel for one learner: the owner's channel for the cohort if the learner opted in to it, else another
 * channel the learner opted in to. Never a channel without opt-in. Students get nothing from APLYD (ACA-US-11.4). */
export async function channelFor(db: Db, m: Member, senders: Senders): Promise<Channel | null> {
  if (m.role === 'student') return null;
  const consents = await currentConsents(db, m.id);
  const owner = m.cohort_id ? (await scopedDecision<{channel: Channel}>(db, 'reminders.channel', m.cohort_id))?.value.channel : undefined;
  const order: Channel[] = [...(owner ? [owner] : []), ...(['whatsapp', 'email', 'sms'] as Channel[]).filter(c => c !== owner)];
  for (const c of order) {
    if (!consents[CONSENT[c]]?.granted || !senders[c]) continue;
    if ((c === 'whatsapp' || c === 'sms') && !m.phone) continue;
    return c;
  }
  return null;
}

async function deliver(db: Db, m: Member, kind: string, slot: string, senders: Senders, body: (name: string) => string, now: number) {
  const done = await db.prepare('SELECT 1 FROM loop_reminders WHERE member_id=? AND kind=? AND slot=?').bind(m.id, kind, slot).first();
  if (done) return 'already';
  const channel = await channelFor(db, m, senders);
  if (!channel) {
    await db.prepare(`INSERT INTO loop_reminders(member_id,cohort_id,kind,slot,channel,status,reason,at) VALUES(?,?,?,?,'none','skipped','no opted-in channel',?)`).bind(m.id, m.cohort_id, kind, slot, iso(now)).run();
    return 'skipped';
  }
  const to = channel === 'email' ? m.email : m.phone!;
  try {
    await senders[channel]!({channel, to, template: `${kind}-1`, body: body(firstName(m.name))});
    await db.prepare(`INSERT INTO loop_reminders(member_id,cohort_id,kind,slot,channel,status,at) VALUES(?,?,?,?,?,'sent',?)`).bind(m.id, m.cohort_id, kind, slot, channel, iso(now)).run();
    return 'sent';
  } catch {
    await db.prepare(`INSERT INTO loop_reminders(member_id,cohort_id,kind,slot,channel,status,reason,at) VALUES(?,?,?,?,?,'failed','provider error',?)`).bind(m.id, m.cohort_id, kind, slot, channel, iso(now)).run();
    return 'failed';
  }
}

// ---- Cadence ----
type Cadence = {id: string; days: number[]};
/** Days of the week (0 = Sunday) on which a learner is reminded: their cadence group's days, else the owner default,
 * else once a week on the weekday their practice started (the plan's "one message per week"). */
export async function reminderDays(db: Db, m: Member): Promise<number[]> {
  const a = await db.prepare('SELECT cadence FROM loop_cadence_assignments WHERE member_id=?').bind(m.id).first<{cadence: string}>();
  const cadences = m.cohort_id ? (await decision<{cadences: Cadence[]}>(db, 'reminders.cadences', m.cohort_id))?.value.cadences : undefined;
  const assigned = a && cadences?.find(c => c.id === a.cadence);
  if (assigned) return assigned.days;
  // ACA-US-14.3: the owner's default cadence applies to cohorts created after the decision.
  const def = await decision<{cadence: Cadence}>(db, 'reminders.default_cadence');
  const created = m.cohort_id ? (await db.prepare('SELECT created_at FROM loop_cohorts WHERE id=?').bind(m.cohort_id).first<{created_at: string}>())?.created_at : null;
  if (def?.value.cadence?.days?.length && created && created >= def.decided_at) return def.value.cadence.days;
  return [new Date((await startDateOf(db, m)) + 'T00:00:00Z').getUTCDay()];
}

/** ACA-US-5.3-AC1: with the owner's approval of cadences, assign learners and record it (deterministic split). */
export async function assignCadences(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'cadence.assign', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['admin'], 'cadence.assign', {allowOperator: true, now});
  const d = await decision<{cadences: Cadence[]}>(db, 'reminders.cadences', cohortId);
  if (!d || (d.value.cadences?.length ?? 0) < 2) throw new LoopError('Waiting for the product owner to approve the cadences to compare for this cohort.', 409);
  const ref = `reminders.cadences@${cohortId}@${d.decided_at}`;
  const members = (await db.prepare(`SELECT id FROM loop_members WHERE cohort_id=? AND status='joined' AND role IN ('learner','teacher','officer','faculty') ORDER BY id`).bind(cohortId).all<{id: string}>()).results;
  // Balanced split: sort by a hash of the id (not by name or time) and deal out in turn.
  const shuffled = [...members].sort((a, b) => sha256(cohortId + a.id).localeCompare(sha256(cohortId + b.id)));
  let n = 0;
  for (const [i, m] of shuffled.entries()) {
    const r = await db.prepare('INSERT OR IGNORE INTO loop_cadence_assignments(member_id,cohort_id,cadence,assigned_at,decision_ref) VALUES(?,?,?,?,?)').bind(m.id, cohortId, d.value.cadences[i % d.value.cadences.length].id, iso(now), ref).run();
    n += r.meta.changes;
  }
  await audit(db, actor.userId, 'cadence.assign', {org: c.org_id, target: `${cohortId}:${n}`, now});
  return {assigned: n};
}

// ---- The reminder job (run daily by the server timer) ----
export async function runReminders(db: Db, senders: Senders, origin: string, now = Date.now()) {
  const today = new Date(now).getUTCDay();
  const members = (await db.prepare(`SELECT m.* FROM loop_members m WHERE m.status='joined' AND m.cohort_id IS NOT NULL AND m.role IN ('learner','teacher','officer','faculty','student')`).all<Member>()).results;
  const tally: Record<string, number> = {};
  const count = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
  for (const m of members) {
    if (m.role === 'student') { count('student_never_messaged'); continue; } // ACA-US-11.4
    const access = await accessStatus(db, m, now);
    if (access.endingSoon && access.ends) {
      count('notice_' + await deliver(db, m, 'access_notice', access.ends, senders, n => TEMPLATES.access_notice(n, access.ends!, `${origin}/loop/settings`), now));
    }
    if (!access.active || !(await reminderDays(db, m)).includes(today)) continue;
    const t = await ensureWeeklyTask(db, {userId: m.user_id!}, m.id, now).catch(() => null);
    if (!t || t.state !== 'ready') { count('no_task'); continue; }
    const done = await db.prepare(`SELECT status FROM loop_tasks WHERE id=?`).bind(t.taskId).first<{status: string}>();
    if (done?.status === 'submitted') { count('already_practised'); continue; }
    count('weekly_' + await deliver(db, m, 'weekly', `w${t.week}-d${today}`, senders, n => TEMPLATES.weekly(n, `${origin}/loop/task/${t.taskId}`), now));
  }
  return tally;
}

/** ACA-US-5.1-AC2: a STOP reply withdraws WhatsApp (or SMS) consent for that number. Called by the provider webhook. */
export async function handleStop(db: Db, channel: 'whatsapp' | 'sms', phone: string, now = Date.now()) {
  const p = phone.replace(/[^0-9+]/g, '');
  const variants = [p, p.startsWith('+') ? p.slice(1) : '+' + p];
  const ms = (await db.prepare(`SELECT id FROM loop_members WHERE phone IN (?,?)`).bind(...variants).all<{id: string}>()).results;
  for (const m of ms) {
    const last = await db.prepare(`SELECT notice_version FROM loop_consents WHERE member_id=? AND purpose='core' ORDER BY id DESC LIMIT 1`).bind(m.id).first<{notice_version: string}>();
    await db.prepare('INSERT INTO loop_consents(member_id,purpose,granted,notice_version,at) VALUES(?,?,0,?,?)').bind(m.id, CONSENT[channel], last?.notice_version ?? 'unknown', iso(now)).run();
  }
  await audit(db, 'provider', `consent.stop_${channel}`, {target: String(ms.length), now});
  return {stopped: ms.length};
}

// ---- ACA-US-5.4: follow-up list ----
export async function followUpList(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'followup.view', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'followup.view', {now});
  const weeks = (await requireDecision<{weeks: number}>(db, 'followup.inactive_weeks', cohortId)).weeks;
  const members = (await db.prepare(`SELECT * FROM loop_members WHERE cohort_id=? AND status='joined' AND role IN ('learner','teacher','officer','faculty')`).bind(cohortId).all<Member>()).results;
  const out = [];
  for (const m of members) {
    const start = Date.parse((await startDateOf(db, m)) + 'T00:00:00Z');
    if (now - start < weeks * 7 * DAY) continue; // too early to call anyone inactive
    const last = await db.prepare('SELECT max(at) at FROM loop_submissions WHERE member_id=?').bind(m.id).first<{at: string | null}>();
    const lastAt = last?.at ? Date.parse(last.at) : null;
    if (lastAt !== null && now - lastAt < weeks * 7 * DAY) continue;
    const f = await db.prepare('SELECT outcome, at FROM loop_followups WHERE member_id=? ORDER BY id DESC LIMIT 1').bind(m.id).first<{outcome: string; at: string}>();
    out.push({memberId: m.id, name: m.name, email: m.email, phone: m.phone, lastPractice: last?.at ?? null, lastFollowUp: f ?? null});
  }
  return {weeks, learners: out};
}
export async function logFollowUp(db: Db, actor: Actor, memberId: string, outcome: unknown, now = Date.now()) {
  const m = await db.prepare('SELECT org_id FROM loop_members WHERE id=?').bind(memberId).first<{org_id: string}>();
  if (!m) return refuse(db, actor.userId, 'followup.log', null, 'You do not have access to this.', now);
  await requireRole(db, actor, m.org_id, ['facilitator'], 'followup.log', {now});
  await db.prepare('INSERT INTO loop_followups(member_id,facilitator,outcome,at) VALUES(?,?,?,?)').bind(memberId, actor.userId, text(outcome, 'Outcome', 500), iso(now)).run();
  await audit(db, actor.userId, 'followup.log', {org: m.org_id, target: memberId, now});
}

export async function messageOutbox(db: Db, actor: Actor, now = Date.now()) {
  await requireOperator(db, actor, 'outbox.view', now);
  return (await db.prepare('SELECT * FROM loop_message_outbox ORDER BY id DESC LIMIT 200').all()).results;
}
