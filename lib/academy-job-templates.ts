/** Teacher-owned fictional starting points. No provider call, publication or permission. */
import { LEGACY_CONTENT_VERSION, type ContentRef } from './academy-curriculum';
export const JOB_TEMPLATE_VERSION = '1.0-owner-review-draft' as const;
export type JobTemplateId =
  | 'farmer-expert-brief'
  | 'msme-customer-commitments'
  | 'public-source-brief'
  | 'frontline-spot-override-flag';
export type SourceFact = Readonly<{ sourceId: string; type: 'fictional teaching fixture'; content: string }>;
type Question = Readonly<{
  question: string;
  options: readonly [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  explanation: string;
}>;
export type GovernanceReference = Readonly<{ resourceId: string; sections: string; limit: string }>;
export type JobTemplateOrigin = {
  kind: 'owner-job-practice-template';
  templateId: JobTemplateId;
  templateVersion: typeof JOB_TEMPLATE_VERSION;
  sourceRef: ContentRef;
  governanceReferences: GovernanceReference[];
  createdAt: string;
  adaptationStatus: 'independent-review-required';
};
export type JobTemplate = Readonly<{
  id: JobTemplateId;
  title: string;
  audience: string;
  baseProgramId: string;
  summary: string;
  promise: string;
  checkedFacts: string;
  calculation: string;
  missingContext: string;
  unsupportedClaim: string;
  flawedDraft: string;
  correctedOutput: string;
  handoff: string;
  permittedAction: string;
  recordSources: readonly SourceFact[];
  factQuestion: Question;
  claimQuestion: Question;
  trialQuestion: Question;
  references: readonly GovernanceReference[];
}>;
const ref = (resourceId: string, sections: string): GovernanceReference => ({
  resourceId,
  sections,
  limit:
    'Teaching reference only. This adaptation needs owner and independent content review; no institutional or domain authority is established.',
});
const C1 = ref('government-trainer-handbook', 'Procurement, governance and sunset: §§4.6, 4.8, 4.15');
const C2 = ref('development-trainer-handbook', 'Funder conditions and funded exit: §4.11');
const C3 = ref('oversight-participant-handbook', 'FIT, subgroup evidence and governance: §§3.1–3.4');
const C4 = ref(
  'emerging-leaders-participant-handbook',
  'Defensible governed work and capstone reasoning: §§1, 3, 5.6',
);
const C5 = ref(
  'frontline-trainer-handbook',
  'Spot/Override/Flag, consent and institution-specific OPEN items: §§4, 6.7, 8',
);
const q = (
  question: string,
  options: Question['options'],
  correctOptionIndex: Question['correctOptionIndex'],
  explanation: string,
): Question => ({ question, options, correctOptionIndex, explanation });
const source = (sourceId: string, content: string): SourceFact => ({
  sourceId,
  type: 'fictional teaching fixture',
  content,
});
const TRAINING_BOUNDARY = source(
  'TRAINING-BOUNDARY',
  'Fictional practice rule: use only supplied records, identify a named reviewer with a usable channel and backup, and keep consequential actions outside this exercise. Before any real frontline adaptation, confirm the institution’s responsibility, written override permission and reporting protection. Teaching references and Academy roles cannot confirm these institution-specific items.',
);
export const JOB_TEMPLATES: readonly JobTemplate[] = [
  {
    id: 'farmer-expert-brief',
    title: 'A checked farm record and an expert question',
    audience: 'Farmer',
    baseProgramId: 'farmer-work-records',
    summary:
      'Check a fictional expense record, remove invented claims, and prepare a concise question for an approved agricultural expert channel.',
    promise:
      'Prepare a reusable source-linked record and question brief while keeping consequential farm advice outside this synthetic exercise.',
    checkedFacts:
      'FARM-R1 records INR 300 and FARM-R2 records INR 200. FARM-R2-COPY explicitly repeats the same FARM-R2 payment. Count it once: the verified total is INR 500.',
    calculation: '300 + 200 = INR 500; the confirmed copied payment is excluded once.',
    missingContext:
      'No farm area, soil condition, water availability, diagnosis, input dose, yield result or expert recommendation is supplied.',
    unsupportedClaim: 'a per-acre cost, yield improvement, diagnosis or instruction to repeat a purchase',
    flawedDraft:
      'The expenses total INR 700. This proves a 25% yield improvement; repeat these inputs immediately and report a cost per acre.',
    correctedOutput:
      'Draft expert question: the verified expense total is INR 500 after counting the confirmed FARM-R2 copy once. No area or yield evidence is provided. Which additional records and approved observations would an expert need before advising on a consequential farm decision?',
    handoff:
      'FARM-ROUTE names fictional expert desk lead Nila, using the training question sheet; fictional coordinator Dev is the backup. Record missing context rather than inventing it.',
    permittedAction:
      'Improve the fictional record and seek an expert question review. No product, treatment, sowing, irrigation or spending decision is authorized by Academy or this packet.',
    recordSources: [
      TRAINING_BOUNDARY,
      source('FARM-R1', 'Fictional payment reference R1: INR 300 for a recorded work expense.'),
      source('FARM-R2', 'Fictional payment reference R2: INR 200 for another recorded work expense.'),
      source(
        'FARM-R2-COPY',
        'Confirmed copied row of payment R2, not a separate payment; count the original R2 once.',
      ),
      source(
        'FARM-ROUTE',
        'Training procedure: prepare a checked record for expert desk lead Nila via the fictional training question sheet. Coordinator Dev is backup. No farm recommendation or production authority is granted.',
      ),
    ],
    factQuestion: q(
      'What total is supported after checking the confirmed copied payment?',
      ['INR 500', 'INR 700', 'INR 300', 'An estimated per-acre figure'],
      0,
      'R1 is INR 300 and R2 is INR 200. The copy is the same R2 payment; 300 + 200 is INR 500, with no area denominator.',
    ),
    claimQuestion: q(
      'Which statement must be removed from the supplied draft?',
      [
        'The record needs expert review',
        'Repeat the inputs for a 25% yield improvement',
        'R2 is a confirmed copied row',
        'The packet supplies no area',
      ],
      1,
      'The packet records expenses, not crop response or an expert recommendation. The claimed yield improvement and repeat-purchase action are unsupported.',
    ),
    trialQuestion: q(
      'What can this checked record establish about crop improvement?',
      [
        'A guaranteed gain',
        'A causal gain if the output reads well',
        'No crop-improvement conclusion from this expense packet',
        'A diagnosis of the field',
      ],
      2,
      'There is no crop outcome, field context, comparison or expert judgment. A useful checked record does not establish an agricultural result.',
    ),
    references: [C1, C4, C5],
  },
  {
    id: 'msme-customer-commitments',
    title: 'A customer draft with promises you can support',
    audience: 'MSME owner or team member',
    baseProgramId: 'msme-customer-operations',
    summary:
      'Use fictional price, stock and workflow sources to prepare a checked customer reply, an action checklist and a limited productivity observation.',
    promise:
      'Separate a requested commitment from a confirmed fact, protect unnecessary internal details and retain the designated human review before sending.',
    checkedFacts:
      'SHOP-P1 states INR 100 per unit and INR 40 delivery if delivery is approved. SHOP-S1 confirms two units; the customer requests three. The third unit and delivery date remain unconfirmed.',
    calculation:
      'If three units and delivery are later approved: 3 × INR 100 + INR 40 = INR 340. The calculation does not confirm availability or timing.',
    missingContext:
      'There is no third-unit confirmation, delivery date, approved discount, delivery waiver or authorization to send the reply.',
    unsupportedClaim: 'a three-unit same-day commitment, approved discount or free delivery',
    flawedDraft:
      'Your three units will arrive today with a 10% discount and free delivery. The system has approved the order; no team review is needed.',
    correctedOutput:
      'Draft customer reply: two units are recorded as available. We need a stock-team check for the third unit and a dispatch-team check for timing. The conditional three-unit delivered total is INR 340 under SHOP-P1. No discount or waiver is approved. This remains an unsent draft.',
    handoff:
      'SHOP-ROUTE names fictional stock lead Ria for availability and dispatch lead Om for date; desk owner Tara approves customer sending. The training review sheet is the channel; Tara is the backup for an unanswered stock/date check.',
    permittedAction:
      'Prepare an unsent draft and checklist with owner role, dependency and confirming source. Real customer sending and exceptions require the actual organization’s approved route.',
    recordSources: [
      TRAINING_BOUNDARY,
      source(
        'SHOP-P1',
        'Fictional published terms: unit price INR 100. Delivery fee INR 40 if delivery is approved. No discount or waiver is authorized.',
      ),
      source(
        'SHOP-S1',
        'Fictional stock record: two units confirmed. Request is for three units; third unit and date await human checks.',
      ),
      source(
        'SHOP-TRIAL',
        'One fictional task took 12 minutes manually; drafting took 5 minutes and verification took 4 minutes. No sales, revenue or wider quality result was measured.',
      ),
      source(
        'SHOP-ROUTE',
        'Training review sheet: Ria checks stock, Om checks dispatch timing, and Tara approves customer sending and is backup. These fictional named roles grant no real authority.',
      ),
    ],
    factQuestion: q(
      'What is the conditional delivered total if all three units and delivery are approved?',
      ['INR 300', 'INR 340', 'INR 306', 'INR 240'],
      1,
      'Three units at INR 100 total INR 300; the stated delivery fee adds INR 40. INR 340 is conditional, not a confirmation of stock or date.',
    ),
    claimQuestion: q(
      'What can the draft currently promise about quantity and timing?',
      [
        'Three units today',
        'A discount if a chatbot says so',
        'Only two recorded units; the third unit and date need checks',
        'Free delivery for all orders',
      ],
      2,
      'SHOP-S1 confirms two units only. SHOP-P1 contains no discount or waiver, and SHOP-ROUTE retains named checks and approval.',
    ),
    trialQuestion: q(
      'What does the one-task productivity observation support?',
      [
        'Three minutes saved on one fictional task including verification',
        'Seven minutes saved because checks do not count',
        'Guaranteed revenue growth',
        'A proven gain for all customers',
      ],
      0,
      'Assisted time is 5 + 4 = 9 minutes compared with 12 manually, a three-minute difference on one task. This does not establish a wider productivity or business effect.',
    ),
    references: [C1, C2, C4, C5],
  },
  {
    id: 'public-source-brief',
    title: 'A source brief that keeps authority clear',
    audience: 'Public servant',
    baseProgramId: 'public-servant-source-briefs',
    summary:
      'Prepare a fictional service-update brief with checked figures, source traceability, explicit uncertainty and a designated approval handoff.',
    promise:
      'Produce usable draft work without inventing rules, causal improvements or official approval, and identify the evidence and authority still needed.',
    checkedFacts:
      'DESK-W1 states 50 requests received and 35 recorded resolved in one fictional week. DESK-G1 says the service update is a draft and participation in the demonstration is voluntary.',
    calculation:
      '35 ÷ 50 × 100 = 70% recorded resolved in that fictional week, not a causal improvement or a subgroup result.',
    missingContext:
      'No earlier comparison, subgroup breakdown, causal evaluation, binding circular, mandatory attendance instruction or official approval is supplied.',
    unsupportedClaim: 'a mandatory instruction, invented circular, causal improvement or official approval',
    flawedDraft:
      'Under binding circular GOV-NEW, every person must attend. AI improved resolution by 70% and the update is officially approved for issue.',
    correctedOutput:
      'Draft service brief: DESK-W1 records 35 of 50 requests resolved, or 70%, for one fictional week. This is an observation, not an improvement claim. DESK-G1 makes the demonstration voluntary and the update a draft. No binding circular or official approval is evidenced.',
    handoff:
      'DESK-ROUTE names fictional data steward Asha to check figures and designated approver Ishan to decide whether to issue. The training handoff sheet is the channel; coordinator Leela is backup. Missing subgroup and comparison evidence remain open questions.',
    permittedAction:
      'Prepare the draft and handoff only. Academy roles and AI text grant no official or legal authority; real issue requires the institution’s designated approval.',
    recordSources: [
      TRAINING_BOUNDARY,
      source(
        'DESK-W1',
        'One fictional week: 50 requests received, 35 recorded resolved. No prior comparison or subgroup breakdown is supplied.',
      ),
      source(
        'DESK-G1',
        'Fictional demonstration participation is voluntary. The service update is a draft, not an approved circular.',
      ),
      source(
        'DESK-ROUTE',
        'Training handoff sheet: Asha checks figures; Ishan is designated issue approver; Leela is backup. These fictional roles grant no official authority.',
      ),
    ],
    factQuestion: q(
      'What does 35 recorded resolutions out of 50 received requests equal?',
      ['35%', '50%', '70%', 'A 70% causal improvement'],
      2,
      '35 divided by 50 is 0.7, or 70% recorded resolved for the supplied week. No baseline or causal design is supplied.',
    ),
    claimQuestion: q(
      'Which part of the draft is unsupported?',
      [
        'The update remains a draft',
        'The demonstration is voluntary',
        'The source counts 50 received requests',
        'An invented binding circular and official approval',
      ],
      3,
      'DESK-G1 states voluntary participation and draft status. No binding circular or official approval appears in any fictional source.',
    ),
    trialQuestion: q(
      'Which missing evidence matters before a wider success claim?',
      [
        'Comparison and subgroup evidence with defined measures',
        'A more confident heading',
        'The Academy owner role',
        'A larger font for the same figure',
      ],
      0,
      'A one-week aggregate does not show causal improvement or who was missed. The reference governance principles call for meaningful field and subgroup evidence.',
    ),
    references: [C1, C2, C3, C4],
  },
  {
    id: 'frontline-spot-override-flag',
    title: 'Spot, check the permitted route, and flag',
    audience: 'Public-service frontline desk · fictional nonclinical practice',
    baseProgramId: 'public-servant-source-briefs',
    summary:
      'Practise checking a fictional appointment flag against source records, recording a bounded human-review action and escalating a repeating problem.',
    promise:
      'Make the source conflict and named escalation route visible while keeping production override permission and frontline protections subject to institutional confirmation.',
    checkedFacts:
      'FRONT-A1 confirms a fictional demonstration appointment under reference DEMO-7. FRONT-F1 wrongly labels it missing. FRONT-P1 records two similar missing-label cases for review, without diagnosing their cause.',
    calculation:
      'Two similar recorded flags warrant a pattern question; they do not establish a failure rate, affected population or cause.',
    missingContext:
      'No production system access, entitlement decision, clinical facts, real override authorization or institutional protection is supplied. The required institutional OPEN items remain unconfirmed.',
    unsupportedClaim:
      'a final rejection, medical judgment, production override permission or confirmed protection from a training role',
    flawedDraft:
      'The computer says missing, so reject DEMO-7 without review. An Academy owner may override any real system, and every institution guarantees protection for doing so.',
    correctedOutput:
      'Fictional review note: FRONT-F1 says missing; FRONT-A1 records DEMO-7. I will hold the automated rejection and request the permitted training review route, with the conflict and source references recorded. I will flag the two similar cases without claiming a cause or granting myself real override authority.',
    handoff:
      'FRONT-ROUTE names fictional shift lead Mira via the training incident sheet, with coordinator Kiran as backup. State urgency and the effect of waiting. Confirm the actual institution’s written responsibility, override permission and reporting protection before any production adaptation.',
    permittedAction:
      'In this training case, prepare a human-review request and pattern note. In real work follow the approved local route; if permission or protection is unclear, raise that gap to a named responsible person rather than inventing it.',
    recordSources: [
      TRAINING_BOUNDARY,
      source(
        'FRONT-A1',
        'Fictional demonstration appointment reference DEMO-7 is recorded as present. No real person, entitlement, health assessment or financial decision is represented.',
      ),
      source(
        'FRONT-F1',
        'Supplied fictional tool output incorrectly labels DEMO-7 missing. It is a suggestion that needs source checking, not final decision authority.',
      ),
      source(
        'FRONT-P1',
        'Training log records two similar missing-label cases. Cause, population rate and subgroup distribution are unknown.',
      ),
      source(
        'FRONT-ROUTE',
        'Fictional training procedure permits holding this simulated rejection for human review. Mira is lead via the training incident sheet; Kiran is backup. Production responsibility, written override permission and protection from retaliation are unconfirmed OPEN items.',
      ),
    ],
    factQuestion: q(
      'Which source conflict is a reason to pause and check?',
      [
        'The tool says missing while FRONT-A1 records DEMO-7',
        'The tool has a confident tone alone proving truth',
        'The Academy course grants system access',
        'A training participant becomes an approver',
      ],
      0,
      'The appointment record and the suggested flag conflict. The appropriate training action is a bounded human review with the source conflict recorded.',
    ),
    claimQuestion: q(
      'What does the fictional training procedure permit?',
      [
        'Override every real service system',
        'Hold this simulated rejection for human review',
        'Issue a clinical judgment',
        'Treat reporting protection as confirmed everywhere',
      ],
      1,
      'FRONT-ROUTE permits a training review request only. Actual responsibility, override permission and reporting protections must be confirmed with the institution.',
    ),
    trialQuestion: q(
      'What can two similar recorded flags establish?',
      [
        'A proven bias cause',
        'A population failure rate',
        'A pattern question needing investigation, without a cause claim',
        'Permission to publish client records',
      ],
      2,
      'Two cases justify asking about a repeating pattern. They do not provide population denominators, subgroup distribution or a causal investigation.',
    ),
    references: [C3, C4, C5],
  },
];
export class JobTemplateError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'JobTemplateError';
  }
}
export function jobTemplate(id: unknown): JobTemplate {
  const found = JOB_TEMPLATES.find((t) => t.id === id);
  if (!found) throw new JobTemplateError('Choose an available job-practice starting point.', 404);
  return structuredClone(found);
}
export function jobTemplateSourceRef(id: unknown): ContentRef {
  const t = jobTemplate(id);
  return { scope: 'global', programId: t.baseProgramId, versionId: LEGACY_CONTENT_VERSION };
}

/** Optional historical metadata is displayed only when bound to the exact copied seed. */
export function readJobTemplateOrigin(draft: unknown): JobTemplateOrigin | null {
  try {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
    const d = draft as Record<string, unknown>,
      o = d.templateOrigin;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const x = o as Record<string, unknown>;
    const keys = [
      'kind',
      'templateId',
      'templateVersion',
      'sourceRef',
      'governanceReferences',
      'createdAt',
      'adaptationStatus',
    ];
    if (
      Object.keys(x).length !== keys.length ||
      Object.keys(x).some((k) => !keys.includes(k)) ||
      x.kind !== 'owner-job-practice-template' ||
      x.templateVersion !== JOB_TEMPLATE_VERSION ||
      x.adaptationStatus !== 'independent-review-required'
    )
      return null;
    const t = jobTemplate(x.templateId),
      ref = jobTemplateSourceRef(t.id);
    const exactRef = (r: unknown) =>
      !!r &&
      typeof r === 'object' &&
      !Array.isArray(r) &&
      Object.keys(r).length === 3 &&
      Object.keys(r).every((k) => ['scope', 'programId', 'versionId'].includes(k)) &&
      (r as ContentRef).scope === ref.scope &&
      (r as ContentRef).programId === ref.programId &&
      (r as ContentRef).versionId === ref.versionId;
    if (
      !exactRef(x.sourceRef) ||
      !exactRef(d.baseRef) ||
      typeof x.createdAt !== 'string' ||
      x.createdAt.length !== 24 ||
      !Number.isFinite(Date.parse(x.createdAt)) ||
      new Date(x.createdAt).toISOString() !== x.createdAt ||
      x.createdAt !== d.createdAt
    )
      return null;
    if (!Array.isArray(x.governanceReferences) || x.governanceReferences.length !== t.references.length)
      return null;
    if (
      !x.governanceReferences.every(
        (r, i) =>
          !!r &&
          typeof r === 'object' &&
          !Array.isArray(r) &&
          Object.keys(r).length === 3 &&
          Object.keys(r).every((k) => ['resourceId', 'sections', 'limit'].includes(k)) &&
          r.resourceId === t.references[i].resourceId &&
          r.sections === t.references[i].sections &&
          r.limit === t.references[i].limit,
      )
    )
      return null;
    return structuredClone(x) as JobTemplateOrigin;
  } catch {
    return null;
  }
}

type MutableQuestion = {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};
type TemplateDocument = {
  title: string;
  summary: string;
  promise: string;
  estimatedMinutes: number;
  prerequisites: string[];
  outcomes: string[];
  lessons: {
    id: string;
    title: string;
    objective: string;
    estimatedMinutes: number;
    lessonText: string;
    steps: string[];
    reflectionPrompt: string;
    returnToWorkAction: string;
    quiz: MutableQuestion[];
    exercise: {
      title: string;
      sourcePacket: unknown[];
      suppliedAiDraft: string;
      optionalAiPrompt: string;
      learnerTask: string;
      expectedEvidence: string[];
      assessorReference: string;
    };
  }[];
  practicalAssessment: {
    title: string;
    scenario: string;
    submissionPrompts: { id: string; label: string; help: string }[];
    rubric: {
      id: string;
      dimension: string;
      weight: number;
      anchors: Record<string, string>;
      criticalGate: string | null;
    }[];
    samplePassingEvidence: string;
    sampleCriticalFailure: string;
    assessorNote: string;
  };
};
/** The caller supplies a NEW server-owned copied document, never an existing editable/published one. */
export function tailorJobTemplateDocument<T extends TemplateDocument>(newCopiedDocument: T, id: unknown): T {
  const t = jobTemplate(id),
    d = structuredClone(newCopiedDocument);
  if (
    d.lessons.length !== 3 ||
    d.lessons.some((l) => l.quiz.length !== 3 || l.quiz.some((q) => q.options.length !== 4))
  )
    throw new JobTemplateError(
      'The starting content structure changed. Review the template against its exact seed version.',
      409,
    );
  d.title = t.title;
  d.summary = t.summary;
  d.promise = t.promise;
  d.estimatedMinutes = 110;
  d.prerequisites = [
    'Use only the supplied fictional records; bring no real private information.',
    'Basic reading or learner-declared reading help; no provider account is required.',
  ];
  d.outcomes = [
    'Link each material statement to a supplied source and mark missing context.',
    'Correct the supplied draft without inventing authority or wider success.',
    'Prepare a named human handoff with a permitted next step and stop boundary.',
  ];
  const phaseTitles = [
    'Check the record before trusting the draft',
    'Correct a claim and explain the limits',
    'Prepare the handoff and escalation',
  ];
  const tasks = [
    `Show the verified facts and calculation: ${t.calculation} Separate these from missing context.`,
    `Correct the supplied draft. Remove ${t.unsupportedClaim}; show the source basis for every retained commitment.`,
    `Prepare a short handoff. ${t.handoff} State the permitted action, backup, missing authority and reason to stop.`,
  ];
  const phaseQuestions = [t.factQuestion, t.claimQuestion, t.trialQuestion];
  for (const [index, l] of d.lessons.entries()) {
    l.title = phaseTitles[index];
    l.objective = tasks[index];
    l.estimatedMinutes = [35, 35, 40][index];
    l.lessonText = `This fictional practice content starts as an owner-authored draft and must receive independent content review before publication. ${t.checkedFacts}\n\nCheck: ${t.calculation}\n\nUnknown: ${t.missingContext}\n\nA polished AI draft is not a source or a permission. Compare its material claims with the source packet and keep unsupported statements out of the final work. ${t.permittedAction}\n\n${t.handoff}\n\nThe library offers governance teaching principles; it does not approve this adaptation or grant your institution's permissions. Practise this lesson using only the supplied fictional packet.`;
    l.steps = [
      'Read each source reference and distinguish facts from an instruction or suggestion.',
      'Check the calculation or source conflict and list what cannot be concluded.',
      'Write the corrected draft or handoff; retain the human review and permission boundary.',
    ];
    l.reflectionPrompt =
      'Which unsupported claim was easiest to believe, and which source or named human route changes your next step?';
    l.returnToWorkAction =
      t.permittedAction +
      ' Prepare a fictional review card before considering a low-consequence permitted work trial.';
    l.exercise = {
      ...l.exercise,
      title: phaseTitles[index] + ' · fictional task',
      sourcePacket: structuredClone(t.recordSources) as SourceFact[],
      suppliedAiDraft: t.flawedDraft,
      optionalAiPrompt:
        'Optional drafting instruction only: use these fictional source facts, name their references, mark unknowns, make no unsupported commitment, and keep human approval. You can complete the exercise by reviewing the supplied draft; no AI account or provider call is needed.',
      learnerTask: tasks[index],
      expectedEvidence: [
        'Checked source references and explicit unknowns.',
        'A corrected statement, calculation or source-conflict explanation.',
        'A named fictional reviewer, backup and permitted next action.',
      ],
      assessorReference: `Check against the packet, not against a model's confidence. ${t.checkedFacts} ${t.calculation} ${t.missingContext} ${t.correctedOutput} ${t.handoff}`,
    };
    const general =
      index === 0
        ? [
            q(
              'Which input is suitable for this practice?',
              [
                'An actual client file',
                'Only the supplied fictional packet',
                'Bank credentials',
                'A colleague’s private notes',
              ],
              1,
              'The supplied fictional records are enough. Private client files, credentials and third-party notes are unnecessary and must not be supplied.',
            ),
            q(
              'What should happen to missing context?',
              [
                'Ask a model to invent it',
                'Omit the fact that it is missing',
                'Name the gap and seek the designated human check',
                'Treat confidence as evidence',
              ],
              2,
              `The source cannot establish the missing facts. ${t.missingContext} Name the gap rather than turn a guess into a claim.`,
            ),
          ]
        : index === 1
          ? [
              q(
                'What makes a corrected claim defensible?',
                [
                  'Fluent wording',
                  'A source reference and explicit limits',
                  'A larger productivity promise',
                  'The Academy owner role',
                ],
                1,
                'A corrected claim must map to permitted source facts and disclose unresolved context. Fluency, promises and training roles supply no evidence or authority.',
              ),
              q(
                'When is a real action authorized by this exercise?',
                [
                  'As soon as a draft sounds confident',
                  'When a learner finishes the quiz',
                  'The exercise grants no real authority; follow the approved institutional route',
                  'When the app displays a green tag',
                ],
                2,
                `This is synthetic practice. ${t.permittedAction} Completion and interface indicators do not grant consequential decision authority.`,
              ),
            ]
          : [
              q(
                'What must a usable escalation handoff contain?',
                [
                  'Only the word supervisor',
                  'A named reviewer, usable channel, backup and source conflict',
                  'Every real client record',
                  'A claim that protection is guaranteed',
                ],
                1,
                `${t.handoff} A generic role name and an untested promise are not enough; keep sharing minimal and source-based.`,
              ),
              q(
                'What must be confirmed before adapting frontline override or reporting rights to real work?',
                [
                  'That the fictional learner passed',
                  'That AI is always right',
                  'The institution’s responsibility, written override permission and reporting protection',
                  'Nothing because a library handbook grants permission',
                ],
                2,
                'C5 Trainer OPEN items are institution-specific confirmations. Teaching references, Academy roles and fictional procedures cannot establish them.',
              ),
            ];
    const questions = [phaseQuestions[index], ...general];
    l.quiz = l.quiz.map((existing, i) => ({
      ...existing,
      ...structuredClone(questions[i]),
      options: [...questions[i].options],
    }));
  }
  const a = d.practicalAssessment;
  a.title = t.title + ' · practical demonstration';
  a.scenario = `Using only the three lesson packets, prepare one checked work product, a corrected draft, and a named fictional human handoff. ${t.checkedFacts} ${t.missingContext} The supplied AI draft intentionally includes unsupported statements. This is private nonaccredited practice, not approval for real work.`;
  const labels: Record<string, string> = {
    task: 'Purpose, audience and safe boundary',
    record: 'Checked record and calculation',
    'safe-input': 'Fictional input and information withheld',
    'ai-evidence': 'Supplied draft and safer instructions',
    checks: 'Sources, unsupported claims and corrections',
    final: 'Corrected draft or human-review brief',
    checklist: 'Named actions, dependencies and checks',
    handoff: 'Named reviewer, channel and backup',
    return: 'Permitted next step and escalation',
  };
  const promptHelp: Record<string, string> = {
    task: `State the fictional audience, intended work product and safe action boundary. ${t.summary}`,
    record: `Show the checked record with source IDs and calculation. ${t.checkedFacts} ${t.calculation}`,
    'safe-input':
      'Name which fictional source records you used and why. State the real private information, credentials and unnecessary third-party records you withheld; bring none of them into this exercise.',
    'ai-evidence': `Identify an unsupported claim in the supplied draft and write a safer source-bound instruction. The supplied draft says: ${t.flawedDraft}`,
    checks: `Map each retained claim to a source ID, show your checks and explain missing context. ${t.calculation} ${t.missingContext}`,
    final: `Write your own corrected work product with source mapping and explicit limits. Reference outcome: ${t.correctedOutput}`,
    checklist: `List actions, dependencies, named owners and the confirming source for each. ${t.handoff}`,
    handoff: `Prepare a concise handoff naming the reviewer, usable channel, backup and the issue that needs a decision. ${t.handoff}`,
    return: `Name the permitted next step and stopping boundary, with escalation if it remains unclear. ${t.permittedAction} ${t.handoff}`,
  };
  for (const prompt of a.submissionPrompts) {
    prompt.label = labels[prompt.id] ?? 'Source-linked practice explanation';
    prompt.help =
      promptHelp[prompt.id] ??
      'Use fictional source references and explain your own reasoning, unknowns and human review boundary.';
  }
  const dimensions = [
    'Checked work product',
    'Source verification',
    'Careful information handling',
    'Human judgment and escalation',
  ];
  for (const [i, r] of a.rubric.entries()) {
    r.dimension = dimensions[i] ?? r.dimension;
    const evidence = [
      t.correctedOutput,
      `${t.calculation} ${t.missingContext}`,
      'Only the fictional packet is used; real personal records, secrets and unnecessary details are withheld.',
      `${t.handoff} ${t.permittedAction}`,
    ][i];
    r.anchors = {
      '0': 'No relevant evidence, or a material unsafe claim remains.',
      '1': 'Partial work with important source or boundary errors.',
      '2': 'Mostly usable work with one material missing check or handoff.',
      '3': 'A complete checked explanation meeting the stated requirement: ' + evidence,
      '4':
        'Meets the requirement and adds concise source mapping, explicit unknowns and a reusable permitted review route: ' +
        evidence,
    };
    if (r.criticalGate !== null)
      r.criticalGate =
        i === 1
          ? 'Do not present ' + t.unsupportedClaim + ' as a verified fact or authorized recommendation.'
          : i === 2
            ? 'No actual private records, credentials or unnecessary third-party information are submitted or proposed for an unapproved tool.'
            : 'The learner retains designated human review and does not infer professional, official or production override authority from Academy or the fictional packet.';
  }
  a.samplePassingEvidence = `I used only the fictional packet. ${t.checkedFacts} ${t.calculation} I removed the unsupported claims and named these gaps: ${t.missingContext} My corrected output is: ${t.correctedOutput} My handoff is: ${t.handoff} ${t.permittedAction}`;
  a.sampleCriticalFailure = `A polished response still retains ${t.unsupportedClaim} or claims that an Academy role authorizes a real consequential action. The relevant critical gate fails regardless of aggregate score.`;
  a.assessorNote =
    'Assess the source-linked work, stated limits, minimal information and human handoff, not typing speed, use of an AI brand or agreement with unsupported claims. This owner adaptation still needs independent source/answer/rubric/safety/accessibility review; it establishes no domain or recognized issuer approval.';
  return d;
}
