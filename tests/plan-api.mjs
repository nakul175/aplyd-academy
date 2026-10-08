import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const app = resolve(process.env.ACADEMY_APP_PATH ?? '.');
const qa = await import(pathToFileURL(resolve(app, 'tests/local-qa.mjs')).href);
const { base, curriculum, identity, headers, get, post, current, action, fixture } = qa;
// local-qa rejects non-loopback URLs. These identities are synthetic local fixtures only.
const artifact = resolve(
  process.env.ACADEMY_QA_OUTPUT ?? resolve(app, '.sites-runtime'),
  'learning-plan-api.json',
);
let assertions = 0;
const scenarios = [];
const equal = (a, b) => {
  assert.deepEqual(a, b);
  assertions++;
};
const truth = (v, message) => {
  assert.ok(v, message);
  assertions++;
};
const success = (x) => {
  equal(x.status, 200);
  return x;
};
async function scenario(name, work) {
  const start = assertions;
  try {
    await work();
    scenarios.push({ name, passed: true, assertions: assertions - start });
  } catch (error) {
    scenarios.push({ name, passed: false, assertions: assertions - start, error: String(error.message) });
    throw error;
  }
}
async function labPost(u, command, revision, actionId = crypto.randomUUID()) {
  const r = await fetch(base + '/api/academy', {
    method: 'POST',
    headers: headers(u),
    body: JSON.stringify({ command, revision, actionId }),
  });
  return { status: r.status, ...(await r.json()) };
}
const labRead = (u) => get(u, '/api/academy');
async function labAction(u, command) {
  const x = success(await labRead(u));
  return labPost(u, command, x.revision);
}
const lastTask = (x) => x.state.learningPlan.tasks.at(-1);
const noCanaries = (x, canaries) => {
  const text = JSON.stringify(x);
  for (const c of canaries)
    truth(!text.includes(c), 'Private learner planning data leaked in another projection: ' + c);
};
const nonce = crypto.randomUUID();
const goalCanary = 'PRIVATE-PLAN-GOAL-' + nonce;
const noteCanary = 'PRIVATE-PLAN-NOTE-' + nonce;
const otherCanary = 'OTHER-LEARNER-PLAN-' + nonce;
const p = curriculum.pathways[1];
let lab, labOther, labEnrollment, team, teamEnrollment, teamOtherEnrollment, practiceTask, linkedTask;
let error;

try {
  await scenario(
    'personal plan preferences persist with nullable scheduling and own-only state',
    async () => {
      lab = identity('plan-lab');
      labOther = identity('plan-lab-other');
      let x = success(await labRead(lab));
      equal(x.state.enrollments.length, 0);
      x = success(
        await labPost(
          lab,
          {
            type: 'learning-plan',
            goal: 'clear-response',
            personalGoal: goalCanary,
            weeklyMinutes: 75,
            timeZone: 'Asia/Kolkata',
            remindersEnabled: false,
          },
          x.revision,
        ),
      );
      x = success(
        await labPost(
          lab,
          {
            type: 'plan-task',
            kind: 'practice',
            title: 'Synthetic private work practice',
            dueDate: null,
            plannedMinutes: 15,
            note: noteCanary,
          },
          x.revision,
        ),
      );
      practiceTask = lastTask(x).id;
      const saved = success(await labRead(lab));
      equal(saved.state.learningPlan.personalGoal, goalCanary);
      equal(saved.state.learningPlan.weeklyMinutes, 75);
      equal(saved.state.learningPlan.tasks[0].dueDate, null);
      equal(saved.state.learningPlan.tasks[0].note, noteCanary);
      noCanaries(success(await labRead(labOther)), [goalCanary, noteCanary]);
    },
  );

  await scenario('self-reported practice completion cannot issue course progress or a record', async () => {
    let x = success(await labAction(lab, { type: 'enroll', programId: p.id }));
    labEnrollment = x.state.enrollments[0].id;
    const before = structuredClone(x.state.enrollments);
    x = success(
      await labPost(lab, { type: 'plan-task-status', taskId: practiceTask, status: 'done' }, x.revision),
    );
    equal(x.state.learningPlan.tasks.find((t) => t.id === practiceTask).status, 'done');
    equal(x.state.enrollments, before);
    equal(x.state.enrollments[0].record, null);
    equal(x.state.enrollments[0].completed.length, 0);
    x = success(
      await labPost(
        lab,
        {
          type: 'plan-task',
          kind: 'lesson',
          enrollmentId: labEnrollment,
          lessonId: p.lessons[0].id,
          dueDate: null,
        },
        x.revision,
      ),
    );
    const id = lastTask(x).id;
    equal(
      (await labPost(lab, { type: 'plan-task-status', taskId: id, status: 'done' }, x.revision)).status,
      422,
    );
    equal(success(await labRead(lab)).state.enrollments[0].completed.length, 0);
  });

  await scenario('plan dates, pinned links and client identity/reference fields are validated', async () => {
    let x = success(await labRead(lab));
    equal(
      (
        await labPost(
          lab,
          { type: 'plan-task', kind: 'practice', title: 'Impossible date example', dueDate: '2026-02-30' },
          x.revision,
        )
      ).status,
      422,
    );
    equal(
      (await labPost(lab, { type: 'learning-plan', goal: 'records', learnerId: 'another' }, x.revision))
        .status,
      400,
    );
    equal(
      (await labPost(lab, { type: 'learning-plan', goal: 'records', actor: 'admin' }, x.revision)).status,
      400,
    );
    equal(
      (
        await labPost(
          lab,
          {
            type: 'plan-task',
            kind: 'lesson',
            enrollmentId: labEnrollment,
            lessonId: p.lessons[0].id,
            contentRef: { scope: 'global', programId: p.id, versionId: 'invented' },
          },
          x.revision,
        )
      ).status,
      400,
    );
    equal(
      (
        await labPost(
          labOther,
          { type: 'plan-task', kind: 'lesson', enrollmentId: labEnrollment, lessonId: p.lessons[0].id },
          (await labRead(labOther)).revision,
        )
      ).status,
      404,
    );
    equal(success(await labRead(lab)).revision, x.revision);
  });

  await scenario(
    'optional reminder settings only affect private plan state and retain due tasks',
    async () => {
      let x = success(await labRead(lab));
      const deliveriesBefore = structuredClone(x.state.deliveries);
      x = success(
        await labPost(
          lab,
          {
            type: 'plan-task',
            kind: 'practice',
            title: 'Synthetic dated practice',
            dueDate: '2026-10-05',
            plannedMinutes: 10,
          },
          x.revision,
        ),
      );
      const datedId = lastTask(x).id;
      x = success(await labPost(lab, { type: 'learning-plan', remindersEnabled: true }, x.revision));
      equal(x.state.learningPlan.remindersEnabled, true);
      equal(x.state.deliveries, deliveriesBefore);
      x = success(await labPost(lab, { type: 'learning-plan', remindersEnabled: false }, x.revision));
      const read = success(await labRead(lab));
      equal(read.state.learningPlan.remindersEnabled, false);
      truth(read.state.learningPlan.tasks.some((t) => t.id === datedId));
      equal(read.state.deliveries, deliveriesBefore);
      truth(
        !Object.hasOwn(read, 'notificationSent') && !Object.hasOwn(read, 'emailSent'),
        'This API must not invent delivery results.',
      );
    },
  );

  await scenario(
    'personal stale revision and durable action replay preserve one effective plan mutation',
    async () => {
      const before = success(await labRead(lab)),
        actionId = crypto.randomUUID();
      const command = { type: 'learning-plan', weeklyMinutes: 80 };
      const x = success(await labPost(lab, command, before.revision, actionId));
      equal((await labPost(lab, { type: 'learning-plan', weeklyMinutes: 100 }, before.revision)).status, 409);
      const replay = success(await labPost(lab, command, before.revision, actionId));
      equal(replay.replayed, true);
      equal(
        (await labPost(lab, { type: 'learning-plan', weeklyMinutes: 85 }, x.revision, actionId)).status,
        409,
      );
      equal(success(await labRead(lab)).state.learningPlan.weeklyMinutes, 80);
    },
  );

  await scenario('team dispatch binds private plans to the authenticated own learner', async () => {
    team = await fixture();
    const { owner, a, b, id, p } = team;
    teamEnrollment = success(await current(a, id)).state.enrollments[0].id;
    teamOtherEnrollment = success(await current(b, id)).state.enrollments[0].id;
    let x = success(
      await action(a, id, {
        type: 'learning-plan',
        goal: 'check-draft',
        personalGoal: goalCanary,
        weeklyMinutes: 55,
        timeZone: 'Asia/Kolkata',
        remindersEnabled: true,
      }),
    );
    x = success(
      await action(a, id, {
        type: 'plan-task',
        kind: 'practice',
        title: 'Own synthetic plan activity',
        dueDate: null,
        note: noteCanary,
      }),
    );
    practiceTask = lastTask(x).id;
    x = success(
      await action(a, id, {
        type: 'plan-task',
        kind: 'lesson',
        enrollmentId: teamEnrollment,
        lessonId: p.lessons[0].id,
        dueDate: '2026-10-05',
      }),
    );
    linkedTask = lastTask(x).id;
    success(await action(b, id, { type: 'learning-plan', personalGoal: otherCanary }));
    const own = success(await current(a, id));
    equal(own.state.learningPlan.personalGoal, goalCanary);
    noCanaries(own, [otherCanary]);
    noCanaries(success(await current(b, id)), [goalCanary, noteCanary]);
    noCanaries(success(await current(owner, id)), [goalCanary, noteCanary, otherCanary]);
    equal(
      (
        await action(a, id, {
          type: 'plan-task',
          kind: 'lesson',
          enrollmentId: teamOtherEnrollment,
          lessonId: p.lessons[0].id,
        })
      ).status,
      404,
    );
    equal(
      (
        await action(a, id, {
          type: 'plan-task',
          kind: 'lesson',
          enrollmentId: labEnrollment,
          lessonId: p.lessons[0].id,
        })
      ).status,
      404,
    );
    equal(
      (
        await labAction(lab, {
          type: 'plan-task',
          kind: 'lesson',
          enrollmentId: teamEnrollment,
          lessonId: p.lessons[0].id,
        })
      ).status,
      404,
    );
    equal(
      (await action(a, id, { type: 'learning-plan', personalGoal: 'Forged', learnerId: b.id })).status,
      400,
    );
    equal(
      (await action(b, id, { type: 'plan-task-status', taskId: practiceTask, status: 'done' })).status,
      404,
    );
  });

  await scenario(
    'paused cohort blocks linked progress while own planning preferences and practice remain private',
    async () => {
      const { owner, a, id, cid, p } = team;
      success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'paused' }));
      equal(
        (
          await action(a, id, {
            type: 'plan-task',
            kind: 'lesson',
            enrollmentId: teamEnrollment,
            lessonId: p.lessons[1].id,
          })
        ).status,
        409,
      );
      success(await action(a, id, { type: 'learning-plan', weeklyMinutes: 50 }));
      const before = success(await current(a, id)).state.enrollments;
      const x = success(
        await action(a, id, { type: 'plan-task-status', taskId: practiceTask, status: 'done' }),
      );
      equal(x.state.enrollments, before);
      equal(x.state.enrollments[0].record, null);
      equal(x.state.enrollments[0].completed.length, 0);
      success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
    },
  );

  await scenario(
    'learner role loss is enforced by server without removing own private preferences/history',
    async () => {
      const { owner, a, id, cid, p } = team;
      success(
        await action(owner, id, {
          type: 'member',
          userId: a.id,
          roles: ['facilitator'],
          scopes: [cid],
          active: true,
        }),
      );
      equal(
        (
          await action(a, id, {
            type: 'plan-task',
            kind: 'lesson',
            enrollmentId: teamEnrollment,
            lessonId: p.lessons[1].id,
          })
        ).status,
        403,
      );
      success(await action(a, id, { type: 'learning-plan', weeklyMinutes: 45 }));
      success(
        await action(a, id, {
          type: 'plan-task',
          kind: 'practice',
          title: 'Private practice without course privilege',
          dueDate: null,
        }),
      );
      equal(success(await current(a, id)).state.learningPlan.personalGoal, goalCanary);
      success(
        await action(owner, id, {
          type: 'member',
          userId: a.id,
          roles: ['learner'],
          scopes: [],
          active: true,
        }),
      );
    },
  );

  await scenario(
    'owner, scoped facilitator and assigned assessor projections never contain private notes/goals',
    async () => {
      const { owner, a, b, mod, id, cid, p } = team;
      success(
        await action(owner, id, {
          type: 'member',
          userId: mod.id,
          roles: ['facilitator', 'assessor', 'reviewer', 'moderator'],
          scopes: [cid],
          active: true,
        }),
      );
      for (const l of p.lessons)
        success(
          await action(a, id, {
            type: 'lesson',
            enrollmentId: teamEnrollment,
            lessonId: l.id,
            practice:
              'A synthetic checked response references the source packet and keeps a human approval route.',
            answers: l.quiz.map((q) => q.correctOptionIndex),
          }),
        );
      const fields = Object.fromEntries(
        p.practicalAssessment.submissionPrompts.map((f) => [
          f.id,
          'SYNTHETIC-SUBMITTED-EVIDENCE: source checks, permitted data and careful human approval.',
        ]),
      );
      const submitted = success(
        await action(a, id, { type: 'submit', enrollmentId: teamEnrollment, fields, confirmed: true }),
      );
      const attemptId = submitted.state.enrollments[0].attempts[0].id;
      success(
        await action(owner, id, { type: 'assign', kind: 'assessment', targetId: attemptId, staffId: mod.id }),
      );
      const staff = success(await current(mod, id));
      truth(staff.team.summaries.length > 0);
      equal(staff.team.assigned.length, 1);
      truth(JSON.stringify(staff.team.assigned).includes('SYNTHETIC-SUBMITTED-EVIDENCE'));
      noCanaries(staff, [goalCanary, noteCanary, otherCanary]);
      noCanaries(success(await current(owner, id)), [goalCanary, noteCanary, otherCanary]);
      noCanaries(success(await current(b, id)), [goalCanary, noteCanary]);
      equal(Object.hasOwn(staff.team.assigned[0].e, 'learningPlan'), false);
      equal(Object.hasOwn(staff.team.summaries[0], 'learningPlan'), false);
      equal(success(await current(a, id)).state.learningPlan.tasks.find((t) => t.id === linkedTask).note, '');
    },
  );

  await scenario(
    'team CAS rejects stale and concurrent plan updates instead of silently overwriting',
    async () => {
      const { a, id } = team;
      const before = success(await current(a, id));
      const race = await Promise.all([
        post(a, id, { type: 'learning-plan', weeklyMinutes: 60 }, before.revision),
        post(a, id, { type: 'learning-plan', weeklyMinutes: 65 }, before.revision),
      ]);
      equal(race.map((x) => x.status).sort(), [200, 409]);
      const saved = success(await current(a, id));
      truth([60, 65].includes(saved.state.learningPlan.weeklyMinutes));
      equal(saved.revision, before.revision + 1);
      equal((await post(a, id, { type: 'learning-plan', weeklyMinutes: 200 }, before.revision)).status, 409);
      equal(
        success(await current(a, id)).state.learningPlan.weeklyMinutes,
        saved.state.learningPlan.weeklyMinutes,
      );
    },
  );

  await scenario(
    'removed learner cannot mutate or replay a plan write; own readable plan remains retained',
    async () => {
      const { owner, a, id } = team;
      const before = success(await current(a, id)),
        actionId = crypto.randomUUID(),
        cmd = { type: 'learning-plan', weeklyMinutes: 70 };
      const saved = success(await post(a, id, cmd, before.revision, actionId));
      success(
        await action(owner, id, {
          type: 'member',
          userId: a.id,
          roles: ['learner'],
          scopes: [],
          active: false,
        }),
      );
      for (const command of [
        { type: 'learning-plan', weeklyMinutes: 90 },
        { type: 'plan-task', kind: 'practice', title: 'Removed member attempt' },
        { type: 'plan-task-status', taskId: practiceTask, status: 'planned' },
        { type: 'plan-task-remove', taskId: practiceTask },
      ])
        equal((await post(a, id, command, saved.revision)).status, 403);
      equal((await post(a, id, cmd, before.revision, actionId)).status, 403);
      const history = success(await current(a, id));
      equal(history.team.active, false);
      equal(history.state.learningPlan.personalGoal, goalCanary);
      equal(history.state.learningPlan.weeklyMinutes, 70);
      truth(history.state.learningPlan.tasks.some((t) => t.id === practiceTask));
      noCanaries(success(await current(owner, id)), [goalCanary, noteCanary]);
    },
  );
} catch (e) {
  error = e;
}

const result = {
  passed: !error,
  assertions,
  scenarios,
  limits: [
    'Synthetic loopback identity headers only; hosted dispatcher authentication and actual hosting recipient access are not tested.',
    'Reminder storage and projection assertions do not prove email/push delivery; this feature provides no sender.',
    'Pinned-reference corruption belongs to the separate cloned-state regression, never to client-editable API fields.',
  ],
};
mkdirSync(resolve(artifact, '..'), { recursive: true });
writeFileSync(artifact, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (error) throw error;
