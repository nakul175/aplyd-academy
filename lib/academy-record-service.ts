/** Read policy only: loaders supply trusted identity and CURRENT saved rows. No write or public lookup. */
import { curriculumRegistry, deepFreeze, type ContentScope } from './academy-curriculum';
import { freshWorkspace } from './academy-engine';
import { projectTeam, type Identity, type Team } from './academy-teams';
import { workspaceRegistry } from './academy-authoring';
import {
  lookupOwnPracticeRecord,
  lookupAssignedDecision,
  RecordCheckError,
  type RecordStatusResult,
} from './academy-record-check';

export type RecordCheckTarget = Readonly<{ kind: 'record' | 'decision'; id: string }>;
export type RecordCheckRequest = Readonly<{
  workspaceId: string | null;
  sourceRevision: number;
  target: RecordCheckTarget;
}>;
export type SavedRecordRow = Readonly<{ data: string; revision: number }>;
export type RecordCheckEnvelope = Readonly<{
  format: 'aplyd-academy-private-record-check';
  formatVersion: 1;
  currentUserId: string;
  workspaceId: string | null;
  sourceRevision: number;
  checkedAt: string;
  target: RecordCheckTarget;
  result: RecordStatusResult;
}>;
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const id = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(v);
const subject = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim() === v &&
  v.length > 0 &&
  v.length <= 300 &&
  !/[\u0000-\u001f\u007f]/.test(v);
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const canonicalTime = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;

/** sourceRevision is a read precondition, never an access grant. */
export function parseRecordCheckRequest(value: unknown): RecordCheckRequest {
  if (
    !plain(value) ||
    Object.keys(value).some(
      (k) => !['workspaceId', 'sourceRevision', 'recordId', 'decisionId'].includes(k),
    ) ||
    !Object.hasOwn(value, 'workspaceId') ||
    !Object.hasOwn(value, 'sourceRevision') ||
    !revision(value.sourceRevision) ||
    (value.workspaceId !== null &&
      (typeof value.workspaceId !== 'string' || !/^tw-[a-z0-9-]{20,80}$/i.test(value.workspaceId))) ||
    Object.hasOwn(value, 'recordId') === Object.hasOwn(value, 'decisionId')
  )
    throw new RecordCheckError('Choose an exact private record and current saved revision.', 400);
  const own = Object.hasOwn(value, 'recordId'),
    reference = value[own ? 'recordId' : 'decisionId'];
  if (!id(reference) || (!own && value.workspaceId === null))
    throw new RecordCheckError('Choose an exact private record or currently assigned shared appeal.', 400);
  return Object.freeze({
    workspaceId: value.workspaceId as string | null,
    sourceRevision: value.sourceRevision,
    target: Object.freeze({ kind: own ? 'record' : 'decision', id: reference }),
  });
}
export function assertRecordRevision(actual: unknown, expected: number): asserts actual is number {
  if (!revision(actual))
    throw new RecordCheckError('The saved learning revision is temporarily unavailable.', 503);
  if (actual !== expected)
    throw new RecordCheckError('Your learning space changed. Refresh before checking this record.', 409);
}

/** Only CURRENT canonical rows are passed here. Call the DB revision recheck before responding. */
export async function checkSavedPracticeRecord(
  input: Readonly<{
    user: Identity;
    request: RecordCheckRequest;
    row: SavedRecordRow | null;
    checkedAt: string;
  }>,
): Promise<RecordCheckEnvelope> {
  const { user, request, row, checkedAt } = input;
  if (!subject(user.userId) || !canonicalTime(checkedAt))
    throw new RecordCheckError('The authenticated record check is temporarily unavailable.', 503);
  let result: RecordStatusResult;
  if (request.workspaceId === null) {
    assertRecordRevision(row?.revision ?? 0, request.sourceRevision);
    if (request.target.kind !== 'record')
      throw new RecordCheckError('This assigned decision is unavailable for your account.', 404);
    const state = row ? JSON.parse(row.data) : freshWorkspace();
    result = await lookupOwnPracticeRecord(
      state,
      { recordId: request.target.id },
      {
        actorId: user.userId,
        learnerId: user.userId,
        space: 'personal',
        workspaceId: null,
        revision: request.sourceRevision,
        checkedAt,
        content: { registry: curriculumRegistry, allowedScopes: ['global'] },
      },
    );
  } else {
    if (!row) throw new RecordCheckError('This private learning space is unavailable for your account.', 404);
    const team = JSON.parse(row.data) as Team;
    if (!plain(team) || team.id !== request.workspaceId)
      throw new RecordCheckError('The saved learning space needs inspection.', 503);
    // projectTeam rechecks canonical membership, current scoped roles and pending assignment.
    // It permits retained inactive-member own history; it never grants old staff access.
    const projection = projectTeam(team, user);
    assertRecordRevision(row.revision, request.sourceRevision);
    const content = {
      registry: workspaceRegistry(team),
      allowedScopes: ['global', team.id] as ContentScope[],
    };
    const context = {
      actorId: user.userId,
      learnerId: user.userId,
      space: 'shared' as const,
      workspaceId: team.id,
      revision: request.sourceRevision,
      checkedAt,
      content,
    };
    if (request.target.kind === 'record')
      result = await lookupOwnPracticeRecord(projection.state, { recordId: request.target.id }, context);
    else {
      const matches = projection.team.assigned.filter(
        (q: any) => q.kind === 'appeal' && q.ap?.status === 'open' && q.a?.decision?.id === request.target.id,
      );
      if (matches.length !== 1 || !subject(matches[0].e?.learnerId))
        throw new RecordCheckError('This assigned decision is unavailable for your account.', 404);
      result = await lookupAssignedDecision(
        projection,
        { decisionId: request.target.id },
        { ...context, learnerId: matches[0].e.learnerId },
      );
    }
  }
  return deepFreeze({
    format: 'aplyd-academy-private-record-check',
    formatVersion: 1,
    currentUserId: user.userId,
    workspaceId: request.workspaceId,
    sourceRevision: request.sourceRevision,
    checkedAt,
    target: request.target,
    result,
  }) as RecordCheckEnvelope;
}
