import assert from 'node:assert/strict';
import {
  identityFixture,
  base,
  headers,
  current,
  action,
  post,
  get,
  success,
  personalRead,
  personalPost,
  record,
} from './identity-fixture.mjs';

const scenarios = [],
  startedAt = new Date().toISOString();
let f;
async function test(name, fn) {
  try {
    await fn();
    scenarios.push({ name, passed: true });
  } catch (error) {
    scenarios.push({ name, passed: false, error: String(error) });
    throw error;
  }
}
try {
  f = await identityFixture();
  const { a, b, other, id, names, da } = f;
  await test('canonical subjects in private GET, directory and shared projections', async () => {
    for (const u of [a, b]) {
      const personal = success(await personalRead(u)),
        directory = success(await get(u)),
        shared = success(await current(u, id));
      assert.equal(personal.currentUserId, u.id);
      assert.equal(directory.user.id, u.id);
      assert.equal(shared.team.currentUserId, u.id);
      assert.ok(directory.workspaces.some((w) => w.id === id && w.active));
    }
    assert.equal((await personalRead(a)).state.profile.name, names.a);
    assert.equal((await personalRead(b)).state.profile.name, names.b);
    assert.ok(!JSON.stringify(await personalRead(b)).includes(names.a));
    assert.ok(!JSON.stringify(await personalRead(a)).includes(names.b));
    assert.equal((await current(a, id)).state.profile.name, names.sharedA);
    assert.equal((await current(b, id)).state.profile.name, names.sharedB);
  });
  await test('private writes and idempotent replay retain the signed-in subject', async () => {
    const x = success(await personalRead(a)),
      command = { type: 'profile', ...x.state.profile, name: names.a + ' replay' },
      event = crypto.randomUUID();
    const written = success(await personalPost(a, command, x.revision, event)),
      replayed = success(await personalPost(a, command, x.revision, event));
    assert.equal(written.currentUserId, a.id);
    assert.equal(replayed.currentUserId, a.id);
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.revision, written.revision);
    const y = success(await personalRead(b)),
      ownCommand = { type: 'profile', ...y.state.profile };
    const independent = success(await personalPost(b, ownCommand, y.revision, event));
    assert.equal(independent.currentUserId, b.id);
    assert.notEqual(independent.replayed, true);
    assert.equal(independent.state.profile.name, names.b);
    assert.ok(!JSON.stringify(independent).includes(command.name));
  });
  await test('shared acknowledged write and replay expose only current actor projection', async () => {
    const x = success(await current(a, id)),
      command = { type: 'profile', ...x.state.profile, name: names.sharedA + ' replay' },
      event = crypto.randomUUID();
    const written = success(await post(a, id, command, x.revision, event)),
      replayed = success(await post(a, id, command, x.revision, event));
    assert.equal(written.team.currentUserId, a.id);
    assert.equal(replayed.team.currentUserId, a.id);
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.revision, written.revision);
    const y = success(await current(b, id));
    assert.equal(y.team.currentUserId, b.id);
    assert.equal(y.state.profile.name, names.sharedB);
  });
  await test('unjoined reads fail closed and anonymous reads return no saved projection', async () => {
    const foreign = await current(other, id);
    assert.equal(foreign.status, 404);
    assert.ok(!foreign.team && !foreign.state);
    assert.ok(!JSON.stringify(foreign).includes(da.document.title));
    for (const path of ['/api/academy', '/api/teams', '/api/teams?id=' + id]) {
      const r = await fetch(base + path),
        data = await r.json();
      assert.equal(r.status, 401, JSON.stringify(data));
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.ok(!data.team && !data.state && !data.workspaces);
      for (const canary of [names.a, names.b, names.sharedA, da.document.title])
        assert.ok(!JSON.stringify(data).includes(canary));
    }
  });
  await test('same subject loses owner source projection until legitimate authority returns', async () => {
    success(
      await action(b, id, { type: 'member', userId: a.id, roles: ['learner'], scopes: [], active: true }),
    );
    const restricted = success(await current(a, id));
    assert.equal(restricted.team.currentUserId, a.id);
    assert.ok(!restricted.team.roles.includes('admin'));
    assert.ok(!restricted.team.content);
    assert.ok(!JSON.stringify(restricted).includes(da.document.title));
    success(
      await action(b, id, {
        type: 'member',
        userId: a.id,
        roles: ['admin', 'learner'],
        scopes: [],
        active: true,
      }),
    );
    const restored = success(await current(a, id));
    assert.equal(restored.team.currentUserId, a.id);
    assert.ok(restored.team.roles.includes('admin'));
    assert.equal(restored.team.content.drafts.find((d) => d.id === da.id).document.title, da.document.title);
  });
  const result = {
    passed: true,
    startedAt,
    completedAt: new Date().toISOString(),
    fixtureId: id,
    scenarios,
    limits: [
      'Loopback Worker with fictional identities and data only',
      'Subject headers are a local test authentication convention, not hosted sign-in validation',
      'API tests do not prove browser memory masking or real identity-provider transitions',
    ],
  };
  record('identity-api-result.json', result);
  console.log(JSON.stringify(result));
} catch (error) {
  record('identity-api-result.json', {
    passed: false,
    startedAt,
    fixtureId: f?.id,
    scenarios,
    error: String(error),
  });
  throw error;
}
