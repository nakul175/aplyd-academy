import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST, env, setIdentity } from '../.sites-runtime/record-qa/record-route.mjs';
import {
  ws,
  owner,
  learner,
  reviewer,
  other,
  personal,
  shared,
  ownBody,
  decisionBody,
} from './record-fixtures.mjs';
function db(rows) {
  const calls = [];
  const source = [...rows];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async first() {
              if (!source.length) throw new Error('Unexpected read');
              const next = source.shift();
              if (next instanceof Error) throw next;
              return typeof next === 'function' ? next() : structuredClone(next);
            },
          };
        },
      };
    },
  };
}
const row = (state) => ({ data: JSON.stringify(state), revision: 8 });
function setup(rows, user = learner) {
  env.DB = db(rows);
  setIdentity(user);
  return env.DB;
}
const request = (body, headers = {}) =>
  new Request('https://academy.test/api/academy/records/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://academy.test', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
test('pure route host mocks: current own exact record reads only trusted owner and revision then returns no-store', async () => {
  const s = personal(),
    database = setup([row(s), { revision: 8 }]),
    r = await POST(request(ownBody(s))),
    data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(data.currentUserId, 'learner');
  assert.equal(data.result.snapshot.recordId, s.enrollments[0].record.id);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
  assert.equal(database.calls.length, 2);
  assert.ok(database.calls.every((c) => c.sql.startsWith('SELECT ')));
  assert.deepEqual(
    database.calls.map((c) => c.args),
    [['learner'], ['learner']],
  );
  assert.ok(database.calls.every((c) => !c.sql.includes('INSERT') && !c.sql.includes('UPDATE')));
});
test('read-only POST rejects cross-origin and non-JSON before protected reads', async () => {
  const s = personal();
  for (const headers of [{ Origin: 'https://other.test' }, { 'Content-Type': 'text/plain' }]) {
    const database = setup([]),
      r = await POST(request(ownBody(s), headers));
    assert.ok([403, 415].includes(r.status));
    assert.equal(database.calls.length, 0);
  }
});
test('malformed/oversized JSON and caller learner ID produce standard sanitized failures with no reads', async () => {
  const s = personal();
  for (const body of ['{', 'x'.repeat(2001), { ...ownBody(s), learnerId: 'other' }]) {
    const database = setup([]),
      r = await POST(request(body));
    assert.ok([400, 413].includes(r.status));
    assert.equal(database.calls.length, 0);
    assert.ok(typeof (await r.json()).error === 'string');
  }
});
test('missing sign-in and unavailable DB return 401/503 without any data', async () => {
  const s = personal(),
    database = setup([], null);
  let r = await POST(request(ownBody(s)));
  assert.equal(r.status, 401);
  assert.equal(database.calls.length, 0);
  setIdentity(learner);
  env.DB = null;
  r = await POST(request(ownBody(s)));
  assert.equal(r.status, 503);
  assert.deepEqual(Object.keys(await r.json()), ['error']);
});
test('changed revision before check and during awaited digest return plain409 with no snapshot', async () => {
  const s = personal();
  for (const rows of [[{ ...row(s), revision: 9 }], [row(s), { revision: 9 }]]) {
    const database = setup(rows),
      r = await POST(request(ownBody(s)));
    assert.equal(r.status, 409);
    const body = await r.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.match(body.error, /changed/);
    assert.ok(database.calls.every((c) => c.sql.startsWith('SELECT ')));
  }
});
test('unknown personal exact record is masked404 and never writes an audit event', async () => {
  const database = setup([row(personal())]),
    r = await POST(request({ workspaceId: null, sourceRevision: 8, recordId: 'missing' }));
  assert.equal(r.status, 404);
  assert.deepEqual(Object.keys(await r.json()), ['error']);
  assert.equal(database.calls.length, 1);
});
test('actual canonical shared projection allows only currently assigned original appeal decision', async () => {
  const t = shared(true),
    database = setup([row(t), { revision: 8 }], reviewer),
    r = await POST(request(decisionBody(t))),
    data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.currentUserId, 'reviewer');
  assert.equal(data.result.snapshot.kind, 'private-assigned-original-decision');
  assert.equal(data.result.snapshot.decision.actorRef, 'owner');
  assert.ok(!('status' in data.result.snapshot));
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
  assert.deepEqual(
    database.calls.map((c) => c.args),
    [[ws], [ws]],
  );
});
test('outsider and historical original assessor cannot read record or assigned-original body', async () => {
  const t = shared(true);
  for (const user of [other, owner]) {
    const database = setup([row(t)], user),
      r = await POST(request(decisionBody(t)));
    assert.equal(r.status, 404);
    assert.deepEqual(Object.keys(await r.json()), ['error']);
    assert.equal(database.calls.length, 1);
  }
});
test('deleted shared row between hash and reply forces plain409', async () => {
  const t = shared(true),
    database = setup([row(t), null], reviewer),
    r = await POST(request(decisionBody(t)));
  assert.equal(r.status, 409);
  assert.deepEqual(Object.keys(await r.json()), ['error']);
  assert.equal(database.calls.length, 2);
});
test('invalid saved JSON and database exception are sanitized503 without evidence or exception text', async () => {
  const s = personal();
  for (const rows of [
    [{ data: 'PRIVATE_NOT_VALID_JSON', revision: 8 }],
    [new Error('PRIVATE_DATABASE_EXCEPTION')],
  ]) {
    setup(rows);
    const r = await POST(request(ownBody(s))),
      body = await r.json();
    assert.equal(r.status, 503);
    assert.deepEqual(Object.keys(body), ['error']);
    assert.ok(!JSON.stringify(body).includes('PRIVATE_'));
  }
});
test('malformed canonical revision is503 and check never advances it', async () => {
  const s = personal(),
    database = setup([{ ...row(s), revision: '8' }]),
    r = await POST(request(ownBody(s)));
  assert.equal(r.status, 503);
  assert.equal(database.calls.length, 1);
});
test('unknown exact content pin reports unavailable and retains own raw saved object untouched', async () => {
  const s = personal();
  s.enrollments[0].version = 'unknown';
  s.enrollments[0].contentRef.versionId = 'unknown';
  s.enrollments[0].record.contentVersion = 'unknown';
  const before = JSON.stringify(s),
    database = setup([row(s), { revision: 8 }]),
    r = await POST(request(ownBody(s))),
    data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.result.outcome, 'unavailable');
  assert.ok(!('snapshot' in data.result));
  assert.equal(JSON.stringify(s), before);
  assert.equal(database.calls.length, 2);
});
