import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {out,runtimeModuleHref} from './qa-paths.mjs';
const {freshWorkspace,applyCommand,programs,ensurePersonalSizing,personalSizing,readTestReceipts,revokeTestGrant}=await import(runtimeModuleHref);
const now='2026-10-05T10:00:00.000Z',later='2026-10-05T10:01:00.000Z',cases=[];
const conflict=fn=>assert.throws(fn,error=>error.status===409);
function saved(){let state=applyCommand(freshWorkspace(),{type:'enroll',programId:programs[1].id},now);const choice={type:'ecosystem-grant',partner:'msme',enrollmentId:state.enrollments[0].id,scopes:['learning.progress'],durationDays:7};state=applyCommand(state,choice,now);state=applyCommand(state,{type:'ecosystem-test',grantId:state.ecosystemGrants[0].id},now);return {state,choice};}
function malformed(){const {state,choice}=saved();state.ecosystemReceipts[0].payload.private_evidence='MALFORMED-SAVED-RECEIPT-CANARY';return {state,choice};}
test('unsupported saved receipt rejects reader, new test and new choice without mutating saved data',()=>{
 const {state,choice}=malformed(),before=structuredClone(state);conflict(()=>readTestReceipts(state.ecosystemReceipts,state.ecosystemGrants,now));conflict(()=>applyCommand(state,{type:'ecosystem-test',grantId:state.ecosystemGrants[0].id},now));conflict(()=>applyCommand(state,choice,now));assert.deepEqual(state,before);cases.push({name:'Malformed receipt is409 without mutation',passed:true});
});
test('valid withdrawal preserves raw malformed history while replacing its22-byte reserve',()=>{
 const {state}=malformed(),before=personalSizing(state);assert.equal(before.receiptHistoryValid,false);const closed=applyCommand(state,{type:'ecosystem-withdraw',grantId:state.ecosystemGrants[0].id},later),after=ensurePersonalSizing(closed);assert.equal(after.receiptHistoryValid,false);assert.deepEqual(closed.ecosystemReceipts,state.ecosystemReceipts);assert.equal(after.actualBytes-before.actualBytes,22);assert.equal(after.reservedBytes-before.reservedBytes,-22);assert.equal(after.effectiveBytes,before.effectiveBytes);cases.push({name:'Malformed receipt does not strand valid withdrawal',passed:true});
});
test('malformed receipt still permits valid withdrawal at the exact effective1MB boundary',()=>{
 const {state}=malformed(),filled={...state,padding:''};filled.padding='x'.repeat(1000000-personalSizing(filled).effectiveBytes);assert.equal(personalSizing(filled).effectiveBytes,1000000);ensurePersonalSizing(filled);const closed=applyCommand(filled,{type:'ecosystem-withdraw',grantId:filled.ecosystemGrants[0].id},later),after=ensurePersonalSizing(closed);assert.equal(after.effectiveBytes,1000000);assert.equal(after.actualBytes,1000000);assert.equal(after.reservedBytes,0);assert.equal(after.receiptHistoryValid,false);cases.push({name:'Exact1MB malformed-history closure',passed:true});
});
test('future saved withdrawal rejects409 and legitimate past withdrawal stays idempotent',()=>{
 const {state}=saved(),future=structuredClone(state.ecosystemGrants[0]);future.revokedAt='2026-10-06T10:00:00.000Z';conflict(()=>revokeTestGrant(future,now));assert.equal(future.revokedAt,'2026-10-06T10:00:00.000Z');const past=revokeTestGrant(state.ecosystemGrants[0],later);assert.deepEqual(revokeTestGrant(past,'2026-10-05T10:02:00.000Z'),past);cases.push({name:'Future withdrawal conflict and past idempotence',passed:true});
});
after(()=>writeFileSync(new URL('scoped-workbench-correction-result.json',out),JSON.stringify({passed:cases.length===4,at:new Date().toISOString(),cases,source:JSON.parse(readFileSync(new URL('runtime/source.json',out),'utf8')),limits:['Only an isolated actual-domain bundle is used. No server request or database injection.','Exact-boundary padding exists only in memory and is not persisted.']},null,2)));
