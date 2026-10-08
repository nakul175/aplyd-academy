/** Authenticated client read service. Context must come from the current accepted Academy state. */
import { pinnedRef, tryResolvePinnedContent, type ContentContext } from '@/lib/academy-curriculum';
import {
  snapshotChecksum,
  lookupOwnPracticeRecord,
  lookupAssignedDecision,
} from '@/lib/academy-record-check';
import {
  acceptRecordCheckEnvelope,
  RecordResponseError,
  type AcceptedRecordResult,
  type RecordResponseExpectation,
} from '@/lib/academy-record-response';
export type PrivateRecordTarget = Readonly<{ recordId: string } | { decisionId: string }>;
export type RecordClientContext = Readonly<{
  accountId: string | null;
  workspace: string;
  authorityEpoch: number;
  sourceRevision: number;
  readGeneration: number;
  mounted: boolean;
  loading: boolean;
  saving: boolean;
  state: any;
  team: any | null;
  content: ContentContext;
}>;
export class RecordClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly unverified = false,
    public readonly stale = false,
  ) {
    super(message);
    this.name = 'RecordClientError';
  }
}
type Transport = (url: string, init: RequestInit) => Promise<Response>;
type Options = {
  getContext: () => RecordClientContext;
  transport?: Transport;
  onUnverifiedAccess: (status: number) => void;
  onRefreshRequired: (message: string) => void;
};
const subject = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim() === v &&
  v.length > 0 &&
  v.length <= 300 &&
  !/[\u0000-\u001f\u007f]/.test(v);
const plain = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const stamp = (c: RecordClientContext) =>
  JSON.stringify([
    c.accountId,
    c.workspace,
    c.authorityEpoch,
    c.sourceRevision,
    c.readGeneration,
    c.mounted,
    c.loading,
    c.saving,
  ]);
/** A newer lookup is fenced by the calling widget's signal/sequence. All awaits also check live scope. */
export function createPrivateRecordChecker(options: Options) {
  return async (target: PrivateRecordTarget, signal: AbortSignal): Promise<AcceptedRecordResult> => {
    const captured = options.getContext(),
      scope = stamp(captured);
    const current = () => !signal.aborted && stamp(options.getContext()) === scope;
    const requireCurrent = () => {
      if (!current())
        throw new RecordClientError(
          'This private check was cancelled because the learning space changed.',
          409,
          false,
          true,
        );
    };
    requireCurrent();
    if (
      !captured.mounted ||
      !subject(captured.accountId) ||
      captured.loading ||
      captured.saving ||
      !Number.isSafeInteger(captured.sourceRevision) ||
      captured.sourceRevision < 0
    )
      throw new RecordClientError('Refresh saved progress before checking your private record.', 409);
    if (
      !plain(target) ||
      Object.keys(target).length !== 1 ||
      Object.hasOwn(target, 'recordId') === Object.hasOwn(target, 'decisionId')
    )
      throw new RecordClientError('Choose an exact private record or current assigned appeal.', 400);
    const workspaceId = captured.workspace === 'lab' ? null : captured.workspace,
      own = Object.hasOwn(target, 'recordId'),
      id = own ? (target as { recordId: string }).recordId : (target as { decisionId: string }).decisionId;
    let enrollment: any, appeal: any, assigned: any;
    if (own) {
      const matches = captured.state?.enrollments?.filter((e: any) => e?.record?.id === id);
      if (!Array.isArray(matches) || matches.length !== 1)
        throw new RecordClientError('This record is unavailable in your own saved learning.', 404);
      enrollment = matches[0];
    } else {
      if (
        workspaceId === null ||
        captured.team?.active !== true ||
        captured.team?.id !== workspaceId ||
        captured.team?.currentUserId !== captured.accountId
      )
        throw new RecordClientError('This original decision is not in a current assigned appeal.', 404);
      const matches = captured.team.assigned?.filter(
        (q: any) =>
          q?.kind === 'appeal' &&
          q.ap?.status === 'open' &&
          q.a?.decision?.id === id &&
          q.targetId === q.ap?.id,
      );
      if (!Array.isArray(matches) || matches.length !== 1)
        throw new RecordClientError('This original decision is not in a current assigned appeal.', 404);
      assigned = matches[0];
      enrollment = assigned.e;
      appeal = assigned.ap;
    }
    // Detach only the exact own enrollment or already accepted current assigned-open queue.
    // A later caller edit cannot rewrite the expectation after the request was sent.
    const projection: any = own
      ? structuredClone({ enrollments: [enrollment] })
      : structuredClone({
          team: {
            id: captured.team.id,
            currentUserId: captured.team.currentUserId,
            active: captured.team.active,
            assigned: [assigned],
          },
        });
    enrollment = own ? projection.enrollments[0] : projection.team.assigned[0].e;
    if (!own) appeal = projection.team.assigned[0].ap;
    const content = {
      registry: captured.content.registry,
      allowedScopes: Object.freeze([...captured.content.allowedScopes]),
    };
    const pinned = tryResolvePinnedContent(enrollment, content.allowedScopes, content.registry);
    if (!pinned.available)
      throw new RecordClientError(
        'The exact saved course is unavailable. Keep your own record export for support.',
        409,
      );
    const fingerprint = await snapshotChecksum(pinned.snapshot.program);
    requireCurrent();
    const expectation: RecordResponseExpectation = {
      accountId: captured.accountId,
      workspaceId,
      sourceRevision: captured.sourceRevision,
      deriveExpectedResult: (checkedAt) => {
        const context = {
          actorId: captured.accountId!,
          learnerId: own ? captured.accountId! : enrollment.learnerId,
          space: workspaceId === null ? ('personal' as const) : ('shared' as const),
          workspaceId,
          revision: captured.sourceRevision,
          checkedAt,
          content,
        };
        return own
          ? lookupOwnPracticeRecord(projection, { recordId: id }, context)
          : lookupAssignedDecision(projection, { decisionId: id }, context);
      },
      target: own
        ? {
            kind: 'record',
            id,
            enrollmentId: enrollment.id,
            contentRef: pinnedRef(enrollment),
            contentFingerprint: fingerprint,
          }
        : {
            kind: 'decision',
            id,
            enrollmentId: enrollment.id,
            contentRef: pinnedRef(enrollment),
            contentFingerprint: fingerprint,
            appealId: appeal.id,
            learnerId: enrollment.learnerId,
          },
    };
    const response = await (options.transport ?? fetch)('/api/academy/records/check', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        sourceRevision: captured.sourceRevision,
        [own ? 'recordId' : 'decisionId']: id,
      }),
    });
    requireCurrent();
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      requireCurrent();
      const unverified = response.ok || [401, 403, 404].includes(response.status);
      if (unverified) options.onUnverifiedAccess(response.status);
      throw new RecordClientError(
        'The private record-check response could not be read. Refresh saved progress before checking again.',
        response.status,
        unverified,
      );
    }
    requireCurrent();
    if (!response.ok) {
      const message =
        plain(data) && typeof data.error === 'string' && data.error.length <= 1000
          ? data.error
          : 'This private record check is unavailable. Refresh saved progress and try again.';
      const unverified = [401, 403, 404].includes(response.status);
      if (unverified) options.onUnverifiedAccess(response.status);
      if (response.status === 409) options.onRefreshRequired(message);
      throw new RecordClientError(message, response.status, unverified);
    }
    try {
      const accepted = await acceptRecordCheckEnvelope(data, expectation);
      requireCurrent();
      return accepted.result;
    } catch (error) {
      requireCurrent();
      if (error instanceof RecordResponseError) {
        options.onUnverifiedAccess(response.status);
        throw new RecordClientError(error.message, response.status, true);
      }
      throw error;
    }
  };
}
