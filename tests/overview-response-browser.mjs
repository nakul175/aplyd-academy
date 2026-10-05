import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const app=resolve(process.env.ACADEMY_APP_PATH??'.');
const output=resolve(process.env.ACADEMY_RESPONSE_QA_OUT??app+'/.sites-runtime/response-shape-qa');
mkdirSync(output,{recursive:true});
const {chromium,browserOptions}=await import(pathToFileURL(app+'/tests/scoped-workbench-qa/browser-runtime.mjs'));
const base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local-only fixture');
const user={id:'qa-overview-shape-'+crypto.randomUUID(),email:'overview-shape@academy.test',name:'Synthetic shape audit'};
const headers={'oai-authenticated-user-id':user.id,'oai-authenticated-user-email':user.email,'oai-authenticated-user-full-name':user.name};
const profile={name:'Synthetic shape audit',context:'msme',reading:false,networking:false};
const completeState={profile,enrollments:[],posts:[],reports:[],interests:[],connections:{},deliveries:[],followups:[],paused:[],seen:[]};
const mode=process.env.ACADEMY_RESPONSE_EXPECT??'hardened';
assert.ok(['baseline','hardened'].includes(mode));
const pathways=JSON.parse(readFileSync(app+'/lib/curriculum.json','utf8')).pathways;
const msme=pathways.find(p=>p.role===pathways[1].role);
const fixtures=[
 {name:'minimal profile and empty enrollments, omitted auxiliary arrays',state:{profile,enrollments:[]}},
 {name:'null enrollment is rejected before HOME rendering',invalid:true,state:{...completeState,enrollments:[null]}},
 {name:'matching enrollment missing completed array',invalid:true,state:{...completeState,enrollments:[{id:'qa-e',programId:msme.id,version:'0.1-review-draft',withdrawn:false,attempts:[],appeals:[],practice:{},draft:{},quizAnswers:{}}]}},
 {name:'ordinary empty full workspace still renders',state:completeState},
 {name:'well-shaped unknown content version retained safely',unknownPin:true,state:{...completeState,enrollments:[{id:'qa-unknown-e',programId:msme.id,version:'not-a-published-version',withdrawn:false,completed:[],attempts:[],appeals:[],practice:{},draft:{},record:null}]}}
];
const browser=await chromium.launch(browserOptions),results=[];let passed=false;
try{for(const f of fixtures){
 const ctx=await browser.newContext({extraHTTPHeaders:headers}),page=await ctx.newPage(),errors=[];let apiGets=0,posts=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts++});
 await page.route('**/api/academy',route=>{apiGets++;return route.fulfill({status:200,contentType:'application/json',json:{currentUserId:user.id,state:f.state,revision:0}})});
 await page.route('**/api/teams*',route=>route.fulfill({status:200,contentType:'application/json',json:{user,workspaces:[]}}));
 await page.goto(base+'/#home');
 await page.waitForTimeout(1600);
 const body=await page.locator('body').innerText();
 const result={name:f.name,successful200Body:{currentUserId:user.id,revision:0,state:f.state},apiGets,posts,pageErrors:errors,overviewVisible:body.includes('Good to see you, Synthetic shape audit.'),renderErrorBoundary:body.includes('This page couldn’t load'),verificationNotice:body.includes('signed-in learning space could not be verified'),savedContentUnavailable:body.includes('Saved learning content unavailable'),bodyPreview:body.slice(0,600)};
 results.push(result);console.log(JSON.stringify(result));await ctx.close();
 assert.equal(posts,0);assert.equal(apiGets,1);
 if(f.invalid&&mode==='hardened'){assert.equal(result.renderErrorBoundary,false);assert.equal(result.verificationNotice,true);assert.equal(result.overviewVisible,false);assert.deepEqual(errors,[])}
 else if(f.invalid)assert.equal(result.renderErrorBoundary,true);
 else{assert.equal(result.overviewVisible,true);assert.equal(result.renderErrorBoundary,false);assert.equal(result.verificationNotice,false);assert.deepEqual(errors,[]);if(f.unknownPin)assert.equal(result.savedContentUnavailable,true)}
}passed=true;}finally{await browser.close();writeFileSync(resolve(output,'overview-malformed-'+mode+'-result.json'),JSON.stringify({passed,worker:base,at:new Date().toISOString(),expectation:mode,sourceSnapshotHashes:Object.fromEntries(['app/academy.tsx','app/academy-response.ts'].map(file=>[file,createHash('sha256').update(readFileSync(app+'/'+file)).digest('hex')])),scope:'Only intercepted successful JSON response bodies and synthetic local header. No command POST, checkout change, rebuild or production call. Source snapshot hashes do not independently prove loaded server bundle identity.',results},null,2));}
