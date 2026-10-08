/**
 * Pre-enrolment decision information (BR-11). Pure read model over an already resolved,
 * pinned edition. Prerequisites and the pass rule come from deriveBeforeStartSummary (never
 * re-implemented here), so an unfamiliar policy still shows as unavailable. The exact
 * edition label is shown; nothing here chooses, upgrades or authorises an edition.
 */
import { deriveBeforeStartSummary } from './academy-before-start.mjs';

export type CohortAvailability = { id: string; title: string; placesLeft: number };
export type PreEnrollmentInfo = {
  edition: { versionId: string; scope: string; label: string };
  outcomes: string[];
  effort: {
    totalMinutes: number | null;
    sessions: number;
    minutesPerSession: number | null;
    pacingNote: string;
  };
  prerequisites: string[];
  passRule: string | null;
  assessmentMethod: string;
  credential: { claims: string; doesNotClaim: string[]; notAccredited: string };
  cohorts: CohortAvailability[] | null;
};
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];

/** cohorts: the learner's workspace cohorts for this program (null outside a workspace). Only open cohorts with places are listed. */
export function derivePreEnrollmentInfo(input: {
  snapshot: any;
  globalSeed: any;
  cohorts?: readonly any[] | null;
}): PreEnrollmentInfo | null {
  const before = deriveBeforeStartSummary({ snapshot: input.snapshot, globalSeed: input.globalSeed });
  if (!before) return null;
  const { ref, program } = input.snapshot;
  const policy = ref.scope === 'global' ? input.globalSeed?.assessmentPolicy : null;
  const total =
    Number.isFinite(program.estimatedMinutes) && program.estimatedMinutes > 0
      ? program.estimatedMinutes
      : null;
  const sessions = Array.isArray(program.lessons) ? program.lessons.length : 0;
  const authority =
    typeof policy?.decisionAuthority === 'string' && policy.decisionAuthority.trim()
      ? ` Decided by: ${policy.decisionAuthority.replace(/;.*$/, '').trim()}.`
      : '';
  const title =
    typeof program.practicalAssessment?.title === 'string'
      ? program.practicalAssessment.title
      : 'Practical assessment';
  const list = input.cohorts
    ? input.cohorts
        .filter(
          (c) =>
            c &&
            c.programId === program.id &&
            c.status === 'open' &&
            c.contentOpen !== false &&
            Number(c.occupied) < Number(c.capacity),
        )
        .map((c) => ({
          id: String(c.id),
          title: String(c.title),
          placesLeft: Number(c.capacity) - Number(c.occupied),
        }))
    : null;
  return {
    edition: {
      versionId: ref.versionId,
      scope: ref.scope,
      label: `Edition ${ref.versionId}${ref.scope === 'global' && input.globalSeed?.status ? ` (${input.globalSeed.status})` : ''}`,
    },
    outcomes: strings(program.outcomes),
    effort: {
      totalMinutes: total,
      sessions,
      minutesPerSession: total && sessions ? Math.ceil(total / sessions) : null,
      pacingNote:
        total && sessions
          ? `About ${total} minutes in total, roughly ${Math.ceil(total / sessions)} minutes across ${sessions} sessions. The edition does not set a weekly schedule; one session a week is an illustrative pace, not a commitment.`
          : 'Time needed is not stated for this edition.',
    },
    prerequisites: before.prerequisites,
    passRule: before.passRule,
    assessmentMethod: `${title}: a practical task scored against a published rubric.${authority}`,
    credential: {
      claims:
        typeof program.credentialClaim === 'string'
          ? program.credentialClaim
          : 'No credential claim is stated for this edition.',
      doesNotClaim: strings(program.credentialExclusions),
      notAccredited: 'Passing produces a nonaccredited practice record.',
    },
    cohorts: list,
  };
}
