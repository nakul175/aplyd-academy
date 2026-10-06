import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {applyCommand,freshWorkspace,programs,RuleError,hmacSha256Hex,issue,transition,effectiveStatus,verifyIntegrity,publicProjection,ownerView,labelFromEvidence,newCredentialToken,isCredentialToken,lookupPublicCredential,DEMO_ISSUER,DEMO_MARK,CredentialError} from '../../.sites-runtime/credential-qa/model.mjs';
const p=programs[1],T0='2026-10-05T12:00:00.000Z',day=n=>new Date(Date.parse(T0)+n*86400000).toISOString();
const apply=(s,c,now=T0,staff)=>applyCommand(s,c,now,staff);
const evidence=()=>Object.fromEntries(p.practicalAssessment.submissionPrompts.map(f=>[f.id,'Synthetic checked evidence. Sources are verified and private fields excluded.']));
const enroll=()=>apply(freshWorkspace(),{type:'enroll',programId:p.id});
const doLessons=(s,n=p.lessons.length)=>{const id=s.enrollments[0].id;for(const l of p.lessons.slice(0,n))s=apply(s,{type:'lesson',enrollmentId:id,lessonId:l.id,practice:'I used the fictional packet and checked the source references carefully.',answers:l.quiz.map(q=>q.correctOptionIndex)});return s};
const prepared=()=>{let s=doLessons(enroll());return apply(s,{type:'submit',enrollmentId:s.enrollments[0].id,fields:evidence(),confirmed:true})};
const assess=(s,gates=[true,true,true])=>({type:'assess',enrollmentId:s.enrollments[0].id,attemptId:s.enrollments[0].attempts.at(-1).id,actor:'assessor-a',scores:[4,4,4,4],gates,notes:Array(4).fill('Checked submitted evidence against fictional sources.'),feedback:'Synthetic feedback that is long enough to be actionable and clear.'});
const passed=()=>{let s=prepared();return apply(s,assess(s))};
const reviewer=(s,action,reason='Synthetic reviewer reason, long enough.',extra={})=>({type:'credential-lifecycle',enrollmentId:s.enrollments[0].id,action,reason,actor:'reviewer-b',...extra});
const mk=(o={})=>issue({recordId:'rec-1',label:'competence',pathwayTitle:'Synthetic Pathway',pathwayEdition:'v1',now:T0,...o});
const human=(id='staff-1',role='reviewer')=>({id,role,name:'Synthetic Staff'});
const sys={id:'system:test',role:'system'};

test('HMAC-SHA256 matches node and WebCrypto for short, block-sized and long inputs',async()=>{
 const key='aplyd-academy/DUMMY-issuer/demo-key-v1/public-not-a-secret';
 for(const m of ['','a','abc','x'.repeat(55),'x'.repeat(56),'x'.repeat(64),'x'.repeat(65),'é'.repeat(300),'y'.repeat(100000)]){
  assert.equal(hmacSha256Hex(key,m),createHmac('sha256',key).update(m).digest('hex'));
 }
 const k=await webcrypto.subtle.importKey('raw',new TextEncoder().encode('k'.repeat(100)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const w=Buffer.from(await webcrypto.subtle.sign('HMAC',k,new TextEncoder().encode('hello'))).toString('hex');
 assert.equal(hmacSha256Hex('k'.repeat(100),'hello'),w);
});

test('credential ids are unique, unguessable-format tokens',()=>{
 const ids=new Set();for(let i=0;i<2000;i++){const t=newCredentialToken();assert.ok(isCredentialToken(t));ids.add(t)}assert.equal(ids.size,2000);
 for(const bad of ['',null,undefined,5,'acv_short','acv_'+'a'.repeat(33),'ACV_'+'a'.repeat(32),'acv_'+'a'.repeat(31)+'!','../etc/passwd','acv_'+'a'.repeat(32)+'\n'])assert.equal(isCredentialToken(bad),false);
 assert.notEqual(mk().id,mk().id);
});

test('issued credential is DUMMY-labelled, expires in 12 months and starts with a chained issue event',()=>{
 const c=mk();assert.equal(c.issuer,'DUMMY');assert.equal(c.status,'active');assert.equal(c.expiresAt,new Date(Date.parse(T0)+365*86400000).toISOString());
 assert.equal(c.history.length,1);assert.equal(c.history[0].action,'issue');assert.deepEqual(verifyIntegrity(c),{ok:true,problems:[]});
 assert.equal(mk({ttlDays:30}).expiresAt,day(30));assert.throws(()=>mk({ttlDays:0}),CredentialError);
 const v=publicProjection(c,T0);assert.equal(v.issuer,DEMO_ISSUER);assert.match(v.issuer,/DUMMY issuer \(demo key, not a real certifying body\)/);assert.equal(v.mark,'DEMO / not accredited');assert.match(v.notice,/not a certificate/);
});

test('label is derived strictly from evidence',()=>{
 assert.equal(labelFromEvidence({lessonsDone:0,lessonsTotal:3,humanPass:false}),null);
 assert.equal(labelFromEvidence({lessonsDone:1,lessonsTotal:3,humanPass:false}),'participation');
 assert.equal(labelFromEvidence({lessonsDone:3,lessonsTotal:3,humanPass:false}),'completion');
 assert.equal(labelFromEvidence({lessonsDone:3,lessonsTotal:3,humanPass:true}),'competence');
 assert.equal(labelFromEvidence({lessonsDone:0,lessonsTotal:0,humanPass:false}),null);
});

test('engine: participation, completion, then competence only after a human-assessed pass',()=>{
 let s=enroll();assert.throws(()=>apply(s,{type:'credential-issue',enrollmentId:s.enrollments[0].id}),e=>e instanceof RuleError&&e.status===409);
 s=doLessons(s,1);s=apply(s,{type:'credential-issue',enrollmentId:s.enrollments[0].id});assert.equal(s.enrollments[0].credential.label,'participation');assert.equal(s.enrollments[0].record,null);
 s=doLessons(structuredClone(s));// the first lesson is already complete in the lesson step; completing remaining
 s=apply(s,{type:'credential-issue',enrollmentId:s.enrollments[0].id});assert.equal(s.enrollments[0].credential.label,'completion');
 assert.equal(s.enrollments[0].credential.history.at(-1).action,'correct');assert.equal(s.enrollments[0].credential.history.at(-1).cause,'evidence');
 s=apply(s,{type:'submit',enrollmentId:s.enrollments[0].id,fields:evidence(),confirmed:true});
 s=apply(s,assess(s));assert.equal(s.enrollments[0].record.status,'active');assert.equal(s.enrollments[0].credential.label,'competence');
 assert.equal(s.enrollments[0].credential.recordId,s.enrollments[0].id);assert.equal(verifyIntegrity(s.enrollments[0].credential).ok,true);
 assert.equal(s.enrollments[0].credential.history.length,3);
});

test('engine: a failed critical gate never yields competence',()=>{
 let s=prepared();s=apply(s,assess(s,[false,true,true]));assert.equal(s.enrollments[0].record,null);assert.equal(s.enrollments[0].credential,undefined);
 s=apply(s,{type:'credential-issue',enrollmentId:s.enrollments[0].id});assert.equal(s.enrollments[0].credential.label,'completion');
});

test('engine: a pass auto-issues exactly one competence credential and re-issue is idempotent',()=>{
 let s=passed();const c=s.enrollments[0].credential;assert.equal(c.label,'competence');assert.equal(c.pathwayTitle,p.title);assert.equal(c.pathwayEdition,String(s.enrollments[0].contentRef?.versionId??s.enrollments[0].version));
 const again=apply(s,{type:'credential-issue',enrollmentId:s.enrollments[0].id});assert.deepEqual(again.enrollments[0].credential,c);
});

test('existing records, evidence and decisions are untouched; input state is never mutated',()=>{
 const before=passed(),snap=JSON.stringify(before);const next=apply(before,{type:'share',enrollmentId:before.enrollments[0].id,enabled:true});assert.equal(JSON.stringify(before),snap);
 const strip=e=>{const {credential,...rest}=e;return rest};const base=(()=>{let s=prepared();return apply(s,assess(s))})();
 assert.equal(next.enrollments[0].record.kind,'Nonaccredited practice completion');assert.deepEqual(next.enrollments[0].attempts,before.enrollments[0].attempts);assert.deepEqual(strip(next.enrollments[0]).record,{...before.enrollments[0].record,share:true});
 // legacy state with a record and no credential is not rewritten by an unrelated command
 const legacy=structuredClone(before);delete legacy.enrollments[0].credential;const out=apply(legacy,{type:'profile',name:'Ana',context:'msme',reading:false,networking:false});assert.equal(out.enrollments[0].credential,undefined);
});

test('tamper detection: label, dates, pathway, status, history edits and deletions all fail integrity',()=>{
 const base=transition(mk(),{action:'suspend',actor:human(),reason:'Synthetic suspension reason.',now:day(1)});assert.equal(verifyIntegrity(base).ok,true);
 const muts={label:c=>{c.label='participation'},expiresAt:c=>{c.expiresAt=day(9999)},pathway:c=>{c.pathwayTitle='Other'},edition:c=>{c.pathwayEdition='v9'},id:c=>{c.id=newCredentialToken()},issuer:c=>{c.issuer='REAL'},
  statusOnly:c=>{c.status='active'},reason:c=>{c.history[1].reason='edited'},actor:c=>{c.history[1].actor.id='someone-else'},dropEvent:c=>{c.history.pop();c.status='active'},dropFirst:c=>{c.history.shift()},reorder:c=>{c.history.reverse()},sig:c=>{c.sig='0'.repeat(64)},version:c=>{c.version=7}};
 for(const [name,f] of Object.entries(muts)){const c=structuredClone(base);f(c);assert.equal(verifyIntegrity(c).ok,false,name);const v=publicProjection(c,day(2));assert.equal(v.integrity,'failed',name);assert.match(v.statusNote,/INTEGRITY CHECK FAILED/);}
 assert.equal(verifyIntegrity(null).ok,false);assert.equal(verifyIntegrity({}).ok,false);
});

test('status display: expiry is time-based; revoked, suspended and expired are unmistakable',()=>{
 const a=mk();assert.equal(effectiveStatus(a,day(364)),'active');assert.equal(effectiveStatus(a,day(365)),'expired');
 const ex=publicProjection(a,day(400));assert.equal(ex.status,'expired');assert.match(ex.statusNote,/^EXPIRED/);assert.equal(ex.mark,DEMO_MARK);
 const sus=transition(a,{action:'suspend',actor:human(),reason:'Synthetic suspension reason.',now:day(2)});assert.match(publicProjection(sus,day(3)).statusNote,/^SUSPENDED/);
 const rev=transition(sus,{action:'revoke',actor:human(),reason:'Synthetic revocation reason.',now:day(3)});const rv=publicProjection(rev,day(3));assert.equal(rv.status,'revoked');assert.match(rv.statusNote,/^REVOKED/);
 assert.equal(publicProjection(rev,day(500)).status,'revoked');// revoked stays revoked after expiry
 for(const v of [ex,rv])assert.equal(v.integrity,'intact');
});

test('lifecycle: correct, suspend, reinstate, revoke, expire are recorded and history is append-only',()=>{
 let c=mk(),prev=[];const step=(t)=>{const n=transition(c,t);assert.equal(n.history.length,c.history.length+1);assert.deepEqual(n.history.slice(0,c.history.length),c.history);assert.equal(verifyIntegrity(n).ok,true);assert.equal(c.history.length,prev.length||c.history.length);c=n;prev=c.history};
 step({action:'correct',actor:human(),reason:'Synthetic correction reason.',now:day(1),label:'completion',maxLabel:'competence'});assert.equal(c.label,'completion');assert.equal(c.version,2);assert.equal(c.history.at(-1).before,'competence');assert.equal(c.history.at(-1).after,'completion');
 step({action:'suspend',actor:human(),reason:'Synthetic suspension reason.',now:day(2)});assert.equal(c.status,'suspended');
 step({action:'reinstate',actor:human('staff-2','admin'),reason:'Synthetic reinstatement reason.',now:day(3)});assert.equal(c.status,'active');
 step({action:'suspend',actor:human(),reason:'Synthetic suspension reason.',now:day(4)});
 step({action:'expire',actor:sys,reason:'The validity period ended.',now:day(366)});assert.equal(c.status,'expired');assert.equal(c.history.at(-1).cause,'time');
 assert.deepEqual(c.history.map(h=>h.action),['issue','correct','suspend','reinstate','suspend','expire']);
 assert.throws(()=>transition(c,{action:'reinstate',actor:human(),reason:'Synthetic reinstatement reason.',now:day(367)}),CredentialError);
 const closed=transition(c,{action:'revoke',actor:human(),reason:'Synthetic revocation reason.',now:day(368)});assert.equal(closed.status,'revoked');assert.equal(closed.history.length,7);
});

test('lifecycle rules: revoked is terminal; expire needs real expiry; correction cannot exceed evidence',()=>{
 const rev=transition(mk(),{action:'revoke',actor:human(),reason:'Synthetic revocation reason.',now:day(1)});
 for(const action of ['reinstate','suspend','revoke'])assert.throws(()=>transition(rev,{action,actor:human(),reason:'Synthetic reason long enough.',now:day(2)}),e=>e instanceof CredentialError&&e.status===409);
 assert.throws(()=>transition(rev,{action:'correct',actor:human(),reason:'Synthetic reason long enough.',now:day(2),label:'completion',maxLabel:'competence'}),CredentialError);
 assert.throws(()=>transition(mk(),{action:'expire',actor:sys,reason:'early',now:day(10)}),CredentialError);
 const part=mk({label:'participation'});
 assert.throws(()=>transition(part,{action:'correct',actor:human(),reason:'Synthetic reason long enough.',now:day(1),label:'competence',maxLabel:'completion'}),e=>e.status===409);
 assert.throws(()=>transition(part,{action:'correct',actor:human(),reason:'Synthetic reason long enough.',now:day(1),label:'completion'}),CredentialError);
 assert.throws(()=>transition(part,{action:'reinstate',actor:human(),reason:'Synthetic reason long enough.',now:day(1)}),CredentialError);
});

test('role checks: only reviewer or admin; reasons required; system cannot revoke or correct downward',()=>{
 const c=mk(),r='Synthetic reason long enough.';
 for(const actor of [{id:'learner-1',role:'learner'},{id:'x',role:'facilitator'},{id:'system:x',role:'learner'},{id:'',role:'reviewer'},{id:'system:fake',role:'reviewer'},sys])
  for(const action of ['suspend','revoke','correct','reinstate'])assert.throws(()=>transition(c,{action,actor,reason:r,now:day(1),label:'completion',maxLabel:'competence'}),e=>e instanceof CredentialError&&e.status===403,action+JSON.stringify(actor));
 assert.throws(()=>transition(c,{action:'expire',actor:human(),reason:r,now:day(400)}),e=>e.status===403);
 for(const reason of ['','short',' '.repeat(20),'x'.repeat(1001),undefined])assert.throws(()=>transition(c,{action:'revoke',actor:human(),reason,now:day(1)}),e=>e instanceof CredentialError&&e.status===422);
 // system may only suspend/reinstate for an appeal and raise a label from evidence
 assert.equal(transition(c,{action:'suspend',actor:{id:'system:appeal-review',role:'system'},reason:'Adverse appeal.',now:day(1),cause:'appeal'}).status,'suspended');
 assert.throws(()=>transition(c,{action:'revoke',actor:{id:'system:appeal-review',role:'system'},reason:'Adverse appeal.',now:day(1),cause:'appeal'}),e=>e.status===403);
 assert.throws(()=>transition(c,{action:'suspend',actor:{id:'system:appeal-review',role:'system'},reason:'No cause given.',now:day(1)}),e=>e.status===403);
});

test('engine roles: learner and unlabelled callers cannot change a credential; sample reviewer can; staff role is recorded',()=>{
 const s=passed(),id=s.enrollments[0].id;
 for(const c of [{...reviewer(s,'revoke'),actor:undefined},{...reviewer(s,'revoke'),actor:'assessor-a'},{...reviewer(s,'revoke'),actor:'learner'}])assert.throws(()=>apply(s,c),e=>e instanceof RuleError&&e.status===403);
 assert.throws(()=>apply(s,reviewer(s,'revoke','short')),e=>e instanceof RuleError&&e.status===422);
 assert.throws(()=>apply(s,reviewer(s,'delete')),RuleError);assert.throws(()=>apply(s,{...reviewer(s,'revoke'),extra:1}),e=>e.status===400);
 assert.throws(()=>apply(enroll(),reviewer(enroll(),'revoke')),e=>e.status===404||e.status===404);
 const out=apply(s,reviewer(s,'suspend'));assert.equal(out.enrollments[0].credential.status,'suspended');assert.equal(out.enrollments[0].credential.history.at(-1).actor.role,'reviewer');
 const staff={userId:'u-admin',name:'Synthetic Admin',workspaceId:'tw-x',workspaceName:'Synthetic Team',role:'admin'};
 const {actor,...noActor}=reviewer(s,'revoke');const rev=apply(s,noActor,T0,staff);assert.equal(rev.enrollments[0].credential.status,'revoked');assert.equal(rev.enrollments[0].credential.history.at(-1).actor.role,'admin');assert.equal(rev.enrollments[0].credential.history.at(-1).actor.id,'u-admin');
 assert.equal(rev.enrollments[0].id,id);
 // correction above the evidence is refused
 let w=doLessons(enroll());w=apply(w,{type:'credential-issue',enrollmentId:w.enrollments[0].id});assert.equal(w.enrollments[0].credential.label,'completion');
 assert.throws(()=>apply(w,reviewer(w,'correct','Synthetic reason long enough.',{label:'competence'})),e=>e instanceof RuleError&&e.status===409);
 const down=apply(w,reviewer(w,'correct','Synthetic reason long enough.',{label:'participation'}));assert.equal(down.enrollments[0].credential.label,'participation');
});

test('engine: adverse appeal suspends the credential with an appeal-caused event; history survives',()=>{
 let s=passed();const e0=s.enrollments[0];s=apply(s,{type:'appeal',enrollmentId:e0.id,attemptId:e0.attempts[0].id,reason:'Important verification evidence may have been overlooked here.'});
 s=apply(s,{...assess(s),type:'resolve',appealId:s.enrollments[0].appeals[0].id,actor:'reviewer-b',gates:[false,true,true]});
 const c=s.enrollments[0].credential;assert.equal(s.enrollments[0].record.status,'suspended');assert.equal(c.status,'suspended');assert.equal(c.history.at(-1).cause,'appeal');assert.equal(c.history.at(-1).actor.id,'system:appeal-review');assert.deepEqual(c.history.map(h=>h.action),['issue','suspend']);assert.equal(verifyIntegrity(c).ok,true);
 // a reviewer cannot reinstate while the record is suspended, but can still revoke; history is only appended
 assert.throws(()=>apply(s,reviewer(s,'reinstate')),e=>e instanceof RuleError&&e.status===409);const rv=apply(s,reviewer(s,'revoke'));assert.deepEqual(rv.enrollments[0].credential.history.map(h=>h.action),['issue','suspend','revoke']);
});

test('engine: expiry is recorded on the next command and never deletes the credential',()=>{
 let s=passed();const later=day(400);s=apply(s,{type:'profile',name:'Ana',context:'msme',reading:false,networking:false},later);
 const c=s.enrollments[0].credential;assert.equal(c.status,'expired');assert.equal(c.history.at(-1).action,'expire');assert.equal(c.history.at(-1).cause,'time');assert.equal(verifyIntegrity(c).ok,true);assert.equal(s.enrollments[0].record.status,'active');
});

test('share gating: public lookup works only while the learner share flag is on',()=>{
 let s=passed();const tok=s.enrollments[0].credential.id,rows=()=>[{data:JSON.stringify(s)}];
 assert.equal(lookupPublicCredential(tok,rows(),T0),null);
 s=apply(s,{type:'share',enrollmentId:s.enrollments[0].id,enabled:true});const v=lookupPublicCredential(tok,rows(),T0);assert.equal(v.credentialId,tok);assert.equal(v.label,'competence');assert.equal(v.status,'active');
 s=apply(s,{type:'share',enrollmentId:s.enrollments[0].id,enabled:false});assert.equal(lookupPublicCredential(tok,rows(),T0),null);
 // no record yet: credentialShare is the gate and uses the same share command
 let w=doLessons(enroll());w=apply(w,{type:'credential-issue',enrollmentId:w.enrollments[0].id});const t2=w.enrollments[0].credential.id;
 assert.equal(lookupPublicCredential(t2,[{data:JSON.stringify(w)}],T0),null);w=apply(w,{type:'share',enrollmentId:w.enrollments[0].id,enabled:true});assert.equal(lookupPublicCredential(t2,[{data:JSON.stringify(w)}],T0).label,'completion');
 // team aggregate shape
 const team={id:'tw-1',learners:[{userId:'u1',state:w}]};assert.equal(lookupPublicCredential(t2,[{data:JSON.stringify(team)}],T0).credentialId,t2);
 // revoked credentials stay verifiable (as revoked) while shared
 s=apply(s,{type:'share',enrollmentId:s.enrollments[0].id,enabled:true});s=apply(s,reviewer(s,'revoke'));assert.equal(lookupPublicCredential(tok,rows(),T0).status,'revoked');
});

test('public projection leaks no PII, evidence, ids or actors',()=>{
 let s=passed();s=apply(s,{type:'profile',name:'Zed Synthetic-Learner',context:'msme',reading:false,networking:false});s=apply(s,{type:'share',enrollmentId:s.enrollments[0].id,enabled:true});
 s=apply(s,reviewer(s,'suspend','Synthetic private suspension reason SECRETWORDS.'),T0);
 s.enrollments[0].draft={task:'PRIVATE-DRAFT-CANARY'};s.email='zed@example.test';s.userId='user-canary-1';
 const tok=s.enrollments[0].credential.id,v=lookupPublicCredential(tok,[{data:JSON.stringify(s)}],T0),json=JSON.stringify(v);
 assert.deepEqual(Object.keys(v).sort(),['credentialId','edition','expiresAt','integrity','issuedAt','issuer','label','labelMeaning','lastChange','mark','notice','pathway','status','statusNote'].sort());
 for(const secret of ['Zed','zed@example','user-canary','PRIVATE-DRAFT','SECRETWORDS','reviewer-b','sample:',s.enrollments[0].record.id,s.enrollments[0].id,'assessor-a','Sample reviewer'])assert.ok(!json.includes(secret),secret);
 assert.deepEqual(Object.keys(v.lastChange).sort(),['action','at']);
 const owner=ownerView(s.enrollments[0].credential,T0);assert.ok(owner.history.every(h=>!('actor' in h)));
});

test('no oracle: malformed, unknown, unshared and corrupt rows are indistinguishable',()=>{
 const s=passed(),tok=s.enrollments[0].credential.id,rows=[{data:JSON.stringify(s)},{data:'{not json'},{data:'null'},{data:JSON.stringify({enrollments:'x',learners:[null,{state:5}]})}];
 const none=[lookupPublicCredential('acv_'+'A'.repeat(32),rows,T0),lookupPublicCredential(tok,rows,T0),lookupPublicCredential('bad',rows,T0),lookupPublicCredential(undefined,rows,T0),lookupPublicCredential(tok+'x',rows,T0),lookupPublicCredential(tok,[],T0)];
 for(const r of none)assert.strictEqual(r,null);
 // a token that merely appears elsewhere in a row (e.g. a post body) is not a match
 const sneaky={...s,posts:[{body:tok}]};assert.equal(lookupPublicCredential(tok,[{data:JSON.stringify({...sneaky,enrollments:[]})}],T0),null);
 // a credential id placed on a different object field does not match
 const fake=structuredClone(s);fake.enrollments[0].share=true;assert.equal(lookupPublicCredential(tok,[{data:JSON.stringify(fake)}],T0),null);
});

test('tampered stored credential shows a failed integrity note publicly, never a clean status',()=>{
 let s=passed();s=apply(s,{type:'share',enrollmentId:s.enrollments[0].id,enabled:true});s.enrollments[0].credential.label='participation';
 const v=lookupPublicCredential(s.enrollments[0].credential.id,[{data:JSON.stringify(s)}],T0);assert.equal(v.integrity,'failed');assert.match(v.statusNote,/INTEGRITY CHECK FAILED/);
});
