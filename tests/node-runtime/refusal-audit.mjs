// ACA-US-1.2 AC1/AC2 on the Node runtime: organisation A's evidence stays in A; a user from organisation B is
// refused A's workspace and the refusal is recorded with a pseudonymous reference only.
// Local only: run through scripts/node-local-qa.sh (server on 127.0.0.1:8787, throwaway database, synthetic users).
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const base = 'http://127.0.0.1:8787', nonce = crypto.randomUUID();
const a = {id: 'org-a-owner-' + nonce, email: 'a-' + nonce + '@academy.test'}, b = {id: 'org-b-owner-' + nonce, email: 'b-' + nonce + '@academy.test'};
const headers = u => ({'content-type': 'application/json', 'oai-authenticated-user-id': u.id, 'oai-authenticated-user-email': u.email});
const post = async (u, teamId, command, revision) => {
  const r = await fetch(base + '/api/teams', {method: 'POST', headers: headers(u), body: JSON.stringify({teamId, command, revision, actionId: crypto.randomUUID()})});
  return {status: r.status, ...await r.json()};
};
const get = async (u, path) => { const r = await fetch(base + path, {headers: headers(u)}); return {status: r.status, body: await r.text()}; };
let checks = 0; const eq = (x, y) => { assert.deepEqual(x, y); checks++; };

const created = await post(a, undefined, {type: 'create', name: 'Organisation A pilot', purpose: 'A synthetic workspace for the refusal audit check.', context: 'msme'}, 0);
eq(created.status, 200); const teamA = created.team.id;
const createdB = await post(b, undefined, {type: 'create', name: 'Organisation B pilot', purpose: 'A second synthetic workspace for the refusal audit check.', context: 'msme'}, 0);
eq(createdB.status, 200);
eq((await get(a, '/api/teams?id=' + teamA)).status, 200); // A reads its own workspace

const db = new DatabaseSync(process.env.ACADEMY_DATABASE_PATH);
const count = () => db.prepare('SELECT count(*) n FROM academy_access_refusals').get().n;
const before = count();
for (const path of ['/api/teams?id=' + teamA, '/api/teams/history?teamId=' + teamA, '/api/teams/audit?teamId=' + teamA]) {
  const r = await get(b, path);
  assert.ok([403, 404].includes(r.status), path + ' -> ' + r.status); checks++;
  eq(r.body.includes('Organisation A pilot'), false); // no data from A in the refusal
}
const rows = db.prepare('SELECT actor_ref, route, method, status FROM academy_access_refusals ORDER BY id DESC LIMIT 3').all();
eq(count() - before, 3);
for (const row of rows) {
  eq(/^a-[0-9a-f]{12}$/.test(row.actor_ref), true); // pseudonymous reference
  eq(JSON.stringify(row).includes(b.id) || JSON.stringify(row).includes(teamA), false); // no user ID or workspace ID stored
}
console.log(JSON.stringify({checks, passed: true, coverage: ['org A reads own workspace', 'org B refused on 3 routes', 'refusals recorded pseudonymously', 'no org A data in refusals']}));
