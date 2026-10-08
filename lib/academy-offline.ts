import {
  contentKey,
  pinnedRef,
  resolvePinnedContent,
  LEGACY_CONTENT_VERSION,
  LEGACY_SOURCE_SHA256,
  deepFreeze,
  type ContentRef,
} from './academy-curriculum';

/** Personal global-seed practice only. No storage, network, authorization grant or completion. */
export const OFFLINE_LIMITS = Object.freeze({
  packetBytes: 180_000,
  draftBytes: 250_000,
  queueBytes: 500_000,
  fieldCharacters: 10_000,
  readFreshMs: 120_000,
  draftLifetimeMs: 86_400_000,
  entries: 12,
});
export class OfflineDraftError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'OfflineDraftError';
  }
}
export type OfflineReadContext = {
  verified: boolean;
  currentUserId: string;
  workspaceId: string;
  revision: number;
  readAt: string;
  active: boolean;
  canLearn: boolean;
  pausedProgramIds: readonly string[];
  enrollments: readonly any[];
};
export type OfflineTarget = { kind: 'lesson'; lessonId: string } | { kind: 'practical' };
export type OfflinePacket = {
  schema: 1;
  kind: 'aplyd-reference-packet';
  contentRef: ContentRef;
  sourceSha256: string;
  language: 'en';
  classification: string;
  title: string;
  summary: string;
  notice: string;
  lessons: any[];
  practical: { title: string; scenario: string; prompts: { id: string; label: string; help: string }[] };
};
export type OfflineDraft = {
  schema: 1;
  kind: 'aplyd-unsent-draft';
  entryId: string;
  ownerId: string;
  workspaceId: 'lab';
  enrollmentId: string;
  contentRef: ContentRef;
  sourceSha256: string;
  target: OfflineTarget;
  baseRevision: number;
  generation: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  baseline: Record<string, string>;
  fields: Record<string, string>;
};
export type OfflineCommand =
  | {
      type: 'lesson-draft';
      enrollmentId: string;
      lessonId: string;
      practice: string;
      answers: (number | null)[];
    }
  | { type: 'draft'; enrollmentId: string; fields: Record<string, string> };
export type OfflineSaveTicket = {
  entryId: string;
  generation: number;
  ownerId: string;
  workspaceId: 'lab';
  enrollmentId: string;
  contentRef: ContentRef;
  target: OfflineTarget;
  expectedRevision: number;
  fields: Record<string, string>;
};
export type OfflineInspection =
  | { status: 'ready'; changedFields: string[] }
  | { status: 'already-saved'; changedFields: string[] }
  | { status: 'needs-review'; conflictingFields: string[] };

function fail(message: string, status = 409): never {
  throw new OfflineDraftError(message, status);
}
const object = (v: unknown): v is Record<string, any> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
function exact(v: unknown, keys: readonly string[], label: string): asserts v is Record<string, any> {
  if (!object(v) || Object.keys(v).some((k) => !keys.includes(k)) || keys.some((k) => !Object.hasOwn(v, k)))
    fail(`${label} is not a supported saved shape.`, 400);
}
function identifier(v: unknown, label: string): string {
  if (
    typeof v !== 'string' ||
    v.length < 1 ||
    v.length > 300 ||
    v.trim() !== v ||
    /[\u0000-\u001f\u007f]/.test(v)
  )
    fail(`${label} is invalid.`, 400);
  return v;
}
function time(v: unknown): number {
  if (
    typeof v !== 'string' ||
    v.length !== 24 ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString() !== v
  )
    fail('A canonical saved time is required.', 400);
  return Date.parse(v);
}
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).byteLength;
function seed(record: unknown) {
  let snapshot;
  try {
    snapshot = resolvePinnedContent(record, ['global']);
  } catch {
    fail('This exact saved content is unavailable. Reconnect and review your pathway.');
  }
  if (
    snapshot!.ref.scope !== 'global' ||
    snapshot!.ref.versionId !== LEGACY_CONTENT_VERSION ||
    snapshot!.language !== 'en'
  )
    fail('Offline packets currently support the unchanged global English practice seed only.');
  return snapshot!;
}
function target(value: unknown, program: any): OfflineTarget {
  if (!object(value)) fail('Choose a supported draft activity.', 400);
  if (value.kind === 'practical') {
    exact(value, ['kind'], 'Practical target');
    return { kind: 'practical' };
  }
  exact(value, ['kind', 'lessonId'], 'Lesson target');
  if (value.kind !== 'lesson' || !program.lessons.some((l: any) => l.id === value.lessonId))
    fail('The saved lesson does not belong to this exact pathway.', 404);
  return { kind: 'lesson', lessonId: value.lessonId };
}
function allowed(t: OfflineTarget, p: any): string[] {
  return t.kind === 'lesson' ? ['practice'] : p.practicalAssessment.submissionPrompts.map((f: any) => f.id);
}
function fields(value: unknown, ids: readonly string[], label: string) {
  if (!object(value) || Object.keys(value).some((k) => !ids.includes(k)))
    fail(`${label} contains unsupported fields.`, 400);
  const result: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v !== 'string' || v.length > OFFLINE_LIMITS.fieldCharacters)
      fail(`${label} must be text of at most 10,000 characters per field.`, 400);
    result[key] = v;
  }
  return result;
}
function fresh(ctx: OfflineReadContext, now: string) {
  const n = time(now);
  if (!ctx || ctx.verified !== true || ctx.active !== true || ctx.canLearn !== true)
    fail('Reconnect and verify your current learning access.', 403);
  identifier(ctx.currentUserId, 'Account');
  if (ctx.workspaceId !== 'lab') fail('Offline practice currently belongs in your personal lab only.', 403);
  if (
    !Number.isSafeInteger(ctx.revision) ||
    ctx.revision < 0 ||
    !Array.isArray(ctx.enrollments) ||
    ctx.enrollments.length > 50 ||
    !Array.isArray(ctx.pausedProgramIds)
  )
    fail('Reconnect and verify the saved learning space.', 400);
  const r = time(ctx.readAt);
  if (n < r || n - r > OFFLINE_LIMITS.readFreshMs)
    fail('Refresh saved progress before preparing an online save.');
  return ctx;
}
function own(ctx: OfflineReadContext, id: string) {
  identifier(id, 'Enrollment');
  const matches = ctx.enrollments.filter((e) => e && e.id === id);
  if (matches.length !== 1) fail('This enrollment is unavailable in your own personal lab.', 404);
  const e = matches[0];
  if (e.withdrawn === true) fail('This enrollment was withdrawn. Keep your unsent work separately.');
  if (e.withdrawn !== false) fail('Reconnect and verify the enrollment state.', 400);
  const s = seed(e);
  if (ctx.pausedProgramIds.includes(s.ref.programId))
    fail('This pathway is paused. Your unsent work must wait for online review.');
  return { e, s };
}
function onlineFields(e: any, t: OfflineTarget, p: any) {
  const ids = allowed(t, p);
  if (t.kind === 'lesson') {
    const saved = e.lessonDrafts?.[t.lessonId];
    if (saved !== undefined && !object(saved))
      fail('The saved lesson draft is invalid. Reconnect for help.', 400);
    const practice = saved?.practice ?? '';
    return fields({ practice }, ids, 'Saved lesson draft');
  }
  const saved = e.draft ?? {};
  const validated = fields(saved, ids, 'Saved practical draft');
  return Object.fromEntries(ids.map((id) => [id, validated[id] ?? '']));
}
function onlineAnswers(e: any, t: OfflineTarget): (number | null)[] {
  if (t.kind !== 'lesson') return [];
  const answers = e.lessonDrafts?.[t.lessonId]?.answers ?? [null, null, null];
  if (
    !Array.isArray(answers) ||
    answers.length !== 3 ||
    answers.some((a: any) => a !== null && (!Number.isInteger(a) || a < 0 || a > 3))
  )
    fail('The saved lesson answers are invalid. Reconnect for help.', 400);
  return [...answers];
}
function draftEligible(e: any, t: OfflineTarget, p: any) {
  if (
    !Array.isArray(e.completed) ||
    e.completed.some((id: any) => typeof id !== 'string' || !p.lessons.some((l: any) => l.id === id)) ||
    new Set(e.completed).size !== e.completed.length
  )
    fail('Verify the current lesson progress before preparing offline work.', 400);
  if (e.record?.status === 'active')
    fail(
      'This pathway is already complete. You can keep its source reference, but cannot queue another offline draft.',
    );
  if (t.kind === 'lesson') {
    const index = p.lessons.findIndex((l: any) => l.id === t.lessonId);
    if (e.completed.includes(t.lessonId))
      fail(
        'This lesson is already complete. Read its reference or use the normal learning screen for further notes.',
      );
    if (index > 0 && !e.completed.includes(p.lessons[index - 1].id))
      fail('Complete the earlier lesson online before opening this practice draft.');
    return;
  }
  if (!p.lessons.every((l: any) => e.completed.includes(l.id)))
    fail('Complete all lessons online before opening the practical draft.');
  if (
    !Array.isArray(e.attempts) ||
    !Array.isArray(e.appeals) ||
    e.attempts.some((a: any) => !object(a)) ||
    e.appeals.some((a: any) => !object(a))
  )
    fail('Verify current assessment history before opening a practical draft.', 400);
  if (e.attempts.some((a: any) => !a.decision) || e.appeals.some((a: any) => a.status === 'open'))
    fail('Wait for the pending assessment or appeal before preparing another practical draft.');
  if (e.attempts.length >= 3)
    fail('All three practical attempts are used. Review feedback and ask for support.');
}
function packetFor(record: unknown): OfflinePacket {
  const s = seed(record),
    p = s.program;
  const packet: OfflinePacket = {
    schema: 1,
    kind: 'aplyd-reference-packet',
    contentRef: { ...s.ref },
    sourceSha256: LEGACY_SOURCE_SHA256,
    language: 'en',
    classification: s.classification,
    title: p.title,
    summary: p.summary,
    notice:
      'Supplied fictional practice only. This file is a reference copy, not an access grant. Reading or working offline does not complete lessons, submit evidence, issue a practice record or authorize workplace action. A downloaded copy cannot be revoked or remotely deleted.',
    lessons: p.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      estimatedMinutes: l.estimatedMinutes,
      objective: l.objective,
      lessonText: l.lessonText,
      steps: [...l.steps],
      exercise: {
        title: l.exercise.title,
        sourcePacket: structuredClone(l.exercise.sourcePacket),
        suppliedAiDraft: l.exercise.suppliedAiDraft,
        learnerTask: l.exercise.learnerTask,
      },
      reflectionPrompt: l.reflectionPrompt,
      returnToWorkAction: l.returnToWorkAction,
    })),
    practical: {
      title: p.practicalAssessment.title,
      scenario: p.practicalAssessment.scenario,
      prompts: p.practicalAssessment.submissionPrompts.map((f) => ({
        id: f.id,
        label: f.label,
        help: f.help,
      })),
    },
  };
  if (bytes(packet) > OFFLINE_LIMITS.packetBytes)
    fail('This reference packet exceeds the offline size bound.');
  return deepFreeze(packet) as OfflinePacket;
}
export function buildOfflinePacket(
  ctx: OfflineReadContext,
  enrollmentId: string,
  now: string,
): OfflinePacket {
  fresh(ctx, now);
  const { e } = own(ctx, enrollmentId);
  return packetFor(e);
}
export function offlineDraftAvailability(
  ctx: OfflineReadContext,
  enrollmentId: string,
  inputTarget: OfflineTarget,
  now: string,
): { available: boolean; message: string } {
  try {
    fresh(ctx, now);
    const { e, s } = own(ctx, enrollmentId);
    draftEligible(e, target(inputTarget, s.program), s.program);
    return {
      available: true,
      message: 'This activity can prepare an unsent draft; completion and submission remain online.',
    };
  } catch (error) {
    return {
      available: false,
      message:
        error instanceof OfflineDraftError
          ? error.message
          : 'Refresh your own saved pathway before preparing offline work.',
    };
  }
}
export function readOfflinePacket(value: unknown): OfflinePacket {
  exact(
    value,
    [
      'schema',
      'kind',
      'contentRef',
      'sourceSha256',
      'language',
      'classification',
      'title',
      'summary',
      'notice',
      'lessons',
      'practical',
    ],
    'Reference packet',
  );
  if (bytes(value) > OFFLINE_LIMITS.packetBytes) fail('The saved reference packet is too large.', 400);
  const expected = packetFor({ contentRef: value.contentRef });
  if (JSON.stringify(value) !== JSON.stringify(expected))
    fail('This reference packet does not match the unchanged source. Download it again.');
  return expected;
}

export function createOfflineDraft(
  ctx: OfflineReadContext,
  enrollmentId: string,
  inputTarget: OfflineTarget,
  now: string,
  confirmedFictional: boolean,
  entryId = crypto.randomUUID(),
): OfflineDraft {
  fresh(ctx, now);
  if (confirmedFictional !== true)
    fail('Confirm that your offline practice will use fictional information only.', 400);
  const { e, s } = own(ctx, enrollmentId),
    t = target(inputTarget, s.program);
  draftEligible(e, t, s.program);
  const created = time(now),
    draft: OfflineDraft = {
      schema: 1,
      kind: 'aplyd-unsent-draft',
      entryId: identifier(entryId, 'Draft reference'),
      ownerId: ctx.currentUserId,
      workspaceId: 'lab',
      enrollmentId: e.id,
      contentRef: { ...s.ref },
      sourceSha256: LEGACY_SOURCE_SHA256,
      target: t,
      baseRevision: ctx.revision,
      generation: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(created + OFFLINE_LIMITS.draftLifetimeMs).toISOString(),
      baseline: onlineFields(e, t, s.program),
      fields: {},
    };
  return readOfflineDraft(draft, ctx.currentUserId, 'lab', now);
}
export function offlineDraftKey(draft: OfflineDraft): string {
  return JSON.stringify([
    draft.ownerId,
    draft.workspaceId,
    draft.enrollmentId,
    contentKey(draft.contentRef),
    draft.target.kind,
    draft.target.kind === 'lesson' ? draft.target.lessonId : null,
  ]);
}
export function readOfflineDraft(
  value: unknown,
  ownerId: string,
  workspaceId: string,
  now: string,
): OfflineDraft {
  exact(
    value,
    [
      'schema',
      'kind',
      'entryId',
      'ownerId',
      'workspaceId',
      'enrollmentId',
      'contentRef',
      'sourceSha256',
      'target',
      'baseRevision',
      'generation',
      'createdAt',
      'updatedAt',
      'expiresAt',
      'baseline',
      'fields',
    ],
    'Unsent draft',
  );
  identifier(ownerId, 'Current account');
  if (value.ownerId !== ownerId || value.workspaceId !== workspaceId || workspaceId !== 'lab')
    fail('This draft belongs to a different account or learning space.', 403);
  if (
    value.schema !== 1 ||
    value.kind !== 'aplyd-unsent-draft' ||
    value.sourceSha256 !== LEGACY_SOURCE_SHA256 ||
    bytes(value) > OFFLINE_LIMITS.draftBytes
  )
    fail('This unsent draft is unsupported or too large.', 400);
  identifier(value.entryId, 'Draft reference');
  identifier(value.enrollmentId, 'Enrollment');
  if (
    !Number.isSafeInteger(value.baseRevision) ||
    value.baseRevision < 0 ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 1
  )
    fail('The saved draft revision is invalid.', 400);
  const created = time(value.createdAt),
    updated = time(value.updatedAt),
    expires = time(value.expiresAt),
    n = time(now);
  if (updated < created || updated > n || n < created || expires - created !== OFFLINE_LIMITS.draftLifetimeMs)
    fail('The saved draft timing is inconsistent.', 400);
  if (n >= expires)
    fail('This local draft has expired. Reconnect and review it before creating another offline draft.');
  const s = seed({ contentRef: value.contentRef }),
    t = target(value.target, s.program),
    ids = allowed(t, s.program),
    base = fields(value.baseline, ids, 'Baseline draft'),
    changes = fields(value.fields, ids, 'Unsent draft');
  if (ids.some((id) => !Object.hasOwn(base, id))) fail('The saved draft baseline is incomplete.', 400);
  return deepFreeze(
    structuredClone({ ...value, target: t, baseline: base, fields: changes }),
  ) as OfflineDraft;
}
export function updateOfflineDraft(
  value: OfflineDraft,
  changes: Record<string, string>,
  now: string,
): OfflineDraft {
  const draft = readOfflineDraft(value, value.ownerId, value.workspaceId, now),
    s = seed({ contentRef: draft.contentRef }),
    next = fields(changes, allowed(draft.target, s.program), 'Unsent changes');
  if (Object.keys(next).length === 0) fail('Choose at least one draft field to change.', 400);
  if (draft.generation === Number.MAX_SAFE_INTEGER) fail('This local draft needs a fresh online review.');
  return readOfflineDraft(
    { ...draft, fields: { ...draft.fields, ...next }, generation: draft.generation + 1, updatedAt: now },
    draft.ownerId,
    'lab',
    now,
  );
}
function compare(value: OfflineDraft, ctx: OfflineReadContext, now: string) {
  fresh(ctx, now);
  const draft = readOfflineDraft(value, ctx.currentUserId, ctx.workspaceId, now),
    { e, s } = own(ctx, draft.enrollmentId);
  if (contentKey(s.ref) !== contentKey(draft.contentRef) || ctx.revision < draft.baseRevision)
    fail('The saved enrollment or revision changed. Review this draft online.');
  draftEligible(e, draft.target, s.program);
  const current = onlineFields(e, draft.target, s.program),
    changed = Object.keys(draft.fields).filter((id) => draft.fields[id] !== draft.baseline[id]);
  const conflicts = changed.filter(
    (id) => current[id] !== draft.baseline[id] && current[id] !== draft.fields[id],
  );
  const inspection: OfflineInspection = conflicts.length
    ? { status: 'needs-review', conflictingFields: conflicts }
    : changed.every((id) => current[id] === draft.fields[id])
      ? { status: 'already-saved', changedFields: changed }
      : { status: 'ready', changedFields: changed };
  return { draft, e, inspection };
}
export function inspectOfflineDraft(
  draft: OfflineDraft,
  ctx: OfflineReadContext,
  now: string,
): OfflineInspection {
  return compare(draft, ctx, now).inspection;
}
export function reviewOfflineDraft(
  draft: OfflineDraft,
  ctx: OfflineReadContext,
  now: string,
): { inspection: OfflineInspection; currentFields: Record<string, string> } {
  const checked = compare(draft, ctx, now),
    s = seed({ contentRef: checked.draft.contentRef });
  return deepFreeze({
    inspection: checked.inspection,
    currentFields: onlineFields(checked.e, checked.draft.target, s.program),
  }) as { inspection: OfflineInspection; currentFields: Record<string, string> };
}
/** Explicit own merge only; keeps the original expiry and never writes online. */
export function rebaseOfflineDraft(
  value: OfflineDraft,
  ctx: OfflineReadContext,
  now: string,
  mergedFields: Record<string, string>,
  confirmed: boolean,
): OfflineDraft {
  if (confirmed !== true) fail('Review both drafts and explicitly choose the merged text.', 400);
  const checked = compare(value, ctx, now),
    d = checked.draft,
    s = seed({ contentRef: d.contentRef }),
    merged = fields(mergedFields, allowed(d.target, s.program), 'Reviewed merge');
  if (!Object.keys(merged).length) fail('Choose the reviewed text before merging.', 400);
  if (d.generation === Number.MAX_SAFE_INTEGER) fail('This local draft needs a fresh start.');
  return readOfflineDraft(
    {
      ...d,
      baseRevision: ctx.revision,
      generation: d.generation + 1,
      updatedAt: now,
      baseline: onlineFields(checked.e, d.target, s.program),
      fields: merged,
    },
    d.ownerId,
    'lab',
    now,
  );
}
export function prepareOfflineSave(
  draft: OfflineDraft,
  ctx: OfflineReadContext,
  now: string,
  confirmed: boolean,
): { command: OfflineCommand; ticket: OfflineSaveTicket } {
  if (confirmed !== true) fail('Review the draft and choose Save as online draft.', 400);
  const checked = compare(draft, ctx, now);
  if (checked.inspection.status === 'needs-review')
    fail('Saved online text changed. Compare and merge it before saving.');
  if (checked.inspection.status === 'already-saved') fail('There are no unsaved text changes to send.');
  const changes = Object.fromEntries(
      checked.inspection.changedFields.map((id) => [id, checked.draft.fields[id]]),
    ),
    d = checked.draft;
  const command: OfflineCommand =
    d.target.kind === 'lesson'
      ? {
          type: 'lesson-draft',
          enrollmentId: d.enrollmentId,
          lessonId: d.target.lessonId,
          practice: changes.practice,
          answers: onlineAnswers(checked.e, d.target),
        }
      : { type: 'draft', enrollmentId: d.enrollmentId, fields: changes };
  return deepFreeze({
    command,
    ticket: {
      entryId: d.entryId,
      generation: d.generation,
      ownerId: d.ownerId,
      workspaceId: 'lab',
      enrollmentId: d.enrollmentId,
      contentRef: { ...d.contentRef },
      target: { ...d.target },
      expectedRevision: ctx.revision,
      fields: changes,
    },
  }) as { command: OfflineCommand; ticket: OfflineSaveTicket };
}
/** Only a verified write response with the exact saved fields acknowledges this generation. */
export function acknowledgeOfflineSave(
  value: OfflineDraft,
  ticket: OfflineSaveTicket,
  receipt: OfflineReadContext | undefined,
  now: string,
): { clear: boolean; reason: 'saved' | 'newer-local-edit' | 'unverified' } {
  try {
    if (!receipt) return { clear: false, reason: 'unverified' };
    fresh(receipt, now);
    exact(
      ticket,
      [
        'entryId',
        'generation',
        'ownerId',
        'workspaceId',
        'enrollmentId',
        'contentRef',
        'target',
        'expectedRevision',
        'fields',
      ],
      'Save acknowledgement',
    );
    const d = readOfflineDraft(value, receipt.currentUserId, receipt.workspaceId, now);
    if (d.entryId !== ticket.entryId || d.generation !== ticket.generation)
      return { clear: false, reason: 'newer-local-edit' };
    if (
      ticket.ownerId !== d.ownerId ||
      ticket.workspaceId !== d.workspaceId ||
      ticket.enrollmentId !== d.enrollmentId ||
      contentKey(ticket.contentRef) !== contentKey(d.contentRef) ||
      JSON.stringify(ticket.target) !== JSON.stringify(d.target) ||
      !Number.isSafeInteger(ticket.expectedRevision) ||
      ticket.expectedRevision < d.baseRevision ||
      receipt.revision <= ticket.expectedRevision
    )
      return { clear: false, reason: 'unverified' };
    const { e, s } = own(receipt, d.enrollmentId);
    if (contentKey(s.ref) !== contentKey(d.contentRef)) return { clear: false, reason: 'unverified' };
    const current = onlineFields(e, d.target, s.program),
      sent = fields(ticket.fields, allowed(d.target, s.program), 'Sent draft'),
      ids = Object.keys(sent),
      changed = Object.keys(d.fields).filter((id) => d.fields[id] !== d.baseline[id]);
    if (
      ids.length === 0 ||
      ids.length !== changed.length ||
      changed.some((id) => !Object.hasOwn(sent, id) || sent[id] !== d.fields[id] || current[id] !== sent[id])
    )
      return { clear: false, reason: 'unverified' };
    return { clear: true, reason: 'saved' };
  } catch {
    return { clear: false, reason: 'unverified' };
  }
}

export function readOfflineQueue(
  value: unknown,
  ownerId: string,
  workspaceId: string,
  now: string,
): OfflineDraft[] {
  if (
    !Array.isArray(value) ||
    value.length > OFFLINE_LIMITS.entries ||
    bytes(value) > OFFLINE_LIMITS.queueBytes
  )
    fail('The local draft queue is unsupported or full.', 400);
  const entries = value.map((d) => readOfflineDraft(d, ownerId, workspaceId, now));
  if (
    new Set(entries.map((d) => d.entryId)).size !== entries.length ||
    new Set(entries.map(offlineDraftKey)).size !== entries.length
  )
    fail('The local queue has conflicting draft references.', 400);
  return deepFreeze(entries) as OfflineDraft[];
}
export function putOfflineDraft(
  value: readonly OfflineDraft[],
  draft: OfflineDraft,
  now: string,
): OfflineDraft[] {
  const entries = readOfflineQueue([...value], draft.ownerId, draft.workspaceId, now),
    next = readOfflineDraft(draft, draft.ownerId, draft.workspaceId, now),
    same = entries.find((d) => offlineDraftKey(d) === offlineDraftKey(next));
  if (same && (same.entryId !== next.entryId || same.generation > next.generation))
    fail('A newer local draft already exists. Review it before replacing it.');
  return readOfflineQueue(
    [...entries.filter((d) => d.entryId !== next.entryId), next],
    next.ownerId,
    next.workspaceId,
    now,
  );
}

const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
/** Static HTML has no script, form, remote image, stylesheet or privileged account fields. */
export function offlinePacketHtml(value: OfflinePacket): string {
  const p = readOfflinePacket(value);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(p.title)} · Aplyd practice reference</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;color:#16392b}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f6f3;padding:1rem}h1,h2,h3{line-height:1.25}section{margin:2rem 0}small{overflow-wrap:anywhere}.notice{padding:1rem;border:1px solid #446853;border-radius:.5rem}li{margin:.5rem 0}@media print{section{break-before:page}body{font-size:12pt}}</style></head><body><header><p>aplyd. ACADEMY · OFFLINE REFERENCE COPY</p><h1>${escape(p.title)}</h1><p>${escape(p.summary)}</p><p class="notice">${escape(p.notice)}</p><p>${escape(p.classification)}</p><small>Exact source: ${escape(p.contentRef.programId)} · ${escape(p.contentRef.versionId)} · SHA-256 ${escape(p.sourceSha256)}</small></header>${p.lessons.map((l) => `<section><h2>${escape(l.title)}</h2><p>${escape(l.objective)}</p><p>${escape(l.lessonText)}</p><ol>${l.steps.map((s: string) => `<li>${escape(s)}</li>`).join('')}</ol><h3>${escape(l.exercise.title)}</h3><pre>${escape(JSON.stringify(l.exercise.sourcePacket, null, 2))}</pre><h3>Supplied draft to check</h3><p>${escape(l.exercise.suppliedAiDraft)}</p><h3>Your fictional practice task</h3><p>${escape(l.exercise.learnerTask)}</p><h3>Reflection</h3><p>${escape(l.reflectionPrompt)}</p><h3>Return to work with care</h3><p>${escape(l.returnToWorkAction)}</p></section>`).join('')}<section><h2>${escape(p.practical.title)}</h2><p>${escape(p.practical.scenario)}</p><p>Use these prompts to prepare your own fictional notes. Return to Academy online to review your draft and save it; submission and review are separate online actions.</p><ol>${p.practical.prompts.map((f) => `<li><strong>${escape(f.label)}</strong><p>${escape(f.help)}</p></li>`).join('')}</ol></section><footer><p>No offline completion, assessment or credential is recorded. Keep private records and credentials out of this practice.</p></footer></body></html>`;
}
