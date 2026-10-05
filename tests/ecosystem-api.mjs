import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const app=resolve(process.env.ACADEMY_APP_PATH??'.'),base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787';assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Only a local synthetic test server is allowed.');
const curriculum=JSON.parse(readFileSync(resolve(app,'lib/curriculum.json'),'utf8')),nonce=crypto.randomUUID(),owner={id:'guard-owner-'+nonce,email:'guard-owner-'+nonce+'@academy.test'},other={id:'guard-other-'+nonce,email:'guard-other-'+nonce+'@academy.test'};let checks=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++},ok=x=>{assert.ok(x);checks++};
const headers=u=>({'Content-Type':'application/json','oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email});
async function get(u){const r=await fetch(base+'/api/academy',{headers:headers(u)});return {status:r.status,...await r.json()}}
async function post(u,command,revision,actionId=crypto.randomUUID()){const r=await fetch(base+'/api/academy',{method:'POST',headers:headers(u),body:JSON.stringify({command,revision,actionId})});return {status:r.status,...await r.json()}}
async function action(u,command){const x=await get(u);eq(x.status,200);return post(u,command,x.revision)}
const mappings=[['agri','farmer-work-records'],['msme','msme-customer-operations'],['public','public-servant-source-briefs']],ids={};
let x=await get(owner);eq(x.status,200);eq(x.state.deliveries,[]);
for(const [partner,pid] of mappings){x=await action(owner,{type:'enroll',programId:pid});eq(x.status,200);ids[partner]=x.state.enrollments.find(e=>e.programId===pid).id;x=await action(owner,{type:'connection',partner,enabled:true});eq(x.status,200)}
x=await action(owner,{type:'draft',enrollmentId:ids.msme,fields:{task:'PRIVATE-GUARD-DRAFT-CANARY: permitted fictional evidence belongs only to its owner.'}});eq(x.status,200);
for(const [partner] of mappings){x=await action(owner,{type:'deliver',partner,enrollmentId:ids[partner]});eq(x.status,200);eq(x.state.deliveries[0].status,'simulated');ok(!JSON.stringify(x.state.deliveries[0]).includes('PRIVATE-GUARD-DRAFT-CANARY'))}
const saved=structuredClone(x.state.deliveries),rev=x.revision;
eq((await post(owner,{type:'connection',partner:'health',enabled:true},rev)).status,409);eq((await post(owner,{type:'deliver',partner:'health',enrollmentId:ids.msme},rev)).status,409);
for(const [from] of mappings)for(const [to] of mappings)if(from!==to)eq((await post(owner,{type:'deliver',partner:to,enrollmentId:ids[from]},rev)).status,409);
for(const key of ['payload','actor','scopes','grantId','url'])eq((await post(owner,{type:'deliver',partner:'msme',enrollmentId:ids.msme,[key]:'INJECTED-PRIVATE-CANARY'},rev)).status,400);
eq((await get(owner)).state.deliveries,saved);eq((await get(owner)).revision,rev);ok(!('ecosystemGrants' in (await get(owner)).state));
let stranger=await get(other);eq(stranger.state.enrollments.length,0);eq(stranger.state.deliveries.length,0);stranger=await action(other,{type:'connection',partner:'msme',enabled:true});eq(stranger.status,200);eq((await post(other,{type:'deliver',partner:'msme',enrollmentId:ids.msme},stranger.revision)).status,404);eq((await get(other)).state.deliveries.length,0);
// A preview versus preference withdrawal contends on the existing owner CAS.
const race=await Promise.all([post(owner,{type:'connection',partner:'msme',enabled:false},rev),post(owner,{type:'deliver',partner:'msme',enrollmentId:ids.msme},rev)]);eq(race.map(r=>r.status).sort(),[200,409]);x=await get(owner);eq(x.revision,rev+1);eq(x.state.deliveries.length,saved.length+(race[1].status===200?1:0));
if(x.state.connections.msme===true){x=await action(owner,{type:'connection',partner:'msme',enabled:false});eq(x.status,200)}const beforeFinal=structuredClone(x.state.deliveries);eq((await post(owner,{type:'deliver',partner:'msme',enrollmentId:ids.msme},x.revision)).status,403);eq((await get(owner)).state.deliveries,beforeFinal);
const result={passed:true,checks,coverage:['three server-side approved partner mappings','all six cross-partner rejections','Health enable and preview rejections','exact-key payload rejection','saved local receipt history preserved','no legacy boolean-to-grant migration','private draft canary absent from receipt','separate owner state and foreign enrollment denial','actual same-revision preview/withdrawal race'],limits:['Synthetic local identity headers only','No external request or connector invocation','Legacy Health history preservation uses the pure integration regression fixture, not a database seed']};writeFileSync(new URL('../.sites-runtime/ecosystem-api.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
