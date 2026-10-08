import assert from 'node:assert/strict';
import { writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fixture, app, current, action, post, get, success } from './local-qa.mjs';
const { owner, a, mod, id, cid, otherCid } = await fixture();
let checks = 0;
const eq = (x, y) => {
    assert.deepEqual(x, y);
    checks++;
  },
  ok = (x) => {
    assert.ok(x);
    checks++;
  };
const history = (u, before) =>
  get(u, '/api/teams/history?teamId=' + id + (before ? '&before=' + before : ''));
eq((await history(a)).status, 403);
eq((await get(owner, '/api/teams/history?teamId=' + id + '&before=not-a-number')).status, 400);
let x = success(await current(owner, id));
// Fill history exclusively through supported local API actions. This exercises
// production serialization and D1 batching rather than manually seeding state.
while (x.team.activity.length < 200)
  x = success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
eq(x.team.activity.length, 200);
eq(success(await history(owner)).packets.length, 0);
const rev = x.revision,
  commands = [
    { type: 'cohort-status', cohortId: cid, status: 'closed' },
    { type: 'cohort-status', cohortId: cid, status: 'paused' },
  ],
  actionIds = [crypto.randomUUID(), crypto.randomUUID()];
const race = await Promise.all(commands.map((c, i) => post(owner, id, c, rev, actionIds[i])));
eq(race.map((r) => r.status).sort(), [200, 409]);
const winningIndex = race[0].status === 200 ? 0 : 1,
  losingIndex = 1 - winningIndex;
let h = success(await history(owner));
eq(h.asOfRevision, rev + 1);
eq(h.packets.length, 1);
eq(h.packets[0].revision, rev + 1);
eq(h.packets[0].activity.length, 1);
eq(h.packets[0].moderation.length, 0);
eq(success(await current(owner, id)).team.activity.length, 200);
const replay = success(await post(owner, id, commands[winningIndex], rev, actionIds[winningIndex]));
eq(replay.replayed, true);
eq(success(await history(owner)).packets.length, 1);
// Retrying the losing operation with a fresh current revision creates precisely
// its own next archive packet. The initial CAS loss cannot reserve its action ID.
success(await post(owner, id, commands[losingIndex], rev + 1, actionIds[losingIndex]));
h = success(await history(owner));
eq(h.packets.length, 2);
eq(h.packets[0].revision, rev + 2);
success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
success(
  await action(owner, id, {
    type: 'member',
    userId: owner.id,
    roles: ['admin', 'learner', 'moderator'],
    scopes: [cid, otherCid],
    active: true,
  }),
);
let p1 = success(
  await action(owner, id, {
    type: 'post',
    cohortId: cid,
    title: 'Scoped archived question',
    body: 'Fictional source-checking discussion for the first local cohort.',
  }),
).state.posts.find((p) => p.cohortId === cid).id;
let p2 = success(
  await action(owner, id, {
    type: 'post',
    cohortId: otherCid,
    title: 'Private other-cohort question',
    body: 'Fictional source-checking discussion for the other local cohort.',
  }),
).state.posts.find((p) => p.cohortId === otherCid).id;
for (let i = 0; i < 212; i++)
  success(
    await action(owner, id, {
      type: 'moderate',
      postId: i % 2 === 0 ? p1 : p2,
      status: i % 4 < 2 ? 'visible' : 'hidden',
      reason:
        (i % 2 === 0 ? 'SCOPE-ONE-CANARY: ' : 'OUTSIDE-SCOPE-CANARY: ') +
        `Synthetic moderation basis ${i} retains its decision history.`,
    }),
  );
// A moderator reads only their current cohort and never administrative activity.
let cursor,
  packets = [],
  pages = 0;
do {
  const page = success(await history(mod, cursor));
  ok(page.packets.length <= 5);
  for (const packet of page.packets) {
    eq(packet.activity.length, 0);
    ok(packet.moderation.every((e) => e.cohortId === cid));
    ok(!JSON.stringify(packet).includes('OUTSIDE-SCOPE-CANARY'));
    packets.push(packet);
  }
  cursor = page.nextBefore;
  pages++;
  ok(pages < 100);
} while (cursor);
ok(pages > 1);
ok(packets.some((p) => p.moderation.some((m) => m.reason.includes('SCOPE-ONE-CANARY'))));
ok(new Set(packets.map((p) => p.revision)).size === packets.length);
ok(packets.every((p, i) => i === 0 || p.revision < packets[i - 1].revision));
let adminHistory = success(await history(owner));
ok(adminHistory.packets.some((p) => p.moderation.some((m) => m.cohortId === otherCid)));
// Owner authority allows operational activity, but it does not imply the scoped
// moderator role. Removing the moderator grant removes archived moderation.
success(
  await action(owner, id, {
    type: 'member',
    userId: owner.id,
    roles: ['admin', 'learner'],
    scopes: [],
    active: true,
  }),
);
adminHistory = success(await history(owner));
ok(adminHistory.packets.every((p) => p.moderation.length === 0));
success(
  await action(owner, id, {
    type: 'member',
    userId: mod.id,
    roles: ['moderator'],
    scopes: [otherCid],
    active: true,
  }),
);
const changed = success(await history(mod));
ok(
  changed.packets.every((p) => p.activity.length === 0 && p.moderation.every((m) => m.cohortId === otherCid)),
);
ok(!JSON.stringify(changed).includes('SCOPE-ONE-CANARY'));
success(
  await action(owner, id, {
    type: 'member',
    userId: mod.id,
    roles: ['moderator'],
    scopes: [otherCid],
    active: false,
  }),
);
eq((await history(mod)).status, 403);
let directDatabaseChecked = false;
if (process.env.QA_LOCAL_DB_SQL === '1') {
  const config = resolve(app, '.sites-runtime/test-wrangler.json');
  assert.ok(existsSync(config), 'Build the app and create the local Wrangler test config first.');
  const sql = `SELECT t.revision AS workspace_revision,h.revision AS archived_revision,a.revision AS audit_revision,a.event_id FROM academy_team_history h JOIN academy_teams t ON t.id=h.team_id LEFT JOIN academy_team_audit a ON a.team_id=h.team_id AND a.revision=h.revision WHERE h.team_id='${id}' ORDER BY h.revision`;
  const raw = execFileSync(
    process.execPath,
    [
      '--import',
      './scripts/sites-env.mjs',
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--persist-to',
      '.wrangler/state',
      '--config',
      config,
      '--command',
      sql,
      '--json',
    ],
    { cwd: app, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  const rows = JSON.parse(raw).flatMap((x) => x.results ?? []);
  ok(rows.length > 5);
  ok(
    rows.every(
      (r) => r.archived_revision === r.audit_revision && r.archived_revision <= r.workspace_revision,
    ),
  );
  eq(rows.filter((r) => r.event_id === actionIds[winningIndex]).length, 1);
  eq(rows.filter((r) => r.event_id === actionIds[losingIndex]).length, 1);
  directDatabaseChecked = true;
}
const result = {
  passed: true,
  checks,
  fixtureId: id,
  historyPages: pages,
  directDatabaseChecked,
  coverage: [
    'supported API overflow past 200 activity and moderation records',
    'actual same-revision archive-boundary race',
    'CAS loser creates no orphan archive packet',
    'durable replay does not duplicate archive',
    'scoped moderator pagination without other-cohort reasons or activity',
    'role/scope removal immediately affects archive reads',
  ],
  limits: [
    'Synthetic local identities only',
    'Direct archive/audit consistency check runs only with QA_LOCAL_DB_SQL=1',
    'No forced D1 outage or disk failure is injected',
  ],
};
writeFileSync(
  new URL('../.sites-runtime/archive-api.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
