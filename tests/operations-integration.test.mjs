import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTeam,applyTeamCommand,projectTeam,programs,currentRef,workspaceRegistry,deriveWorkspaceOperations} from '../.sites-runtime/operations-integration.mjs';

// Executes actual local source pure-domain transitions and the isolated operations
// integrated read model. This never calls an API, edits checkout, writes D1 or uses real people.
const now='2026-10-05T09:00:00.000Z',assessed='2026-10-05T09:10:00.000Z',appealed='2026-10-05T09:11:00.000Z',resolved='2026-10-05T09:12:00.000Z';
const owner={userId:'synthetic-owner-a',email:'owner-a@gap.test',fullName:'Synthetic owner A'};
const contentReviewer={userId:'synthetic-owner-b',email:'owner-b@gap.test',fullName:'Synthetic owner B'};
const learner={userId:'synthetic-learner',email:'learner@gap.test',fullName:'Synthetic learner'};
const otherLearner={userId:'synthetic-learner-two',email:'learner-two@gap.test',fullName:'Synthetic learner two'};
const staff={userId:'synthetic-assessor',email:'assessor@gap.test',fullName:'Original assessor name'};
const reviewer={userId:'synthetic-reviewer',email:'reviewer@gap.test',fullName:'Original independent reviewer'};
const apply=(team,actor,command,time=now)=>applyTeamCommand(team,actor,command,time);
const enrollment=team=>team.learners.find(l=>l.userId===learner.userId).state.enrollments[0];
const currentDraft=team=>team.content.drafts.at(-1);
const checks={sources:true,answers:true,rubric:true,safety:true,accessibility:true};
let token=0;
function join(team,actor,roles,scopes=[]){const tokenHash=(++token).toString(16).padStart(64,'0');team=apply(team,owner,{type:'invite',email:actor.email,roles,scopes,tokenHash});return apply(team,actor,{type:'accept',tokenHash});}
function base(){let team=createTeam(owner,{name:'Isolated synthetic operations fixture',purpose:'Fictional metadata, review independence and immutable record regression.',context:'msme'},'tw-33333333-3333-3333-3333-333333333333',now);team=join(team,contentReviewer,['admin']);return team;}
function offer(team,program=programs[1],ref){team=apply(team,owner,{type:'cohort-create',title:'A preserved synthetic offering',programId:program.id,capacity:12,...(ref?{contentRef:ref}:{})});const cid=team.cohorts.at(-1).id;team=join(team,learner,['learner']);team=join(team,otherLearner,['learner']);team=join(team,staff,['assessor'],[cid]);team=join(team,reviewer,['reviewer','facilitator'],[cid]);team=apply(team,learner,{type:'enroll',programId:program.id,cohortId:cid});return {team,cid,program};}
function prepare(fixture){let {team,program}=fixture;const e=enrollment(team);for(const lesson of program.lessons)team=apply(team,learner,{type:'lesson',enrollmentId:e.id,lessonId:lesson.id,practice:'A fictional checked response with stable source references and human approval.',answers:lesson.quiz.map(q=>q.correctOptionIndex)});team=apply(team,learner,{type:'submit',enrollmentId:e.id,confirmed:true,fields:Object.fromEntries(program.practicalAssessment.submissionPrompts.map(f=>[f.id,'PRIVATE-SUBMITTED-EVIDENCE-CANARY: fictional source checks and accountable human approval.']))});team=apply(team,learner,{type:'draft',enrollmentId:e.id,fields:{[program.practicalAssessment.submissionPrompts[0].id]:'PRIVATE-UNSENT-DRAFT-CANARY: this later draft is not the submitted snapshot.'}});return {...fixture,team};}
function grading(team,overrides={}){const e=enrollment(team);return {type:'assess',learnerId:learner.userId,enrollmentId:e.id,attemptId:e.attempts.at(-1).id,scores:[4,4,4,4],gates:[true,true,true],notes:Array.from({length:4},(_,i)=>`ORIGINAL-CRITERION-CANARY-${i}: checked against fictional submitted references.`),feedback:'The supplied fictional evidence demonstrates careful checking and an explicit human approval route.',...overrides};}
function assess(fixture){let {team}=fixture;const command=grading(team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:command.attemptId,staffId:staff.userId});team=apply(team,staff,command,assessed);return {...fixture,team};}
function openAppeal(fixture){let {team}=fixture;const e=enrollment(team);team=apply(team,learner,{type:'appeal',enrollmentId:e.id,attemptId:e.attempts.at(-1).id,reason:'Please inspect the original criterion reasoning and the exact fictional evidence reference.'},appealed);return {...fixture,team};}
function assignAppeal(fixture){let {team}=fixture;team=apply(team,owner,{type:'assign',kind:'appeal',targetId:enrollment(team).appeals.at(-1).id,staffId:reviewer.userId});return {...fixture,team};}
function appealDecision(team,overrides={}){const e=enrollment(team),c=grading(team);delete c.attemptId;return {...c,type:'resolve',appealId:e.appeals.at(-1).id,...overrides};}
async function privatePublication(){let team=base();team=await apply(team,owner,{type:'content-copy',sourceRef:currentRef(programs[1].id)});let d=currentDraft(team);const doc=structuredClone(d.document);doc.title='Preserved synthetic private source';doc.summary='A private fictional pathway whose exact source and rubric are preserved through closing new intake.';team=await apply(team,owner,{type:'content-save',draftId:d.id,revision:d.revision,document:doc});d=currentDraft(team);team=await apply(team,owner,{type:'content-submit',draftId:d.id,revision:d.revision,reviewerId:contentReviewer.userId,reviewDueAt:'2027-10-01T00:00:00.000Z'});d=currentDraft(team);team=await apply(team,contentReviewer,{type:'content-review',draftId:d.id,revision:d.revision,decision:'approve',note:'Checked synthetic references, answer explanations, practical anchors, information handling and clear language.',checks});d=currentDraft(team);team=await apply(team,owner,{type:'content-publish',draftId:d.id,revision:d.revision});const p=team.content.publications.at(-1);return {team,program:p.snapshot.program,ref:p.snapshot.ref};}
// The current root projection contains the actual three summary fields.
const authorizedProjection=(team,actor)=>projectTeam(team,actor);
function summaryMetadata(team){const row=projectTeam(team,owner).team.summaries[0];return {practiceRecordStatus:row.practiceRecordStatus,hasOpenAppeal:row.hasOpenAppeal,hasPendingAssessment:row.hasPendingAssessment};}
function atClock(time,read){const Original=Date;globalThis.Date=class extends Original{constructor(...args){super(...(args.length?args:[time]));}static now(){return Original.parse(time);}};try{return read();}finally{globalThis.Date=Original;}}

test('actual root summaries preserve active record AND open appeal independently',()=>{
 const {team,cid}=openAppeal(assess(prepare(offer(base()))));
 const projection=projectTeam(team,owner),e=enrollment(team),summary=projection.team.summaries[0];
 assert.equal(e.record.status,'active');assert.equal(e.appeals[0].status,'open');
 assert.equal(summary.status,'Practice completed');
 assert.equal(projection.team.pending.filter(q=>q.kind==='appeal').length,1);
 const operations=deriveWorkspaceOperations(projection.team,appealed),co=operations.cohorts.find(c=>c.id===cid);
 assert.equal(operations.reviews.appeals,1);assert.equal(co.practiceCompleted,1);
 assert.equal(co.appealPending,1);assert.equal(summary.practiceRecordStatus,'active');assert.equal(summary.hasOpenAppeal,true);assert.equal(summary.hasPendingAssessment,false);
});

test('current assessor authority removal clears pending assignment/read and blocks finalization without mutating evidence',()=>{
 let {team,cid}=prepare(offer(base()));const c=grading(team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:c.attemptId,staffId:staff.userId});assert.equal(projectTeam(team,staff).team.assigned.length,1);
 const fields=structuredClone(enrollment(team).attempts[0].fields);team=apply(team,owner,{type:'member',userId:staff.userId,roles:['assessor'],scopes:[],active:true});assert.equal(team.assignments.length,0);assert.equal(projectTeam(team,staff).team.assigned.length,0);
 assert.throws(()=>apply(team,staff,c),e=>e.status===404);assert.equal(enrollment(team).attempts[0].decision,null);assert.deepEqual(enrollment(team).attempts[0].fields,fields);
 const operations=deriveWorkspaceOperations(projectTeam(team,owner).team,now);assert.equal(operations.reviews.unassigned,1);assert.equal(operations.reviews.withoutEligibleStaff,1);assert.equal(operations.cohorts.find(c=>c.id===cid).reviewPending,1);
});

test('current appeal-reviewer revocation removes body access and cannot finalize against its retained former assignment',()=>{
 let {team}=assignAppeal(openAppeal(assess(prepare(offer(base())))));const original=structuredClone(enrollment(team).attempts[0].decision),record=structuredClone(enrollment(team).record),c=appealDecision(team);assert.equal(projectTeam(team,reviewer).team.assigned.length,1);
 team=apply(team,owner,{type:'member',userId:reviewer.userId,roles:['facilitator'],scopes:[],active:true});assert.equal(projectTeam(team,reviewer).team.assigned.length,0);assert.throws(()=>apply(team,reviewer,c),e=>e.status===404);
 assert.deepEqual(enrollment(team).attempts[0].decision,original);assert.deepEqual(enrollment(team).record,record);assert.equal(enrollment(team).appeals[0].status,'open');
});

test('adverse appeal preserves original decision/issuance and stamps exact independent decision provenance',()=>{
 let {team}=assignAppeal(openAppeal(assess(prepare(offer(base())))));const before=structuredClone(enrollment(team));team=apply(team,reviewer,appealDecision(team,{gates:[false,true,true]}),resolved);const e=enrollment(team);
 assert.deepEqual(e.attempts[0].decision,before.attempts[0].decision);assert.equal(e.record.status,'suspended');assert.equal(e.record.id,before.record.id);assert.equal(e.record.issuedAt,before.record.issuedAt);assert.equal(e.record.contentVersion,e.version);
 assert.equal(e.record.decisionId,e.appeals[0].resolution.id);assert.equal(e.record.lastReviewedAt,resolved);assert.equal(e.record.reviewedBy,reviewer.fullName);
 team=apply(team,reviewer,{type:'profile',name:'Renamed reviewer after decision',context:'msme',reading:false,networking:false});assert.equal(enrollment(team).record.reviewedBy,reviewer.fullName);assert.equal(enrollment(team).appeals[0].resolution.actorName,reviewer.fullName);
});

test('successful retry replaces current record provenance with its own assessor, leaving failed appeal immutable',()=>{
 let fixture=assignAppeal(openAppeal(assess(prepare(offer(base()))))),team=apply(fixture.team,reviewer,appealDecision(fixture.team,{gates:[false,true,true]}),resolved);const oldAppeal=structuredClone(enrollment(team).appeals[0]);let e=enrollment(team);
 team=apply(team,learner,{type:'submit',enrollmentId:e.id,confirmed:true,fields:e.attempts[0].fields},'2026-10-05T09:13:00.000Z');const c=grading(team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:c.attemptId,staffId:staff.userId});team=apply(team,staff,c,'2026-10-05T09:14:00.000Z');e=enrollment(team);
 assert.equal(e.record.status,'active');assert.equal(e.record.decisionId,e.attempts[1].decision.id);assert.equal(e.record.lastReviewedAt,e.attempts[1].decision.decidedAt);assert.equal(e.record.reviewedBy,staff.fullName);assert.deepEqual(e.appeals[0],oldAppeal);
 assert.equal(deriveWorkspaceOperations(projectTeam(team,owner).team,'2026-10-05T09:15:00.000Z').reviews.total,0,'Retained finalized assignments do not create fake pending operational work');
});

test('retired private publication blocks new intake while existing pending assessor retains exact source and can finalize',async()=>{
 const publication=await privatePublication();let fixture=prepare(offer(publication.team,publication.program,publication.ref)),team=fixture.team,e=enrollment(team),c=grading(team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:c.attemptId,staffId:staff.userId});const snapshot=structuredClone(team.content.publications[0].snapshot);
 team=await apply(team,owner,{type:'content-retire',publicationId:publication.ref.versionId,reason:'Close new synthetic intake while preserving enrolled practice and pending decisions.'});
 assert.throws(()=>apply(team,otherLearner,{type:'enroll',programId:publication.program.id,cohortId:fixture.cid}),e=>e.status===409);assert.throws(()=>apply(team,owner,{type:'cohort-create',title:'A new closed offering',programId:publication.program.id,contentRef:publication.ref,capacity:10}),e=>e.status===409);
 team=apply(team,learner,{type:'draft',enrollmentId:e.id,fields:{[publication.program.practicalAssessment.submissionPrompts[0].id]:'Existing private course drafting remains permitted on its exact retired reference.'}});
 const staffProjection=projectTeam(team,staff);assert.equal(staffProjection.team.assigned.length,1);assert.deepEqual(staffProjection.contentVersions[0],snapshot);team=apply(team,staff,c,assessed);assert.equal(enrollment(team).record.contentVersion,publication.ref.versionId);assert.equal(enrollment(team).record.title,publication.program.title);assert.deepEqual(team.content.publications[0].snapshot,snapshot);
 const operations=deriveWorkspaceOperations(projectTeam(team,owner).team,assessed);assert.equal(operations.cohorts[0].newEnrollmentBlocked,true);assert.equal(operations.cohorts[0].practiceCompleted,1);
});

test('review date expiry blocks new private intake without making existing version unresolved or suspending a pending record',async()=>{
 const publication=await privatePublication();let fixture=prepare(offer(publication.team,publication.program,publication.ref)),team=fixture.team,c=grading(fixture.team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:c.attemptId,staffId:staff.userId});const due='2027-10-01T00:00:00.000Z';
 assert.throws(()=>apply(team,otherLearner,{type:'enroll',programId:publication.program.id,cohortId:fixture.cid},due),e=>e.status===409);
 team=apply(team,learner,{type:'lesson-draft',enrollmentId:enrollment(team).id,lessonId:publication.program.lessons[0].id,practice:'Existing saved practice remains on the same immutable overdue version.',answers:[null,null,null]},due);
 team=apply(team,staff,c,due);assert.equal(enrollment(team).record.status,'active');assert.equal(enrollment(team).record.contentVersion,publication.ref.versionId);assert.equal(workspaceRegistry(team).resolve(publication.ref,['global',team.id]).program.title,publication.program.title);
});

test('operations output remains metadata-only even when the legitimate owner projection contains its explicitly assigned evidence',()=>{
 let {team}=prepare(offer(base())),c=grading(team);team=apply(team,owner,{type:'member',userId:owner.userId,roles:['admin','learner','assessor'],scopes:[team.cohorts[0].id],active:true});team=apply(team,owner,{type:'assign',kind:'assessment',targetId:c.attemptId,staffId:owner.userId});const projection=projectTeam(team,owner);
 assert.match(JSON.stringify(projection.team.assigned),/PRIVATE-SUBMITTED-EVIDENCE-CANARY/);const operations=deriveWorkspaceOperations(projection.team,now),serialized=JSON.stringify(operations);assert.doesNotMatch(serialized,/PRIVATE-SUBMITTED-EVIDENCE-CANARY|PRIVATE-UNSENT-DRAFT-CANARY|ORIGINAL-CRITERION-CANARY/);
 assert.equal(operations.reviews.items[0].assignment,'mine');assert.deepEqual(operations.reviews.items[0].destination,{view:'studio',id:c.attemptId});assert.equal(deriveWorkspaceOperations(projectTeam(team,learner).team,now),null);
});

test('actual root thin metadata correctly permits an active record AND open appeal in the same authorized cohort',()=>{
 const {team,cid}=openAppeal(assess(prepare(offer(base())))),before=structuredClone(enrollment(team)),projection=authorizedProjection(team,owner),row=projection.team.summaries[0];
 assert.equal(row.status,'Practice completed','Older status string preserved');assert.deepEqual(summaryMetadata(team),{practiceRecordStatus:'active',hasOpenAppeal:true,hasPendingAssessment:false});
 const operations=deriveWorkspaceOperations(projection.team,appealed),co=operations.cohorts.find(c=>c.id===cid);assert.equal(co.practiceCompleted,1);assert.equal(co.appealPending,1);assert.equal(co.reviewPending,0);assert.equal(operations.totals.practiceRecords,1);assert.equal(operations.reviews.appeals,1);assert.deepEqual(enrollment(team),before,'Pure metadata derivation never suspends or changes a record');
 const facilitator=deriveWorkspaceOperations(authorizedProjection(team,reviewer).team,appealed);assert.equal(facilitator.cohorts[0].practiceCompleted,1);assert.equal(facilitator.cohorts[0].appealPending,1);assert.equal(facilitator.reviews.total,0,'Unassigned appeal does not expose its evidence/assignment queue to facilitator');
});

test('actual root metadata tracks suspended record and pending retry independently, retaining its actual decision history',()=>{
 let {team}=assignAppeal(openAppeal(assess(prepare(offer(base())))));team=apply(team,reviewer,appealDecision(team,{gates:[false,true,true]}),resolved);let e=enrollment(team);const original=structuredClone(e.attempts[0].decision),priorAppeal=structuredClone(e.appeals[0]);
 assert.deepEqual(summaryMetadata(team),{practiceRecordStatus:'suspended',hasOpenAppeal:false,hasPendingAssessment:false});team=apply(team,learner,{type:'submit',enrollmentId:e.id,confirmed:true,fields:e.attempts[0].fields});e=enrollment(team);
 assert.deepEqual(summaryMetadata(team),{practiceRecordStatus:'suspended',hasOpenAppeal:false,hasPendingAssessment:true});const operations=deriveWorkspaceOperations(authorizedProjection(team,owner).team,resolved);assert.equal(operations.cohorts[0].practiceCompleted,0);assert.equal(operations.cohorts[0].suspendedPracticeRecords,1);assert.equal(operations.cohorts[0].reviewPending,1);assert.equal(operations.cohorts[0].appealPending,0);assert.deepEqual(e.attempts[0].decision,original);assert.deepEqual(e.appeals[0],priorAppeal);
});

test('actual root extra summary fields preserve existing scoping and add no submitted evidence or appeal reasons',()=>{
 let {team}=openAppeal(assess(prepare(offer(base()))));team=apply(team,owner,{type:'cohort-create',title:'A separate actual scoped offering',programId:programs[0].id,capacity:12});const first=team.cohorts[0].id,second=team.cohorts[1].id;team=apply(team,owner,{type:'member',userId:reviewer.userId,roles:['facilitator'],scopes:[second],active:true});
 const scoped=authorizedProjection(team,reviewer);assert.equal(scoped.team.summaries.length,0);assert.equal(deriveWorkspaceOperations(scoped.team,appealed).cohorts.length,1);assert.equal(deriveWorkspaceOperations(scoped.team,appealed).cohorts[0].id,second);const ownerProjection=authorizedProjection(team,owner);assert.equal(ownerProjection.team.summaries[0].cohortId,first);assert.doesNotMatch(JSON.stringify(ownerProjection.team.summaries),/PRIVATE-SUBMITTED-EVIDENCE-CANARY|ORIGINAL-CRITERION-CANARY|Please inspect/);assert.equal(authorizedProjection(team,learner).team.summaries.length,0);
});

test('actual clock-aware due projection plus actual independent metadata shows blocked NEW intake and retained active completion together',async()=>{
 const publication=await privatePublication();let fixture=assess(prepare(offer(publication.team,publication.program,publication.ref))),team=fixture.team;const due='2027-10-01T00:00:00.000Z',projection=atClock(due,()=>authorizedProjection(team,owner)),operations=deriveWorkspaceOperations(projection.team,due);
 assert.equal(projection.team.cohorts[0].contentOpen,false);assert.equal(operations.cohorts[0].newEnrollmentBlocked,true);assert.equal(operations.cohorts[0].practiceCompleted,1);assert.equal(operations.totals.practiceRecords,1);assert.equal(operations.content.reviewDue,1);assert.equal(enrollment(team).record.status,'active');
});


test('admitted opaque staff subjects longer than navigation IDs remain correctly assigned metadata',()=>{
 let {team,cid}=prepare(offer(base()));
 const longStaff={...staff,userId:'synthetic-long-'+ 'x'.repeat(205),email:'long-subject@gap.test',fullName:'Long subject staff'};
 team=join(team,longStaff,['assessor'],[cid]);
 const command=grading(team);team=apply(team,owner,{type:'assign',kind:'assessment',targetId:command.attemptId,staffId:longStaff.userId});
 const projection=projectTeam(team,owner),model=deriveWorkspaceOperations(projection.team,now);
 assert.equal(projection.team.pending[0].assignedTo,longStaff.userId);assert.equal(projectTeam(team,longStaff).team.assigned.length,1);
 assert.equal(model.reviews.unassigned,0);assert.equal(model.reviews.items[0].assignment,'assigned');assert.equal(model.reviews.items[0].assignedName,longStaff.fullName);
 assert.ok(!JSON.stringify(model).includes(longStaff.userId));
});
