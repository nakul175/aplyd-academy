import './qa-paths.mjs';
import assert from 'node:assert/strict';
import { fixture, identity, curriculum, nonce, action, current, get, post, success } from '../local-qa.mjs';
export const checks = { sources: true, answers: true, rubric: true, safety: true, accessibility: true };
export async function join(owner, id, u, roles, scopes = []) {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  success(await action(owner, id, { type: 'invite', email: u.email, roles, scopes, token }));
  const preview = success(await get(u, '/api/teams?invite=' + token));
  return success(await post(u, id, { type: 'accept', token }, preview.revision));
}
export async function operationsFixture() {
  const f = await fixture(),
    { owner, a, b, outsider: c, mod: fac, p, id, cid, otherCid } = f;
  const backup = identity('operations-owner-two'),
    withdrawn = identity('operations-withdrawn'),
    nonmember = identity('operations-nonmember');
  const canaries = Object.fromEntries(
    [
      'evidenceA',
      'evidenceB',
      'evidenceC',
      'lessonPractice',
      'laterDraft',
      'assessorNote',
      'decisionFeedback',
      'appealReason',
      'ownerGoal',
      'learnerGoal',
      'supportDescription',
      'supportReply',
      'supportResolution',
      'supportReopen',
      'contentSummary',
      'contentReview',
      'sessionInstructions',
    ].map((key) => [
      key,
      `PRIVATE-${key.toUpperCase()}-${nonce}: fictional checked references and accountable human approval only.`,
    ]),
  );
  await join(owner, id, backup, ['admin']);
  await join(owner, id, withdrawn, ['learner']);
  success(
    await action(owner, id, {
      type: 'member',
      userId: owner.id,
      roles: ['admin', 'learner', 'reviewer'],
      scopes: [cid],
      active: true,
    }),
  );
  success(
    await action(owner, id, {
      type: 'member',
      userId: fac.id,
      roles: ['facilitator', 'assessor', 'reviewer'],
      scopes: [cid],
      active: true,
    }),
  );
  // c may assess the first cohort but must never assess their own second-cohort work.
  success(
    await action(owner, id, {
      type: 'member',
      userId: c.id,
      roles: ['learner', 'assessor', 'facilitator'],
      scopes: [cid, otherCid],
      active: true,
    }),
  );
  success(await action(c, id, { type: 'enroll', programId: curriculum.pathways[2].id, cohortId: otherCid }));
  const enrollments = {},
    attempts = {};
  for (const [key, u, program] of [
    ['a', a, p],
    ['b', b, p],
    ['c', c, curriculum.pathways[2]],
  ]) {
    let x = success(await current(u, id)),
      e = x.state.enrollments.find((e) => !e.withdrawn && e.programId === program.id);
    assert.ok(e);
    enrollments[key] = e.id;
    for (const lesson of program.lessons)
      success(
        await action(u, id, {
          type: 'lesson',
          enrollmentId: e.id,
          lessonId: lesson.id,
          practice: canaries.lessonPractice,
          answers: lesson.quiz.map((q) => q.correctOptionIndex),
        }),
      );
    x = success(
      await action(u, id, {
        type: 'submit',
        enrollmentId: e.id,
        confirmed: true,
        fields: Object.fromEntries(
          program.practicalAssessment.submissionPrompts.map((prompt) => [
            prompt.id,
            canaries['evidence' + key.toUpperCase()],
          ]),
        ),
      }),
    );
    attempts[key] = x.state.enrollments.find((e) => e.id === enrollments[key]).attempts.at(-1).id;
  }
  success(
    await action(owner, id, { type: 'assign', kind: 'assessment', targetId: attempts.a, staffId: c.id }),
  );
  const beforeAppeal = success(
    await action(c, id, {
      type: 'assess',
      learnerId: a.id,
      enrollmentId: enrollments.a,
      attemptId: attempts.a,
      scores: [4, 4, 4, 4],
      gates: [true, true, true],
      notes: Array(4).fill(canaries.assessorNote),
      feedback: canaries.decisionFeedback,
    }),
  );
  const ownBefore = success(await current(a, id)).state.enrollments.find((e) => e.id === enrollments.a),
    recordBefore = structuredClone(ownBefore.record),
    decisionBefore = structuredClone(ownBefore.attempts[0].decision);
  let x = success(
    await action(a, id, {
      type: 'appeal',
      enrollmentId: enrollments.a,
      attemptId: attempts.a,
      reason: canaries.appealReason,
    }),
  );
  const appealId = x.state.enrollments.find((e) => e.id === enrollments.a).appeals.at(-1).id;
  success(await action(owner, id, { type: 'assign', kind: 'appeal', targetId: appealId, staffId: owner.id }));
  success(
    await action(owner, id, { type: 'assign', kind: 'assessment', targetId: attempts.b, staffId: fac.id }),
  );
  success(
    await action(a, id, {
      type: 'draft',
      enrollmentId: enrollments.a,
      fields: { [p.practicalAssessment.submissionPrompts[0].id]: canaries.laterDraft },
    }),
  );
  success(
    await action(owner, id, {
      type: 'learning-plan',
      goal: 'explore',
      personalGoal: canaries.ownerGoal,
      weeklyMinutes: 40,
      timeZone: 'Asia/Kolkata',
      remindersEnabled: false,
    }),
  );
  success(
    await action(a, id, {
      type: 'learning-plan',
      goal: 'explore',
      personalGoal: canaries.learnerGoal,
      weeklyMinutes: 40,
      timeZone: 'Asia/Kolkata',
      remindersEnabled: false,
    }),
  );
  // Two withdrawn enrollment rows from one learner, one with saved lesson history.
  let d = success(
    await action(withdrawn, id, { type: 'enroll', programId: p.id, cohortId: cid }),
  ).state.enrollments.at(-1);
  success(
    await action(withdrawn, id, {
      type: 'lesson',
      enrollmentId: d.id,
      lessonId: p.lessons[0].id,
      practice: canaries.lessonPractice,
      answers: p.lessons[0].quiz.map((q) => q.correctOptionIndex),
    }),
  );
  success(await action(withdrawn, id, { type: 'withdraw', enrollmentId: d.id }));
  d = success(
    await action(withdrawn, id, { type: 'enroll', programId: p.id, cohortId: cid }),
  ).state.enrollments.at(-1);
  success(await action(withdrawn, id, { type: 'withdraw', enrollmentId: d.id }));
  const supports = {};
  async function request(key, u, category, cohortId, handler) {
    let y = success(
        await action(u, id, {
          type: 'support-open',
          category,
          cohortId,
          subject: 'Fictional operations ' + key,
          body: canaries.supportDescription,
          audienceAcknowledged: true,
        }),
      ),
      r = y.team.support.mine.at(-1);
    supports[key] = r.id;
    if (handler) {
      success(await action(handler, id, { type: 'support-claim', requestId: r.id }));
      success(
        await action(handler, id, { type: 'support-reply', requestId: r.id, body: canaries.supportReply }),
      );
    }
    return r;
  }
  const reopened = await request('reopened', a, 'learning', cid, owner);
  success(
    await action(owner, id, {
      type: 'support-resolve',
      requestId: reopened.id,
      resolution: canaries.supportResolution,
    }),
  );
  success(
    await action(a, id, { type: 'support-reopen', requestId: reopened.id, body: canaries.supportReopen }),
  );
  await request('facHandled', b, 'content', cid, fac);
  await request('workspacePrivacy', c, 'privacy', null, owner);
  await request('otherScope', c, 'learning', otherCid, null);
  const sessions = {},
    startsAt = new Date(Date.now() + 3600000).toISOString(),
    endsAt = new Date(Date.now() + 7200000).toISOString();
  for (const [key, u, cohortId] of [
    ['ownerHosted', owner, cid],
    ['facHosted', fac, cid],
    ['unavailableHost', c, otherCid],
  ]) {
    const y = success(
      await action(u, id, {
        type: 'session-create',
        cohortId,
        title: 'Synthetic ' + key + ' session',
        description: 'A fictional local source-checking practice session for operations coverage.',
        instructions: canaries.sessionInstructions,
        startsAt,
        endsAt,
        capacity: 10,
      }),
    );
    sessions[key] = y.team.network.sessions.at(-1).id;
  }
  for (const u of [a, b])
    success(await action(u, id, { type: 'session-rsvp', sessionId: sessions.ownerHosted, going: true }));
  success(
    await action(owner, id, {
      type: 'member',
      userId: c.id,
      roles: ['learner', 'assessor'],
      scopes: [cid, otherCid],
      active: true,
    }),
  );
  const content = {},
    reviewDueAt = new Date(Date.now() + 5 * 86400000).toISOString();
  for (const [key, title, state] of [
    ['publication', 'Synthetic reviewed private practice', 'published'],
    ['inReview', 'Synthetic pending private review', 'in_review'],
    ['approved', 'Synthetic approved private draft', 'approved'],
  ]) {
    let y = success(
        await action(owner, id, {
          type: 'content-copy',
          sourceRef: { scope: 'global', programId: p.id, versionId: '0.1-review-draft' },
        }),
      ),
      draft = y.team.content.drafts.at(-1),
      document = structuredClone(draft.document);
    document.title = title;
    document.summary = canaries.contentSummary;
    y = success(
      await action(owner, id, {
        type: 'content-save',
        draftId: draft.id,
        revision: draft.revision,
        document,
      }),
    );
    draft = y.team.content.drafts.find((d) => d.id === draft.id);
    y = success(
      await action(owner, id, {
        type: 'content-submit',
        draftId: draft.id,
        revision: draft.revision,
        reviewerId: backup.id,
        reviewDueAt,
      }),
    );
    draft = y.team.content.drafts.find((d) => d.id === draft.id);
    content[key] = { draftId: draft.id, title };
    if (state !== 'in_review') {
      y = success(
        await action(backup, id, {
          type: 'content-review',
          draftId: draft.id,
          revision: draft.revision,
          decision: 'approve',
          checks,
          note: canaries.contentReview,
        }),
      );
      draft = y.team.content.drafts.find((d) => d.id === draft.id);
      if (state === 'published') {
        y = success(
          await action(owner, id, { type: 'content-publish', draftId: draft.id, revision: draft.revision }),
        );
        content[key].publicationId = y.team.content.publications.at(-1).id;
      }
    }
  }
  return {
    ...f,
    c,
    fac,
    backup,
    withdrawn,
    nonmember,
    enrollments,
    attempts,
    appealId,
    recordBefore,
    decisionBefore,
    supports,
    sessions,
    content,
    canaries,
    reviewDueAt,
  };
}
