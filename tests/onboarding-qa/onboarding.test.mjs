import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  nearby = resolve(here, '../..'),
  app = resolve(
    process.env.ACADEMY_APP_PATH ?? (existsSync(nearby + '/app/api/academy/route.ts') ? nearby : '.'),
  );
const output = resolve(process.env.ACADEMY_ONBOARDING_QA_OUTPUT ?? app + '/.sites-runtime/onboarding-qa');
mkdirSync(output, { recursive: true });
globalThis.fetch = () => {
  throw new Error('Network disabled in onboarding tests.');
};
const m = await import(pathToFileURL(output + '/model.mjs'));
const NOW = '2026-10-07T09:00:00.000Z';
const answers = (patch = {}) => ({
  ...m.initialAnswers(m.freshWorkspace(), 'Asha Devi'),
  goal: 'records',
  weeklyMinutes: 90,
  preferredLanguage: 'hi',
  readAloudMode: 'ask',
  assistancePreference: 'read-text',
  context: 'farmer',
  reading: true,
  ...patch,
});
const run = (flow, ...actions) => actions.reduce((f, a) => m.flowReducer(f, a), flow);

test('flow is at most three steps and ends only from the last step', () => {
  assert.deepEqual([...m.ONBOARDING_STEPS], ['role', 'goal', 'access']);
  let f = m.startFlow(answers());
  assert.equal(m.stepNumber(f), 1);
  assert.equal(run(f, { type: 'finish' }).step, 'role', 'cannot finish from step 1');
  f = run(f, { type: 'next' }, { type: 'next' });
  assert.equal(f.step, 'access');
  assert.equal(run(f, { type: 'next' }).step, 'access');
  const done = run(f, { type: 'finish' });
  assert.equal(done.step, 'done');
  assert.equal(done.outcome, 'completed');
  assert.equal(run(done, { type: 'back' }).step, 'done');
  assert.equal(run(m.startFlow(answers()), { type: 'back' }).step, 'role');
  assert.equal(run(f, { type: 'back' }).step, 'goal');
});
test('skip is available at every step and records skipped without changing answers', () => {
  for (const steps of [0, 1, 2]) {
    let f = m.startFlow(answers());
    for (let i = 0; i < steps; i++) f = run(f, { type: 'next' });
    const s = run(f, { type: 'skip' });
    assert.equal(s.step, 'done');
    assert.equal(s.outcome, 'skipped');
    assert.deepEqual(s.answers, f.answers);
  }
});
test('skip command changes only the marker and keeps every other learner field byte-identical', () => {
  const s0 = m.freshWorkspace(),
    s1 = m.applyCommand(s0, m.skipCommand, NOW);
  assert.equal(s1.profile.onboarding, 'skipped');
  const { onboarding, ...profile } = s1.profile;
  assert.deepEqual(profile, s0.profile);
  assert.deepEqual({ ...s1, profile: s0.profile }, s0);
});
test('first-run shows once: never after completion or skip, never for invites, deep links or shared workspaces', () => {
  const base = {
    state: m.freshWorkspace(),
    workspace: 'lab',
    view: 'home',
    viaInvitation: false,
    deepLinked: false,
  };
  assert.equal(m.shouldShowOnboarding(base), true);
  assert.equal(m.shouldShowOnboarding({ ...base, viaInvitation: true }), false);
  assert.equal(m.shouldShowOnboarding({ ...base, deepLinked: true }), false);
  assert.equal(m.shouldShowOnboarding({ ...base, view: 'learn' }), false);
  assert.equal(m.shouldShowOnboarding({ ...base, workspace: 'tw-1' }), false);
  for (const c of [m.skipCommand, m.completeCommand(answers())]) {
    const s = m.applyCommand(base.state, c, NOW);
    assert.equal(m.shouldShowOnboarding({ ...base, state: s }), false);
    const again = m.applyCommand(s, { type: 'profile', ...s.profile, name: 'Renamed' }, NOW);
    assert.equal(again.profile.onboarding, s.profile.onboarding, 'a later preferences save keeps the marker');
    assert.equal(m.shouldShowOnboarding({ ...base, state: again }), false);
  }
});
test('old saved states stay valid: no marker is pending, established learners are not interrupted, all defaults hold', () => {
  const old = m.freshWorkspace();
  delete old.profile.onboarding;
  delete old.learningPlan;
  delete old.learningAccess;
  assert.equal(m.onboardingStatus(old.profile, m.isEstablished(old)), 'pending');
  const withWork = { ...old, enrollments: [{ id: 'e' }] };
  assert.equal(m.onboardingStatus(withWork.profile, m.isEstablished(withWork)), 'established');
  const named = { ...old, profile: { ...old.profile, name: 'Ravi' } };
  assert.equal(m.isEstablished(named), true);
  const a = m.initialAnswers(old);
  assert.equal(a.goal, 'explore');
  assert.equal(a.weeklyMinutes, 60);
  assert.equal(a.preferredLanguage, 'en');
  assert.equal(a.readAloudMode, 'off');
  assert.equal(a.assistancePreference, 'none');
  assert.equal(a.context, 'msme');
  assert.equal(
    Object.hasOwn(m.applyCommand(old, { type: 'profile', ...old.profile }, NOW).profile, 'onboarding'),
    false,
    'saving preferences never invents a marker',
  );
  assert.throws(
    () => m.applyCommand(old, { type: 'profile', ...old.profile, onboarding: 'maybe' }, NOW),
    /valid first-run/,
  );
});
test('platform name pre-fills the display name; an existing name always wins', () => {
  assert.equal(m.initialAnswers(m.freshWorkspace(), 'Asha Devi').name, 'Asha Devi');
  assert.equal(m.initialAnswers(m.freshWorkspace(), null).name, 'Learner');
  const s = m.freshWorkspace();
  s.profile.name = 'Chosen';
  assert.equal(m.initialAnswers(s, 'Asha Devi').name, 'Chosen');
});
test('saving through the composed action equals doing it by hand with the three existing actions', () => {
  const a = answers(),
    start = m.freshWorkspace();
  const composed = m.applyCommand(start, m.completeCommand(a), NOW);
  let hand = start;
  for (const c of m.handCommands(a, start.profile.networking)) hand = m.applyCommand(hand, c, NOW);
  assert.deepEqual(composed, hand);
  assert.deepEqual(composed.profile, {
    name: 'Asha Devi',
    context: 'farmer',
    reading: true,
    networking: false,
    onboarding: 'completed',
  });
  assert.equal(composed.learningPlan.goal, 'records');
  assert.equal(composed.learningPlan.weeklyMinutes, 90);
  assert.deepEqual(
    { ...composed.learningAccess },
    { schemaVersion: 1, preferredLanguage: 'hi', readAloudMode: 'ask', assistancePreference: 'read-text' },
  );
  assert.deepEqual(composed.enrollments, []);
  assert.deepEqual(composed.learningPlan.tasks, []);
});
test('composed save is all or nothing and never touches enrollments, pins or networking choice', () => {
  const start = m.applyCommand(
    m.freshWorkspace(),
    { type: 'profile', name: 'Ravi', context: 'public', reading: false, networking: true },
    NOW,
  );
  const before = JSON.stringify(start);
  for (const bad of [
    { goal: 'nonsense' },
    { weeklyMinutes: 5 },
    { preferredLanguage: 'not a tag!!' },
    { readAloudMode: 'always' },
    { name: '  ' },
    { context: 'toString' },
  ])
    assert.throws(() => m.applyCommand(start, { ...m.completeCommand(answers()), ...bad }, NOW));
  assert.equal(JSON.stringify(start), before, 'input state is never mutated');
  const ok = m.applyCommand(start, m.completeCommand(answers()), NOW);
  assert.equal(ok.profile.networking, true, 'networking preference survives');
  assert.throws(
    () => m.applyCommand(start, { ...m.completeCommand(answers()), extra: 1 }, NOW),
    /unsupported/,
  );
  assert.throws(() => m.applyCommand(start, { type: 'onboarding', outcome: 'later' }, NOW));
  const prior = JSON.parse(before);
  prior.enrollments = [
    {
      id: 'e1',
      programId: 'p',
      version: 'v1',
      contentRef: { scope: 'global', programId: 'p', versionId: 'v1' },
      completed: [],
      withdrawn: false,
    },
  ];
  const after = m.applyCommand(prior, m.completeCommand(answers()), NOW);
  assert.deepEqual(after.enrollments, prior.enrollments);
});
test('reopening and finishing again overwrites choices and keeps the completed marker', () => {
  const s1 = m.applyCommand(m.freshWorkspace(), m.completeCommand(answers()), NOW),
    a = m.initialAnswers(s1);
  assert.equal(a.goal, 'records');
  assert.equal(a.preferredLanguage, 'hi');
  assert.equal(a.context, 'farmer');
  const s2 = m.applyCommand(s1, m.completeCommand({ ...a, goal: 'explore', preferredLanguage: 'en' }), NOW);
  assert.equal(s2.learningPlan.goal, 'explore');
  assert.equal(s2.learningAccess.preferredLanguage, 'en');
  assert.equal(s2.profile.onboarding, 'completed');
});
test('language honesty: only English and Hindi, Hindi labelled by what exists, selection never touches pins', () => {
  assert.deepEqual(
    m.languageOptions(['en']).map((l) => l.value),
    ['en', 'hi'],
  );
  const hi = (l) => l.find((x) => x.value === 'hi').note;
  assert.equal(hi(m.languageOptions(['en'])), m.HINDI_UNAVAILABLE_NOTICE);
  assert.match(hi(m.languageOptions(['en'])), /request only/);
  assert.equal(hi(m.languageOptions(['en', 'hi'])), 'Hindi draft available for one pathway');
  assert.ok(!m.languageOptions(['en', 'hi']).some((l) => !['en', 'hi'].includes(l.value)));
  assert.match(m.LANGUAGE_PIN_NOTE, /never changes the course version/);
  const start = m.freshWorkspace();
  start.enrollments = [
    {
      id: 'e',
      programId: 'p',
      version: 'v1',
      contentRef: { scope: 'global', programId: 'p', versionId: 'v1' },
      completed: ['l1'],
      withdrawn: false,
    },
  ];
  const after = m.applyCommand(start, m.completeCommand(answers({ preferredLanguage: 'hi' })), NOW);
  assert.deepEqual(after.enrollments, start.enrollments);
  assert.ok(m.answersProblem(answers({ preferredLanguage: 'ta' })));
});
test('contexts, goals and the change-anytime note match the product', () => {
  assert.deepEqual([...m.ONBOARDING_CONTEXTS].sort(), Object.keys(m.contexts).sort());
  assert.deepEqual(Object.keys(m.GOAL_LABELS).sort(), [...m.PLAN_GOALS].sort());
  assert.match(m.CHANGE_ANYTIME_NOTE, /change this anytime in Preferences/);
  assert.equal(m.answersProblem(answers()), null);
  assert.ok(m.answersProblem(answers({ weeklyMinutes: 45 })));
  assert.ok(m.answersProblem(answers({ name: '' })));
});
test('direct route states the exact scope of an account and that sign-in is external', () => {
  assert.equal(m.DIRECT_ACCOUNT.title, 'Account created: your Academy profile');
  assert.ok(m.DIRECT_ACCOUNT.scope.some((s) => /not a separate login/.test(s)));
  assert.match(m.DIRECT_ACCOUNT.external, /provided by the platform, not by the Academy/);
  assert.match(m.REGISTRATION_EXTERNAL_NOTE, /platform/);
});
test('invitation API responses map to plain states; unknown and wrong account read identically', () => {
  const c = m.classifyInvitationResponse;
  assert.equal(c(200, { invitation: { status: 'active' } }), 'ready');
  assert.equal(c(200, { invitation: { status: 'accepted' } }), 'already-joined');
  assert.equal(
    c(404, { error: 'This invitation is unavailable for your signed-in account.' }),
    'unavailable',
  );
  assert.equal(
    c(404, { error: 'This invitation is unavailable for your account.' }),
    'unavailable',
    'unknown token and foreign email share a state',
  );
  assert.equal(
    c(409, { error: 'This invitation expired or was revoked. Ask the workspace owner for a new link.' }),
    'closed',
  );
  assert.equal(c(409, { error: 'This invitation issuer no longer has workspace authority.' }), 'issuer-lost');
  assert.equal(c(403, { error: 'An invitation cannot restore removed access.' }), 'removed');
  assert.equal(c(400, { error: 'This invitation link is invalid.' }), 'invalid-link');
  assert.equal(c(503, {}), 'error');
  assert.equal(c(500, null), 'error');
});
test('every denied invitation state has plain copy that never names an email, owner or reason beyond the state', () => {
  for (const s of Object.keys(m.INVITE_COPY)) {
    const { title, body } = m.INVITE_COPY[s];
    assert.ok(title.length > 10 && body.length > 10);
    assert.ok(!/@/.test(title + body));
    assert.ok(!/token|hash|403|404|409/i.test(title + body));
  }
  for (const s of m.INVITE_DENIED_STATES) assert.ok(m.INVITE_COPY[s]);
  const u = m.INVITE_COPY.unavailable;
  assert.ok(
    !/does not exist|not found|belongs to|registered/i.test(u.title + u.body),
    'does not reveal who an email belongs to',
  );
  assert.match(m.INVITE_COPY.closed.body, /expired.*withdrawn.*already been used/);
});
test('invite summary explains workspace, role, cohort, assisted note and a workspace deep link', () => {
  const s = m.inviteSummary({
    workspaceName: 'Block Team',
    workspaceId: 'tw-abc def',
    roles: ['learner', 'assessor'],
    scopes: ['Customer-work circle'],
    assistedNote: '  Your coordinator will sit with you.  ',
    purpose: 'x',
  });
  assert.equal(s.workspace, 'Block Team');
  assert.deepEqual(s.roles, ['Learner', 'Assessor']);
  assert.equal(s.cohortLine, 'Cohorts: Customer-work circle');
  assert.equal(s.assistedNote, 'Your coordinator will sit with you.');
  assert.equal(s.deepLink, '/?workspace=tw-abc%20def#teams');
  assert.equal(s.abilities.length, 2);
  const bare = m.inviteSummary({ workspaceName: 'W', workspaceId: 'tw-1', roles: ['learner'], scopes: [] });
  assert.equal(bare.assistedNote, null);
  assert.match(bare.cohortLine, /does not enroll you/);
  assert.equal(m.inviteSummary(undefined).deepLink, null);
  assert.ok(
    m.STAFF_VISIBILITY.can.length >= 3 &&
      m.STAFF_VISIBILITY.cannot.some((x) => /personal practice lab/.test(x)),
  );
  assert.equal(m.JOIN_SUCCESS.open, 'Open my workspace');
});
