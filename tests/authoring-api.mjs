import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Candidate for the future authoring integration. Synthetic local identities only.
const app=resolve(process.env.ACADEMY_APP_PATH??'.');
const base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Authoring QA is restricted to a local synthetic server.');
const seed=JSON.parse(readFileSync(resolve(app,'lib/curriculum-versions/0.1-review-draft.json'),'utf8'));
const archiveBefore=readFileSync(resolve(app,'lib/curriculum-versions/0.1-review-draft.json'));
const archiveHash=createHash('sha256').update(archiveBefore).digest('hex');
const out=resolve(process.env.ACADEMY_AUTHORING_QA_OUTPUT??dirname(fileURLToPath(import.meta.url)),'authoring-api-evidence.json');
const nonce=crypto.randomUUID(),id=r=>({id:'qa-content-'+r+'-'+nonce,email:r+'-'+nonce+'@academy.test',name:'Synthetic content '+r});
const owner=id('owner'),reviewer=id('reviewer'),learner=id('learner'),newLearner=id('new-learner'),staff=id('staff'),outsider=id('outsider'),otherOwner=id('other-owner');
const header=u=>({'Content-Type':'application/json','oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':encodeURIComponent(u.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
const parsed=async r=>({status:r.status,...await r.json()});
const get=(u,path='/api/teams')=>fetch(base+path,{headers:header(u)}).then(parsed);
const post=(u,teamId,command,revision,actionId=crypto.randomUUID())=>fetch(base+'/api/teams',{method:'POST',headers:header(u),body:JSON.stringify({teamId,command,revision,actionId})}).then(parsed);
const current=(u,teamId)=>get(u,'/api/teams?id='+encodeURIComponent(teamId));
async function action(u,teamId,c){const x=success(await current(u,teamId));return post(u,teamId,c,x.revision);}
let assertions=0,error;const scenarios=[];
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const truth=(v,message)=>{assert.ok(v,message);assertions++;};
const success=x=>{equal(x.status,200,JSON.stringify(x));return x;};
const denied=(x,expected)=>{equal(x.status,expected,JSON.stringify(x));return x;};
async function scenario(name,fn){const started=assertions;try{await fn();scenarios.push({name,passed:true,assertions:assertions-started});}catch(e){scenarios.push({name,passed:false,assertions:assertions-started,error:e.message});throw e;}}

// Only adapt this accessor block if root chooses another reviewed response shape.
const drafts=x=>x.team.content?.drafts??[];
const publications=x=>x.team.content?.publications??[];
const versions=x=>x.contentVersions??[];
const draft=(x,draftId)=>{const d=drafts(x).find(d=>d.id===draftId);truth(d,'Expected owner-only authoring draft in canonical projection');return d;};
const snapshot=(x,ref)=>{const s=versions(x).find(s=>s.ref.scope===ref.scope&&s.ref.programId===ref.programId&&s.ref.versionId===ref.versionId);truth(s,'Expected exact published version in authorized projection');return s;};
const enrollment=(x,enrollmentId)=>{const e=x.state.enrollments.find(e=>e.id===enrollmentId);truth(e,'Expected own enrollment');return e;};
const checks={sources:true,answers:true,rubric:true,safety:true,accessibility:true};
const due=new Date(Date.now()+365*86400000).toISOString();
const sourceRef={scope:'global',programId:seed.pathways[1].id,versionId:'0.1-review-draft'};
const classification='Private workspace practice draft · nonaccredited';
const privateDraftCanary='UNPUBLISHED-DRAFT-'+nonce,reviewCanary='PRIVATE-CONTENT-REVIEW-'+nonce;
let teamId,otherTeamId,draftId,ref1,ref2,doc1,doc2,cohort1,cohort2,enrollment1,attemptId;
async function join(u,roles,scopes=[]){const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');success(await action(owner,teamId,{type:'invite',email:u.email,roles,scopes,token}));const preview=success(await get(u,'/api/teams?invite='+token));return success(await post(u,teamId,{type:'accept',token},preview.revision));}
async function content(u,type,payload={}){return action(u,teamId,{type,...payload});}
async function reviewAndPublish(draftId){let x=success(await current(owner,teamId)),d=draft(x,draftId);x=success(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}));d=draft(x,draftId);x=success(await content(reviewer,'content-review',{draftId,revision:d.revision,decision:'approve',note:'The fictional references, answer keys, practical anchors and bounded human review are coherent. '+reviewCanary,checks}));d=draft(x,draftId);x=success(await content(owner,'content-publish',{draftId,revision:d.revision}));return {x,ref:draft(x,draftId).publishedRef};}
async function labPost(u,c){const x=success(await get(u,'/api/academy'));return fetch(base+'/api/academy',{method:'POST',headers:header(u),body:JSON.stringify({command:c,revision:x.revision,actionId:crypto.randomUUID()})}).then(parsed);}

try{
 await scenario('01 authentication, owner creation and independent local accounts',async()=>{
  equal((await fetch(base+'/api/teams')).status,401);
  const x=success(await post(owner,undefined,{type:'create',name:'Synthetic authoring QA '+nonce.slice(0,8),purpose:'Local fictional authoring, independent review and exact curriculum pin tests.',context:'msme'},0));teamId=x.team.id;
  await join(reviewer,['admin']);await join(learner,['learner']);await join(newLearner,['learner']);await join(staff,['assessor']);
  denied(await current(outsider,teamId),404);equal((await get(outsider)).workspaces.length,0);
 });
 await scenario('02 authoring requires current owner authority',async()=>{
  denied(await content(learner,'content-copy',{sourceRef}),403);denied(await content(staff,'content-copy',{sourceRef}),403);
  denied(await post(outsider,teamId,{type:'content-copy',sourceRef},(await current(owner,teamId)).revision),404);
 });
 await scenario('03 copy creates a private identity while preserving the archived seed',async()=>{
  const x=success(await content(owner,'content-copy',{sourceRef}));const d=drafts(x).at(-1);truth(d,'Authoring hook is missing: successful content-copy must return the owner draft');draftId=d.id;
  equal(d.state,'draft');equal(d.baseRef,sourceRef);truth(d.programId!==sourceRef.programId);equal(d.document.id,d.programId);equal(d.document.lessons.length,3);equal(d.document.practicalAssessment.rubric.length,4);
  truth(d.document.credentialExclusions.some(s=>/Nonaccredited/.test(s)));truth(/fictional/.test(d.document.sourceNotice));equal(seed.pathways[1].id,sourceRef.programId);
  truth(!versions(success(await current(learner,teamId))).some(s=>s.ref.programId===d.programId));
 });
 await scenario('04 extra authority fields, invented versions and foreign scopes reject',async()=>{
  denied(await content(owner,'content-copy',{sourceRef,actor:reviewer.id}),400);
  denied(await content(owner,'content-copy',{sourceRef:{...sourceRef,versionId:'invented-published-version'}}),409);
  const y=success(await post(otherOwner,undefined,{type:'create',name:'Separate synthetic authoring QA',purpose:'A separate local authority domain for private curriculum isolation.',context:'msme'},0));otherTeamId=y.team.id;
  denied(await content(owner,'content-copy',{sourceRef:{...sourceRef,scope:otherTeamId}}),404);
 });
 await scenario('05 incomplete drafts save but cannot request content review',async()=>{
  let x=success(await current(owner,teamId)),d=draft(x,draftId),document=structuredClone(d.document);document.title='';
  x=success(await content(owner,'content-save',{draftId,revision:d.revision,document}));d=draft(x,draftId);equal(d.document.title,'');
  denied(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}),422);
  equal(draft(success(await current(owner,teamId)),draftId).state,'draft');
 });
 await scenario('06 meaningful edits save while protected identity, claims and structure reject',async()=>{
  let x=success(await current(owner,teamId)),d=draft(x,draftId),document=structuredClone(d.document);
  document.title='Fictional customer drafts — private version one';document.summary='A bounded fictional practice pathway for checked customer records, clear replies and careful human approval.';
  document.lessons[0].title='Check the fictional customer source facts';document.lessons[0].quiz[0].correctOptionIndex=(document.lessons[0].quiz[0].correctOptionIndex+1)%4;
  document.lessons[0].quiz[0].explanation='For this synthetic authored fixture the selected option was independently checked by a human content reviewer.';
  document.practicalAssessment.rubric[0].dimension='Version one checked references';
  const invalid=structuredClone(document);invalid.credentialClaim='Recognized professional qualification';denied(await content(owner,'content-save',{draftId,revision:d.revision,document:invalid}),422);
  const invalidStructure=structuredClone(document);invalidStructure.lessons.pop();denied(await content(owner,'content-save',{draftId,revision:d.revision,document:invalidStructure}),422);
  x=success(await content(owner,'content-save',{draftId,revision:d.revision,document}));doc1=structuredClone(draft(x,draftId).document);equal(doc1.title,document.title);equal(doc1.lessons[0].quiz[0].correctOptionIndex,document.lessons[0].quiz[0].correctOptionIndex);
 });
 await scenario('07 author ownership, draft revision and workspace CAS prevent overwrite',async()=>{
  const x=success(await current(owner,teamId)),d=draft(x,draftId),command={type:'content-save',draftId,revision:d.revision,document:d.document};
  denied(await action(reviewer,teamId,command),403);
  const saved=success(await post(owner,teamId,command,x.revision));denied(await post(owner,teamId,command,x.revision),409);
  denied(await post(owner,teamId,command,saved.revision),409);equal(draft(success(await current(owner,teamId)),draftId).document,doc1);
 });
 await scenario('08 review assignment separates author and reviewer and freezes reviewed text',async()=>{
  let x=success(await current(owner,teamId)),d=draft(x,draftId);
  for(const reviewerId of [owner.id,learner.id])denied(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId,reviewDueAt:due}),403);
  denied(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:'2026-02-30T00:00:00.000Z'}),422);
  x=success(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}));d=draft(x,draftId);equal(d.state,'in_review');
  denied(await content(owner,'content-save',{draftId,revision:d.revision,document:doc1}),409);
 });
 await scenario('09 only assigned independent owner can approve with complete declarations',async()=>{
  const d=draft(success(await current(owner,teamId)),draftId),c={draftId,revision:d.revision,decision:'approve',note:'The fictional references and current answer keys were checked independently.',checks};
  denied(await content(owner,'content-review',c),403);denied(await content(staff,'content-review',c),403);
  denied(await content(reviewer,'content-review',{...c,checks:{...checks,safety:false}}),422);
  equal(draft(success(await current(owner,teamId)),draftId).state,'in_review');
 });
 await scenario('10 requested changes and author recall clear approval',async()=>{
  let d=draft(success(await current(owner,teamId)),draftId);
  let x=success(await content(reviewer,'content-review',{draftId,revision:d.revision,decision:'changes',note:'Please recheck the fictional answer explanation against the supplied source facts.'}));d=draft(x,draftId);equal(d.state,'draft');truth(!d.approval);
  x=success(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}));d=draft(x,draftId);
  x=success(await content(reviewer,'content-review',{draftId,revision:d.revision,decision:'approve',note:'The fictional answer explanations, references and careful boundaries are now coherent.',checks}));d=draft(x,draftId);equal(d.state,'approved');truth(/^[a-f0-9]{64}$/.test(d.approval.documentHash));
  x=success(await content(owner,'content-recall',{draftId,revision:d.revision,reason:'Reconfirm the source facts before this private exercise is offered.'}));d=draft(x,draftId);equal(d.state,'draft');truth(!d.approval);denied(await content(owner,'content-publish',{draftId,revision:d.revision}),409);
 });
 await scenario('11 approval is bound to exact document revision and independent identity',async()=>{
  let d=draft(success(await current(owner,teamId)),draftId);
  let x=success(await content(owner,'content-submit',{draftId,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}));d=draft(x,draftId);
  x=success(await content(reviewer,'content-review',{draftId,revision:d.revision,decision:'approve',note:'Verified fictional source references, correct answers and assessment anchors. '+reviewCanary,checks}));d=draft(x,draftId);
  equal(d.approval.reviewerId,reviewer.id);equal(d.approval.documentRevision,d.documentRevision);truth(/^[a-f0-9]{64}$/.test(d.approval.documentHash));denied(await content(owner,'content-save',{draftId,revision:d.revision,document:doc1}),409);
 });
 await scenario('12 publication is immutable, exact replay is idempotent and reused IDs conflict',async()=>{
  const before=success(await current(owner,teamId)),d=draft(before,draftId),actionId=crypto.randomUUID(),command={type:'content-publish',draftId,revision:d.revision};
  let x=success(await post(owner,teamId,command,before.revision,actionId));ref1=draft(x,draftId).publishedRef;truth(ref1.scope===teamId);equal(snapshot(x,ref1).program,doc1);equal(snapshot(x,ref1).classification,classification);
  const replay=success(await post(owner,teamId,command,before.revision,actionId));equal(replay.replayed,true);equal(publications(replay).length,1);equal(draft(replay,draftId).publishedRef,ref1);
  denied(await post(owner,teamId,{...command,revision:99},x.revision,actionId),409);denied(await content(owner,'content-publish',{draftId,revision:draft(x,draftId).revision}),409);
 });
 await scenario('13 owner drafts and human review notes stay out of learner and directory projections',async()=>{
  let x=success(await content(owner,'content-copy',{sourceRef})),d=drafts(x).at(-1),document=structuredClone(d.document);document.summary=privateDraftCanary+' This is an unpublished fictional teaching exercise.';
  success(await content(owner,'content-save',{draftId:d.id,revision:d.revision,document}));
  const l=success(await current(learner,teamId));equal(drafts(l).length,0);equal(publications(l).length,0);truth(!JSON.stringify(l).includes(privateDraftCanary));truth(!JSON.stringify(l).includes(reviewCanary));truth(!JSON.stringify(l).includes(ref1.versionId));
  truth(!JSON.stringify(success(await get(owner))).includes(privateDraftCanary));truth(!JSON.stringify(success(await get(learner))).includes(ref1.versionId));denied(await current(outsider,teamId),404);
 });
 await scenario('14 private offering pins content and complete-record plan resolution uses its registry',async()=>{
  const x=success(await action(owner,teamId,{type:'cohort-create',title:'Private exact version one circle',programId:ref1.programId,contentRef:ref1,capacity:10}));cohort1=x.team.cohorts.at(-1).id;equal(x.team.cohorts.at(-1).contentRef,ref1);equal(x.team.cohorts.at(-1).version,ref1.versionId);
  let l=success(await action(learner,teamId,{type:'enroll',programId:ref1.programId,cohortId:cohort1}));enrollment1=l.state.enrollments.at(-1).id;equal(enrollment(l,enrollment1).contentRef,ref1);equal(snapshot(l,ref1).program,doc1);truth(!JSON.stringify(l).includes(reviewCanary));
  l=success(await action(learner,teamId,{type:'plan-task',kind:'lesson',enrollmentId:enrollment1,lessonId:doc1.lessons[0].id,dueDate:null}));equal(l.state.learningPlan.tasks.at(-1).enrollmentId,enrollment1);equal(l.state.learningPlan.tasks.at(-1).title,doc1.lessons[0].title);equal(enrollment(l,enrollment1).contentRef,ref1);
  const oldAnswers=seed.pathways[1].lessons[0].quiz.map(q=>q.correctOptionIndex);
  denied(await action(learner,teamId,{type:'lesson',enrollmentId:enrollment1,lessonId:doc1.lessons[0].id,practice:'I checked the fictional sources and kept appropriate human review before using this answer.',answers:oldAnswers}),422);
  l=success(await action(learner,teamId,{type:'lesson',enrollmentId:enrollment1,lessonId:doc1.lessons[0].id,practice:'I checked the fictional sources and kept appropriate human review before using this answer.',answers:doc1.lessons[0].quiz.map(q=>q.correctOptionIndex)}));equal(enrollment(l,enrollment1).completed.length,1);
 });
 await scenario('15 new version preserves the original cohort, enrollment and historical body',async()=>{
  let x=success(await content(owner,'content-copy',{sourceRef:ref1})),d=drafts(x).at(-1),document=structuredClone(d.document);equal(d.programId,ref1.programId);
  document.title='Fictional customer drafts — private version two';document.lessons[0].title='Version two source inspection';document.practicalAssessment.rubric[0].dimension='Version two reference tracing';document.lessons[0].quiz[0].correctOptionIndex=(document.lessons[0].quiz[0].correctOptionIndex+1)%4;
  x=success(await content(owner,'content-save',{draftId:d.id,revision:d.revision,document}));doc2=structuredClone(draft(x,d.id).document);
  const publication=await reviewAndPublish(d.id);ref2=publication.ref;truth(ref2.versionId!==ref1.versionId);equal(ref2.programId,ref1.programId);equal(snapshot(publication.x,ref1).program,doc1);equal(snapshot(publication.x,ref2).program,doc2);
  const saved=success(await current(learner,teamId));equal(enrollment(saved,enrollment1).contentRef,ref1);equal(saved.team.cohorts.find(c=>c.id===cohort1).contentRef,ref1);equal(snapshot(saved,ref1).program.title,doc1.title);
  x=success(await action(owner,teamId,{type:'cohort-create',title:'Private exact version two circle',programId:ref2.programId,contentRef:ref2,capacity:10}));cohort2=x.team.cohorts.at(-1).id;
  let y=success(await action(newLearner,teamId,{type:'enroll',programId:ref2.programId,cohortId:cohort2}));equal(y.state.enrollments.at(-1).contentRef,ref2);equal(snapshot(y,ref2).program.title,doc2.title);
 });
 await scenario('16 assigned assessor resolves original private rubric and preserves record provenance',async()=>{
  for(const lesson of doc1.lessons.slice(1))success(await action(learner,teamId,{type:'lesson',enrollmentId:enrollment1,lessonId:lesson.id,practice:'The fictional answer is supported by source facts, careful privacy handling and human approval.',answers:lesson.quiz.map(q=>q.correctOptionIndex)}));
  const fields=Object.fromEntries(doc1.practicalAssessment.submissionPrompts.map(f=>[f.id,'Checked synthetic source references, removed unsupported claims and kept an explicit human approval route.']));
  let l=success(await action(learner,teamId,{type:'submit',enrollmentId:enrollment1,fields,confirmed:true}));attemptId=enrollment(l,enrollment1).attempts.at(-1).id;
  success(await action(owner,teamId,{type:'member',userId:staff.id,roles:['assessor'],scopes:[cohort1],active:true}));success(await action(owner,teamId,{type:'assign',kind:'assessment',targetId:attemptId,staffId:staff.id}));
  const assigned=success(await current(staff,teamId));equal(assigned.team.assigned[0].e.contentRef,ref1);equal(snapshot(assigned,ref1).program.practicalAssessment.rubric[0].dimension,doc1.practicalAssessment.rubric[0].dimension);truth(!JSON.stringify(assigned).includes(privateDraftCanary));truth(!JSON.stringify(assigned).includes(reviewCanary));
  const grading={type:'assess',learnerId:learner.id,enrollmentId:enrollment1,attemptId,scores:[4,4,4,4],gates:[true,true,true],notes:Array(4).fill('This criterion is supported by the preserved fictional source references.'),feedback:'The synthetic task demonstrates checked sources, clear work and careful human approval.'};success(await action(staff,teamId,grading));
  l=success(await current(learner,teamId));const e=enrollment(l,enrollment1);equal(e.record.title,doc1.title);equal(e.record.contentVersion,ref1.versionId);equal(e.record.status,'active');truth(/nonaccredited/i.test(e.record.kind));
 });
 await scenario('17 closing publication blocks new access while existing pinned learning stays available',async()=>{
  const ownerRead=success(await current(owner,teamId)),before=snapshot(ownerRead,ref1);
  success(await content(owner,'content-retire',{publicationId:ref1.versionId,reason:'This version is closed to new enrollment while revised private practice is offered.'}));
  const after=success(await current(owner,teamId));equal(snapshot(after,ref1),before);equal(publications(after).find(p=>p.id===ref1.versionId).availability,'retired');
  denied(await action(owner,teamId,{type:'cohort-create',title:'Closed publication circle',programId:ref1.programId,contentRef:ref1,capacity:2}),409);
  const fresh=id('fresh-learner');await join(fresh,['learner']);denied(await action(fresh,teamId,{type:'enroll',programId:ref1.programId,cohortId:cohort1}),409);
  const l=success(await action(learner,teamId,{type:'draft',enrollmentId:enrollment1,fields:{[doc1.practicalAssessment.submissionPrompts[0].id]:'Existing learner continues under the exact preserved publication after retirement.'}}));equal(enrollment(l,enrollment1).contentRef,ref1);equal(snapshot(l,ref1).program,doc1);
 });
 await scenario('18 reviewer revocation blocks an approved publication at current authority',async()=>{
  let x=success(await content(owner,'content-copy',{sourceRef:ref2})),d=drafts(x).at(-1);
  x=success(await content(owner,'content-submit',{draftId:d.id,revision:d.revision,reviewerId:reviewer.id,reviewDueAt:due}));d=draft(x,d.id);
  x=success(await content(reviewer,'content-review',{draftId:d.id,revision:d.revision,decision:'approve',note:'The private synthetic examples and current review boundaries were checked carefully.',checks}));d=draft(x,d.id);const approvedRevision=x.revision;
  success(await action(owner,teamId,{type:'member',userId:reviewer.id,roles:['learner'],scopes:[],active:true}));denied(await post(owner,teamId,{type:'content-publish',draftId:d.id,revision:d.revision},approvedRevision),409);
  denied(await content(owner,'content-publish',{draftId:d.id,revision:d.revision}),403);equal(publications(success(await current(owner,teamId))).length,2);
  success(await action(owner,teamId,{type:'member',userId:reviewer.id,roles:['admin'],scopes:[],active:true}));
 });
 await scenario('19 competing publication requests commit one immutable version under workspace CAS',async()=>{
  const x=success(await current(owner,teamId)),d=drafts(x).find(d=>d.state==='approved');truth(d);const command={type:'content-publish',draftId:d.id,revision:d.revision};
  const race=await Promise.all([post(owner,teamId,command,x.revision),post(reviewer,teamId,command,x.revision)]);equal(race.map(r=>r.status).sort(),[200,409]);equal(publications(success(await current(owner,teamId))).length,3);
 });
 await scenario('20 private content cannot cross workspace or personal learning authority',async()=>{
  denied(await action(otherOwner,otherTeamId,{type:'cohort-create',title:'Foreign content circle',programId:ref1.programId,contentRef:ref1,capacity:2}),404);
  denied(await labPost(learner,{type:'enroll',programId:ref1.programId}),404);
  denied(await action(learner,teamId,{type:'enroll',programId:ref1.programId,cohortId:cohort1,contentRef:ref2}),400);
  denied(await action(owner,teamId,{type:'cohort-create',title:'Mismatched identity circle',programId:sourceRef.programId,contentRef:ref2,capacity:2}),409);
  truth(!JSON.stringify(success(await current(otherOwner,otherTeamId))).includes(ref1.versionId));
 });
 await scenario('21 removed learner retains own exact history while private drafts remain hidden',async()=>{
  success(await action(owner,teamId,{type:'member',userId:learner.id,roles:['learner'],scopes:[],active:false}));const l=success(await current(learner,teamId));equal(l.team.active,false);equal(enrollment(l,enrollment1).contentRef,ref1);equal(snapshot(l,ref1).program,doc1);equal(drafts(l).length,0);truth(!JSON.stringify(l).includes(privateDraftCanary));truth(!JSON.stringify(l).includes(reviewCanary));
  denied(await action(learner,teamId,{type:'lesson-draft',enrollmentId:enrollment1,lessonId:doc1.lessons[0].id,practice:'Removed membership must not mutate this preserved private record.'}),403);
 });
 await scenario('22 all three global pilot pathways still enroll unchanged and archive bytes remain exact',async()=>{
  equal(seed.pathways.length,3);for(const p of seed.pathways){const x=success(await labPost(otherOwner,{type:'enroll',programId:p.id})),e=x.state.enrollments.find(e=>e.programId===p.id);equal(e.contentRef,{scope:'global',programId:p.id,versionId:'0.1-review-draft'});equal(e.version,'0.1-review-draft');}
  const after=readFileSync(resolve(app,'lib/curriculum-versions/0.1-review-draft.json'));equal(after,archiveBefore);equal(createHash('sha256').update(after).digest('hex'),'9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4');equal(archiveHash,'9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4');
 });
 await scenario('23 any current owner archives an abandoned unpublished draft and frees its active slot',async()=>{
  let x=success(await content(reviewer,'content-copy',{sourceRef})),abandoned=drafts(x).at(-1);truth(abandoned);equal(abandoned.authorId,reviewer.id);const prior=structuredClone(abandoned);
  while(drafts(x).filter(d=>!['published','archived'].includes(d.state)).length<4)x=success(await content(owner,'content-copy',{sourceRef}));
  denied(await content(owner,'content-copy',{sourceRef}),409);success(await action(owner,teamId,{type:'member',userId:reviewer.id,roles:['learner'],scopes:[],active:true}));
  const reason='The former author no longer has content-owner permission; preserve this abandoned private draft.';
  denied(await content(reviewer,'content-archive',{draftId:abandoned.id,revision:abandoned.revision,reason}),403);
  x=success(await content(owner,'content-archive',{draftId:abandoned.id,revision:abandoned.revision,reason}));const archived=draft(x,abandoned.id);equal(archived.state,'archived');equal(archived.document,prior.document);equal(archived.history.length,prior.history.length+1);truth(JSON.stringify(archived.history.at(-1)).includes(reason));
  equal(drafts(x).filter(d=>!['published','archived'].includes(d.state)).length,3);equal(publications(x).length,3);
  x=success(await content(owner,'content-copy',{sourceRef}));equal(drafts(x).filter(d=>!['published','archived'].includes(d.state)).length,4);
  success(await action(owner,teamId,{type:'member',userId:reviewer.id,roles:['admin'],scopes:[],active:true}));denied(await content(reviewer,'content-save',{draftId:archived.id,revision:archived.revision,document:archived.document}),409);
  denied(await content(owner,'content-archive',{draftId:archived.id,revision:archived.revision,reason}),409);truth(!JSON.stringify(success(await current(newLearner,teamId))).includes(reason));
 });
}catch(e){error=e;}
const result={executedAt:new Date().toISOString(),base,scope:'Built local Worker/D1 API integration; synthetic local identity headers only',implementedAuthoringRequired:true,passed:!error,scenarios,assertions,archiveSha256:archiveHash,limitations:['No hosted authentication, external invitations, real participant sharing, accreditation or AI generation are tested.'],...(error?{error:error.message}: {})};
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(error)process.exitCode=1;
