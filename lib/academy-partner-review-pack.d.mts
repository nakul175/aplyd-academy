export type ReviewPartner = 'agri' | 'msme' | 'public';
export const PARTNER_REVIEW_FORMAT: 'aplyd.partner-review-checklist/1';
export type ReviewField = {
  name: string;
  type: string;
  requiredWhen: 'always' | 'learning.progress' | 'practice.record';
  constraint: string;
};
export type ReviewPack = {
  format: typeof PARTNER_REVIEW_FORMAT;
  mode: 'discussion-only';
  partner: {
    id: ReviewPartner;
    name: string;
    pathwayId: string;
    task: string;
    learningTitle: string;
    credentialClaim: string;
    credentialExclusions: string[];
    learningSourceNotice: string;
    contentScope: 'global';
    contentVersion: string;
    curriculumSha256: string;
  };
  authority: {
    liveExchangeEnabled: false;
    recipientConnected: false;
    authorizesDelivery: false;
    authorizesLocalTest: false;
    decisionsEstablished: false;
  };
  localContract: {
    version: 'aplyd.learning-return/1.0-test';
    purpose: 'local-return-contract-review';
    transport: 'none';
    fields: ReviewField[];
    scopeGroups: {
      id: 'learning.progress' | 'practice.record';
      object: 'learning' | 'practice_record';
      keys: string[];
    }[];
    choiceDurationDays: [1, 7, 30];
    retainedChoiceLimit: 24;
    retainedReceiptLimit: 100;
    shapeRule: string;
    historyRule: string;
  };
  excludedFields: string[];
  decisions: { id: string; question: string; evidenceNeeded: string; references: string[]; status: 'open' }[];
  boundaryChecks: { id: string; check: string; expected: string }[];
  references: {
    id: string;
    title: string;
    sourceFilename: string;
    sha256: string;
    bytes: number;
    sections: string[];
    use: string;
  }[];
  note: string;
};
export function hasPartnerReviewPack(partner: unknown): partner is ReviewPartner;
export function buildPartnerReviewPack(partner: unknown): ReviewPack;
export function renderPartnerReviewPack(partner: unknown): string;
