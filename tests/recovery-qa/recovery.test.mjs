import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/lib/academy-recovery.ts')?nearby:'.'));
const output=resolve(process.env.ACADEMY_RECOVERY_QA_OUTPUT??app+'/.sites-runtime/recovery-qa');
const {createTeam,applyTeamCommand:run,projectTeam,programs,learnerRecordIsEmpty}=await import(pathToFileURL(output+'/model.mjs'));
const t0='2030-01-01T10:00:00.000Z',t1='2030-01-02T10:00:00.000Z',t2='2030-01-03T10:00:00.000Z';
const U=(id,email,name)=>({userId:id,email,fullName:name});
const A=U('syn-admin-a','admin.a@example.test','Fictional Owner A'),B=U('syn-admin-b','admin.b@example.test','Fictional Owner B'),OLD=U('syn-old','old.learner@example.test','Fictional Learner Old'),NEW=U('syn-new','new.learner@example.test','Fictional Learner New'),OTHER=U('syn-other','other.learner@example.test','Fictional Other Learner'),OUT=U('syn-outsider','outsider@example.test','Fictional Outsider'),FAC=U('syn-fac','fac@example.test','Fictional Facilitator');
const hex=n=>n.toString(16).padStart(64,'0');let tok=1;
const deny=(fn,status)=>assert.throws(fn,e=>e.status===status,'expected status '+status);
function join(t,u,roles=['learner'],scopes=[],by=A){t=run(t,by,{type:'invite',email:u.email,roles,scopes,tokenHash:hex(tok)},t0);const h=hex(tok++);return run(t,u,{type:'accept',tokenHash:h},t0)}
function fixture(){
 let t=createTeam(A,{name:'Synthetic recovery workspace',purpose:'Synthetic workspace for recovery tests',context:'msme'},'tw-recovery-synthetic',t0);
 t=join(t,B,['admin']);t=join(t,OLD);t=join(t,OTHER);t=join(t,FAC,['facilitator']);
 const p=programs[0].id;
 t=run(t,A,{type:'cohort-create',title:'Synthetic cohort one',programId:p,capacity:10},t0);const cid=t.cohorts[0].id;
 t=run(t,OLD,{type:'enroll',programId:p,cohortId:cid},t0);t=run(t,OTHER,{type:'enroll',programId:p,cohortId:cid},t0);
 // Synthetic evidence and decision, written directly so the test fixes exact bytes.
 const e=t.learners.find(l=>l.userId===OLD.userId).state.enrollments[0];
 e.attempts.push({id:'syn-attempt-1',number:1,submittedAt:'2030-01-01T09:00:00.000Z',answers:{q1:'Fictional evidence text, kept exactly.'},decision:{actor:'syn-assessor-x',outcome:'pass',notes:'Fictional decision.',at:'2030-01-01T09:30:00.000Z'}});
 e.lessonDrafts={l1:'synthetic saved draft'};
 t.posts.push({id:'p1',scope:p,cohortId:cid,title:'Synthetic post',body:'Synthetic body text that is long enough.',author:'Fictional Learner Old',authorId:OLD.userId,status:'visible',createdAt:t0,replies:[]});
 return t}
function invited(t){t=run(t,A,{type:'invite',email:NEW.email,roles:['learner'],scopes:[],tokenHash:hex(tok),assistedNote:'Helped by phone at the village centre.'},t0);const h=hex(tok++);return run(t,NEW,{type:'accept',tokenHash:h},t0)}
const file=(t,u=NEW,email=OLD.email,now=t1)=>run(t,u,{type:'recovery-request',claimedEmail:email,cohortHint:'Synthetic cohort one',activityHint:'Submitted attempt 1'},now);
const ticks=(a=true,b=true,c=false)=>({cohort:a,email:b,lastActivity:c});
const decide=(t,u,over={},now=t2)=>{const r=t.recovery[0];return run(t,u,{type:'recovery-decide',requestId:r.id,decision:'approve',reason:'Two synthetic checks confirmed by owner.',checklist:ticks(),reviewedVersion:r.version,...over},now)};
const oldState=t=>JSON.stringify(t.learners.find(l=>l.userId===OLD.userId).state);
const base=()=>file(invited(fixture()));

test('happy path: request, dummy checklist, approval returns learner to a valid account',()=>{
 const t=base(),before=oldState(t),before2=structuredClone(t);
 assert.equal(t.recovery[0].status,'pending');assert.equal(t.recovery[0].oldMemberId,OLD.userId);
 const n=decide(t,B);assert.deepEqual(t,before2,'input team not mutated');
 assert.equal(n.recovery[0].status,'approved');assert.equal(n.recovery[0].decision.verification,'dummy-checklist');
 const moved=n.learners.find(l=>l.userId===NEW.userId);assert.ok(moved);assert.equal(n.learners.some(l=>l.userId===OLD.userId),false);
 assert.equal(JSON.stringify(moved.state),before,'learner state byte-identical');
 const p=projectTeam(n,NEW);assert.equal(p.state.enrollments.length,1);assert.equal(p.team.recovery.mine[0].status,'approved');assert.equal(p.team.roles.includes('learner'),true);
 assert.equal(n.posts[0].authorId,NEW.userId);
 assert.equal(n.cohorts.length,1);assert.equal(n.members.filter(m=>m.active).length>=1,true);
});
test('evidence, decisions and curriculum pins are byte-identical after relink',()=>{
 const t=base(),e0=JSON.stringify(t.learners.find(l=>l.userId===OLD.userId).state.enrollments),n=decide(t,B),e1=JSON.stringify(n.learners.find(l=>l.userId===NEW.userId).state.enrollments);
 assert.equal(e1,e0);const e=n.learners.find(l=>l.userId===NEW.userId).state.enrollments[0];
 assert.equal(e.attempts[0].decision.actor,'syn-assessor-x');assert.equal(e.attempts[0].answers.q1,'Fictional evidence text, kept exactly.');assert.ok(e.contentRef);assert.deepEqual(e.lessonDrafts,{l1:'synthetic saved draft'});
 assert.equal(n.cohorts[0].capacity,10);
});
test('old id is deactivated, loses roles, cannot act, and is linked to the new id',()=>{
 const n=decide(base(),B),old=n.members.find(m=>m.userId===OLD.userId),nu=n.members.find(m=>m.userId===NEW.userId);
 assert.equal(old.active,false);assert.deepEqual(old.roles,[]);assert.equal(old.recoveredTo,NEW.userId);assert.equal(nu.recoveredFrom,OLD.userId);assert.equal(nu.active,true);
 deny(()=>run(n,OLD,{type:'post',cohortId:n.cohorts[0].id,title:'Hello again',body:'Old account should not be able to post.'},t2),403);
});
test('requester cannot approve or decline their own request, even as owner',()=>{
 let t=base();deny(()=>decide(t,NEW),403);
 // an owner who files a request still cannot decide it
 t=run(t,NEW,{type:'recovery-withdraw',requestId:t.recovery[0].id},t1);
 t=run(t,B,{type:'recovery-request',claimedEmail:OTHER.email},t1);const r=t.recovery.at(-1);
 deny(()=>run(t,B,{type:'recovery-decide',requestId:r.id,decision:'approve',reason:'Self approval attempt here.',checklist:ticks(),reviewedVersion:r.version},t2),403);
 deny(()=>run(t,B,{type:'recovery-decide',requestId:r.id,decision:'decline',reason:'Self decline attempt here.',checklist:ticks(),reviewedVersion:r.version},t2),403);
});
test('non-admin members are denied; outsiders are isolated; requests are private',()=>{
 const t=base();
 for(const u of [OTHER,FAC,OLD])deny(()=>decide(t,u),403);
 deny(()=>decide(t,OUT),404);deny(()=>file(t,OUT),404);
 assert.throws(()=>projectTeam(t,OUT));
 const po=projectTeam(t,OTHER).team.recovery;assert.deepEqual(po.queue,[]);assert.deepEqual(po.mine,[]);assert.equal(po.canDecide,false);
 assert.equal(JSON.stringify(projectTeam(t,OTHER)).includes(OLD.email),false);
 const pa=projectTeam(t,B).team.recovery;assert.equal(pa.queue.length,1);assert.equal(pa.queue[0].candidate.email,OLD.email);
 // another account cannot withdraw someone else's request
 deny(()=>run(t,OTHER,{type:'recovery-withdraw',requestId:t.recovery[0].id},t2),404);
});
test('double approval and replay are refused and change nothing',()=>{
 const n=decide(base(),B),snap=JSON.stringify(n);
 deny(()=>run(n,B,{type:'recovery-decide',requestId:n.recovery[0].id,decision:'approve',reason:'Second approval attempt here.',checklist:ticks(),reviewedVersion:n.recovery[0].version},t2),409);
 deny(()=>run(n,A,{type:'recovery-decide',requestId:n.recovery[0].id,decision:'decline',reason:'Late decline attempt here.',checklist:ticks(),reviewedVersion:n.recovery[0].version},t2),409);
 assert.equal(JSON.stringify(n),snap);
 // a second request for the same old member cannot recover twice
 const again=run(n,OTHER,{type:'recovery-request',claimedEmail:OLD.email},t2);deny(()=>run(again,B,{type:'recovery-decide',requestId:again.recovery[1].id,decision:'approve',reason:'Claim against a recovered member.',checklist:ticks(),reviewedVersion:again.recovery[1].version},t2),409);
});
test('audit trail names actor, before and after ids and checklist',()=>{
 const n=decide(base(),B),a=n.activity.filter(x=>x.action.startsWith('recovery')||x.action==='assisted-invite');
 assert.deepEqual(a.map(x=>x.action),['assisted-invite','recovery-request','recovery-approve']);
 const ap=a.at(-1);assert.equal(ap.actor,B.userId);assert.equal(ap.detail.fromUserId,OLD.userId);assert.equal(ap.detail.toUserId,NEW.userId);assert.equal(ap.detail.before.oldActive,true);assert.equal(ap.detail.after.oldActive,false);assert.equal(ap.detail.enrollments,1);
 const r=n.recovery[0];assert.deepEqual(r.events.map(e=>e.type),['filed','approved']);assert.equal(r.relink.fromUserId,OLD.userId);assert.equal(r.decision.by,B.userId);assert.equal(r.decision.verifiedCount,2);
});
test('dummy checklist: fewer than 2 checks cannot approve; decline path needs a reason and moves nothing',()=>{
 const t=base();deny(()=>decide(t,B,{checklist:ticks(true,false,false)}),409);deny(()=>decide(t,B,{checklist:{cohort:true,email:true}}),422);
 deny(()=>decide(t,B,{reason:'short'}),422);
 const n=decide(t,B,{decision:'decline',reason:'Could not confirm the person; ask them to try again.',checklist:ticks(false,false,false)});
 assert.equal(n.recovery[0].status,'declined');assert.equal(n.members.find(m=>m.userId===OLD.userId).active,true);assert.ok(n.learners.some(l=>l.userId===OLD.userId));assert.equal(oldState(n),oldState(t));
 assert.equal(n.activity.at(-1).action,'recovery-decline');assert.equal(projectTeam(n,NEW).team.recovery.mine[0].reason.startsWith('Could not'),true);
});
test('stale review version is refused; requester can withdraw once',()=>{
 let t=base();const v=t.recovery[0].version;deny(()=>decide(t,B,{reviewedVersion:v-1}),409);deny(()=>decide(t,B,{reviewedVersion:undefined}),409);
 t=run(t,NEW,{type:'recovery-withdraw',requestId:t.recovery[0].id},t2);assert.equal(t.recovery[0].status,'withdrawn');
 deny(()=>decide(t,B,{reviewedVersion:v}),409);deny(()=>run(t,NEW,{type:'recovery-withdraw',requestId:t.recovery[0].id},t2),409);
});
test('workspace revision CAS and actionId replay behave like the route contract (mini harness)',()=>{
 let store={team:base(),revision:5};const seen=new Map();
 const post=(u,rev,actionId,cmd)=>{const prior=seen.get(actionId);if(prior)return {replayed:true};if(rev!==store.revision)return {status:409};store={team:run(store.team,u,cmd,t2),revision:store.revision+1};seen.set(actionId,1);return {ok:true}};
 const r=store.team.recovery[0],cmd={type:'recovery-decide',requestId:r.id,decision:'approve',reason:'Two synthetic checks confirmed.',checklist:ticks(),reviewedVersion:r.version};
 assert.equal(post(B,4,'a1',cmd).status,409);assert.equal(post(B,5,'a1',cmd).ok,true);assert.equal(post(B,5,'a1',cmd).replayed,true);assert.equal(store.revision,6);assert.equal(store.team.recovery[0].status,'approved');
});
test('only learner-only members are recoverable; staff/owner and unknown emails are refused or unresolved',()=>{
 let t=invited(fixture());
 t=run(t,NEW,{type:'recovery-request',claimedEmail:FAC.email},t1);deny(()=>decide(t,B),409);
 let u=invited(fixture());u=run(u,NEW,{type:'recovery-request',claimedEmail:'nobody@example.test'},t1);assert.equal(u.recovery[0].oldMemberId,null);deny(()=>decide(u,B),409);
 // uniform outcome: own and unknown emails look identical to the requester
 const own=run(invited(fixture()),NEW,{type:'recovery-request',claimedEmail:NEW.email},t1);assert.equal(own.recovery[0].oldMemberId,null);
});
test('a new account that already holds learning records cannot be merged over',()=>{
 let t=invited(fixture());const p=programs[0].id;t=run(t,NEW,{type:'enroll',programId:p,cohortId:t.cohorts[0].id},t1);
 t=file(t);deny(()=>decide(t,B),409);assert.ok(t.learners.some(l=>l.userId===OLD.userId));
 // an empty shell record (no enrollments) is replaced safely
 let s=invited(fixture());s=run(s,NEW,{type:'profile',name:'Fictional Learner New',context:'msme',reading:false,networking:false},t1);s=file(s);assert.ok(learnerRecordIsEmpty(s.learners.find(l=>l.userId===NEW.userId).state));const n=decide(s,B);assert.equal(n.learners.filter(l=>l.userId===NEW.userId).length,1);assert.equal(n.learners.find(l=>l.userId===NEW.userId).state.enrollments.length,1);
});
test('one open request per account, field validation, unsupported fields',()=>{
 const t=base();deny(()=>file(t),409);deny(()=>run(invited(fixture()),NEW,{type:'recovery-request',claimedEmail:'not-an-email'},t1),422);deny(()=>run(invited(fixture()),NEW,{type:'recovery-request',claimedEmail:OLD.email,oldMemberId:OLD.userId},t1),400);
});
test('assisted onboarding: admin-only, noted, reuses the normal invite, projection hides token',()=>{
 const t=invited(fixture()),i=t.invites.at(-1);assert.equal(i.assisted.by,A.userId);assert.equal(i.assisted.note,'Helped by phone at the village centre.');assert.equal(i.status,'accepted');assert.ok(/^[a-f0-9]{64}$/.test(i.tokenHash));
 const base0=fixture();deny(()=>run(base0,FAC,{type:'invite',email:'x@example.test',roles:['learner'],scopes:[],tokenHash:hex(999),assistedNote:'Facilitator assistance note.'},t0),403);
 deny(()=>run(base0,A,{type:'invite',email:'x@example.test',roles:['learner'],scopes:[],tokenHash:hex(998),assistedNote:'short'},t0),422);
 const ordinary=run(base0,A,{type:'invite',email:'y@example.test',roles:['learner'],scopes:[],tokenHash:hex(997)},t0);assert.equal(ordinary.invites.at(-1).assisted,undefined);
 const pa=projectTeam(t,A).team.invites.find(x=>x.id===i.id);assert.equal(pa.assisted.note.length>10,true);assert.equal('tokenHash' in pa,false);
 deny(()=>projectTeam(t,OUT),404);
});
