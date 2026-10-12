import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrivateRecordChecker,
  RecordClientError,
  checkSavedPracticeRecord,
  parseRecordCheckRequest,
  curriculumRegistry,
  workspaceRegistry,
  applyTeamCommand,
  projectTeam,
} from '../.sites-runtime/record-qa/record-check.mjs';
import {
  ws,
  time,
  checkedAt,
  owner,
  learner,
  reviewer,
  personal,
  shared,
  ownBody,
  decisionBody,
} from './record-fixtures.mjs';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const envelope = (user, state, body) =>
  checkSavedPracticeRecord({
    user,
    row: { data: JSON.stringify(state), revision: 8 },
    request: parseRecordCheckRequest(body),
    checkedAt,
  });
async function harness() {
  const s = personal(),
    saved = await envelope(learner, s, ownBody(s));
  let live = {
    accountId: 'learner',
    workspace: 'lab',
    authorityEpoch: 1,
    sourceRevision: 8,
    readGeneration: 3,
    mounted: true,
    loading: false,
    saving: false,
    state: s,
    team: null,
    content: { registry: curriculumRegistry, allowedScopes: ['global'] },
  };
  const calls = [],
    masked = [],
    refresh = [];
  const target = { recordId: s.enrollments[0].record.id };
  return {
    s,
    saved,
    target,
    calls,
    masked,
    refresh,
    get live() {
      return live;
    },
    change(value) {
      live = { ...live, ...value };
    },
    checker(transport) {
      return createPrivateRecordChecker({
        getContext: () => live,
        transport: (url, init) => {
          calls.push({ url, init });
          return transport(url, init);
        },
        onUnverifiedAccess: (status) => masked.push(status),
        onRefreshRequired: (message) => refresh.push(message),
      });
    },
  };
}
test('client read sends exact target/current revision with same-origin credentials and no-store; no authority fields', async () => {
  const h = await harness(),
    check = h.checker(async () => Response.json(h.saved));
  const r = await check(h.target, new AbortController().signal);
  assert.equal(r.outcome, 'checked');
  assert.equal(h.calls.length, 1);
  const c = h.calls[0];
  assert.equal(c.url, '/api/academy/records/check');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.credentials, 'same-origin');
  assert.equal(c.init.cache, 'no-store');
  assert.deepEqual(JSON.parse(c.init.body), ownBody(h.s));
  assert.equal(h.masked.length, 0);
});
test('account/workspace/epoch/revision/read generation/loading/save transitions fence before transport after source hashing', async () => {
  for (const change of [
    { accountId: 'other' },
    { workspace: ws },
    { authorityEpoch: 2 },
    { sourceRevision: 9 },
    { readGeneration: 4 },
    { mounted: false },
    { loading: true },
    { saving: true },
  ]) {
    const h = await harness(),
      check = h.checker(async () => Response.json(h.saved));
    const pending = check(h.target, new AbortController().signal);
    h.change(change);
    await assert.rejects(pending, (e) => e instanceof RecordClientError && e.stale);
    assert.equal(h.calls.length, 0);
    assert.equal(h.masked.length, 0);
  }
});
test('response arriving after account/workspace/revision change is discarded without masking the new account', async () => {
  for (const change of [
    { accountId: 'other' },
    { workspace: ws },
    { authorityEpoch: 2 },
    { sourceRevision: 9 },
    { mounted: false },
  ]) {
    const h = await harness(),
      started = deferred(),
      reply = deferred();
    const check = h.checker(async () => {
      started.resolve();
      return reply.promise;
    });
    const pending = check(h.target, new AbortController().signal);
    await started.promise;
    h.change(change);
    reply.resolve(Response.json(h.saved));
    await assert.rejects(pending, (e) => e.stale);
    assert.equal(h.masked.length, 0);
  }
});
test('scope changing during JSON parsing prevents late authorization denial from masking new workspace', async () => {
  const h = await harness(),
    jsonStarted = deferred(),
    body = deferred(),
    response = Response.json({ error: 'Removed' }, { status: 403 });
  response.json = () => {
    jsonStarted.resolve();
    return body.promise;
  };
  const pending = h.checker(async () => response)(h.target, new AbortController().signal);
  await jsonStarted.promise;
  h.change({ workspace: ws });
  body.resolve({ error: 'Removed' });
  await assert.rejects(pending, (e) => e.stale);
  assert.equal(h.masked.length, 0);
});
test('aborted/unmounted widget fences before transport or discards an already sent response', async () => {
  let h = await harness(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    h.checker(async () => Response.json(h.saved))(h.target, controller.signal),
    (e) => e.stale,
  );
  assert.equal(h.calls.length, 0);
  h = await harness();
  controller = new AbortController();
  const started = deferred(),
    reply = deferred(),
    pending = h.checker(async () => {
      started.resolve();
      return reply.promise;
    })(h.target, controller.signal);
  await started.promise;
  controller.abort();
  reply.resolve(Response.json(h.saved));
  await assert.rejects(pending, (e) => e.stale);
  assert.equal(h.masked.length, 0);
});
test('401/403/404 from current scope mask private authority while a plain changed-revision409 requests refresh', async () => {
  for (const status of [401, 403, 404, 409]) {
    const h = await harness();
    await assert.rejects(
      h.checker(async () => Response.json({ error: 'Refresh saved state.' }, { status }))(
        h.target,
        new AbortController().signal,
      ),
      (e) => e.status === status,
    );
    assert.deepEqual(h.masked, status === 409 ? [] : [status]);
    assert.equal(h.refresh.length, status === 409 ? 1 : 0);
  }
});
test('non-JSON successful response masks unverifiable access; non-JSON503 retains current scope and never retries', async () => {
  for (const status of [200, 503]) {
    const h = await harness();
    await assert.rejects(
      h.checker(async () => new Response('<html>PRIVATE_GATEWAY</html>', { status }))(
        h.target,
        new AbortController().signal,
      ),
      (e) => e.status === status && !e.message.includes('PRIVATE_GATEWAY'),
    );
    assert.deepEqual(h.masked, status === 200 ? [200] : []);
    assert.equal(h.calls.length, 1);
  }
});
test('wrong subject/exact record/checksum successful response masks authority and does not publish a result', async () => {
  for (const change of [
    (x) => (x.currentUserId = 'other'),
    (x) => (x.target.id = 'other-record'),
    (x) => (x.result.integrity.checksum = '0'.repeat(64)),
  ]) {
    const h = await harness(),
      response = structuredClone(h.saved);
    change(response);
    await assert.rejects(
      h.checker(async () => Response.json(response))(h.target, new AbortController().signal),
      (e) => e.unverified,
    );
    assert.deepEqual(h.masked, [200]);
  }
});
test('network failure has no retry and no fabricated read result or account mask', async () => {
  const h = await harness();
  await assert.rejects(
    h.checker(async () => {
      throw new TypeError('Network unavailable');
    })(h.target, new AbortController().signal),
  );
  assert.equal(h.calls.length, 1);
  assert.equal(h.masked.length, 0);
  assert.equal(h.refresh.length, 0);
});
test('inactive shared learner can check retained own history: saving flag, not mutation-disabled busy flag', async () => {
  let t = shared();
  t = applyTeamCommand(
    t,
    owner,
    { type: 'member', userId: 'learner', roles: ['learner'], scopes: [], active: false },
    time(6),
  );
  const projection = projectTeam(t, learner),
    state = projection.state,
    saved = await envelope(learner, t, ownBody(state, ws));
  const live = {
    accountId: 'learner',
    workspace: ws,
    authorityEpoch: 1,
    sourceRevision: 8,
    readGeneration: 3,
    mounted: true,
    loading: false,
    saving: false,
    state,
    team: projection.team,
    content: { registry: workspaceRegistry(t), allowedScopes: ['global', ws] },
  };
  let sent = 0;
  const check = createPrivateRecordChecker({
    getContext: () => live,
    transport: async () => {
      sent++;
      return Response.json(saved);
    },
    onUnverifiedAccess: () => assert.fail('No access mask expected'),
    onRefreshRequired: () => {},
  });
  assert.equal(
    (await check({ recordId: state.enrollments[0].record.id }, new AbortController().signal)).outcome,
    'checked',
  );
  assert.equal(sent, 1);
});
test('current assigned appeal client checks exact original only; deleted assignment blocks transport', async () => {
  const t = shared(true),
    projection = projectTeam(t, reviewer),
    saved = await envelope(reviewer, t, decisionBody(t));
  let live = {
    accountId: 'reviewer',
    workspace: ws,
    authorityEpoch: 1,
    sourceRevision: 8,
    readGeneration: 3,
    mounted: true,
    loading: false,
    saving: false,
    state: projection.state,
    team: projection.team,
    content: { registry: workspaceRegistry(t), allowedScopes: ['global', ws] },
  };
  let sent = 0;
  const check = createPrivateRecordChecker({
    getContext: () => live,
    transport: async () => {
      sent++;
      return Response.json(saved);
    },
    onUnverifiedAccess: () => assert.fail('No mask expected'),
    onRefreshRequired: () => {},
  });
  const target = { decisionId: t.learners[0].state.enrollments[0].attempts[0].decision.id };
  assert.equal(
    (await check(target, new AbortController().signal)).snapshot.kind,
    'private-assigned-original-decision',
  );
  live = { ...live, team: { ...live.team, assigned: [] } };
  await assert.rejects(check(target, new AbortController().signal), (e) => e.status === 404);
  assert.equal(sent, 1);
});
test('unknown pin and invalid target do not select newest source or send a request', async () => {
  const h = await harness();
  h.s.enrollments[0].contentRef.versionId = 'unknown';
  h.s.enrollments[0].version = 'unknown';
  await assert.rejects(
    h.checker(async () => Response.json(h.saved))(h.target, new AbortController().signal),
    (e) => e.status === 409,
  );
  assert.equal(h.calls.length, 0);
  const k = await harness();
  await assert.rejects(
    k.checker(async () => Response.json(k.saved))(
      { ...k.target, learnerId: 'other' },
      new AbortController().signal,
    ),
    (e) => e.status === 400,
  );
  assert.equal(k.calls.length, 0);
});
