import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),out=process.env.ACADEMY_DATA_REQUEST_QA_OUTPUT??resolve(here,'../../.sites-runtime/data-request-qa');
const M=await import(out+'/model.mjs');
const T0='2026-10-01T09:00:00.000Z',day=n=>new Date(Date.parse(T0)+n*86400000).toISOString();
const U={owner:{userId:'u-owner',email:'o@x.test',fullName:'Owner One'},owner2:{userId:'u-owner2',email:'o2@x.test',fullName:'Owner Two'},ann:{userId:'u-ann',email:'a@x.test',fullName:'Ann Learner'},bob:{userId:'u-bob',email:'b@x.test',fullName:'Bob Secretword'},staff:{userId:'u-staff',email:'s@x.test',fullName:'Sam Facilitator'},out:{userId:'u-out',email:'z@x.test',fullName:'Outsider'}};
function build(){
 const t=M.createTeam(U.owner,{name:'Synthetic Workspace',purpose:'Synthetic purpose text',context:'msme'},'tw-1',T0);
 const mem=(u,roles,scopes=[])=>t.members.push({userId:u.userId,email:u.email,name:u.fullName,roles,scopes,active:true,joinedAt:T0});
 mem(U.owner2,['admin']);mem(U.ann,['learner']);mem(U.bob,['learner']);mem(U.staff,['facilitator','assessor'],['c1']);
 t.cohorts.push({id:'c1',title:'Cohort One',programId:'p',status:'open',capacity:10});
 const learner=(u,tag)=>{const s=M.freshWorkspace();s.profile.name=u.fullName;s.enrollments.push({id:'e-'+tag,programId:'p',version:'v1',cohortId:'c1',startedAt:T0,completed:['l1'],practice:{l1:{answer:`practice-${tag}-text`,completedAt:T0}},draft:{},attempts:[{id:'a-'+tag,number:1,submittedAt:T0,fields:{f:`submission-${tag}-text`},decision:{id:'d-'+tag,passed:false,score:40,scores:[1],gates:[],notes:[`rubric-note-${tag}`],feedback:`feedback-${tag}-text`,actor:'u-staff',actorName:'Sam Facilitator',decidedAt:T0,mode:'x'}}],appeals:[],record:null,withdrawn:false});t.learners.push({userId:u.userId,state:s})};
 learner(U.ann,'ann');learner(U.bob,'bob');
 t.posts.push({id:'p1',scope:'p',cohortId:'c1',title:'Ann post title',body:'ann-post-body-text-here',author:'Ann Learner',authorId:'u-ann',status:'visible',createdAt:T0,replies:[{id:'r1',body:'bob-reply-secretword-on-ann-post',author:'Bob Secretword',authorId:'u-bob',status:'visible',createdAt:T0}]},{id:'p2',scope:'p',cohortId:'c1',title:'Bob post',body:'bob-post-secretword-body',author:'Bob Secretword',authorId:'u-bob',status:'visible',createdAt:T0,replies:[{id:'r2',body:'ann-reply-in-bobs-post',author:'Ann Learner',authorId:'u-ann',status:'visible',createdAt:T0}]});
 t.moderation.push({id:'m1',postId:'p1',reason:'STAFFONLY moderation reason text',cohortId:'c1'});t.reports.push({id:'rp1',postId:'p1',reason:'STAFFONLY report reason',status:'open',createdAt:T0});
 t.assignments.push({id:'as1',kind:'assessment',targetId:'a-ann',staffId:'u-staff',assignedBy:'u-owner',assignedAt:T0});
 t.network={profiles:[{id:'np-ann',userId:'u-ann',enabled:true,bio:'Ann bio text here',focus:'Work records',cohortIds:['c1'],consentedAt:T0},{id:'np-bob',userId:'u-bob',enabled:true,bio:'Bob bio text here',focus:'Work records',cohortIds:['c1'],consentedAt:T0}],sessions:[]};
 return t;
}
const run=(t,u,c,now=T0)=>M.applyTeamCommand(t,u,c,now);
const bad=(fn,status)=>assert.throws(fn,e=>{if(e.status!==status)console.error('got',e.status,e.message);return e.status===status});
const open=(t,u,kind,extra={},now=T0)=>{const t2=run(t,u,{type:'data-request-open',kind,detail:'Please process this request',...extra},now);return [t2,t2.dataRequests.requests.at(-1)]};
const verify=(t,r,u=U.owner2,passed=['account-email','roster-details'])=>run(t,u,{type:'data-request-verify',requestId:r.id,requestRev:cur(t,r.id).rev,passed});
const cur=(t,id)=>t.dataRequests.requests.find(r=>r.id===id);
const decide=(t,r,u,outcome='approve',now=T0)=>run(t,u,{type:'data-request-decide',requestId:r.id,requestRev:cur(t,r.id).rev,outcome,reason:'Reviewed against the process'},now);

test("export covers only the requester's own data, never other learners' text or staff-only notes",()=>{
 let [t,r]=open(build(),U.ann,'export');t=verify(t,r);t=decide(t,r,U.owner2);const x=cur(t,r.id);assert.equal(x.status,'completed');
 const json=x.export.json;
 for(const mine of ['practice-ann-text','submission-ann-text','feedback-ann-text','ann-post-body-text-here','ann-reply-in-bobs-post','Ann bio text here'])assert.ok(json.includes(mine),mine);
 for(const other of ['practice-bob-text','submission-bob-text','feedback-bob-text','secretword','Bob Sec','Bob bio','bob-post-','u-bob','STAFFONLY','u-staff','"as1"','rubric-note-bob'])assert.ok(!json.toLowerCase().includes(other.toLowerCase()),'leaked '+other);
 const doc=JSON.parse(json);assert.equal(doc.manifest.subjectId,'u-ann');assert.equal(doc.manifest.counts.postsAuthored,1);assert.equal(doc.manifest.counts.repliesAuthored,1);assert.equal(doc.manifest.counts.decisionsReceived,1);
});
test('manifest checksum is the SHA-256 of the exported data and a tampered copy no longer matches',()=>{
 let [t,r]=open(build(),U.ann,'export');t=verify(t,r);t=decide(t,r,U.owner2);const doc=JSON.parse(cur(t,r.id).export.json);
 const sha=s=>createHash('sha256').update(s).digest('hex');assert.equal(doc.manifest.dataSha256,sha(JSON.stringify(doc.data)));assert.equal(M.sha256Hex('abc'),sha('abc'));assert.equal(M.sha256Hex('é'.repeat(100)),sha('é'.repeat(100)));
 doc.data.profile.name='Changed';assert.notEqual(doc.manifest.dataSha256,sha(JSON.stringify(doc.data)));
});
test('requester cannot self-verify or self-decide, even as an owner',()=>{
 let [t,r]=open(build(),U.ann,'export');bad(()=>verify(t,r,U.ann),403);
 let [t2,r2]=open(build(),U.owner,'export');bad(()=>verify(t2,r2,U.owner),403);bad(()=>decide(t2,r2,U.owner),403);
 t2=verify(t2,r2,U.owner2);bad(()=>decide(t2,r2,U.owner),403);t2=decide(t2,r2,U.owner2);assert.equal(cur(t2,r2.id).status,'completed');
});
test('non-admin members are denied; other learners cannot see or withdraw a request',()=>{
 let [t,r]=open(build(),U.ann,'export');
 for(const u of [U.bob,U.staff])bad(()=>run(t,u,{type:'data-request-verify',requestId:r.id,requestRev:1,passed:['account-email','roster-details']}),404);
 const [t3,r3]=open(build(),U.ann,'erasure');bad(()=>run(t3,U.ann,{type:'data-request-decide',requestId:r3.id,requestRev:1,outcome:'approve',reason:'self approving here'}),403);
 bad(()=>run(t,U.bob,{type:'data-request-withdraw',requestId:r.id,requestRev:1}),404);
 const p=M.projectTeam(t,U.bob);assert.equal(p.team.dataRequests.mine.length,0);assert.equal(p.team.dataRequests.queue.length,0);assert.equal(M.projectTeam(t,U.owner).team.dataRequests.queue.length,1);
});
test('approval needs a passing two-of-three verification; one check fails; decline needs only a reason',()=>{
 let [t,r]=open(build(),U.ann,'export');bad(()=>decide(t,r,U.owner2),409);
 const failed=run(t,U.owner2,{type:'data-request-verify',requestId:r.id,requestRev:1,passed:['account-email']});assert.equal(cur(failed,r.id).status,'verification-failed');bad(()=>decide(failed,r,U.owner2),409);
 bad(()=>run(t,U.owner2,{type:'data-request-verify',requestId:r.id,requestRev:1,passed:['made-up']}),422);
 const declined=decide(t,r,U.owner2,'decline');assert.equal(cur(declined,r.id).status,'declined');assert.equal(cur(declined,r.id).export,null);
 bad(()=>run(t,U.owner2,{type:'data-request-decide',requestId:r.id,requestRev:1,outcome:'decline',reason:'short'}),422);
});
test('SLA: 30-day due date, overdue flag appears only after it and only while open',()=>{
 let [t,r]=open(build(),U.ann,'correction',{proposed:{name:'Ann Corrected'}});assert.equal(M.DATA_REQUEST_SLA_DAYS,30);assert.equal(r.dueAt,day(30));
 const P=now=>M.projectDataRequests(t,'u-ann',now).mine[0];
 assert.equal(P(day(29)).overdue,false);assert.equal(P(day(31)).overdue,true);
 t=verify(t,r);t=decide(t,r,U.owner2,'approve',day(31));assert.equal(M.projectDataRequests(t,'u-ann',day(40)).mine[0].overdue,false);
});
test('correction applies only the proposed profile fields and audits before and after',()=>{
 let [t,r]=open(build(),U.ann,'correction',{proposed:{name:'Ann Corrected'}});t=verify(t,r);t=decide(t,r,U.owner2);
 const l=t.learners.find(l=>l.userId==='u-ann').state;assert.equal(l.profile.name,'Ann Corrected');assert.equal(l.enrollments[0].attempts[0].decision.feedback,'feedback-ann-text');
 const ev=cur(t,r.id).events.find(e=>e.type==='correction-applied');assert.equal(ev.detail.before.name,'Ann Learner');bad(()=>open(build(),U.ann,'correction',{proposed:{email:'x@y.z'}}),400);
});
test('erasure stays held, deletes nothing and keeps evidence, decisions and audit intact',()=>{
 const before=build();let [t,r]=open(structuredClone(before),U.ann,'erasure');t=verify(t,r);t=decide(t,r,U.owner2);const x=cur(t,r.id);
 assert.equal(x.status,'held');assert.equal(x.hold.label,'Held — retention policy pending');assert.equal(x.export,null);
 for(const k of ['learners','posts','moderation','reports','assignments','members','cohorts'])assert.deepEqual(t[k],before[k],k+' changed');
 assert.ok(t.activity.some(a=>a.action==='data-request-erasure-held'&&a.actor==='u-owner2'&&a.detail.deleted===false));
 assert.ok(['opened','verified','erasure-held'].every(ty=>x.events.some(e=>e.type===ty&&e.actorId&&e.at)));
});
test('restrict flag hides the directory profile, keeps data, and is reversible',()=>{
 let [t,r]=open(build(),U.ann,'erasure');t=verify(t,r);t=decide(t,r,U.owner2);
 const dir=u=>M.projectTeam(t,u).team.network.directory.map(d=>d.id).sort();
 assert.deepEqual(dir(U.bob),['np-bob']);assert.deepEqual(dir(U.owner2),['np-bob']);assert.ok(t.network.profiles.some(p=>p.id==='np-ann'&&p.enabled));
 assert.equal(M.projectTeam(t,U.ann).team.dataRequests.restrictedSelf,true);
 bad(()=>run(t,U.bob,{type:'data-request-restriction',requestId:r.id,requestRev:cur(t,r.id).rev,restricted:false,reason:'bob tries to lift this'}),404);
 bad(()=>run(t,U.ann,{type:'data-request-restriction',requestId:r.id,requestRev:cur(t,r.id).rev,restricted:false,reason:'self lifting restriction'}),403);
 t=run(t,U.owner2,{type:'data-request-restriction',requestId:r.id,requestRev:cur(t,r.id).rev,restricted:false,reason:'Lifting after owner review'});assert.deepEqual(dir(U.bob),['np-ann','np-bob']);assert.equal(cur(t,r.id).status,'held');
 t=run(t,U.owner2,{type:'data-request-restriction',requestId:r.id,requestRev:cur(t,r.id).rev,restricted:true,reason:'Re-applying after review'});assert.deepEqual(dir(U.bob),['np-bob']);
 assert.ok(t.activity.some(a=>a.action==='data-request-restriction-lifted'));
});
test('idempotency: the same client reference files one request; a reused reference for another type is rejected',()=>{
 let [t,r]=open(build(),U.ann,'export',{clientRef:'client-ref-0001'});const again=run(t,U.ann,{type:'data-request-open',kind:'export',detail:'Please process this request',clientRef:'client-ref-0001'});
 assert.equal(again.dataRequests.requests.length,1);assert.equal(again.dataRequests.requests[0].id,r.id);assert.equal(again.activity.length,t.activity.length);
 bad(()=>run(t,U.ann,{type:'data-request-open',kind:'erasure',detail:'Please process this request',clientRef:'client-ref-0001'}),409);
 bad(()=>open(t,U.ann,'export'),409);
 let t2=verify(t,r);t2=decide(t2,r,U.owner2);bad(()=>run(t2,U.owner2,{type:'data-request-decide',requestId:r.id,requestRev:cur(t2,r.id).rev,outcome:'decline',reason:'Second decision attempt'}),409);
});
test('stale request revision is rejected with 409 and changes nothing',()=>{
 let [t,r]=open(build(),U.ann,'export');const t2=verify(t,r);const snapshot=JSON.stringify(t2);
 bad(()=>run(t2,U.owner2,{type:'data-request-decide',requestId:r.id,requestRev:1,outcome:'approve',reason:'Using a stale revision'}),409);assert.equal(JSON.stringify(t2),snapshot);
 bad(()=>run(t,U.owner2,{type:'data-request-verify',requestId:r.id,passed:['account-email','roster-details']}),400);
});
test('outsiders and removed members get 404 or 403; the command copy leaves the source untouched',()=>{
 const t=build();bad(()=>run(t,U.out,{type:'data-request-open',kind:'export'}),404);
 const gone=build();gone.members.find(m=>m.userId==='u-bob').active=false;bad(()=>run(gone,U.bob,{type:'data-request-open',kind:'export'}),403);
 const frozen=JSON.stringify(t);open(t,U.ann,'export');assert.equal(JSON.stringify(t),frozen);
 bad(()=>run(t,U.ann,{type:'data-request-open',kind:'export',extra:1}),400);
});
test('withdrawing keeps the record; requester sees own export payload, owner queue does not',()=>{
 let [t,r]=open(build(),U.ann,'export');t=run(t,U.ann,{type:'data-request-withdraw',requestId:r.id,requestRev:1});assert.equal(cur(t,r.id).status,'withdrawn');bad(()=>verify(t,r),409);
 let [t2,r2]=open(build(),U.ann,'export');t2=verify(t2,r2);t2=decide(t2,r2,U.owner2);
 assert.ok(M.projectTeam(t2,U.ann).team.dataRequests.mine[0].export.json);assert.equal(M.projectTeam(t2,U.owner2).team.dataRequests.queue[0].export.json,undefined);
 assert.ok(!JSON.stringify(M.projectTeam(t2,U.bob).team.dataRequests).includes('practice-ann'));
});
