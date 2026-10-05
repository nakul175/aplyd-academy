/** In-memory tests only. Run after the root clears its active native QA freeze. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=process.env.ACADEMY_QA_APP??resolve(here,'../..');
const modulePath=process.env.ACADEMY_PARTNER_REVIEW_MODULE??resolve(app,'lib/academy-partner-review-pack.mjs');
const {buildPartnerReviewPack}=await import(pathToFileURL(modulePath).href);
const runtime=process.env.ACADEMY_PARTNER_DOMAIN_RUNTIME??resolve(app,'.sites-runtime/scoped-workbench-qa/runtime/domain.mjs');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(dirname(runtime),'source.json'),'utf8'));
const sourceHashes=Object.fromEntries(manifest.sources.map(x=>[x.source,hash(resolve(app,x.source))]));
for(const s of manifest.sources)assert.equal(sourceHashes[s.source],s.sha256,`Existing domain bundle is stale: ${s.source}. Do not collect evidence until the root refreshes its runtime.`);
const snapshot=JSON.parse(readFileSync(resolve(here,'source-snapshot.json'),'utf8'));
assert.equal(hash(resolve(app,'lib/curriculum-versions/0.1-review-draft.json')),snapshot.curriculumSha256);
assert.equal(hash(resolve(app,'lib/academy-ecosystems.ts')),snapshot.ecosystemSourceSha256);
const curriculum=JSON.parse(readFileSync(resolve(app,'lib/curriculum-versions/0.1-review-draft.json'),'utf8'));
const domain=await import(pathToFileURL(runtime).href);
const {ADAPTERS,RETURN_CONTRACT,TEST_PURPOSE,RETURN_SCOPES,SCOPED_LIMITS,validateReturnPayload,readTestReceipts,readTestGrants,createTestGrant,buildReturnReceipt,grantStatus,revokeTestGrant,freshWorkspace,applyCommand}=domain;
const now='2030-01-01T12:00:00.000Z',later='2030-01-01T13:00:00.000Z';
const cases=[],failures=[];
function run(name,fn){try{fn();cases.push(name);}catch(e){failures.push({name,error:String(e)});}}
const command=(s,c,time=now)=>applyCommand(s,c,time);
function fixture(partner='msme',scopes=['learning.progress','practice.record'],durationDays=1) {
  const p=buildPartnerReviewPack(partner);let s=command(freshWorkspace(),{type:'enroll',programId:p.partner.pathwayId});
  return command(s,{type:'ecosystem-grant',partner,enrollmentId:s.enrollments[0].id,scopes,durationDays});
}
function receipt(partner='msme',scopes=['learning.progress','practice.record']) {
  const s=fixture(partner,scopes);return command(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});
}
function rejectedWithoutChange(s,c,time=now){const before=structuredClone(s);assert.throws(()=>command(s,c,time));assert.deepEqual(s,before);}
run('Every packet matches the actual current adapter, local constants and scope limits',()=>{
  for(const partner of ['agri','msme','public']) {
    const p=buildPartnerReviewPack(partner),a=ADAPTERS.find(x=>x.id===partner);assert.equal(a.status,'test-only');
    assert.equal(p.partner.pathwayId,a.pathwayId);assert.equal(p.partner.name,a.name);assert.equal(p.partner.task,a.task);
    assert.equal(p.localContract.version,RETURN_CONTRACT);assert.equal(p.localContract.purpose,TEST_PURPOSE);
    assert.deepEqual(p.localContract.scopeGroups.map(x=>x.id),[...RETURN_SCOPES]);assert.equal(p.localContract.retainedChoiceLimit,SCOPED_LIMITS.grants);assert.equal(p.localContract.retainedReceiptLimit,SCOPED_LIMITS.receipts);
  }
});
for(const partner of ['agri','msme','public']) {
  run(`${partner}: actual local payload contains exactly the described fields for each scope selection`,()=>{
    for(const scopes of [['learning.progress'],['practice.record'],['learning.progress','practice.record']]){
      const s=receipt(partner,scopes),payload=s.ecosystemReceipts[0].payload,c=buildPartnerReviewPack(partner).localContract;
      validateReturnPayload(payload);const paths=[];
      for(const [key,value] of Object.entries(payload))if(['learning','practice_record'].includes(key))paths.push(...Object.keys(value).map(x=>`${key}.${x}`));else paths.push(key);
      assert.deepEqual(paths,c.fields.filter(f=>f.requiredWhen==='always'||scopes.includes(f.requiredWhen)).map(x=>x.name));
      assert.equal(payload.pathway_id,buildPartnerReviewPack(partner).partner.pathwayId);assert.equal(payload.mode,'local-test');assert.equal(payload.content_version,snapshot.contentVersion);
      assert.equal(s.ecosystemReceipts[0].status,'simulated');assert.equal(s.ecosystemReceipts[0].note,'Validated locally. No partner was contacted and no data was sent.');
    }
  });
  run(`${partner}: exact expiry rejects a new local test while retaining old receipts`,()=>{
    const s=receipt(partner),g=s.ecosystemGrants[0];assert.equal(grantStatus(g,'2030-01-02T11:59:59.999Z'),'active');
    assert.equal(grantStatus(g,g.expiresAt),'expired');rejectedWithoutChange(s,{type:'ecosystem-test',grantId:g.id},g.expiresAt);
    assert.equal(readTestReceipts(s.ecosystemReceipts,readTestGrants(s.ecosystemGrants),g.expiresAt).length,1);
  });
  run(`${partner}: withdrawal stops new tests and preserves the old snapshot`,()=>{
    const s=receipt(partner),old=structuredClone(s.ecosystemReceipts),g=s.ecosystemGrants[0];
    const stopped=command(s,{type:'ecosystem-withdraw',grantId:g.id},later);assert.equal(grantStatus(stopped.ecosystemGrants[0],later),'withdrawn');
    assert.deepEqual(stopped.ecosystemReceipts,old);assert.equal(readTestReceipts(old,stopped.ecosystemGrants,later).length,1);
    rejectedWithoutChange(stopped,{type:'ecosystem-test',grantId:g.id},later);
  });
}
run('Unsupported top-level and nested payload fields are rejected',()=>{
  const p=receipt().ecosystemReceipts[0].payload;
  for(const field of ['name','email','task','score','assessorNotes','recipient','signature']){
    const x=structuredClone(p);x[field]='FICTIONAL-UNSUPPORTED';assert.throws(()=>validateReturnPayload(x));
  }
  for(const group of ['learning','practice_record']){const x=structuredClone(p);x[group].privateEvidence='FICTIONAL-UNSUPPORTED';assert.throws(()=>validateReturnPayload(x));}
});
run('Missing metadata or selected summary, extra summary, unsupported or repeated scopes reject',()=>{
  const p=receipt().ecosystemReceipts[0].payload;
  for(const name of Object.keys(p)){const x=structuredClone(p);delete x[name];assert.throws(()=>validateReturnPayload(x),name);}
  for(const scopes of [[],['unsupported'],['learning.progress','learning.progress'],['practice.record']]){const x=structuredClone(p);x.scopes=scopes;assert.throws(()=>validateReturnPayload(x));}
});
run('Identifiers, times, versions, mapping and fixed contract values have no permissive fallback',()=>{
  const p=receipt().ecosystemReceipts[0].payload;
  const mutations=[['event_id','value with spaces'],['enrollment_ref','x'.repeat(101)],['occurred_at','2030-01-01T12:00:00Z'],['occurred_at','2030-02-30T12:00:00.000Z'],['content_version','version/other'],['pathway_id','farmer-work-records'],['mode','live'],['contract_version','aplyd.learning-return/2'],['purpose','marketing'],['partner','health']];
  for(const [key,value] of mutations){const x=structuredClone(p);x[key]=value;assert.throws(()=>validateReturnPayload(x),key);}
});
run('Progress bounds and completed versus in-progress semantics are exact',()=>{
  const p=receipt().ecosystemReceipts[0].payload;
  for(const learning of [{completed_lessons:-1,total_lessons:3,status:'in-progress'},{completed_lessons:1.5,total_lessons:3,status:'in-progress'},{completed_lessons:4,total_lessons:3,status:'completed'},{completed_lessons:0,total_lessons:0,status:'completed'},{completed_lessons:0,total_lessons:101,status:'in-progress'},{completed_lessons:3,total_lessons:3,status:'in-progress'},{completed_lessons:0,total_lessons:3,status:'completed'}])assert.throws(()=>validateReturnPayload({...structuredClone(p),learning}));
});
run('Non-accredited status and sample-workflow combinations neither imply issuer authority nor widen',()=>{
  const p=receipt().ecosystemReceipts[0].payload;
  for(const status of ['not-issued','active','suspended'])validateReturnPayload({...structuredClone(p),practice_record:{status,claim_type:'nonaccredited-practice',review_mode:status==='not-issued'?'not-reviewed':'sample-workflow'}});
  for(const record of [{status:'active',claim_type:'accredited',review_mode:'sample-workflow'},{status:'issued',claim_type:'nonaccredited-practice',review_mode:'sample-workflow'},{status:'active',claim_type:'nonaccredited-practice',review_mode:'not-reviewed'},{status:'not-issued',claim_type:'nonaccredited-practice',review_mode:'sample-workflow'}])assert.throws(()=>validateReturnPayload({...structuredClone(p),practice_record:record}));
});
run('Only exact 1, 7 and 30 day choices are accepted, with canonical duration',()=>{
  for(const d of [1,7,30]){const s=fixture('agri',['learning.progress'],d),g=s.ecosystemGrants[0];assert.equal(Date.parse(g.expiresAt)-Date.parse(g.createdAt),d*86400000);}
  const s=fixture(),e=s.enrollments[0];for(const durationDays of [0,2,31,'1'])assert.throws(()=>createTestGrant({partner:'msme',enrollmentId:e.id,scopes:['learning.progress'],durationDays},e,now,'synthetic_choice'));
});
run('Caller-injected approval, content version and payload cannot enter a command',()=>{
  const s=fixture();for(const key of ['actorId','approved','purpose','contractVersion','contentVersion','payload'])rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id,[key]:'injected'});
});
run('Wrong partner mapping, private pin and mismatched retained version reject',()=>{
  for(const variant of ['mapping','private','version']){
    const s=fixture();if(variant==='mapping')s.enrollments[0].programId='farmer-work-records';
    if(variant==='private')s.enrollments[0].contentRef.scope='tw-private';if(variant==='version')s.enrollments[0].contentRef.versionId='unknown';
    rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});
  }
});
run('Unknown historical version does not use the currently available curriculum',()=>{
  const s=fixture();s.enrollments[0].version='unknown';s.enrollments[0].contentRef.versionId='unknown';s.ecosystemGrants[0].contentVersion='unknown';s.ecosystemGrants[0].contentRef.versionId='unknown';
  rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});
});
run('Invented or duplicate completed lesson IDs are refused by the actual command',()=>{
  const program=curriculum.pathways.find(x=>x.id==='msme-customer-operations');for(const completed of [['invented'],[program.lessons[0].id,program.lessons[0].id]]){const s=fixture();s.enrollments[0].completed=completed;rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});}
});
run('Independent withdrawal works with paused learning, unknown pin and malformed history',()=>{
  const s=receipt(),id=s.ecosystemGrants[0].id;s.paused=['msme-customer-operations'];s.enrollments[0].version='unknown';s.enrollments[0].contentRef.versionId='unknown';s.ecosystemReceipts=[{malformed:'fictional'}];
  const before=structuredClone(s.ecosystemReceipts),stopped=command(s,{type:'ecosystem-withdraw',grantId:id},later);
  assert.equal(stopped.ecosystemGrants[0].revokedAt,later);assert.deepEqual(stopped.ecosystemReceipts,before);
});
run('Repeated withdrawal retains its first timestamp and does not remove history',()=>{
  const s=receipt(),id=s.ecosystemGrants[0].id;const first=command(s,{type:'ecosystem-withdraw',grantId:id},later);
  const again=command(first,{type:'ecosystem-withdraw',grantId:id},'2030-01-01T14:00:00.000Z');
  assert.equal(again.ecosystemGrants[0].revokedAt,later);assert.deepEqual(again.ecosystemReceipts,first.ecosystemReceipts);
});
run('Replacing a choice withdraws its predecessor but preserves prior local receipts',()=>{
  const s=receipt(),old=structuredClone(s.ecosystemReceipts),oldId=s.ecosystemGrants[0].id;const replaced=command(s,{type:'ecosystem-grant',partner:'msme',enrollmentId:s.enrollments[0].id,scopes:['practice.record'],durationDays:7},later);
  assert.equal(replaced.ecosystemGrants.length,2);assert.equal(replaced.ecosystemGrants.find(g=>g.id===oldId).revokedAt,later);assert.equal(replaced.ecosystemGrants.find(g=>g.id!==oldId).revokedAt,null);assert.deepEqual(replaced.ecosystemReceipts,old);
});
run('Future receipt, receipt before its choice and receipt at expiry are rejected',()=>{
  const s=receipt(),g=s.ecosystemGrants[0],r=s.ecosystemReceipts[0];
  for(const time of [later,'2030-01-01T11:59:59.999Z',g.expiresAt]){const x=structuredClone(r);x.createdAt=time;x.payload.occurred_at=time;assert.throws(()=>readTestReceipts([x],[g],time===later?now:g.expiresAt));}
});
run('A receipt at withdrawal can remain history but a later one is rejected',()=>{
  const s=fixture(),e=s.enrollments[0],g=revokeTestGrant(s.ecosystemGrants[0],later);
  const at=buildReturnReceipt(s.ecosystemGrants[0],e,3,later,'synthetic_at');assert.equal(readTestReceipts([at],[g],later).length,1);
  const after=structuredClone(at);after.createdAt='2030-01-01T13:00:00.001Z';after.payload.occurred_at=after.createdAt;assert.throws(()=>readTestReceipts([after],[g],after.createdAt));
});
run('Retained receipt wrapper identity must agree with payload and exact retained choice',()=>{
  const s=receipt();for(const key of ['id','enrollmentId','partner','grantId','contractVersion']){const r=structuredClone(s.ecosystemReceipts[0]);r[key]='wrong';assert.throws(()=>readTestReceipts([r],s.ecosystemGrants,now),key);}
});
run('Current practice status change does not rewrite a prior local snapshot',()=>{
  const s=fixture();s.enrollments[0].record={status:'active'};const tested=command(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id}),old=structuredClone(tested.ecosystemReceipts[0]);tested.enrollments[0].record.status='suspended';
  const again=command(tested,{type:'ecosystem-test',grantId:tested.ecosystemGrants[0].id},later);assert.deepEqual(again.ecosystemReceipts.find(r=>r.id===old.id),old);assert.equal(again.ecosystemReceipts.find(r=>r.id!==old.id).payload.practice_record.status,'suspended');
});
run('Paused or withdrawn learning rejects a new test while preserving retained choices',()=>{
  for(const variant of ['paused','withdrawn']){const s=fixture();if(variant==='paused')s.paused=['msme-customer-operations'];else s.enrollments[0].withdrawn=true;rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});}
});
run('Receipt capacity rejects another test but permits independent withdrawal',()=>{
  const s=receipt(),r=s.ecosystemReceipts[0];s.ecosystemReceipts=Array.from({length:100},(_,i)=>{const x=structuredClone(r);x.id=`synthetic_receipt_${i}`;x.payload.event_id=x.id;return x;});
  rejectedWithoutChange(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});const stopped=command(s,{type:'ecosystem-withdraw',grantId:s.ecosystemGrants[0].id},later);assert.equal(stopped.ecosystemReceipts.length,100);assert.equal(stopped.ecosystemGrants[0].revokedAt,later);
});
run('Choice capacity retains history and independent withdrawal',()=>{
  let s=fixture();for(let i=1;i<24;i++)s=command(s,{type:'ecosystem-grant',partner:'msme',enrollmentId:s.enrollments[0].id,scopes:['learning.progress'],durationDays:1});
  assert.equal(s.ecosystemGrants.length,24);rejectedWithoutChange(s,{type:'ecosystem-grant',partner:'msme',enrollmentId:s.enrollments[0].id,scopes:['learning.progress'],durationDays:1});
  const activeId=s.ecosystemGrants.find(g=>g.revokedAt===null).id;
  const stopped=command(s,{type:'ecosystem-withdraw',grantId:activeId},later);assert.equal(stopped.ecosystemGrants.length,24);assert.equal(stopped.ecosystemGrants.find(g=>g.id===activeId).revokedAt,later);
});
run('Health, unknown ecosystem and legacy delivery never enable tests or transport',()=>{
  const s=fixture();for(const partner of ['health','other','__proto__'])rejectedWithoutChange(s,{type:'ecosystem-grant',partner,enrollmentId:s.enrollments[0].id,scopes:['learning.progress'],durationDays:1});
  rejectedWithoutChange(s,{type:'deliver',partner:'msme',enrollmentId:s.enrollments[0].id});
});
const after=Object.fromEntries(manifest.sources.map(x=>[x.source,hash(resolve(app,x.source))]));
run('Actual domain source hashes remain unchanged',()=>assert.deepEqual(after,sourceHashes));
writeFileSync(resolve(here,'domain-test-evidence.json'),JSON.stringify({passed:!failures.length,groups:cases.length,cases,failures,mode:'existing-actual-checkout-domain-in-memory',modulePath,moduleSha256:hash(modulePath),runtime,sourceHashes,rootUnchanged:JSON.stringify(after)===JSON.stringify(sourceHashes),limits:['No compilation, Worker, API, browser, saved storage or outbound requests. Local state is fictional and in memory only. Does not prove a live partner contract or institutional authorization.']},null,2)+'\n');
console.log(`${cases.length} actual-domain groups passed; ${failures.length} failures.`);if(failures.length){console.error(failures);process.exitCode=1;}
