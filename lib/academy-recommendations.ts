/**
 * Transparent rule-based "why this is suggested" (BR-07). Pure: no ML, no network, no storage.
 * Every suggestion carries its basis in plain words. Scores are additive fixed weights and
 * ties keep catalog order, so the same inputs always give the same answer.
 */
export const NOT_ADVICE_NOTE =
  'This is a simple suggestion based only on the information listed. It is not personalised advice and it does not predict results. You choose what to learn.';
export const NO_SIGNAL_BASIS =
  'No work context, goal, progress or assigned work is saved yet, so pathways appear in the catalog order.';
export const WEIGHTS = {
  inProgress: 50,
  assigned: 40,
  cohort: 25,
  context: 20,
  goal: 10,
  completed: -100,
} as const;

export const GOAL_RULES: Record<string, { label: string; words: string[] }> = {
  explore: { label: 'Explore what is possible', words: [] },
  records: { label: 'Keep better records', words: ['record', 'checklist', 'total'] },
  'check-draft': { label: 'Check an AI draft', words: ['check', 'verify', 'unsupported', 'draft'] },
  'clear-response': { label: 'Write a clear response', words: ['customer', 'response', 'clear'] },
  'expert-questions': { label: 'Prepare expert questions', words: ['expert', 'question', 'brief'] },
};
const CONTEXT_LABELS: Record<string, string> = {
  farmer: 'Farmer',
  msme: 'MSME owner or team member',
  public: 'Public servant',
};

export type RecProgram = {
  id: string;
  title?: string;
  summary?: string;
  role?: string;
  outcomes?: readonly string[];
  lessons?: readonly { id: string }[];
};
export type RecEnrollment = {
  id?: string;
  programId: string;
  withdrawn?: boolean;
  completed?: readonly string[];
  record?: { status?: string } | null;
};
export type RecTask = { enrollmentId?: string | null; status?: string };
export type RecInput = {
  programs: readonly RecProgram[];
  /** Saved work context key: farmer | msme | public. */
  profileContext?: string | null;
  /** Map of context key to program id (same mapping the Overview uses). */
  contextPrograms?: Record<string, string>;
  goal?: string | null;
  enrollments?: readonly RecEnrollment[];
  planTasks?: readonly RecTask[];
  /** Program ids with an open cohort the learner could join in their workspace. */
  cohortProgramIds?: readonly string[];
};
export type Recommendation = {
  programId: string;
  rank: number;
  score: number;
  basis: string[];
  completed: boolean;
};
export type RecommendationResult = { items: Recommendation[]; note: string; usedSignals: string[] };

export function recommend(input: RecInput): RecommendationResult {
  const enrollments = (input.enrollments ?? []).filter((e) => !e.withdrawn);
  const open = (input.planTasks ?? []).filter((t) => t.status === 'planned');
  const cohorts = new Set(input.cohortProgramIds ?? []);
  const goal = input.goal && GOAL_RULES[input.goal] ? input.goal : '';
  const ctxProgram =
    input.profileContext && input.contextPrograms ? input.contextPrograms[input.profileContext] : undefined;
  const used = new Set<string>();
  const scored = input.programs.map((p, order) => {
    const basis: string[] = [];
    let score = 0,
      completed = false;
    const e = enrollments.find((x) => x.programId === p.id);
    const total = p.lessons?.length ?? 0;
    if (e) {
      const done = e.completed?.length ?? 0;
      if (e.record?.status === 'active') {
        completed = true;
        score += WEIGHTS.completed;
        basis.push('You already completed this pathway, so it is listed lower.');
        used.add('completed lessons');
      } else {
        score += WEIGHTS.inProgress;
        basis.push(`You started this pathway and finished ${done} of ${total || '?'} lessons.`);
        used.add('completed lessons');
      }
      const tasks = open.filter((t) => t.enrollmentId && t.enrollmentId === e.id).length;
      if (tasks) {
        score += WEIGHTS.assigned;
        basis.push(`Your learning plan has ${tasks} open task${tasks === 1 ? '' : 's'} for it.`);
        used.add('assigned work');
      }
    }
    if (!e && cohorts.has(p.id)) {
      score += WEIGHTS.cohort;
      basis.push('Your workspace has an open cohort for this pathway.');
      used.add('assigned work');
    }
    if (ctxProgram === p.id) {
      score += WEIGHTS.context;
      basis.push(
        `It matches your saved work context: ${CONTEXT_LABELS[input.profileContext as string] ?? input.profileContext}.`,
      );
      used.add('profile context');
    }
    if (goal && GOAL_RULES[goal].words.length) {
      const hay = [p.title, p.summary, ...(p.outcomes ?? [])].join(' ').toLowerCase();
      const hits = GOAL_RULES[goal].words.filter((w) => hay.includes(w));
      if (hits.length) {
        score += WEIGHTS.goal * hits.length;
        basis.push(
          `Your goal "${GOAL_RULES[goal].label}" shares these words with the pathway: ${hits.join(', ')}.`,
        );
        used.add('goal');
      }
    }
    if (!basis.length) basis.push(NO_SIGNAL_BASIS);
    return { programId: p.id, score, basis, completed, order };
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return {
    items: scored.map((s, i) => ({
      programId: s.programId,
      rank: i + 1,
      score: s.score,
      basis: s.basis,
      completed: s.completed,
    })),
    note: NOT_ADVICE_NOTE,
    usedSignals: [...used],
  };
}
