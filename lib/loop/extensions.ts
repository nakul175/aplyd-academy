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

// ---- R3 and R4 (ACA-E11, E13, E15, E16, E19, E20, E21) ----
import * as St from './students';
import * as Br from './briefs';
import * as B from './billing';
import * as Lg from './language';
import * as An from './annotations';
import {recordDecision} from './core';
register('student.enrol', (c, p) => St.enrolStudents(c.db, c.actor, s(p.cohortId, 'cohort'), p.list, send(c.db), c.origin, c.now));
registerPublic('guardian.open', (c, p) => St.openGuardianRequest(c.db, p.token));
registerPublic('guardian.decide', (c, p) => St.decideGuardian(c.db, p.token, p.decision, send(c.db), c.origin, c.now));
register('school.digest', (c, p) => St.schoolReminderDigest(c.db, c.actor, s(p.cohortId, 'cohort'), c.origin, c.now));
register('class.assign', (c, p) => St.assignClassTeacher(c.db, c.actor, s(p.orgId, 'organisation'), p.classLabel, s(p.teacherMemberId, 'teacher'), c.now));
register('class.view', (c, p) => St.classView(c.db, c.actor, s(p.orgId, 'organisation'), p.classLabel, c.now));
register('school.endOfPilot', (c, p) => St.endOfPilot(c.db, c.actor, s(p.orgId, 'organisation'), c.now));
register('harm.prepare', (c, p) => St.prepareHarmReview(c.db, c.actor, s(p.cohortId, 'cohort'), c.now));
register('harm.decide', (c, p) => St.recordHarmDecision(c.db, c.actor, s(p.reportId, 'report'), p, c.now));
register('brief.draft', (c, p) => Br.draftBriefs(c.db, c.actor, s(p.packId, 'pack'), {month: p.month, roles: typeof p.roles === 'string' ? p.roles.split(',').map(x => x.trim()).filter(Boolean) : p.roles, levels: typeof p.levels === 'string' ? p.levels.split(',').map(x => x.trim()).filter(Boolean) : p.levels, sources: typeof p.sources === 'string' ? JSON.parse(p.sources) : p.sources}, undefined, c.now));
register('brief.try', (c, p) => Br.tryBrief(c.db, c.actor, s(p.memberId, 'member'), c.now));
register('renewal.record', (c, p) => B.recordRenewal(c.db, c.actor, s(p.orgId, 'organisation'), p, c.now));
register('cohort.cap', (c, p) => B.setParticipantCap(c.db, c.actor, s(p.cohortId, 'cohort'), p.cap, c.now));
register('invoice.workshop', (c, p) => B.issueWorkshopInvoice(c.db, c.actor, s(p.cohortId, 'cohort'), p, c.now));
register('sponsor.create', (c, p) => B.createSponsor(c.db, c.actor, p, c.now));
register('sponsor.viewer', (c, p) => B.addSponsorViewer(c.db, c.actor, s(p.sponsorId, 'sponsor'), p.email, c.now));
register('sponsor.fund', (c, p) => B.fundSeats(c.db, c.actor, s(p.sponsorId, 'sponsor'), s(p.cohortId, 'cohort'), p.seats, c.now));
register('renewal.accept', (c, p) => B.acceptRenewal(c.db, c.actor, s(p.orgId, 'organisation'), c.now));
register('report.evidencePack', (c, p) => M.prepareEvidencePack(c.db, c.actor, Array.isArray(p.cohortIds) ? p.cohortIds as string[] : String(p.cohortIds ?? '').split(',').map(x => x.trim()).filter(Boolean), c.now));
register('language.set', (c, p) => Lg.setLanguage(c.db, c.actor, p.language, c.now));
register('ui.draft', (c) => Lg.draftUiStrings(c.db, c.actor, undefined, c.now));
register('ui.review', (c, p) => Lg.reviewUiString(c.db, c.actor, p.key, p, c.now));
register('pack.translate', (c, p) => Lg.translatePack(c.db, c.actor, s(p.packId, 'pack'), undefined, c.now));
register('annotation.add', (c, p) => An.annotate(c.db, c.actor, s(p.itemId, 'item'), p, c.now));
register('annotation.status', (c, p) => An.setAnnotationStatus(c.db, c.actor, n(p.id, 'annotation'), p.status, c.now));
register('refinement.propose', (c, p) => An.proposeRefinement(c.db, c.actor, s(p.itemId, 'item'), undefined, c.now));
register('refinement.decide', (c, p) => An.decideRefinement(c.db, c.actor, s(p.refinementId, 'proposal'), p.decision, c.now));
register('risk.decide', (c, p) => recordDecision(c.db, c.actor, 'risk.acceptance', s(p.findingId, 'finding'), {decision: p.decision === 'accept' ? 'accept' : 'reject', note: typeof p.note === 'string' ? p.note.slice(0, 1000) : ''}, `Security findings register, ${s(p.findingId, 'finding')}`, c.now));
