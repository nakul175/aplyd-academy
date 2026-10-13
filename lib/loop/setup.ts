// Guided set-up for an APLYD operator who runs a pilot alone (owner request of 13 October 2026: the operations screen
// was unusable). Each function composes the existing, audited actions; no rule is bypassed:
//   setupWorkshop: association + the operator as its admin + cohort + staff list + pack (operator as expert) attached.
//   draftPackPlain: AI draft of the pack from plain inputs (job roles, a focus, optional "Title | URL" sources).
import type { Db, Actor } from './core';
import { LoopError, requireOperator, text } from './core';
import * as E from './enrolment';
import * as P from './packs';

type Send = (to: string, subject: string, body: string) => Promise<void>;

export async function setupWorkshop(
  db: Db,
  actor: Actor & { email: string },
  input: {
    orgName?: unknown;
    sector?: unknown;
    cohortName?: unknown;
    workshopDate?: unknown;
    list?: unknown;
  },
  send: Send,
  origin: string,
  now = Date.now(),
) {
  await requireOperator(db, actor, 'setup.workshop', now);
  const orgName = text(input.orgName, 'Association name', 120);
  const sector = text(input.sector, 'Sector', 60);
  const { id: orgId } = await E.createOrg(db, actor, { kind: 'association', name: orgName, sector }, now);

  // The operator becomes the association's admin through the normal invite, accepted at once (no email needed).
  let token = '';
  const capture: Send = async (_to, _subject, body) => {
    token = body.match(/\/loop\/join\/([A-Za-z0-9_-]{43})/)?.[1] ?? '';
  };
  await E.inviteStaff(
    db,
    actor,
    orgId,
    { email: actor.email, name: 'APLYD', role: 'admin' },
    capture,
    origin,
    now,
  );
  if (!token) throw new LoopError('Could not make you the admin of the new association.', 500);
  await E.acceptInvite(db, actor, token, {}, now);
  // ...and its facilitator, so the operator can start the workshop practice session on the day.
  token = '';
  await E.inviteStaff(
    db,
    actor,
    orgId,
    { email: actor.email, name: 'APLYD', role: 'facilitator' },
    capture,
    origin,
    now,
  );
  if (token) await E.acceptInvite(db, actor, token, {}, now);

  const cohort = await E.createCohort(
    db,
    actor,
    orgId,
    { name: input.cohortName || 'Workshop 1', workshopDate: input.workshopDate },
    now,
  );
  const enrol = await E.enrolCohort(db, actor, cohort.id, { list: input.list }, send, origin, now);

  const pack = await P.createPack(
    db,
    actor,
    { title: `${orgName} pack`, sector, audience: 'learner', language: 'en' },
    now,
  );
  await P.assignReviewer(db, actor, pack.id, { email: actor.email, role: 'expert' }, now);
  await P.attachPackToCohort(db, actor, cohort.id, pack.id, now);
  return { orgId, cohortId: cohort.id, packId: pack.id, invited: enrol.invited, problems: enrol.problems };
}

/** Plain-language inputs for the AI pack draft: roles separated by commas or new lines, sources as "Title | URL" lines. */
export async function draftPackPlain(
  db: Db,
  actor: Actor,
  packId: string,
  input: { roles?: unknown; focus?: unknown; sources?: unknown },
  now = Date.now(),
) {
  const roles = String(input.roles ?? '')
    .split(/[,\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
  const lines = String(input.sources ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const sources = lines.length
    ? lines.map((l) => {
        const [title, url] = l.split('|').map((x) => x.trim());
        return { title: title || url, ...(url && /^https?:\/\//.test(url) ? { url } : {}) };
      })
    : [{ title: 'APLYD workshop brief and the association’s own description of these roles' }];
  return P.draftPackWithAi(db, actor, packId, { roles, sources, focus: input.focus }, undefined, now);
}
