import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),app=resolve(process.env.ACADEMY_APP_PATH??process.cwd()),out=resolve(process.env.ACADEMY_INTEGRATED_BROWSER_OUT??app+'/.sites-runtime/eight-hour/browser-evidence');
if(!process.env.ACADEMY_QA_WORKER)throw new Error('A root-confirmed stable Worker session is required.');
process.env.ACADEMY_APP_PATH=app;process.env.ACADEMY_IDENTITY_QA_OUT=out+'/fixture';mkdirSync(out,{recursive:true});
const {identityFixture,base,headers,current,action,success,nonce}=await import(pathToFileURL(app+'/tests/identity-fixture.mjs'));
const {chromium,browserOptions}=await import(pathToFileURL(app+'/tests/scoped-workbench-qa/browser-runtime.mjs'));
const f=await identityFixture(),browser=await chromium.launch(browserOptions),cases=[],errors=[],contexts=[];
const selected=r=>r.method()==='GET'&&new URL(r.url()).searchParams.get('id')===f.id;
const directory=r=>r.method()==='GET'&&new URL(r.url()).pathname==='/api/teams'&&!new URL(r.url()).search;
const post=r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/teams';
const frames=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function person(view='operations'){const c=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(f.a)});contexts.push(c);const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?workspace='+f.id+'#'+view);await p.getByText('Workspace saved',{exact:true}).waitFor();return {p,c};}
async function masked(p){await p.getByRole('alert').first().waitFor();await frames(p);assert.equal(await p.getByRole('button',{name:'Workspace operations',exact:true}).count(),0);assert.ok(!(await p.locator('main').innerText()).includes(f.da.document.title));assert.equal(await p.locator('[data-content-editor-id]').count(),0);const picker=p.getByRole('combobox',{name:'Choose Academy workspace',exact:true});await picker.click();assert.equal(await p.getByRole('option').count(),1);await p.keyboard.press('Escape');assert.ok(!(await p.getByRole('alert').allTextContents()).some(x=>/SyntaxError|Unexpected token|Application error/.test(x)));}
async function invite(p){await p.evaluate(()=>location.hash='#teams');await p.getByRole('tab',{name:'Invitations',exact:true}).click();return p.getByLabel('Sign-in account email',{exact:true});}
async function scenario(name,fn){await fn();cases.push({name,passed:true});console.log(name+': passed');}
try {
 for(const [name,mutate] of [
  ['wrong requested workspace',j=>{j.team.id=f.ownA.id;}],
  ['null cohort item',j=>{j.team.cohorts=[null];}],
  ['malformed enrollment',j=>{j.state.enrollments=[null];}],
  ['missing view array shape',j=>{j.state.posts=[null];}],
  ['nonarray private content',j=>{j.contentVersions={};}],
  ['null private snapshot',j=>{j.contentVersions=[null];}],
  ['foreign private snapshot scope',j=>{j.contentVersions=[{ref:{scope:f.ownA.id,programId:f.p.id,versionId:'unavailable'},program:f.p,language:'en',audience:'private',classification:'private'}];}],
 ])await scenario('successful GET '+name+' masks without a crash',async()=>{const {p,c}=await person();let fault=true;await p.route('**/api/teams*',async route=>{if(fault&&selected(route.request())){fault=false;const response=await route.fetch(),json=await response.json();mutate(json);return route.fulfill({response,json});}return route.continue();});await p.getByRole('button',{name:'Refresh work',exact:true}).click();await masked(p);await c.close();});
 for(const [name,mutate]of [
  ['wrong subject',j=>{j.user.id=f.b.id;}],
  ['null row',j=>{j.workspaces=[null];}],
  ['duplicate workspace',j=>{j.workspaces.push({...j.workspaces[0]});}],
 ])await scenario('successful directory '+name+' masks protected projection',async()=>{const {p,c}=await person();let fault=true;await p.route('**/api/teams*',async route=>{if(fault&&directory(route.request())){fault=false;const response=await route.fetch(),json=await response.json();mutate(json);return route.fulfill({response,json});}return route.continue();});await p.getByRole('button',{name:'Refresh work',exact:true}).click();await masked(p);await c.close();});
 for(const kind of ['account','workspace','nonadvancing revision'])await scenario('wrong '+kind+' POST acknowledgement is uncertain; no retry or input loss',async()=>{
  const {p,c}=await person('teams'),input=await invite(p),email='uncertain-'+crypto.randomUUID()+'@academy.test';await input.fill(email);let count=0,alter=true;
  p.on('request',r=>{if(post(r))count++;});await p.route('**/api/teams*',async route=>{if(alter&&post(route.request())){alter=false;const response=await route.fetch(),json=await response.json();assert.equal(response.status(),200);if(kind==='account')json.team.currentUserId=f.b.id;if(kind==='workspace')json.team.id=f.ownA.id;if(kind==='nonadvancing revision')json.revision=route.request().postDataJSON().revision;return route.fulfill({response,json});}return route.continue();});
  await p.getByRole('button',{name:'Create invitation link',exact:true}).click();await masked(p);assert.ok((await p.getByRole('alert').first().innerText()).includes('save response could not be verified'));assert.equal(count,1);assert.equal(new URL(p.url()).searchParams.get('workspace'),f.id);assert.equal(success(await current(f.a,f.id)).team.invites.filter(i=>i.email===email).length,1);
  await p.unroute('**/api/teams*');await p.getByRole('button',{name:'Retry connection',exact:true}).click();await p.getByText('Workspace saved',{exact:true}).waitFor();assert.equal(await (await invite(p)).inputValue(),email,'Own unacknowledged invitation scratch remains until deliberate review.');assert.equal(count,1);await c.close();
 });
 await scenario('valid JSON503 keeps authorized current view while showing a plain error',async()=>{const {p,c}=await person();let fail=true;await p.route('**/api/teams*',route=>{if(fail&&selected(route.request())){fail=false;return route.fulfill({status:503,contentType:'application/json',json:{error:'Fictional transient unavailable.'}});}return route.continue();});await p.getByRole('button',{name:'Refresh work',exact:true}).click();await p.getByRole('alert').first().waitFor();assert.equal(await p.getByRole('button',{name:'Workspace operations',exact:true}).count(),1);assert.equal(await p.locator('[data-operations-workspace]').count(),1);await c.close();});
 assert.deepEqual(errors,[]);writeFileSync(out+'/acceptance-browser-result.json',JSON.stringify({passed:true,worker:process.env.ACADEMY_QA_WORKER,cases,pageErrors:errors,fixtureId:f.id,at:new Date().toISOString(),limits:['Current integrated shell and actual loopback API with deterministic intercepted responses.','Synthetic trusted-header identities only; no hosted sign-in or provider/partner transport.','No root source/build/restart or SQL mutation.']},null,2));console.log(JSON.stringify({passed:true,scenarios:cases.length,pageErrors:errors.length}));
}catch(error){for(const [i,c]of contexts.entries())for(const p of c.pages())await p.screenshot({path:out+'/failure-'+i+'.png',fullPage:false}).catch(()=>{});writeFileSync(out+'/acceptance-browser-result.json',JSON.stringify({passed:false,cases,pageErrors:errors,error:String(error),at:new Date().toISOString()},null,2));throw error;}finally{await browser.close();}
