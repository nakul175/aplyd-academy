/** Fixed generic discussion material. No saved state, transport, permission or live recipient. */
const SNAPSHOT = {
  contentVersion: '0.1-review-draft',
  curriculumSha256: '9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4',
  libraryCatalogSha256: '76b893df0537a82fce5bbfd5213b404c511986de822718b222b2483f2f458512',
  ecosystemSourceSha256: 'd12b3a3c6af5b35a38af5e99b0fc674ead9f0cb7ed58c0d31c4a4f5d2a6af19a',
  partners: {
    agri: {
      id: 'agri',
      name: 'Agri Saha',
      pathwayId: 'farmer-work-records',
      task: 'Prepare an expert question brief from a fictional farm activity record.',
      learningTitle: 'Farm records and better questions with AI',
      credentialClaim:
        'Demonstrated farm-record organization, information checking and expert-question preparation using synthetic training data',
      credentialExclusions: [
        'No agricultural professional qualification',
        'No certification to prescribe farm inputs or make agronomic decisions',
      ],
      learningSourceNotice:
        'Synthetic farm records supplied within each activity are the only factual source for this exercise.',
    },
    msme: {
      id: 'msme',
      name: 'MSME',
      pathwayId: 'msme-customer-operations',
      task: 'Prepare an accurate customer response and a daily work checklist.',
      learningTitle: 'Customer communication and daily operations with AI',
      credentialClaim:
        'Demonstrated customer-draft preparation, operations checklist creation and responsible AI checking using synthetic business records',
      credentialExclusions: [
        'No financial, tax or legal professional qualification',
        'No assurance of business results or automated customer commitments',
      ],
      learningSourceNotice:
        'The example order policy and records are fictional fixtures, not a recommended business policy.',
    },
    public: {
      id: 'public',
      name: 'Public service',
      pathwayId: 'public-servant-source-briefs',
      task: 'Prepare a source-based brief with checked policy limits.',
      learningTitle: 'Clear administrative briefs with accountable AI use',
      credentialClaim:
        'Demonstrated administrative drafting, source verification and responsible information-handling using synthetic training material',
      credentialExclusions: [
        'No authority to issue official decisions',
        'No legal or statutory qualification',
        'No assurance that an external AI tool is approved by an employer',
      ],
      learningSourceNotice:
        'Every notice, department, programme, figure and policy below is fictional. No actual law, administrative direction or citizen service rule is stated.',
    },
  },
  references: [
    {
      id: 'government-trainer-handbook',
      title: 'Governing AI in Government · Trainer handbook',
      sourceFilename: 'APLYD_C1_Trainer_Handbook.docx',
      sha256: 'a3124b639858b9a640d7224585a935d56564374363cd7ce7e074b924e508d7e9',
      bytes: 34899,
      sections: [
        '4.6 · Procurement craft (Part 5)',
        '4.8 · Governance architecture (Part 7)',
        '4.15 · Sunset — retiring a deployment deliberately',
      ],
      use: 'Teaching reference only; does not establish partner or institutional authority.',
    },
    {
      id: 'frontline-trainer-handbook',
      title: 'Using AI Well at the Point of Delivery · Trainer handbook',
      sourceFilename: 'APLYD_C5_Trainer_Handbook.docx',
      sha256: '6a377e3668bc455079420034f0cb846579091c685582fe69fb4c792b8307e941',
      bytes: 18848,
      sections: ['6.7 · The consent conversation', '8 · Before you deliver — the OPEN items'],
      use: 'Teaching reference only; does not establish partner or institutional authority.',
    },
    {
      id: 'development-trainer-handbook',
      title: 'Governing AI in the Development Sector · Trainer handbook',
      sourceFilename: 'APLYD_C2_Trainer_Handbook.docx',
      sha256: '9130e3294b723576f2bac7825db81a7039730f08b2a7cabd8e65827f6b3aa193',
      bytes: 31325,
      sections: ["4.11 · The funder's portfolio — conditions, not operations"],
      use: 'Teaching reference only; does not establish partner or institutional authority.',
    },
  ],
};

export const PARTNER_REVIEW_FORMAT = 'aplyd.partner-review-checklist/1';
const DECISIONS = [
  {
    id: 'recipient',
    question: 'Which service receives the summary, and how is the right account confirmed?',
    evidenceNeeded:
      'Partner service specification and account-link/authentication design. Do not record account identifiers in this checklist.',
    references: ['frontline-trainer-handbook:6.7'],
  },
  {
    id: 'purpose',
    question: 'What exact purpose and fields are permitted, and what happens if a learner declines?',
    evidenceNeeded:
      'Agreed purpose, minimum field list, retention period and an accessible explanation of declining. A local choice is not approval for a live return.',
    references: ['frontline-trainer-handbook:6.7'],
  },
  {
    id: 'contract',
    question: 'Which partner-owned specification and compatibility tests will both sides accept?',
    evidenceNeeded:
      'Version policy, acknowledgements, retries, duplicate-event handling, errors and status-correction tests. The current local contract establishes none of these for a partner.',
    references: [],
  },
  {
    id: 'withdrawal',
    question: 'Where does stopping take effect, and who handles a changed status or retained data?',
    evidenceNeeded:
      'Stop boundary, in-flight requests, correction process, retention/deletion responsibilities and evidence of a stop test. Local withdrawal only stops future local tests.',
    references: ['government-trainer-handbook:4.6', 'government-trainer-handbook:4.15'],
  },
  {
    id: 'authority',
    question: 'Which responsible roles can pause, resolve and resume an exchange?',
    evidenceNeeded:
      'Operating owner role, backup role, pause authority, escalation route and recovery exercise. Academy membership is not institutional authority.',
    references: ['government-trainer-handbook:4.8'],
  },
  {
    id: 'frontline',
    question:
      'Which override, failure and reporting protections are confirmed for the people doing the work?',
    evidenceNeeded:
      'Institution-confirmed written override permission, responsibility for failures and protection for reporting concerns. These items are open in the supplied teaching material.',
    references: ['frontline-trainer-handbook:8'],
  },
  {
    id: 'exit',
    question: 'What continues if the partner or programme leaves?',
    evidenceNeeded:
      'Audit/remediation rights, export and continuity responsibilities, and a funded exit plan where relevant.',
    references: [
      'government-trainer-handbook:4.6',
      'government-trainer-handbook:4.15',
      'development-trainer-handbook:4.11',
    ],
  },
];
const FIELDS = [
  ['contract_version', 'string', 'always', 'Exactly aplyd.learning-return/1.0-test.'],
  ['mode', 'string', 'always', 'Exactly local-test.'],
  ['partner', 'string', 'always', 'Exactly the partner ID shown in this checklist: agri, msme or public.'],
  [
    'event_id',
    'string',
    'always',
    'Internal local event reference; 1–100 ASCII letters, digits, underscore or hyphen. Does not identify a receiving partner account.',
  ],
  [
    'occurred_at',
    'string',
    'always',
    'Canonical UTC timestamp YYYY-MM-DDTHH:mm:ss.sssZ, checked by a date round-trip.',
  ],
  [
    'enrollment_ref',
    'string',
    'always',
    'Internal saved-learning reference; 1–100 ASCII letters, digits, underscore or hyphen. Not a partner account link.',
  ],
  ['pathway_id', 'string', 'always', 'Exactly this partner’s mapped pathway.'],
  [
    'content_version',
    'string',
    'always',
    '1–100 ASCII letters, digits, period, underscore or hyphen. A local test must match the exact retained enrollment and choice version; no substitute version.',
  ],
  ['purpose', 'string', 'always', 'Exactly local-return-contract-review.'],
  [
    'scopes',
    'array of strings',
    'always',
    'One or both of learning.progress and practice.record, each once. The builder uses that order. Optional summary objects must exactly match these scopes.',
  ],
  [
    'learning.completed_lessons',
    'integer',
    'learning.progress',
    '0 through total_lessons; the command verifies distinct completed lesson IDs against the exact pinned curriculum.',
  ],
  [
    'learning.total_lessons',
    'integer',
    'learning.progress',
    '1 through 100; taken from the exact pinned curriculum.',
  ],
  [
    'learning.status',
    'string',
    'learning.progress',
    'completed if the two counts are equal; otherwise in-progress.',
  ],
  [
    'practice_record.status',
    'string',
    'practice.record',
    'not-issued, active or suspended. This is a local non-accredited practice status.',
  ],
  ['practice_record.claim_type', 'string', 'practice.record', 'Exactly nonaccredited-practice.'],
  [
    'practice_record.review_mode',
    'string',
    'practice.record',
    'not-reviewed exactly when status is not-issued; otherwise sample-workflow. Does not establish a professional or institutional review.',
  ],
].map(([name, type, requiredWhen, constraint]) => ({ name, type, requiredWhen, constraint }));
const BOUNDARIES = [
  {
    id: 'extra-fields',
    check: 'Add a name, score, note or any unsupported payload field.',
    expected: 'Reject the return. No extra field is transmitted or accepted by this local contract.',
  },
  {
    id: 'wrong-scope',
    check: 'Omit a selected summary, add an unselected summary, repeat a scope or use an unsupported scope.',
    expected: 'Reject the return; selected fields and summary objects must agree.',
  },
  {
    id: 'wrong-pin',
    check: 'Use another mapped pathway, private workspace pin or a different retained version.',
    expected: 'Reject a new local test. Do not substitute the current curriculum for an unavailable pin.',
  },
  {
    id: 'expiry',
    check: 'Run a new test at the exact saved expiry time.',
    expected:
      'Reject the new test at now >= expiry. Earlier valid receipts remain historical local snapshots.',
  },
  {
    id: 'withdraw',
    check: 'Withdraw a valid retained choice, then try a new test.',
    expected: 'Reject the new test. Preserve earlier receipts; withdrawal is not a partner deletion promise.',
  },
  {
    id: 'independent-stop',
    check:
      'Withdraw a valid retained choice while learning is paused or retained receipt history is malformed.',
    expected:
      'Allow the independent withdrawal. Do not require a new test or readable receipt history to stop future local tests.',
  },
  {
    id: 'history-clock',
    check:
      'Present a receipt created in the future, before its retained choice, at/after expiry or after withdrawal.',
    expected:
      'Reject that receipt history. Current time and retained choice timing are checked; a valid old receipt is not current permission.',
  },
  {
    id: 'capacity',
    check: 'Reach 24 retained choices or 100 retained receipts.',
    expected:
      'Reject a further choice or test respectively. Keep retained history and independent withdrawal available.',
  },
];

/** Only a fixed supported partner key is accepted; never pass a learner or workspace object. */
export function hasPartnerReviewPack(partner) {
  return typeof partner === 'string' && ['agri', 'msme', 'public'].includes(partner);
}
export function buildPartnerReviewPack(partner) {
  if (!hasPartnerReviewPack(partner)) throw new TypeError('This partner has no review checklist.');
  return structuredClone({
    format: PARTNER_REVIEW_FORMAT,
    mode: 'discussion-only',
    partner: {
      ...SNAPSHOT.partners[partner],
      contentScope: 'global',
      contentVersion: SNAPSHOT.contentVersion,
      curriculumSha256: SNAPSHOT.curriculumSha256,
    },
    authority: {
      liveExchangeEnabled: false,
      recipientConnected: false,
      authorizesDelivery: false,
      authorizesLocalTest: false,
      decisionsEstablished: false,
    },
    localContract: {
      version: 'aplyd.learning-return/1.0-test',
      purpose: 'local-return-contract-review',
      transport: 'none',
      fields: FIELDS,
      scopeGroups: [
        {
          id: 'learning.progress',
          object: 'learning',
          keys: ['completed_lessons', 'total_lessons', 'status'],
        },
        { id: 'practice.record', object: 'practice_record', keys: ['status', 'claim_type', 'review_mode'] },
      ],
      choiceDurationDays: [1, 7, 30],
      retainedChoiceLimit: 24,
      retainedReceiptLimit: 100,
      shapeRule:
        'The top-level envelope and selected summary objects reject unsupported fields. Optional summary objects are present exactly when selected. Local receipts are simulated, never partner acknowledgements.',
      historyRule:
        'The server checks the current saved choice and pinned learning for every new local test. Existing valid receipts remain snapshots after expiry, withdrawal or a later practice-status change.',
    },
    excludedFields: [
      'names and contact details',
      'private task evidence',
      'assessment scores and review notes',
      'goals and reflections',
      'support conversations',
      'other people’s records',
    ],
    decisions: DECISIONS.map((d) => ({ ...d, status: 'open' })),
    boundaryChecks: BOUNDARIES,
    references: SNAPSHOT.references,
    note: 'Generic fixed material only. Contains no learner, account, enrollment, choice, receipt, progress or status values. No endpoint, recipient, signature, approval or consent record is configured by this document. Library teaching references do not confer institutional authority.',
  });
}
function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
const css = `:root{font-family:Arial,Helvetica,sans-serif;color:#182b35;background:#eaf0ef}*{box-sizing:border-box}body{margin:0;padding:28px 16px}main{max-width:920px;margin:auto;background:white;padding:36px 40px;border-radius:16px}header{border-bottom:3px solid #216b5e;padding-bottom:20px}.eyebrow{font-size:0.75rem;text-transform:uppercase;letter-spacing:.1em;color:#216b5e;font-weight:700}h1{font-size:1.875rem;line-height:1.15;margin:10px 0}h2{font-size:1.1875rem;margin:26px 0 10px}h3{font-size:1rem;margin:0 0 6px}p,li{line-height:1.5;font-size:1rem}p{margin:8px 0}.notice{background:#edf5f2;border-left:4px solid #216b5e;padding:10px 14px}.meta{font-size:0.875rem;color:#4b606a;overflow-wrap:anywhere}code{font-family:monospace;overflow-wrap:anywhere;font-size:0.875rem}.decision{border:1px solid #bccfca;padding:12px 14px;border-radius:8px;margin:10px 0;break-inside:avoid}.open{float:right;padding:3px 8px;background:#fff5db;font-size:0.875rem;border:1px solid #ecd496}.line{font-size:0.875rem;color:#54636a;margin-top:12px;border-top:1px dotted #81958e;padding-top:8px}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:0.875rem}th,td{text-align:left;vertical-align:top;padding:8px 9px;border-bottom:1px solid #d5dfdd;overflow-wrap:anywhere;line-height:1.35}th{background:#edf5f2}th:first-child{width:27%}th:nth-child(2){width:18%}.source{font-size:0.875rem;border-left:2px solid #bdd0c9;padding-left:12px;break-inside:avoid}.source p{overflow-wrap:anywhere}footer{margin-top:24px;border-top:1px solid #bccfca;padding-top:12px}@media(max-width:560px){body{padding:0}main{border-radius:0;padding:22px 16px}h1{font-size:1.5625rem}th,td{padding:6px 5px;font-size:0.875rem}.open{float:none;display:inline-block;margin-bottom:6px}.line{line-height:1.6}}@page{size:auto;margin:14mm}@media print{:root{background:white}body{padding:0;background:white}main{max-width:none;padding:0;border-radius:0}h1{font-size:1.5rem}h2{break-after:avoid}.notice,th{background:transparent}p,li{font-size:10pt}th,td{font-size:9pt}.fields{break-before:page}.source{font-size:9pt}.meta{font-size:9pt}footer{font-size:9pt}}`;

/** Standalone printable HTML: no scripts, remote assets, forms, links or network actions. */
export function renderPartnerReviewPack(partner) {
  const p = buildPartnerReviewPack(partner),
    a = p.partner,
    c = p.localContract;
  const refs = p.references
    .map(
      (r) =>
        `<div class="source"><p><strong>${escape(r.title)}</strong><br>${escape(r.sourceFilename)} · ${r.bytes} bytes<br>${r.sections.map(escape).join('<br>')}</p><p class="meta">SHA-256: ${escape(r.sha256)}</p></div>`,
    )
    .join('');
  const questions = p.decisions
    .map(
      (d, i) =>
        `<article class="decision"><span class="open">OPEN — decision required</span><h3>${i + 1}. ${escape(d.question)}</h3><p>${escape(d.evidenceNeeded)}</p><p class="meta">${d.references.length ? `Teaching reference: ${d.references.map(escape).join(', ')}` : 'Engineering decision — no partner specification supplied.'}</p><p class="line">Decision/evidence reference: ____________________<br>Responsible role: ____________________ &nbsp; Review date: ____________________</p></article>`,
    )
    .join('');
  const fields = c.fields
    .map(
      (f) =>
        `<tr><td><code>${escape(f.name)}</code></td><td>${escape(f.type)}<br><span class="meta">${f.requiredWhen === 'always' ? 'Always present' : `When ${escape(f.requiredWhen)} is selected`}</span></td><td>${escape(f.constraint)}</td></tr>`,
    )
    .join('');
  const checks = p.boundaryChecks
    .map((b) => `<li><strong>${escape(b.check)}</strong><br>${escape(b.expected)}</li>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>${escape(a.name)} · Partner review checklist · Aplyd Academy</title><style>${css}</style></head><body><main><header><p class="eyebrow">Aplyd Academy · Partner discussion</p><h1>${escape(a.name)} review checklist</h1><p>A working sheet for a partner conversation. Print or save as PDF using your browser’s menu.</p><p class="notice"><strong>Every decision below is open.</strong> This document grants no permission and configures no receiving service. Current contract tests stay inside the personal lab; no partner is contacted.</p></header><section><h2>Proposed learning context</h2><p><strong>${escape(a.learningTitle)}</strong><br>${escape(a.task)}</p><p class="meta">Global pathway <code>${escape(a.pathwayId)}</code> · Snapshot ${escape(a.contentVersion)} · SHA-256 ${escape(a.curriculumSha256)}</p><p><strong>Current learning claim:</strong> ${escape(a.credentialClaim)}.</p><ul>${a.credentialExclusions.map((e) => `<li>${escape(e)}</li>`).join('')}</ul><p>${escape(a.learningSourceNotice)}</p></section><section><h2>Decisions to record with the partner</h2><p>Use document references and responsible roles. Keep learner records, account identifiers and contact details out of this worksheet. Writing an answer does not enable an exchange.</p>${questions}</section><section class="fields"><h2>Current local contract and field definitions</h2><p class="meta">Version <code>${escape(c.version)}</code> · Purpose <code>${escape(c.purpose)}</code> · Mode <code>local-test</code> · Partner <code>${escape(a.id)}</code></p><p>A local choice selects one or both summary scopes for exactly 1, 7 or 30 days. It is tied to one saved enrollment and its original global content version. At most 24 choices and 100 local receipts are retained. These limits describe the simulator, not a partner service.</p><div class="table-scroll"><table><thead><tr><th scope="col">Field</th><th scope="col">Type / presence</th><th scope="col">Exact local meaning</th></tr></thead><tbody>${fields}</tbody></table></div><p>${escape(c.shapeRule)}</p><p><strong>Excluded:</strong> ${p.excludedFields.map(escape).join('; ')}.</p></section><section><h2>Boundary checks to discuss</h2><p>These checks describe the current local model. A live partner design still needs its own acceptance evidence and responsible reviewers.</p><ol>${checks}</ol><p>${escape(c.historyRule)}</p></section><section><h2>Reference trail</h2><p>Find these original files in the Academy reference library. They are teaching material; review the relevant institutional context before adopting a work process.</p>${refs}</section><footer><p>${escape(p.note)}</p><p class="meta">Document format: ${escape(p.format)}. The source snapshot is fixed at ${escape(a.contentVersion)}; it is not a current permission, delivery receipt or account-linked record.</p></footer></main></body></html>`;
}
