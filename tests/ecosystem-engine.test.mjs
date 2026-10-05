import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const app=resolve(process.env.ACADEMY_APP_PATH??'.'),{freshWorkspace,applyCommand,RuleError,programs}=await import(pathToFileURL(resolve(app,'.sites-runtime/engine.mjs'))),now='2026-10-05T10:00:00.000Z';
const apply=(s,c)=>applyCommand(s,c,now),reject=(f,status)=>assert.throws(f,e=>e instanceof RuleError&&e.status===status);
const mappings=[['agri',programs[0].id],['msme',programs[1].id],['public',programs[2].id]];
function fixture(){let s=freshWorkspace();for(const p of programs)s=apply(s,{type:'enroll',programId:p.id});for(const [partner] of mappings)s=apply(s,{type:'connection',partner,enabled:true});return s;}
function grant(s,partner='msme',scopes=['learning.progress','practice.record']){return apply(s,{type:'ecosystem-grant',partner,enrollmentId:s.enrollments.find(e=>e.programId===mappings.find(m=>m[0]===partner)?.[1])?.id,scopes,durationDays:7});}
const run=s=>apply(s,{type:'ecosystem-test',grantId:s.ecosystemGrants[0].id});
test('legacy delivery is always refused while Boolean preferences never create scoped authority',()=>{
 const s=fixture(),before=structuredClone(s);for(const [partner,pid] of mappings)for(const e of s.enrollments)reject(()=>apply(s,{type:'deliver',partner,enrollmentId:e.id}),409);reject(()=>apply(s,{type:'deliver',partner:'health',enrollmentId:s.enrollments[1].id}),409);
 for(const key of ['payload','actor','scopes','grantId','url'])reject(()=>apply(s,{type:'deliver',partner:'msme',enrollmentId:s.enrollments[1].id,[key]:'unsupported'}),400);assert.deepEqual(s,before);assert.deepEqual(s.ecosystemGrants??[],[]);assert.deepEqual(s.ecosystemReceipts??[],[]);
});
test('Health and every cross-partner mapping remain rejected by explicit scoped choices',()=>{
 const s=fixture();reject(()=>apply(s,{type:'connection',partner:'health',enabled:true}),409);reject(()=>apply(s,{type:'ecosystem-grant',partner:'health',enrollmentId:s.enrollments[1].id,scopes:['learning.progress'],durationDays:7}),409);
 for(const [partner,pid] of mappings)for(const e of s.enrollments)if(e.programId!==pid)reject(()=>apply(s,{type:'ecosystem-grant',partner,enrollmentId:e.id,scopes:['learning.progress'],durationDays:7}),409);
 for(const partner of ['toString','__proto__'])reject(()=>apply(s,{type:'ecosystem-grant',partner,enrollmentId:s.enrollments[1].id,scopes:['learning.progress'],durationDays:7}),404);
});
test('historical invalid Health and mismatched legacy previews remain separate and are never migrated',()=>{
 const s=fixture(),eid=s.enrollments[1].id;s.connections.health=true;s.deliveries=[{id:'old-health-receipt',partner:'health',enrollmentId:eid,status:'simulated',payload:{learner_ref:eid,pathway:programs[1].id,completedLessons:0,recordStatus:'not-issued'},note:'Local integration test. No external system contacted.'},{id:'old-mismatch-receipt',partner:'agri',enrollmentId:eid,status:'simulated',payload:{pathway:programs[1].id}}];const history=structuredClone(s.deliveries),after=apply(s,{type:'connection',partner:'health',enabled:false});assert.deepEqual(after.deliveries,history);assert.equal(after.connections.health,false);reject(()=>apply(after,{type:'deliver',partner:'agri',enrollmentId:eid}),409);assert.deepEqual(s.deliveries,history);assert.deepEqual(after.ecosystemGrants??[],[]);
 const scoped=run(grant(after));assert.deepEqual(scoped.deliveries,history);assert.equal(scoped.ecosystemReceipts.length,1);assert.equal(scoped.ecosystemReceipts[0].payload.mode,'local-test');assert.ok(!JSON.stringify(scoped.ecosystemReceipts).includes('old-health-receipt'));
});
test('new scoped receipt preserves the previous snapshot and reads current suspended practice status',()=>{
 let s=fixture();s.enrollments[1].record={status:'active',id:'private-record'};s.enrollments[1].draft={task:'PRIVATE-RETURN-EVIDENCE-CANARY'};s=run(grant(s));const old=structuredClone(s.ecosystemReceipts[0]);assert.equal(old.payload.practice_record.status,'active');s.enrollments[1].record.status='suspended';s=run(s);assert.equal(s.ecosystemReceipts[0].payload.practice_record.status,'suspended');assert.deepEqual(s.ecosystemReceipts[1],old);assert.equal(s.ecosystemReceipts[0].status,'simulated');assert.equal(s.ecosystemReceipts[0].payload.practice_record.claim_type,'nonaccredited-practice');assert.ok(!JSON.stringify(s.ecosystemReceipts).includes('PRIVATE-RETURN-EVIDENCE-CANARY'));for(const key of ['fields','scores','notes','email','name','recordId'])assert.ok(!Object.hasOwn(s.ecosystemReceipts[0].payload,key));assert.deepEqual(s.deliveries,[]);
});
test('explicit receipt fields, exact pin and own-choice withdrawal stay independent from legacy preferences',()=>{
 let s=grant(fixture(),'msme',['learning.progress']);s=run(s);assert.ok(s.ecosystemReceipts[0].payload.learning);assert.ok(!Object.hasOwn(s.ecosystemReceipts[0].payload,'practice_record'));const pin=structuredClone(s.enrollments[1].contentRef),g=s.ecosystemGrants[0];assert.deepEqual(g.contentRef,pin);assert.equal(g.contentVersion,s.enrollments[1].version);const history=structuredClone(s.ecosystemReceipts);
 s=apply(s,{type:'connection',partner:'msme',enabled:false});assert.equal(s.ecosystemGrants[0].revokedAt,null);s=run(s);assert.deepEqual(s.ecosystemReceipts[1],history[0]);s=apply(s,{type:'ecosystem-withdraw',grantId:g.id});reject(()=>run(s),403);assert.equal(s.ecosystemReceipts.length,2);
 const foreign=fixture();reject(()=>apply(foreign,{type:'ecosystem-test',grantId:g.id}),404);reject(()=>apply(foreign,{type:'ecosystem-withdraw',grantId:g.id}),404);
});
