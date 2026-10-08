import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const app = resolve(process.env.ACADEMY_APP_PATH ?? '.');
const { base, identity, get, post, current, action, fixture } = await import(
  pathToFileURL(resolve(app, 'tests/local-qa.mjs')).href
);
// local-qa rejects all non-loopback URLs. Never use these synthetic headers hosted.
const artifact = resolve(
  process.env.ACADEMY_QA_OUTPUT ?? resolve(app, '.sites-runtime'),
  'support-privacy-api.json',
);
const nonce = crypto.randomUUID(),
  bodyCanary = 'PRIVATE-SUPPORT-BODY-' + nonce,
  otherCanary = 'OTHER-SUPPORT-BODY-' + nonce,
  resolutionCanary = 'PRIVATE-SUPPORT-RESOLUTION-' + nonce,
  replyCanary = 'PRIVATE-SUPPORT-REPLY-' + nonce,
  disclosedSubject = 'User chosen generic subject ' + nonce;
let assertions = 0,
  error,
  team,
  ownerTwo,
  requestId,
  winner,
  loser,
  winnerRoles,
  winnerScopes,
  replyReplay,
  privacyId;
const scenarios = [];
const equal = (a, b) => {
  assert.deepEqual(a, b);
  assertions++;
};
const truth = (v, message) => {
  assert.ok(v, message);
  assertions++;
};
const success = (x) => {
  equal(x.status, 200);
  return x;
};
const support = (x) => {
  truth(!!x.team?.support, 'Protected team.support projection is required.');
  return x.team.support;
};
const own = (x, id) => support(x).mine.find((r) => r.id === id);
const assigned = (x, id) => support(x).assigned.find((r) => r.id === id);
const queue = (x, id) => support(x).queue.find((r) => r.id === id);
const excludes = (x, canaries) => {
  const text = JSON.stringify(x);
  for (const canary of canaries) truth(!text.includes(canary), 'Private support content leaked: ' + canary);
};
const learningOnly = (x) => ({ state: x.state, team: { ...x.team, support: undefined } });
function assertThreadSafe(r) {
  truth(!!r, 'Expected a full own or assigned thread.');
  for (const key of ['requesterId', 'assignedTo', 'email', 'requesterEmail'])
    equal(Object.hasOwn(r, key), false);
  for (const m of r.messages) equal(Object.hasOwn(m, 'actorId'), false);
  for (const e of r.events)
    for (const key of ['actorId', 'handlerId', 'previousHandlerId']) equal(Object.hasOwn(e, key), false);
  for (const resolution of r.resolutions) equal(Object.hasOwn(resolution, 'actorId'), false);
}
async function scenario(name, work) {
  const start = assertions;
  try {
    await work();
    scenarios.push({ name, passed: true, assertions: assertions - start });
  } catch (e) {
    scenarios.push({ name, passed: false, assertions: assertions - start, error: String(e.message) });
    throw e;
  }
}
async function intake(
  u,
  {
    category = 'learning',
    cohortId = team.cid,
    subject = 'Generic synthetic support issue',
    body = 'A fictional checked source question.',
  } = {},
) {
  const x = success(
    await action(u, team.id, {
      type: 'support-open',
      category,
      cohortId,
      subject,
      body,
      audienceAcknowledged: true,
    }),
  );
  return { x, id: support(x).mine.at(-1).id };
}
async function memberChange(admin, u, roles, scopes, active = true) {
  return success(await action(admin, team.id, { type: 'member', userId: u.id, roles, scopes, active }));
}
try {
  await scenario('synthetic setup with two independent owners and one scoped facilitator', async () => {
    team = await fixture();
    ownerTwo = identity('support-second-owner');
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    success(
      await action(team.owner, team.id, {
        type: 'invite',
        email: ownerTwo.email,
        roles: ['admin'],
        scopes: [],
        token,
      }),
    );
    const invitation = success(await get(ownerTwo, '/api/teams?invite=' + token));
    success(await post(ownerTwo, team.id, { type: 'accept', token }, invitation.revision));
    await memberChange(ownerTwo, team.mod, ['facilitator'], [team.cid]);
  });

  await scenario(
    'audience acknowledgement and exact command fields reject forged actors and status',
    async () => {
      const { a, id, cid } = team,
        original = success(await current(a, id));
      const c = {
        type: 'support-open',
        category: 'learning',
        cohortId: cid,
        subject: 'Generic synthetic request',
        body: 'A fictional source question.',
        audienceAcknowledged: true,
      };
      equal((await post(a, id, { ...c, audienceAcknowledged: false }, original.revision)).status, 422);
      for (const extra of [
        { actorId: team.owner.id },
        { assignedTo: team.owner.id },
        { status: 'resolved' },
        { createdAt: '2000-01-01T00:00:00.000Z' },
      ])
        equal((await post(a, id, { ...c, ...extra }, original.revision)).status, 400);
      equal(success(await current(a, id)).revision, original.revision);
    },
  );

  await scenario(
    'intake stores private body only in own thread; queue intentionally contains chosen subject',
    async () => {
      const opened = await intake(team.a, {
        subject: disclosedSubject,
        body: bodyCanary + ' Fictional question without real records.',
      });
      requestId = opened.id;
      assertThreadSafe(own(opened.x, requestId));
      equal(
        own(opened.x, requestId).messages[0].body,
        bodyCanary + ' Fictional question without real records.',
      );
      for (const u of [team.owner, ownerTwo, team.mod]) {
        const x = success(await current(u, team.id)),
          q = queue(x, requestId);
        truth(!!q);
        equal(q.subject, disclosedSubject);
        equal(q.canClaim, true);
        for (const key of [
          'messages',
          'events',
          'resolutions',
          'resolution',
          'requesterId',
          'email',
          'requesterEmail',
          'assignedTo',
        ])
          equal(Object.hasOwn(q, key), false);
        excludes(x, [bodyCanary]);
        equal(support(x).assigned.length, 0);
      }
      excludes(success(await current(team.b, team.id)), [bodyCanary, disclosedSubject]);
      for (const u of [team.a, team.owner, team.mod])
        excludes(learningOnly(success(await current(u, team.id))), [bodyCanary]);
    },
  );

  await scenario(
    'same-revision independent handler claims have one winner and no silent overwrite',
    async () => {
      const before = success(await current(team.owner, team.id));
      const claim = { type: 'support-claim', requestId };
      const race = await Promise.all([
        post(team.owner, team.id, claim, before.revision),
        post(team.mod, team.id, claim, before.revision),
      ]);
      equal(race.map((x) => x.status).sort(), [200, 409]);
      const winnerIndex = race.findIndex((x) => x.status === 200);
      winner = winnerIndex === 0 ? team.owner : team.mod;
      loser = winnerIndex === 0 ? team.mod : team.owner;
      winnerRoles = winnerIndex === 0 ? ['admin', 'learner'] : ['facilitator'];
      winnerScopes = winnerIndex === 0 ? [] : [team.cid];
      const wx = success(await current(winner, team.id)),
        lx = success(await current(loser, team.id));
      truth(JSON.stringify(assigned(wx, requestId)).includes(bodyCanary));
      assertThreadSafe(assigned(wx, requestId));
      excludes(lx, [bodyCanary]);
      equal(queue(lx, requestId).canClaim, false);
      equal(wx.revision, before.revision + 1);
      equal(
        (
          await action(loser, team.id, {
            type: 'support-reply',
            requestId,
            body: 'An unassigned staff member must not reply.',
          })
        ).status,
        403,
      );
      equal(
        (
          await action(loser, team.id, {
            type: 'support-resolve',
            requestId,
            resolution: 'An unassigned owner cannot resolve this thread.',
          })
        ).status,
        403,
      );
    },
  );

  await scenario(
    'support action replay is durable; reused action with another body and stale writes fail',
    async () => {
      const before = success(await current(winner, team.id)),
        actionId = crypto.randomUUID(),
        command = { type: 'support-reply', requestId, body: replyCanary + ' Fictional handled reply.' };
      const saved = success(await post(winner, team.id, command, before.revision, actionId));
      replyReplay = { command, revision: before.revision, actionId };
      equal(assigned(saved, requestId).messages.length, 2);
      const replay = success(await post(winner, team.id, command, before.revision, actionId));
      equal(replay.replayed, true);
      equal(assigned(replay, requestId).messages.length, 2);
      equal(
        (
          await post(
            winner,
            team.id,
            { ...command, body: 'Different body under an already committed action.' },
            saved.revision,
            actionId,
          )
        ).status,
        409,
      );
      equal(
        (
          await post(
            team.a,
            team.id,
            { type: 'support-reply', requestId, body: 'Stale requester response cannot overwrite new work.' },
            before.revision,
          )
        ).status,
        409,
      );
      equal(success(await current(team.a, team.id)).revision, saved.revision);
    },
  );

  await scenario(
    'persisted role revocation removes thread access and restoration requires a new claim',
    async () => {
      const stale = success(await current(winner, team.id));
      await memberChange(ownerTwo, winner, ['learner'], []);
      const revoked = success(await current(winner, team.id));
      equal(support(revoked).assigned.length, 0);
      excludes(revoked, [bodyCanary, replyCanary]);
      equal(
        (
          await post(
            winner,
            team.id,
            { type: 'support-reply', requestId, body: 'Stale staff reply must not survive role revocation.' },
            stale.revision,
          )
        ).status,
        409,
      );
      // An active member may replay an already committed command, but only receives
      // their CURRENT safe projection. Replay does not mutate or restore assignment.
      const replay = success(
        await post(winner, team.id, replyReplay.command, replyReplay.revision, replyReplay.actionId),
      );
      equal(replay.replayed, true);
      excludes(replay, [bodyCanary, replyCanary]);
      await memberChange(ownerTwo, winner, winnerRoles, winnerScopes);
      const restored = success(await current(winner, team.id));
      equal(support(restored).assigned.length, 0);
      excludes(restored, [bodyCanary, replyCanary]);
      equal(queue(restored, requestId).canClaim, true);
      equal(
        (
          await action(winner, team.id, {
            type: 'support-reply',
            requestId,
            body: 'Restored role still requires explicit assignment.',
          })
        ).status,
        403,
      );
      success(await action(winner, team.id, { type: 'support-claim', requestId }));
      truth(!!assigned(success(await current(winner, team.id)), requestId));
    },
  );

  await scenario(
    'inactive handler cannot replay a committed action or revive assignment on restoration',
    async () => {
      await memberChange(ownerTwo, winner, winnerRoles, winnerScopes, false);
      const revoked = success(await current(winner, team.id));
      equal(revoked.team.active, false);
      equal(support(revoked).assigned, []);
      equal(support(revoked).queue, []);
      excludes(revoked, [bodyCanary]);
      equal(
        (await post(winner, team.id, replyReplay.command, replyReplay.revision, replyReplay.actionId)).status,
        403,
      );
      await memberChange(ownerTwo, winner, winnerRoles, winnerScopes);
      const restored = success(await current(winner, team.id));
      equal(support(restored).assigned, []);
      excludes(restored, [bodyCanary]);
      equal(queue(restored, requestId).canClaim, true);
      success(await action(winner, team.id, { type: 'support-claim', requestId }));
    },
  );

  await scenario(
    'facilitator scope loss releases assignment and sensitive categories stay owner-only',
    async () => {
      const opened = await intake(team.a, {
        subject: 'Scoped fictional content question',
        body: 'SCOPE-PRIVATE-' + nonce + ' A fictional source mismatch.',
      });
      success(await action(team.mod, team.id, { type: 'support-claim', requestId: opened.id }));
      await memberChange(ownerTwo, team.mod, ['facilitator'], [team.otherCid]);
      excludes(success(await current(team.mod, team.id)), ['SCOPE-PRIVATE-' + nonce]);
      equal((await action(team.mod, team.id, { type: 'support-claim', requestId: opened.id })).status, 404);
      await memberChange(ownerTwo, team.mod, ['facilitator'], [team.cid]);
      const restored = success(await current(team.mod, team.id));
      truth(!assigned(restored, opened.id));
      equal(queue(restored, opened.id).canClaim, true);
      success(await action(team.mod, team.id, { type: 'support-claim', requestId: opened.id }));
      const privacy = await intake(team.a, {
        category: 'privacy',
        subject: 'Generic private access question',
        body: 'PRIVACY-ONLY-' + nonce + ' A fictional access concern.',
      });
      privacyId = privacy.id;
      truth(!queue(success(await current(team.mod, team.id)), privacyId));
      equal((await action(team.mod, team.id, { type: 'support-claim', requestId: privacyId })).status, 404);
      truth(!!queue(success(await current(ownerTwo, team.id)), privacyId));
    },
  );

  await scenario(
    'requester and handler remain independent even when requester owns the workspace',
    async () => {
      const opened = await intake(team.owner, {
        cohortId: null,
        category: 'access',
        subject: 'Generic owner access question',
      });
      equal(queue(opened.x, opened.id).canClaim, false);
      equal((await action(team.owner, team.id, { type: 'support-claim', requestId: opened.id })).status, 403);
      success(await action(ownerTwo, team.id, { type: 'support-claim', requestId: opened.id }));
      equal(
        (
          await action(team.owner, team.id, {
            type: 'support-resolve',
            requestId: opened.id,
            resolution: 'The owner must not resolve their own request.',
          })
        ).status,
        403,
      );
      let x = success(
        await action(ownerTwo, team.id, {
          type: 'support-resolve',
          requestId: opened.id,
          resolution: resolutionCanary + ' Fictional resolution with next steps.',
        }),
      );
      equal(assigned(x, opened.id).status, 'resolved');
      equal(assigned(x, opened.id).resolutions.length, 1);
      x = success(
        await action(team.owner, team.id, {
          type: 'support-reopen',
          requestId: opened.id,
          body: 'A fictional reason why further help is needed.',
        }),
      );
      const r = own(x, opened.id);
      equal(r.status, 'open');
      equal(r.resolution, null);
      equal(r.resolutions.length, 1);
      truth(r.resolutions[0].body.includes(resolutionCanary));
      success(await action(team.owner, team.id, { type: 'support-withdraw', requestId: opened.id }));
      equal(
        (
          await action(team.owner, team.id, {
            type: 'support-reopen',
            requestId: opened.id,
            body: 'A withdrawn thread must remain read only.',
          })
        ).status,
        409,
      );
      excludes(success(await current(team.mod, team.id)), [resolutionCanary]);
    },
  );

  await scenario(
    'paused cohort retains support intake without enabling learning progress or promised delivery',
    async () => {
      success(
        await action(ownerTwo, team.id, { type: 'cohort-status', cohortId: team.cid, status: 'paused' }),
      );
      const before = success(await current(team.a, team.id)),
        enrollments = structuredClone(before.state.enrollments),
        deliveries = structuredClone(before.state.deliveries);
      const opened = await intake(team.a, { subject: 'Generic paused cohort question' });
      equal(own(opened.x, opened.id).status, 'open');
      equal(opened.x.state.enrollments, enrollments);
      equal(opened.x.state.deliveries, deliveries);
      truth(!Object.hasOwn(opened.x, 'emailSent') && !Object.hasOwn(opened.x, 'notificationSent'));
      success(await action(team.mod, team.id, { type: 'support-claim', requestId: opened.id }));
      success(
        await action(team.mod, team.id, {
          type: 'support-reply',
          requestId: opened.id,
          body: 'Support still works while the cohort is paused.',
        }),
      );
      success(await action(ownerTwo, team.id, { type: 'cohort-status', cohortId: team.cid, status: 'open' }));
    },
  );

  await scenario(
    'message flooding stops at 20 while final own withdrawal still appends closure history',
    async () => {
      const opened = await intake(team.a, { subject: 'Generic synthetic message-limit fixture' });
      let x = opened.x;
      for (let i = 1; i < 20; i++)
        x = success(
          await action(team.a, team.id, {
            type: 'support-reply',
            requestId: opened.id,
            body: 'Fictional bounded message ' + i + ' with no real private record.',
          }),
        );
      equal(own(x, opened.id).messages.length, 20);
      const revision = x.revision;
      equal(
        (
          await post(
            team.a,
            team.id,
            { type: 'support-reply', requestId: opened.id, body: 'Message 21 must not be saved.' },
            revision,
          )
        ).status,
        409,
      );
      equal(success(await current(team.a, team.id)).revision, revision);
      x = success(await action(team.a, team.id, { type: 'support-withdraw', requestId: opened.id }));
      equal(own(x, opened.id).status, 'withdrawn');
      equal(own(x, opened.id).messages.length, 20);
      equal(own(x, opened.id).events.at(-1).type, 'withdrawn');
    },
  );

  await scenario(
    'ordinary learning, networking, summary and archived history projections exclude support bodies',
    async () => {
      const b = await intake(team.b, { body: otherCanary + ' Fictional second requester.' });
      truth(!!own(b.x, b.id));
      for (const u of [team.a, team.b, team.owner, ownerTwo, team.mod])
        excludes(learningOnly(success(await current(u, team.id))), [
          bodyCanary,
          otherCanary,
          replyCanary,
          resolutionCanary,
        ]);
      const history = success(
        await get(ownerTwo, '/api/teams/history?teamId=' + encodeURIComponent(team.id)),
      );
      excludes(history, [bodyCanary, otherCanary, replyCanary, resolutionCanary]);
      const stranger = identity('support-not-member');
      equal((await current(stranger, team.id)).status, 404);
      const other = success(
        await post(
          team.a,
          undefined,
          {
            type: 'create',
            name: 'Synthetic isolated support workspace',
            purpose: 'A separate fictional workspace for scope checks.',
            context: 'msme',
          },
          0,
        ),
      );
      equal((await action(team.a, other.team.id, { type: 'support-withdraw', requestId })).status, 404);
      equal(
        (
          await action(team.b, team.id, {
            type: 'support-reply',
            requestId,
            body: 'Another requester must not access a private thread.',
          })
        ).status,
        404,
      );
      excludes(success(await current(team.a, other.team.id)), [bodyCanary, otherCanary]);
    },
  );

  await scenario(
    'removed requester retains own private history but cannot mutate or replay any support action',
    async () => {
      const before = success(await current(team.a, team.id)),
        actionId = crypto.randomUUID(),
        command = {
          type: 'support-reply',
          requestId: privacyId,
          body: 'Own retained request before membership removal.',
        };
      const saved = success(await post(team.a, team.id, command, before.revision, actionId));
      await memberChange(ownerTwo, team.a, ['learner'], [], false);
      const removed = success(await current(team.a, team.id));
      equal(removed.team.active, false);
      equal(support(removed).queue, []);
      equal(support(removed).assigned, []);
      truth(!!own(removed, requestId));
      truth(JSON.stringify(support(removed).mine).includes(bodyCanary));
      excludes(removed, [otherCanary]);
      for (const c of [
        {
          type: 'support-open',
          category: 'access',
          cohortId: null,
          subject: 'Generic removed-member attempt',
          body: 'Removed member cannot submit a new request.',
          audienceAcknowledged: true,
        },
        { type: 'support-claim', requestId },
        { type: 'support-reply', requestId, body: 'Removed member cannot append this response.' },
        { type: 'support-resolve', requestId, resolution: 'Removed member cannot save a new resolution.' },
        { type: 'support-reopen', requestId, body: 'Removed member cannot reopen this request.' },
        { type: 'support-withdraw', requestId },
      ])
        equal((await post(team.a, team.id, c, saved.revision)).status, 403);
      equal((await post(team.a, team.id, command, before.revision, actionId)).status, 403);
      const after = success(await current(team.a, team.id));
      equal(after.revision, removed.revision);
      equal(support(after).mine, support(removed).mine);
    },
  );
} catch (e) {
  error = e;
}
const result = {
  passed: !error,
  assertions,
  scenarios,
  limits: [
    'Synthetic loopback identity headers only. Hosted dispatcher identity and actual recipient site access are outside this test.',
    'Queue subjects and requester display names are intentionally disclosed; body/resolution canaries test separate private content.',
    'An active member may replay an already committed command but receives current projection and no new mutation. Removed-member replay is forbidden.',
    'Support is in-app only. This suite does not imply staff availability, an emergency service, notifications or erasure.',
    'Own export UI is covered separately by browser QA; ordinary projected state and archive are checked here.',
  ],
};
mkdirSync(resolve(artifact, '..'), { recursive: true });
writeFileSync(artifact, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (error) throw error;
