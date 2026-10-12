// ACA-E8 sessions and threads, ACA-E9 schools and teachers, ACA-E10 evidence, ACA-US-12.5 help, ACA-E14 cohort 2.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {L, T0, DAY, ORIGIN, textileWorld, joinLearners, refused, publishedPack, OWNER_SOURCE, PACK_ITEMS} from './harness.mjs';

const W = n => T0 + n * 7 * DAY + 3600_000;

test('8.1: a session for one level invites only learners at that level, in the app and on their channel; attendance is context only', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const ls = await joinLearners(w, 3, {placeAnswers: i => i === 3 ? {q1: 'c', q2: 'b'} : {q1: 'a', q2: 'a'}});
  const senders = L.outboxSenders(w.db);
  await refused(L.scheduleSession(w.db, w.facilitator, w.cohortId, {level: 'L1', title: 'Invoices', startsAt: '2026-11-20T10:00:00Z', link: 'https://meet.example.test/x'}, senders, ORIGIN, T0), 409); // format not decided
  await L.recordDecision(w.db, w.owner, 'sessions.format', 'global', {cadence: 'monthly', minutes: 45}, OWNER_SOURCE, T0);
  await refused(L.scheduleSession(w.db, ls[0], w.cohortId, {level: 'L1', title: 'x', startsAt: '2026-11-20T10:00:00Z', link: 'https://x.test'}, senders, ORIGIN, T0));
  const r = await L.scheduleSession(w.db, w.facilitator, w.cohortId, {level: 'L1', title: 'Invoices with AI', startsAt: '2026-11-20T10:00:00Z', link: 'https://meet.example.test/x'}, senders, ORIGIN, T0);
  assert.deepEqual([r.invited, r.messaged], [2, 2]);
  assert.equal((await L.mySessions(w.db, ls[2])).length, 0, 'the L3 learner is not invited');
  assert.equal((await L.mySessions(w.db, ls[0])).length, 1);
  const msgs = await w.raw('SELECT to_address, body FROM loop_message_outbox');
  assert.ok(msgs.every(m => /live Aplyd Academy session/.test(m.body)) && msgs.length === 2);
  await L.endSession(w.db, w.facilitator, r.id, [ls[0].memberId], T0 + DAY);
  const att = await w.raw('SELECT member_id, attended FROM loop_session_invites ORDER BY member_id');
  assert.equal(att.filter(a => a.attended === 1).length, 1);
  const m = await L.weeklyMetrics(w.db, [w.cohortId], [1]);
  assert.ok(!JSON.stringify(m).includes('attend'), 'attendance is not a metric');
});

test('8.2: a thread opens after the session for that cohort only; a reported post can be hidden by the facilitator, audited', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  await L.recordDecision(w.db, w.owner, 'sessions.format', 'global', {cadence: 'monthly'}, OWNER_SOURCE, T0);
  const s = await L.scheduleSession(w.db, w.facilitator, w.cohortId, {level: 'L1', title: 'S', startsAt: '2026-11-20T10:00:00Z', link: 'https://meet.example.test/x'}, {}, ORIGIN, T0);
  const {threadId} = await L.endSession(w.db, w.facilitator, s.id, [], T0);
  await L.postToThread(w.db, a, threadId, 'How do you check GST lines?', T0);
  await L.postToThread(w.db, b, threadId, 'Off-topic spam', T0);
  const {id: c2} = await L.createCohort(w.db, w.admin, w.orgId, {name: 'Other cohort'}, T0);
  await L.enrolCohort(w.db, w.admin, c2, {list: 'Out Sider,out@example.test,owner'}, w.send, ORIGIN, T0);
  const out = await w.user('out@example.test'); await L.acceptInvite(w.db, out, w.tokenFor('out@example.test'), {adult: true, consents: {core: true}}, T0);
  await refused(L.readThread(w.db, out, threadId, T0));
  const posts = (await L.readThread(w.db, a, threadId, T0)).posts;
  await L.reportPost(w.db, a, posts[1].id, T0);
  await refused(L.hidePost(w.db, a, posts[1].id, T0));
  await L.hidePost(w.db, w.facilitator, posts[1].id, T0);
  assert.equal((await L.readThread(w.db, b, threadId, T0)).posts[1].body, 'This post was hidden by a facilitator.');
  assert.equal((await w.raw(`SELECT * FROM loop_audit WHERE action='thread.hide' AND outcome='ok'`)).length, 1);
});

test('9.1-9.3: a school needs a signed agreement; teachers only after a go decision with teacher mode; no students in R1; teacher metrics separate', async () => {
  const w = await textileWorld(); await publishedPack(w);
  await refused(L.createOrg(w.db, w.op, {kind: 'school', name: 'School', sector: 'education'}, T0));
  const {id: school} = await L.createOrg(w.db, w.op, {kind: 'school', name: 'Partner School', sector: 'education', agreementRef: 'Synthetic signed MoU'}, T0);
  await L.inviteStaff(w.db, w.op, school, {email: 'head@example.test', name: 'Head', role: 'admin'}, w.send, ORIGIN, T0);
  const head = await w.user('head@example.test'); await L.acceptInvite(w.db, head, w.tokenFor('head@example.test'), {}, T0);
  const {id: tc} = await L.createCohort(w.db, head, school, {name: 'Teachers', workshopDate: '2026-11-02'}, T0);
  await refused(L.enrolCohort(w.db, head, tc, {list: 'T One,t1@example.test,maths'}, w.send, ORIGIN, T0));
  await refused(L.enrolCohort(w.db, head, tc, {list: 'S One,s1@example.test,class 8', role: 'student'}, w.send, ORIGIN, T0));
  await L.recordDecision(w.db, w.owner, 'golive.decision', 'global', {decision: 'go'}, OWNER_SOURCE, T0);
  assert.equal((await L.enrolCohort(w.db, head, tc, {list: 'T One,t1@example.test,maths'}, w.send, ORIGIN, T0)).invited, 1);
  const t1 = await w.user('t1@example.test'); const {memberId: tm} = await L.acceptInvite(w.db, t1, w.tokenFor('t1@example.test'), {adult: true, consents: {core: true}}, T0);
  await refused(L.cohortRoster(w.db, head, w.cohortId, T0)); // school isolated from the association
  const [l1] = await joinLearners(w, 1);
  const tl = await L.ensureWeeklyTask(w.db, l1, l1.memberId, W(1)); await L.submitTask(w.db, l1, tl.taskId, {note: 'x'}, W(1));
  const cmp = await L.compareCohorts(w.db, [w.cohortId, tc], 'role');
  assert.deepEqual(cmp.S01_S02[0].groups.map(g => [g.group, g.S01.numerator, g.S01.denominator]), [['learner', 1, 1], ['teacher', 0, 1]]);
  assert.ok(tm);
});

test('10.1: only the learner asks; the confirmer sees only what was shared and confirms or declines; S-04 at months 3 and 6', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a, b] = await joinLearners(w, 2);
  const t = await L.ensureWeeklyTask(w.db, a, a.memberId, W(1)); const {submissionId} = await L.submitTask(w.db, a, t.taskId, {note: 'PRIVATE NOTE'}, W(1));
  await refused(L.requestConfirmation(w.db, b, submissionId, {email: 'boss@example.test', relation: 'supervisor', sharedText: 'x'}, w.send, ORIGIN, W(1)));
  await refused(L.requestConfirmation(w.db, w.admin, submissionId, {email: 'boss@example.test', relation: 'supervisor', sharedText: 'x'}, w.send, ORIGIN, W(1)));
  assert.equal(w.mails.filter(m => m.to === 'boss@example.test').length, 0, 'no request sent for someone else');
  await L.requestConfirmation(w.db, a, submissionId, {email: 'boss@example.test', relation: 'supervisor', sharedText: 'I now check invoices with AI before paying'}, w.send, ORIGIN, W(1));
  const token = w.mails.find(m => m.to === 'boss@example.test').body.match(/\/loop\/confirm\/([A-Za-z0-9_-]{43})/)[1];
  const view = await L.openConfirmation(w.db, token, W(1));
  assert.deepEqual(view, {learner: 'learner', relation: 'supervisor', shared: 'I now check invoices with AI before paying'});
  await L.decideConfirmation(w.db, token, 'confirmed', W(2));
  await refused(L.decideConfirmation(w.db, token, 'declined', W(2)), 410);
  const s = await L.s04AtMonths(w.db, w.cohortId);
  assert.deepEqual([s.month3[0].S04.numerator, s.month3[0].S04.denominator], [1, 2]);
});

test('10.2 + 10.3: review pack with signals and anonymised interview summaries; consent required; owner decides', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 2, {consents: {core: true, research_interview: true}});
  const cand = await L.interviewCandidates(w.db, w.op, w.cohortId, 1, T0);
  assert.equal(cand.consenting, 2);
  await refused(L.recordInterview(w.db, w.op, {memberId: a.memberId, band: 'most_active', consentConfirmed: false, notes: 'n'}, T0));
  const {id} = await L.recordInterview(w.db, w.op, {memberId: a.memberId, band: 'most_active', consentConfirmed: true, notes: 'Learner said reminders helped.'}, T0);
  await refused(L.summariseInterview(w.db, w.op, id, 'learner 1 liked reminders', T0), 400);
  await L.summariseInterview(w.db, w.op, id, 'A most-active participant said weekly reminders helped them start.', T0);
  const r = await L.prepareReview(w.db, w.op, w.cohortId, 90, W(13));
  assert.equal(r.body.interviews.length, 1); assert.equal(r.body.decision, null);
  assert.ok(r.body.signals.S01_byStartingLevel && r.body.harmByStartingLevel);
  await refused(L.recordReviewDecision(w.db, w.op, r.id, {decision: 'continue'}, W(13)));
  await L.recordReviewDecision(w.db, w.owner, r.id, {decision: 'adjust'}, W(13));
  assert.equal((await L.decision(w.db, 'review.decision', r.id)).value.decision, 'adjust');
});

test('10.4: impact report suppresses small groups, uses only consented examples, and is shared only after owner approval', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1, {consents: {core: true, share_examples: true}, prefix: 'yes'});
  const [b] = await joinLearners(w, 3, {consents: {core: true}, prefix: 'no'});
  for (const p of [a, b]) { const t = await L.ensureWeeklyTask(w.db, p, p.memberId, W(1)); await L.submitTask(w.db, p, t.taskId, {note: p === a ? 'CONSENTED NOTE' : 'PRIVATE NOTE'}, W(1)); }
  const r = await L.prepareImpactReport(w.db, w.op, w.cohortId, 'impact', W(13));
  assert.deepEqual(r.body.consentedExamples, ['CONSENTED NOTE']);
  assert.ok(!JSON.stringify(r.body).includes('PRIVATE NOTE'));
  await refused(L.recordShared(w.db, w.owner, r.id, 'Association chair', W(13)));
  await refused(L.approveReport(w.db, w.op, r.id, W(13)));
  await L.approveReport(w.db, w.owner, r.id, W(13));
  await L.recordShared(w.db, w.owner, r.id, 'Association chair', W(13));
  assert.ok((await L.getReport(w.db, w.op, r.id)).shared_at);
});

test('10.5 + 14.2: change list needs the week-6 decision; a redesign blocks cohort 2 until accepted; cohorts compare by loop version', async () => {
  const w = await textileWorld(); await publishedPack(w);
  await joinLearners(w, 2);
  await refused(L.addChange(w.db, w.op, w.cohortId, {change: 'x', evidence: 'y', expectedSignal: 'S-01'}, T0), 409);
  const rep = await L.prepareWeek6Report(w.db, w.op, w.cohortId, W(7));
  await L.recordA01Decision(w.db, w.owner, rep.id, {decision: 'redesign'}, W(7));
  const {id} = await L.addChange(w.db, w.op, w.cohortId, {change: 'Shorter weekly task', evidence: 'Week-6 report: 0/2 practised 3+ weeks; interviews', expectedSignal: 'S-01'}, W(7));
  assert.match((await L.changeList(w.db, w.cohortId))[0].decision_ref, /redesign/);
  await refused(L.updateChange(w.db, w.op, id, {status: 'compared'}, W(7)), 400);
  await refused(L.createCohort(w.db, w.admin, w.orgId, {name: 'Cohort 2'}, W(8)));
  await L.recordDecision(w.db, w.owner, 'a01.redesign_accepted', w.orgId, {loopVersion: 'loop-2'}, OWNER_SOURCE, W(9));
  const c2 = await L.createCohort(w.db, w.admin, w.orgId, {name: 'Cohort 2'}, W(9));
  const cmp = await L.compareCohorts(w.db, [w.cohortId, c2.id], 'loop_version');
  assert.deepEqual(cmp.cohorts.map(c => c.loop_version).sort(), ['loop-1', 'loop-2']);
});

test('12.5: a problem report is acknowledged and reaches the facilitator queue with time and screen; security reports go to the owner', async () => {
  const w = await textileWorld();
  const [a] = await joinLearners(w, 1);
  const r = await L.reportProblem(w.db, a, {screen: 'task', kind: 'problem', body: 'Upload stuck at 50%'}, w.send, T0);
  assert.match(r.acknowledgement, /facilitators/);
  const q = await L.helpQueue(w.db, w.facilitator, w.orgId, T0);
  assert.deepEqual([q[0].screen, q[0].body, !!q[0].at], ['task', 'Upload stuck at 50%', true]);
  await L.recordDecision(w.db, w.owner, 'help.security_contact', 'global', {email: 'owner@example.test'}, OWNER_SOURCE, T0);
  const s = await L.reportProblem(w.db, a, {screen: 'settings', kind: 'security', body: 'I can see someone else’s name'}, w.send, T0);
  assert.match(s.acknowledgement, /product owner/);
  assert.equal((await L.helpQueue(w.db, w.facilitator, w.orgId, T0)).length, 1, 'security reports are not in the facilitator queue');
  const mail = w.mails.find(m => m.to === 'owner@example.test');
  assert.ok(mail && !mail.body.includes('someone else'), 'owner is told without the report text in email');
  assert.equal((await L.securityQueue(w.db, w.owner, T0)).length, 1);
  await refused(L.securityQueue(w.db, w.op, T0));
});

test('14.1: every logged error gets a proposed fix or a recorded reason before version 2; v2 lists changes and keeps v1', async () => {
  const w = await textileWorld(); const {packId, ids} = await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await L.flagItem(w.db, a, a.memberId, ids[3], 'Unclear for small amounts', T0);
  await L.flagItem(w.db, a, a.memberId, ids[0], 'Fine actually', T0);
  assert.equal((await L.v2Readiness(w.db, w.expert, packId, T0)).ready, false);
  let n = 0; const gen = async () => ({text: n++ === 0 ? '{"kind":"fix","text":"Always re-add totals, including small amounts."}' : '{"kind":"no_change","text":"The task is correct."}'});
  assert.equal((await L.proposeFixes(w.db, w.expert, packId, gen, T0)).proposed, 2);
  const ready = await L.v2Readiness(w.db, w.expert, packId, T0);
  assert.equal(ready.ready, true);
  const fix = ready.flags.find(f => f.kind === 'fix');
  await L.decideProposal(w.db, w.expert, fix.id, {decision: 'accepted'}, T0);
  await L.reviseItem(w.db, w.expert, ids[3], {body: fix.text}, T0);
  const v2 = await L.publishVersion(w.db, w.expert, packId, {now: T0 + 1});
  assert.equal(v2.version, 2); assert.deepEqual(v2.changes.map(c => c.change), ['changed']);
  assert.ok((await L.publishedItems(w.db, packId, 1)).items.some(i => i.id === ids[3]), 'version 1 kept for comparison');
});

test('14.3: the owner’s default cadence applies to new cohorts only', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [old] = await joinLearners(w, 1);
  await L.recordDecision(w.db, w.owner, 'reminders.default_cadence', 'global', {cadence: {id: 'thu', days: [4]}}, OWNER_SOURCE, T0 + DAY);
  const {id: c2} = await L.createCohort(w.db, w.admin, w.orgId, {name: 'Cohort 2', workshopDate: '2026-11-02'}, T0 + 2 * DAY);
  await L.enrolCohort(w.db, w.admin, c2, {list: 'New One,new1@example.test,accountant'}, w.send, ORIGIN, T0 + 2 * DAY);
  const nu = await w.user('new1@example.test'); const {memberId} = await L.acceptInvite(w.db, nu, w.tokenFor('new1@example.test'), {adult: true, consents: {core: true}}, T0 + 2 * DAY);
  assert.deepEqual(await L.reminderDays(w.db, await L.memberById(w.db, memberId)), [4]);
  assert.deepEqual(await L.reminderDays(w.db, await L.memberById(w.db, old.memberId)), [1], 'cohort 1 keeps its weekly day (2 Nov 2026 is a Monday)');
});
