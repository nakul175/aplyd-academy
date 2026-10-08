import { contentRef, contentKey, pinnedRef, type ContentRef } from './academy-curriculum';

/** Browser navigation metadata only; it grants no access and contains no course body. */
export type OfferingIntent = Readonly<{ workspaceId: string; cohortId: string; contentRef: ContentRef }>;
export type PrivateCatalogEntry = {
  program: any;
  offering: OfferingIntent | null;
  cohortTitle: string | null;
};
const plain = (value: any) => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: any) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/i.test(value);
const workspace = (value: any) => typeof value === 'string' && /^tw-[a-z0-9-]{20,80}$/i.test(value);

function validIntent(value: any): OfferingIntent | null {
  if (
    !plain(value) ||
    Object.keys(value).length !== 3 ||
    Object.keys(value).some((key) => !['workspaceId', 'cohortId', 'contentRef'].includes(key)) ||
    !workspace(value.workspaceId) ||
    !identifier(value.cohortId)
  )
    return null;
  try {
    const ref = contentRef(value.contentRef);
    if (ref.scope !== 'global' && ref.scope !== value.workspaceId) return null;
    return Object.freeze({ workspaceId: value.workspaceId, cohortId: value.cohortId, contentRef: ref });
  } catch {
    return null;
  }
}

/** Same current projection, same ordering and own-enrollment precedence as existing catalog. */
export function derivePrivateCatalogEntries(
  team: any,
  enrollments: readonly any[],
  resolvePinned: (record: any) => any,
): PrivateCatalogEntry[] {
  const entries = new Map<string, PrivateCatalogEntry>();
  if (!plain(team) || !workspace(team.id)) return [];
  for (const cohort of [...(team.cohorts ?? [])].sort(
    (a: any, b: any) => Number(a.contentOpen) - Number(b.contentOpen),
  )) {
    const resolved = resolvePinned(cohort);
    if (
      !resolved.available ||
      resolved.snapshot.ref.scope !== team.id ||
      resolved.snapshot.program.id !== cohort.programId
    )
      continue;
    const offering = makeOfferingIntent(team, cohort);
    if (offering)
      entries.set(resolved.snapshot.program.id, {
        program: resolved.snapshot.program,
        offering,
        cohortTitle: typeof cohort.title === 'string' ? cohort.title : null,
      });
  }
  for (const enrollment of enrollments) {
    if (enrollment.withdrawn) continue;
    const resolved = resolvePinned(enrollment);
    if (resolved.available && resolved.snapshot.ref.scope === team.id)
      entries.set(resolved.snapshot.program.id, {
        program: resolved.snapshot.program,
        offering: null,
        cohortTitle: null,
      });
  }
  return [...entries.values()];
}

export function makeOfferingIntent(team: any, cohort: any): OfferingIntent | null {
  if (!plain(team) || !plain(cohort)) return null;
  try {
    return validIntent({ workspaceId: team.id, cohortId: cohort.id, contentRef: pinnedRef(cohort) });
  } catch {
    return null;
  }
}

export type PreviewCohortSelection =
  | { available: true; cohort: any | null; explicit: boolean }
  | { available: false; cohort: null; explicit: true; message: string };
const unavailable = (): PreviewCohortSelection => ({
  available: false,
  cohort: null,
  explicit: true,
  message:
    'This exact cohort offering is unavailable in your current workspace. Choose another cohort deliberately; your saved learning has not changed.',
});

/** Explicit intent never falls back to another cohort or edition after refresh. */
export function selectPreviewCohort(
  team: any,
  programId: string,
  intent: any = undefined,
): PreviewCohortSelection {
  const cohorts = (team?.cohorts ?? []).filter((cohort: any) => cohort.programId === programId);
  if (intent === undefined)
    return {
      available: true,
      cohort:
        cohorts.find((cohort: any) => cohort.contentOpen && cohort.status === 'open') ?? cohorts[0] ?? null,
      explicit: false,
    };
  const target = validIntent(intent);
  if (!target || !plain(team) || team.id !== target.workspaceId || target.contentRef.programId !== programId)
    return unavailable();
  const cohort = cohorts.find((cohort: any) => cohort.id === target.cohortId);
  if (!cohort) return unavailable();
  try {
    if (contentKey(pinnedRef(cohort)) !== contentKey(target.contentRef)) return unavailable();
  } catch {
    return unavailable();
  }
  return { available: true, cohort, explicit: true };
}

/** Current client gates only. Server authorization, capacity and CAS remain authoritative. */
export function canStartPreviewCohort(team: any, selection: PreviewCohortSelection, resolved: any): boolean {
  const cohort = selection.available ? selection.cohort : null;
  if (
    !(
      selection.available &&
      selection.explicit &&
      cohort &&
      team?.active === true &&
      Array.isArray(team.roles) &&
      team.roles.includes('learner') &&
      resolved?.available &&
      cohort.status === 'open' &&
      cohort.contentOpen !== false &&
      Number.isInteger(cohort.capacity) &&
      cohort.capacity > 0 &&
      Number.isInteger(cohort.occupied) &&
      cohort.occupied >= 0 &&
      cohort.occupied < cohort.capacity
    )
  )
    return false;
  try {
    return contentKey(contentRef(resolved.snapshot.ref)) === contentKey(pinnedRef(cohort));
  } catch {
    return false;
  }
}

export function continuingOwnEdition(enrollment: any, intent: any): boolean {
  if (!enrollment || enrollment.withdrawn || intent === undefined) return false;
  const target = validIntent(intent);
  if (!target) return true;
  try {
    return (
      enrollment.cohortId !== target.cohortId ||
      contentKey(pinnedRef(enrollment)) !== contentKey(target.contentRef)
    );
  } catch {
    return true;
  }
}

/** Existing direct lesson/tab URLs remain unchanged; offering URLs contain only bounded IDs. */
export function learningNavigationHash(view: string, programId = '', target: any = null): string {
  const base = view + (programId ? '/' + programId : '');
  if (view !== 'learn') return base;
  if (plain(target) && Object.hasOwn(target, 'offering')) {
    const intent = validIntent(target.offering);
    if (!intent || intent.contentRef.programId !== programId) return base + '/offering';
    return (
      base +
      '/offering/' +
      [intent.workspaceId, intent.cohortId, intent.contentRef.scope, intent.contentRef.versionId].join('/')
    );
  }
  return base + (target?.tab ? '/' + target.tab + (target.lessonId ? '/' + target.lessonId : '') : '');
}

export function parseLearningTarget(hash: string): any {
  const parts = hash.replace(/^#/, '').split('/');
  if (parts[0] !== 'learn') return null;
  if (parts[2] === 'offering') {
    if (hash.length > 700 || parts.length !== 7) return { offering: null };
    return {
      offering: validIntent({
        workspaceId: parts[3],
        cohortId: parts[4],
        contentRef: { scope: parts[5], programId: parts[1], versionId: parts[6] },
      }),
    };
  }
  return {
    tab: ['learn', 'assessment', 'feedback'].includes(parts[2]) ? parts[2] : null,
    lessonId: parts[3] || null,
  };
}
