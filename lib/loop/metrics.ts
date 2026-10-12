// ACA-E6 metrics and reports. Definitions are the vision's (S-01 to S-05) with their denominators; every share is
// reported with numerator, denominator and a 95% Wilson interval. Reports are drafts until Nakul Jain approves them,
// and a decision is never recorded by a report itself.
// ACA-US-6.1 weekly S-01/S-02 by group and starting level; 6.2 aggregate-only admin view with small-group suppression;
// 6.3 week-6 A-01 report and decision; 9.3/14.2/17.2 split by learner type, cohort, pack and loop version, sector;
// 10.1 S-04; 10.2 day-30/day-90 review pack; 10.4 impact report; 15.1 year-end report; 15.2 S-05.
import {type Db, type Actor, LoopError, audit, refuse, requireRole, requireOwner, operatorRole, requireDecision, requireEpic, iso, newId, text, oneOf, recordDecision} from './core';
import {cohortOf} from './enrolment';

/** S4 (owner decision, 12 October 2026): A-01 holds if at least 35% of enrolled textile learners practised in at least 3 of weeks 2-6. */
export const A01 = {threshold: 0.35, weeks: [2, 3, 4, 5, 6], minWeeks: 3, source: 'S4 owner decision, 12 October 2026'} as const;
export const LEARNER_ROLE_SQL = `('learner','teacher','officer','faculty','student')`;

export function wilson(k: number, n: number, z = 1.96) {
  if (n === 0) return {low: null as number | null, high: null as number | null};
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return {low: Math.max(0, (c - r) / d), high: Math.min(1, (c + r) / d)};
}
export type Share = {numerator: number; denominator: number; value: number | null; low: number | null; high: number | null; suppressed?: boolean};
export const share = (k: number, n: number): Share => ({numerator: k, denominator: n, value: n ? k / n : null, ...wilson(k, n)});

export const GROUPINGS = ['all', 'start_group', 'starting_level', 'cadence', 'role', 'cohort', 'sector', 'pack_version', 'loop_version'] as const;
export type Grouping = typeof GROUPINGS[number];

type Learner = {id: string; cohort_id: string; role: string; start_group: string | null; starting_level: string; cadence: string | null; sector: string; loop_version: string; pack_version: number | null};
/** Enrolled learners: everyone who joined a cohort, active or not (the S-01 denominator). */
async function learners(db: Db, cohortIds: string[]) {
  return (await db.prepare(`SELECT m.id, m.cohort_id, m.role, m.start_group, c.sector, c.loop_version,
      COALESCE((SELECT level FROM loop_levels l WHERE l.member_id=m.id AND l.source='placement' ORDER BY l.id LIMIT 1),'unplaced') AS starting_level,
      (SELECT cadence FROM loop_cadence_assignments a WHERE a.member_id=m.id) AS cadence,
      (SELECT max(pack_version) FROM loop_tasks t WHERE t.member_id=m.id) AS pack_version
    FROM loop_members m JOIN loop_cohorts c ON c.id=m.cohort_id
    WHERE m.cohort_id IN (SELECT value FROM json_each(?)) AND m.status='joined' AND m.role IN ${LEARNER_ROLE_SQL}`).bind(JSON.stringify(cohortIds)).all<Learner>()).results;
}
const keyOf = (l: Learner, g: Grouping) => g === 'all' ? 'all' : g === 'pack_version' ? `v${l.pack_version ?? '-'}` : String(l[g as keyof Learner] ?? 'none');

async function cycles(db: Db, cohortIds: string[]) {
  return (await db.prepare(`SELECT member_id, week, has_artefact, kind FROM loop_submissions WHERE cohort_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(cohortIds)).all<{member_id: string; week: number; has_artefact: number; kind: string}>()).results;
}

/** ACA-US-6.1: S-01 and S-02 per week and group. Week 0 (workshop) is reported on its own and never counted in weeks 2-6. */
export async function weeklyMetrics(db: Db, cohortIds: string[], weeks: number[], groupBy: Grouping = 'all') {
  const ls = await learners(db, cohortIds), cs = await cycles(db, cohortIds);
  const byMember = new Map(ls.map(l => [l.id, l]));
  const groups = [...new Set(ls.map(l => keyOf(l, groupBy)))].sort();
  return weeks.map(week => ({
    week,
    groups: groups.map(g => {
      const members = ls.filter(l => keyOf(l, groupBy) === g);
      const ids = new Set(members.map(m => m.id));
      const wk = cs.filter(c => c.week === week && ids.has(c.member_id));
      const practised = new Set(wk.map(c => c.member_id)).size;
      return {group: g, S01: share(practised, members.length), S02: share(wk.filter(c => c.has_artefact).length, wk.length)};
    }),
    unattributed: cs.filter(c => c.week === week && !byMember.has(c.member_id)).length,
  }));
}

/** S-03: planted errors caught ÷ shown, per month and group (ACA-US-4.5, ACA-US-9.3). */
export async function s03(db: Db, cohortIds: string[], groupBy: Grouping = 'all') {
  const ls = await learners(db, cohortIds), byMember = new Map(ls.map(l => [l.id, l]));
  const rows = (await db.prepare(`SELECT member_id, month, shown, caught FROM loop_catch_results WHERE cohort_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(cohortIds)).all<{member_id: string; month: number; shown: number; caught: number}>()).results;
  const out = new Map<string, {group: string; month: number; caught: number; shown: number; learners: Set<string>}>();
  for (const r of rows) {
    const l = byMember.get(r.member_id); if (!l) continue;
    const k = `${keyOf(l, groupBy)}|${r.month}`;
    const o = out.get(k) ?? {group: keyOf(l, groupBy), month: r.month, caught: 0, shown: 0, learners: new Set<string>()};
    o.caught += r.caught; o.shown += r.shown; o.learners.add(r.member_id); out.set(k, o);
  }
  return [...out.values()].sort((a, b) => a.group.localeCompare(b.group) || a.month - b.month).map(o => ({group: o.group, month: o.month, learners: o.learners.size, S03: share(o.caught, o.shown)}));
}

/** S-04 (ACA-US-10.1-AC2): learners with at least one confirmed changed task ÷ all enrolled learners, by group. */
export async function s04(db: Db, cohortIds: string[], groupBy: Grouping = 'all', asOf = Date.now()) {
  const ls = await learners(db, cohortIds);
  const confirmed = new Set((await db.prepare(`SELECT DISTINCT member_id FROM loop_confirmations WHERE status='confirmed' AND decided_at<=? AND member_id IN (SELECT value FROM json_each(?))`).bind(iso(asOf), JSON.stringify(ls.map(l => l.id))).all<{member_id: string}>().catch(() => ({results: []}))).results.map(r => r.member_id));
  const groups = [...new Set(ls.map(l => keyOf(l, groupBy)))].sort();
  return groups.map(g => { const ms = ls.filter(l => keyOf(l, groupBy) === g); return {group: g, S04: share(ms.filter(m => confirmed.has(m.id)).length, ms.length)}; });
}

/** ACA-US-6.3: share of enrolled learners who practised in at least 3 of weeks 2-6, against 35%. */
export async function a01(db: Db, cohortIds: string[], groupBy: Grouping = 'all') {
  const ls = await learners(db, cohortIds), cs = await cycles(db, cohortIds);
  const weeksBy = new Map<string, Set<number>>();
  for (const c of cs) if ((A01.weeks as readonly number[]).includes(c.week)) weeksBy.set(c.member_id, (weeksBy.get(c.member_id) ?? new Set()).add(c.week));
  const groups = [...new Set(ls.map(l => keyOf(l, groupBy)))].sort();
  return groups.map(g => {
    const ms = ls.filter(l => keyOf(l, groupBy) === g);
    const s = share(ms.filter(m => (weeksBy.get(m.id)?.size ?? 0) >= A01.minWeeks).length, ms.length);
    return {group: g, share: s, meetsThreshold: s.value !== null && s.value >= A01.threshold};
  });
}

/** Small-group suppression for anything shown outside APLYD (ACA-US-6.2-AC2, ACA-US-10.4-AC1). */
export async function suppress<T>(db: Db, value: T, scope = 'global'): Promise<T> {
  const min = (await requireDecision<{size: number}>(db, 'metrics.min_group_size', scope)).size;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('numerator' in o && 'denominator' in o) return (o.denominator as number) < min ? {suppressed: true, denominator: null, numerator: null, value: null, low: null, high: null, note: `fewer than ${min}`} : o;
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

// ---- ACA-US-6.2: admin dashboard ----
export async function adminDashboard(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'dashboard.view', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['admin'], 'dashboard.view', {now});
  const enrolled = await db.prepare(`SELECT sum(status='joined') joined, sum(status='invited') invited FROM loop_members WHERE cohort_id=? AND role IN ${LEARNER_ROLE_SQL}`).bind(cohortId).first<{joined: number; invited: number}>();
  const weeks = Array.from({length: 7}, (_, i) => i);
  return suppress(db, {
    cohort: {id: c.id, name: c.name, workshopDate: c.workshop_date},
    enrolled: {joined: enrolled?.joined ?? 0, invited: enrolled?.invited ?? 0},
    weekly: await weeklyMetrics(db, [cohortId], weeks, 'all'),
    byStartingLevel: await weeklyMetrics(db, [cohortId], weeks, 'starting_level'),
    a01: await a01(db, [cohortId]),
  }, cohortId);
}

// ---- Reports ----
export type ReportKind = 'week6' | 'day30' | 'day90' | 'impact' | 'year_end' | 'harm_review' | 'evidence_pack' | 'cohort_comparison' | 'go_no_go' | 'end_of_pilot';
async function requireReportAccess(db: Db, actor: Actor, action: string, now: number) {
  const role = await operatorRole(db, actor.userId);
  if (!role) return refuse(db, actor.userId, action, null, 'Only APLYD operators can prepare reports.', now);
  return role;
}
export async function saveReport(db: Db, actor: Actor, kind: ReportKind, scope: {cohortId?: string | null; orgId?: string | null}, body: unknown, now = Date.now()) {
  await requireReportAccess(db, actor, 'report.prepare', now);
  const id = newId('rep');
  await db.prepare('INSERT INTO loop_reports(id,kind,cohort_id,org_id,body,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id, kind, scope.cohortId ?? null, scope.orgId ?? null, JSON.stringify(body), actor.userId, iso(now)).run();
  await audit(db, actor.userId, `report.prepare_${kind}`, {org: scope.orgId ?? null, target: id, now});
  return {id};
}
export async function getReport(db: Db, actor: Actor, id: string, now = Date.now()) {
  await requireReportAccess(db, actor, 'report.view', now);
  const r = await db.prepare('SELECT * FROM loop_reports WHERE id=?').bind(id).first<{id: string; kind: string; cohort_id: string | null; org_id: string | null; body: string; created_at: string; approved_by: string | null; approved_at: string | null; shared_at: string | null; shared_note: string | null}>();
  if (!r) throw new LoopError('Report not found.', 404);
  return {...r, body: JSON.parse(r.body)};
}
export async function listReports(db: Db, actor: Actor, now = Date.now()) {
  await requireReportAccess(db, actor, 'report.list', now);
  return (await db.prepare('SELECT id, kind, cohort_id, org_id, created_at, approved_at, shared_at FROM loop_reports ORDER BY created_at DESC LIMIT 200').all()).results;
}
/** ACA-US-10.4-AC3 / 15.1-AC2 / 16.1-AC2: the owner approves; only then can sharing be recorded. Claude never shares. */
export async function approveReport(db: Db, actor: Actor, id: string, now = Date.now()) {
  await requireOwner(db, actor, 'report.approve', now);
  const r = await db.prepare('UPDATE loop_reports SET approved_by=?, approved_at=? WHERE id=? AND approved_at IS NULL').bind(actor.userId, iso(now), id).run();
  if (r.meta.changes !== 1) throw new LoopError('Report not found or already approved.', 409);
  await audit(db, actor.userId, 'report.approve', {target: id, now});
}
export async function recordShared(db: Db, actor: Actor, id: string, note: unknown, now = Date.now()) {
  await requireOwner(db, actor, 'report.shared', now);
  const r = await db.prepare('SELECT approved_at FROM loop_reports WHERE id=?').bind(id).first<{approved_at: string | null}>();
  if (!r) throw new LoopError('Report not found.', 404);
  if (!r.approved_at) return refuse(db, actor.userId, 'report.shared', null, 'Approve the report before recording that it was shared.', now);
  await db.prepare('UPDATE loop_reports SET shared_at=?, shared_note=? WHERE id=?').bind(iso(now), text(note, 'Shared with', 300), id).run();
  await audit(db, actor.userId, 'report.shared', {target: id, now});
}

// ---- ACA-US-6.3 ----
export async function prepareWeek6Report(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) throw new LoopError('Cohort not found.', 404);
  const overall = (await a01(db, [cohortId]))[0] ?? {group: 'all', share: share(0, 0), meetsThreshold: false};
  const body = {
    title: `Week-6 A-01 decision report: ${c.name}`, rule: `Share of enrolled ${c.sector} learners who practised in at least ${A01.minWeeks} of weeks 2-6 is at least ${A01.threshold * 100}% (${A01.source}).`,
    result: overall, byStartingLevel: await a01(db, [cohortId], 'starting_level'), byStartGroup: await a01(db, [cohortId], 'start_group'), weekly: await weeklyMetrics(db, [cohortId], [...A01.weeks]),
    ruleOutcome: overall.meetsThreshold ? 'The rule is met. Suggested decision for the owner to consider: continue.' : 'The rule is not met. Suggested decision for the owner to consider: redesign before another cohort (S4).',
    decision: null, note: 'This report does not record a decision. Nakul Jain records continue or redesign.',
  };
  return {...await saveReport(db, actor, 'week6', {cohortId, orgId: c.org_id}, body, now), body};
}
/** ACA-US-10.2: the owner's continue, adjust or stop decision, linked to the strategy and roadmap. */
export async function recordReviewDecision(db: Db, actor: Actor, reportId: string, input: {decision?: unknown; source?: unknown}, now = Date.now()) {
  await requireOwner(db, actor, 'review.decide', now);
  const r = await db.prepare(`SELECT kind FROM loop_reports WHERE id=? AND kind IN ('day30','day90')`).bind(reportId).first<{kind: string}>();
  if (!r) throw new LoopError('Review not found.', 404);
  const d = oneOf(input.decision, ['continue', 'adjust', 'stop'] as const, 'Decision');
  await recordDecision(db, actor, 'review.decision', reportId, {decision: d, review: r.kind, linkedTo: 'STRATEGY-ACADEMY-01 and ROADMAP-ACADEMY-01'}, typeof input.source === 'string' && input.source.trim() ? input.source : `Review ${reportId}`, now);
  return {decision: d};
}

export async function recordA01Decision(db: Db, actor: Actor, reportId: string, input: {decision?: unknown; source?: unknown}, now = Date.now()) {
  await requireOwner(db, actor, 'a01.decide', now);
  const r = await db.prepare(`SELECT cohort_id FROM loop_reports WHERE id=? AND kind='week6'`).bind(reportId).first<{cohort_id: string}>();
  if (!r) throw new LoopError('Week-6 report not found.', 404);
  const d = oneOf(input.decision, ['continue', 'redesign'] as const, 'Decision');
  await recordDecision(db, actor, 'a01.decision', r.cohort_id, {decision: d, reportId, linkedTo: 'STRATEGY-ACADEMY-01 learning section (A-01)'}, typeof input.source === 'string' && input.source.trim() ? input.source : `Week-6 report ${reportId}`, now);
  return {decision: d};
}

/** ACA-US-10.2: day-30 / day-90 review pack. Signals against targets with uncertainty and harm by starting level (A-06). */
export async function prepareReview(db: Db, actor: Actor, cohortId: string, day: 30 | 90, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) throw new LoopError('Cohort not found.', 404);
  const lastWeek = Math.floor(day / 7);
  const weeks = Array.from({length: lastWeek}, (_, i) => i + 1);
  const checks = (await db.prepare(`SELECT starting_level, count(*) n, avg(1.0*score/max_score) mean FROM loop_check_results WHERE cohort_id=? GROUP BY starting_level`).bind(cohortId).all()).results;
  const body = {
    title: `Day-${day} learning review: ${c.name}`,
    signals: {S01_weekly: await weeklyMetrics(db, [cohortId], weeks), S01_byStartingLevel: await weeklyMetrics(db, [cohortId], weeks, 'starting_level'), S03: await s03(db, [cohortId], 'starting_level'), S04: await s04(db, [cohortId], 'starting_level', now), A01: await a01(db, [cohortId])},
    targets: 'Targets are those in VISION-ACADEMY-01 and STRATEGY-ACADEMY-01; this pack does not restate or change them.',
    harmByStartingLevel: {uncheckedResultsMean: checks, note: 'A-06: compare unaided-check results and S-03 by starting level for any group doing worse over time.'},
    uncertainty: 'Every share shows numerator, denominator and a 95% Wilson interval; small cohorts give wide intervals.',
    interviews: day === 90 ? (await db.prepare('SELECT activity_band, summary FROM loop_interviews WHERE cohort_id=? AND summary IS NOT NULL ORDER BY activity_band').bind(cohortId).all().catch(() => ({results: []}))).results : undefined,
    decision: null, note: 'Nakul Jain records continue, adjust or stop; this pack records nothing by itself.',
  };
  return {...await saveReport(db, actor, day === 30 ? 'day30' : 'day90', {cohortId, orgId: c.org_id}, body, now), body};
}

/** ACA-US-10.4 / 15.1: aggregate report for an association or sponsor; suppression applied; examples only with consent. */
export async function prepareImpactReport(db: Db, actor: Actor, cohortId: string, kind: 'impact' | 'year_end' = 'impact', now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) throw new LoopError('Cohort not found.', 404);
  if (kind === 'year_end') { // ACA-US-15.1: prepared from month 11 of the access year
    const m11 = c.workshop_date ? new Date(c.workshop_date + 'T00:00:00Z') : null;
    if (m11) m11.setUTCMonth(m11.getUTCMonth() + 11);
    if (!m11 || now < m11.getTime()) throw new LoopError('The year-end report is prepared from month 11 of the cohort’s access year.', 409);
  }
  const weeks = kind === 'year_end' ? Array.from({length: 52}, (_, i) => i + 1) : Array.from({length: 13}, (_, i) => i + 1);
  const examples = (await db.prepare(`SELECT s.note FROM loop_submissions s WHERE s.cohort_id=? AND s.member_id IN
      (SELECT member_id FROM loop_consents c WHERE purpose='share_examples' AND id=(SELECT max(id) FROM loop_consents WHERE member_id=c.member_id AND purpose='share_examples') AND granted=1)
      ORDER BY s.at DESC LIMIT 5`).bind(cohortId).all<{note: string}>()).results.map(r => r.note);
  const ws = await weeklyMetrics(db, [cohortId], weeks);
  const anyWeek = await learnersPractisedAnyWeek(db, cohortId, weeks);
  const body = await suppress(db, {
    title: `${kind === 'year_end' ? 'Year-end' : 'Impact'} report: ${c.name} (${c.org_name})`,
    S01_anyWeek: anyWeek, S01_weekly: ws, S01_byStartingLevel: await weeklyMetrics(db, [cohortId], weeks, 'starting_level'),
    S02: share(ws.reduce((s, w) => s + (w.groups[0]?.S02.numerator ?? 0), 0), ws.reduce((s, w) => s + (w.groups[0]?.S02.denominator ?? 0), 0)),
    S03: await s03(db, [cohortId], 'starting_level'), S04: await s04(db, [cohortId], 'starting_level', now),
    consentedExamples: examples, method: 'Counts from practice records; each share has numerator, denominator and a 95% Wilson interval. Groups below the owner’s minimum size are suppressed. No individual data.',
    limits: 'Practice and confirmations show behaviour, not productivity or income; claims beyond these numbers are not supported.',
    approval: 'Draft until approved by Nakul Jain; not shared before approval.',
  }, cohortId);
  return {...await saveReport(db, actor, kind, {cohortId, orgId: c.org_id}, body, now), body};
}
async function learnersPractisedAnyWeek(db: Db, cohortId: string, weeks: number[]) {
  const ls = await learners(db, [cohortId]);
  const r = await db.prepare(`SELECT count(DISTINCT member_id) n FROM loop_submissions WHERE cohort_id=? AND week IN (SELECT value FROM json_each(?))`).bind(cohortId, JSON.stringify(weeks)).first<{n: number}>();
  return share(r?.n ?? 0, ls.length);
}

/** ACA-US-16.1: anonymised evidence for university conversations, with method, uncertainty and limits. */
export async function prepareEvidencePack(db: Db, actor: Actor, cohortIds: string[], now = Date.now()) {
  await requireEpic(db, 'ACA-E16');
  const weeks = [1, 2, 3, 4, 5, 6];
  const body = await suppress(db, {
    title: 'Aplyd Academy practice loop: evidence pack', cohorts: cohortIds.length,
    results: {S01_weekly: await weeklyMetrics(db, cohortIds, weeks), S01_byStartingLevel: await weeklyMetrics(db, cohortIds, weeks, 'starting_level'), S03: await s03(db, cohortIds, 'starting_level'), S04: await s04(db, cohortIds, 'all', now), A01: await a01(db, cohortIds)},
    method: 'Practice records from the app: S-01 learners who practised on their own work ÷ all enrolled; S-02 cycles with a work artefact ÷ cycles; S-03 planted AI errors caught ÷ shown; S-04 learners with a supervisor- or peer-confirmed change ÷ all enrolled. 95% Wilson intervals. Groups below the owner’s minimum size are hidden.',
    limits: 'One sector and a small number of cohorts; self-selected associations; no control group unless a staggered start was agreed; behaviour, not productivity. No learner is identifiable and no individual work is included.',
    demo: 'For demonstrations use the synthetic demo data (scripts/demo-synthetic.mjs), never real learners.',
    approval: 'Draft until approved by Nakul Jain; shared only by him.',
  });
  return {...await saveReport(db, actor, 'evidence_pack', {}, body, now), body};
}

/** ACA-US-14.2-AC2 / 17.2 / 9.3: S-01 to S-03 per cohort (or sector, learner type) with pack and loop version. */
export async function compareCohorts(db: Db, cohortIds: string[], groupBy: Grouping = 'cohort') {
  const meta = (await db.prepare(`SELECT id, name, sector, loop_version, pack_id FROM loop_cohorts WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(cohortIds)).all()).results;
  return {cohorts: meta, S01_S02: await weeklyMetrics(db, cohortIds, [1, 2, 3, 4, 5, 6], groupBy), S03: await s03(db, cohortIds, groupBy), byPackVersion: await weeklyMetrics(db, cohortIds, [1, 2, 3, 4, 5, 6], 'pack_version')};
}

