/** Own learner planning; no sender, calendar service, or privilege changes. */
export const PLAN_COMMANDS = ['learning-plan', 'plan-task', 'plan-task-status', 'plan-task-remove'] as const;
export const PLAN_LIMITS = { totalTasks: 200, openTasks: 30, maxTitle: 100, maxNote: 500, maxGoal: 200 };
export const PLAN_GOALS = [
  'explore',
  'records',
  'check-draft',
  'clear-response',
  'expert-questions',
] as const;
export type PlanGoal = (typeof PLAN_GOALS)[number];
export type PlanTaskKind = 'lesson' | 'practical' | 'reflection' | 'practice';
export type PlanTask = {
  id: string;
  kind: PlanTaskKind;
  enrollmentId: string | null;
  lessonId: string | null;
  title: string;
  dueDate: string | null;
  plannedMinutes: number;
  note: string;
  status: 'planned' | 'done' | 'skipped';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
export type LearningPlan = {
  goal: PlanGoal;
  personalGoal: string;
  weeklyMinutes: number;
  timeZone: string;
  remindersEnabled: boolean;
  tasks: PlanTask[];
};
export type PlanProgram = {
  id: string;
  title: string;
  lessons: readonly { id: string; title: string; estimatedMinutes?: number }[];
  practicalAssessment?: { title?: string };
};
export type PlanLearnerState = {
  learningPlan?: LearningPlan;
  profile?: { context?: string };
  enrollments?: any[];
  followups?: any[];
  paused?: string[];
};
export type PlanOptions = {
  /** Resolve exact pinned version, returning undefined if unavailable. Never substitute latest. */
  resolveProgram: (programId: string, version: string, record?: any) => PlanProgram | undefined;
  now: string;
  memberActive?: boolean;
  canLearn?: boolean;
  cohorts?: { id: string; status: string }[];
  /** Caller may inject an ID factory for deterministic tests. */
  newId?: () => string;
  preferredEnrollmentId?: string;
  /** Explicit saved context mapping; optional and never an authority input. */
  contextPrograms?: Record<string, string>;
};
export class LearningPlanError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'LearningPlanError';
  }
}
const clone = <T>(v: T): T => structuredClone(v);
const has = (v: object, key: string) => Object.prototype.hasOwnProperty.call(v, key);
function fail(message: string, status = 422): never {
  throw new LearningPlanError(message, status);
}
function exact(c: any, keys: string[]) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.type !== 'string')
    fail('Choose a valid planning action.', 400);
  if (Object.keys(c).some((k) => !['type', ...keys].includes(k)))
    fail('This planning action includes unsupported fields.', 400);
}
function boundedText(value: any, label: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    fail(`${label} needs ${min}–${max} characters.`);
  return value.trim();
}
function minutes(value: any, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value as number;
}
function timestamp(value: string) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    fail('A valid planning timestamp is required.', 400);
  return new Date(value).toISOString();
}
export function validatePlanDate(value: any): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail('Choose a valid date or leave it unscheduled.');
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 2200) fail('Choose a date between 1900 and 2200.');
  const date = new Date(value + 'T12:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    fail('Choose a real calendar date.');
  return value;
}
export function validatePlanTimeZone(value: any): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80 || /^[+-]/.test(value))
    fail('Choose a supported timezone.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
  } catch {
    fail('Choose a supported timezone.');
  }
  return value;
}
export function freshLearningPlan(): LearningPlan {
  return {
    goal: 'explore',
    personalGoal: '',
    weeklyMinutes: 60,
    timeZone: 'UTC',
    remindersEnabled: false,
    tasks: [],
  };
}
/** Read-time defaults are detached from the persisted object and do not advance its revision. */
export function readLearningPlan(state: PlanLearnerState): LearningPlan {
  if (state.learningPlan === undefined) return freshLearningPlan();
  const saved = state.learningPlan;
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.tasks))
    fail('Your saved learning plan needs a format review. Your learning is retained.', 409);
  return clone({ ...freshLearningPlan(), ...saved });
}
export function isLearningPlanCommand(c: any): boolean {
  return !!c && typeof c === 'object' && !Array.isArray(c) && PLAN_COMMANDS.some((type) => type === c.type);
}
function ownEnrollment(state: PlanLearnerState, id: any) {
  const enrollment = (state.enrollments ?? []).find((e) => e.id === id);
  if (!enrollment) fail('Enrollment not found in your learning space.', 404);
  return enrollment;
}
function paused(state: PlanLearnerState, e: any, options: PlanOptions) {
  return (
    (state.paused ?? []).includes(e.programId) ||
    !!options.cohorts?.some((c) => c.id === e.cohortId && c.status === 'paused')
  );
}
function pinned(e: any, options: PlanOptions) {
  const program = options.resolveProgram(e.programId, e.version, e);
  if (!program) fail('The pinned learning content is unavailable. Your plan and evidence are retained.', 409);
  return program;
}
function nextUndecided(e: any) {
  return (e.attempts ?? []).find((a: any) => !a.decision);
}
function openAppeal(e: any) {
  return (e.appeals ?? []).find((a: any) => a.status === 'open');
}
function latestAttempt(e: any) {
  return (e.attempts ?? []).at(-1);
}
function effectiveDecision(e: any) {
  const attempt = latestAttempt(e);
  return (e.appeals ?? []).find((a: any) => a.attemptId === attempt?.id)?.resolution ?? attempt?.decision;
}
function ownTask(plan: LearningPlan, id: any) {
  const task = plan.tasks.find((t) => t.id === id);
  if (!task) fail('Planning activity not found in your learning space.', 404);
  return task;
}
function taskLink(
  state: PlanLearnerState,
  kind: PlanTaskKind,
  enrollmentId: any,
  lessonId: any,
  options: PlanOptions,
) {
  if (kind === 'practice') {
    if (enrollmentId != null || lessonId != null)
      fail('A private practice activity has no enrollment or lesson link.', 400);
    return { enrollmentId: null, lessonId: null, title: '', defaultMinutes: 15 };
  }
  const e = ownEnrollment(state, enrollmentId);
  if (e.withdrawn) fail('This enrollment was withdrawn. Your planning history is retained.', 409);
  if (kind === 'reflection') {
    if (lessonId != null) fail('A reflection is linked to its enrollment, not a lesson.', 400);
    if (e.record?.status !== 'active')
      fail('An active reviewed practice record is needed before planning a work reflection.', 409);
    return {
      enrollmentId: e.id,
      lessonId: null,
      title: `Reflect on ${e.record.title || e.programId}`,
      defaultMinutes: 15,
    };
  }
  if (options.canLearn === false) fail('Your current membership does not permit learning activities.', 403);
  if (paused(state, e, options)) fail('Learning is paused here. Your plan and saved work are retained.', 409);
  const program = pinned(e, options);
  if (kind === 'lesson') {
    const lesson = program.lessons.find((l) => l.id === lessonId);
    if (!lesson) fail('Lesson not found in this pinned pathway.', 404);
    if ((e.completed ?? []).includes(lesson.id))
      fail('This lesson is already complete. Choose your next activity.', 409);
    return {
      enrollmentId: e.id,
      lessonId: lesson.id,
      title: lesson.title,
      defaultMinutes: Math.min(240, Math.max(5, lesson.estimatedMinutes ?? 25)),
    };
  }
  if (lessonId != null) fail('Practical submission planning has no lesson link.', 400);
  if (e.record?.status === 'active') fail('This pathway already has an active completion record.', 409);
  if (nextUndecided(e) || openAppeal(e))
    fail('Wait for the current review or appeal before planning another submission.', 409);
  if ((e.attempts ?? []).length >= 3)
    fail('All three attempts are used. Review feedback and ask for support.', 409);
  return {
    enrollmentId: e.id,
    lessonId: null,
    title: program.practicalAssessment?.title || `Demonstrate ${program.title}`,
    defaultMinutes: 35,
  };
}

/** Return a new private plan. The caller stores it in the authenticated learner's existing aggregate. */
export function applyLearningPlanCommand(
  state: PlanLearnerState,
  c: any,
  options: PlanOptions,
): LearningPlan {
  if (options.memberActive === false)
    fail('Workspace access was removed. Your own history remains available.', 403);
  const now = timestamp(options.now);
  const plan = readLearningPlan(state);
  switch (c?.type) {
    case 'learning-plan': {
      exact(c, ['goal', 'personalGoal', 'weeklyMinutes', 'timeZone', 'remindersEnabled']);
      if (Object.keys(c).length === 1) fail('Choose a planning preference to save.');
      if (has(c, 'goal')) {
        if (!PLAN_GOALS.some((g) => g === c.goal)) fail('Choose an existing learning goal.');
        plan.goal = c.goal;
      }
      if (has(c, 'personalGoal'))
        plan.personalGoal = boundedText(c.personalGoal, 'Personal goal', 0, PLAN_LIMITS.maxGoal);
      if (has(c, 'weeklyMinutes'))
        plan.weeklyMinutes = minutes(c.weeklyMinutes, 'Weekly learning budget', 10, 600);
      if (has(c, 'timeZone')) plan.timeZone = validatePlanTimeZone(c.timeZone);
      if (has(c, 'remindersEnabled')) {
        if (typeof c.remindersEnabled !== 'boolean')
          fail('Choose whether to show optional in-app reminders.');
        plan.remindersEnabled = c.remindersEnabled;
      }
      break;
    }
    case 'plan-task': {
      exact(c, ['taskId', 'kind', 'enrollmentId', 'lessonId', 'title', 'dueDate', 'plannedMinutes', 'note']);
      if (has(c, 'taskId')) {
        const task = ownTask(plan, c.taskId);
        if (Object.keys(c).length === 2) fail('Choose an activity field to change.');
        for (const key of ['kind', 'enrollmentId', 'lessonId'] as const)
          if (has(c, key) && c[key] !== task[key])
            fail('A planning activity cannot be retargeted. Create another activity instead.', 400);
        if (has(c, 'title')) {
          if (task.kind !== 'practice')
            fail('Linked activity titles come from the pinned learning record.', 400);
          task.title = boundedText(c.title, 'Practice activity title', 3, PLAN_LIMITS.maxTitle);
        }
        if (has(c, 'dueDate')) task.dueDate = validatePlanDate(c.dueDate);
        if (has(c, 'plannedMinutes'))
          task.plannedMinutes = minutes(c.plannedMinutes, 'Planned minutes', 5, 240);
        if (has(c, 'note')) task.note = boundedText(c.note, 'Private planning note', 0, PLAN_LIMITS.maxNote);
        task.updatedAt = now;
      } else {
        if (!['lesson', 'practical', 'reflection', 'practice'].includes(c.kind))
          fail('Choose a planning activity type.');
        if (plan.tasks.length >= PLAN_LIMITS.totalTasks)
          fail(
            'This private plan reached its activity limit. Remove an old planning item before adding another.',
            409,
          );
        if (
          projectPlanTasks(state, plan, options).filter((t) => t.status === 'planned').length >=
          PLAN_LIMITS.openTasks
        )
          fail(
            'This private plan supports 30 open activities. Finish, skip or remove one before adding another.',
            409,
          );
        const link = taskLink(state, c.kind, c.enrollmentId, c.lessonId, options);
        if (c.kind !== 'practice' && has(c, 'title'))
          fail('Linked activity titles come from the pinned learning record.', 400);
        if (
          c.kind !== 'practice' &&
          plan.tasks.some(
            (t) =>
              t.status === 'planned' &&
              t.kind === c.kind &&
              t.enrollmentId === link.enrollmentId &&
              t.lessonId === link.lessonId &&
              taskProgress(state, t, options).status === 'planned',
          )
        )
          fail('This activity is already in your plan.', 409);
        const id = (options.newId ?? (() => crypto.randomUUID()))();
        if (typeof id !== 'string' || id.length < 1 || id.length > 100 || plan.tasks.some((t) => t.id === id))
          fail('A unique planning activity reference is required.', 409);
        plan.tasks.push({
          id,
          kind: c.kind,
          enrollmentId: link.enrollmentId,
          lessonId: link.lessonId,
          title:
            c.kind === 'practice'
              ? boundedText(c.title, 'Practice activity title', 3, PLAN_LIMITS.maxTitle)
              : link.title,
          dueDate: has(c, 'dueDate') ? validatePlanDate(c.dueDate) : null,
          plannedMinutes: has(c, 'plannedMinutes')
            ? minutes(c.plannedMinutes, 'Planned minutes', 5, 240)
            : link.defaultMinutes,
          note: has(c, 'note') ? boundedText(c.note, 'Private planning note', 0, PLAN_LIMITS.maxNote) : '',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      }
      break;
    }
    case 'plan-task-status': {
      exact(c, ['taskId', 'status']);
      const task = ownTask(plan, c.taskId);
      if (!['planned', 'done', 'skipped'].includes(c.status)) fail('Choose planned, completed, or skipped.');
      if (c.status === 'done' && task.kind !== 'practice')
        fail('Linked activities complete through their saved lesson, submission, or reflection.');
      if (c.status === 'planned' && task.status !== 'planned') {
        if (
          projectPlanTasks(state, plan, options).filter((t) => t.status === 'planned').length >=
          PLAN_LIMITS.openTasks
        )
          fail('This private plan supports 30 open activities.', 409);
        if (task.kind !== 'practice') {
          taskLink(state, task.kind, task.enrollmentId, task.lessonId, options);
          if (
            plan.tasks.some(
              (other) =>
                other.id !== task.id &&
                other.kind === task.kind &&
                other.enrollmentId === task.enrollmentId &&
                other.lessonId === task.lessonId &&
                taskProgress(state, other, options).status === 'planned',
            )
          )
            fail('This activity is already in your plan.', 409);
        }
      }
      task.status = c.status;
      task.completedAt = c.status === 'done' ? (task.completedAt ?? now) : null;
      task.updatedAt = now;
      break;
    }
    case 'plan-task-remove': {
      exact(c, ['taskId']);
      ownTask(plan, c.taskId);
      plan.tasks = plan.tasks.filter((t) => t.id !== c.taskId);
      break;
    }
    default:
      fail('Choose a supported learner planning action.', 400);
  }
  return plan;
}

export type PlanTaskProgress = {
  status: 'planned' | 'done' | 'skipped';
  label: string;
  completedAt: string | null;
  blocked: boolean;
  blockedReason: string | null;
};
/** Derive linked completion from exact own evidence; never write course or credential state. */
export function taskProgress(
  state: PlanLearnerState,
  task: PlanTask,
  options: PlanOptions,
): PlanTaskProgress {
  const storedStatus = task.kind !== 'practice' && task.status === 'done' ? 'planned' : task.status;
  const base: PlanTaskProgress = {
    status: storedStatus,
    label: storedStatus === 'skipped' ? 'Skipped' : 'Planned',
    completedAt: task.kind === 'practice' ? task.completedAt : null,
    blocked: false,
    blockedReason: null,
  };
  if (task.status === 'skipped') return base;
  if (task.kind === 'practice')
    return {
      ...base,
      label: task.status === 'done' ? 'Self-reported practice' : 'Planned practice',
      blocked: options.memberActive === false,
      blockedReason: options.memberActive === false ? 'Workspace access was removed.' : null,
    };
  const e = (state.enrollments ?? []).find((e) => e.id === task.enrollmentId);
  if (!e)
    return {
      ...base,
      blocked: true,
      blockedReason: 'This enrollment is unavailable in your learning space.',
    };
  let completedAt: string | null = null;
  let completed = false;
  let label = 'Planned';
  if (task.kind === 'lesson') {
    completed = (e.completed ?? []).includes(task.lessonId);
    completedAt = e.practice?.[task.lessonId!]?.completedAt ?? null;
    label = 'Lesson completed';
  } else if (task.kind === 'practical') {
    const attempt = (e.attempts ?? []).find(
      (a: any) => Date.parse(a.submittedAt) >= Date.parse(task.createdAt),
    );
    completed = !!attempt;
    completedAt = attempt?.submittedAt ?? null;
    label = 'Evidence submitted';
  } else {
    // Newer reflections remain history; the first qualifying action completed this plan item.
    const createdAt = Date.parse(task.createdAt);
    let reflection: any = null;
    let earliest = Infinity;
    for (const f of state.followups ?? []) {
      const savedAt = typeof f?.createdAt === 'string' ? Date.parse(f.createdAt) : NaN;
      if (
        f?.enrollmentId === e.id &&
        Number.isFinite(savedAt) &&
        savedAt >= createdAt &&
        savedAt < earliest
      ) {
        reflection = f;
        earliest = savedAt;
      }
    }
    completed = !!reflection;
    completedAt = reflection?.createdAt ?? null;
    label = 'Reflection saved';
  }
  if (completed) return { status: 'done', label, completedAt, blocked: false, blockedReason: null };
  const block = (reason: string): PlanTaskProgress => ({ ...base, blocked: true, blockedReason: reason });
  if (options.memberActive === false)
    return block('Workspace access was removed. Your own history remains available.');
  if (e.withdrawn) return block('This enrollment was withdrawn.');
  if (task.kind === 'reflection')
    return e.record?.status === 'active'
      ? { ...base, label: 'Planned reflection' }
      : block('An active reviewed practice record is needed for a new reflection.');
  if (options.canLearn === false)
    return block('Your current membership does not permit learning activities.');
  if (paused(state, e, options)) return block('Learning is paused. Your saved work is retained.');
  const program = options.resolveProgram(e.programId, e.version, e);
  if (!program) return block('The pinned learning content is unavailable.');
  if (task.kind === 'lesson') {
    const index = program.lessons.findIndex((l) => l.id === task.lessonId);
    if (index < 0) return block('This lesson is unavailable in the pinned pathway.');
    if (index > 0 && !(e.completed ?? []).includes(program.lessons[index - 1].id))
      return block('Complete the previous lesson before starting this activity.');
    return { ...base, label: 'Planned lesson' };
  }
  if (nextUndecided(e) || openAppeal(e)) return block('Wait for the current review or appeal.');
  if ((e.attempts ?? []).length >= 3)
    return block('All three attempts are used. Review feedback and ask for support.');
  if (e.record?.status === 'active') return block('This pathway already has an active completion record.');
  if (!program.lessons.every((l) => (e.completed ?? []).includes(l.id)))
    return block('Complete the pathway lessons before submitting evidence.');
  return { ...base, label: 'Planned evidence submission' };
}

export function planToday(now: string, timeZone: string): string {
  const valid = timestamp(now);
  validatePlanTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(valid));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function planWeek(today: string): { start: string; end: string } {
  const valid = validatePlanDate(today);
  if (!valid) fail('A dated week is required.');
  const date = new Date(valid + 'T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}
export function projectPlanTasks(state: PlanLearnerState, plan: LearningPlan, options: PlanOptions) {
  const today = planToday(options.now, plan.timeZone);
  return plan.tasks
    .map((task) => {
      const progress = taskProgress(state, task, options);
      const due = !task.dueDate
        ? 'unscheduled'
        : task.dueDate < today
          ? 'earlier'
          : task.dueDate === today
            ? 'today'
            : 'upcoming';
      return { ...clone(task), ...progress, due };
    })
    .sort(
      (a, b) =>
        (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function learningPlanSummary(state: PlanLearnerState, options: PlanOptions) {
  const plan = readLearningPlan(state);
  const today = planToday(options.now, plan.timeZone);
  const week = planWeek(today);
  const tasks = projectPlanTasks(state, plan, options);
  const weekly = tasks.filter(
    (t) => t.dueDate && t.dueDate >= week.start && t.dueDate <= week.end && t.status !== 'skipped',
  );
  return {
    plan,
    today,
    week,
    tasks,
    plannedMinutesThisWeek: weekly.reduce((total, t) => total + t.plannedMinutes, 0),
    completedActivitiesThisWeek: tasks.filter((t) => {
      if (t.status !== 'done' || !t.completedAt) return false;
      const completedDate = planToday(t.completedAt, plan.timeZone);
      return completedDate >= week.start && completedDate <= week.end;
    }).length,
    /** Optional notices appear only on opening Academy; this does not schedule delivery. */
    reminders:
      plan.remindersEnabled && options.memberActive !== false
        ? tasks.filter(
            (t) => t.status === 'planned' && !t.blocked && (t.due === 'today' || t.due === 'earlier'),
          )
        : [],
  };
}

export type LearnerNextAction = {
  kind:
    | 'catalog'
    | 'history'
    | 'unavailable'
    | 'paused'
    | 'appeal'
    | 'review'
    | 'reflection'
    | 'support'
    | 'lesson'
    | 'practical'
    | 'revise'
    | 'practice';
  title: string;
  reason: string;
  actionLabel: string;
  view: 'programs' | 'learn' | 'credentials' | 'settings' | 'plan';
  tab: 'learn' | 'assessment' | 'feedback' | null;
  enrollmentId: string | null;
  programId: string | null;
  lessonId: string | null;
  estimatedMinutes: number | null;
  blocked: boolean;
};
export function enrollmentNextAction(
  state: PlanLearnerState,
  e: any,
  options: PlanOptions,
): LearnerNextAction {
  const make = (values: Partial<LearnerNextAction>): LearnerNextAction => ({
    kind: 'lesson',
    title: 'Continue your learning',
    reason: '',
    actionLabel: 'Open pathway',
    view: 'learn',
    tab: 'learn',
    enrollmentId: e.id,
    programId: e.programId,
    lessonId: null,
    estimatedMinutes: null,
    blocked: false,
    ...values,
  });
  if (options.memberActive === false)
    return make({
      kind: 'history',
      title: 'Your learning history is retained',
      reason: 'Workspace access was removed. You can read and export your own saved work.',
      actionLabel: 'View my history',
      view: 'credentials',
      tab: null,
      blocked: true,
    });
  if (e.withdrawn)
    return make({
      kind: 'history',
      title: 'This enrollment was withdrawn',
      reason: 'Saved history is retained. Choose another pathway when you are ready.',
      actionLabel: 'Explore pathways',
      view: 'programs',
      tab: null,
      blocked: true,
    });
  if (openAppeal(e))
    return make({
      kind: 'appeal',
      title: 'Your appeal is awaiting independent review',
      reason:
        'Your original decision and submitted evidence are preserved. Wait for the appeal before another attempt.',
      actionLabel: 'View feedback and appeal',
      tab: 'feedback',
    });
  if (nextUndecided(e))
    return make({
      kind: 'review',
      title: 'Your submitted evidence is awaiting review',
      reason: 'You have a saved submission. No further submission is needed while it awaits assessment.',
      actionLabel: 'View submitted evidence',
      tab: 'feedback',
    });
  if (e.record?.status === 'active')
    return make({
      kind: 'reflection',
      title: 'Put the skill to work carefully',
      reason:
        'Try a permitted task and record what you checked, what changed, and what still needs help. This is a nonaccredited practice record.',
      actionLabel: 'Record a work reflection',
      view: 'credentials',
      tab: null,
    });
  if (paused(state, e, options))
    return make({
      kind: 'paused',
      title: 'Learning is paused here',
      reason: 'Your plan, drafts and evidence are retained while the content or cohort is reviewed.',
      actionLabel: 'View saved pathway',
      blocked: true,
    });
  const program = options.resolveProgram(e.programId, e.version, e);
  if (!program)
    return make({
      kind: 'unavailable',
      title: 'The pinned learning content is unavailable',
      reason:
        'Your saved work has not been retargeted to a different content version. Ask for support before continuing.',
      actionLabel: 'Open preferences and support',
      view: 'settings',
      tab: null,
      blocked: true,
    });
  if (options.canLearn === false)
    return make({
      kind: 'history',
      title: 'Your saved work remains available',
      reason:
        'Your current membership does not permit learning actions. Ask the owner for the required role.',
      actionLabel: 'View saved pathway',
      blocked: true,
    });
  const firstIncomplete = program.lessons.find((l) => !(e.completed ?? []).includes(l.id));
  if (firstIncomplete)
    return make({
      kind: 'lesson',
      title: firstIncomplete.title,
      reason: e.lessonDrafts?.[firstIncomplete.id]
        ? 'Your saved practice is ready to continue.'
        : 'This is the next incomplete lesson in your pinned pathway.',
      actionLabel: 'Continue this lesson',
      lessonId: firstIncomplete.id,
      estimatedMinutes: firstIncomplete.estimatedMinutes ?? null,
    });
  if ((e.attempts ?? []).length >= 3)
    return make({
      kind: 'support',
      title: 'Review feedback and ask for support',
      reason:
        'All three practical attempts are used. An eligible appeal may still be available for the latest decision.',
      actionLabel: 'View feedback and options',
      tab: 'feedback',
      blocked: true,
    });
  if (effectiveDecision(e)?.passed === false || e.record?.status === 'suspended')
    return make({
      kind: 'revise',
      title: 'Review feedback before revising your evidence',
      reason:
        e.record?.status === 'suspended'
          ? 'Your practice record is suspended. The changed decision and original evidence remain in history.'
          : 'Use the assessor’s feedback and source packet to prepare a better evidence submission.',
      actionLabel: 'Review my feedback',
      tab: 'feedback',
    });
  return make({
    kind: 'practical',
    title: program.practicalAssessment?.title || 'Demonstrate your skill',
    reason: 'Your lessons are complete. Prepare evidence that shows your own checks and judgment.',
    actionLabel: 'Prepare practical evidence',
    tab: 'assessment',
  });
}

export function learnerNextAction(state: PlanLearnerState, options: PlanOptions): LearnerNextAction {
  const catalog = (values: Partial<LearnerNextAction> = {}): LearnerNextAction => ({
    kind: 'catalog',
    title: 'Choose a useful work skill',
    reason: 'Explore the actual available pathways and choose a task you want to do better.',
    actionLabel: 'Explore pathways',
    view: 'programs',
    tab: null,
    enrollmentId: null,
    programId: null,
    lessonId: null,
    estimatedMinutes: null,
    blocked: false,
    ...values,
  });
  if (options.memberActive === false)
    return catalog({
      kind: 'history',
      title: 'Your own history remains available',
      reason: 'Workspace access was removed. You can read and export your own records.',
      actionLabel: 'View my history',
      view: 'credentials',
      blocked: true,
    });
  const enrollments = (state.enrollments ?? []).filter((e) => !e.withdrawn);
  if (options.preferredEnrollmentId) {
    const preferred = (state.enrollments ?? []).find((e) => e.id === options.preferredEnrollmentId);
    if (!preferred) fail('Enrollment not found in your learning space.', 404);
    return enrollmentNextAction(state, preferred, options);
  }
  const plan = readLearningPlan(state);
  const planned = projectPlanTasks(state, plan, options).find((t) => t.status === 'planned' && !t.blocked);
  if (planned?.kind === 'practice')
    return catalog({
      kind: 'practice',
      title: planned.title,
      reason: planned.dueDate
        ? `Your private practice activity is planned for ${planned.dueDate}.`
        : 'This is a private practice activity you chose. Completion is self-reported.',
      actionLabel: 'Open my learning plan',
      view: 'plan',
    });
  if (planned?.enrollmentId) {
    const e = enrollments.find((e) => e.id === planned.enrollmentId);
    if (e) {
      if (planned.kind === 'reflection') return enrollmentNextAction(state, e, options);
      if (planned.kind === 'practical') return enrollmentNextAction(state, e, options);
      const action = enrollmentNextAction(state, e, options);
      if (action.kind === 'lesson' && planned.lessonId !== action.lessonId) {
        // Only reachable planned lessons are considered above; never skip a prerequisite.
        const lesson = options
          .resolveProgram(e.programId, e.version, e)
          ?.lessons.find((l) => l.id === planned.lessonId);
        if (lesson)
          return {
            ...action,
            title: lesson.title,
            lessonId: lesson.id,
            estimatedMinutes: lesson.estimatedMinutes ?? null,
            reason: 'This available lesson is in your own learning plan.',
          };
      }
      return action;
    }
  }
  const preferredProgram = options.contextPrograms?.[state.profile?.context ?? ''];
  const sorted = [...enrollments].sort(
    (a, b) =>
      String(a.startedAt ?? '').localeCompare(String(b.startedAt ?? '')) ||
      String(a.id).localeCompare(String(b.id)),
  );
  const selected =
    sorted.find((e) => e.programId === preferredProgram) ??
    sorted.find((e) => e.record?.status !== 'active') ??
    sorted[0];
  return selected ? enrollmentNextAction(state, selected, options) : catalog();
}
