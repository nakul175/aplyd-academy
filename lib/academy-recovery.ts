// Workspace-level account recovery and assisted onboarding (BR-04).
// Scope: a shared workspace only. The personal lab is bound to the platform
// sign-in itself, so there is nothing a workspace admin could legitimately
// re-link there; recovery for it stays with the identity provider.
// Identity proofing is a DUMMY: an owner ticks 2 of 3 synthetic checks. No
// email, message or external lookup happens. Pure and synchronous; the team
// layer owns revision/actionId concurrency, this module owns authority rules.
import { freshWorkspace } from './academy-engine';
export class RecoveryRuleError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'RecoveryRuleError';
  }
}
export type RecoveryChecklist = { cohort: boolean; email: boolean; lastActivity: boolean };
export type RecoveryEvent = {
  id: string;
  type: 'filed' | 'withdrawn' | 'approved' | 'declined';
  actorId: string;
  actorName: string;
  at: string;
  detail?: Record<string, unknown>;
};
export type RecoveryRequest = {
  id: string;
  version: number;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  requesterId: string;
  requesterName: string;
  claimedEmail: string;
  oldMemberId: string | null;
  cohortHint: string;
  activityHint: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  decision: null | {
    by: string;
    byName: string;
    at: string;
    reason: string;
    checklist: RecoveryChecklist;
    verifiedCount: number;
    verification: 'dummy-checklist';
  };
  relink: null | {
    fromUserId: string;
    toUserId: string;
    enrollments: number;
    hadLearnerRecord: boolean;
    posts: number;
    replies: number;
    reports: number;
    rolesBefore: string[];
    rolesAfter: string[];
  };
  events: RecoveryEvent[];
};
export type RecoveryTeam = {
  members: any[];
  learners: any[];
  posts: any[];
  reports: any[];
  cohorts: any[];
  activity?: any[];
  recovery?: RecoveryRequest[];
};
export const RECOVERY_LIMITS = {
  requests: 50,
  perRequester: 5,
  textMax: 300,
  reasonMin: 10,
  reasonMax: 500,
  requiredChecks: 2,
};
const commands = new Set(['recovery-request', 'recovery-withdraw', 'recovery-decide']);
export const isRecoveryCommand = (c: any) => !!c && typeof c.type === 'string' && commands.has(c.type);
const norm = (v: string) => v.trim().toLowerCase();
const exact = (c: any, keys: string[]) => {
  if (Object.keys(c).some((k) => !['type', ...keys].includes(k)))
    throw new RecoveryRuleError('This recovery request includes unsupported fields.', 400);
};
function text(v: any, label: string, min: number, max: number) {
  if (v === undefined && min === 0) return '';
  if (typeof v !== 'string' || v.trim().length < min || v.length > max)
    throw new RecoveryRuleError(`${label} needs ${min}–${max} characters.`);
  return v.trim();
}
const isAdmin = (m: any) => !!m && m.active && m.roles.includes('admin');
const learnerOnly = (m: any) => Array.isArray(m.roles) && m.roles.length === 1 && m.roles[0] === 'learner';
const snap = (n: any) => String(n || 'Academy member').slice(0, 80);
function stamp(now: string) {
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now)))
    throw new RecoveryRuleError('A valid timestamp is required.', 400);
  return new Date(now).toISOString();
}
function event(
  r: RecoveryRequest,
  type: RecoveryEvent['type'],
  actor: any,
  at: string,
  detail?: Record<string, unknown>,
) {
  r.events.push({
    id: crypto.randomUUID(),
    type,
    actorId: actor.userId,
    actorName: snap(actor.name),
    at,
    ...(detail ? { detail } : {}),
  });
  r.updatedAt = at;
  r.version++;
}
function audit(t: RecoveryTeam, actor: any, action: string, at: string, detail: Record<string, unknown>) {
  t.activity ??= [];
  t.activity.push({
    id: crypto.randomUUID(),
    actor: actor.userId,
    actorName: snap(actor.name),
    action,
    createdAt: at,
    detail,
  });
}
// Shell = only profile/prefs the platform creates lazily on first visit.
const stripShell = (s: any) => {
  const x = structuredClone(s);
  for (const k of ['profile', 'seen', 'learningAccess']) delete x[k];
  return JSON.stringify(x);
};
export const learnerRecordIsEmpty = (s: any) => stripShell(s) === stripShell(freshWorkspace());
function lastActivity(l: any) {
  const d: string[] = [];
  for (const e of l?.state.enrollments ?? []) {
    if (e.startedAt) d.push(e.startedAt);
    for (const a of e.attempts ?? []) if (a.submittedAt) d.push(a.submittedAt);
  }
  return d.sort().at(-1) ?? null;
}
export function applyRecoveryCommand(t: RecoveryTeam, actor: any, c: any, nowIn: string): boolean {
  if (!isRecoveryCommand(c)) return false;
  const now = stamp(nowIn);
  t.recovery ??= [];
  if (!actor?.active) throw new RecoveryRuleError('Workspace access is no longer active.', 403);
  if (c.type === 'recovery-request') {
    exact(c, ['claimedEmail', 'cohortHint', 'activityHint', 'note']);
    const email = text(c.claimedEmail, 'Previous account email', 3, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new RecoveryRuleError('Enter the email your previous account used.');
    const cohortHint = text(c.cohortHint, 'Cohort you remember', 0, 100),
      activityHint = text(c.activityHint, 'Last activity you remember', 0, 100),
      note = text(c.note, 'Note', 0, RECOVERY_LIMITS.textMax);
    if (t.recovery.some((r) => r.requesterId === actor.userId && r.status === 'pending'))
      throw new RecoveryRuleError('You already have a recovery request awaiting review.', 409);
    if (t.recovery.filter((r) => r.requesterId === actor.userId).length >= RECOVERY_LIMITS.perRequester)
      throw new RecoveryRuleError(
        'Recovery request limit reached for this account. Ask a workspace owner.',
        409,
      );
    if (t.recovery.length >= RECOVERY_LIMITS.requests)
      throw new RecoveryRuleError('This pilot workspace reached its recovery request limit.', 409);
    // Uniform outcome: an unmatched or own email is stored unresolved, so the
    // response never reveals which emails belong to workspace members.
    const old = t.members.find((m) => norm(m.email) === norm(email) && m.userId !== actor.userId);
    const r: RecoveryRequest = {
      id: crypto.randomUUID(),
      version: 0,
      status: 'pending',
      requesterId: actor.userId,
      requesterName: snap(actor.name),
      claimedEmail: norm(email),
      oldMemberId: old ? old.userId : null,
      cohortHint,
      activityHint,
      note,
      createdAt: now,
      updatedAt: now,
      decision: null,
      relink: null,
      events: [],
    };
    event(r, 'filed', actor, now);
    t.recovery.push(r);
    audit(t, actor, 'recovery-request', now, { requestId: r.id, requesterId: actor.userId });
    return true;
  }
  const r = t.recovery.find((r) => r.id === c.requestId);
  if (c.type === 'recovery-withdraw') {
    exact(c, ['requestId']);
    if (!r || r.requesterId !== actor.userId) throw new RecoveryRuleError('Recovery request not found.', 404);
    if (r.status !== 'pending')
      throw new RecoveryRuleError('This request was already decided or withdrawn.', 409);
    r.status = 'withdrawn';
    event(r, 'withdrawn', actor, now);
    audit(t, actor, 'recovery-withdraw', now, { requestId: r.id });
    return true;
  }
  // recovery-decide
  exact(c, ['requestId', 'decision', 'reason', 'checklist', 'reviewedVersion']);
  if (!isAdmin(actor))
    throw new RecoveryRuleError('Your current membership does not permit this action.', 403);
  if (!r) throw new RecoveryRuleError('Recovery request not found.', 404);
  if (r.requesterId === actor.userId)
    throw new RecoveryRuleError('A recovery request cannot be decided by the person who filed it.', 403);
  if (!['approve', 'decline'].includes(c.decision)) throw new RecoveryRuleError('Choose approve or decline.');
  const reason = text(c.reason, 'Decision reason', RECOVERY_LIMITS.reasonMin, RECOVERY_LIMITS.reasonMax);
  if (r.status !== 'pending')
    throw new RecoveryRuleError('This request was already decided or withdrawn.', 409);
  if (!Number.isInteger(c.reviewedVersion) || c.reviewedVersion !== r.version)
    throw new RecoveryRuleError('This request changed since you opened it. Refresh and review again.', 409);
  const k = c.checklist,
    keys = ['cohort', 'email', 'lastActivity'];
  if (
    !k ||
    typeof k !== 'object' ||
    Array.isArray(k) ||
    Object.keys(k).some((x) => !keys.includes(x)) ||
    keys.some((x) => typeof k[x] !== 'boolean')
  )
    throw new RecoveryRuleError('Complete the verification checklist.');
  const checklist: RecoveryChecklist = { cohort: k.cohort, email: k.email, lastActivity: k.lastActivity },
    verifiedCount = keys.filter((x) => (checklist as any)[x]).length;
  if (c.decision === 'decline') {
    r.status = 'declined';
    r.decision = {
      by: actor.userId,
      byName: snap(actor.name),
      at: now,
      reason,
      checklist,
      verifiedCount,
      verification: 'dummy-checklist',
    };
    event(r, 'declined', actor, now, { reason });
    audit(t, actor, 'recovery-decline', now, {
      requestId: r.id,
      requesterId: r.requesterId,
      claimedMemberId: r.oldMemberId,
    });
    return true;
  }
  if (verifiedCount < RECOVERY_LIMITS.requiredChecks)
    throw new RecoveryRuleError(
      `Confirm at least ${RECOVERY_LIMITS.requiredChecks} of the 3 checks before approving, or decline.`,
      409,
    );
  const fresh = t.members.find((m) => m.userId === r.requesterId),
    old = t.members.find((m) => m.userId === r.oldMemberId);
  if (!fresh || !fresh.active)
    throw new RecoveryRuleError('The requesting account no longer has active workspace access.', 409);
  if (!old || old.userId === fresh.userId)
    throw new RecoveryRuleError('No matching previous member exists. Decline this request.', 409);
  if (!old.active || old.recoveredTo)
    throw new RecoveryRuleError(
      'The previous member is already inactive or recovered. Decline this request.',
      409,
    );
  if (!learnerOnly(old))
    throw new RecoveryRuleError(
      'Staff and owner access is re-issued by an owner through a new invitation, not by recovery.',
      409,
    );
  const freshLearner = t.learners.find((l) => l.userId === fresh.userId);
  if (freshLearner && !learnerRecordIsEmpty(freshLearner.state))
    throw new RecoveryRuleError(
      'The new account already holds its own learning records here, so they cannot be merged. An owner must resolve this outside recovery.',
      409,
    );
  // Relink. The learner aggregate (state) is moved as-is: enrollments, drafts,
  // attempts, decisions, curriculum pins and evidence are not rewritten.
  const oldLearner = t.learners.find((l) => l.userId === old.userId);
  if (freshLearner) t.learners.splice(t.learners.indexOf(freshLearner), 1);
  if (oldLearner) oldLearner.userId = fresh.userId;
  let posts = 0,
    replies = 0,
    reports = 0;
  for (const p of t.posts) {
    if (p.authorId === old.userId) {
      p.authorId = fresh.userId;
      posts++;
    }
    for (const x of p.replies ?? [])
      if (x.authorId === old.userId) {
        x.authorId = fresh.userId;
        replies++;
      }
  }
  for (const x of t.reports)
    if (x.reporterId === old.userId) {
      x.reporterId = fresh.userId;
      reports++;
    }
  const rolesBefore = [...fresh.roles];
  if (!fresh.roles.includes('learner')) fresh.roles = [...fresh.roles, 'learner'];
  for (const s of old.scopes ?? []) if (!fresh.scopes.includes(s)) fresh.scopes = [...fresh.scopes, s];
  const before = { active: old.active, roles: [...old.roles] };
  old.active = false;
  old.roles = [];
  old.scopes = [];
  old.recoveredTo = fresh.userId;
  old.recoveredAt = now;
  old.recoveredBy = actor.userId;
  fresh.recoveredFrom = old.userId;
  const enrollments = oldLearner?.state.enrollments.length ?? 0;
  r.status = 'approved';
  r.decision = {
    by: actor.userId,
    byName: snap(actor.name),
    at: now,
    reason,
    checklist,
    verifiedCount,
    verification: 'dummy-checklist',
  };
  r.relink = {
    fromUserId: old.userId,
    toUserId: fresh.userId,
    enrollments,
    hadLearnerRecord: !!oldLearner,
    posts,
    replies,
    reports,
    rolesBefore,
    rolesAfter: [...fresh.roles],
  };
  event(r, 'approved', actor, now, { fromUserId: old.userId, toUserId: fresh.userId, before, reason });
  audit(t, actor, 'recovery-approve', now, {
    requestId: r.id,
    fromUserId: old.userId,
    toUserId: fresh.userId,
    before: { oldActive: before.active, oldRoles: before.roles, newRoles: rolesBefore },
    after: { oldActive: false, newRoles: [...fresh.roles] },
    enrollments,
    verifiedCount,
  });
  return true;
}
// Assisted onboarding: validated before the existing 'invite' case runs and
// stamped onto the created invite after it, so token registration is unchanged.
export function takeAssistance(c: any, actor: any) {
  if (c?.type !== 'invite' || c.assistedNote === undefined) return null;
  if (!isAdmin(actor))
    throw new RecoveryRuleError('Your current membership does not permit this action.', 403);
  const note = text(c.assistedNote, 'Assistance note', 10, RECOVERY_LIMITS.textMax);
  const rest = { ...c };
  delete rest.assistedNote;
  return { note, rest };
}
export function stampAssistedInvite(
  t: RecoveryTeam & { invites: any[] },
  actor: any,
  note: string,
  now: string,
) {
  const i = t.invites.at(-1);
  if (!i) return;
  i.assisted = { by: actor.userId, byName: snap(actor.name), note, at: now };
  audit(t, actor, 'assisted-invite', now, { inviteId: i.id, note });
}
export function projectRecovery(t: RecoveryTeam, m: any, userId: string) {
  const all = t.recovery ?? [],
    admin = isAdmin(m);
  const own = all
    .filter((r) => r.requesterId === userId)
    .map((r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      claimedEmail: r.claimedEmail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      reason: r.decision?.reason ?? null,
      decidedAt: r.decision?.at ?? null,
    }));
  const queue = admin
    ? all.map((r) => {
        const old = t.members.find((x) => x.userId === r.oldMemberId),
          l = t.learners.find((l) => l.userId === r.oldMemberId),
          moved = r.relink ? t.learners.find((l) => l.userId === r.relink!.toUserId) : null;
        return {
          ...structuredClone(r),
          isOwn: r.requesterId === userId,
          candidate: old
            ? {
                name: old.name,
                email: old.email,
                active: old.active,
                recoverable: old.active && !old.recoveredTo && learnerOnly(old),
                cohorts: (l?.state.enrollments ?? [])
                  .map((e: any) => t.cohorts.find((c) => c.id === e.cohortId)?.title)
                  .filter(Boolean),
                enrollmentCount: l?.state.enrollments.length ?? 0,
                lastActivityAt: lastActivity(l),
              }
            : null,
          movedEnrollments: moved ? moved.state.enrollments.length : null,
        };
      })
    : [];
  return {
    mine: own,
    queue,
    canDecide: admin,
    required: RECOVERY_LIMITS.requiredChecks,
    verification: 'dummy-checklist',
  };
}
