// One JSON action endpoint for the practice loop (POST /api/loop). Each action names the lib function it calls; the
// lib functions do every permission check, so this table only maps and validates the shape of the request.
import {type Db, type Actor, LoopError, recordDecision} from './core';
import * as E from './enrolment';
import * as Lv from './levels';
import * as P from './packs';
import * as A from './ai';
import * as F from './files';
import * as Pr from './practice';
import * as R from './reminders';
import * as M from './metrics';
import {mailSender} from '@/lib/auth/mail';

export type Ctx = {db: Db; actor: (Actor & {email: string}) | null; origin: string; now: number};
type Params = Record<string, unknown>;
const s = (v: unknown, name: string) => { if (typeof v !== 'string' || !v) throw new LoopError(`Missing ${name}.`); return v; };
const n = (v: unknown, name: string) => { const x = Number(v); if (!Number.isInteger(x)) throw new LoopError(`Missing ${name}.`); return x; };
const parseJson = (v: unknown, label: string) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { throw new LoopError(`${label} must be valid JSON.`); } };
const send = (db: Db) => { const m = mailSender(db); return (to: string, subject: string, body: string) => m(to, subject, body); };

type Handler = (c: Ctx & {actor: Actor & {email: string}}, p: Params) => Promise<unknown>;
type Public = (c: Ctx, p: Params) => Promise<unknown>;

export const PUBLIC_ACTIONS: Record<string, Public> = {
  'join.open': (c, p) => E.openInvite(c.db, p.token, c.now),
  'join.under18': (c, p) => E.declineUnder18(c.db, p.token, c.now),
};

export const ACTIONS: Record<string, Handler> = {
  // E2
  'org.create': (c, p) => E.createOrg(c.db, c.actor, p, c.now),
  'org.invite': (c, p) => E.inviteStaff(c.db, c.actor, s(p.orgId, 'organisation'), p, send(c.db), c.origin, c.now),
  'cohort.create': (c, p) => E.createCohort(c.db, c.actor, s(p.orgId, 'organisation'), p, c.now),
  'cohort.enrol': (c, p) => E.enrolCohort(c.db, c.actor, s(p.cohortId, 'cohort'), p, send(c.db), c.origin, c.now),
  'cohort.resend': (c, p) => E.resendInvite(c.db, c.actor, s(p.memberId, 'member'), send(c.db), c.origin, c.now),
  'cohort.startGroups': (c, p) => E.setupStartGroups(c.db, c.actor, s(p.cohortId, 'cohort'), c.now),
  'join.accept': (c, p) => E.acceptInvite(c.db, c.actor, p.token, {adult: p.adult, consents: p.consents as Record<string, unknown>}, c.now),
  'consent.set': (c, p) => E.setConsent(c.db, c.actor, s(p.memberId, 'member'), p.purpose, p.granted, {phone: p.phone}, c.now),
  'placement.submit': (c, p) => Lv.submitPlacement(c.db, c.actor, s(p.memberId, 'member'), p.answers, c.now),
  'level.request': (c, p) => Lv.requestLevelChange(c.db, c.actor, s(p.memberId, 'member'), p.reason, c.now),
  'level.resolve': (c, p) => Lv.resolveLevelRequest(c.db, c.actor, n(p.requestId, 'request'), p, c.now),
  // E3
  'pack.create': (c, p) => P.createPack(c.db, c.actor, p, c.now),
  'pack.assignReviewer': (c, p) => P.assignReviewer(c.db, c.actor, s(p.packId, 'pack'), p, c.now),
  'pack.importDraft': (c, p) => { let items = p.items; if (typeof items === 'string') { try { items = JSON.parse(items); } catch { throw new LoopError('The draft is not valid JSON.'); } } return P.addDraftItems(c.db, c.actor, s(p.packId, 'pack'), items, {now: c.now}); },
  'pack.draftAi': (c, p) => P.draftPackWithAi(c.db, c.actor, s(p.packId, 'pack'), {roles: typeof p.roles === 'string' ? p.roles.split(',').map(r => r.trim()).filter(Boolean) : p.roles, sources: parseJson(p.sources, 'Sources'), focus: p.focus}, undefined, c.now),
  'pack.review': (c, p) => P.reviewItem(c.db, c.actor, s(p.itemId, 'item'), p, c.now),
  'pack.revise': (c, p) => P.reviseItem(c.db, c.actor, s(p.itemId, 'item'), p, c.now),
  'pack.publish': (c, p) => P.publishVersion(c.db, c.actor, s(p.packId, 'pack'), {retire: Array.isArray(p.retire) ? p.retire as string[] : [], now: c.now}),
  'pack.attach': (c, p) => P.attachPackToCohort(c.db, c.actor, s(p.cohortId, 'cohort'), s(p.packId, 'pack'), c.now),
  'pack.flag': (c, p) => P.flagItem(c.db, c.actor, s(p.memberId, 'member'), s(p.itemId, 'item'), p.reason, c.now),
  'pack.resolveFlag': (c, p) => P.resolveFlag(c.db, c.actor, n(p.flagId, 'flag'), p.resolution, c.now),
  // E7
  'decision.record': (c, p) => { let v = p.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch { throw new LoopError('The decision value must be JSON.'); } } return recordDecision(c.db, c.actor, s(p.key, 'decision'), typeof p.scope === 'string' && p.scope ? p.scope : 'global', v, s(p.source, 'source'), c.now); },
  'eval.addCase': (c, p) => A.addEvalCase(c.db, c.actor, {...p, checks: parseJson(p.checks, 'Checks')}, c.now),
  'eval.run': (c) => A.runEvaluation(c.db, c.actor, undefined, c.now),
  'ai.incident': (c, p) => A.reportIncident(c.db, c.actor, p, c.now),
  // E4
  'task.weekly': (c, p) => Pr.ensureWeeklyTask(c.db, c.actor, s(p.memberId, 'member'), c.now),
  'coach.ask': (c, p) => Pr.askCoach(c.db, c.actor, s(p.taskId, 'task'), p, undefined, c.now),
  'task.attempt': (c, p) => Pr.submitAttempt(c.db, c.actor, s(p.taskId, 'task'), p.body, c.now),
  'task.submit': (c, p) => Pr.submitTask(c.db, c.actor, s(p.taskId, 'task'), p, c.now),
  'file.start': (c, p) => F.startUpload(c.db, c.actor, s(p.memberId, 'member'), p, c.now),
  'file.status': (c, p) => F.uploadStatus(c.db, c.actor, s(p.fileId, 'file'), c.now),
  'file.delete': (c, p) => F.deleteOwnFile(c.db, c.actor, s(p.fileId, 'file'), c.now),
  'check.schedule': (c, p) => Pr.scheduleCheck(c.db, c.actor, s(p.cohortId, 'cohort'), s(p.itemId, 'check'), c.now),
  'check.start': (c, p) => Pr.startCheck(c.db, c.actor, s(p.taskId, 'task'), c.now),
  'check.finish': (c, p) => Pr.finishCheck(c.db, c.actor, s(p.taskId, 'task'), p.answers, c.now),
  'catch.open': (c, p) => Pr.ensureCatchTask(c.db, c.actor, s(p.memberId, 'member'), c.now),
  'catch.submit': (c, p) => Pr.submitCatch(c.db, c.actor, s(p.taskId, 'task'), p.marked, c.now),
  'workshop.start': (c, p) => Pr.startWorkshop(c.db, c.actor, s(p.cohortId, 'cohort'), c.now),
  'workshop.end': (c, p) => Pr.endWorkshop(c.db, c.actor, s(p.cohortId, 'cohort'), c.now),
  // E5
  'cadence.assign': (c, p) => R.assignCadences(c.db, c.actor, s(p.cohortId, 'cohort'), c.now),
  'followup.log': (c, p) => R.logFollowUp(c.db, c.actor, s(p.memberId, 'member'), p.outcome, c.now),
  // E6
  'report.week6': (c, p) => M.prepareWeek6Report(c.db, c.actor, s(p.cohortId, 'cohort'), c.now),
  'report.review': (c, p) => M.prepareReview(c.db, c.actor, s(p.cohortId, 'cohort'), Number(p.day) === 90 ? 90 : 30, c.now),
  'report.impact': (c, p) => M.prepareImpactReport(c.db, c.actor, s(p.cohortId, 'cohort'), p.kind === 'year_end' ? 'year_end' : 'impact', c.now),
  'report.approve': (c, p) => M.approveReport(c.db, c.actor, s(p.reportId, 'report'), c.now),
  'report.shared': (c, p) => M.recordShared(c.db, c.actor, s(p.reportId, 'report'), p.note, c.now),
  'a01.decide': (c, p) => M.recordA01Decision(c.db, c.actor, s(p.reportId, 'report'), p, c.now),
};

/** Extra actions registered by later modules (E8 onwards) without editing this table. */
export function register(name: string, h: Handler) { ACTIONS[name] = h; }
export function registerPublic(name: string, h: Public) { PUBLIC_ACTIONS[name] = h; }
export const helpers = {s, n, send, parseJson};

export async function dispatch(ctx: Ctx, body: Params) {
  const action = typeof body.action === 'string' ? body.action : '';
  const params = (body.params && typeof body.params === 'object' ? body.params : {}) as Params;
  if (Object.hasOwn(PUBLIC_ACTIONS, action)) return PUBLIC_ACTIONS[action](ctx, params);
  if (!Object.hasOwn(ACTIONS, action)) throw new LoopError('Unknown action.', 404);
  const h = ACTIONS[action];
  if (!ctx.actor) throw new LoopError('Sign in to continue.', 401);
  return h({...ctx, actor: ctx.actor}, params);
}

