import type { Team } from './academy-teams';

/** Defined metrics and permissioned programme reporting. Pure: derives from the Team
 * document for one authenticated member, never from a client projection, and returns
 * aggregates only (no learner names, ids, evidence, scores or message text).
 * Permissions: an active owner sees every cohort in the workspace; an active
 * facilitator or assessor sees only cohorts in their current scopes; every other role,
 * removed members and non-members are denied. Counts below the threshold are shown as
 * '<3' both in the projection and in every export. */
export const SMALL_CELL_THRESHOLD = 3,
  SUPPRESSED = '<3';
export type Cell = number | typeof SUPPRESSED | null;
export type MetricDef = {
  id: string;
  name: string;
  definition: string;
  formula: string;
  source: string;
  visibleTo: string[];
  limits: string;
};
const OWNER = ['owner'],
  STAFF = ['owner', 'facilitator', 'assessor'],
  OPS = ['owner', 'facilitator'];
export const METRIC_DICTIONARY: MetricDef[] = [
  {
    id: 'enrolled',
    name: 'Enrolled',
    definition: 'Learners currently holding a place in the cohort.',
    formula: 'Count of enrollments in the cohort where withdrawn is not set.',
    source: 'Learner enrollment records in this workspace.',
    visibleTo: STAFF,
    limits: 'A learner who withdrew is excluded from every metric. Counts below 3 are suppressed.',
  },
  {
    id: 'active',
    name: 'Active',
    definition: 'Enrolled learners who have started but not yet passed.',
    formula: 'Enrolled with at least one saved lesson or submission and no passing latest decision.',
    source: 'Enrollment lessons, attempts and decisions.',
    visibleTo: STAFF,
    limits: 'Measures saved activity, not time spent or job impact.',
  },
  {
    id: 'completed_lessons',
    name: 'Completed lessons',
    definition: 'Lessons saved as completed across enrolled learners.',
    formula:
      'Sum of completed lessons over enrolled learners. Suppressed when fewer than 3 learners are enrolled.',
    source: 'Enrollment lesson records.',
    visibleTo: STAFF,
    limits: 'A sum, not a per-learner average. Does not show quality of the practice.',
  },
  {
    id: 'submitted',
    name: 'Submitted',
    definition: 'Enrolled learners with at least one submitted assessment attempt.',
    formula: 'Count of enrolled learners with one or more attempts.',
    source: 'Assessment attempts.',
    visibleTo: STAFF,
    limits: 'Counts learners, not attempts.',
  },
  {
    id: 'passed',
    name: 'Passed',
    definition: 'Enrolled learners whose latest decided attempt meets the practice standard.',
    formula:
      'Latest attempt has a decision; a resolved appeal on that attempt replaces the decision; outcome is pass.',
    source: 'Assessment decisions and appeal resolutions.',
    visibleTo: STAFF,
    limits:
      'A nonaccredited practice standard; not a qualification. A newer attempt awaiting review leaves the learner out until decided.',
  },
  {
    id: 'needs_retry',
    name: 'Needs retry',
    definition: 'Enrolled learners whose latest decided attempt did not yet meet the standard.',
    formula: 'Latest attempt has a decision (after any resolved appeal) and the outcome is not a pass.',
    source: 'Assessment decisions and appeal resolutions.',
    visibleTo: STAFF,
    limits:
      'Same limits as Passed. Passed, Needs retry and Active can overlap or leave out learners awaiting review.',
  },
  {
    id: 'appeals',
    name: 'Appeals',
    definition: 'Appeals raised against decided attempts by enrolled learners.',
    formula: 'Count of appeal records on enrolled learners’ attempts, open or resolved.',
    source: 'Appeal records.',
    visibleTo: STAFF,
    limits: 'Counts appeals, not learners.',
  },
  {
    id: 'appeal_rate',
    name: 'Appeal rate',
    definition: 'Share of decided attempts that were appealed.',
    formula:
      'Appeals divided by decided attempts, as a percentage to one decimal. Suppressed when appeals or decided attempts are below 3.',
    source: 'Appeal records and decisions.',
    visibleTo: STAFF,
    limits: 'Small cohorts give unstable rates.',
  },
  {
    id: 'median_days_to_review',
    name: 'Median days to review',
    definition: 'Typical time from submission to a recorded decision.',
    formula:
      'Median of (decision time minus submission time) in days over decided attempts, one decimal. Suppressed below 3 decided attempts.',
    source: 'Attempt submission and decision timestamps.',
    visibleTo: STAFF,
    limits: 'Excludes attempts still waiting. Not a service guarantee.',
  },
  {
    id: 'support_requests',
    name: 'Support requests',
    definition: 'Support requests tied to the cohort.',
    formula: 'Count of support requests whose cohort is this cohort, any status.',
    source: 'Workspace support threads (counts only, no text).',
    visibleTo: STAFF,
    limits: 'Requests without a cohort are not attributed to any cohort.',
  },
  {
    id: 'discussion_reports',
    name: 'Discussion reports',
    definition: 'Reports raised on discussion posts in the cohort.',
    formula: 'Count of reports whose post belongs to this cohort, any status.',
    source: 'Discussion reports (counts only, no text or reporter).',
    visibleTo: STAFF,
    limits: 'Counts reports, not posts or people.',
  },
  {
    id: 'ops_cohorts_in_scope',
    name: 'Cohorts in scope',
    definition: 'Cohorts the viewer can currently act on.',
    formula: 'Cohorts where the viewer is owner, or facilitator with that cohort in scope.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'Observation of current authority, not a measure of outcomes.',
  },
  {
    id: 'ops_enrollments_not_withdrawn',
    name: 'Enrollments not withdrawn',
    definition: 'Enrollments in scope that are not withdrawn.',
    formula: 'Same as Enrolled, summed across cohorts in scope.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'Includes completed learners until withdrawal is permitted.',
  },
  {
    id: 'ops_practice_records',
    name: 'Practice records',
    definition: 'Nonaccredited practice records currently active.',
    formula: 'Enrollments whose practice record status is active.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'May overlap with open appeals.',
  },
  {
    id: 'ops_pending_reviews',
    name: 'Pending assessments and appeals',
    definition: 'Reviews awaiting a decision.',
    formula:
      'Undecided attempts plus open appeals (owner: whole workspace; facilitator: only those assigned to them).',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'A snapshot at the time of viewing.',
  },
  {
    id: 'ops_unassigned_reviews',
    name: 'Reviews awaiting assignment',
    definition: 'Pending reviews with no assigned reviewer.',
    formula: 'Pending reviews without an assignment.',
    source: 'Workspace operations view.',
    visibleTo: OWNER,
    limits: 'Owner only.',
  },
  {
    id: 'ops_oldest_wait_days',
    name: 'Oldest recorded wait',
    definition: 'Age of the oldest pending review.',
    formula: 'Whole days since the earliest pending review was created.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'An observation, not a deadline or response guarantee.',
  },
  {
    id: 'ops_open_support',
    name: 'Open support requests',
    definition: 'Open support requests visible to the viewer.',
    formula: 'Support requests with status open within the viewer’s support authority.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'No staffed response time is promised.',
  },
  {
    id: 'ops_sessions_next_seven_days',
    name: 'Sessions in the next seven days',
    definition: 'Scheduled practice sessions starting within seven days or in progress.',
    formula: 'Scheduled sessions in scope not yet ended and starting within 7 days.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'Cancelled sessions are excluded.',
  },
  {
    id: 'ops_attendance_to_record',
    name: 'Attendance still to record',
    definition: 'Registrations awaiting an attendance mark by the host.',
    formula:
      'Registrations with no attendance record for sessions the viewer hosts that have started and ended less than 7 days ago.',
    source: 'Workspace operations view.',
    visibleTo: OPS,
    limits: 'Host only.',
  },
  {
    id: 'escalations_open',
    name: 'Open escalations',
    definition: 'Reports escalated to the owner and not yet decided.',
    formula: 'Escalations with status open.',
    source: 'Escalation records.',
    visibleTo: OWNER,
    limits: 'Owner only. Safeguarding detail is not exported.',
  },
  {
    id: 'escalations_overdue',
    name: 'Overdue escalations',
    definition: 'Open escalations past their internal response target.',
    formula:
      'Open and now later than escalation time plus the severity target (low 168h, medium 72h, high 24h, safeguarding 4h).',
    source: 'Escalation records.',
    visibleTo: OWNER,
    limits: 'Internal targets, not promises to reporters.',
  },
];
export class ReportError extends Error {
  constructor(
    message: string,
    public status = 404,
  ) {
    super(message);
    this.name = 'ReportError';
  }
}
const DENIED = 'Report data is not available for your account.',
  NO_COHORT = 'Cohort not found.';
export const canViewReports = (m: any) =>
  !!m &&
  m.active === true &&
  Array.isArray(m.roles) &&
  m.roles.some((r: string) => r === 'admin' || r === 'facilitator' || r === 'assessor');
const COUNT_KEYS = [
  'enrolled',
  'active',
  'submitted',
  'passed',
  'needsRetry',
  'appeals',
  'supportRequests',
  'discussionReports',
] as const;
export type Row = {
  level: 'cohort' | 'pathway' | 'workspace';
  programId: string | null;
  cohortId: string | null;
  cohortTitle: string | null;
  enrolled: Cell;
  active: Cell;
  completedLessons: Cell;
  submitted: Cell;
  passed: Cell;
  needsRetry: Cell;
  appeals: Cell;
  appealRate: Cell;
  medianDaysToReview: Cell;
  supportRequests: Cell;
  discussionReports: Cell;
};
export type Rollup = {
  schema: 'aplyd-academy-report/1';
  workspaceId: string;
  generatedAt: string;
  audience: 'owner' | 'scoped';
  cohortIds: string[];
  suppression: { threshold: number; marker: string };
  cohorts: Row[];
  pathways: Row[];
  total: Row;
};
type Raw = {
  enrolled: number;
  active: number;
  lessons: number;
  submitted: number;
  passed: number;
  needsRetry: number;
  appeals: number;
  reviewed: number;
  days: number[];
  supportRequests: number;
  discussionReports: number;
};
const blank = (): Raw => ({
  enrolled: 0,
  active: 0,
  lessons: 0,
  submitted: 0,
  passed: 0,
  needsRetry: 0,
  appeals: 0,
  reviewed: 0,
  days: [],
  supportRequests: 0,
  discussionReports: 0,
});
const merge = (a: Raw, b: Raw) => {
  for (const k of Object.keys(a) as (keyof Raw)[]) {
    if (k === 'days') a.days.push(...b.days);
    else (a[k] as number) += b[k] as number;
  }
};
const small = (n: number) => n < SMALL_CELL_THRESHOLD;
const cell = (n: number): Cell => (small(n) ? SUPPRESSED : n);
const DAY = 86400000;
function median(v: number[]) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b),
    h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
function shown(
  level: Row['level'],
  programId: string | null,
  cohortId: string | null,
  cohortTitle: string | null,
  r: Raw,
): Row {
  const med = median(r.days);
  return {
    level,
    programId,
    cohortId,
    cohortTitle,
    enrolled: cell(r.enrolled),
    active: cell(r.active),
    completedLessons: small(r.enrolled) ? SUPPRESSED : r.lessons,
    submitted: cell(r.submitted),
    passed: cell(r.passed),
    needsRetry: cell(r.needsRetry),
    appeals: cell(r.appeals),
    appealRate: small(r.appeals) || small(r.reviewed) ? SUPPRESSED : round1((r.appeals / r.reviewed) * 100),
    medianDaysToReview: small(r.reviewed) || med === null ? SUPPRESSED : round1(med),
    supportRequests: cell(r.supportRequests),
    discussionReports: cell(r.discussionReports),
  };
}
function rawFor(t: Team, cohortId: string): Raw {
  const r = blank();
  for (const l of t.learners)
    for (const e of l.state.enrollments) {
      if (e.cohortId !== cohortId || e.withdrawn) continue;
      r.enrolled++;
      const completed = Array.isArray(e.completed) ? e.completed.length : 0,
        attempts: any[] = e.attempts ?? [];
      r.lessons += completed;
      if (attempts.length) r.submitted++;
      const decided = attempts.filter((a) => a.decision);
      r.reviewed += decided.length;
      for (const a of decided) {
        const d = Date.parse(a.decision.decidedAt),
          s = Date.parse(a.submittedAt);
        if (Number.isFinite(d) && Number.isFinite(s) && d >= s) r.days.push((d - s) / DAY);
      }
      r.appeals += (e.appeals ?? []).length;
      const last = attempts.at(-1);
      let outcome: boolean | null = null;
      if (last?.decision) {
        const ap = (e.appeals ?? []).find((x: any) => x.attemptId === last.id && x.resolution);
        outcome = (ap ? ap.resolution.passed : last.decision.passed) === true;
      }
      if (outcome === true) r.passed++;
      else if (outcome === false) r.needsRetry++;
      if (outcome !== true && (completed > 0 || attempts.length > 0)) r.active++;
    }
  r.supportRequests = (t.support ?? []).filter((s) => s.cohortId === cohortId).length;
  r.discussionReports = t.reports.filter(
    (x) => t.posts.find((p) => p.id === x.postId)?.cohortId === cohortId,
  ).length;
  return r;
}
function build(t: Team, m: any, now: string, only?: string[]): Rollup {
  if (!canViewReports(m)) throw new ReportError(DENIED);
  const owner = m.roles.includes('admin'),
    visible = t.cohorts.filter((c) => owner || (Array.isArray(m.scopes) && m.scopes.includes(c.id)));
  if (only !== undefined) {
    if (
      !Array.isArray(only) ||
      only.some((id) => typeof id !== 'string' || !visible.some((c) => c.id === id))
    )
      throw new ReportError(NO_COHORT);
  }
  const chosen = only === undefined ? visible : visible.filter((c) => only.includes(c.id)),
    byPath = new Map<string, Raw>(),
    all = blank(),
    cohorts: Row[] = [];
  for (const c of chosen) {
    const raw = rawFor(t, c.id);
    cohorts.push(shown('cohort', c.programId, c.id, String(c.title).slice(0, 100), raw));
    const p = byPath.get(c.programId) ?? blank();
    merge(p, raw);
    byPath.set(c.programId, p);
    merge(all, raw);
  }
  return {
    schema: 'aplyd-academy-report/1',
    workspaceId: t.id,
    generatedAt: now,
    audience: owner ? 'owner' : 'scoped',
    cohortIds: chosen.map((c) => c.id),
    suppression: { threshold: SMALL_CELL_THRESHOLD, marker: SUPPRESSED },
    cohorts,
    pathways: [...byPath].map(([id, raw]) => shown('pathway', id, null, null, raw)),
    total: shown('workspace', null, null, null, all),
  };
}
/** Throws ReportError (404) for a denied role and for unknown or out-of-scope cohort ids alike. */
export function deriveReportRollup(
  t: Team,
  userId: string,
  now: string,
  opts: { cohortIds?: string[] } = {},
): Rollup {
  const m = t.members.find((x) => x.userId === userId);
  if (!m) throw new ReportError(DENIED);
  return build(t, m, now, opts.cohortIds);
}
/** For projectTeam: null when the viewer has no report permission. */
export function projectReportRollup(t: Team, m: any, now: string): Rollup | null {
  return canViewReports(m) ? build(t, m, now) : null;
}

/** Idempotent re-suppression, so an export is safe even from a hand-built rollup. */
export function suppressRow(r: Row): Row {
  const out: any = { ...r };
  for (const k of COUNT_KEYS) if (typeof out[k] === 'number') out[k] = cell(out[k]);
  if (typeof r.enrolled === 'number' && small(r.enrolled)) out.completedLessons = SUPPRESSED;
  return out;
}
export const EXPORT_COLUMNS = [
  'level',
  'programId',
  'cohortId',
  'cohortTitle',
  'enrolled',
  'active',
  'completedLessons',
  'submitted',
  'passed',
  'needsRetry',
  'appeals',
  'appealRate',
  'medianDaysToReview',
  'supportRequests',
  'discussionReports',
] as const;
const COLUMN_METRIC: Record<string, string> = {
  enrolled: 'enrolled',
  active: 'active',
  completedLessons: 'completed_lessons',
  submitted: 'submitted',
  passed: 'passed',
  needsRetry: 'needs_retry',
  appeals: 'appeals',
  appealRate: 'appeal_rate',
  medianDaysToReview: 'median_days_to_review',
  supportRequests: 'support_requests',
  discussionReports: 'discussion_reports',
};
function csvCell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const LIMITS = [
  'Aggregates only: no learner names, identifiers, evidence, scores or message text.',
  'Counts below 3 are shown as <3 per cell. Suppression is not complementary: a total and its parts can still allow inference in very small groups.',
  'Counts describe saved learning and queues. They do not measure job impact or establish a qualification.',
];
export type ReportExport = {
  filename: string;
  mime: string;
  content: string;
  manifest: any;
  manifestJson: string;
};
export function exportReport(rollup: Rollup, format: 'csv' | 'json'): ReportExport {
  if (format !== 'csv' && format !== 'json') throw new ReportError('Choose CSV or JSON.', 400);
  const rows = [...rollup.cohorts, ...rollup.pathways, rollup.total]
    .map(suppressRow)
    .map((r) => Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, (r as any)[c] ?? null])));
  const csv =
      [EXPORT_COLUMNS.join(','), ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(','))].join(
        '\r\n',
      ) + '\r\n',
    data = JSON.stringify(rows);
  const manifest: any = {
    schema: 'aplyd-academy-report-export/1',
    generatedAt: rollup.generatedAt,
    workspaceId: rollup.workspaceId,
    audience: rollup.audience,
    cohortIds: rollup.cohortIds,
    format,
    rowCount: rows.length,
    columns: [...EXPORT_COLUMNS],
    metricIds: [...new Set(Object.keys(COLUMN_METRIC).map((k) => COLUMN_METRIC[k]))],
    suppression: { threshold: SMALL_CELL_THRESHOLD, marker: SUPPRESSED },
    checksum: {
      algorithm: 'SHA-256',
      covers:
        format === 'csv'
          ? 'The CSV file content exactly as downloaded.'
          : 'JSON.stringify of the data array.',
      value: sha256Hex(format === 'csv' ? csv : data),
    },
    limits: LIMITS,
  };
  const day = rollup.generatedAt.slice(0, 10),
    base = `aplyd-academy-report-${day}`;
  return format === 'csv'
    ? {
        filename: base + '.csv',
        mime: 'text/csv;charset=utf-8',
        content: csv,
        manifest,
        manifestJson: JSON.stringify(manifest, null, 2),
      }
    : {
        filename: base + '.json',
        mime: 'application/json',
        content: JSON.stringify({ manifest, data: rows }, null, 2),
        manifest,
        manifestJson: JSON.stringify(manifest, null, 2),
      };
}
export function verifyReportExport(content: string, format: 'csv' | 'json', manifest?: any): boolean {
  try {
    if (format === 'csv') return !!manifest && sha256Hex(content) === manifest.checksum.value;
    const p = JSON.parse(content);
    return sha256Hex(JSON.stringify(p.data)) === p.manifest.checksum.value;
  } catch {
    return false;
  }
}

/** Dependency-free synchronous SHA-256 (hex) so manifests are identical in the Worker, browser and tests. */
const K = (() => {
  const k: number[] = [];
  for (let n = 2; k.length < 64; n++) {
    let p = true;
    for (let d = 2; d * d <= n; d++)
      if (n % d === 0) {
        p = false;
        break;
      }
    if (p) k.push(Math.floor((Math.cbrt(n) % 1) * 4294967296));
  }
  return k;
})();
const H0 = (() => {
  const h: number[] = [];
  for (let n = 2; h.length < 8; n++) {
    let p = true;
    for (let d = 2; d * d <= n; d++)
      if (n % d === 0) {
        p = false;
        break;
      }
    if (p) h.push(Math.floor((Math.sqrt(n) % 1) * 4294967296));
  }
  return h;
})();
export function sha256Hex(input: string): string {
  const msg = new TextEncoder().encode(input),
    len = msg.length,
    padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  dv.setUint32(padded.length - 4, (len << 3) >>> 0);
  const h = [...H0],
    w = new Uint32Array(64),
    rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2];
      w[i] =
        (w[i - 16] +
          (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
          w[i - 7] +
          (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>>
        0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0,
        t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}
