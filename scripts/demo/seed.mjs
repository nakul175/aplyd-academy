#!/usr/bin/env node
// Local demo seed for Aplyd Academy. Loopback only. Uses ONLY the public HTTP API
// (/api/teams and /api/academy) with synthetic identity headers, exactly like tests/*.mjs.
// Re-runnable: every run creates a fresh nonce, fresh identities and a fresh workspace.
//   DEMO_BASE_URL=http://127.0.0.1:8791 node scripts/demo/seed.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const base = (process.env.DEMO_BASE_URL ?? process.env.ACADEMY_LOCAL_URL ?? 'http://127.0.0.1:8787').replace(
  /\/$/,
  '',
);
const url = new URL(base);
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
  'The demo seed only operates on a local synthetic server (loopback hosts only).',
);
const curriculum = JSON.parse(readFileSync(resolve(root, 'lib/curriculum.json'), 'utf8'));
const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
const T = 'DEMO — synthetic';

// ---------- identities (all fictional) ----------
const ident = (key, label, role, slug, name) => ({
  key,
  label,
  role,
  id: `demo-${slug}-${nonce}`,
  email: `${slug}-${nonce}@academy.test`,
  name,
});
const people = {
  admin: ident('admin', 'Workspace admin', 'admin', 'admin-1', 'Demo Admin Meera (synthetic)'),
  'facilitator-1': ident(
    'facilitator-1',
    'Facilitator, farm circle',
    'facilitator',
    'facilitator-1',
    'Demo Facilitator Rohan (synthetic)',
  ),
  'facilitator-2': ident(
    'facilitator-2',
    'Facilitator, MSME circle',
    'facilitator',
    'facilitator-2',
    'Demo Facilitator Tara (synthetic)',
  ),
  'assessor-1': ident(
    'assessor-1',
    'Assessor, farm and MSME',
    'assessor',
    'assessor-1',
    'Demo Assessor Imran (synthetic)',
  ),
  'assessor-2': ident(
    'assessor-2',
    'Assessor, MSME and public servant',
    'assessor',
    'assessor-2',
    'Demo Assessor Lila (synthetic)',
  ),
  reviewer: ident(
    'reviewer',
    'Independent appeal reviewer',
    'reviewer',
    'reviewer-1',
    'Demo Reviewer Nikhil (synthetic)',
  ),
  moderator: ident(
    'moderator',
    'Community moderator',
    'moderator',
    'moderator-1',
    'Demo Moderator Sana (synthetic)',
  ),
  'personal-learner': ident(
    'personal-learner',
    'Personal-lab learner (own state)',
    'personal-learner',
    'personal-1',
    'Demo Personal Learner Kavya (synthetic)',
  ),
};
// 15 learners across the three cohorts. cohort index 0=farm, 1=MSME, 2=public servant.
const L = [
  ['learner-new', 'Learner, enrolled, not started', 0, 'Asha'],
  ['learner-progress', 'Learner, mid-lesson with a saved draft', 0, 'Bilal'],
  ['learner-withdrawn', 'Learner, withdrawn', 0, 'Chitra'],
  ['learner-lessons-done', 'Learner, all lessons done, not submitted', 0, 'Dev'],
  ['learner-submitted-farm', 'Learner, submitted, awaiting review (assigned)', 0, 'Esha'],
  ['learner-complete', 'Learner, assessed pass with record', 1, 'Farid'],
  ['learner-failed-gate', 'Learner, assessed fail on a critical gate', 1, 'Gita'],
  ['learner-appealed', 'Learner, assessed fail, appeal open', 1, 'Harish'],
  ['learner-appeal-resolved', 'Learner, appeal resolved by a different reviewer', 1, 'Indu'],
  ['learner-submitted-msme', 'Learner, submitted, awaiting assignment', 1, 'Jai'],
  ['learner-msme-progress', 'Learner, one lesson done', 1, 'Kiran'],
  ['learner-ps-new', 'Learner, enrolled, not started', 2, 'Lata'],
  ['learner-ps-progress', 'Learner, mid-lesson', 2, 'Manoj'],
  ['learner-ps-complete', 'Learner, assessed pass', 2, 'Nisha'],
  ['learner-ps-two-lessons', 'Learner, two lessons done', 2, 'Om'],
];
L.forEach(([key, label, cohort, first], i) => {
  people[key] = {
    ...ident(key, label, 'learner', `learner-${i + 1}`, `Demo Learner ${first} (synthetic)`),
    cohort,
  };
});
// Wave 4 additions (identity keys are only ever ADDED to the contract). cohort null = workspace member without a seat.
const NL = [
  ['learner-accommodation', 'Learner, accommodation request waiting for a decision', 1, 'Pooja'],
  ['learner-revoked', 'Learner, observed-task pass, credential revoked by the reviewer', 1, 'Qasim'],
  ['learner-suspended', 'Learner, oral pass, credential suspended after an adverse appeal', 2, 'Rina'],
  ['learner-recovery-new', 'New account with a pending recovery request (not approved)', null, 'Sunil'],
];
NL.forEach(([key, label, cohort, first], i) => {
  people[key] = {
    ...ident(key, label, 'learner', `learner-${L.length + i + 1}`, `Demo Learner ${first} (synthetic)`),
    cohort,
  };
});
people['assisted-invitee'] = ident(
  'assisted-invitee',
  'Invited with assistance, invitation not yet accepted',
  'learner',
  'assisted-1',
  'Demo Invitee Uma (synthetic)',
);

// ---------- HTTP ----------
const headers = (u) => ({
  'Content-Type': 'application/json',
  'oai-authenticated-user-id': u.id,
  'oai-authenticated-user-email': u.email,
  'oai-authenticated-user-full-name': encodeURIComponent(u.name),
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
});
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const get = async (u, path) => j(await fetch(base + path, { headers: headers(u) }));
const send = async (u, path, body) =>
  j(
    await fetch(base + path, {
      method: 'POST',
      headers: headers(u),
      body: JSON.stringify({ ...body, actionId: crypto.randomUUID() }),
    }),
  );
const ok = (x, what) => {
  assert.equal(x.status, 200, `${what}: ${JSON.stringify(x).slice(0, 400)}`);
  return x;
};
const cur = (u, id) => get(u, '/api/teams?id=' + encodeURIComponent(id));
let TEAM;
const act = async (u, command, what = command.type) => {
  const x = ok(await cur(u, TEAM), 'read before ' + what);
  return ok(await send(u, '/api/teams', { teamId: TEAM, command, revision: x.revision }), what);
};
const lab = async (u, command, what = command.type) => {
  const x = ok(await get(u, '/api/academy'), 'lab read');
  return ok(await send(u, '/api/academy', { command, revision: x.revision }), what);
};
const tok = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const log = (m) => console.log(m);

// ---------- builders ----------
const pathways = curriculum.pathways;
const rubric = (p) => p.practicalAssessment.rubric;
const gateCount = (p) => rubric(p).filter((r) => r.criticalGate).length;
const notes = (p) =>
  rubric(p).map(
    (r, i) => `Evidence reference ${i + 1}: the submitted fictional packet addresses ${r.dimension}.`,
  );
const feedbackPass =
  'Careful fictional evidence shows verified reasoning, privacy care and appropriate human approval throughout.';
const feedbackFail =
  'The checked sources do not yet support the claim; re-trace each statement to the packet and show the human approval step.';
const grade = (p, enrollment, attempt, learner, scores, gateAll, feedback) => ({
  type: 'assess',
  learnerId: learner.id,
  enrollmentId: enrollment.id,
  attemptId: attempt.id,
  scores,
  gates: Array(gateCount(p))
    .fill(true)
    .map((g, i) => (gateAll === false && i === 0 ? false : g)),
  notes: notes(p),
  feedback,
});

async function doLessons(u, p, enrollmentId, n) {
  for (const l of p.lessons.slice(0, n))
    await act(
      u,
      {
        type: 'lesson',
        enrollmentId,
        lessonId: l.id,
        practice:
          'Fictional practice response that cites the supplied packet and keeps a human decision in the loop.',
        answers: l.quiz.map((q) => q.correctOptionIndex),
      },
      'lesson',
    );
}
const mine = async (u, p) => (await cur(u, TEAM)).state.enrollments.find((e) => e.programId === p.id);
async function submit(u, p) {
  const e = await mine(u, p);
  const fields = Object.fromEntries(
    p.practicalAssessment.submissionPrompts.map((f) => [
      f.id,
      'SUBMITTED-SYNTHETIC: verified sources, checked claims and human approval in this fictional task.',
    ]),
  );
  await act(u, { type: 'submit', enrollmentId: e.id, fields, confirmed: true });
  return (await mine(u, p)).attempts.at(-1);
}

// ---------- run ----------
const A = people.admin,
  summary = { counts: {} };
log(`Seeding ${base} (nonce ${nonce})`);

// workspace + cohorts
let x = ok(
  await send(A, '/api/teams', {
    command: {
      type: 'create',
      name: `${T} Aplyd pilot ${nonce}`,
      purpose:
        'A fictional shared workspace for local demonstrations. Every person, record and message here is synthetic.',
      context: 'msme',
    },
    revision: 0,
  }),
  'create workspace',
);
TEAM = x.team.id;
const capacities = [5, 10, 12],
  cohortTitles = ['Farm records circle', 'MSME customer practice circle', 'Public servant briefs circle'];
const cohorts = [];
for (let i = 0; i < 3; i++) {
  x = await act(A, {
    type: 'cohort-create',
    title: `${T} ${cohortTitles[i]}`,
    programId: pathways[i].id,
    capacity: capacities[i],
  });
  cohorts.push(x.team.cohorts.at(-1).id);
}
const [C1, C2, C3] = cohorts;

// invitations + acceptance
async function join(u, roles, scopes) {
  const token = tok();
  await act(A, { type: 'invite', email: u.email, roles, scopes, token }, 'invite');
  const preview = ok(await get(u, '/api/teams?invite=' + token), 'preview invite');
  ok(
    await send(u, '/api/teams', {
      teamId: TEAM,
      command: { type: 'accept', token },
      revision: preview.revision,
    }),
    'accept invite',
  );
}
const staff = [
  ['facilitator-1', ['facilitator'], [C1]],
  ['facilitator-2', ['facilitator'], [C2]],
  ['assessor-1', ['assessor'], [C1, C2]],
  ['assessor-2', ['assessor'], [C2, C3]],
  ['reviewer', ['reviewer'], [C1, C2, C3]],
  ['moderator', ['moderator'], [C1, C2, C3]],
];
for (const [k, r, s] of staff) await join(people[k], r, s);
for (const [k] of L) await join(people[k], ['learner'], []);
log(`Invited and accepted ${staff.length} staff and ${L.length} learners.`);

// enrol
for (const [k, , c] of L)
  await act(people[k], { type: 'enroll', programId: pathways[c].id, cohortId: cohorts[c] }, 'enroll ' + k);

// session A (starts shortly; attendance recorded after the start) and session B (two days out)
const startA = Date.now() + 45000;
x = await act(people['facilitator-1'], {
  type: 'session-create',
  cohortId: C1,
  title: `${T} farm records clinic`,
  description: 'A fictional practice clinic on checking AI drafts against a supplied farm records packet.',
  instructions: 'DEMO joining note: fictional classroom, no real meeting link.',
  startsAt: new Date(startA).toISOString(),
  endsAt: new Date(startA + 3600000).toISOString(),
  capacity: 4,
});
const sessA = x.team.network.sessions.at(-1).id;
const startB = Date.now() + 2 * 86400000;
x = await act(people['facilitator-2'], {
  type: 'session-create',
  cohortId: C2,
  title: `${T} MSME customer reply workshop`,
  description: 'A fictional workshop on drafting and checking customer replies with human approval.',
  instructions: 'DEMO joining note: fictional workshop, no real meeting link.',
  startsAt: new Date(startB).toISOString(),
  endsAt: new Date(startB + 3600000).toISOString(),
  capacity: 8,
});
const sessB = x.team.network.sessions.find((s) => s.title.includes('MSME customer reply')).id;
for (const k of ['learner-progress', 'learner-lessons-done', 'learner-submitted-farm'])
  await act(people[k], { type: 'session-rsvp', sessionId: sessA, going: true }, 'rsvp A');
for (const k of ['learner-complete', 'learner-failed-gate', 'learner-appealed', 'learner-msme-progress'])
  await act(people[k], { type: 'session-rsvp', sessionId: sessB, going: true }, 'rsvp B');

// learning progress
const P0 = pathways[0],
  P1 = pathways[1],
  P2 = pathways[2];
let e = await mine(people['learner-progress'], P0);
await doLessons(people['learner-progress'], P0, e.id, 1);
await act(
  people['learner-progress'],
  {
    type: 'draft',
    enrollmentId: e.id,
    fields: { task: 'DEMO draft: checking a fictional rainfall note against the supplied packet.' },
  },
  'draft',
);
e = await mine(people['learner-withdrawn'], P0);
await act(people['learner-withdrawn'], { type: 'withdraw', enrollmentId: e.id });
for (const [k, p, n] of [
  ['learner-lessons-done', P0, 3],
  ['learner-submitted-farm', P0, 3],
  ['learner-msme-progress', P1, 1],
  ['learner-ps-progress', P2, 1],
  ['learner-ps-two-lessons', P2, 2],
  ['learner-complete', P1, 3],
  ['learner-failed-gate', P1, 3],
  ['learner-appealed', P1, 3],
  ['learner-appeal-resolved', P1, 3],
  ['learner-submitted-msme', P1, 3],
  ['learner-ps-complete', P2, 3],
]) {
  const en = await mine(people[k], p);
  await doLessons(people[k], p, en.id, n);
}
e = await mine(people['learner-ps-progress'], P2);
await act(
  people['learner-ps-progress'],
  {
    type: 'draft',
    enrollmentId: e.id,
    fields: { task: 'DEMO draft: outlining a fictional administrative brief.' },
  },
  'draft',
);

// submissions + assessment
const sub = {};
for (const [k, p] of [
  ['learner-submitted-farm', P0],
  ['learner-submitted-msme', P1],
  ['learner-complete', P1],
  ['learner-failed-gate', P1],
  ['learner-appealed', P1],
  ['learner-appeal-resolved', P1],
  ['learner-ps-complete', P2],
])
  sub[k] = await submit(people[k], p);
const assign = (kind, targetId, who) =>
  act(A, { type: 'assign', kind, targetId, staffId: people[who].id }, 'assign');
async function assess(k, p, who, scores, gateAll, feedback) {
  await assign('assessment', sub[k].id, who);
  const en = await mine(people[k], p);
  await act(people[who], grade(p, en, sub[k], people[k], scores, gateAll, feedback), 'assess ' + k);
}
await assign('assessment', sub['learner-submitted-farm'].id, 'assessor-1'); // awaiting review, assigned
await assess('learner-complete', P1, 'assessor-1', [4, 4, 3, 4], true, feedbackPass);
await assess('learner-failed-gate', P1, 'assessor-2', [3, 3, 3, 3], false, feedbackFail);
await assess('learner-appealed', P1, 'assessor-1', [2, 2, 2, 2], true, feedbackFail);
await assess('learner-appeal-resolved', P1, 'assessor-1', [2, 2, 2, 2], true, feedbackFail);
await assess('learner-ps-complete', P2, 'assessor-2', [4, 3, 4, 4], true, feedbackPass);
// appeals
for (const k of ['learner-appealed', 'learner-appeal-resolved']) {
  const en = await mine(people[k], P1);
  await act(
    people[k],
    {
      type: 'appeal',
      enrollmentId: en.id,
      attemptId: sub[k].id,
      reason:
        'Please inspect the claimed verification gate independently against the preserved fictional evidence.',
    },
    'appeal',
  );
}
{
  const en = await mine(people['learner-appeal-resolved'], P1),
    ap = en.appeals[0];
  await assign('appeal', ap.id, 'reviewer');
  await act(
    people.reviewer,
    {
      type: 'resolve',
      learnerId: people['learner-appeal-resolved'].id,
      enrollmentId: en.id,
      appealId: ap.id,
      scores: [4, 3, 4, 3],
      gates: Array(gateCount(P1)).fill(true),
      notes: notes(P1),
      feedback:
        'Independent review: the preserved evidence does support the verification gate; the original decision is replaced.',
    },
    'resolve',
  );
  const en2 = await mine(people['learner-appealed'], P1);
  await assign('appeal', en2.appeals[0].id, 'reviewer'); // open appeal, assigned and waiting
}

// community
const post = async (k, cohortId, title, body) => {
  const r = await act(people[k], { type: 'post', cohortId, title, body }, 'post');
  return r.state.posts.find((p) => p.title === title).id;
};
const publish = (postId, replyId, reason = 'A relevant fictional discussion without private information.') =>
  act(
    people.moderator,
    { type: 'moderate', postId, ...(replyId ? { replyId } : {}), status: 'visible', reason },
    'moderate',
  );
const p1 = await post(
  'learner-complete',
  C2,
  'How do I check a drafted customer reply?',
  'I compare each sentence with the supplied fictional order packet before a human approves it.',
);
await publish(p1);
const r1 = (
  await act(
    people['learner-appealed'],
    { type: 'reply', postId: p1, body: 'Same here; I also keep a short list of claims that need a source.' },
    'reply',
  )
).state.posts
  .find((p) => p.id === p1)
  .replies.at(-1).id;
await publish(p1, r1, 'A helpful bounded reply for this fictional practice task.');
const p2 = await post(
  'learner-failed-gate',
  C2,
  'Is a confident AI answer good enough?',
  'I think a confident draft is fine to send without a second check on a fictional customer order.',
);
await publish(p2);
await act(
  people['learner-msme-progress'],
  {
    type: 'report',
    postId: p2,
    reason: 'Please recheck the claim that no second check is needed before the post stays visible.',
  },
  'report',
); // left open: the reported post
const p3 = await post(
  'learner-appeal-resolved',
  C2,
  'Posting my private notes here',
  'Here are some notes that really belong in my private workspace and not in a shared circle.',
);
await act(
  people.moderator,
  {
    type: 'moderate',
    postId: p3,
    status: 'hidden',
    reason: 'This belongs in a private workspace, not the shared circle.',
  },
  'moderate hide',
);
const p4 = await post(
  'learner-progress',
  C1,
  'Which record helps most on a small farm?',
  'I am starting with a simple fictional rainfall and input log and asking AI to help me notice gaps.',
);
await publish(p4);
const p5 = await post(
  'learner-ps-complete',
  C3,
  'Structuring a short administrative brief',
  'I put the decision first, then the three supporting sources from the fictional file note.',
);
await publish(p5);

// network profiles (opt-in)
for (const [k, c, bio, focus] of [
  [
    'learner-complete',
    C2,
    'I practise checking fictional customer replies before a human approves them.',
    'Customer operations',
  ],
  [
    'learner-progress',
    C1,
    'I am learning to keep simple fictional farm records and question AI drafts.',
    'Work records',
  ],
  [
    'learner-ps-complete',
    C3,
    'I draft fictional administrative briefs with sources checked line by line.',
    'Source-based briefs',
  ],
])
  await act(
    people[k],
    { type: 'network-profile', enabled: true, bio, focus, cohortIds: [c] },
    'network-profile',
  );

// support request
await act(
  people['learner-failed-gate'],
  {
    type: 'support-open',
    category: 'learning',
    cohortId: C2,
    subject: 'DEMO question about my critical gate feedback',
    body: 'Fictional question: which part of the packet should I re-trace before retrying the practical task?',
    audienceAcknowledged: true,
  },
  'support',
);

// personal lab learner
const PL = people['personal-learner'];
await lab(PL, { type: 'profile', name: PL.name, context: 'msme', reading: false, networking: false }).catch(
  () => null,
);
let le = ok(await get(PL, '/api/academy'), 'lab read');
le = await lab(PL, { type: 'enroll', programId: P1.id });
const lenr = le.state.enrollments[0];
for (const l of P1.lessons)
  await lab(
    PL,
    {
      type: 'lesson',
      enrollmentId: lenr.id,
      lessonId: l.id,
      practice: 'Fictional personal practice response citing the supplied packet and a human check.',
      answers: l.quiz.map((q) => q.correctOptionIndex),
    },
    'lab lesson',
  );
const lfields = Object.fromEntries(
  P1.practicalAssessment.submissionPrompts.map((f) => [
    f.id,
    'SUBMITTED-SYNTHETIC: personal-lab fictional task with verified sources and human approval.',
  ]),
);
le = await lab(PL, { type: 'submit', enrollmentId: lenr.id, fields: lfields, confirmed: true });
const latt = le.state.enrollments[0].attempts.at(-1);
await lab(
  PL,
  {
    type: 'assess',
    actor: 'assessor-a',
    enrollmentId: lenr.id,
    attemptId: latt.id,
    scores: [4, 4, 4, 4],
    gates: Array(gateCount(P1)).fill(true),
    notes: notes(P1),
    feedback: feedbackPass,
  },
  'lab assess',
);
await lab(
  PL,
  {
    type: 'followup',
    enrollmentId: lenr.id,
    reflection:
      'In my fictional shop I now check each drafted reply against the order note before sending it.',
    before: 20,
    after: 8,
  },
  'followup',
).catch((err) => log('  (personal followup skipped: ' + err.message.slice(0, 120) + ')'));
const ymd = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
await lab(
  PL,
  {
    type: 'learning-plan',
    goal: 'clear-response',
    personalGoal: 'Keep a weekly rhythm of checking AI drafts in my fictional shop.',
    weeklyMinutes: 90,
    timeZone: 'Asia/Kolkata',
    remindersEnabled: true,
  },
  'plan prefs',
);
const planTasks = [
  ['Review two drafted customer replies', 1, 20],
  ['Update my source checklist', 3, 30],
  ['Weekly reflection on what AI got wrong', 5, 25],
];
let plan;
for (const [title, d, mins] of planTasks)
  plan = await lab(
    PL,
    {
      type: 'plan-task',
      kind: 'practice',
      title,
      dueDate: ymd(d),
      plannedMinutes: mins,
      note: 'Synthetic weekly plan item.',
    },
    'plan task',
  );
await lab(
  PL,
  { type: 'plan-task-status', taskId: plan.state.learningPlan.tasks[0].id, status: 'done' },
  'plan done',
);

// ---------- identities file ----------
const order = [
  'admin',
  'facilitator-1',
  'facilitator-2',
  'assessor-1',
  'assessor-2',
  'reviewer',
  'moderator',
  ...L.map((l) => l[0]),
  'personal-learner',
];
const orderAll = [...order, ...NL.map((l) => l[0]), 'assisted-invitee'];
const writeIdentities = (keys) =>
  writeFileSync(
    resolve(here, 'demo-identities.json'),
    JSON.stringify(
      {
        baseUrl: base,
        teamId: TEAM,
        identities: keys.map((k) => {
          const p = people[k];
          return { key: p.key, label: p.label, role: p.role, id: p.id, email: p.email, name: p.name };
        }),
      },
      null,
      2,
    ) + '\n',
  );
writeIdentities(order); // the original contract first; the wave 4 keys are appended at the end of the run
const identities = order.map((k) => people[k]);

// ---------- verification ----------
let checks = 0;
const failures = [];
const check = (name, cond) => {
  checks++;
  if (!cond) failures.push(name);
  log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`);
};
const view = async (k) => cur(people[k], TEAM);
log('\nVerification (GET as each identity)');
const av = await view('admin');
check('admin read 200 with admin role', av.status === 200 && av.team.roles.includes('admin'));
const byId = Object.fromEntries(av.team.cohorts.map((c) => [c.id, c]));
check(
  'admin sees 3 cohorts, all titled DEMO — synthetic',
  av.team.cohorts.length === 3 && av.team.cohorts.every((c) => c.title.startsWith(T)),
);
check('farm cohort nearly full (4 of 5)', byId[C1].occupied === 4 && byId[C1].capacity === 5);
check('MSME cohort 6 of 10 and PS cohort 4 of 12', byId[C2].occupied === 6 && byId[C3].occupied === 4);
check('admin sees 15 learner summaries minus withdrawn', av.team.summaries.length >= 14);
check('admin sees pending reviews (2 assessments + 1 appeal)', av.team.pending.length === 3);
check(
  'admin member roster includes 6 staff and 15 learners plus owner',
  (av.team.members?.length ?? 22) >= 22,
);
const nv = await view('learner-new');
check(
  'learner-new sees only own enrollment (0 lessons done)',
  nv.state.enrollments.length === 1 && nv.state.enrollments[0].completed.length === 0,
);
check(
  'learner-new has no staff queue or support queue',
  !nv.team.pending?.length && !nv.team.support?.queue?.length && !nv.team.summaries?.length,
);
const pv = await view('learner-progress');
check(
  'learner-progress has 1 lesson done and a saved draft',
  pv.state.enrollments[0].completed.length === 1 && !!pv.state.enrollments[0].draft.task,
);
const cv = await view('learner-complete');
check(
  'learner-complete holds an active record',
  cv.state.enrollments[0].record?.status === 'active' &&
    cv.state.enrollments[0].attempts[0].decision.passed === true,
);
const apv = await view('learner-appealed');
check(
  'learner-appealed failed with an open appeal',
  apv.state.enrollments[0].attempts[0].decision.passed === false &&
    apv.state.enrollments[0].appeals[0].status === 'open',
);
const rv = await view('learner-appeal-resolved');
const rap = rv.state.enrollments[0].appeals[0];
check(
  'appeal resolved by a reviewer different from the original assessor',
  rap.status === 'resolved' &&
    rap.resolution.actor === people.reviewer.id &&
    rap.resolution.actor !== rv.state.enrollments[0].attempts[0].decision.actor,
);
const gv = await view('learner-failed-gate');
check(
  'critical-gate failure carries feedback',
  gv.state.enrollments[0].attempts[0].decision.passed === false &&
    gv.state.enrollments[0].attempts[0].decision.feedback.length >= 30,
);
const wv = await view('learner-withdrawn');
check('withdrawn learner enrollment is flagged', wv.state.enrollments[0].withdrawn === true);
check(
  'learner never sees another learner submission',
  !JSON.stringify(nv).includes(people['learner-complete'].id) &&
    !JSON.stringify(nv).includes('SUBMITTED-SYNTHETIC'),
);
const f1 = await view('facilitator-1'),
  f2 = await view('facilitator-2');
check(
  'facilitator-1 summaries only cover the farm cohort',
  f1.team.summaries.length > 0 && f1.team.summaries.every((s) => s.cohortId === C1),
);
check(
  'facilitator-2 summaries only cover the MSME cohort',
  f2.team.summaries.length > 0 && f2.team.summaries.every((s) => s.cohortId === C2),
);
const a1 = await view('assessor-1'),
  a2 = await view('assessor-2');
check('assessor-1 has the farm submission assigned', a1.team.assigned.length === 1);
check('assessor-2 has nothing pending', a2.team.assigned.length === 0);
const rvw = await view('reviewer');
check('reviewer has the open appeal assigned', rvw.team.assigned.length === 1);
const mv = await view('moderator');
check(
  'moderator sees posts and a moderation history',
  mv.state.posts.length >= 4 && mv.team.moderationHistory.length >= 3,
);
check(
  'community has an open report and a hidden post',
  mv.state.reports.some((r) => r.status === 'open') && mv.state.posts.some((p) => p.status === 'hidden'),
);
check(
  'learner view hides the moderated post',
  !(await view('learner-new')).state.posts.some((p) => p.status === 'hidden'),
);
check(
  'support request is in the staff queue, body private',
  (await view('facilitator-2')).team.support.queue.length === 1 &&
    !JSON.stringify(av).includes('Fictional question: which part'),
);
const dir = (await view('learner-failed-gate')).team.network.directory;
check(
  'same-cohort peer sees the opt-in card without email or ids',
  dir.length === 1 &&
    dir[0].name === people['learner-complete'].name &&
    ['email', 'userId'].every((k) => !(k in dir[0])),
);
check(
  'opt-in cards stay cohort-scoped (farm peer sees none of the MSME card)',
  !(await view('learner-new')).team.network.directory.some((d) => d.name === people['learner-complete'].name),
);
const lp = ok(await get(PL, '/api/academy'), 'personal read');
check(
  'personal learner has completed pathway record and weekly plan',
  lp.state.enrollments[0].record?.status === 'active' &&
    lp.state.learningPlan.tasks.length === 3 &&
    lp.state.learningPlan.tasks.some((t) => t.status === 'done'),
);
check('personal state invisible in the workspace', (await get(PL, '/api/teams')).workspaces?.length === 0);
check(
  'outsider cannot open the workspace',
  (
    await cur(
      {
        id: 'demo-outsider-' + nonce,
        email: `outsider-${nonce}@academy.test`,
        name: 'Demo Outsider (synthetic)',
      },
      TEAM,
    )
  ).status === 404,
);

// attendance (after the session start, as the host)
const wait = startA + 1500 - Date.now();
if (wait > 0) {
  log(`\nWaiting ${Math.ceil(wait / 1000)}s for the server clock to pass session A's start...`);
  await new Promise((r) => setTimeout(r, wait));
}
let hv = await view('facilitator-1'),
  sa = hv.team.network.sessions.find((s) => s.id === sessA);
const marks = [
  ['learner-progress', 'attended'],
  ['learner-lessons-done', 'attended'],
  ['learner-submitted-farm', 'absent'],
];
for (const [k, status] of marks) {
  hv = await view('facilitator-1');
  sa = hv.team.network.sessions.find((s) => s.id === sessA);
  const reg = sa.registrations.find((r) => r.name === people[k].name);
  await act(
    people['facilitator-1'],
    {
      type: 'session-attendance',
      sessionId: sessA,
      registrationId: reg.id,
      status,
      reason: 'DEMO attendance basis: fictional synthetic roll call.',
    },
    'attendance',
  );
}
hv = await view('facilitator-1');
sa = hv.team.network.sessions.find((s) => s.id === sessA);
check(
  'session A: 3 RSVPs and 3 attendance marks (2 attended, 1 absent)',
  sa.occupied === 3 &&
    sa.attendanceHistory.length === 3 &&
    sa.attendanceHistory.filter((a) => a.status === 'attended').length === 2,
);
const sb = (await view('facilitator-2')).team.network.sessions.find((s) => s.id === sessB);
check('session B: 4 RSVPs, scheduled two days out', sb.occupied === 4 && sb.status === 'scheduled');
check(
  'learner sees own attendance only',
  (await view('learner-progress')).team.network.sessions.find((s) => s.id === sessA).myAttendance?.status ===
    'attended',
);

// =====================================================================================
// WAVE 4: data for the twelve newer features. Everything below runs AFTER the original 33
// assertions, so those still check the original scenario exactly. All fictional, loopback only.
// =====================================================================================
log(
  '\nWave 4 seed: recovery, data requests, escalations, accommodations, methods, credentials, reports, partner',
);
const stage = {}; // ids for the summary and the overview
const w4 = []; // assertion names added in wave 4
const check4 = (name, cond) => {
  w4.push(name);
  check(name, cond);
};

// ---- new members (invite + accept) and enrolments: two MSME, one public servant, one seatless ----
await join(people['learner-accommodation'], ['learner'], []);
await join(people['learner-revoked'], ['learner'], []);
await join(people['learner-suspended'], ['learner'], []);
await join(people['learner-recovery-new'], ['learner'], []);
await act(
  people['learner-accommodation'],
  { type: 'enroll', programId: P1.id, cohortId: C2 },
  'enroll accommodation',
);
await act(people['learner-revoked'], { type: 'enroll', programId: P1.id, cohortId: C2 }, 'enroll revoked');
await act(
  people['learner-suspended'],
  { type: 'enroll', programId: P2.id, cohortId: C3 },
  'enroll suspended',
);
{
  const en = await mine(people['learner-accommodation'], P1);
  await doLessons(people['learner-accommodation'], P1, en.id, 2);
}
for (const [k, p] of [
  ['learner-revoked', P1],
  ['learner-suspended', P2],
]) {
  const en = await mine(people[k], p);
  await doLessons(people[k], p, en.id, 3);
}

// ---- BR-24 accommodations: one pending (MSME cohort), one approved and shown to the assigned assessor ----
{
  const en = await mine(people['learner-accommodation'], P1);
  await act(
    people['learner-accommodation'],
    {
      type: 'accommodation-request',
      enrollmentId: en.id,
      accommodationType: 'assistive-technology',
      detail: 'DEMO: I use a screen reader and would like the practical packet as plain text.',
    },
    'accommodation request',
  );
  const es = await mine(people['learner-submitted-farm'], P0);
  await act(
    people['learner-submitted-farm'],
    {
      type: 'accommodation-request',
      enrollmentId: es.id,
      accommodationType: 'alternative-format',
      detail: 'DEMO: please give the packet in large print.',
    },
    'accommodation request',
  );
  const reqId = (await mine(people['learner-submitted-farm'], P0)).accommodations[0].id;
  await act(
    people['facilitator-1'],
    {
      type: 'accommodation-decide',
      enrollmentId: es.id,
      learnerId: people['learner-submitted-farm'].id,
      requestId: reqId,
      outcome: 'approved',
      reason: 'DEMO decision: large print changes how the packet is read, not what is assessed.',
    },
    'accommodation approve',
  );
}

// ---- BR-27 assessment methods + BR-24 accommodation stamped on a decision + BR-29/30 credentials ----
{
  // learner-revoked: accommodation approved BEFORE the review, then an observed-task pass, then revoked by the reviewer
  const k = 'learner-revoked',
    en0 = await mine(people[k], P1);
  await act(
    people[k],
    {
      type: 'accommodation-request',
      enrollmentId: en0.id,
      accommodationType: 'extra-time',
      detail: 'DEMO: I need more time to write up the practical.',
    },
    'accommodation request',
  );
  const rq = (await mine(people[k], P1)).accommodations[0].id;
  await act(
    people['facilitator-2'],
    {
      type: 'accommodation-decide',
      enrollmentId: en0.id,
      learnerId: people[k].id,
      requestId: rq,
      outcome: 'approved',
      reason: 'DEMO decision: extra time is allowed; the rubric and pass mark are unchanged.',
    },
    'accommodation approve',
  );
  sub[k] = await submit(people[k], P1);
  await assign('assessment', sub[k].id, 'assessor-2');
  await act(
    people['assessor-2'],
    { ...grade(P1, en0, sub[k], people[k], [4, 3, 4, 3], true, feedbackPass), method: 'observed' },
    'assess observed',
  );
  const en = await mine(people[k], P1);
  await act(people[k], { type: 'share', enrollmentId: en.id, enabled: true }, 'share on');
  await act(
    people.reviewer,
    {
      type: 'credential-lifecycle',
      enrollmentId: en.id,
      learnerId: people[k].id,
      action: 'revoke',
      reason: 'DEMO reason: the observation note was later found to describe a different task.',
    },
    'revoke',
  );

  // learner-suspended: oral-method pass, learner appeals the pass, independent reviewer resolves it adversely -> suspended
  const k2 = 'learner-suspended',
    en2 = await mine(people[k2], P2);
  sub[k2] = await submit(people[k2], P2);
  await assign('assessment', sub[k2].id, 'assessor-2');
  await act(
    people['assessor-2'],
    { ...grade(P2, en2, sub[k2], people[k2], [4, 4, 3, 4], true, feedbackPass), method: 'oral' },
    'assess oral',
  );
  await act(
    people[k2],
    {
      type: 'appeal',
      enrollmentId: en2.id,
      attemptId: sub[k2].id,
      reason:
        'DEMO: please re-check whether the oral explanation covered the verification gate before this record stands.',
    },
    'appeal',
  );
  const ap = (await mine(people[k2], P2)).appeals[0];
  await assign('appeal', ap.id, 'reviewer');
  await act(
    people.reviewer,
    {
      type: 'resolve',
      learnerId: people[k2].id,
      enrollmentId: en2.id,
      appealId: ap.id,
      scores: [2, 2, 2, 2],
      gates: Array(gateCount(P2)).fill(true),
      notes: notes(P2),
      feedback:
        'Independent review: the recorded explanation does not support the verification gate; the earlier pass is overturned.',
    },
    'resolve adverse',
  );
}
// learner-complete shares their active credential; learner-ps-complete keeps theirs private (share stays off)
{
  const en = await mine(people['learner-complete'], P1);
  await act(people['learner-complete'], { type: 'share', enrollmentId: en.id, enabled: true }, 'share on');
}

// ---- BR-33 escalations (+ the community posts they need) ----
{
  let mod = await view('moderator');
  const openReport = mod.state.reports.find(
    (r) => r.status === 'open' && r.reason.includes('Please recheck the claim'),
  );
  await act(
    people.moderator,
    {
      type: 'escalate-report',
      reportId: openReport.id,
      severity: 'high',
      reason: 'DEMO escalation: a confident-answer claim may mislead other learners; an owner should decide.',
    },
    'escalate high',
  );
  const p6 = await post(
    'learner-appeal-resolved',
    C2,
    'Skip the human approval step to save time?',
    'I think we can send AI customer replies straight away on this fictional shop and fix mistakes afterwards.',
  );
  await publish(p6);
  await act(
    people['learner-submitted-msme'],
    {
      type: 'report',
      postId: p6,
      reason: 'This advice tells people to skip the human approval step that the pathway requires.',
    },
    'report',
  );
  mod = await view('moderator');
  const rep2 = mod.state.reports.find((r) => r.postId === p6 && r.status === 'open');
  await act(
    people.moderator,
    {
      type: 'escalate-report',
      reportId: rep2.id,
      severity: 'medium',
      reason: 'DEMO escalation: repeats advice the pathway rejects; asking an owner to decide on visibility.',
    },
    'escalate medium',
  );
  const esc2 = (await view('admin')).team.escalations.items.find((e) => e.severity === 'medium');
  await act(
    A,
    {
      type: 'escalation-resolve',
      escalationId: esc2.id,
      decision: 'resolve',
      hidePost: true,
      expectedHistory: esc2.historyLength,
      reason:
        'DEMO decision: the post is hidden; a reminder about human approval was added to the cohort notes.',
    },
    'resolve escalation',
  );
}

// ---- BR-44 data requests: received, verified, verification-failed, completed, held (erasure) ----
{
  const open = (k, kind, detail) =>
    act(people[k], { type: 'data-request-open', kind, detail }, 'data request ' + kind);
  const queue = async () => (await view('admin')).team.dataRequests.queue;
  const mineReq = async (k) => (await queue()).find((r) => r.requesterId === people[k].id);
  const verify = async (k, passed, note) => {
    const r = await mineReq(k);
    await act(A, { type: 'data-request-verify', requestId: r.id, requestRev: r.rev, passed, note }, 'verify');
  };
  const decide = async (k, outcome, reason) => {
    const r = await mineReq(k);
    await act(
      A,
      { type: 'data-request-decide', requestId: r.id, requestRev: r.rev, outcome, reason },
      'decide',
    );
  };
  await open('learner-new', 'export', 'DEMO: I would like a copy of my learning record.'); // received
  await open('learner-progress', 'export', 'DEMO: copy of my saved work, please.');
  await verify('learner-progress', ['account-email', 'roster-details'], 'DEMO: synthetic checks passed.'); // verified
  await open('learner-ps-progress', 'export', 'DEMO: export please.');
  await verify(
    'learner-ps-progress',
    ['account-email'],
    'DEMO: only one synthetic check could be confirmed.',
  ); // verification-failed
  await open('learner-ps-complete', 'export', 'DEMO: export of my records for my own file.');
  await verify(
    'learner-ps-complete',
    ['account-email', 'roster-details', 'recent-activity'],
    'DEMO: all three checks passed.',
  );
  await decide(
    'learner-ps-complete',
    'approve',
    'DEMO decision: the export contains only this learner’s own records.',
  ); // completed
  await open('learner-withdrawn', 'erasure', 'DEMO: I left the cohort and want my records erased.');
  await verify('learner-withdrawn', ['account-email', 'recent-activity'], 'DEMO: synthetic checks passed.');
  await decide(
    'learner-withdrawn',
    'approve',
    'DEMO decision: recorded and held, nothing is deleted while retention policy is pending.',
  ); // held
}

// ---- BR-04 recovery: one PENDING request (left undecided so approval can be shown live) + one assisted invitation ----
{
  const old = people['learner-ps-new'];
  await act(
    people['learner-recovery-new'],
    {
      type: 'recovery-request',
      claimedEmail: old.email,
      cohortHint: 'Public servant briefs circle',
      activityHint: 'Started the first lesson',
      note: 'DEMO: I changed my sign-in and need my earlier place back.',
    },
    'recovery request',
  );
  await act(
    A,
    {
      type: 'invite',
      email: people['assisted-invitee'].email,
      roles: ['learner'],
      scopes: [C2],
      token: tok(),
      assistedNote:
        "DEMO: set up on the learner's behalf after a phone call; she has no email access of her own.",
    },
    'assisted invite',
  );
}

// ---- BR-42/43 dummy partner: link + consent scopes on the personal-lab learner, only when a partner URL is provided ----
const partnerUrl = (process.env.DEMO_PARTNER_URL ?? '').replace(/\/$/, '');
let partner = {
  seeded: false,
  note: 'DEMO_PARTNER_URL is not set: partner link skipped. Start scripts/demo/dummy-partner.mjs and give the worker ACADEMY_DUMMY_PARTNER_URL (see README-seed.md).',
};
if (partnerUrl) {
  try {
    assert.ok(
      ['127.0.0.1', '[::1]'].includes(new URL(partnerUrl).hostname),
      'DEMO_PARTNER_URL must be loopback',
    );
    const h = await fetch(partnerUrl + '/health')
      .then((r) => r.json())
      .catch(() => null);
    if (!h?.ok) throw new Error('the dummy partner did not answer /health');
    const PLe = (await get(PL, '/api/academy')).state.enrollments[0];
    const pcall = async (path, body) => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: headers(PL),
        body: JSON.stringify(body),
      });
      const j2 = await r.json().catch(() => ({}));
      assert.equal(r.status, 200, `${path}: ${JSON.stringify(j2).slice(0, 300)}`);
      return j2;
    };
    const linked = await pcall('/api/partner/links', {
      type: 'link',
      memberCode: 'DEMO-AAA001',
      enrollmentId: PLe.id,
    });
    const linkId = linked.links.at(-1).id;
    await pcall('/api/partner/links', { type: 'grant', linkId, scope: 'progress', days: 30 });
    // 'completion' is deliberately NOT granted: for a learner who has completed, the app builds a completion payload that its own validator
    // rejects ("Completion is invalid"), so no delivery could ever succeed. See README-seed.md, known app defects.
    await pcall('/api/partner/links', { type: 'grant', linkId, scope: 'credential-status', days: 30 });
    const dl = await pcall('/api/partner/deliver', { linkId });
    partner = {
      seeded: true,
      url: partnerUrl,
      memberCode: 'DEMO-AAA001',
      linkId,
      delivery: dl.result?.status ?? null,
      note: 'Linked to the personal-lab learner with progress and credential-status consent; completion is not granted (see README-seed.md).',
    };
  } catch (err) {
    const m = String(err?.message ?? err);
    partner = {
      seeded: false,
      note:
        'Partner link skipped: ' +
        m.slice(0, 160) +
        (m.includes('did not answer')
          ? ' (known app defect: workerd rejects fetch redirect "error" in lib/academy-partner-dummy-service.ts; see README-seed.md)'
          : ''),
    };
  }
}
log('  partner: ' + partner.note);

// ---- verification (as the identities that should, and should not, see each new thing) ----
log('\nWave 4 verification');
const adminV = await view('admin'),
  modV = await view('moderator');
// escalations
const escItems = adminV.team.escalations.items;
const escOpen = escItems.find((e) => e.status === 'open'),
  escDone = escItems.find((e) => e.status === 'resolved');
check4(
  'escalation: owner sees one open HIGH escalation raised by the moderator',
  escItems.length === 2 &&
    escOpen?.severity === 'high' &&
    escOpen.escalatedByName === people.moderator.name &&
    adminV.team.escalations.counts.open === 1,
);
check4(
  'escalation: a second one is resolved and its post was hidden',
  escDone?.resolution?.decision === 'resolve' && escDone.resolution.hidPost === true,
);
check4(
  'escalation: the moderator sees only their own two, as "You"',
  modV.team.escalations.items.length === 2 &&
    modV.team.escalations.items.every((e) => e.escalatedByName === 'You'),
);
const jaiV = await view('learner-submitted-msme');
check4(
  'escalation: the reporter gets only a generic notice (no severity, no reason)',
  jaiV.team.escalations.notices.length === 1 &&
    jaiV.team.escalations.notices[0].text === 'Your report was reviewed and action was taken.' &&
    !JSON.stringify(jaiV.team.escalations.notices).includes('severity') &&
    jaiV.team.escalations.items.length === 0,
);
check4(
  'escalation: other learners and facilitators see no escalations and no notices',
  (await view('learner-new')).team.escalations.items.length === 0 &&
    (await view('learner-new')).team.escalations.notices.length === 0 &&
    (await view('facilitator-2')).team.escalations.items.length === 0,
);
// accommodations
const fac2 = await view('facilitator-2'),
  fac1 = await view('facilitator-1'),
  asr1 = await view('assessor-1'),
  asr2 = await view('assessor-2');
check4(
  'accommodation: one request is pending for the MSME cohort decider (facilitator-2)',
  fac2.team.accommodationQueue.length === 1 &&
    fac2.team.accommodationQueue[0].learnerName === people['learner-accommodation'].name,
);
check4(
  'accommodation: the farm facilitator and an unrelated learner do not see that queue',
  fac1.team.accommodationQueue.length === 0 &&
    (await view('learner-ps-new')).team.accommodationQueue.length === 0,
);
check4(
  'accommodation: the assigned assessor sees the approved accommodation with the pending farm review',
  asr1.team.assigned.length === 1 &&
    asr1.team.assigned[0].e.accommodations?.[0]?.status === 'approved' &&
    asr1.team.assigned[0].e.accommodations[0].type === 'alternative-format',
);
check4('accommodation: an assessor who is not assigned sees nothing of it', asr2.team.assigned.length === 0);
const accV = (await view('learner-accommodation')).state.enrollments[0];
check4(
  'accommodation: the requester sees their own request as requested (not decided)',
  accV.accommodations.length === 1 &&
    accV.accommodations[0].status === 'requested' &&
    accV.accommodations[0].decision === null,
);
// methods
const revV = (await view('learner-revoked')).state.enrollments[0],
  susV = (await view('learner-suspended')).state.enrollments[0];
check4(
  'method: a decision recorded with the OBSERVED method and the accommodation it considered',
  revV.attempts[0].decision.method === 'observed' &&
    revV.attempts[0].decision.accommodationsConsidered?.length === 1 &&
    revV.attempts[0].decision.passed === true,
);
check4('method: a decision recorded with the ORAL method', susV.attempts[0].decision.method === 'oral');
// remediation
const gateV = (await view('learner-failed-gate')).state.enrollments[0];
check4(
  'remediation: the failed-gate learner has a fail with a failed critical gate and written notes to build "what to do next" from',
  gateV.attempts[0].decision.passed === false &&
    gateV.attempts[0].decision.gates.includes(false) &&
    gateV.attempts[0].decision.notes.length > 0 &&
    gateV.attempts.length === 1,
);
// credentials
const credOf = async (k) => {
  const v = await view(k);
  return v.state.enrollments.find((e) => e.credential)?.credential ?? null;
};
const credComplete = await credOf('learner-complete'),
  credRevoked = await credOf('learner-revoked'),
  credSusp = await credOf('learner-suspended'),
  credPs = await credOf('learner-ps-complete');
check4(
  'credential: learner-complete holds an ACTIVE competence credential (DUMMY issuer)',
  credComplete?.label === 'competence' && credComplete.status === 'active' && credComplete.issuer === 'DUMMY',
);
check4(
  'credential: learner-suspended holds a SUSPENDED credential caused by the adverse appeal',
  credSusp?.status === 'suspended' &&
    credSusp.history.some((h) => h.action === 'suspend' && h.cause === 'appeal') &&
    susV.record.status === 'suspended',
);
check4(
  "credential: learner-revoked holds a REVOKED credential whose history keeps the reviewer's reason",
  credRevoked?.status === 'revoked' &&
    credRevoked.history.some(
      (h) => h.action === 'revoke' && h.reason.includes('observation note') && h.actor.role === 'reviewer',
    ),
);
const pub = async (c) => {
  const r = await fetch(`${base}/api/verify/${c.id}`);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const [vOn, vRev, vSus, vPs] = [
  await pub(credComplete),
  await pub(credRevoked),
  await pub(credSusp),
  await pub(credPs),
];
check4(
  'credential: share ON -> public /verify shows ACTIVE and no name, email or learner id',
  vOn.status === 200 &&
    vOn.body.status === 'active' &&
    !JSON.stringify(vOn.body).includes('@') &&
    !JSON.stringify(vOn.body).includes(people['learner-complete'].id) &&
    !JSON.stringify(vOn.body).includes('Farid'),
);
check4(
  'credential: share ON -> public /verify shows REVOKED',
  vRev.status === 200 && vRev.body.status === 'revoked',
);
check4(
  'credential: share OFF (suspended, and learner-ps-complete) -> public /verify is an identical 404',
  vSus.status === 404 && vPs.status === 404 && JSON.stringify(vSus.body) === JSON.stringify(vPs.body),
);
const selfRevoke = await send(people['learner-complete'], '/api/teams', {
  teamId: TEAM,
  command: {
    type: 'credential-lifecycle',
    enrollmentId: (await mine(people['learner-complete'], P1)).id,
    learnerId: people['learner-complete'].id,
    action: 'revoke',
    reason: 'DEMO attempt to revoke my own credential',
  },
  revision: (await cur(people['learner-complete'], TEAM)).revision,
});
check4(
  "credential: a learner cannot revoke their own credential and cannot read another learner's",
  selfRevoke.status === 403 && !JSON.stringify(await view('learner-new')).includes(credComplete.id),
);
// recovery + assisted invite
const recA = adminV.team.recovery,
  recN = (await view('learner-recovery-new')).team.recovery;
check4(
  'recovery: the owner sees ONE pending request with a recoverable candidate (not approved)',
  recA.canDecide &&
    recA.queue.length === 1 &&
    recA.queue[0].status === 'pending' &&
    recA.queue[0].candidate?.recoverable === true,
);
check4(
  'recovery: the new account sees only its own pending request and cannot decide',
  recN.mine.length === 1 &&
    recN.mine[0].status === 'pending' &&
    recN.canDecide === false &&
    recN.queue.length === 0,
);
check4(
  'recovery: nobody else sees it, and the old account is still active and unmoved',
  (await view('learner-new')).team.recovery.mine.length === 0 &&
    modV.team.recovery.queue.length === 0 &&
    adminV.team.members.find((m) => m.userId === people['learner-ps-new'].id).active === true,
);
const assisted = adminV.team.invites.find((i) => i.assisted);
check4(
  "assisted invite: the owner sees an assisted, still-active invitation with the helper's note",
  !!assisted &&
    assisted.status === 'active' &&
    assisted.assisted.note.startsWith('DEMO') &&
    assisted.assisted.byName === people.admin.name,
);
check4(
  'assisted invite: the activity record shows the assisted invite and the recovery request',
  adminV.team.activity.some((a) => a.action === 'assisted-invite') &&
    adminV.team.activity.some((a) => a.action === 'recovery-request'),
);
// data requests
const dq = adminV.team.dataRequests.queue,
  st = (s) => dq.filter((r) => r.status === s).length;
check4(
  'data requests: the owner queue has one each of received, verified, verification-failed, completed and held',
  ['received', 'verified', 'verification-failed', 'completed', 'held'].every((s) => st(s) === 1) &&
    dq.length === 5,
);
check4(
  'data requests: none overdue (a 30-day SLA is stamped by the server clock and cannot be back-dated through the API)',
  dq.every((r) => r.overdue === false) && dq.every((r) => Date.parse(r.dueAt) > Date.now() + 29 * 86400000),
);
const heldV = await view('learner-withdrawn');
check4(
  'data requests: the erasure is HELD with the retention label, nothing deleted, requester restricted',
  heldV.team.dataRequests.mine[0].status === 'held' &&
    heldV.team.dataRequests.mine[0].hold.label === 'Held — retention policy pending' &&
    heldV.team.dataRequests.restrictedSelf === true &&
    heldV.state.enrollments.length === 1,
);
const doneV = (await view('learner-ps-complete')).team.dataRequests.mine[0],
  newV = await view('learner-new');
check4(
  "data requests: the completed export (with checksum) is visible to its requester only, with no other learner's data",
  doneV.status === 'completed' &&
    !!doneV.export?.sha256 &&
    !doneV.export.json.includes(people['learner-complete'].id) &&
    newV.team.dataRequests.mine.length === 1 &&
    newV.team.dataRequests.queue.length === 0,
);
// reports
const rollup = adminV.team.reports,
  fRoll = fac1.team.reports;
const cells = rollup.cohorts.flatMap((c) => [c.enrolled, c.passed, c.appeals, c.needsRetry]);
check4(
  'reports: the owner rollup covers 3 cohorts, with real counts of 3 or more and small cells shown as "<3"',
  rollup.cohorts.length === 3 &&
    rollup.cohorts.some((c) => typeof c.enrolled === 'number' && c.enrolled >= 3) &&
    cells.includes('<3') &&
    rollup.suppression.marker === '<3',
);
check4(
  'reports: a facilitator sees only their own cohort; learners and the moderator get no rollup',
  fRoll.cohorts.length === 1 &&
    fRoll.cohortIds[0] === C1 &&
    newV.team.reports === null &&
    modV.team.reports === null,
);
check4(
  'reports: the rollup carries no names, ids, emails or evidence text',
  !/@|SUBMITTED-SYNTHETIC|Demo Learner/.test(JSON.stringify(rollup)),
);
// partner
if (partner.seeded) {
  const pv = await (await fetch(base + '/api/partner/links', { headers: headers(PL) })).json();
  check4(
    'partner: the personal-lab learner has one live link with ONLY progress and credential-status granted',
    pv.links.length === 1 &&
      JSON.stringify(pv.links[0].activeScopes) === JSON.stringify(['progress', 'credential-status']),
  );
  const rc = await (await fetch(partnerUrl + '/receipts')).json();
  check4(
    'partner: the dummy partner received one signed callback with the granted scopes and no personal fields',
    partner.delivery === 'delivered' &&
      rc.receipts.length >= 1 &&
      !/name|email|answer|score|evidence/i.test(JSON.stringify(rc.receipts.at(-1).payload)) &&
      rc.receipts.at(-1).payload.scopes.length === 2 &&
      !('completion' in rc.receipts.at(-1).payload),
  );
  const { DEMO_SECRET } = await import('./dummy-partner.mjs'),
    { createHmac, randomBytes } = await import('node:crypto');
  const pcheck = async (code) => {
    const ts = String(Date.now()),
      nonce = randomBytes(16).toString('hex'),
      sig = createHmac('sha256', DEMO_SECRET)
        .update(`aplyd.dummy-partner/1.${ts}.${nonce}.verify:${code}`)
        .digest('hex');
    const r = await fetch(`${base}/api/partner/verify/${code}`, {
      headers: { 'x-demo-timestamp': ts, 'x-demo-nonce': nonce, 'x-demo-signature': sig },
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const okV = await pcheck('DEMO-AAA001'),
    noV = await pcheck('DEMO-AAA002'),
    anon = await fetch(`${base}/api/partner/verify/DEMO-AAA001`);
  check4(
    'partner: a signed verify returns only granted fields (no completion); an ungranted member and an unsigned call are refused',
    okV.status === 200 &&
      okV.body.granted_scopes.length === 2 &&
      !('completion' in okV.body) &&
      !!okV.body.progress &&
      noV.status === 404 &&
      anon.status === 401,
  );
}
// audit (owner only)
{
  const ar = await get(A, `/api/teams/audit?teamId=${encodeURIComponent(TEAM)}&limit=50`);
  // Acceptance fix merged: the newer commands (escalations, data requests, recovery, accommodations, credential lifecycle) now have their own audit types.
  check4(
    'audit: the owner can read the workspace audit (original and newer command types are named)',
    ar.status === 200 &&
      ar.items.length === 50 &&
      ar.items.some((i) => i.type === 'assess') &&
      ar.items.some((i) => i.type !== 'other' && i.type !== 'assess') &&
      ar.items.every((i) => /^a-[0-9a-f]{12}$/.test(i.actor)),
  );
  check4(
    'audit: a learner and the moderator get the same 404 as an outsider',
    (await get(people['learner-new'], `/api/teams/audit?teamId=${encodeURIComponent(TEAM)}`)).status ===
      404 &&
      (await get(people.moderator, `/api/teams/audit?teamId=${encodeURIComponent(TEAM)}`)).status === 404,
  );
}
check4(
  'pending reviews are still exactly the original 3 (every new review in wave 4 was decided)',
  adminV.team.pending.length === 3,
);
writeIdentities(orderAll);
Object.assign(stage, {
  partner,
  escalations: { open: escOpen?.id ?? null, resolved: escDone?.id ?? null },
  credentials: {
    active: credComplete?.id ?? null,
    revoked: credRevoked?.id ?? null,
    suspended: credSusp?.id ?? null,
    privateActive: credPs?.id ?? null,
  },
  wave4Assertions: w4.length,
});

summary.counts = {
  learners: L.length + NL.filter((n) => n[2] !== null).length + 1,
  staff: staff.length,
  cohorts: 3,
  posts: 6,
  sessions: 2,
  networkProfiles: 3,
  supportRequests: 1,
  escalations: 2,
  accommodations: 3,
  dataRequests: 5,
  recoveryPending: 1,
  assistedInvites: 1,
  credentials: 4,
};
writeFileSync(
  resolve(here, 'seed-summary.json'),
  JSON.stringify(
    {
      baseUrl: base,
      teamId: TEAM,
      nonce,
      cohorts: { farm: C1, msme: C2, publicServant: C3 },
      sessions: { attendance: sessA, upcoming: sessB },
      learners: L.map(([key, label, c]) => ({ key, label, cohort: ['farm', 'msme', 'public-servant'][c] })),
      counts: summary.counts,
      wave4: stage,
      verification: { checks, failures, wave4Assertions: w4.length, originalAssertions: checks - w4.length },
    },
    null,
    2,
  ) + '\n',
);
log(`\nSeed summary: workspace ${TEAM} on ${base}`);
log(
  `  cohorts: ${cohorts.length} (capacities ${capacities.join('/')}), learners: ${L.length} + ${NL.length} wave 4, staff: ${staff.length}, posts: 6, sessions: 2, directory profiles: 3, support requests: 1, personal learner: 1`,
);
log(`  identities written to scripts/demo/demo-identities.json (${orderAll.length})`);
log(
  `  assertions: ${checks - failures.length}/${checks} passed (${checks - w4.length} original + ${w4.length} wave 4)`,
);
if (failures.length) {
  log('FAILED: ' + failures.join('; '));
  process.exit(1);
}
