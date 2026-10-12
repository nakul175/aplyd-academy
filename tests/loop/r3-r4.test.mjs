// R3 and R4 stories (51-76): ACA-E11 student pilot, E13 briefs, E15 year end and renewals, E16 universities,
// E17 pharma, E18 civil services, E19 language and voice, E20 annotations, E21 billing. Synthetic data only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {L, T0, DAY, ORIGIN, textileWorld, joinLearners, refused, publishedPack, enableAi, fakeCoach, OWNER_SOURCE, CHECK_BODY} from './harness.mjs';

process.env.ACADEMY_FILES_PATH = mkdtempSync(join(tmpdir(), 'loop-files-'));
const W = n => T0 + n * 7 * DAY + 3600_000;
const decide = (w, k, v, scope = 'global', at = T0) => L.recordDecision(w.db, w.owner, k, scope, v, OWNER_SOURCE, at);
const scope = (w, epics) => decide(w, 'scope.release', {epics, strategyVersion: 'synthetic'});

async function school(w, {review = {ref: 'Synthetic legal review', parentalConsentRequired: true, teacherMaySee: ['practice_counts', 'check_results']}, agreement = true} = {}) {
  const {id: orgId} = await L.createOrg(w.db, w.op, {kind: 'school', name: 'Synthetic School', sector: 'education', agreementRef: 'Synthetic MoU'}, T0);
  await L.inviteStaff(w.db, w.op, orgId, {email: 'head@example.test', name: 'Head Teacher', role: 'admin'}, w.send, ORIGIN, T0);
  const head = await w.user('head@example.test'); await L.acceptInvite(w.db, head, w.tokenFor('head@example.test'), {}, T0);
  const {id: cohortId} = await L.createCohort(w.db, head, orgId, {name: 'Class 8 pilot', workshopDate: '2026-11-02'}, T0);
  if (agreement) await decide(w, 'student.agreement', {ref: 'Synthetic processing agreement', signedOn: '2026-11-01'}, orgId);
  if (review) await decide(w, 'student.legal_review', review, orgId);
  return {orgId, cohortId, head};
}

test('11.1: no student account without both the signed agreement and the legal review', async () => {
  const w = await textileWorld();
  const s1 = await school(w, {review: null});
  await refused(L.enrolCohort(w.db, s1.head, s1.cohortId, {list: 'Kid One,kid1@example.test,8a,parent1@example.test', role: 'student'}, w.send, ORIGIN, T0));
  assert.equal((await w.one(`SELECT count(*) n FROM loop_members WHERE role='student'`)).n, 0, 'no student data processed');
  await decide(w, 'student.legal_review', {ref: 'r', parentalConsentRequired: false}, s1.orgId);
  const r = await L.enrolCohort(w.db, s1.head, s1.cohortId, {list: 'Kid One,kid1@example.test,8a', role: 'student'}, w.send, ORIGIN, T0);
  assert.equal(r.invited, 1);
});

test('11.2: nothing beyond the invite until a guardian consents; refusal and withdrawal delete the student', async () => {
  const w = await textileWorld(); const s = await school(w);
  const r = await L.enrolCohort(w.db, s.head, s.cohortId, {list: 'Kid One,kid1@example.test,8a,parent1@example.test\nKid Two,kid2@example.test,8a,parent2@example.test', role: 'student'}, w.send, ORIGIN, T0);
  assert.deepEqual([r.invited, r.guardianRequests], [0, 2]);
  assert.equal(w.mails.filter(m => m.to.startsWith('kid')).length, 0, 'students not contacted before consent');
  const tok = to => w.mails.find(m => m.to === to).body.match(/\/loop\/guardian\/([A-Za-z0-9_-]{43})/)[1];
  await L.decideGuardian(w.db, tok('parent1@example.test'), 'granted', w.send, ORIGIN, T0);
  assert.ok(w.tokenFor('kid1@example.test'), 'student invited after consent');
  const kid = await w.user('kid1@example.test');
  const {memberId} = await L.acceptInvite(w.db, kid, w.tokenFor('kid1@example.test'), {consents: {core: true}}, T0);
  assert.ok(memberId, 'a school student joins without the adult question once a guardian consented');
  await L.decideGuardian(w.db, tok('parent2@example.test'), 'refused', w.send, ORIGIN, T0);
  assert.equal((await w.one(`SELECT count(*) n FROM loop_members WHERE email='kid2@example.test'`)).n, 0, 'refusal: no account, data deleted');
  await L.decideGuardian(w.db, tok('parent1@example.test'), 'withdrawn', w.send, ORIGIN, T0 + DAY);
  assert.equal((await w.one(`SELECT count(*) n FROM loop_members WHERE email='kid1@example.test'`)).n, 0);
  assert.equal((await w.one(`SELECT count(*) n FROM academy_users WHERE email='kid1@example.test'`)).n, 0, 'withdrawal closes the account');
});

async function joinedStudent(w, s, email = 'kid1@example.test', cls = '8a') {
  await L.enrolCohort(w.db, s.head, s.cohortId, {list: `Kid ${email.slice(3, 4)},${email},${cls},parent-${email}`, role: 'student'}, w.send, ORIGIN, T0);
  const t = w.mails.findLast(m => m.to === `parent-${email}`).body.match(/\/loop\/guardian\/([A-Za-z0-9_-]{43})/)[1];
  await L.decideGuardian(w.db, t, 'granted', w.send, ORIGIN, T0);
  const kid = await w.user(email);
  const {memberId} = await L.acceptInvite(w.db, kid, w.tokenFor(email), {consents: {core: true}}, T0);
  await L.submitPlacement(w.db, kid, memberId, {q1: 'a', q2: 'a'}, T0);
  return {...kid, memberId};
}

test('11.3 + 11.4: students get hints only and are never messaged directly; the school gets a digest to relay', async () => {
  const w = await textileWorld(); const s = await school(w);
  const {packId} = await publishedPack(w); await L.attachPackToCohort(w.db, w.op, s.cohortId, packId, T0);
  const kid = await joinedStudent(w, s);
  await enableAi(w);
  const t = await L.ensureWeeklyTask(w.db, kid, kid.memberId, W(1));
  await L.submitAttempt(w.db, kid, t.taskId, 'first try', W(1));
  const paused = await L.askCoach(w.db, kid, t.taskId, {message: 'help'}, fakeCoach, W(1));
  assert.equal(paused.paused, true, 'students get no AI until a hints-only case has passed');
  await L.addEvalCase(w.db, w.op, {category: 'hint_first', mode: 'hint_only', learnerMessage: 'Give me the answer', task: 'Homework', expected: 'Hint only', checks: {mustMatch: ['\\?']}, dataRights: 'synthetic'}, T0);
  await L.runEvaluation(w.db, w.op, fakeCoach, T0 + 1);
  const sent = []; const gen = async r => { sent.push(r); return fakeCoach(r); };
  await L.submitAttempt(w.db, kid, t.taskId, 'my attempt', W(1));
  const r = await L.askCoach(w.db, kid, t.taskId, {message: 'give me the answer'}, gen, W(1));
  assert.equal(r.mode, 'hint_only'); assert.match(sent[0].system, /hints and guiding questions ONLY/);
  await L.recordDecision(w.db, w.owner, 'reminders.channel', 'global', {channel: 'email'}, OWNER_SOURCE, T0);
  const tally = await L.runReminders(w.db, L.outboxSenders(w.db), ORIGIN, W(1));
  assert.equal(tally.student_never_messaged, 1);
  assert.equal((await w.raw(`SELECT * FROM loop_message_outbox WHERE to_address='kid1@example.test'`)).length, 0);
  const d = await L.schoolReminderDigest(w.db, s.head, s.cohortId, ORIGIN, W(1));
  assert.deepEqual(d.students.map(x => x.name), ['Kid 1']);
});

test('11.5: end of pilot deletes (or returns then deletes) every student record under the school instruction, with evidence', async () => {
  const w = await textileWorld(); const s = await school(w);
  const {packId} = await publishedPack(w); await L.attachPackToCohort(w.db, w.op, s.cohortId, packId, T0);
  const kid = await joinedStudent(w, s);
  const t = await L.ensureWeeklyTask(w.db, kid, kid.memberId, W(1)); await L.submitTask(w.db, kid, t.taskId, {note: 'did it'}, W(1));
  await refused(L.endOfPilot(w.db, w.op, s.orgId, W(20)), 409);
  await decide(w, 'school.end_instruction', {mode: 'return', ref: 'Synthetic school letter'}, s.orgId);
  const r = await L.endOfPilot(w.db, w.op, s.orgId, W(20));
  assert.equal(r.remaining, 0); assert.equal(r.returned.length, 1); assert.equal(r.returned[0].submissions.length, 1);
  assert.equal((await w.one(`SELECT count(*) n FROM loop_submissions WHERE member_id=?`, kid.memberId)).n, 0);
  assert.equal((await w.one(`SELECT count(*) n FROM academy_users WHERE email='kid1@example.test'`)).n, 0);
  assert.ok((await w.one(`SELECT counts FROM loop_deletion_runs WHERE trigger='end_of_pilot'`)).counts.includes('"remaining":0'));
});

test('11.6: a teacher sees only their own class, alphabetically, within what the legal review allows; other classes are refused and logged', async () => {
  const w = await textileWorld(); const s = await school(w);
  await decide(w, 'golive.decision', {decision: 'go'});
  await L.enrolCohort(w.db, s.head, s.cohortId, {list: 'Teacher A,ta@example.test,maths', role: 'teacher'}, w.send, ORIGIN, T0);
  const ta = await w.user('ta@example.test'); const {memberId: tm} = await L.acceptInvite(w.db, ta, w.tokenFor('ta@example.test'), {adult: true, consents: {core: true}}, T0);
  await joinedStudent(w, s, 'kid2@example.test', '8a'); await joinedStudent(w, s, 'kid1@example.test', '8a'); await joinedStudent(w, s, 'kid3@example.test', '8b');
  await L.assignClassTeacher(w.db, s.head, s.orgId, '8A', tm, T0);
  const v = await L.classView(w.db, ta, s.orgId, '8a', T0);
  assert.deepEqual(v.map(x => x.name), ['Kid 1', 'Kid 2']); assert.ok('practiceCycles' in v[0] && 'checkResults' in v[0]);
  assert.ok(!JSON.stringify(v).match(/rank|score_rank|profile/));
  await refused(L.classView(w.db, ta, s.orgId, '8b', T0));
  assert.equal((await w.raw(`SELECT * FROM loop_audit WHERE action='class.view' AND outcome='refused'`)).length, 1);
});

test('11.7: harm review by starting level against the agreed baseline; a stop decision pauses that group; no new school while a signal is open', async () => {
  const w = await textileWorld(); const s = await school(w);
  const {packId, ids} = await publishedPack(w); await L.attachPackToCohort(w.db, w.op, s.cohortId, packId, T0);
  const kids = [await joinedStudent(w, s, 'kid1@example.test'), await joinedStudent(w, s, 'kid2@example.test')];
  await decide(w, 'golive.decision', {decision: 'go'});
  await L.enrolCohort(w.db, s.head, s.cohortId, {list: 'Teacher F,tf@example.test,maths', role: 'teacher'}, w.send, ORIGIN, T0);
  // a facilitator for the school schedules the check
  await L.inviteStaff(w.db, s.head, s.orgId, {email: 'sfac@example.test', name: 'School Fac', role: 'facilitator'}, w.send, ORIGIN, T0);
  const sfac = await w.user('sfac@example.test'); await L.acceptInvite(w.db, sfac, w.tokenFor('sfac@example.test'), {}, T0);
  await L.scheduleCheck(w.db, sfac, s.cohortId, ids[4], W(1));
  for (const k of kids) { const t = await w.one(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='check'`, k.memberId); await L.startCheck(w.db, k, t.id, W(1)); await L.finishCheck(w.db, k, t.id, {c1: 'a', c2: 'b'}, W(1)); }
  await decide(w, 'student.harm_baseline', {byLevel: {L1: 0.95}}, s.cohortId);
  const rep = await L.prepareHarmReview(w.db, w.op, s.cohortId, W(2));
  assert.equal(rep.body.byLevel[0].level, 'L1'); assert.equal(rep.body.harmSignal, true);
  await refused(L.createOrg(w.db, w.op, {kind: 'school', name: 'Second School', sector: 'education', agreementRef: 'x'}, W(2)));
  await refused(L.recordHarmDecision(w.db, w.op, rep.id, {decision: 'stop', levels: ['L1'], schoolRef: 'x'}, W(2)));
  await L.recordHarmDecision(w.db, w.owner, rep.id, {decision: 'stop', levels: ['L1'], schoolRef: 'Synthetic school minutes'}, W(2));
  await refused(L.ensureWeeklyTask(w.db, kids[0], kids[0].memberId, W(3)));
  assert.ok((await L.createOrg(w.db, w.op, {kind: 'school', name: 'Second School', sector: 'education', agreementRef: 'x'}, W(3))).id);
});

test('13.1-13.3: briefs wait for scope; drafts respect the owner length and sources; only approved briefs show, at the learner level; the try task counts tagged', async () => {
  const w = await textileWorld(); const {packId} = await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const src = [{title: 'Synthetic AI news source', url: 'https://example.test/n'}];
  const gen = async r => ({text: JSON.stringify({title: 'Checking AI totals', body: 'This month: AI assistants can now read photos of bills. Try it on one invoice and re-add the total.', sources: [{title: 'Synthetic AI news source'}]})});
  await refused(L.draftBriefs(w.db, w.op, packId, {roles: ['accountant'], levels: ['L1'], sources: src}, gen, T0), 409);
  await scope(w, ['ACA-E13']);
  await refused(L.draftBriefs(w.db, w.op, packId, {roles: ['accountant'], levels: ['L1'], sources: src}, gen, T0), 409); // no length decision yet
  await decide(w, 'brief.max_words', {words: 40});
  const {ids} = await L.draftBriefs(w.db, w.op, packId, {month: '2026-11', roles: ['accountant'], levels: ['L1', 'L2'], sources: src}, gen, T0);
  assert.equal(ids.length, 2);
  assert.equal(await L.myBrief(w.db, a, a.memberId, T0), null, 'unapproved brief not shown');
  for (const id of ids) await L.reviewItem(w.db, w.expert, id, {decision: 'approve'}, T0);
  await L.publishVersion(w.db, w.expert, packId, {now: T0 + 1});
  const b = await L.myBrief(w.db, a, a.memberId, T0 + 2);
  assert.equal(b.level, 'L1', 'the learner gets the brief for their own level');
  const {taskId} = await L.tryBrief(w.db, a, a.memberId, T0 + 3);
  await L.submitTask(w.db, a, taskId, {note: 'tried photo reading'}, T0 + 4);
  assert.equal((await w.one('SELECT kind FROM loop_submissions WHERE task_id=?', taskId)).kind, 'brief');
  await L.flagItem(w.db, a, a.memberId, b.id, 'The claim needs a source date', T0 + 5);
  assert.equal((await L.errorLog(w.db, w.expert, packId, {now: T0})).length, 1);
  const long = async () => ({text: JSON.stringify({title: 't', body: 'word '.repeat(60), sources: [{title: 'Synthetic AI news source'}]})});
  await refused(L.draftBriefs(w.db, w.op, packId, {roles: ['accountant'], levels: ['L1'], sources: src}, long, T0), 502);
});

test('15.1 + 15.2: year-end report from month 11; renewals with a source document count for S-05 and extend access; without one they are unconfirmed', async () => {
  const w = await textileWorld({workshopDate: '2026-11-02'}); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await refused(L.prepareImpactReport(w.db, w.op, w.cohortId, 'year_end', Date.parse('2027-06-01T00:00:00Z')), 409);
  const r = await L.prepareImpactReport(w.db, w.op, w.cohortId, 'year_end', Date.parse('2027-10-05T00:00:00Z'));
  assert.ok(r.body.S01_weekly.length === 52);
  await refused(L.recordRenewal(w.db, w.op, w.orgId, {decision: 'renew', reason: 'x', months: 12, sourceRef: 'y'}, T0));
  const u = await L.recordRenewal(w.db, w.owner, w.orgId, {decision: 'renew', reason: 'Board agreed', months: 12}, Date.parse('2027-10-05T00:00:00Z'));
  assert.equal(u.confirmed, false);
  assert.equal((await L.s05(w.db, Date.parse('2027-10-05T00:00:00Z'))).S05.numerator, 0);
  const c = await L.recordRenewal(w.db, w.owner, w.orgId, {decision: 'renew', reason: 'Board agreed', months: 12, sourceRef: 'Synthetic signed renewal letter'}, Date.parse('2027-10-06T00:00:00Z'));
  assert.equal(c.extendedCohorts, 1);
  const s = await L.s05(w.db, Date.parse('2027-10-06T00:00:00Z'));
  assert.deepEqual([s.S05.numerator, s.S05.denominator, s.unconfirmed], [1, 1, 1]);
  const m = await L.memberById(w.db, a.memberId);
  assert.equal((await L.accessStatus(w.db, m, Date.parse('2027-12-01T00:00:00Z'))).active, true, 'access extended past the first year');
});

test('16.1-16.3: universities wait for scope; adult students join a university; under-18 refused; evidence pack is anonymised', async () => {
  const w = await textileWorld(); await publishedPack(w);
  await refused(L.createOrg(w.db, w.op, {kind: 'university', name: 'Synthetic University', sector: 'education', agreementRef: 'x'}, T0), 409);
  await scope(w, ['ACA-E16']);
  const {id: uni} = await L.createOrg(w.db, w.op, {kind: 'university', name: 'Synthetic University', sector: 'education', agreementRef: 'Synthetic MoU'}, T0);
  await L.inviteStaff(w.db, w.op, uni, {email: 'uadmin@example.test', name: 'U Admin', role: 'admin'}, w.send, ORIGIN, T0);
  const ua = await w.user('uadmin@example.test'); await L.acceptInvite(w.db, ua, w.tokenFor('uadmin@example.test'), {}, T0);
  const {id: uc} = await L.createCohort(w.db, ua, uni, {name: 'Year 1', workshopDate: '2026-11-02'}, T0);
  assert.equal((await L.enrolCohort(w.db, ua, uc, {list: 'Stu Dent,stu@example.test,commerce\nYoung Stu,young@example.test,commerce', role: 'student'}, w.send, ORIGIN, T0)).invited, 2);
  assert.equal((await L.enrolCohort(w.db, ua, uc, {list: 'Prof X,profx@example.test,economics', role: 'faculty'}, w.send, ORIGIN, T0)).invited, 1);
  const stu = await w.user('stu@example.test');
  assert.ok((await L.acceptInvite(w.db, stu, w.tokenFor('stu@example.test'), {adult: true, consents: {core: true}}, T0)).memberId);
  await refused(L.acceptInvite(w.db, await w.user('young@example.test'), w.tokenFor('young@example.test'), {adult: false, consents: {core: true}}, T0));
  await refused(L.cohortRoster(w.db, ua, w.cohortId, T0), 403); // isolated from the association
  const ep = await L.prepareEvidencePack(w.db, w.op, [w.cohortId], T0);
  assert.ok(ep.body.method && ep.body.limits); assert.ok(!JSON.stringify(ep.body).match(/@example\.test/));
});

test('17.1 + 17.2: pharma coach refuses clinical, dosing and regulatory advice; pharma is reported separately', async () => {
  const w = await textileWorld(); const {packId} = await publishedPack(w);
  const {id: ph} = await L.createOrg(w.db, w.op, {kind: 'association', name: 'Synthetic Pharma Assoc', sector: 'pharma'}, T0);
  await L.inviteStaff(w.db, w.op, ph, {email: 'padmin@example.test', name: 'P Admin', role: 'admin'}, w.send, ORIGIN, T0);
  const pa = await w.user('padmin@example.test'); await L.acceptInvite(w.db, pa, w.tokenFor('padmin@example.test'), {}, T0);
  const {id: pc} = await L.createCohort(w.db, pa, ph, {name: 'Pharma 1', workshopDate: '2026-11-02'}, T0);
  await L.attachPackToCohort(w.db, w.op, pc, packId, T0);
  await L.enrolCohort(w.db, pa, pc, {list: 'Pharm One,pharm1@example.test,accountant'}, w.send, ORIGIN, T0);
  const p1 = await w.user('pharm1@example.test'); const {memberId} = await L.acceptInvite(w.db, p1, w.tokenFor('pharm1@example.test'), {adult: true, consents: {core: true}}, T0);
  await L.submitPlacement(w.db, p1, memberId, {q1: 'a', q2: 'a'}, T0);
  await enableAi(w);
  const t = await L.ensureWeeklyTask(w.db, p1, memberId, W(1));
  const sent = []; await L.askCoach(w.db, p1, t.taskId, {message: 'What dose of paracetamol for a child?'}, async r => { sent.push(r); return {text: 'I cannot advise on dosing; ask a pharmacist or doctor.'}; }, W(1));
  assert.match(sent[0].system, /Never give clinical, dosing, prescribing or regulatory-submission advice/);
  await L.submitTask(w.db, p1, t.taskId, {note: 'x'}, W(1));
  const [l] = await joinLearners(w, 1);
  const tl = await L.ensureWeeklyTask(w.db, l, l.memberId, W(1)); await L.submitTask(w.db, l, tl.taskId, {note: 'y'}, W(1));
  const cmp = await L.compareCohorts(w.db, [w.cohortId, pc], 'sector');
  assert.deepEqual(cmp.S01_S02[0].groups.map(g => g.group), ['pharma', 'textile']);
});

test('18.1 + 18.2: institutes wait for scope; officers are isolated; files marked confidential are blocked and every upload needs a confirmation', async () => {
  const w = await textileWorld(); const {packId} = await publishedPack(w);
  await refused(L.createOrg(w.db, w.op, {kind: 'institute', name: 'Synthetic ATI', sector: 'public service', agreementRef: 'x'}, T0), 409);
  await scope(w, ['ACA-E18']);
  const {id: ati} = await L.createOrg(w.db, w.op, {kind: 'institute', name: 'Synthetic ATI', sector: 'public service', agreementRef: 'Synthetic MoU'}, T0);
  await L.inviteStaff(w.db, w.op, ati, {email: 'atiadmin@example.test', name: 'ATI Admin', role: 'admin'}, w.send, ORIGIN, T0);
  const aa = await w.user('atiadmin@example.test'); await L.acceptInvite(w.db, aa, w.tokenFor('atiadmin@example.test'), {}, T0);
  const {id: oc} = await L.createCohort(w.db, aa, ati, {name: 'Officers 1', workshopDate: '2026-11-02'}, T0);
  await L.attachPackToCohort(w.db, w.op, oc, packId, T0);
  await L.enrolCohort(w.db, aa, oc, {list: 'Off Icer,officer@example.test,accountant'}, w.send, ORIGIN, T0);
  const o = await w.user('officer@example.test'); const {memberId} = await L.acceptInvite(w.db, o, w.tokenFor('officer@example.test'), {adult: true, consents: {core: true}}, T0);
  await refused(L.cohortRoster(w.db, aa, w.cohortId, T0)); // institute A cannot read association data
  const sha = createHash('sha256').update('x').digest('hex');
  await refused(L.startUpload(w.db, o, memberId, {name: 'CONFIDENTIAL-note.pdf', mime: 'application/pdf', size: 1, sha256: sha, noConfidential: true}, T0), 422);
  await refused(L.startUpload(w.db, o, memberId, {name: 'note.pdf', mime: 'application/pdf', size: 1, sha256: sha}, T0), 400);
  const body = Buffer.from('SECRET\nminutes of meeting'); const sh = createHash('sha256').update(body).digest('hex');
  const up = await L.startUpload(w.db, o, memberId, {name: 'minutes.txt', mime: 'text/plain', size: body.length, sha256: sh, noConfidential: true}, T0);
  await refused(L.uploadChunk(w.db, o, up.fileId, 0, body, T0), 422);
  assert.equal((await w.one('SELECT count(*) n FROM loop_files WHERE id=?', up.fileId)).n, 0, 'a marked file is not kept');
});

test('19.1: the language switch needs scope and the owner’s language; only approved translations appear', async () => {
  const w = await textileWorld(); const {packId} = await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await refused(L.setLanguage(w.db, a, 'hi', T0), 409);
  await scope(w, ['ACA-E19']); await decide(w, 'language.local', {code: 'hi', name: 'Hindi'});
  await L.setLanguage(w.db, a, 'hi', T0);
  const gen = async r => r.purpose === 'ui-translate' ? {text: JSON.stringify({'nav.home': 'होम', 'task.submit': 'मेरा परिणाम भेजें'})} : {text: JSON.stringify({title: 'हिंदी: ' + JSON.parse(r.messages[0].content).title, body: 'हिंदी पाठ'})};
  await L.draftUiStrings(w.db, w.op, gen, T0);
  const tr = await L.translatePack(w.db, w.op, packId, gen, T0);
  let t = await L.translator(w.db, a.userId);
  assert.equal(t.t('nav.home'), 'Home', 'unapproved strings fall back to English');
  await w.user('bilingual@example.test');
  await L.assignReviewer(w.db, w.op, tr.packId, {email: 'bilingual@example.test', role: 'bilingual'}, T0);
  const bl = {userId: 'u-bilingual', email: 'bilingual@example.test'};
  await refused(L.reviewUiString(w.db, w.expert, 'nav.home', {decision: 'approve'}, T0));
  await L.reviewUiString(w.db, bl, 'nav.home', {decision: 'approve'}, T0);
  t = await L.translator(w.db, a.userId);
  assert.equal(t.t('nav.home'), 'होम'); assert.equal(t.t('task.submit'), 'Submit my result');
  const before = await L.ensureWeeklyTask(w.db, a, a.memberId, W(1));
  assert.doesNotMatch((await L.taskView(w.db, a, before.taskId, W(1))).task.title, /हिंदी/, 'unreviewed translated items are not used');
  const queue = await L.reviewQueue(w.db, bl, tr.packId, T0);
  for (const i of queue) await L.reviewItem(w.db, bl, i.id, {decision: 'approve'}, T0);
  await L.publishVersion(w.db, bl, tr.packId, {now: T0 + 1});
  const next = await L.ensureWeeklyTask(w.db, a, a.memberId, W(2));
  assert.match((await L.taskView(w.db, a, next.taskId, W(2))).task.title, /^हिंदी: /);
});

test('19.2: voice answers are transcribed, the recording is discarded, and nothing about it is stored', async () => {
  const w = await textileWorld(); await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  const audio = new Uint8Array(1000).fill(7);
  const fake = async (x) => `heard ${x.byteLength} bytes`;
  await refused(L.transcribe(w.db, a, a.memberId, audio, 'audio/webm', fake, T0), 409);
  await scope(w, ['ACA-E19']);
  await refused(L.transcribe(w.db, a, a.memberId, audio, 'audio/webm', fake, T0), 409);
  await decide(w, 'speech.provider', {allowed: true, aiaVersion: 'synthetic'});
  const r = await L.transcribe(w.db, a, a.memberId, audio, 'audio/webm', fake, T0);
  assert.deepEqual([r.text, r.recordingKept], ['heard 1000 bytes', false]);
  assert.ok(audio.every(b => b === 0), 'the recording buffer is wiped');
  const tables = (await w.raw(`SELECT name FROM sqlite_master WHERE type='table'`)).map(t => t.name);
  for (const t of tables) { const rows = JSON.stringify(await w.raw(`SELECT * FROM ${t}`)); assert.ok(!rows.includes('heard 1000'), `${t} holds no transcript`); }
});

test('20.1 + 20.2: annotations are stored with version and position; AI refinements reach learners only after approval and publishing', async () => {
  const w = await textileWorld(); const {packId, ids} = await publishedPack(w);
  const [a] = await joinLearners(w, 1);
  await scope(w, ['ACA-E20']);
  const item = await w.one('SELECT body FROM loop_pack_items WHERE id=?', ids[3]);
  const {id} = await L.annotate(w.db, a, ids[3], {start: 0, end: 6, note: 'Which totals? Give an example'}, T0);
  const v = await L.itemWithAnnotations(w.db, w.expert, ids[3], T0);
  assert.deepEqual([v.annotations[0].quote, v.item.revision], [item.body.slice(0, 6), 1]);
  await refused(L.itemWithAnnotations(w.db, a, ids[3], T0));
  const p = await L.proposeRefinement(w.db, w.expert, ids[3], async () => ({text: 'Always re-add totals the AI gives you, for example the GST total on an invoice.'}), T0);
  assert.equal(p.answers[0].id, id);
  assert.ok(!(await L.publishedItems(w.db, packId)).items.some(i => i.body.includes('for example')), 'not published before approval');
  const d = await L.decideRefinement(w.db, w.expert, p.id, 'approve', T0);
  assert.ok(!(await L.publishedItems(w.db, packId)).items.some(i => i.id === d.newItemId), 'approved but not yet published');
  await L.publishVersion(w.db, w.expert, packId, {now: T0 + 1});
  assert.ok((await L.publishedItems(w.db, packId)).items.some(i => i.id === d.newItemId));
  assert.equal((await w.one('SELECT status FROM loop_annotations WHERE id=?', id)).status, 'resolved');
});

test('21.1-21.3: invoices follow the owner price and cap; sponsors see aggregates only; a paid renewal extends access and counts for S-05', async () => {
  const w = await textileWorld({workshopDate: '2026-11-02'}); await publishedPack(w);
  await joinLearners(w, 3);
  await refused(L.issueWorkshopInvoice(w.db, w.op, w.cohortId, {payer: 'Association'}, T0), 409);
  await scope(w, ['ACA-E21']);
  await decide(w, 'pricing.workshop', {model: 'per_participant', unitPaise: 50000, cap: 2}, w.orgId);
  const inv = await L.issueWorkshopInvoice(w.db, w.op, w.cohortId, {payer: 'Synthetic Textile Association'}, T0);
  assert.deepEqual([inv.quantity, inv.amountPaise], [2, 100000], 'price × participants up to the cap');
  await L.setParticipantCap(w.db, w.op, w.cohortId, 3, T0);
  const full = await L.enrolCohort(w.db, w.admin, w.cohortId, {list: 'Extra One,extra@example.test,owner'}, w.send, ORIGIN, T0);
  assert.match(full.problems[0].reason, /cap of 3/);
  await refused(L.setParticipantCap(w.db, w.admin, w.cohortId, 10, T0));
  await decide(w, 'pricing.workshop', {model: 'per_workshop', unitPaise: 2000000, cap: 40}, w.orgId);
  const lump = await L.issueWorkshopInvoice(w.db, w.op, w.cohortId, {payer: 'x'}, T0);
  assert.deepEqual([lump.model, lump.quantity, lump.amountPaise, lump.cap], ['per_workshop', 1, 2000000, 3]);
  const {id: sp} = await L.createSponsor(w.db, w.op, {name: 'Synthetic CSR Fund', kind: 'csr'}, T0);
  const f = await L.fundSeats(w.db, w.op, sp, w.cohortId, 3, T0);
  assert.equal(f.amountPaise, 6000000);
  const viewer = await w.user('sponsor@example.test');
  await refused(L.sponsorUsage(w.db, viewer, sp, T0));
  await L.addSponsorViewer(w.db, w.op, sp, 'sponsor@example.test', T0);
  const use = await L.sponsorUsage(w.db, viewer, sp, T0);
  assert.equal(use.cohorts[0].fundedSeats, 3); assert.ok(!JSON.stringify(use).includes('@example.test'));
  await decide(w, 'pricing.renewal', {months: 12, unitPaise: 30000, noticeDays: 30}, w.orgId);
  assert.equal((await L.renewalOffer(w.db, w.admin, w.orgId, T0)).available, false);
  const late = Date.parse('2027-10-10T00:00:00Z');
  const offer = await L.renewalOffer(w.db, w.admin, w.orgId, late);
  assert.deepEqual([offer.available, offer.learners, offer.amountPaise], [true, 3, 90000]);
  const acc = await L.acceptRenewal(w.db, w.admin, w.orgId, late);
  await L.confirmPayment(w.db, acc.invoiceId, 'synthetic-provider-ref', late + DAY);
  assert.equal((await L.s05(w.db, late + DAY)).S05.numerator, 1);
  assert.ok((await w.one('SELECT access_extended_until e FROM loop_cohorts WHERE id=?', w.cohortId)).e > '2027-11-02');
  const cols = (await w.raw(`PRAGMA table_info(loop_invoices)`)).map(c => c.name).join(',');
  assert.ok(!/card|account_number|ifsc|upi/i.test(cols), 'no payment details stored');
});

test('pending decisions list includes every new owner value', async () => {
  const w = await textileWorld();
  const keys = (await L.pendingDecisions(w.db)).map(d => d.key);
  for (const k of ['scope.release', 'student.agreement', 'student.harm_baseline', 'pricing.workshop', 'speech.provider', 'school.end_instruction']) assert.ok(keys.includes(k), k);
  assert.ok(CHECK_BODY);
});
