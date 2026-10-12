/** One aggregate mutation: server-owned copy and tailoring, with normal owner review. */
import {
  applyWorkspaceContentCommand,
  validateDocument,
  AUTHORING_LIMITS,
  utf8JsonBytes,
  authoringClosureReserve,
  freshAuthoring,
  type ContentHost,
  type Identity,
} from './academy-authoring';
import {
  jobTemplate,
  jobTemplateSourceRef,
  tailorJobTemplateDocument,
  JOB_TEMPLATE_VERSION,
  JobTemplateError,
  type JobTemplateId,
  type GovernanceReference,
  type JobTemplateOrigin,
} from './academy-job-templates';
export type JobTemplateCommand = { type: 'content-job-template'; templateId: JobTemplateId };
export type { JobTemplateOrigin } from './academy-job-templates';
export async function applyJobPracticeTemplate<T extends ContentHost>(
  original: T,
  user: Identity,
  input: unknown,
  now = new Date().toISOString(),
): Promise<T> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Object.keys(input).some((k) => !['type', 'templateId'].includes(k)) ||
    !Object.hasOwn(input, 'templateId') ||
    (input as Record<string, unknown>).type !== 'content-job-template'
  )
    throw new JobTemplateError('Use only an available job-practice starting point.', 400);
  const id = (input as JobTemplateCommand).templateId,
    t = jobTemplate(id),
    sourceRef = jobTemplateSourceRef(id);
  const beforeIds = new Set((original.content?.drafts ?? []).map((d) => d.id));
  const copied = await applyWorkspaceContentCommand(original, user, { type: 'content-copy', sourceRef }, now);
  const created = copied.content!.drafts.filter((d) => !beforeIds.has(d.id));
  if (created.length !== 1)
    throw new JobTemplateError(
      'The new draft could not be identified. Refresh before creating another.',
      409,
    );
  const d = created[0],
    document = tailorJobTemplateDocument(d.document, id),
    issues = validateDocument(document, d.document);
  if (issues.length)
    throw new JobTemplateError(
      'This starting point needs content maintenance before it can create a draft.',
      409,
    );
  const next = await applyWorkspaceContentCommand(
    copied,
    user,
    { type: 'content-save', draftId: d.id, revision: d.revision, document },
    now,
  );
  const saved = next.content!.drafts.find((x) => x.id === d.id)!;
  const origin: JobTemplateOrigin = {
    kind: 'owner-job-practice-template',
    templateId: t.id,
    templateVersion: JOB_TEMPLATE_VERSION,
    sourceRef: { ...sourceRef },
    governanceReferences: structuredClone(t.references) as GovernanceReference[],
    createdAt: saved.createdAt,
    adaptationStatus: 'independent-review-required',
  };
  Object.assign(saved, { templateOrigin: origin });
  // Include immutable provenance in the same authoring limit and closure reserve.
  const oldEffective =
    utf8JsonBytes(original.content ?? freshAuthoring()) + authoringClosureReserve(original);
  const newEffective = utf8JsonBytes(next.content) + authoringClosureReserve(next);
  if (newEffective > oldEffective && newEffective > AUTHORING_LIMITS.contentBytes)
    throw new JobTemplateError(
      'This workspace must retain room to archive drafts and close publications. Keep your edits and seek support before adding more content.',
      413,
    );
  return next;
}
