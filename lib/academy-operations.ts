import { canShowWorkspaceOperations } from './academy-operations-access';
export { canShowWorkspaceOperations } from './academy-operations-access';
/** Read-only derivation from projectTeam(...).team, never from a raw Team or state.
 * This model conveys observations, not command authority. Protected actions still
 * use the existing server roles, assignments and workspace revision fence. */
export const OPERATIONS_LIMITS = {
  cohorts: 20,
  summaries: 5000,
  pending: 5000,
  assigned: 5000,
  support: 100,
  sessions: 100,
  drafts: 24,
  publications: 8,
  rows: 8,
} as const;
export type OperationsDestination = {
  view: 'teams' | 'studio' | 'support' | 'network';
  section?: 'cohorts' | 'progress' | 'assignments' | 'content' | 'queue' | 'assigned' | 'sessions';
  id?: string;
};
export type CohortOperation = {
  id: string;
  title: string;
  status: 'open' | 'closed' | 'paused' | 'unknown';
  capacity: number | null;
  occupied: number | null;
  newEnrollmentBlocked: boolean;
  contentNotice: string | null;
  enrollments: number;
  nonWithdrawn: number;
  learning: number;
  reviewPending: number;
  appealPending: number;
  practiceCompleted: number;
  suspendedPracticeRecords: number;
  withdrawn: number;
  other: number;
  savedLessons: number;
};
export type ReviewOperation = {
  id: string;
  kind: 'assessment' | 'appeal';
  cohortId: string;
  cohortTitle: string;
  learnerName: string;
  createdAt: string | null;
  ageDays: number | null;
  assignment: 'mine' | 'assigned' | 'unassigned';
  assignedName: string | null;
  eligibleStaffCount: number | null;
  paused: boolean;
  destination: OperationsDestination;
};
export type ContentOperation = {
  id: string;
  title: string;
  kind: 'publication' | 'draft';
  state: 'review_due' | 'review_soon' | 'review_date_unknown' | 'in_review' | 'approved';
  reviewDueAt: string | null;
  waitingSince: string | null;
  ageDays: number | null;
  reviewerName: string | null;
  reviewerAvailable: boolean | null;
};
export type SupportOperation = {
  id: string;
  category: string;
  cohortId: string | null;
  cohortTitle: string;
  createdAt: string | null;
  updatedAt: string | null;
  openedDaysAgo: number | null;
  handledByMe: boolean;
  handlerName: string | null;
  needsHandler: boolean;
  independentHandlerAvailable: boolean;
  canClaim: boolean;
};
export type SessionOperation = {
  id: string;
  title: string;
  cohortId: string;
  cohortTitle: string;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  occupied: number | null;
  isHost: boolean;
  hostAvailable: boolean;
  paused: boolean;
  unrecordedAttendance: number | null;
  phase: 'upcoming' | 'in_progress' | 'attendance_window';
};
export type WorkspaceOperations = {
  workspaceId: string;
  workspaceName: string;
  audience: 'owner' | 'facilitator';
  asOf: string;
  cohorts: CohortOperation[];
  totals: { cohorts: number; nonWithdrawnEnrollments: number; practiceRecords: number; savedLessons: number };
  reviews: {
    scope: 'workspace' | 'my_assignments';
    total: number;
    assessments: number;
    appeals: number;
    unassigned: number | null;
    withoutEligibleStaff: number | null;
    paused: number;
    oldestDays: number | null;
    items: ReviewOperation[];
  };
  content: {
    available: boolean;
    reviewDue: number;
    reviewDateUnknown: number;
    reviewSoon: number;
    awaitingReview: number;
    approved: number;
    items: ContentOperation[];
  };
  support: {
    totalOpen: number;
    needsHandler: number;
    withoutIndependentHandler: number;
    handledByMe: number;
    items: SupportOperation[];
  };
  sessions: {
    total: number;
    nextSevenDays: number;
    hostUnavailable: number;
    attendanceToRecord: number;
    items: SessionOperation[];
  };
};
const DAY = 86400000;
const clean = (v: unknown, fallback = '', max = 160) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const id = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 160 ? v : null);
const subject = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 1800000 ? v : null);
const amount = (v: unknown, max = 500000) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
const iso = (v: unknown) => {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    return null;
  return new Date(v).toISOString() === v ? v : null;
};
const age = (v: unknown, clock: number) => {
  const date = iso(v);
  return date && Date.parse(date) <= clock ? Math.floor((clock - Date.parse(date)) / DAY) : null;
};
const list = (v: unknown, cap: number): any[] | null =>
  v === undefined ? [] : Array.isArray(v) && v.length <= cap ? v : null;
const sameKey = (q: any) => `${q?.kind}:${q?.targetId}`;
const oldest = (a: { createdAt: string | null; id: string }, b: { createdAt: string | null; id: string }) =>
  (a.createdAt ? Date.parse(a.createdAt) : Infinity) - (b.createdAt ? Date.parse(b.createdAt) : Infinity) ||
  a.id.localeCompare(b.id);

/** Null means no current staff authority, malformed snapshot, or bounded-input
 * refusal. Never invent totals from a partially processed oversized snapshot. */
export function deriveWorkspaceOperations(team: any, now: string): WorkspaceOperations | null {
  if (!canShowWorkspaceOperations(team) || !iso(now) || !id(team.id)) return null;
  const owner = team.roles.includes('admin'),
    clock = Date.parse(now);
  const cohorts = list(team.cohorts, OPERATIONS_LIMITS.cohorts),
    summaries = list(team.summaries, OPERATIONS_LIMITS.summaries),
    pending = list(team.pending, OPERATIONS_LIMITS.pending),
    assigned = list(team.assigned, OPERATIONS_LIMITS.assigned),
    queue = list(team.support?.queue, OPERATIONS_LIMITS.support),
    handledRequests = list(team.support?.assigned, OPERATIONS_LIMITS.support),
    sessions = list(team.network?.sessions, OPERATIONS_LIMITS.sessions),
    drafts = owner ? list(team.content?.drafts, OPERATIONS_LIMITS.drafts) : [],
    publications = owner ? list(team.content?.publications, OPERATIONS_LIMITS.publications) : [],
    members = owner ? list(team.members, 100) : [];
  if (
    !cohorts ||
    !summaries ||
    !pending ||
    !assigned ||
    !queue ||
    !handledRequests ||
    !sessions ||
    !drafts ||
    !publications ||
    !members
  )
    return null;
  // canHost is a canonical current owner/facilitator scope bit. boardAccess and
  // learner-visible cohorts are intentionally broader and cannot select this set.
  const scoped = cohorts.filter((c) => c && id(c.id) && c.canHost === true),
    byId = new Map<string, CohortOperation>();
  for (const c of scoped) {
    if (byId.has(c.id)) continue;
    byId.set(c.id, {
      id: c.id,
      title: clean(c.title, 'Unnamed cohort', 100),
      status: ['open', 'closed', 'paused'].includes(c.status) ? c.status : 'unknown',
      capacity: amount(c.capacity, 100),
      occupied: amount(c.occupied, 100),
      newEnrollmentBlocked: c.contentOpen === false || c.status === 'closed' || c.status === 'paused',
      contentNotice:
        c.contentOpen === false ? clean(c.contentNotice, 'New enrollment is unavailable.', 300) : null,
      enrollments: 0,
      nonWithdrawn: 0,
      learning: 0,
      reviewPending: 0,
      appealPending: 0,
      practiceCompleted: 0,
      suspendedPracticeRecords: 0,
      withdrawn: 0,
      other: 0,
      savedLessons: 0,
    });
  }
  for (const row of summaries) {
    const co = byId.get(row?.cohortId);
    if (!co) continue;
    co.enrollments++;
    co.savedLessons += amount(row.completedLessons, 100) ?? 0;
    if (row.status === 'Learning') co.learning++;
    else if (row.status === 'Withdrawn') co.withdrawn++;
    else if (!['Review pending', 'Appeal pending', 'Practice completed'].includes(row.status)) co.other++;
    if (row.status !== 'Withdrawn') co.nonWithdrawn++;
    // Thin canonical metadata may overlap: an active record is retained during
    // an open appeal. Never infer suspension merely from the appeal flag.
    if (
      Object.hasOwn(row, 'practiceRecordStatus')
        ? row.practiceRecordStatus === 'active'
        : row.status === 'Practice completed'
    )
      co.practiceCompleted++;
    if (row.practiceRecordStatus === 'suspended') co.suspendedPracticeRecords++;
    if (
      typeof row.hasPendingAssessment === 'boolean'
        ? row.hasPendingAssessment
        : row.status === 'Review pending'
    )
      co.reviewPending++;
    if (typeof row.hasOpenAppeal === 'boolean' ? row.hasOpenAppeal : row.status === 'Appeal pending')
      co.appealPending++;
  }
  const names = new Map<string, string>();
  if (owner)
    for (const m of members)
      if (subject(m?.userId)) names.set(m.userId, clean(m.name, 'Workspace member', 80));
  const myKeys = new Set(assigned.filter((q) => byId.has(q?.cohortId)).map(sameKey)),
    reviewRows: ReviewOperation[] = [],
    seenReview = new Set<string>();
  for (const q of owner ? pending : assigned) {
    const co = byId.get(q?.cohortId),
      target = id(q?.targetId);
    if (!co || !target || !['assessment', 'appeal'].includes(q.kind) || seenReview.has(sameKey(q))) continue;
    seenReview.add(sameKey(q));
    if (q.assignedTo != null && !subject(q.assignedTo)) return null;
    const mine = myKeys.has(sameKey(q)),
      assignedId = subject(q.assignedTo);
    reviewRows.push({
      id: target,
      kind: q.kind,
      cohortId: co.id,
      cohortTitle: co.title,
      learnerName: clean(q.learnerName, 'Learner', 80),
      createdAt: iso(q.createdAt),
      ageDays: age(q.createdAt, clock),
      assignment: mine ? 'mine' : assignedId ? 'assigned' : 'unassigned',
      assignedName: mine ? 'You' : assignedId ? (names.get(assignedId) ?? 'Assigned staff') : null,
      eligibleStaffCount: owner && Array.isArray(q.eligibleStaff) ? q.eligibleStaff.length : null,
      paused: co.status === 'paused',
      destination: mine
        ? { view: 'studio', id: target }
        : { view: 'teams', section: 'assignments', id: target },
    });
  }
  reviewRows.sort(oldest);
  const contentRows: ContentOperation[] = [],
    dueSoon = clock + 7 * DAY;
  if (owner) {
    for (const p of publications) {
      if (!id(p?.id) || p.availability !== 'available') continue;
      const due = iso(p.reviewDueAt),
        value = due ? Date.parse(due) : NaN;
      if (due && value > dueSoon) continue;
      contentRows.push({
        id: p.id,
        title: clean(p.title, 'Private publication', 200),
        kind: 'publication',
        state: !due ? 'review_date_unknown' : value <= clock ? 'review_due' : 'review_soon',
        reviewDueAt: due,
        waitingSince: null,
        ageDays: null,
        reviewerName: clean(p.reviewerName, 'Reviewer', 80),
        reviewerAvailable: null,
      });
    }
    for (const d of drafts) {
      if (!id(d?.id) || !['in_review', 'approved'].includes(d.state)) continue;
      const reviewer = members.find((m: any) => m?.userId === d.reviewerId);
      contentRows.push({
        id: d.id,
        title: clean(d.document?.title, 'Untitled private draft', 200),
        kind: 'draft',
        state: d.state,
        reviewDueAt: iso(d.reviewDueAt),
        waitingSince: iso(d.updatedAt),
        ageDays: age(d.updatedAt, clock),
        reviewerName: reviewer ? clean(reviewer.name, 'Reviewer', 80) : null,
        reviewerAvailable:
          !!reviewer &&
          reviewer.active === true &&
          Array.isArray(reviewer.roles) &&
          reviewer.roles.includes('admin') &&
          reviewer.userId !== d.authorId,
      });
    }
    const priority = { review_due: 0, review_date_unknown: 1, in_review: 2, approved: 3, review_soon: 4 };
    contentRows.sort(
      (a, b) =>
        priority[a.state] - priority[b.state] ||
        (a.reviewDueAt ? Date.parse(a.reviewDueAt) : Infinity) -
          (b.reviewDueAt ? Date.parse(b.reviewDueAt) : Infinity) ||
        a.id.localeCompare(b.id),
    );
  }
  const handled = new Set(handledRequests.map((r: any) => r?.id)),
    supportRows: SupportOperation[] = [],
    supportSeen = new Set<string>();
  for (const r of queue) {
    if (!id(r?.id) || r.status !== 'open' || supportSeen.has(r.id)) continue;
    const co = r.cohortId === null ? null : byId.get(r.cohortId);
    if (!owner && (!co || !['learning', 'content'].includes(r.category))) continue;
    supportSeen.add(r.id);
    supportRows.push({
      id: r.id,
      category: clean(r.category, 'support', 30),
      cohortId: co?.id ?? id(r.cohortId),
      cohortTitle:
        co?.title ?? (r.cohortId === null ? 'Workspace support' : clean(r.cohortTitle, 'Former cohort', 100)),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      openedDaysAgo: age(r.createdAt, clock),
      handledByMe: handled.has(r.id),
      handlerName: typeof r.handlerName === 'string' ? clean(r.handlerName, '', 80) : null,
      needsHandler: r.handlerName === null,
      independentHandlerAvailable: r.eligibleHandlerAvailable === true,
      canClaim: r.canClaim === true,
    });
  }
  supportRows.sort((a, b) => Number(b.needsHandler) - Number(a.needsHandler) || oldest(a, b));
  const sessionRows: SessionOperation[] = [],
    sessionSeen = new Set<string>();
  for (const s of sessions) {
    const co = byId.get(s?.cohortId);
    if (!co || !id(s?.id) || s.status !== 'scheduled' || sessionSeen.has(s.id)) continue;
    const start = iso(s.startsAt),
      end = iso(s.endsAt);
    if (!start || !end || Date.parse(end) <= Date.parse(start)) continue;
    const roster = s.isHost === true ? list(s.registrations, 100) : [];
    if (!roster) return null;
    const begins = Date.parse(start),
      ends = Date.parse(end),
      unrecorded = s.isHost === true ? roster.filter((r: any) => r && r.attendance === null).length : null,
      active = ends > clock && begins <= dueSoon,
      attendance = s.isHost === true && begins <= clock && clock <= ends + 7 * DAY && (unrecorded ?? 0) > 0;
    if (!active && !attendance) continue;
    sessionSeen.add(s.id);
    sessionRows.push({
      id: s.id,
      title: clean(s.title, 'Practice session', 120),
      cohortId: co.id,
      cohortTitle: co.title,
      startsAt: start,
      endsAt: end,
      capacity: amount(s.capacity, 100),
      occupied: amount(s.occupied, 100),
      isHost: s.isHost === true,
      hostAvailable: s.hostAvailable === true,
      paused: co.status === 'paused',
      unrecordedAttendance: unrecorded,
      phase: ends <= clock ? 'attendance_window' : begins <= clock ? 'in_progress' : 'upcoming',
    });
  }
  sessionRows.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || a.id.localeCompare(b.id));
  const cohortRows = [...byId.values()];
  return {
    workspaceId: team.id,
    workspaceName: clean(team.name, 'Workspace', 80),
    audience: owner ? 'owner' : 'facilitator',
    asOf: now,
    cohorts: cohortRows,
    totals: {
      cohorts: cohortRows.length,
      nonWithdrawnEnrollments: cohortRows.reduce((n, c) => n + c.nonWithdrawn, 0),
      practiceRecords: cohortRows.reduce((n, c) => n + c.practiceCompleted, 0),
      savedLessons: cohortRows.reduce((n, c) => n + c.savedLessons, 0),
    },
    reviews: {
      scope: owner ? 'workspace' : 'my_assignments',
      total: reviewRows.length,
      assessments: reviewRows.filter((q) => q.kind === 'assessment').length,
      appeals: reviewRows.filter((q) => q.kind === 'appeal').length,
      unassigned: owner ? reviewRows.filter((q) => q.assignment === 'unassigned').length : null,
      withoutEligibleStaff: owner ? reviewRows.filter((q) => q.eligibleStaffCount === 0).length : null,
      paused: reviewRows.filter((q) => q.paused).length,
      oldestDays: reviewRows.reduce<number | null>(
        (n, q) => (q.ageDays === null ? n : n === null ? q.ageDays : Math.max(n, q.ageDays)),
        null,
      ),
      items: reviewRows.slice(0, OPERATIONS_LIMITS.rows),
    },
    content: {
      available: owner,
      reviewDue: contentRows.filter((c) => c.state === 'review_due').length,
      reviewDateUnknown: contentRows.filter((c) => c.state === 'review_date_unknown').length,
      reviewSoon: contentRows.filter((c) => c.state === 'review_soon').length,
      awaitingReview: contentRows.filter((c) => c.state === 'in_review').length,
      approved: contentRows.filter((c) => c.state === 'approved').length,
      items: contentRows.slice(0, OPERATIONS_LIMITS.rows),
    },
    support: {
      totalOpen: supportRows.length,
      needsHandler: supportRows.filter((r) => r.needsHandler).length,
      withoutIndependentHandler: supportRows.filter((r) => r.needsHandler && !r.independentHandlerAvailable)
        .length,
      handledByMe: supportRows.filter((r) => r.handledByMe).length,
      items: supportRows.slice(0, OPERATIONS_LIMITS.rows),
    },
    sessions: {
      total: sessionRows.length,
      nextSevenDays: sessionRows.filter((s) => s.phase !== 'attendance_window').length,
      hostUnavailable: sessionRows.filter((s) => s.phase !== 'attendance_window' && !s.hostAvailable).length,
      attendanceToRecord: sessionRows
        .filter((s) => s.isHost && s.phase !== 'upcoming')
        .reduce((n, s) => n + (s.unrecordedAttendance ?? 0), 0),
      items: sessionRows.slice(0, OPERATIONS_LIMITS.rows),
    },
  };
}
