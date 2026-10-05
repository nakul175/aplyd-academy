import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {base,headers,identity} from './local-qa.mjs';
const owner=identity('snapshot-owner'),other=identity('snapshot-other'),results=[];
async function read(u,route){const response=await fetch(base+route,{headers:u?headers(u):{}}),body=await response.json();return {response,body};}
let passed=false;
try{
 let x=await read(undefined,'/api/academy/export');assert.equal(x.response.status,401);assert.equal(Object.hasOwn(x.body,'snapshotJson'),false);results.push('Unauthenticated export has no private contents');
 x=await read(owner,'/api/academy');const first=x.body;
 const saved=await fetch(base+'/api/academy',{method:'POST',headers:headers(owner),body:JSON.stringify({revision:first.revision,actionId:crypto.randomUUID(),command:{type:'profile',name:'Synthetic private snapshot learner',context:'msme',reading:true,networking:false}})});assert.equal(saved.status,200);const after=await saved.json();
 x=await read(owner,'/api/academy/export');assert.equal(x.response.status,200);assert.equal(x.body.subjectId,owner.id);assert.equal(x.body.sourceRevision,after.revision);assert.equal(x.body.saved,true);assert.equal(x.body.snapshotSha256,createHash('sha256').update(x.body.snapshotJson).digest('hex'));assert.deepEqual(JSON.parse(x.body.snapshotJson),after.state);assert.equal(x.response.headers.get('cache-control'),'no-store');assert.equal(x.response.headers.get('x-content-type-options'),'nosniff');assert.match(x.response.headers.get('content-disposition'),/attachment/);results.push('Fresh export matches actual stored owner state/revision and exact checksum');
 const canonical=await read(owner,'/api/academy');assert.equal(canonical.body.revision,after.revision);assert.deepEqual(canonical.body.state,after.state);results.push('Export leaves saved data and revision unchanged');
 x=await read(other,'/api/academy/export?owner='+encodeURIComponent(owner.id));assert.equal(x.body.subjectId,other.id);assert.equal(x.body.saved,false);assert.equal(x.body.sourceRevision,0);assert.equal(x.body.sourceUpdatedAt,null);assert.doesNotMatch(x.body.snapshotJson,/Synthetic private snapshot learner/);results.push('Query owner cannot select another account; absent row stays explicitly unsaved');
 const output=path.resolve('.sites-runtime/snapshot-api');fs.mkdirSync(output,{recursive:true});const own=await read(owner,'/api/academy/export');fs.writeFileSync(path.join(output,'synthetic-own-snapshot.json'),JSON.stringify(own.body,null,2));passed=true;
}finally{
 const output=path.resolve('.sites-runtime/snapshot-api');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed,at:new Date().toISOString(),worker:base,scope:'Actual local Worker API with synthetic trusted-header fixtures only; no production identity or restore proof.',checks:results,sources:Object.fromEntries(['app/api/academy/export/route.ts','lib/academy-snapshot.ts'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2));console.log(JSON.stringify({passed,checks:results.length}));
}
