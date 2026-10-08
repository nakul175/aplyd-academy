import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app, fixture, current, action, post, success } from './local-qa.mjs';
const { owner, id, cid } = await fixture();
assert.match(id, /^tw-[a-z0-9-]{20,80}$/i);
const config = resolve(app, '.sites-runtime/test-wrangler.json');
function sql(command) {
  const output = execFileSync(
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
      command,
      '--json',
    ],
    { cwd: app, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  return JSON.parse(output).flatMap((r) => r.results ?? []);
}
let x = success(await current(owner, id));
while (x.team.activity.length < 200)
  x = success(await action(owner, id, { type: 'cohort-status', cohortId: cid, status: 'open' }));
const revision = x.revision,
  next = revision + 1,
  actionId = crypto.randomUUID(),
  command = { type: 'cohort-status', cohortId: cid, status: 'closed' };
// A deliberately conflicting packet is inserted only in this isolated local
// fixture. The resulting constraint failure tests the real D1 batch rollback.
sql(
  `INSERT INTO academy_team_history(team_id,revision,data,created_at) VALUES ('${id}',${next},'{"activity":[],"moderation":[]}','2026-10-05T08:00:00.000Z')`,
);
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
try {
  const failed = await post(owner, id, command, revision, actionId);
  eq(failed.status, 503);
  x = success(await current(owner, id));
  eq(x.revision, revision);
  eq(x.team.cohorts.find((c) => c.id === cid).status, 'open');
  eq(x.team.activity.length, 200);
  const rows = sql(
    `SELECT COUNT(*) AS count FROM academy_team_audit WHERE team_id='${id}' AND event_id='${actionId}'`,
  );
  eq(rows[0].count, 0);
} finally {
  sql(`DELETE FROM academy_team_history WHERE team_id='${id}' AND revision=${next}`);
}
const recovered = success(await post(owner, id, command, revision, actionId));
eq(recovered.revision, next);
eq(recovered.team.cohorts.find((c) => c.id === cid).status, 'closed');
const rows = sql(
  `SELECT h.revision AS history_revision,a.revision AS audit_revision FROM academy_team_history h JOIN academy_team_audit a ON a.team_id=h.team_id AND a.revision=h.revision WHERE h.team_id='${id}' AND a.event_id='${actionId}'`,
);
eq(rows.length, 1);
eq(rows[0].history_revision, next);
eq(rows[0].audit_revision, next);
const replay = success(await post(owner, id, command, revision, actionId));
eq(replay.replayed, true);
eq(replay.revision, next);
const result = {
  passed: true,
  checks,
  coverage: [
    'actual local D1 archive constraint failure rolls back aggregate update and receipt',
    'temporary failure retains current cohort and full hot history',
    'same action ID recovers after fixture fault removal',
    'durable replay after recovered write',
  ],
  limits: [
    'Local isolated synthetic fixture only',
    'Does not simulate a production outage or backup restore',
  ],
};
writeFileSync('.sites-runtime/archive-failure.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
