import { contentKey, pinnedRef } from './academy-curriculum';

/** Export existing accepted metadata only; this lookup grants no authority or content access. */
export function retainedLearningExportCohort(input: {
  enrollment: any;
  team: any;
  activeWorkspace: string;
  previewCohort: any;
}): any | null {
  const { enrollment, team, activeWorkspace, previewCohort } = input;
  // A preview without an own enrollment keeps the existing explicit preview export behavior.
  if (!enrollment) return previewCohort ?? null;
  if (
    typeof activeWorkspace !== 'string' ||
    !/^tw-[a-z0-9-]{20,80}$/i.test(activeWorkspace) ||
    !team ||
    team.id !== activeWorkspace ||
    !Array.isArray(team.cohorts) ||
    typeof enrollment.cohortId !== 'string' ||
    !enrollment.cohortId
  )
    return null;
  const matches = team.cohorts.filter((cohort: any) => cohort?.id === enrollment.cohortId);
  if (matches.length !== 1) return null;
  try {
    const ownRef = pinnedRef(enrollment),
      cohortRef = pinnedRef(matches[0]);
    if (ownRef.scope !== 'global' && ownRef.scope !== activeWorkspace) return null;
    if (contentKey(ownRef) !== contentKey(cohortRef)) return null;
    return structuredClone(matches[0]);
  } catch {
    return null;
  }
}
