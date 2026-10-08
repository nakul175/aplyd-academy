import { RuleError } from './academy-engine';
import type { Team } from './academy-teams';

/** Escalation of a discussion report from a scoped moderator to a workspace owner.
 * Pure rules only: runs inside the Team revision fence, sends nothing outside the
 * workspace and never infers authority from a client projection.
 * Scope: a moderator may escalate only reports on posts in cohorts in their current
 * scopes and sees only their own escalations; an active owner may decide any
 * escalation in this workspace (never across workspaces: the Team is the boundary). */
export const ESCALATION_SEVERITIES = ['low', 'medium', 'high', 'safeguarding'] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];
/** Internal response targets in hours from escalation. Targets for owners, not promises to reporters. */
export const ESCALATION_SLA_HOURS: Record<EscalationSeverity, number> = {
  low: 168,
  medium: 72,
  high: 24,
  safeguarding: 4,
};
export const ESCALATION_DECISIONS = ['resolve', 'dismiss'] as const;
export const MAX_ESCALATIONS = 200,
  MAX_ESCALATION_HISTORY = 10;
export const SAFEGUARDING_HANDLING_NOTE =
  'Safeguarding is for a risk of serious harm to a person, especially a child or a vulnerable adult. Academy keeps this escalation inside this workspace and sends no email, message or report to anyone outside it. Only workspace owners and the moderator who raised it can see it, and the reporter is told only that the report was reviewed. If someone may be in immediate danger, contact the local emergency or child-protection service yourself first, then follow your organisation’s safeguarding policy. Record the decision here afterwards. Do not paste more personal detail than the owner needs to act.';
export const REPORTER_NOTICE = {
  resolve: 'Your report was reviewed and action was taken.',
  dismiss: 'Your report was reviewed and no action was needed.',
} as const;
const NOT_FOUND_REPORT = 'Report not found.',
  NOT_FOUND_ESCALATION = 'Escalation not found.';
const commands = new Set(['escalate-report', 'escalation-resolve']);
const exact = (c: any, keys: string[]) => {
  if (Object.keys(c).some((k) => !['type', ...keys].includes(k)))
    throw new RuleError('This request includes unsupported fields.', 400);
};
const text = (v: any, label: string, min: number, max: number) => {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max)
    throw new RuleError(`${label} needs ${min}–${max} characters.`);
  return v.trim();
};
const isOwner = (m: any) => !!m && m.active === true && Array.isArray(m.roles) && m.roles.includes('admin');
const isScopedModerator = (m: any, cohortId: string) =>
  !!m &&
  m.active === true &&
  Array.isArray(m.roles) &&
  m.roles.includes('moderator') &&
  Array.isArray(m.scopes) &&
  m.scopes.includes(cohortId);
export function slaDueAt(severity: EscalationSeverity, escalatedAt: string) {
  return new Date(Date.parse(escalatedAt) + ESCALATION_SLA_HOURS[severity] * 3600000).toISOString();
}
export function escalationSla(
  e: { status: string; severity: EscalationSeverity; dueAt: string; resolution?: { at: string } | null },
  now: string,
) {
  const due = Date.parse(e.dueAt);
  if (e.status === 'open')
    return {
      dueAt: e.dueAt,
      overdue: Date.parse(now) > due,
      withinTarget: null as boolean | null,
      hoursOverdue: Math.max(0, Math.floor((Date.parse(now) - due) / 3600000)),
    };
  const at = e.resolution ? Date.parse(e.resolution.at) : NaN;
  return {
    dueAt: e.dueAt,
    overdue: false,
    withinTarget: Number.isFinite(at) ? at <= due : null,
    hoursOverdue: 0,
  };
}
function event(e: any, type: string, m: any, now: string, detail: Record<string, unknown> = {}) {
  if (e.history.length >= MAX_ESCALATION_HISTORY)
    throw new RuleError('This escalation reached its history limit.', 409);
  e.history.push({
    id: crypto.randomUUID(),
    type,
    actor: m.userId,
    actorName: String(m.name || 'Academy member').slice(0, 80),
    at: now,
    detail,
  });
}

export function applyEscalationCommand(t: Team, m: any, c: any, now: string): boolean {
  if (!c || !commands.has(c.type)) return false;
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now)))
    throw new RuleError('A valid timestamp is required.', 400);
  now = new Date(now).toISOString();
  const list = (t.escalations ??= []);
  if (c.type === 'escalate-report') {
    exact(c, ['reportId', 'severity', 'reason']);
    const rep = typeof c.reportId === 'string' ? t.reports.find((r) => r.id === c.reportId) : undefined,
      post = rep ? t.posts.find((p) => p.id === rep.postId) : undefined;
    // Unknown ids and out-of-scope ids produce the identical error.
    if (!rep || !post || !isScopedModerator(m, post.cohortId)) throw new RuleError(NOT_FOUND_REPORT, 404);
    if (!ESCALATION_SEVERITIES.includes(c.severity))
      throw new RuleError('Choose an escalation severity from the list.');
    const reason = text(c.reason, 'Escalation reason', 10, 1000);
    if (list.some((e) => e.reportId === rep.id))
      throw new RuleError('This report has already been escalated.', 409);
    if (list.length >= MAX_ESCALATIONS)
      throw new RuleError('Pilot escalation limit reached. Ask the workspace owner for support.', 409);
    const e: any = {
      id: crypto.randomUUID(),
      reportId: rep.id,
      postId: post.id,
      cohortId: post.cohortId,
      reporterId: rep.reporterId,
      severity: c.severity,
      reason,
      status: 'open',
      escalatedBy: m.userId,
      escalatedByName: String(m.name || 'Academy member').slice(0, 80),
      escalatedAt: now,
      dueAt: slaDueAt(c.severity, now),
      resolution: null,
      notice: null,
      history: [],
    };
    event(e, 'escalated', m, now, {
      severity: c.severity,
      slaHours: ESCALATION_SLA_HOURS[c.severity as EscalationSeverity],
    });
    list.push(e);
    return true;
  }
  exact(c, ['escalationId', 'decision', 'reason', 'expectedHistory', 'hidePost']);
  const e = typeof c.escalationId === 'string' ? list.find((x) => x.id === c.escalationId) : undefined;
  if (!isOwner(m) || !e) throw new RuleError(NOT_FOUND_ESCALATION, 404);
  if (!ESCALATION_DECISIONS.includes(c.decision)) throw new RuleError('Choose resolve or dismiss.');
  const reason = text(c.reason, 'Decision reason', 10, 1000),
    post = t.posts.find((p) => p.id === e.postId);
  if (c.hidePost !== undefined && typeof c.hidePost !== 'boolean')
    throw new RuleError('Choose whether to hide the discussion.');
  if (c.hidePost && c.decision !== 'resolve')
    throw new RuleError('A dismissed escalation cannot hide a discussion.');
  if (c.expectedHistory !== undefined && c.expectedHistory !== e.history.length)
    throw new RuleError('This escalation changed since you opened it. Refresh and review it again.', 409);
  if (e.status !== 'open') throw new RuleError('This escalation was already decided.', 409);
  if (m.userId === e.reporterId || m.userId === post?.authorId)
    throw new RuleError(
      'You cannot decide an escalation about your own report or post. Ask another workspace owner.',
      403,
    );
  let hid = false;
  if (c.hidePost && post && post.status !== 'hidden') {
    t.moderation ??= [];
    t.moderation.push({
      id: crypto.randomUUID(),
      postId: post.id,
      replyId: null,
      cohortId: post.cohortId,
      actor: m.userId,
      actorName: m.name,
      reason: `Escalation decision: ${reason}`.slice(0, 1000),
      previousStatus: post.status,
      status: 'hidden',
      createdAt: now,
    });
    post.status = 'hidden';
    for (const r of t.reports.filter((r) => r.postId === post.id)) r.status = 'resolved';
    hid = true;
  }
  e.status = c.decision === 'resolve' ? 'resolved' : 'dismissed';
  e.resolution = {
    decision: c.decision,
    reason,
    actor: m.userId,
    actorName: String(m.name || 'Workspace owner').slice(0, 80),
    at: now,
    hidPost: hid,
  };
  e.notice = {
    id: crypto.randomUUID(),
    outcome: c.decision === 'resolve' ? 'action-taken' : 'no-action',
    text: REPORTER_NOTICE[c.decision as 'resolve' | 'dismiss'],
    createdAt: now,
  };
  event(e, e.status, m, now, {
    decision: c.decision,
    hidPost: hid,
    withinTarget: escalationSla(e, now).withinTarget,
  });
  return true;
}

/** Per-viewer projection. Owners see all; a moderator sees only escalations they raised
 * in cohorts they still moderate. Reporter identity is never projected to anyone. */
export function projectEscalations(t: Team, m: any, now: string) {
  const owner = isOwner(m),
    list = t.escalations ?? [];
  const items = list
    .filter((e) => owner || (e.escalatedBy === m.userId && isScopedModerator(m, e.cohortId)))
    .map((e) => {
      const post = t.posts.find((p) => p.id === e.postId),
        sla = escalationSla(e, now),
        safeguarding = e.severity === 'safeguarding';
      const who = (h: any) => (owner ? h.actorName : h.actor === m.userId ? 'You' : 'Workspace owner');
      return {
        id: e.id,
        reportId: e.reportId,
        postId: e.postId,
        cohortId: e.cohortId,
        cohortTitle: t.cohorts.find((c) => c.id === e.cohortId)?.title ?? 'Former cohort',
        postTitle: post?.title ?? null,
        severity: e.severity,
        reason: e.reason,
        status: e.status,
        escalatedAt: e.escalatedAt,
        escalatedByName: owner ? e.escalatedByName : 'You',
        ...sla,
        slaHours: ESCALATION_SLA_HOURS[e.severity as EscalationSeverity],
        resolution: e.resolution
          ? {
              decision: e.resolution.decision,
              reason: owner || !safeguarding ? e.resolution.reason : null,
              at: e.resolution.at,
              hidPost: e.resolution.hidPost,
            }
          : null,
        history: e.history.map((h: any) => ({ id: h.id, type: h.type, at: h.at, actorName: who(h) })),
        historyLength: e.history.length,
      };
    })
    .sort(
      (a, b) =>
        Number(b.status === 'open') - Number(a.status === 'open') ||
        Date.parse(a.escalatedAt) - Date.parse(b.escalatedAt),
    );
  const notices = m.active
    ? list
        .filter((e) => e.status !== 'open' && e.notice && e.reporterId === m.userId)
        .map((e) => ({
          id: e.notice.id,
          reportId: e.reportId,
          outcome: e.notice.outcome,
          text: e.notice.text,
          createdAt: e.notice.createdAt,
        }))
    : [];
  const canEscalate = !!m.active && m.roles.includes('moderator'),
    staff = canEscalate || owner;
  return {
    severities: staff ? [...ESCALATION_SEVERITIES] : [],
    slaHours: staff ? { ...ESCALATION_SLA_HOURS } : {},
    handlingNote: staff ? SAFEGUARDING_HANDLING_NOTE : null,
    canEscalate,
    canDecide: owner,
    items,
    notices,
    counts: {
      open: items.filter((i) => i.status === 'open').length,
      overdue: items.filter((i) => i.overdue).length,
    },
  };
}
