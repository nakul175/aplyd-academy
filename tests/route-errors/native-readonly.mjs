import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {app,output} from './qa-paths.mjs';
assert.equal(process.env.ACADEMY_BODY_M3_WORKER_READY,'1','Wait for root explicit stable M3 Worker signal. No API requests before then.');
const base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787',origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));assert.equal(origin.protocol,'http:');assert.equal(origin.port,'8787');assert.equal(origin.pathname,'/');
const compiledEvidence=JSON.parse(readFileSync(output+'/source-evidence.json','utf8'));
const sourceFiles=compiledEvidence.files.map(x=>x.file);
assert.ok(sourceFiles.includes('app/api/academy/route.ts')&&sourceFiles.includes('app/api/teams/route.ts')&&sourceFiles.includes('app/api/academy/records/check/route.ts'),'Run current actual-root route compiler before native acceptance.');
assert.ok(!sourceFiles.some(x=>x.includes('academy-request-body')),'Deferred streaming module must not enter accepted baseline evidence.');
const sources=()=>sourceFiles.map(file=>({file,sha256:createHash('sha256').update(readFileSync(app+'/'+file)).digest('hex')}));
const beforeSources=sources(),cases=[];let assertions=0;
const runtimeDist=process.env.ACADEMY_BODY_RUNTIME_DIST;
const runtimeEvidence=runtimeDist?['server/index.js','server/wrangler.json'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(resolve(runtimeDist,file))).digest('hex')})):null;
const eq=(a,b,message)=>{assertions++;assert.deepEqual(a,b,message);};const ok=(a,message)=>{assertions++;assert.ok(a,message);};
const post=(name,path,body,status,headers={})=>cases.push({name,path,method:'POST',body,status,headers:{'Content-Type':'application/json',...headers}});
for(const path of ['/api/academy','/api/teams']){
 cases.push({name:path+' unauthenticated GET',path,method:'GET',status:401,headers:{}});
 post(path+' media',path,'not JSON',415,{'Content-Type':'text/plain'});
 post(path+' invalid JSON',path,'{"syntheticBroken":',400);
 post(path+' empty body',path,'',400);
 post(path+' exact100000 units',path,' '.repeat(100000),400);
 post(path+' 100001 units',path,' '.repeat(100001),413);
 post(path+' exact100000 multibyte units',path,'"'+'界'.repeat(99998)+'"',400);
 post(path+' exact100000 emoji units',path,'"'+'😀'.repeat(49999)+'"',400);
 post(path+' leading BOM plus exact boundary',path,'\ufeff'+' '.repeat(100000),400);
 post(path+' raw400001 bytes',path,new Uint8Array(400001).fill(0xff),413);
 post(path+' safe empty object',path,'{}',path==='/api/academy'?401:400);
}
const record='/api/academy/records/check';
for(const [name,body,status] of [['invalid JSON','{',400],['exact2000 units',' '.repeat(2000),400],['2001 units',' '.repeat(2001),413],['exact4000 decoded bytes','"'+'界'.repeat(1332)+'aa"',400],['4001 decoded bytes','"'+'界'.repeat(1333)+'"',413],['leading BOM exact4000 decoded bytes','\ufeff"'+'界'.repeat(1332)+'aa"',400],['raw8001 bytes',new Uint8Array(8001).fill(0xff),413],['safe malformed record shape','{}',400],['read-only record authentication',{workspaceId:null,sourceRevision:0,recordId:'nonexistent-synthetic-readonly-record'},401]])post('record '+name,record,typeof body==='object'&&!(body instanceof Uint8Array)?JSON.stringify(body):body,status);
post('record media',record,'not JSON',415,{'Content-Type':'text/plain'});
// This assertion is deliberately stricter than the route: every mutating path
// has neither a command nor an actionId. No test can reach a valid mutation.
for(const c of cases){assert.ok(Object.keys(c.headers).every(k=>['Content-Type','Origin'].includes(k)));if(c.method==='POST'&&c.path!==record){let value;try{value=JSON.parse(typeof c.body==='string'?c.body:new TextDecoder().decode(c.body));}catch{}assert.ok(!value||typeof value!=='object'||(!Object.hasOwn(value,'command')&&!Object.hasOwn(value,'actionId')),'No mutating command or action reference is permitted.');}}
function optionalSnapshot(){if(!process.env.ACADEMY_BODY_READONLY_DB)return null;const here=dirname(fileURLToPath(import.meta.url));return JSON.parse(execFileSync(process.env.ACADEMY_PYTHON??'python3',[here+'/snapshot-fictional.py',resolve(process.env.ACADEMY_BODY_READONLY_DB)],{encoding:'utf8'}));}
const before=optionalSnapshot(),results=[];let activeCase=null,responseDiagnostic=null;
try{
 for(const c of cases){activeCase={name:c.name,path:c.path,method:c.method,expectedStatus:c.status};responseDiagnostic=null;const response=await fetch(base+c.path,{method:c.method,headers:c.headers,...(c.method==='POST'?{body:c.body}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});const text=await response.text();responseDiagnostic={status:response.status,contentType:response.headers.get('content-type'),bodyBytes:new TextEncoder().encode(text).length,bodySha256:createHash('sha256').update(text).digest('hex')};let value;try{value=JSON.parse(text);}catch{assert.fail(c.name+' did not return JSON (HTTP '+response.status+')');}eq(response.status,c.status,c.name);eq(Object.keys(value),['error']);ok(typeof value.error==='string'&&value.error.length>0);eq(response.headers.get('cache-control'),'no-store');eq(response.headers.get('x-content-type-options'),'nosniff');ok(!text.includes('PRIVATE_'));results.push({name:c.name,path:c.path,method:c.method,status:response.status,passed:true});}
 const after=optionalSnapshot();if(before!==null)eq(after,before,'Existing fictional row counts/content hashes must not change.');eq(sources(),beforeSources,'Root source frozen during endpoint acceptance.');
 writeFileSync(output+'/native-readonly-evidence.json',JSON.stringify({at:new Date().toISOString(),passed:true,cases:results.length,assertions,results,sources:beforeSources,runtimeEvidence,readerProvenance:'Native Request.text plus existing post-read size limits; streaming helper deferred outside product.',existingFictionalRows:{before,after},limitations:['Only authless GET and incapable malformed/oversized POSTs on explicit loopback8787. No auth headers, actionId, command, fixture creation or valid write. Request.text fault/log sanitization is covered separately by actual-root mocked-host tests; native connection faults not claimed. Optional SQLite inspection is mode=ro over existing qa-* rows only. No hosted/provider requests. Frozen entry/config hashes identify supplied runtime, not every imported chunk. Actual source list derives from current baseline esbuild imports and excludes deferred helper.']},null,2));
 console.log(`Native read-only endpoints: ${results.length} cases / ${assertions} assertions passed.`);
}catch(error){writeFileSync(output+'/native-readonly-failure.json',JSON.stringify({at:new Date().toISOString(),passed:false,completed:results,activeCase,responseDiagnostic,existingFictionalRows:{before,after:optionalSnapshot()},sources:beforeSources,runtimeEvidence,error:error.message,limitations:['No valid mutation command or fixture creation attempted. Raw non-JSON body not recorded; status/size/hash only.']},null,2));throw error;}
