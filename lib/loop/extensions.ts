// Registers practice-loop actions added after the first R1 modules (ACA-E8, E9, E10, E12, E14 onwards).
import {register, registerPublic, helpers} from './api';
import * as H from './help';
import * as C from './community';
import * as Ev from './evidence';
import * as M from './metrics';
import * as A from './ai';
import {LoopError} from './core';
import {configuredSenders} from './senders';
const {s, n, send} = helpers;

// ACA-US-12.5
register('help.report', (c, p) => H.reportProblem(c.db, c.actor, p, send(c.db), c.now));
register('help.resolve', (c, p) => H.resolveReport(c.db, c.actor, n(p.id, 'report'), p.resolution, c.now));
// ACA-E8
register('session.schedule', (c, p) => C.scheduleSession(c.db, c.actor, s(p.cohortId, 'cohort'), p, configuredSenders(c.db), c.origin, c.now));
register('session.end', (c, p) => C.endSession(c.db, c.actor, s(p.sessionId, 'session'), p.attended, c.now));
register('thread.post', (c, p) => C.postToThread(c.db, c.actor, s(p.threadId, 'thread'), p.body, c.now));
register('thread.report', (c, p) => C.reportPost(c.db, c.actor, n(p.postId, 'post'), c.now));
register('thread.hide', (c, p) => C.hidePost(c.db, c.actor, n(p.postId, 'post'), c.now));
// ACA-E10
register('confirm.request', (c, p) => Ev.requestConfirmation(c.db, c.actor, s(p.submissionId, 'submission'), p, send(c.db), c.origin, c.now));
registerPublic('confirm.open', (c, p) => Ev.openConfirmation(c.db, p.token, c.now));
registerPublic('confirm.decide', (c, p) => Ev.decideConfirmation(c.db, p.token, p.decision, c.now));
register('interview.record', (c, p) => Ev.recordInterview(c.db, c.actor, p, c.now));
register('interview.summary', (c, p) => Ev.summariseInterview(c.db, c.actor, s(p.id, 'interview'), p.summary, c.now));
register('change.add', (c, p) => Ev.addChange(c.db, c.actor, s(p.cohortId, 'cohort'), p, c.now));
register('change.update', (c, p) => Ev.updateChange(c.db, c.actor, n(p.id, 'change'), p, c.now));
register('review.decide', (c, p) => M.recordReviewDecision(c.db, c.actor, s(p.reportId, 'report'), p, c.now));
// ACA-US-14.1
register('pack.proposeFixes', (c, p) => Ev.proposeFixes(c.db, c.actor, s(p.packId, 'pack'), undefined, c.now));
register('pack.decideProposal', (c, p) => Ev.decideProposal(c.db, c.actor, n(p.flagId, 'flag'), p, c.now));
// ACA-US-7.2: load a reviewed evaluation set (docs/ai/evaluation-set-draft.json format) in one step
register('eval.import', async (c, p) => {
  let cases = p.cases; if (typeof cases === 'string') { try { cases = JSON.parse(cases); } catch { throw new LoopError('Not valid JSON.'); } }
  if (cases && !Array.isArray(cases) && Array.isArray((cases as {cases?: unknown}).cases)) cases = (cases as {cases: unknown[]}).cases;
  if (!Array.isArray(cases) || cases.length === 0 || cases.length > 500) throw new LoopError('Provide between 1 and 500 cases.');
  const ids = []; for (const x of cases) ids.push((await A.addEvalCase(c.db, c.actor, x as Record<string, unknown>, c.now)).id);
  return {imported: ids.length};
});
