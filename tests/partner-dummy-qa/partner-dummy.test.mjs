import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),modelPath=root+'.sites-runtime/partner-dummy-qa/model.mjs';
if(!existsSync(modelPath))spawnSync(process.execPath,[root+'tests/partner-dummy-qa/build-model.mjs'],{stdio:'inherit'});
const M=await import(modelPath);
const {startDummyPartner,MEMBERS}=await import(root+'scripts/demo/dummy-partner.mjs');
const NOW='2026-10-07T10:00:00.000Z',NOWMS=Date.parse(NOW),nonce=(n=1)=>('n'+n).padEnd(20,'x'),H=h=>({get:k=>h[k.toLowerCase()]??null});
const enr={id:'enr-1',programId:'msme-customer-operations',version:'0.1-review-draft',withdrawn:false};
const linked=()=>M.createLink(M.emptyState(),{memberCode:'DEMO-AAA001',enrollmentId:'enr-1'},enr,NOW,'link-1');
const grant=(s,scope,days=7,id='c-'+scope)=>M.grantConsent(s,{linkId:'link-1',scope,days},NOW,id);
const facts={status:'in-progress',startedAt:'2026-10-01T00:00:00.000Z',completedAt:null};
const L=s=>s.links[0];

test('HMAC: valid signature verifies; invalid, tampered body/timestamp/nonce, missing and malformed fail',async()=>{
 const body='{"a":1}',h=await M.signRequest(M.DEMO_SHARED_SECRET,body,NOWMS,nonce());
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H(h),NOWMS)).ok,true);
 assert.deepEqual(await M.verifyRequest('wrong-secret',body,H(h),NOWMS),{ok:false,reason:'bad-signature'});
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body+' ',H(h),NOWMS)).reason,'bad-signature');
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H({...h,'x-demo-nonce':nonce(2)}),NOWMS)).reason,'bad-signature');
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H({...h,'x-demo-timestamp':String(NOWMS+1000)}),NOWMS)).reason,'bad-signature');
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H({...h,'x-demo-signature':'0'.repeat(64)}),NOWMS)).reason,'bad-signature');
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H({...h,'x-demo-signature':'zz'}),NOWMS)).reason,'bad-signature');
 assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,body,H({}),NOWMS)).reason,'missing');
});
test('HMAC: stale and far-future timestamps are rejected even when correctly signed',async()=>{
 for(const skew of [-6*60e3,6*60e3]){const t=NOWMS+skew,h=await M.signRequest(M.DEMO_SHARED_SECRET,'x',t,nonce());assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,'x',H(h),NOWMS)).reason,'stale')}
 const ok=await M.signRequest(M.DEMO_SHARED_SECRET,'x',NOWMS-4*60e3,nonce());assert.equal((await M.verifyRequest(M.DEMO_SHARED_SECRET,'x',H(ok),NOWMS)).ok,true);
});
test('replay protection: a nonce is accepted once, then refused; old nonces are pruned',()=>{
 let n=M.recordNonce([],nonce(),NOWMS);assert.equal(n.length,1);
 assert.throws(()=>M.recordNonce(n,nonce(),NOWMS+1000),e=>e.status===409);
 n=M.recordNonce(n,nonce(2),NOWMS+20*60e3);assert.deepEqual(n.map(x=>x.nonce),[nonce(2)]);
});
test('consent scopes: each is separately grantable, withdrawable and expiring; regrant replaces',()=>{
 let s=grant(linked(),'progress',7);assert.deepEqual(M.activeScopes(L(s),NOW),['progress']);
 s=grant(s,'credential-status',1);assert.deepEqual(M.activeScopes(L(s),NOW),['progress','credential-status']);
 assert.deepEqual(M.activeScopes(L(s),'2026-10-09T10:00:00.000Z'),['progress']); // credential-status expired after 1 day
 s=M.withdrawConsent(s,{linkId:'link-1',scope:'progress'},NOW);assert.deepEqual(M.activeScopes(L(s),NOW),['credential-status']);
 s=grant(s,'credential-status',30,'c2');assert.equal(L(s).consents.filter(c=>c.scope==='credential-status'&&c.withdrawnAt===null).length,1);
 assert.throws(()=>grant(s,'progress',91),/1 to 90/);assert.throws(()=>M.grantConsent(s,{linkId:'link-1',scope:'name',days:7},NOW,'x'));
 assert.throws(()=>M.grantConsent(s,{linkId:'link-1',scope:'progress',days:7,extra:1},NOW,'x'),e=>e.status===400);
});
test('linking shares nothing; one live link per member code and per enrolment; withdrawn learning refused',()=>{
 const s=linked();assert.deepEqual(M.activeScopes(L(s),NOW),[]);assert.throws(()=>M.buildPayload(L(s),facts,NOW,'evt-1'),e=>e.status===409);
 assert.throws(()=>M.createLink(s,{memberCode:'DEMO-AAA001',enrollmentId:'enr-1'},enr,NOW,'l2'),/already linked/);
 assert.throws(()=>M.createLink(M.emptyState(),{memberCode:'DEMO-AAA001',enrollmentId:'enr-1'},{...enr,withdrawn:true},NOW,'l'),e=>e.status===409);
 assert.throws(()=>M.createLink(M.emptyState(),{memberCode:'bob@example.com',enrollmentId:'enr-1'},enr,NOW,'l'));
});
test('partner view returns ONLY granted fields; ungranted fields are absent, not null',()=>{
 let s=grant(linked(),'progress');
 let v=M.authorisedView(L(s),{...facts,status:'completed',completedAt:'2026-10-05T00:00:00.000Z'},NOW);
 assert.deepEqual(Object.keys(v).sort(),['as_of','contract','edition','granted_scopes','member_code','pathway_id','progress']);
 s=grant(s,'completion');v=M.authorisedView(L(s),{...facts,status:'completed',completedAt:'2026-10-05T00:00:00.000Z'},NOW);
 assert.ok(v.completion.completed&&!('credential' in v));
 s=M.withdrawConsent(s,{linkId:'link-1'},NOW);assert.equal(M.authorisedView(L(s),facts,NOW),null);
 s=grant(grant(linked(),'credential-status'),'progress');v=M.authorisedView(L(s),facts,NOW);assert.equal(v.credential.status,'unavailable');assert.ok(!('completion' in v));
});
test('minimal payload whitelist: hostile facts cannot leak name, email, answers, evidence, scores or feedback',()=>{
 const s=grant(grant(grant(linked(),'progress'),'completion'),'credential-status');
 const hostile={...facts,name:'Asha Verma',email:'asha@example.com',practice:'PRIVATE-PRACTICE-CANARY',answers:[1,2],evidence:'EVIDENCE-CANARY',score:93,feedback:'FEEDBACK-CANARY',status:'in-progress'};
 const p=M.buildPayload(L(s),hostile,NOW,'evt-1'),text=JSON.stringify(p);
 for(const bad of ['Asha','asha@','CANARY','score','answers','feedback','email','name'])assert.ok(!text.includes(bad),bad);
 assert.deepEqual(Object.keys(p).sort(),['completion','contract','credential','edition','event_id','member_code','occurred_at','pathway_id','progress','scopes']);
 assert.throws(()=>M.buildPayload(L(s),{...facts,status:'Asha Verma wrote a long practice answer'},NOW,'evt-2'));
 assert.throws(()=>M.validatePayload({...p,name:'x'}),e=>e.status===400);assert.throws(()=>M.validatePayload({...p,progress:{...p.progress,score:1}}),e=>e.status===400);
 assert.throws(()=>M.validatePayload({...p,scopes:['progress']}),e=>e.status===400); // fields must match scopes
 assert.throws(()=>M.buildPayload(L(s),{...facts,startedAt:'yesterday'},NOW,'evt-3'));
});
test('withdrawal and unlink stop sends and block unsent deliveries',async()=>{
 let s=grant(linked(),'progress');const p=M.buildPayload(L(s),facts,NOW,'evt-1'),key=await M.deliveryKey(p);
 s=M.startDelivery(s,L(s),p,key,NOW);assert.equal(s.deliveries[0].status,'pending');
 s=M.withdrawConsent(s,{linkId:'link-1',scope:'progress'},NOW);assert.equal(s.deliveries[0].status,'blocked');assert.equal(s.deliveries[0].nextAttemptAt,null);
 assert.throws(()=>M.buildPayload(L(s),facts,'2026-10-07T10:00:01.000Z','evt-2'),e=>e.status===409);
 assert.equal(M.planDelivery(s,'link-1',key,NOW).action,'send'); // blocked entries are never resumed: a fresh send needs fresh consent
 let t=grant(linked(),'completion');t=M.startDelivery(t,L(t),M.buildPayload(L(t),facts,NOW,'evt-9'),'k',NOW);t=M.unlink(t,'link-1',NOW);assert.equal(t.deliveries[0].status,'blocked');assert.deepEqual(M.activeScopes(L(t),NOW),[]);
 // expiry also blocks a pending retry
 let u=grant(linked(),'progress',1);u=M.startDelivery(u,L(u),M.buildPayload(L(u),facts,NOW,'evt-5'),'k5',NOW);u=M.blockUnsent(u,'link-1','2026-10-09T00:00:00.000Z');assert.equal(u.deliveries[0].status,'blocked');
});
test('loopback-only refusal',()=>{
 for(const u of ['http://127.0.0.1:8791','http://127.5.5.5:1','http://[::1]:8791'])assert.doesNotThrow(()=>M.assertLoopbackUrl(u),u);
 for(const u of ['https://example.com','http://example.com:80','http://localhost:8791','http://10.0.0.5','http://0.0.0.0:80','http://192.168.1.2','http://127.0.0.1.evil.com','http://user:pw@127.0.0.1','https://127.0.0.1','ftp://127.0.0.1','http://[::ffff:8.8.8.8]','not a url','http://169.254.169.254'])assert.throws(()=>M.assertLoopbackUrl(u),e=>e.status===400,u);
 for(const u of [undefined,'',null,'   '])assert.throws(()=>M.assertLoopbackUrl(u),e=>e.status===503&&/not running/.test(e.message));
});
test('idempotent delivery: same content gives the same key and is not resent; failures back off, then exhaust',async()=>{
 let s=grant(linked(),'progress');const p1=M.buildPayload(L(s),facts,NOW,'evt-1'),p2=M.buildPayload(L(s),facts,'2026-10-07T11:00:00.000Z','evt-2');
 const k1=await M.deliveryKey(p1);assert.equal(k1,await M.deliveryKey(p2));
 assert.notEqual(k1,await M.deliveryKey(M.buildPayload(L(s),{...facts,status:'enrolled'},NOW,'evt-3')));
 s=M.startDelivery(s,L(s),p1,k1,NOW);assert.equal(M.planDelivery(s,'link-1',k1,NOW).action,'send');
 let t=NOW;for(let i=1;i<=4;i++){s=M.recordAttempt(s,'evt-1','unreachable',t);const d=s.deliveries[0];assert.equal(d.status,'failed');assert.equal(Date.parse(d.nextAttemptAt)-Date.parse(t),M.backoffMs(i));assert.equal(M.planDelivery(s,'link-1',k1,t).action,'wait');t=d.nextAttemptAt}
 assert.deepEqual([1,2,3,4,5,9].map(M.backoffMs),[30e3,60e3,120e3,240e3,480e3,3600e3]);
 s=M.recordAttempt(s,'evt-1','delivered',t);assert.equal(s.deliveries[0].status,'delivered');assert.equal(M.planDelivery(s,'link-1',k1,t).action,'already-delivered');
 s=M.recordAttempt(s,'evt-1','rejected',t);assert.equal(s.deliveries[0].status,'delivered'); // a delivered entry never regresses
 let e=grant(linked(),'progress');e=M.startDelivery(e,L(e),p1,k1,NOW);for(let i=0;i<5;i++)e=M.recordAttempt(e,'evt-1','unreachable',NOW);assert.equal(M.planDelivery(e,'link-1',k1,'2030-01-01T00:00:00.000Z').action,'exhausted');
});
test('saved state is validated strictly',()=>{
 const s=grant(linked(),'progress');assert.doesNotThrow(()=>M.readState(JSON.parse(JSON.stringify(s))));
 assert.throws(()=>M.readState({...s,extra:1}));assert.throws(()=>M.readState({links:[{...L(s),memberCode:'x'}],deliveries:[]}));
 assert.deepEqual(M.readState(undefined),{links:[],deliveries:[]});
});
test('inbound enrolment: pure claim only, idempotent, bad fields refused',()=>{
 const req=M.parseEnrolRequest('{"member_code":"DEMO-AAA001","cohort_code":"DEMO-COH-A1","pathway_id":"msme-customer-operations"}');
 const a=M.addClaim([],req,NOW,'clm-1');assert.ok(a.created);assert.equal(a.claim.status,'pending');assert.match(a.claim.note,/No account or enrolment was created/);
 const b=M.addClaim(a.claims,req,NOW,'clm-2');assert.ok(!b.created);assert.equal(b.claims.length,1);
 for(const bad of ['{"member_code":"DEMO-AAA001","cohort_code":"DEMO-COH-A1","pathway_id":"p","email":"a@b.c"}','{"member_code":"jane","cohort_code":"DEMO-COH-A1","pathway_id":"p"}','nope'])assert.throws(()=>M.parseEnrolRequest(bad));
});

/* ---------- route + service level with a faithful in-memory D1 ---------- */
function fakeDb(){
 const rows=new Map(),audit=[];let last=0;
 const run=(sql,a)=>{
  if(sql.startsWith('SELECT data,revision'))return {first:rows.has(a[0])?{...rows.get(a[0])}:null};
  if(sql.startsWith('UPDATE academy_workspaces')){const [data,revision,at,owner,rev]=a,r=rows.get(owner);if(r&&r.revision===rev){rows.set(owner,{data,revision,updated:at});last=1}else last=0;return {};}
  if(sql.startsWith('INSERT OR IGNORE INTO academy_workspaces')){const [owner,data,revision]=a;if(rows.has(owner))last=0;else{rows.set(owner,{data,revision});last=1}return {};}
  if(sql.startsWith('INSERT INTO academy_audit')){if(last===1)audit.push(a);else last=0;return {};}
  throw new Error('unexpected SQL '+sql);
 };
 return {rows,audit,prepare:sql=>({bind:(...a)=>({sql,a,first:async()=>run(sql,a).first,_run:()=>{const before=last;const r=run(sql,a);const c=sql.startsWith('INSERT INTO academy_audit')?(before===1?1:0):last;return {meta:{changes:c}}}})}),batch:async stmts=>stmts.map(s=>s._run())};
}
const CANARY={name:'Asha Verma PRIVATE-NAME-CANARY',email:'asha-private@example.com',practice:'PRIVATE-PRACTICE-CANARY'};
function seed(db,owner='user-1'){
 let ws=M.applyCommand(M.freshWorkspace(),{type:'enroll',programId:'msme-customer-operations'},NOW);
 ws.profile={...ws.profile,name:CANARY.name,context:'msme',reading:false,networking:false};
 ws.enrollments[0].draft={task:CANARY.practice};ws.enrollments[0].practice={x:{answer:CANARY.practice,completedAt:NOW}};ws.enrollments[0].attempts=[{id:'a',decision:{score:93,feedback:'FEEDBACK-CANARY',notes:['n']}}];
 db.rows.set(owner,{data:JSON.stringify(ws),revision:1});return ws.enrollments[0].id;
}
const signed=async(path,body,method='POST',t=Date.now(),n=crypto.randomUUID().replace(/-/g,''),signedBody=body)=>{const h=await M.signRequest(M.DEMO_SHARED_SECRET,signedBody,t,n);return new Request('http://127.0.0.1:8787'+path,{method,headers:{...(method==='POST'?{'content-type':'application/json'}:{}),...h},body:method==='POST'?body:undefined})};
const enrolBody=JSON.stringify({member_code:'DEMO-AAA001',cohort_code:'DEMO-COH-A1',pathway_id:'msme-customer-operations'});

test('route /api/partner/enrol: HMAC required, creates a pending claim only (no account, no workspace row), idempotent, replay refused',async()=>{
 const db=fakeDb();M.env.DB=db;
 let r=await M.enrolPOST(new Request('http://127.0.0.1/api/partner/enrol',{method:'POST',headers:{'content-type':'application/json'},body:enrolBody}));assert.equal(r.status,401);
 r=await M.enrolPOST(await signed('/api/partner/enrol',enrolBody,'POST',Date.now()-10*60e3));assert.equal(r.status,401);
 const req=await signed('/api/partner/enrol',enrolBody),again=req.clone();
 r=await M.enrolPOST(req);assert.equal(r.status,201);const j=await r.json();assert.equal(j.claim.status,'pending');
 assert.deepEqual([...db.rows.keys()],[M.INDEX_OWNER]); // no learner row, no account, no enrolment created
 assert.equal((await M.enrolPOST(again)).status,409); // exact replay
 r=await M.enrolPOST(await signed('/api/partner/enrol',enrolBody));assert.equal(r.status,200); // new nonce, same claim
 assert.equal(JSON.parse(db.rows.get(M.INDEX_OWNER).data).claims.length,1);
 const bad=JSON.stringify({member_code:'DEMO-AAA001',cohort_code:'DEMO-COH-A1',pathway_id:'p',email:'x@y.z'});assert.equal((await M.enrolPOST(await signed('/api/partner/enrol',bad))).status,400);
});
test('routes: learner commands require sign-in; verification enforces consent and leaks nothing ungranted',async()=>{
 const db=fakeDb();M.env.DB=db;const enrollmentId=seed(db);
 M.setIdentity(null);assert.equal((await M.linksGET()).status,401);
 M.setIdentity({userId:'user-1',email:CANARY.email,fullName:CANARY.name});
 const dummy=await startDummyPartner({});M.env.ACADEMY_DUMMY_PARTNER_URL=dummy.url;
 try{
  const post=body=>M.linksPOST(new Request('http://x.test/api/partner/links',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal((await post({type:'link',memberCode:'DEMO-ZZZ999',enrollmentId})).status,404); // unknown member in the dummy registry
  assert.equal((await post({type:'link',memberCode:'DEMO-BBB002',enrollmentId})).status,404); // suspended member
  let r=await post({type:'link',memberCode:'DEMO-AAA001',enrollmentId});assert.equal(r.status,200);let view=await r.json();const linkId=view.links[0].id;
  const verify=async(code='DEMO-AAA001',opts={})=>M.verifyGET(await signed('/api/partner/verify/'+code,'','GET',opts.t,opts.n,'verify:'+code),{params:Promise.resolve({token:code})});
  assert.equal((await verify()).status,404); // linked but nothing granted: same answer as unknown
  assert.equal((await verify('DEMO-AAA002')).status,404);
  assert.equal((await post({type:'grant',linkId,scope:'progress',days:7})).status,200);
  let v=await(await verify()).json();assert.deepEqual(v.granted_scopes,['progress']);assert.ok(v.progress&&!v.completion&&!v.credential);
  const dump=JSON.stringify(v);for(const c of Object.values(CANARY))assert.ok(!dump.includes(c));assert.ok(!dump.includes('FEEDBACK-CANARY')&&!/score/i.test(dump));
  assert.equal((await post({type:'grant',linkId,scope:'credential-status',days:7})).status,200);
  v=await(await verify()).json();assert.deepEqual(v.credential,{status:'unavailable',reason:'The credential issuer is not connected in this build.'});
  const replay=await signed('/api/partner/verify/DEMO-AAA001','','GET',Date.now(),undefined,'verify:DEMO-AAA001'),rep2=replay.clone(),ctx={params:Promise.resolve({token:'DEMO-AAA001'})};
  assert.equal((await M.verifyGET(replay,ctx)).status,200);assert.equal((await M.verifyGET(rep2,ctx)).status,409);
  // a signature made for another code cannot be reused for this one
  const other=await signed('/api/partner/verify/DEMO-AAA002','','GET',Date.now(),undefined,'verify:DEMO-AAA002');assert.equal((await M.verifyGET(new Request('http://x/api/partner/verify/DEMO-AAA001',{headers:other.headers}),ctx)).status,401);
  assert.equal((await post({type:'withdraw',linkId})).status,200);assert.equal((await verify()).status,404);
  // another learner cannot take this code or touch this link
  seed(db,'user-2');M.setIdentity({userId:'user-2',email:'b@example.com',fullName:'B'});assert.equal((await post({type:'grant',linkId,scope:'progress',days:7})).status,404);
  const e2=JSON.parse(db.rows.get('user-2').data).enrollments[0].id;assert.equal((await post({type:'link',memberCode:'DEMO-AAA001',enrollmentId:e2})).status,409);
  M.setIdentity({userId:'user-1',email:CANARY.email,fullName:CANARY.name});
  assert.equal((await post({type:'unlink',linkId})).status,200);
  M.setIdentity({userId:'user-2',email:'b@example.com',fullName:'B'});assert.equal((await post({type:'link',memberCode:'DEMO-AAA001',enrollmentId:e2})).status,200); // released
 }finally{await dummy.close();delete M.env.ACADEMY_DUMMY_PARTNER_URL}
});
test('delivery route: explicit button path; unset URL refused; consent required; real signed callback to the dummy; idempotent; withdrawal stops it; payload carries no private text',async()=>{
 const db=fakeDb();M.env.DB=db;const enrollmentId=seed(db);M.setIdentity({userId:'user-1',email:CANARY.email,fullName:CANARY.name});
 const post=(url,body)=>(url.endsWith('deliver')?M.deliverPOST:M.linksPOST)(new Request('http://x.test/api/partner/'+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 const dummy=await startDummyPartner({});M.env.ACADEMY_DUMMY_PARTNER_URL=dummy.url;
 try{
  await post('links',{type:'link',memberCode:'DEMO-AAA001',enrollmentId});const linkId=JSON.parse(db.rows.get('user-1').data).partnerDummy.links[0].id;
  assert.equal((await post('deliver',{linkId})).status,409); // no consent: nothing sent
  assert.equal(dummy.receipts.length,0);
  await post('links',{type:'grant',linkId,scope:'progress',days:7});await post('links',{type:'grant',linkId,scope:'completion',days:7});
  let r=await post('deliver',{linkId}),j=await r.json();assert.equal(r.status,200);assert.equal(j.result.status,'delivered');assert.equal(dummy.receipts.length,1);
  const got=dummy.receipts[0].payload,dump=JSON.stringify(dummy.receipts);assert.deepEqual(got.scopes,['progress','completion']);
  for(const c of [...Object.values(CANARY),'FEEDBACK-CANARY','93'])assert.ok(!dump.includes(c),c);
  j=await(await post('deliver',{linkId})).json();assert.equal(j.result.status,'already-delivered');assert.equal(dummy.receipts.length,1); // idempotent
  assert.equal(JSON.parse(db.rows.get('user-1').data).partnerDummy.deliveries.length,1);
  await post('links',{type:'withdraw',linkId});await post('links',{type:'grant',linkId,scope:'credential-status',days:7});
  j=await(await post('deliver',{linkId})).json();assert.deepEqual(dummy.receipts.at(-1).scopes,['credential-status']); // withdrawn scopes are not sent again
  assert.ok(!('progress' in dummy.receipts.at(-1).payload)&&!('completion' in dummy.receipts.at(-1).payload));
  await post('links',{type:'withdraw',linkId});const before=dummy.receipts.length;r=await post('deliver',{linkId});assert.equal(r.status,409);assert.equal(dummy.receipts.length,before);
  assert.equal((await post('deliver',{linkId,payload:{name:'x'}})).status,400); // no caller-supplied payload
  // audit trail exists and holds no payload
  assert.ok(db.audit.length>3);assert.ok(!JSON.stringify(db.audit).includes('CANARY'));
 }finally{await dummy.close()}
 delete M.env.ACADEMY_DUMMY_PARTNER_URL;
 await post('links',{type:'grant',linkId:JSON.parse(db.rows.get('user-1').data).partnerDummy.links[0].id,scope:'progress',days:7});
 const r=await post('deliver',{linkId:JSON.parse(db.rows.get('user-1').data).partnerDummy.links[0].id});assert.equal(r.status,503);assert.match((await r.json()).error,/not running/i);
 M.env.ACADEMY_DUMMY_PARTNER_URL='http://example.com:8791';let called=false;
 const res=await M.deliverProgress(db,'user-1',JSON.parse(db.rows.get('user-1').data).partnerDummy.links[0].id,NOW,{partnerUrl:'http://example.com',fetchImpl:()=>{called=true;throw new Error('network')}}).catch(e=>e);
 assert.equal(res.status,400);assert.equal(called,false);delete M.env.ACADEMY_DUMMY_PARTNER_URL;
});
test('unreachable partner: failure is recorded with backoff and a retry before it is due does not resend',async()=>{
 const db=fakeDb();M.env.DB=db;const enrollmentId=seed(db);M.setIdentity({userId:'user-1',email:'e',fullName:'n'});
 const dummy=await startDummyPartner({});M.env.ACADEMY_DUMMY_PARTNER_URL=dummy.url;
 const post=(url,body)=>(url==='deliver'?M.deliverPOST:M.linksPOST)(new Request('http://x.test/api/partner/'+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 await post('links',{type:'link',memberCode:'DEMO-AAA001',enrollmentId});const linkId=JSON.parse(db.rows.get('user-1').data).partnerDummy.links[0].id;await post('links',{type:'grant',linkId,scope:'progress',days:7});
 await dummy.close();
 const now=new Date().toISOString();let calls=0;const down=()=>{calls++;return Promise.reject(new Error('refused'))};
 let res=await M.deliverProgress(db,'user-1',linkId,now,{partnerUrl:dummy.url,fetchImpl:down});assert.equal(res.status,'unreachable');
 res=await M.deliverProgress(db,'user-1',linkId,now,{partnerUrl:dummy.url,fetchImpl:down});assert.equal(res.status,'wait');assert.equal(calls,1);
 const d=JSON.parse(db.rows.get('user-1').data).partnerDummy.deliveries[0];assert.equal(d.status,'failed');assert.equal(d.attempts.length,1);assert.ok(d.nextAttemptAt);
 delete M.env.ACADEMY_DUMMY_PARTNER_URL;
});

/* ---------- dummy partner server ---------- */
test('dummy partner refuses to bind to non-loopback addresses',async()=>{
 for(const host of ['0.0.0.0','192.168.1.5','example.com','::','localhost'])await assert.rejects(()=>startDummyPartner({host}),/loopback/,host);
});
test('integration: signed round trip against the dummy server on an ephemeral loopback port',async()=>{
 const dummy=await startDummyPartner({port:0});assert.match(dummy.url,/^http:\/\/127\.0\.0\.1:\d+$/);
 try{
  // identity link lookup
  let r=await fetch(dummy.url+'/registry/member/DEMO-AAA001');assert.equal(r.status,200);assert.equal((await r.json()).cohort_code,'DEMO-COH-A1');
  assert.equal((await fetch(dummy.url+'/registry/member/DEMO-NOPE99')).status,404);
  // build a real payload with the pure module and post it signed
  const s=grant(grant(linked(),'progress'),'completion'),p=M.buildPayload(L(s),{...facts,name:'Leaky Name',email:'leak@example.com'},new Date().toISOString(),'evt-rt-1'),body=JSON.stringify(p);
  const send=async(b,over={})=>{const h=await M.signRequest(M.DEMO_SHARED_SECRET,over.signed??b,over.t??Date.now(),over.n??crypto.randomUUID().replace(/-/g,''));return fetch(dummy.url+'/callbacks/progress',{method:'POST',headers:{'content-type':'application/json',...h,...(over.h??{})},body:b})};
  r=await send(body);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,false);
  r=await send(body);const dup=await r.json();assert.equal(r.status,200);assert.equal(dup.duplicate,true); // same event id, new nonce: idempotent
  const fixed=crypto.randomUUID().replace(/-/g,'');assert.equal((await send(JSON.stringify({...p,event_id:'evt-rt-2'}),{n:fixed})).status,200);
  assert.equal((await send(JSON.stringify({...p,event_id:'evt-rt-3'}),{n:fixed})).status,409); // nonce replay
  assert.equal((await send(JSON.stringify({...p,event_id:'evt-rt-4'}),{signed:body})).status,401); // tampered body
  assert.equal((await send(body,{t:Date.now()-10*60e3})).status,401); // stale
  assert.equal((await send(body,{h:{'x-demo-signature':'0'.repeat(64)}})).status,401);
  assert.equal((await send(JSON.stringify({...p,event_id:'evt-rt-5',email:'leak@example.com'}))).status,400); // partner refuses extra fields
  assert.equal((await send(JSON.stringify({...p,event_id:'evt-rt-6',progress:{...p.progress,score:90}}))).status,400);
  const receipts=(await(await fetch(dummy.url+'/receipts')).json()).receipts;assert.equal(receipts.length,2);
  assert.ok(!JSON.stringify(receipts).includes('Leaky')&&!JSON.stringify(receipts).includes('leak@'));
  assert.equal(receipts[0].payload.member_code,'DEMO-AAA001');
  // verify the dummy's own callback matches the app's verifier (independent implementations agree)
  assert.equal(MEMBERS.length,4);
 }finally{await dummy.close()}
});
test('integration: dummy /inbound/enrol signs and the app route records a pending claim only',async()=>{
 const db=fakeDb();M.env.DB=db;
 const academy=await new Promise(res=>{const http=require_http();const srv=http.createServer(async(q,s)=>{const chunks=[];for await(const c of q)chunks.push(c);const body=Buffer.concat(chunks).toString();const req=new Request('http://127.0.0.1'+q.url,{method:q.method,headers:q.headers,body:q.method==='POST'?body:undefined});const out=await M.enrolPOST(req);s.writeHead(out.status,{'content-type':'application/json'});s.end(await out.text())});srv.listen(0,'127.0.0.1',()=>res(srv))});
 const dummy=await startDummyPartner({academyUrl:'http://127.0.0.1:'+academy.address().port});
 try{
  const r=await fetch(dummy.url+'/inbound/enrol',{method:'POST',body:JSON.stringify({member_code:'DEMO-AAA002',pathway_id:'msme-customer-operations'})});
  assert.equal(r.status,201);const j=await r.json();assert.equal(j.academy.claim.status,'pending');
  assert.deepEqual([...db.rows.keys()],[M.INDEX_OWNER]);assert.equal(JSON.parse(db.rows.get(M.INDEX_OWNER).data).claims[0].memberCode,'DEMO-AAA002');
 }finally{await dummy.close();await new Promise(r=>academy.close(r))}
});
import http from 'node:http';
function require_http(){return http}
