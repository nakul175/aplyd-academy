import type {
  ContentReadinessItem,
  CohortReadiness,
  LearningHelpChoices,
  OwnLearningHelpInput,
} from './academy-content-readiness';
export type OperationsContentAttention = {
  workspaceId: string;
  asOf: string;
  total: number;
  items: Array<
    ContentReadinessItem & {
      reference: { scope: string; programId: string; versionId: string } | null;
      documentHash: string | null;
    }
  >;
  cohorts: CohortReadiness[];
  counts: {
    retired: number;
    elapsed: number;
    waiting: number;
    authorUnavailable: number;
    reviewerUnavailable: number;
  };
};
export function deriveOperationsContentAttention(
  team: unknown,
  now: string,
): OperationsContentAttention | null;
export function appendOwnLearningHelpDescription(input: {
  currentBody: string;
  preferences: OwnLearningHelpInput['preferences'];
  course: OwnLearningHelpInput['course'];
  choices: LearningHelpChoices;
}): { body: string };
export function ownSelectedLearningHelpCourse(input: {
  enrollments: any[];
  cohorts: any[];
  cohortId: string;
  enrollmentId: string;
  resolvePinned: (record: any) => any;
}): OwnLearningHelpInput['course'];
export function supportIntakeConsentKey(
  scope: unknown,
  fields: { category: string; cohortId: string; subject: string; body: string },
  audience: unknown,
): string;
