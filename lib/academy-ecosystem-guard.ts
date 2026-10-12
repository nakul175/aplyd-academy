// Bounded compatibility guard for the existing local simulator. This does not
// create scoped grants, link a partner identity, invoke a connector or send data.
export class LegacyPreviewError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'LegacyPreviewError';
  }
}
export const LEGACY_PREVIEW_MAPPINGS = [
  { partner: 'agri', programId: 'farmer-work-records' },
  { partner: 'msme', programId: 'msme-customer-operations' },
  { partner: 'public', programId: 'public-servant-source-briefs' },
] as const;
export type PreviewPartner = (typeof LEGACY_PREVIEW_MAPPINGS)[number]['partner'];
type LegacyEnrollment = {
  id: string;
  programId: string;
  version: string;
  withdrawn: boolean;
  completed: string[];
  record?: { status: string } | null;
};
export type LegacyPreviewState = {
  connections: Record<string, boolean>;
  enrollments: LegacyEnrollment[];
  paused?: string[];
  deliveries?: unknown[];
};
export type PreviewCurriculum = {
  contentVersion: string;
  pathways: readonly { id: string; lessons: readonly { id: string }[] }[];
};
export type LegacyPreviewSummary = {
  partner: PreviewPartner;
  enrollmentId: string;
  programId: string;
  contentVersion: string;
  completedLessons: number;
  recordStatus: 'not-issued' | 'active' | 'suspended';
  mode: 'local-simulation';
  permissionKind: 'legacy-preview-preference';
};
const partners = [...LEGACY_PREVIEW_MAPPINGS.map((m) => m.partner), 'health'];
function exact(command: unknown, keys: string[]): asserts command is Record<string, unknown> {
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    Object.keys(command).some((k) => !keys.includes(k))
  )
    throw new LegacyPreviewError('Use only the supported local preview fields.', 400);
}
function partner(value: unknown) {
  if (typeof value !== 'string' || !partners.includes(value))
    throw new LegacyPreviewError('Ecosystem not found.', 404);
  return value as PreviewPartner | 'health';
}
function available(value: unknown) {
  const p = partner(value);
  if (p === 'health')
    throw new LegacyPreviewError(
      'Health Saha requires domain and privacy review. Local return previews are unavailable.',
      409,
    );
  return LEGACY_PREVIEW_MAPPINGS.find((m) => m.partner === p)!;
}

// Disabling a historical Health flag remains possible. Enabling it is rejected,
// even through a handcrafted same-owner API command. No legacy history is read
// or rewritten by this guard.
export function validateLegacyConnectionCommand(command: unknown) {
  exact(command, ['type', 'partner', 'enabled']);
  if (command.type !== 'connection')
    throw new LegacyPreviewError('Use a local preview preference command.', 400);
  const p = partner(command.partner);
  if (typeof command.enabled !== 'boolean')
    throw new LegacyPreviewError('Choose a local preview preference.');
  if (command.enabled) available(p);
  return { partner: p, enabled: command.enabled, permissionKind: 'legacy-preview-preference' as const };
}

// The caller must supply the current authenticated owner's saved state and the
// actual available curriculum. The client cannot supply this summary, change its
// fields or use a different owner/enrollment via a URL or extra command field.
export function validateLegacyReturnCommand(
  state: LegacyPreviewState,
  command: unknown,
  curriculum: PreviewCurriculum,
): LegacyPreviewSummary {
  exact(command, ['type', 'partner', 'enrollmentId']);
  if (command.type !== 'deliver') throw new LegacyPreviewError('Use a local return preview command.', 400);
  const mapping = available(command.partner);
  if (typeof command.enrollmentId !== 'string' || !command.enrollmentId)
    throw new LegacyPreviewError('Choose saved learning for this local preview.', 400);
  if (
    !state.connections ||
    !Object.hasOwn(state.connections, mapping.partner) ||
    state.connections[mapping.partner] !== true
  )
    throw new LegacyPreviewError('Enable this local preview preference before testing a summary.', 403);
  const e = state.enrollments.find((e) => e.id === command.enrollmentId);
  if (!e) throw new LegacyPreviewError('Enrollment not found in your learning space.', 404);
  if (e.withdrawn !== false)
    throw new LegacyPreviewError('Withdrawn learning cannot be used for a local return preview.', 409);
  if (e.programId !== mapping.programId)
    throw new LegacyPreviewError('Choose the pathway mapped to this ecosystem.', 409);
  const p = curriculum.pathways.find((p) => p.id === mapping.programId);
  if (!p || e.version !== curriculum.contentVersion)
    throw new LegacyPreviewError('The pinned learning version is unavailable for this local preview.', 409);
  if (state.paused?.includes(e.programId))
    throw new LegacyPreviewError(
      'This pathway is paused for content review. Previous local previews remain available.',
      409,
    );
  const allowed = new Set(p.lessons.map((l) => l.id));
  if (
    !Array.isArray(e.completed) ||
    new Set(e.completed).size !== e.completed.length ||
    e.completed.some((id) => !allowed.has(id))
  )
    throw new LegacyPreviewError(
      'The saved progress references are unavailable for this local preview.',
      409,
    );
  const status = e.record?.status ?? 'not-issued';
  if (!['not-issued', 'active', 'suspended'].includes(status))
    throw new LegacyPreviewError('The current practice-record status is unavailable.', 409);
  return {
    partner: mapping.partner,
    enrollmentId: e.id,
    programId: e.programId,
    contentVersion: e.version,
    completedLessons: e.completed.length,
    recordStatus: status as LegacyPreviewSummary['recordStatus'],
    mode: 'local-simulation',
    permissionKind: 'legacy-preview-preference',
  };
}
