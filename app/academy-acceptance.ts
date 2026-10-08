/** Context-bound API envelope acceptance. Server projection remains authoritative. */
import {
  AcademyResponseError,
  academyObject,
  verifiedAcademyState,
  verifiedAcademySubject,
} from './academy-response';
import curriculum, {
  contentRef,
  createCurriculumRegistry,
  curriculumRegistry,
  currentRef,
} from '../lib/academy-curriculum';

export type AcceptanceExpectation =
  | { mode: 'read'; workspace: 'lab' }
  | { mode: 'read'; workspace: 'team'; teamId: string }
  | { mode: 'write'; workspace: 'lab'; accountId: string; sourceRevision?: number }
  | {
      mode: 'write';
      workspace: 'team';
      accountId: string;
      teamId?: string;
      commandType: string;
      actionId: string;
      sourceRevision?: number;
    };
export type AcceptedAcademyPayload = {
  actor: string;
  revision: number;
  serverState: any;
  viewState: any;
  team: any | null;
  contentVersions: any[];
};
const str = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const objects = (v: unknown): v is Record<string, any>[] => Array.isArray(v) && v.every(academyObject);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v));
const roles = ['admin', 'learner', 'facilitator', 'assessor', 'reviewer', 'moderator'];
const safeRoles = (v: unknown) =>
  strings(v) && new Set(v).size === v.length && v.every((r) => roles.includes(r));
const textFields = (value: any, keys: string[]) => academyObject(value) && keys.every((k) => str(value[k]));
const optionalObjects = (value: any, key: string) => !Object.hasOwn(value, key) || objects(value[key]);
const reject = (mode: 'read' | 'write', status = 200): never => {
  throw new AcademyResponseError(status, true, mode);
};

/** Only missing auxiliary view arrays receive harmless defaults. Raw server bytes stay separate. */
export function academyViewState(state: any) {
  if (!verifiedAcademyState(state)) return null;
  const copy = { ...state };
  for (const key of ['posts', 'reports', 'deliveries', 'followups']) {
    if (!Object.hasOwn(state, key)) copy[key] = [];
    else if (!objects(state[key])) return null;
  }
  for (const key of ['interests', 'paused', 'seen']) {
    if (!Object.hasOwn(state, key)) copy[key] = [];
    else if (!strings(state[key])) return null;
  }
  if (Object.hasOwn(state, 'connections') && !academyObject(state.connections)) return null;
  if (!Object.hasOwn(state, 'connections')) copy.connections = {};
  // Stored malformed own ecosystem history remains diagnostic data for its existing
  // strict workbench reader. Never synthesize grants or prevent valid withdrawal.
  for (const post of copy.posts) {
    if (!textFields(post, ['id', 'title', 'body', 'status']) || !objects(post.replies)) return null;
    if (post.replies.some((reply: any) => !textFields(reply, ['id', 'body', 'status']))) return null;
  }
  if (copy.followups.some((f: any) => !textFields(f, ['id', 'reflection']))) return null;
  return copy;
}

function lessonRenderShape(l: any): boolean {
  return (
    textFields(l, ['id', 'title', 'objective', 'lessonText', 'reflectionPrompt']) &&
    finite(l.estimatedMinutes) &&
    textFields(l.exercise, ['title', 'learnerTask', 'suppliedAiDraft', 'optionalAiPrompt']) &&
    Array.isArray(l.exercise.sourcePacket) &&
    l.exercise.sourcePacket.every((r: any) => str(r) || academyObject(r)) &&
    objects(l.quiz) &&
    l.quiz.every(
      (q: any) =>
        textFields(q, ['id', 'question', 'explanation']) &&
        strings(q.options) &&
        Number.isInteger(q.correctOptionIndex) &&
        q.correctOptionIndex >= 0 &&
        q.correctOptionIndex < q.options.length,
    )
  );
}
function programRenderShape(p: any): boolean {
  if (
    !textFields(p, ['id', 'title', 'role', 'summary', 'ecosystem', 'promise', 'sourceNotice']) ||
    !strings(p.outcomes) ||
    !strings(p.credentialExclusions) ||
    !objects(p.lessons) ||
    !p.lessons.length ||
    !p.lessons.every(lessonRenderShape)
  )
    return false;
  const a = p.practicalAssessment;
  return (
    textFields(a, [
      'id',
      'title',
      'scenario',
      'assessorNote',
      'samplePassingEvidence',
      'sampleCriticalFailure',
    ]) &&
    objects(a.submissionPrompts) &&
    a.submissionPrompts.every((f: any) => textFields(f, ['id', 'label', 'help'])) &&
    objects(a.rubric) &&
    a.rubric.every(
      (r: any) =>
        textFields(r, ['id', 'dimension']) &&
        finite(r.weight) &&
        academyObject(r.anchors) &&
        ['0', '1', '2', '3', '4'].every((k) => str(r.anchors[k])) &&
        (r.criticalGate === null || str(r.criticalGate)),
    )
  );
}
/** Reject injected/duplicate/malformed snapshots; do not validate or replace enrollment pins. */
export function acceptedPrivateContent(value: unknown, workspace: string): any[] | null {
  if (value === undefined) return [];
  if (!objects(value)) return null;
  try {
    for (const s of value) {
      const ref = contentRef(s.ref);
      if (
        workspace === 'lab' ||
        ref.scope !== workspace ||
        !programRenderShape(s.program) ||
        s.program.id !== ref.programId ||
        !textFields(s, ['language', 'audience', 'classification'])
      )
        return null;
    }
    createCurriculumRegistry([
      ...curriculum.pathways.map((p) => curriculumRegistry.resolve(currentRef(p.id))),
      ...value,
    ] as any);
    return value;
  } catch {
    return null;
  }
}

function teamRenderShape(t: any): boolean {
  if (
    !textFields(t, ['id', 'name', 'purpose', 'context']) ||
    !safeRoles(t.roles) ||
    typeof t.active !== 'boolean' ||
    !objects(t.cohorts) ||
    !objects(t.assigned) ||
    !objects(t.summaries)
  )
    return false;
  if (!t.active && t.roles.length) return false;
  if (
    t.cohorts.some(
      (c: any) =>
        !textFields(c, ['id', 'title', 'programId', 'status']) || !finite(c.capacity) || !finite(c.occupied),
    )
  )
    return false;
  for (const key of ['members', 'invites', 'pending', 'activity', 'moderationHistory'])
    if (!optionalObjects(t, key)) return false;
  if (Object.hasOwn(t, 'network')) {
    const n = t.network;
    if (!academyObject(n) || !objects(n.directory) || !objects(n.sessions) || !optionalObjects(n, 'history'))
      return false;
    for (const s of n.sessions)
      if (
        !textFields(s, ['id', 'title', 'description', 'startsAt', 'endsAt']) ||
        !date(s.startsAt) ||
        !date(s.endsAt) ||
        (s.isHost && !objects(s.registrations))
      )
        return false;
    for (const h of n.history ?? [])
      if (!textFields(h, ['id', 'title']) || !date(h.startsAt) || !objects(h.attendance)) return false;
  }
  if (Object.hasOwn(t, 'support')) {
    const s = t.support;
    if (!academyObject(s) || !objects(s.mine) || !objects(s.queue) || !objects(s.assigned)) return false;
    for (const r of [...s.mine, ...s.assigned])
      if (
        !textFields(r, ['id', 'subject', 'status']) ||
        !objects(r.messages) ||
        !objects(r.resolutions) ||
        !objects(r.events) ||
        r.messages.some((m: any) => !textFields(m, ['id', 'body', 'actorName']))
      )
        return false;
  }
  if (Object.hasOwn(t, 'content')) {
    const c = t.content;
    if (!academyObject(c) || !objects(c.drafts) || !objects(c.publications)) return false;
  }
  return true;
}

/** Pure acceptance: caller must sequence-fence, then set state/ref/scratch side effects. */
export function acceptAcademyPayload(
  data: unknown,
  expected: AcceptanceExpectation,
  status = 200,
): AcceptedAcademyPayload {
  if (!academyObject(data) || !Number.isSafeInteger(data.revision) || data.revision < 0)
    return reject(expected.mode, status);
  const teamSpace = expected.workspace === 'team',
    actor = teamSpace ? data.team?.currentUserId : data.currentUserId;
  if (!verifiedAcademySubject(actor)) return reject(expected.mode, status);
  if (
    expected.mode === 'write' &&
    (!verifiedAcademySubject(expected.accountId) || actor !== expected.accountId)
  )
    return reject('write', status);
  if (
    expected.mode === 'write' &&
    expected.sourceRevision !== undefined &&
    (!Number.isSafeInteger(expected.sourceRevision) ||
      expected.sourceRevision < 0 ||
      data.revision <= expected.sourceRevision)
  )
    return reject('write', status);
  if (teamSpace) {
    const teamId =
      expected.mode === 'write' && expected.commandType === 'create'
        ? 'tw-' + expected.actionId
        : expected.teamId;
    if (
      !verifiedAcademySubject(teamId) ||
      !academyObject(data.team) ||
      data.team.id !== teamId ||
      !teamRenderShape(data.team)
    )
      return reject(expected.mode, status);
  } else if (data.team !== undefined && data.team !== null) return reject(expected.mode, status);
  const viewState = academyViewState(data.state),
    contentVersions = acceptedPrivateContent(data.contentVersions, teamSpace ? data.team.id : 'lab');
  if (!viewState || contentVersions === null) return reject(expected.mode, status);
  return {
    actor,
    revision: data.revision,
    serverState: data.state,
    viewState,
    team: teamSpace ? data.team : null,
    contentVersions,
  };
}

export function acceptAcademyDirectory(data: unknown, expectedAccount?: string, status = 200) {
  if (!academyObject(data) || !verifiedAcademySubject(data.user?.id) || !objects(data.workspaces))
    return reject('read', status);
  if (expectedAccount !== undefined && data.user.id !== expectedAccount) return reject('read', status);
  const ids = new Set<string>();
  for (const w of data.workspaces) {
    if (
      !textFields(w, ['id', 'name', 'context']) ||
      !verifiedAcademySubject(w.id) ||
      !safeRoles(w.roles) ||
      typeof w.active !== 'boolean' ||
      (!w.active && w.roles.length) ||
      ids.has(w.id)
    )
      return reject('read', status);
    ids.add(w.id);
  }
  return data;
}
