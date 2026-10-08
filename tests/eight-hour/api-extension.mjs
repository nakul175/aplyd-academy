export async function extension({ qa, fixture: f, scenario, eq, ok }) {
  const { owner, a, b, mod, id, cid, p } = f;
  const own = (u) => qa.get(u, '/api/academy');
  const ownPost = async (u, c, revision, actionId = crypto.randomUUID()) => {
    const r = await fetch(qa.base + '/api/academy', {
      method: 'POST',
      headers: qa.headers(u),
      body: JSON.stringify({ command: c, revision, actionId }),
    });
    return { status: r.status, ...(await r.json()) };
  };
  const pref = (language = 'hi') => ({
    type: 'learning-access-preferences',
    preferredLanguage: language,
    readAloudMode: 'ask',
    assistancePreference: 'capture-response',
  });
  const declaration = {
    method: 'human-transcription',
    responseLanguage: 'en',
    learnerConsent: true,
    learnerReadBackConfirmed: true,
    declaredNoAnswerCoaching: true,
  };
  await scenario(
    'integrated personal preferences exact fields own isolation CAS and durable replay',
    async () => {
      const old = qa.success(await own(a)),
        other = qa.success(await own(b));
      eq(
        (
          await fetch(qa.base + '/api/academy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: 0, actionId: crypto.randomUUID(), command: pref() }),
          })
        ).status,
        401,
      );
      for (const key of ['actor', 'learnerId', 'approved', 'helperId', 'endpoint'])
        eq((await ownPost(a, { ...pref(), [key]: 'unsupported' }, old.revision)).status, 400);
      for (const [c, status] of [
        [{ ...pref(), preferredLanguage: 'en/private' }, 422],
        [{ ...pref(), readAloudMode: 'autoplay' }, 409],
        [{ ...pref(), assistancePreference: 'approved-accommodation' }, 409],
      ])
        eq((await ownPost(a, c, old.revision)).status, status);
      const actionId = crypto.randomUUID(),
        saved = qa.success(await ownPost(a, pref('mr-in'), old.revision, actionId));
      eq(saved.state.learningAccess, {
        schemaVersion: 1,
        preferredLanguage: 'mr-IN',
        readAloudMode: 'ask',
        assistancePreference: 'capture-response',
      });
      eq(saved.revision, old.revision + 1);
      eq(saved.state.enrollments, old.state.enrollments);
      const replay = qa.success(await ownPost(a, pref('mr-in'), old.revision, actionId));
      eq(replay.replayed, true);
      eq(replay.revision, saved.revision);
      eq((await ownPost(a, pref('hi'), old.revision, actionId)).status, 409);
      eq((await ownPost(a, pref('hi'), old.revision)).status, 409);
      eq((await own(b)).state, other.state);
      const revision = saved.revision,
        race = await Promise.all([ownPost(a, pref('hi'), revision), ownPost(a, pref('ta'), revision)]);
      eq(race.map((r) => r.status).sort(), [200, 409]);
      eq((await own(a)).revision, revision + 1);
      eq(
        (await own(a)).state.learningAccess.preferredLanguage,
        race.find((r) => r.status === 200).state.learningAccess.preferredLanguage,
      );
    },
  );
  await scenario(
    'integrated shared preferences remain own and absent from staff directory and operations source',
    async () => {
      let x = qa.success(await qa.current(a, id));
      const before = structuredClone(x.state.enrollments),
        oldOther = qa.success(await qa.current(b, id));
      const aid = crypto.randomUUID(),
        c = pref('hi');
      x = qa.success(await qa.post(a, id, c, x.revision, aid));
      eq(x.state.learningAccess.preferredLanguage, 'hi');
      eq(x.state.enrollments, before);
      const replay = qa.success(await qa.post(a, id, c, x.revision - 1, aid));
      eq(replay.replayed, true);
      eq(replay.revision, x.revision);
      eq((await qa.current(b, id)).state.learningAccess, oldOther.state.learningAccess);
      for (const u of [owner, mod, b]) {
        const staff = qa.success(await qa.current(u, id));
        ok(!JSON.stringify(staff.team).includes('learningAccess'));
      }
      const dir = qa.success(await qa.get(a));
      ok(!JSON.stringify(dir.workspaces).includes('learningAccess'));
      eq(dir.workspaces.filter((w) => w.id === id).length, 1);
      for (const key of ['actor', 'learnerId'])
        eq((await qa.post(a, id, { ...pref(), [key]: b.id }, x.revision)).status, 400);
      eq((await qa.post(a, id, { ...pref(), preferredLanguage: 'en/private' }, x.revision)).status, 422);
    },
  );
  async function completed(u) {
    let x = qa.success(await qa.current(u, id)),
      e = x.state.enrollments.find((e) => e.programId === p.id && !e.withdrawn);
    for (const lesson of p.lessons)
      x = qa.success(
        await qa.action(u, id, {
          type: 'lesson',
          enrollmentId: e.id,
          lessonId: lesson.id,
          answers: lesson.quiz.map((q) => q.correctOptionIndex),
          practice: 'Fictional integrated read-back practice checked against the supplied source packet.',
        }),
      );
    return {
      x,
      e: x.state.enrollments.find((r) => r.id === e.id),
      fields: Object.fromEntries(
        p.practicalAssessment.submissionPrompts.map((prompt) => [
          prompt.id,
          'READBACK-PRIVATE-' +
            u.id +
            ': fictional learner-owned reasoning checked against permitted source records.',
        ]),
      ),
    };
  }
  await scenario('structured read-back own API gates store immutable self-declaration only', async () => {
    const { x, e, fields } = await completed(a),
      c = {
        type: 'submit',
        enrollmentId: e.id,
        fields,
        confirmed: true,
        assisted: true,
        assistance: declaration,
      };
    for (const [key, value] of [
      ['learnerConsent', false],
      ['learnerReadBackConfirmed', false],
      ['declaredNoAnswerCoaching', false],
      ['responseLanguage', 'hi'],
      ['method', 'approved-oral'],
    ])
      ok(
        [400, 409, 422].includes(
          (await qa.post(a, id, { ...c, assistance: { ...declaration, [key]: value } }, x.revision)).status,
        ),
      );
    eq((await qa.post(a, id, { ...c, assisted: false }, x.revision)).status, 400);
    eq(
      (await qa.post(a, id, { ...c, assistance: { ...declaration, helperId: 'untrusted' } }, x.revision))
        .status,
      400,
    );
    eq((await qa.post(b, id, c, (await qa.current(b, id)).revision)).status, 404);
    eq((await qa.post(a, id, { ...c, learnerId: b.id }, x.revision)).status, 400);
    const aid = crypto.randomUUID(),
      saved = qa.success(await qa.post(a, id, c, x.revision, aid)),
      attempt = saved.state.enrollments.find((r) => r.id === e.id).attempts.at(-1);
    eq(attempt.assisted, true);
    eq(attempt.assistance.mode, 'learner-declared read-back');
    eq(attempt.assistance.contentRef, e.contentRef);
    for (const [k, v] of Object.entries(declaration)) eq(attempt.assistance[k], v);
    ok(!Object.hasOwn(attempt.assistance, 'helperId'));
    ok(!JSON.stringify(attempt).includes('approved-accommodation'));
    eq(attempt.fields, fields);
    const replay = qa.success(await qa.post(a, id, c, x.revision, aid));
    eq(replay.replayed, true);
    eq(replay.state.enrollments.find((r) => r.id === e.id).attempts.length, 1);
    eq((await qa.current(owner, id)).team.pending.filter((r) => r.enrollmentId === e.id).length, 1);
    for (const u of [owner, mod, b])
      ok(!JSON.stringify(await qa.current(u, id)).includes('READBACK-PRIVATE-' + a.id));
    qa.success(
      await qa.action(a, id, {
        type: 'draft',
        enrollmentId: e.id,
        fields: Object.fromEntries(
          Object.keys(fields).map((k) => [
            k,
            'Changed own unsent fictional draft after immutable read-back submission.',
          ]),
        ),
      }),
    );
    eq((await qa.current(a, id)).state.enrollments.find((r) => r.id === e.id).attempts.at(-1), attempt);
  });
  await scenario('legacy assisted:true remains readable without fabricated read-back approval', async () => {
    const { x, e, fields } = await completed(b),
      saved = qa.success(
        await qa.post(
          b,
          id,
          { type: 'submit', enrollmentId: e.id, fields, confirmed: true, assisted: true },
          x.revision,
        ),
      );
    const attempt = saved.state.enrollments.find((r) => r.id === e.id).attempts.at(-1);
    eq(attempt.assisted, true);
    eq(Object.hasOwn(attempt, 'assistance'), false);
  });
  await scenario(
    'directory trigger create accept/remove restore and failed token batch preserve membership',
    async () => {
      const u = qa.identity('integrated-directory-racer'),
        token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      qa.success(
        await qa.action(owner, id, { type: 'invite', email: u.email, roles: ['learner'], scopes: [], token }),
      );
      const preview = qa.success(await qa.get(u, '/api/teams?invite=' + token)),
        rev = preview.revision,
        acceptId = crypto.randomUUID(),
        memberId = crypto.randomUUID();
      const race = await Promise.all([
        qa.post(u, id, { type: 'accept', token }, rev, acceptId),
        qa.post(
          owner,
          id,
          { type: 'member', userId: b.id, roles: ['learner'], scopes: [], active: true },
          rev,
          memberId,
        ),
      ]);
      eq(race.map((r) => r.status).sort(), [200, 409]);
      let d = qa.success(await qa.get(u));
      eq(d.workspaces.filter((w) => w.id === id).length, race[0].status === 200 ? 1 : 0);
      if (race[0].status !== 200)
        qa.success(
          await qa.post(u, id, { type: 'accept', token }, (await qa.current(owner, id)).revision, acceptId),
        );
      d = qa.success(await qa.get(u));
      eq(d.workspaces.filter((w) => w.id === id).length, 1);
      eq(d.workspaces.find((w) => w.id === id).active, true);
      qa.success(
        await qa.action(owner, id, {
          type: 'member',
          userId: u.id,
          roles: ['learner'],
          scopes: [],
          active: false,
        }),
      );
      d = qa.success(await qa.get(u));
      eq(d.workspaces.filter((w) => w.id === id).length, 1);
      eq(d.workspaces.find((w) => w.id === id).active, false);
      eq(d.workspaces.find((w) => w.id === id).roles, []);
      eq((await qa.action(u, id, pref())).status, 403);
      qa.success(
        await qa.action(owner, id, {
          type: 'member',
          userId: u.id,
          roles: ['learner'],
          scopes: [],
          active: true,
        }),
      );
      eq(qa.success(await qa.get(u)).workspaces.find((w) => w.id === id).roles, ['learner']);
      const v = qa.identity('integrated-directory-other-owner'),
        created = qa.success(
          await qa.post(
            v,
            undefined,
            {
              type: 'create',
              name: 'Synthetic failed token target',
              purpose: 'A fictional workspace for atomic rollback with directory triggers.',
              context: 'msme',
            },
            0,
          ),
        );
      const old = qa.success(await qa.current(v, created.team.id)),
        before = qa.success(await qa.get(v));
      eq(
        (
          await qa.post(
            v,
            created.team.id,
            { type: 'invite', email: u.email, roles: ['learner'], scopes: [], token },
            old.revision,
          )
        ).status,
        409,
      );
      eq((await qa.current(v, created.team.id)).revision, old.revision);
      eq((await qa.get(v)).workspaces, before.workspaces);
      eq((await qa.get(u)).workspaces.filter((w) => w.id === created.team.id).length, 0);
    },
  );
  await scenario('real archive-boundary CAS and replay remain atomic after directory triggers', async () => {
    let x = qa.success(await qa.current(owner, id));
    while (x.team.activity.length < 200)
      x = qa.success(await qa.action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
    const rev = x.revision,
      commands = [
        { type: 'cohort-status', cohortId: cid, status: 'paused' },
        { type: 'cohort-status', cohortId: cid, status: 'closed' },
      ],
      ids = commands.map(() => crypto.randomUUID()),
      prior = qa.success(await qa.get(owner, '/api/teams/history?teamId=' + id));
    const race = await Promise.all(commands.map((c, i) => qa.post(owner, id, c, rev, ids[i])));
    eq(race.map((r) => r.status).sort(), [200, 409]);
    const winner = race.findIndex((r) => r.status === 200),
      h = qa.success(await qa.get(owner, '/api/teams/history?teamId=' + id));
    eq(h.asOfRevision, rev + 1);
    eq(h.packets.length, prior.packets.length + 1);
    eq(h.packets[0].revision, rev + 1);
    eq(h.packets[0].activity.length, 1);
    eq((await qa.get(a)).workspaces.filter((w) => w.id === id).length, 1);
    const replay = qa.success(await qa.post(owner, id, commands[winner], rev, ids[winner]));
    eq(replay.replayed, true);
    eq((await qa.get(owner, '/api/teams/history?teamId=' + id)).packets, h.packets);
    qa.success(await qa.action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
  });
}
