import './qa-paths.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { identity, enrolled, own, ownAction, ownPost, pass, choice, out } from './personal-qa.mjs';
// Uses only supported local API commands. No database file or saved row is injected.
const owner = identity('scoped-storage-boundary'),
  ids = await enrolled(owner),
  maxBytes = 1000000;
const size = (s) => {
  const actualBytes = new TextEncoder().encode(JSON.stringify(s)).length,
    reservedBytes = (s.ecosystemGrants ?? []).filter((g) => g.revokedAt === null).length * 22;
  return { actualBytes, reservedBytes, effectiveBytes: actualBytes + reservedBytes };
};
let x = await ownAction(owner, choice('msme', ids.msme)),
  writes = 0,
  replyOverhead = null,
  blocked = null,
  targetPost = null;
try {
  // 200 legal discussions plus bounded replies approach the size limit in a
  // finite number of requests. The cap is independent of discussion row limits.
  for (let i = 0; i < 200; i++) {
    x = await ownAction(owner, {
      type: 'post',
      title: 'Fictional storage boundary ' + i,
      body: 'P'.repeat(3000),
      scope: 'all',
    });
    writes++;
  }
  for (const post of x.state.posts) {
    for (let i = 0; i < 50; i++) {
      let next = await ownAction(owner, { type: 'moderate', postId: post.id, status: 'visible' });
      writes++;
      const before = size(next.state),
        result = await ownPost(
          owner,
          { type: 'reply', postId: post.id, body: 'R'.repeat(1500) },
          next.revision,
        );
      writes++;
      if (result.status === 413) {
        blocked = { command: 'reply', revision: next.revision, before };
        x = next;
        targetPost = post.id;
        const predicted = structuredClone(next.state);
        predicted.posts
          .find((p) => p.id === post.id)
          .replies.push({
            id: '00000000-0000-0000-0000-000000000000',
            body: '',
            author: next.state.profile.name,
            createdAt: '2026-10-05T12:00:00.000Z',
            status: 'pending',
          });
        replyOverhead = size(predicted).actualBytes - before.actualBytes;
        break;
      }
      pass(result);
      replyOverhead = size(result.state).actualBytes - before.actualBytes - 1500;
      x = result;
    }
    if (blocked) break;
  }
  assert.ok(blocked, 'Supported API growth reaches the 1MB limit before reply row limits');
  assert.ok(writes <= 1200, 'Fixture growth remains bounded');
  assert.ok(replyOverhead !== null);
  let saved = pass(await own(owner));
  assert.equal(saved.revision, x.revision);
  assert.deepEqual(saved.state, x.state, 'The rejected growth is atomic');
  const remaining = maxBytes - size(saved.state).effectiveBytes;
  if (remaining - replyOverhead >= 10) {
    x = pass(
      await ownPost(
        owner,
        { type: 'reply', postId: targetPost, body: 'E'.repeat(remaining - replyOverhead) },
        saved.revision,
      ),
    );
    writes++;
  } else {
    x = saved;
    await ownAction(owner, { type: 'learning-plan', personalGoal: 'G'.repeat(remaining) });
    writes++;
    x = pass(await own(owner));
  }
  assert.equal(
    size(x.state).effectiveBytes,
    maxBytes,
    'The actual persisted API fixture reaches the exact effective byte boundary',
  );
  const beforeWithdraw = size(x.state),
    grantId = x.state.ecosystemGrants[0].id,
    history = structuredClone(x.state.ecosystemReceipts ?? []),
    revision = x.revision;
  assert.equal(
    (
      await ownPost(
        owner,
        {
          type: 'learning-plan',
          personalGoal: 'G'.repeat((x.state.learningPlan?.personalGoal ?? '').length + 1),
        },
        revision,
      )
    ).status,
    413,
    'An unrelated one-byte increase also applies the closure reserve',
  );
  assert.equal((await own(owner)).revision, revision);
  x = await ownAction(owner, { type: 'ecosystem-withdraw', grantId });
  writes++;
  const afterWithdraw = size(x.state);
  assert.equal(afterWithdraw.effectiveBytes, beforeWithdraw.effectiveBytes);
  assert.equal(afterWithdraw.actualBytes, beforeWithdraw.actualBytes + 22);
  assert.equal(afterWithdraw.reservedBytes, beforeWithdraw.reservedBytes - 22);
  assert.notEqual(x.state.ecosystemGrants[0].revokedAt, null);
  assert.deepEqual(x.state.ecosystemReceipts ?? [], history);
  writeFileSync(
    new URL('scoped-workbench-storage-result.json', out),
    JSON.stringify(
      {
        passed: true,
        at: new Date().toISOString(),
        syntheticOwner: owner.id,
        writes,
        replyOverhead,
        firstBlockedGrowth: blocked,
        beforeWithdraw,
        afterWithdraw,
        limits: [
          'Actual loopback API storage boundary only; no SQL fixture injection.',
          'Reservation proves future withdrawal is still writable at the effective boundary.',
          'This is not a load or performance benchmark.',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    `Actual personal API storage boundary and withdrawal reserve passed after ${writes} bounded writes.`,
  );
} catch (error) {
  writeFileSync(
    new URL('scoped-workbench-storage-result.json', out),
    JSON.stringify(
      { passed: false, at: new Date().toISOString(), writes, replyOverhead, blocked, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
}
