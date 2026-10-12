// ACA-US-2.3 AI-level placement and ACA-US-2.6 one year of access from the workshop.
import {type Db, type Actor, type Member, LoopError, audit, refuse, requireRole, requireSelf, requireDecision, scopedDecision, iso, DAY, text, memberById} from './core';
import {cohortOf} from './enrolment';

export type Instrument = {
  version?: string;
  questions: {id: string; text: string; options: {id: string; text: string; score: number}[]}[];
  bands: {level: string; label: string; min: number; max: number}[];
};

async function instrument(db: Db) {
  const ins = await requireDecision<Instrument>(db, 'placement.instrument');
  if (!ins.questions?.length || !ins.bands?.length) throw new LoopError('The placement check is not set up correctly.', 503);
  return ins;
}

/** The questions as shown to the learner: no scores leave the server. */
export async function placementQuestions(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  await requireSelf(db, actor, memberId, 'placement.open', now);
  const ins = await instrument(db);
  return ins.questions.map(q => ({id: q.id, text: q.text, options: q.options.map(o => ({id: o.id, text: o.text}))}));
}

export function bandFor(ins: Instrument, score: number) {
  const b = ins.bands.find(x => score >= x.min && score <= x.max);
  if (!b) throw new LoopError('The level bands do not cover this score; tell the product owner.', 503);
  return b;
}

export async function submitPlacement(db: Db, actor: Actor, memberId: string, answers: unknown, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'placement.submit', now);
  const ins = await instrument(db);
  if (!answers || typeof answers !== 'object') throw new LoopError('Answer every question.');
  let score = 0;
  for (const q of ins.questions) {
    const chosen = (answers as Record<string, unknown>)[q.id];
    const o = q.options.find(x => x.id === chosen);
    if (!o) throw new LoopError('Answer every question.');
    score += o.score;
  }
  const band = bandFor(ins, score);
  await db.prepare(`INSERT INTO loop_levels(member_id,level,source,score,set_by,reason,at) VALUES(?,?,'placement',?,?,?,?)`).bind(m.id, band.level, score, actor.userId, ins.version ?? null, iso(now)).run();
  await audit(db, actor.userId, 'placement.submit', {org: m.org_id, target: m.id, now});
  return {level: band.level, label: band.label};
}

export async function currentLevel(db: Db, memberId: string) {
  return db.prepare('SELECT level, source, at FROM loop_levels WHERE member_id=? ORDER BY id DESC LIMIT 1').bind(memberId).first<{level: string; source: string; at: string}>();
}
/** The level at placement: the "starting level" every report splits by (A-06). */
export async function startingLevel(db: Db, memberId: string) {
  const r = await db.prepare(`SELECT level FROM loop_levels WHERE member_id=? AND source='placement' ORDER BY id LIMIT 1`).bind(memberId).first<{level: string}>();
  return r?.level ?? 'unplaced';
}
export async function levelLabel(db: Db, level: string) {
  const ins = await scopedDecision<Instrument>(db, 'placement.instrument', 'global');
  return ins?.value.bands.find(b => b.level === level)?.label ?? level;
}

export async function requestLevelChange(db: Db, actor: Actor, memberId: string, reason: unknown, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'level.request', now);
  if (!(await currentLevel(db, m.id))) throw new LoopError('Finish the placement check first.');
  const open = await db.prepare('SELECT id FROM loop_level_requests WHERE member_id=? AND resolved_at IS NULL').bind(m.id).first();
  if (open) throw new LoopError('You already asked for a review. A facilitator will look at it.', 409);
  await db.prepare('INSERT INTO loop_level_requests(member_id,reason,at) VALUES(?,?,?)').bind(m.id, text(reason, 'Reason', 500), iso(now)).run();
  await audit(db, actor.userId, 'level.request', {org: m.org_id, target: m.id, now});
}

export async function openLevelRequests(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  await requireRole(db, actor, orgId, ['facilitator'], 'level.requests', {now});
  return (await db.prepare(`SELECT r.id, r.reason, r.at, m.id AS member_id, m.name, (SELECT level FROM loop_levels WHERE member_id=m.id ORDER BY id DESC LIMIT 1) AS level
    FROM loop_level_requests r JOIN loop_members m ON m.id=r.member_id WHERE m.org_id=? AND r.resolved_at IS NULL ORDER BY r.at`).bind(orgId).all()).results;
}

/** ACA-US-2.3-AC2: a facilitator reviews and changes (or keeps) the level; the change is logged. */
export async function resolveLevelRequest(db: Db, actor: Actor, requestId: number, input: {level?: unknown; reason?: unknown}, now = Date.now()) {
  const r = await db.prepare('SELECT r.*, m.org_id FROM loop_level_requests r JOIN loop_members m ON m.id=r.member_id WHERE r.id=?').bind(requestId).first<{id: number; member_id: string; org_id: string; resolved_at: string | null}>();
  if (!r) return refuse(db, actor.userId, 'level.resolve', null, 'You do not have access to this.', now);
  await requireRole(db, actor, r.org_id, ['facilitator'], 'level.resolve', {now});
  if (r.resolved_at) throw new LoopError('This request is already resolved.', 409);
  const ins = await instrument(db);
  const level = typeof input.level === 'string' && ins.bands.some(b => b.level === input.level) ? input.level : null;
  if (!level) throw new LoopError('Choose one of the defined levels.');
  const reason = text(input.reason, 'Reason', 500);
  const cur = await currentLevel(db, r.member_id);
  const statements = [db.prepare(`UPDATE loop_level_requests SET resolved_at=?, resolved_by=?, outcome=? WHERE id=?`).bind(iso(now), actor.userId, cur?.level === level ? 'kept' : 'changed', r.id)];
  if (cur?.level !== level) statements.push(db.prepare(`INSERT INTO loop_levels(member_id,level,source,set_by,reason,at) VALUES(?,?,'facilitator',?,?,?)`).bind(r.member_id, level, actor.userId, reason, iso(now)));
  await db.batch(statements);
  await audit(db, actor.userId, 'level.resolve', {org: r.org_id, target: r.member_id, now});
  return {level, changed: cur?.level !== level};
}

/** ACA-US-2.3-AC3: grouping for tasks and sessions uses the current AI level, never the job title. */
export async function learnersByLevel(db: Db, cohortId: string) {
  const rows = (await db.prepare(`SELECT m.id, (SELECT level FROM loop_levels WHERE member_id=m.id ORDER BY id DESC LIMIT 1) AS level FROM loop_members m WHERE m.cohort_id=? AND m.status='joined'`).bind(cohortId).all<{id: string; level: string | null}>()).results;
  const groups = new Map<string, string[]>();
  for (const r of rows) { const k = r.level ?? 'unplaced'; groups.set(k, [...(groups.get(k) ?? []), r.id]); }
  return groups;
}

// ---- ACA-US-2.6: access period ----
const addMonths = (date: string, months: number) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };

export async function accessWindow(db: Db, m: Member) {
  const c = m.cohort_id ? await cohortOf(db, m.cohort_id) : null;
  if (!c || !c.workshop_date) return {starts: null as string | null, ends: null as string | null};
  const base = addMonths(c.workshop_date, c.access_months);
  const ends = c.access_extended_until && c.access_extended_until > base ? c.access_extended_until : base;
  return {starts: c.workshop_date, ends};
}

export async function accessStatus(db: Db, m: Member, now = Date.now()) {
  const w = await accessWindow(db, m);
  const today = iso(now).slice(0, 10);
  if (!w.ends) return {...w, active: true, endingSoon: false, daysLeft: null as number | null};
  const daysLeft = Math.ceil((Date.parse(w.ends + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY);
  const notice = m.cohort_id ? await scopedDecision<{days: number}>(db, 'access.notice_days', m.cohort_id) : null;
  return {...w, active: today < w.ends, daysLeft, endingSoon: !!notice && daysLeft > 0 && daysLeft <= notice.value.days};
}

/** ACA-US-2.6-AC3: no new practice cycle after access ends; export stays available. */
export async function requireActiveAccess(db: Db, m: Member, now = Date.now()) {
  const s = await accessStatus(db, m, now);
  if (!s.active) throw new LoopError(`Your practice access ended on ${s.ends}. You can still download your data from Settings. Ask your association about renewing.`, 403);
  return s;
}

export async function memberForUser(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  const m = await memberById(db, memberId);
  if (!m || m.user_id !== actor.userId) return refuse(db, actor.userId, 'member.open', m?.org_id ?? null, 'You do not have access to this.', now);
  return m;
}
