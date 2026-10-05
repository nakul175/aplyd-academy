// Actual root acceptance module; pure fixture validation only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const app=resolve('.');
const module=resolve('.sites-runtime/acceptance-root/runtime.mjs');
const {build}=await import('esbuild');const {mkdirSync,writeFileSync}=await import('node:fs');const {dirname}=await import('node:path');const {createHash}=await import('node:crypto');mkdirSync(dirname(module),{recursive:true});
await build({entryPoints:[app+'/app/academy-acceptance.ts'],outfile:module,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
writeFileSync(dirname(module)+'/source.json',JSON.stringify({at:new Date().toISOString(),scope:'Actual integrated acceptance/curriculum/response source; no API/browser or hosted proof.',sources:Object.fromEntries(['app/academy-acceptance.ts','app/academy-response.ts','lib/academy-curriculum.ts'].map(f=>[f,createHash('sha256').update(readFileSync(app+'/'+f)).digest('hex')]))},null,2));
const {acceptAcademyPayload:accept,acceptAcademyDirectory:directory}=await import(pathToFileURL(module));
const programs=JSON.parse(readFileSync(app+'/lib/curriculum-versions/0.1-review-draft.json','utf8')).pathways;
const aid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',tid='tw-'+aid,foreign='tw-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const profile={name:'Synthetic reader',context:'msme',reading:false,networking:false};
const state={profile,enrollments:[]};
const team={id:tid,currentUserId:'actor-A',name:'Synthetic team',purpose:'Generic safe fixture.',context:'msme',roles:['admin','learner'],active:true,cohorts:[],assigned:[],summaries:[]};
const shared=()=>({revision:1,state:structuredClone(state),team:structuredClone(team),contentVersions:[]});
const lab=()=>({revision:1,state:structuredClone(state),currentUserId:'actor-A'});
const read={mode:'read',workspace:'team',teamId:tid};
const write={mode:'write',workspace:'team',teamId:tid,accountId:'actor-A',commandType:'profile',actionId:aid};
const rejection=fn=>assert.throws(fn,e=>e.name==='AcademyResponseError'&&e.unverified===true&&e.status===200&&!/actor-A|actor-B|Synthetic team/.test(e.message));

test('ordinary successful team read requires its requested workspace',()=>{const data=shared();data.team.id=foreign;rejection(()=>accept(data,read));});
test('ordinary write cannot move workspace through its acknowledgement',()=>{const data=shared();data.team.id=foreign;rejection(()=>accept(data,write));});
test('personal and shared writes require the captured canonical actor',()=>{const a=lab(),b=shared();a.currentUserId='actor-B';b.team.currentUserId='actor-B';rejection(()=>accept(a,{mode:'write',workspace:'lab',accountId:'actor-A'}));rejection(()=>accept(b,write));});
test('a new validated read may legitimately establish a changed account',()=>{const data=shared();data.team.currentUserId='actor-B';assert.equal(accept(data,read).actor,'actor-B');});
test('unconfirmed account cannot produce an accepted write',()=>rejection(()=>accept(lab(),{mode:'write',workspace:'lab',accountId:''})));
test('create is bound to exactly its captured action UUID',()=>{assert.equal(accept(shared(),{...write,commandType:'create',teamId:undefined}).team.id,tid);const data=shared();data.team.id=foreign;rejection(()=>accept(data,{...write,commandType:'create',teamId:undefined}));});
test('accept uses the captured invitation target without an arbitrary switch',()=>{const data=shared();data.team.id=foreign;assert.equal(accept(data,{...write,commandType:'accept',teamId:foreign}).team.id,foreign);rejection(()=>accept(data,{...write,commandType:'accept'}));});
test('lab responses never introduce a returned shared Team',()=>{const data=lab();data.team=team;rejection(()=>accept(data,{mode:'read',workspace:'lab'}));});
test('malformed snapshot containers fail before root filter or registry rendering',()=>{for(const value of [{},[null],[{}],[{ref:null}],[{ref:{scope:tid,programId:programs[0].id,versionId:'v1'}}]]){const data=shared();data.contentVersions=value;rejection(()=>accept(data,read));}});
test('all actual seed programs have accepted private snapshot render shape',()=>{for(const p of programs){const data=shared();data.contentVersions=[{ref:{scope:tid,programId:p.id,versionId:'private-v1'},program:structuredClone(p),language:'en',audience:'Adult learners',classification:'Private practice'}];assert.equal(accept(data,read).contentVersions.length,1);}});
test('private snapshots require matching unique pins and known root render fields',()=>{
 const base={ref:{scope:tid,programId:programs[1].id,versionId:'private-v1'},program:structuredClone(programs[1]),language:'en',audience:'Adult learners',classification:'Private practice'};
 for(const corrupt of [s=>s.ref.scope=foreign,s=>s.ref.programId='wrong',s=>s.program.lessons=null,s=>s.program.lessons[0]=null,s=>s.program.lessons[0].quiz[0].options=[{}],s=>s.program.practicalAssessment.rubric[0].anchors=null]){const s=structuredClone(base);corrupt(s);const data=shared();data.contentVersions=[s];rejection(()=>accept(data,read));}
 const data=shared();data.contentVersions=[base,structuredClone(base)];rejection(()=>accept(data,read));
});
test('unavailable legacy pin and malformed diagnostic receipt history stay unchanged',()=>{
 const data=shared();data.state.enrollments=[{id:'retained-e',programId:programs[1].id,version:'unavailable-legacy',completed:[],practice:{},draft:{},attempts:[],appeals:[],record:null,withdrawn:true}];data.state.ecosystemReceipts=[{id:'raw-owner-diagnostic',unrecognized:'retained'}];const before=JSON.stringify(data);const accepted=accept(data,read);assert.equal(accepted.serverState,data.state);assert.equal(accepted.serverState.enrollments[0].version,'unavailable-legacy');assert.deepEqual(accepted.viewState.ecosystemReceipts,data.state.ecosystemReceipts);assert.equal(JSON.stringify(data),before);
});
test('view defaults never mutate or masquerade as raw server acknowledgement fields',()=>{const data=lab(),before=JSON.stringify(data),accepted=accept(data,{mode:'read',workspace:'lab'});assert.deepEqual(accepted.viewState.posts,[]);assert.deepEqual(accepted.viewState.paused,[]);assert.deepEqual(accepted.viewState.interests,[]);assert.ok(!Object.hasOwn(accepted.serverState,'paused'));assert.equal(JSON.stringify(data),before);});
test('present damaged view arrays are refused rather than silently cleared',()=>{for(const patch of [{posts:null},{posts:[null]},{posts:[{id:'p',title:'p',body:'p',status:'visible',replies:null}]},{paused:{}},{interests:[{}]},{followups:[{}]}]){const data=lab();Object.assign(data.state,patch);rejection(()=>accept(data,{mode:'read',workspace:'lab'}));}});
test('removed own history remains valid and staff roles never survive inactive projection',()=>{const data=shared();data.team.active=false;data.team.roles=[];assert.equal(accept(data,read).team.active,false);data.team.roles=['admin'];rejection(()=>accept(data,read));});
test('malformed cohort/network date/thread containers are rejected before consumers',()=>{for(const patch of [{cohorts:[null]},{network:{directory:[],sessions:[{id:'s',title:'s',description:'s',startsAt:'invalid',endsAt:'invalid'}]}},{support:{mine:[{id:'r',subject:'r',status:'open',messages:null,resolutions:[],events:[]}],queue:[],assigned:[]}}]){const data=shared();Object.assign(data.team,patch);rejection(()=>accept(data,read));}});
const item={id:tid,name:'Workspace',context:'msme',roles:['learner'],active:true};
test('directory rejects null, duplicate, malformed and mismatched-subject rows',()=>{for(const rows of [[null],[{...item,name:{}}],[{...item,roles:null}],[item,{...item}]])rejection(()=>directory({user:{id:'actor-A'},workspaces:rows},'actor-A'));rejection(()=>directory({user:{id:'actor-B'},workspaces:[]},'actor-A'));});
test('empty directory and many valid joined workspaces preserve discovery',()=>{assert.equal(directory({user:{id:'actor-A'},workspaces:[]},'actor-A').workspaces.length,0);const rows=Array.from({length:40},(_,i)=>({...item,id:tid+'-'+i}));rows[0]={...rows[0],active:false,roles:[]};assert.equal(directory({user:{id:'actor-A'},workspaces:rows},'actor-A').workspaces.length,40);});

test('successful write must advance its captured revision before becoming an acknowledgement',()=>{rejection(()=>accept(lab(),{mode:'write',workspace:'lab',accountId:'actor-A',sourceRevision:1}));assert.equal(accept({...lab(),revision:2},{mode:'write',workspace:'lab',accountId:'actor-A',sourceRevision:1}).revision,2);});
