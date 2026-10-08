// Candidate vectors. Root can bundle the candidate to runtime/readiness.mjs,
// then run this file. No application server, browser or production calls.
import test from 'node:test';
import assert from 'node:assert/strict';
const { deriveContentReadiness, prepareOwnLearningHelp } = await import(
  '../../.sites-runtime/content-readiness-qa/readiness.mjs'
);
const NOW = '2026-10-06T06:00:00.000Z',
  PAST = '2026-10-05T06:00:00.000Z',
  FUTURE = '2026-10-20T06:00:00.000Z';
const ref = (versionId = 'private-1') => ({ scope: 'tw-a', programId: 'path-a', versionId });
function fixture() {
  return {
    id: 'tw-a',
    name: 'Private workspace',
    active: true,
    currentUserId: 'owner',
    roles: ['admin', 'facilitator'],
    members: [
      { userId: 'owner', name: 'Owner', active: true, roles: ['admin'] },
      { userId: 'author', name: 'Author', active: true, roles: ['admin'] },
      { userId: 'reviewer', name: 'Reviewer', active: true, roles: ['admin'] },
    ],
    cohorts: [
      {
        id: 'co-a',
        title: 'Scoped cohort',
        status: 'open',
        canHost: true,
        contentOpen: false,
        contentNotice: 'New enrollment is closed.',
        contentRef: ref(),
      },
      {
        id: 'co-b',
        title: 'Other edition',
        status: 'open',
        canHost: true,
        contentOpen: true,
        contentRef: ref('private-2'),
      },
    ],
    content: {
      drafts: [],
      publications: [
        {
          id: 'cp-a',
          ref: ref(),
          title: 'Retired teaching exercise',
          availability: 'retired',
          reviewDueAt: FUTURE,
          authorName: 'Author',
          reviewerName: 'Reviewer',
        },
      ],
    },
    support: { queue: [], assigned: [], mine: [] },
  };
}
function draft(overrides = {}) {
  return {
    id: 'cd-a',
    state: 'in_review',
    authorId: 'author',
    authorName: 'Author',
    reviewerId: 'reviewer',
    reviewDueAt: FUTURE,
    updatedAt: PAST,
    document: { title: 'Independent draft' },
    ...overrides,
  };
}
function support(overrides = {}) {
  return {
    id: 'sup-a',
    category: 'learning',
    cohortId: 'co-a',
    cohortTitle: 'Scoped cohort',
    status: 'open',
    createdAt: PAST,
    handlerName: null,
    eligibleHandlerAvailable: true,
    ...overrides,
  };
}
const ownHelp = {
  preferences: { preferredLanguage: 'hi', assistancePreference: 'capture-response' },
  course: { title: 'Saved course', language: 'en', cohortId: 'co-a' },
};
const noChoices = {
  includeRequestedLanguage: false,
  includeAssistancePreference: false,
  includeCourse: false,
};

test('current owner or facilitator authority is required; raw Team does not qualify', () => {
  const team = fixture();
  assert.ok(deriveContentReadiness(team, NOW));
  for (const roles of [[], ['learner'], ['assessor'], ['reviewer'], ['moderator']])
    assert.equal(deriveContentReadiness({ ...team, roles }, NOW), null);
  assert.equal(deriveContentReadiness({ ...team, active: false }, NOW), null);
  const { active, roles, ...raw } = team;
  assert.equal(deriveContentReadiness(raw, NOW), null);
});
test('retired publication maps only exact edition cohorts and does not pause them', () => {
  const team = fixture(),
    before = structuredClone(team),
    m = deriveContentReadiness(team, NOW);
  assert.equal(m.counts.retiredPublications, 1);
  assert.equal(m.content.items[0].affectedCohorts.length, 1);
  assert.equal(m.content.items[0].affectedCohorts[0].id, 'co-a');
  assert.equal(m.counts.pausedCohorts, 0);
  assert.deepEqual(team, before);
});
test('calendar elapsed date and server snapshot enrollment closure remain separate observations', () => {
  const team = fixture();
  team.content.publications[0].availability = 'available';
  team.content.publications[0].reviewDueAt = NOW;
  team.cohorts[0].contentOpen = true;
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.counts.elapsedPublicationReviews, 1);
  assert.equal(m.counts.contentEnrollmentBlocked, 0);
  assert.equal(m.content.items[0].state, 'publication_review_elapsed');
});
test('invalid review date is unknown, not an invented elapsed date or safety finding', () => {
  const team = fixture();
  Object.assign(team.content.publications[0], { availability: 'available', reviewDueAt: 'not-a-date' });
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.content.items[0].state, 'publication_date_unknown');
  assert.equal(m.content.items[0].reviewDueAt, null);
  assert.equal(m.counts.elapsedPublicationReviews, 0);
});
test('pending draft shows independent reviewer loss and correct recall route', () => {
  const team = fixture();
  team.content.drafts = [draft()];
  team.members.find((m) => m.userId === 'reviewer').active = false;
  const m = deriveContentReadiness(team, NOW),
    d = m.content.items.find((i) => i.kind === 'draft');
  assert.equal(d.reviewerAvailable, false);
  assert.equal(m.counts.reviewerUnavailable, 1);
  assert.match(d.nextStep, /current author can recall/);
  assert.equal(d.waitingDays, 1);
});
test('orphaned author draft offers archive and separate-copy route, not another owner edit takeover', () => {
  const team = fixture();
  team.content.drafts = [draft()];
  team.members.find((m) => m.userId === 'author').roles = ['learner'];
  const m = deriveContentReadiness(team, NOW),
    d = m.content.items.find((i) => i.kind === 'draft');
  assert.equal(d.authorAvailable, false);
  assert.match(d.nextStep, /archive/);
  assert.match(d.nextStep, /separate draft/);
  assert.equal(m.counts.authorUnavailable, 1);
});
test('an assigned author cannot be counted as independent content reviewer', () => {
  const team = fixture();
  team.content.drafts = [draft({ reviewerId: 'author' })];
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.content.items.find((i) => i.kind === 'draft').reviewerAvailable, false);
});
test('author loss alone does not fabricate a block on current independent review or unchanged publication', () => {
  const team = fixture();
  team.content.drafts = [draft({ state: 'approved' })];
  team.members.find((m) => m.userId === 'author').active = false;
  const d = deriveContentReadiness(team, NOW).content.items.find((i) => i.kind === 'draft');
  assert.equal(d.authorAvailable, false);
  assert.equal(d.reviewerAvailable, true);
  assert.match(d.nextStep, /may publish the unchanged approved document/);
});
test('future draft timestamps have unavailable waiting age and no negative days', () => {
  const team = fixture();
  team.content.drafts = [draft({ updatedAt: FUTURE })];
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.content.items.find((i) => i.kind === 'draft').waitingDays, null);
});
test('facilitator scope excludes learner-visible unrelated cohorts and owner-only content', () => {
  const team = fixture();
  team.roles = ['facilitator', 'learner'];
  team.cohorts[1].canHost = false;
  team.content.drafts = [draft({ document: { title: 'PRIVATE_CONTENT_CANARY' } })];
  team.members[0].email = 'PRIVATE_EMAIL_CANARY';
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.counts.scopedCohorts, 1);
  assert.equal(m.content.visible, false);
  assert.deepEqual(m.content.items, []);
  assert.equal(
    m.cohorts.some((c) => c.id === 'co-b'),
    false,
  );
  assert.equal(JSON.stringify(m).includes('PRIVATE_'), false);
});
test('facilitator cannot count privacy/accessibility cases or unrelated-cohort learning cases', () => {
  const team = fixture();
  team.roles = ['facilitator', 'learner'];
  team.cohorts[1].canHost = false;
  team.support.queue = [
    support(),
    support({ id: 'sup-b', category: 'accessibility' }),
    support({ id: 'sup-c', category: 'privacy', cohortId: null }),
    support({ id: 'sup-d', cohortId: 'co-b' }),
  ];
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.support.totalOpen, 1);
  assert.equal(m.counts.openAccessRequests, 0);
  assert.equal(m.support.items[0].id, 'sup-a');
});
test('support summaries do not copy titles, messages, resolutions, requester identity or private preferences', () => {
  const team = fixture();
  team.support.queue = [
    support({
      category: 'accessibility',
      subject: 'SUPPORT_TITLE_CANARY',
      body: 'SUPPORT_BODY_CANARY',
      requesterId: 'SUPPORT_IDENTITY_CANARY',
    }),
  ];
  team.support.assigned = [{ body: 'ASSIGNED_BODY_CANARY' }];
  team.support.mine = [{ body: 'MINE_BODY_CANARY' }];
  team.state = { learningAccess: { preferredLanguage: 'PREFERENCE_CANARY' } };
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.counts.openAccessRequests, 1);
  assert.equal(JSON.stringify(m).includes('CANARY'), false);
  assert.equal(m.operatingBoundary.workplaceEscalationOwner, 'not_recorded');
});
test('bounded input refusal never silently truncates oversized aggregate snapshots', () => {
  for (const [field, count] of [
    ['cohorts', 21],
    ['members', 101],
  ]) {
    const team = fixture();
    team[field] = Array.from({ length: count }, (_, i) =>
      field === 'members' ? { userId: 'u-' + i } : { id: 'co-' + i },
    );
    assert.equal(deriveContentReadiness(team, NOW), null);
  }
  const team = fixture();
  team.support.queue = Array.from({ length: 101 }, (_, i) => support({ id: 's-' + i }));
  assert.equal(deriveContentReadiness(team, NOW), null);
});
test('duplicate IDs and foreign publication references refuse ambiguous or cross-workspace content', () => {
  const team = fixture();
  team.cohorts.push({ ...team.cohorts[0] });
  assert.equal(deriveContentReadiness(team, NOW), null);
  const other = fixture();
  other.content.publications[0].ref.scope = 'tw-foreign';
  assert.equal(deriveContentReadiness(other, NOW), null);
});
test('malformed support handling metadata does not create an invented healthy queue', () => {
  const team = fixture();
  team.support.queue = [support({ handlerName: undefined })];
  assert.equal(deriveContentReadiness(team, NOW), null);
  const other = fixture();
  other.support.queue = [support({ status: 'pending' })];
  assert.equal(deriveContentReadiness(other, NOW), null);
});
test('row cap preserves whole attention counts; it does not imply all items were shown', () => {
  const team = fixture();
  team.content.drafts = Array.from({ length: 12 }, (_, i) => draft({ id: 'cd-' + i }));
  const m = deriveContentReadiness(team, NOW);
  assert.equal(m.content.totalAttention, 13);
  assert.equal(m.content.items.length, 8);
  assert.equal(m.counts.pendingDraftReviews, 12);
});
test('no disclosure choices include no private preference or course information', () => {
  const help = prepareOwnLearningHelp({
    ...ownHelp,
    preferences: { preferredLanguage: 'SAVED_LANGUAGE_CANARY', assistancePreference: 'capture-response' },
    course: { title: 'COURSE_CANARY', language: 'en', cohortId: 'co-a' },
    privateDraft: 'EVIDENCE_CANARY',
    choices: noChoices,
  });
  assert.equal(help.category, 'accessibility');
  assert.equal(help.cohortId, null);
  assert.equal(help.subject, 'Learning access support');
  assert.equal(JSON.stringify(help).includes('CANARY'), false);
  assert.equal(help.body.includes('read back'), false);
});
test('each learning-help disclosure is independently selected and remains an unsent draft', () => {
  const language = prepareOwnLearningHelp({
    ...ownHelp,
    choices: { ...noChoices, includeRequestedLanguage: true },
  });
  assert.match(language.body, /language: hi/);
  assert.equal(language.body.includes('Saved course'), false);
  assert.equal(language.body.includes('read back'), false);
  assert.equal(language.cohortId, null);
  const assistance = prepareOwnLearningHelp({
    ...ownHelp,
    choices: { ...noChoices, includeAssistancePreference: true },
  });
  assert.match(assistance.body, /read back/);
  assert.equal(assistance.body.includes('language: hi'), false);
  const course = prepareOwnLearningHelp({ ...ownHelp, choices: { ...noChoices, includeCourse: true } });
  assert.equal(course.cohortId, 'co-a');
  assert.match(course.body, /Saved course/);
  assert.equal(course.body.includes('language: hi'), false);
});
test('unsupported disclosure choices and unreviewed language values do not become support commands', () => {
  assert.throws(() => prepareOwnLearningHelp({ ...ownHelp, choices: { ...noChoices, shareEvidence: true } }));
  assert.throws(() =>
    prepareOwnLearningHelp({
      ...ownHelp,
      preferences: { ...ownHelp.preferences, preferredLanguage: 'hi\nINJECTED' },
      choices: { ...noChoices, includeRequestedLanguage: true },
    }),
  );
  assert.throws(() =>
    prepareOwnLearningHelp({ ...ownHelp, course: null, choices: { ...noChoices, includeCourse: true } }),
  );
});
