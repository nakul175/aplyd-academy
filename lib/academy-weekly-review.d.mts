import type { learningPlanSummary } from './academy-plan';
export type OwnWeeklyReview = {
  week: { start: string; end: string; timeZone: string; today: string };
  observedAt: string;
  planned: { activities: number; minutes: number; budgetMinutes: number; stillOpen: number };
  evidence: { lessons: number; submissions: number; reflections: number; total: number };
  selfReported: { practice: number };
  attention: {
    blockedOpen: number;
    undatedOpen: number;
    earlierOpen: number;
    openTotal: number;
    skippedThisWeek: number;
  };
  completionDateNeedsCheck: number;
  attentionRows: {
    id: string;
    title: string;
    kind: 'practice' | 'lesson' | 'practical' | 'reflection';
    dueDate: string | null;
    blocked: boolean;
    blockedReason: string | null;
    undated: boolean;
    earlier: boolean;
  }[];
  attentionRowsTotal: number;
  coverage: 'retained-own-plan-items';
};
export function deriveOwnWeeklyReview(
  summary: ReturnType<typeof learningPlanSummary>,
  observedAt: string,
): OwnWeeklyReview | null;
export function prepareOwnWeeklyRecap(review: OwnWeeklyReview): Record<string, unknown>;
export function renderOwnWeeklyRecapHtml(review: OwnWeeklyReview): string;
