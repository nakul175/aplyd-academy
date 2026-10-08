import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const app = resolve(process.env.ACADEMY_APP_PATH ?? process.cwd()),
  here = dirname(fileURLToPath(import.meta.url)),
  out = resolve(process.env.ACADEMY_ACCEPTANCE_QA_OUT ?? app + '/.sites-runtime/eight-hour/api-evidence');
mkdirSync(out, { recursive: true });
process.env.ACADEMY_APP_PATH = app;
const { acceptAcademyPayload: accept, acceptAcademyDirectory: directory } = await import(
  pathToFileURL(
    process.env.ACADEMY_ACCEPTANCE_MODULE ??
      app + '/.sites-runtime/eight-hour/runtime/academy-acceptance.mjs',
  )
);
if (!process.env.ACADEMY_QA_WORKER)
  throw new Error('Set ACADEMY_QA_WORKER to the root-confirmed stable Worker session.');
const { extension } = await import('./api-extension.mjs');
const originalFetch = globalThis.fetch,
  requests = [],
  accepted = [],
  scenarios = [];
let checks = 0,
  fixture;
const eq = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  },
  ok = (x, message) => {
    assert.ok(x, message);
    checks++;
  };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  const method = init.method ?? 'GET',
    h = new Headers(init.headers),
    actor = h.get('oai-authenticated-user-id'),
    body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  const response = await originalFetch(input, init);
  requests.push({
    method,
    path: url.pathname,
    command: body?.command?.type ?? null,
    status: response.status,
  });
  if (response.ok) {
    const data = await response.clone().json();
    let result;
    if (url.pathname === '/api/academy')
      result = accept(
        data,
        method === 'POST'
          ? { mode: 'write', workspace: 'lab', accountId: actor, sourceRevision: body.revision }
          : { mode: 'read', workspace: 'lab' },
        response.status,
      );
    else if (url.pathname === '/api/teams' && method === 'POST')
      result = accept(
        data,
        {
          mode: 'write',
          workspace: 'team',
          accountId: actor,
          teamId: body.teamId,
          commandType: body.command.type,
          actionId: body.actionId,
          sourceRevision: body.command.type === 'create' ? 0 : body.revision,
        },
        response.status,
      );
    else if (url.pathname === '/api/teams' && url.searchParams.has('id'))
      result = accept(
        data,
        { mode: 'read', workspace: 'team', teamId: url.searchParams.get('id') },
        response.status,
      );
    else if (url.pathname === '/api/teams' && !url.search) result = directory(data, actor, response.status);
    if (result) {
      checks++;
      accepted.push({
        method,
        path: url.pathname,
        command: body?.command?.type ?? null,
        workspace: result.team?.id ?? (data.user ? 'directory' : 'lab'),
        stateUnmodified: result.serverState ? result.serverState === data.state : null,
      });
    }
  }
  return response;
};
const qa = await import(pathToFileURL(app + '/tests/local-qa.mjs'));
async function scenario(name, fn) {
  const start = checks;
  await fn();
  scenarios.push({ name, passed: true, checks: checks - start });
}
try {
  await scenario('real create/cohorts/invitations/acceptance and nonempty learner state', async () => {
    fixture = await qa.fixture();
    for (const u of [fixture.owner, fixture.a, fixture.b, fixture.mod]) {
      const x = qa.success(await qa.current(u, fixture.id));
      eq(x.team.currentUserId, u.id);
      eq(x.team.id, fixture.id);
    }
    ok(qa.success(await qa.current(fixture.a, fixture.id)).state.enrollments.length === 1);
  });
  const { owner, a, b, mod, id, cid, p } = fixture;
  await scenario('real personal read and acknowledged profile write', async () => {
    const before = qa.success(await qa.get(a, '/api/academy'));
    const response = await fetch(qa.base + '/api/academy', {
      method: 'POST',
      headers: qa.headers(a),
      body: JSON.stringify({
        command: { type: 'profile', ...before.state.profile, name: 'Synthetic compatibility reader' },
        revision: before.revision,
        actionId: crypto.randomUUID(),
      }),
    });
    eq(response.status, 200);
    const data = await response.json();
    eq(data.currentUserId, a.id);
    eq(data.revision, before.revision + 1);
  });
  await scenario('actual private publication after independent owner review', async () => {
    qa.success(
      await qa.action(owner, id, {
        type: 'member',
        userId: mod.id,
        roles: ['admin'],
        scopes: [],
        active: true,
      }),
    );
    let x = qa.success(
        await qa.action(owner, id, {
          type: 'content-copy',
          sourceRef: { scope: 'global', programId: p.id, versionId: '0.1-review-draft' },
        }),
      ),
      d = x.team.content.drafts.at(-1);
    x = qa.success(
      await qa.action(owner, id, {
        type: 'content-submit',
        draftId: d.id,
        revision: d.revision,
        reviewerId: mod.id,
        reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      }),
    );
    d = x.team.content.drafts.find((r) => r.id === d.id);
    x = qa.success(
      await qa.action(mod, id, {
        type: 'content-review',
        draftId: d.id,
        revision: d.revision,
        decision: 'approve',
        checks: { sources: true, answers: true, rubric: true, safety: true, accessibility: true },
        note: 'Independent synthetic review checked fictional references, answer keys, assessment anchors, bounded safety and accessible instructions.',
      }),
    );
    d = x.team.content.drafts.find((r) => r.id === d.id);
    x = qa.success(
      await qa.action(owner, id, { type: 'content-publish', draftId: d.id, revision: d.revision }),
    );
    d = x.team.content.drafts.find((r) => r.id === d.id);
    const ref = d.publishedRef;
    eq(x.contentVersions.length, 1);
    eq(x.contentVersions[0].ref, ref);
    ok(x.contentVersions[0].program.id !== p.id);
    x = qa.success(
      await qa.action(owner, id, {
        type: 'cohort-create',
        title: 'Synthetic private pinned compatibility circle',
        programId: ref.programId,
        contentRef: ref,
        capacity: 10,
      }),
    );
    const c = x.team.cohorts.at(-1);
    x = qa.success(await qa.action(a, id, { type: 'enroll', programId: ref.programId, cohortId: c.id }));
    eq(x.state.enrollments.at(-1).contentRef, ref);
    eq(x.contentVersions[0].ref, ref);
  });
  let requestId, sessionId;
  await scenario('real support own/metadata/assigned projections', async () => {
    const body =
      'LOCAL-SUPPORT-CANARY: a fictional source-checking question without real restricted records.';
    let x = qa.success(
      await qa.action(a, id, {
        type: 'support-open',
        category: 'learning',
        cohortId: cid,
        subject: 'Synthetic learning source question',
        body,
        audienceAcknowledged: true,
      }),
    );
    requestId = x.team.support.mine.at(-1).id;
    eq(x.team.support.mine.at(-1).messages[0].body, body);
    x = qa.success(await qa.current(owner, id));
    ok(x.team.support.queue.some((r) => r.id === requestId));
    ok(!JSON.stringify(x).includes(body));
    x = qa.success(await qa.action(owner, id, { type: 'support-claim', requestId }));
    ok(x.team.support.assigned.some((r) => r.id === requestId));
    ok(JSON.stringify(x.team.support.assigned).includes(body));
    qa.success(
      await qa.action(owner, id, {
        type: 'support-reply',
        requestId,
        body: 'A fictional checked-source response in the assigned handler thread.',
      }),
    );
    qa.success(await qa.current(a, id));
    qa.success(await qa.current(b, id));
  });
  await scenario('actual network host/participant/peer/own history', async () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString(),
      endsAt = new Date(Date.now() + 7200000).toISOString();
    let x = qa.success(
      await qa.action(owner, id, {
        type: 'session-create',
        cohortId: cid,
        title: 'Synthetic compatibility practice',
        description: 'A fictional local practice session for checked source drafts.',
        instructions: 'LOCAL-JOIN-CANARY: fictional local classroom only.',
        startsAt,
        endsAt,
        capacity: 5,
      }),
    );
    sessionId = x.team.network.sessions.at(-1).id;
    x = qa.success(await qa.action(a, id, { type: 'session-rsvp', sessionId, going: true }));
    ok(x.team.network.sessions.find((s) => s.id === sessionId).instructions.includes('LOCAL-JOIN-CANARY'));
    ok(x.team.network.history.length === 1);
    x = qa.success(await qa.current(owner, id));
    eq(x.team.network.sessions.find((s) => s.id === sessionId).registrations.length, 1);
    x = qa.success(await qa.current(b, id));
    ok(!JSON.stringify(x).includes('LOCAL-JOIN-CANARY'));
    qa.success(
      await qa.action(a, id, {
        type: 'network-profile',
        enabled: true,
        bio: 'I practise checking fictional source packets and safe local drafts.',
        focus: 'Checking AI drafts',
        cohortIds: [cid],
      }),
    );
    x = qa.success(await qa.current(b, id));
    ok(x.team.network.directory.length === 1);
  });
  await extension({ qa, fixture, scenario, eq, ok });
  await scenario('removed own learning/thread/history and directory remain compatible', async () => {
    const prior = qa.success(await qa.current(a, id)),
      enrollments = prior.state.enrollments;
    qa.success(
      await qa.action(owner, id, {
        type: 'member',
        userId: a.id,
        roles: ['learner'],
        scopes: [],
        active: false,
      }),
    );
    const x = qa.success(await qa.current(a, id));
    eq(x.team.active, false);
    eq(x.team.roles, []);
    eq(x.state.enrollments, enrollments);
    eq(x.team.network.sessions, []);
    ok(x.team.network.history.length === 1);
    ok(x.team.support.mine.some((r) => r.id === requestId));
    eq(x.team.support.assigned, []);
    const dirs = qa.success(await qa.get(a));
    const row = dirs.workspaces.find((w) => w.id === id);
    eq(row.active, false);
    eq(row.roles, []);
    const denied = await qa.action(a, id, { type: 'network-profile', enabled: false });
    eq(denied.status, 403);
    eq(qa.success(await qa.current(a, id)).state.enrollments, enrollments);
    for (const u of [owner, a, b, mod]) qa.success(await qa.get(u));
  });
  const files = [
    'app/academy-response.ts',
    'app/academy.tsx',
    'lib/academy-curriculum.ts',
    'lib/academy-teams.ts',
  ];
  const result = {
    passed: true,
    at: new Date().toISOString(),
    worker: process.env.ACADEMY_QA_WORKER ?? 'unknown',
    checks,
    actualApiCalls: requests.length,
    acceptedSuccessfulResponses: accepted.length,
    scenarios,
    requests,
    accepted,
    fixtureId: fixture.id,
    sourceSha256: Object.fromEntries(
      files.map((f) => [
        f,
        createHash('sha256')
          .update(readFileSync(app + '/' + f))
          .digest('hex'),
      ]),
    ),
    candidateBundleSha256: createHash('sha256')
      .update(
        readFileSync(
          process.env.ACADEMY_ACCEPTANCE_MODULE ??
            app + '/.sites-runtime/eight-hour/runtime/academy-acceptance.mjs',
        ),
      )
      .digest('hex'),
    limits: [
      'Parent-confirmed stable local Worker; unique synthetic identities and fictional records only.',
      'Actual integrated current checkout acceptance is also executed separately against real API bodies; browser execution covers the integrated shell.',
      'Source hashes do not independently establish Worker bundle identity; ACADEMY_QA_WORKER records root-confirmed stable integrated build.',
      'No checkout edit, SQL mutation, restart, hosted call, invitation delivery or provider AI action.',
    ],
  };
  writeFileSync(out + '/integrated-api-result.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      actualApiCalls: requests.length,
      acceptedResponses: accepted.length,
      scenarios: scenarios.length,
    }),
  );
} catch (error) {
  writeFileSync(
    out + '/integrated-api-result.json',
    JSON.stringify(
      {
        passed: false,
        at: new Date().toISOString(),
        worker: process.env.ACADEMY_QA_WORKER ?? 'unknown',
        checks,
        actualApiCalls: requests.length,
        acceptedSuccessfulResponses: accepted.length,
        scenarios,
        requests,
        fixtureId: fixture?.id,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  globalThis.fetch = originalFetch;
}
