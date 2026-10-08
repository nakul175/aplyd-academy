/** Read-only display of an already resolved edition. Does not choose or authorize an offering. */
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/i.test(value);
const version = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value);

function maximumScore(program) {
  const rubric = program?.practicalAssessment?.rubric;
  if (
    !Array.isArray(rubric) ||
    !rubric.length ||
    rubric.some((row) => !plain(row) || !Number.isFinite(row.weight) || row.weight <= 0)
  )
    return null;
  const maximum = rubric.reduce((sum, row) => sum + row.weight, 0);
  return Number.isFinite(maximum) && maximum > 0 ? maximum : null;
}

// Current private publication and scoreDecision support this one scoring contract.
// An unfamiliar policy stays unavailable; this read model does not add a new standard.
function supportedPrivateRule(program, policy) {
  if (
    !plain(policy) ||
    policy.minimumWeightedScore !== 70 ||
    policy.scoreMaximum !== 4 ||
    policy.criticalGates !== 'all'
  )
    return false;
  const rubric = program?.practicalAssessment?.rubric;
  if (
    !Array.isArray(rubric) ||
    !rubric.length ||
    rubric.some(
      (row) =>
        !plain(row) ||
        !Number.isInteger(row.weight) ||
        row.weight < 1 ||
        row.weight > 97 ||
        !(
          row.criticalGate === null ||
          (typeof row.criticalGate === 'string' &&
            row.criticalGate.trim().length >= 30 &&
            row.criticalGate.length <= 2000)
        ),
    )
  )
    return false;
  return rubric.reduce((sum, row) => sum + row.weight, 0) === 100;
}

export function deriveBeforeStartSummary({ snapshot, globalSeed } = {}) {
  if (!plain(snapshot) || !plain(snapshot.ref) || !plain(snapshot.program)) return null;
  const { ref, program } = snapshot;
  if (!id(ref.programId) || !version(ref.versionId) || program.id !== ref.programId) return null;
  if (
    !(ref.scope === 'global' || (typeof ref.scope === 'string' && /^tw-[a-z0-9-]{20,80}$/i.test(ref.scope)))
  )
    return null;
  if (
    !Array.isArray(program.prerequisites) ||
    program.prerequisites.some((text) => typeof text !== 'string' || !text.trim())
  )
    return null;

  let passRule = null;
  const maximum = maximumScore(program);
  if (ref.scope === 'global') {
    // The seed policy applies only to its exact archived edition. Never use it for a private or unknown edition.
    if (
      !plain(globalSeed) ||
      ref.versionId !== globalSeed.contentVersion ||
      !Array.isArray(globalSeed.pathways) ||
      !globalSeed.pathways.some((row) => row.id === ref.programId)
    )
      return null;
    const policy = globalSeed.assessmentPolicy;
    if (
      plain(policy) &&
      maximum !== null &&
      Number.isFinite(policy.minimumWeightedScore) &&
      policy.minimumWeightedScore >= 0 &&
      policy.minimumWeightedScore <= maximum &&
      Array.isArray(policy.scoreScale) &&
      policy.scoreScale.length &&
      policy.scoreScale.every(Number.isFinite) &&
      typeof policy.passingRule === 'string' &&
      policy.passingRule.trim()
    ) {
      passRule = policy.passingRule;
    }
  } else {
    const policy = snapshot.policy;
    if (supportedPrivateRule(program, policy)) {
      passRule = `At least ${policy.minimumWeightedScore} out of ${maximum}, and every critical safety check must pass. A failed safety check cannot be averaged away.`;
    }
  }
  return { prerequisites: [...program.prerequisites], passRule };
}
