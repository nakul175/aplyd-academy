/** Read-only Plan/weekly browser acceptance for the M6 reflection-completion fix.
 *
 * Strictly local and read-only. Every /api/* GET the page makes is fulfilled inside the
 * browser from an in-memory projection produced by the actual engine and plan model
 * (./build-model.mjs); it never reaches the Worker or its database and nothing is saved.
 * Other same-origin GET/HEAD requests go to a frozen local Worker build with redirects
 * refused (shared ../exact-offering-qa/read-only-routing.mjs). Any other method, origin,
 * redirect or unexpected API path is aborted and recorded, and fails the run.
 * The page clock is fixed per scenario so the learner's current week is deterministic.
 * Never point this at the hosted demo. No persisted fixture, SQL, provider or invitation.
 *
 * Required: ACADEMY_REFLECTION_WORKER_READY=1, ACADEMY_QA_WORKER, ACADEMY_REFLECTION_RUNTIME_DIST
 * (frozen dist served by that Worker), ACADEMY_LOCAL_URL (loopback only, default 127.0.0.1:8787).
 * Optional: ACADEMY_REFLECTION_BUILT_ENTRY (checkout build entry that must equal the frozen
 * entry), ACADEMY_REFLECTION_QA_OUTPUT, ACADEMY_REFLECTION_BROWSER_OUTPUT, ACADEMY_PLAYWRIGHT_MODULE. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {withReadOnlyRoute,fetchReadOnlyResponse} from '../exact-offering-qa/read-only-routing.mjs';
import {reviewedWorkspace,CREATED,FIRST,SECOND,FIRST_WEEK,SECOND_WEEK} from './workflow.mjs';

const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:existsSync('app/api/academy/route.ts')?'.':'work/aplyd-academy'));
const output=resolve(process.env.ACADEMY_REFLECTION_QA_OUTPUT??app+'/.sites-runtime/reflection-completion-qa');
assert.equal(process.env.ACADEMY_REFLECTION_WORKER_READY,'1','Start the frozen local Worker and set ACADEMY_REFLECTION_WORKER_READY=1 before any browser action.');
assert.ok(process.env.ACADEMY_QA_WORKER,'Name the stable local Worker session in ACADEMY_QA_WORKER.');
const runtimeDist=process.env.ACADEMY_REFLECTION_RUNTIME_DIST;assert.ok(runtimeDist,'The frozen dist path served by the local Worker is required.');
const base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787',origin=new URL(base).origin;
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Local loopback Worker only; never the hosted demo.');
const evidence=resolve(process.env.ACADEMY_REFLECTION_BROWSER_OUTPUT??output+'/browser');mkdirSync(evidence+'/downloads',{recursive:true});
const modelPath=output+'/model.mjs';assert.ok(existsSync(modelPath),'Run tests/reflection-completion-qa/build-model.mjs first.');
globalThis.fetch=()=>{throw new Error('Node-side network is disabled; only the browser talks to the local Worker.');};
const model=await import(pathToFileURL(modelPath).href);
const {chromium,browserOptions}=await import(pathToFileURL(app+'/tests/scoped-workbench-qa/browser-runtime.mjs').href);

const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const productFiles=['lib/academy-plan.ts','lib/academy-weekly-review.mjs','lib/academy-engine.ts','app/academy-plan.tsx','app/academy-weekly-review.tsx','app/academy-settings.tsx','app/academy.tsx','app/academy-acceptance.ts','app/academy-download.ts'];
const harnessFiles=['tests/reflection-completion-qa/browser-readonly.mjs','tests/reflection-completion-qa/workflow.mjs','tests/exact-offering-qa/read-only-routing.mjs'];
const hashes=files=>Object.fromEntries(files.map(file=>[file,sha(resolve(app,file))]));
const runtimeHashes=()=>Object.fromEntries(['server/index.js','server/wrangler.json'].map(file=>[file,sha(resolve(runtimeDist,file))]));
const builtEntry=resolve(process.env.ACADEMY_REFLECTION_BUILT_ENTRY??app+'/dist/server/index.js');
const sourceHashes=hashes(productFiles),inspectedHarness=hashes(harnessFiles),modelHash=sha(modelPath),frozen=runtimeHashes(),builtHash=sha(builtEntry);
assert.equal(frozen['server/index.js'],builtHash,'The frozen Worker entry must equal the checked build entry.');

// Fictional identity used only for the HTML request to the local Worker; no API call reaches it.
const user={id:'display-learner-reflection-qa',email:'display-learner@academy.test',name:'Display learner'};
const identityHeaders={'oai-authenticated-user-id':user.id,'oai-authenticated-user-email':user.email,'oai-authenticated-user-full-name':encodeURIComponent(user.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
const LATER_TASK='2026-10-12T09:00:00.000Z',R1='CANARY-R1 first work reflection: I checked each fictional source before replying.',R2='CANARY-R2 second work reflection: I kept an unsupported claim out of the reply.';
const GOAL='CANARY-GOAL reply to customers with checked facts',NOTE='CANARY-NOTE private planning note';

// Display variants: the actual engine runs the sample review lifecycle and own plan commands in memory only.
function journey({later=false,second=true,skipped=false}={}){
 let {state,enrollmentId}=reviewedWorkspace(model);
 state=model.applyCommand(state,{type:'learning-plan',personalGoal:GOAL},'2026-10-05T07:00:00.000Z');
 state=model.applyCommand(state,{type:'plan-task',kind:'reflection',enrollmentId,dueDate:'2026-10-06',plannedMinutes:15,note:NOTE},CREATED);
 const first=state.learningPlan.tasks.at(-1);
 if(skipped)state=model.applyCommand(state,{type:'plan-task-status',taskId:first.id,status:'skipped'},'2026-10-05T09:00:00.000Z');
 state=model.applyCommand(state,{type:'followup',enrollmentId,reflection:R1,before:'20',after:'15'},FIRST);
 let next=null;
 if(later){state=model.applyCommand(state,{type:'plan-task',kind:'reflection',enrollmentId,dueDate:'2026-10-13',plannedMinutes:15},LATER_TASK);next=state.learningPlan.tasks.at(-1);}
 if(second)state=model.applyCommand(state,{type:'followup',enrollmentId,reflection:R2,before:'25',after:'10'},SECOND);
 return {state,enrollmentId,first,next};
}
const canaries=v=>[R1.slice(0,9),R2.slice(0,9),GOAL.slice(0,11),NOTE.slice(0,11),v.enrollmentId,v.first.id,user.id,...(v.next?[v.next.id]:[])];
function expected(v,now){
 const summary=model.learningPlanSummary(v.state,model.planOptions(now)),review=model.deriveOwnWeeklyReview(summary,now);
 assert.ok(review,'The actual weekly model accepts the display projection.');
 return {summary,review,task:id=>summary.tasks.find(t=>t.id===id)};
}

const cases=[],requests=[],forbidden=[],unexpectedApi=[],apiFulfilled=[],pageErrors=[],downloads=[],contexts=[];
let browser;
async function open(v,{now,width=1440,hash='plan',enlarged=false}){
 const c=await browser.newContext({extraHTTPHeaders:identityHeaders,viewport:{width,height:1000},acceptDownloads:true,serviceWorkers:'block'});contexts.push(c);
 const p=await c.newPage();p.setDefaultTimeout(15000);
 await p.clock.setFixedTime(new Date(now));
 const academy={currentUserId:user.id,state:structuredClone(v.state),revision:7,programs:model.programs,user:{displayName:user.name},mode:'private-pilot'};
 const directory={workspaces:[],user:{id:user.id,name:user.name,email:user.email}};
 await p.route('**/*',route=>withReadOnlyRoute(route,origin,forbidden,async safe=>{
  const url=new URL(safe.request().url());
  if(url.pathname.startsWith('/api/')){
   const body=url.pathname==='/api/academy'&&!url.search?academy:url.pathname==='/api/teams'&&!url.search?directory:null;
   if(!body){unexpectedApi.push({path:url.pathname,search:url.search});return safe.abort('blockedbyclient');}
   apiFulfilled.push(url.pathname);
   return safe.fulfill({status:200,contentType:'application/json; charset=utf-8',headers:{'cache-control':'no-store'},body:JSON.stringify(body)});
  }
  const response=await fetchReadOnlyResponse(safe,origin,forbidden);if(response)return safe.fulfill({response});
 }));
 p.on('request',r=>requests.push({method:r.method(),path:new URL(r.url()).pathname}));p.on('pageerror',e=>pageErrors.push(e.message));
 await p.goto(base+'/#'+hash);await p.locator('[data-save-state="loaded"]').waitFor();
 if(enlarged){await p.addStyleTag({content:'html, body { font-size:32px !important; }'});assert.equal(await p.evaluate(()=>getComputedStyle(document.body).fontSize),'32px');}
 return {p,c};
}
const shown=(p,iso,timeZone='UTC')=>p.evaluate(([iso,timeZone])=>new Date(iso).toLocaleString('en-IN',{timeZone}),[iso,timeZone]);
async function planTask(p,task,{label,completedAt,notCompletedAt=null}){
 const card=p.locator(`section[data-plan-task-id="${task.id}"]`);await card.waitFor();const text=await card.innerText();
 assert.ok(text.includes(label),`Task label ${label}; actual ${JSON.stringify(text)}`);
 if(completedAt){const want='Saved completion: '+await shown(p,completedAt);assert.ok(text.includes(want),`Expected ${want}; actual ${JSON.stringify(text)}`);}
 else assert.ok(!text.includes('Saved completion:'),'No completion date is shown for this item.');
 if(notCompletedAt)assert.ok(!text.includes(await shown(p,notCompletedAt)),'The later reflection date must not replace the saved completion.');
 return text;
}
async function weekly(p,review){
 const panel=p.locator('section[data-own-weekly-review]');await panel.waitFor();
 assert.ok((await panel.innerText()).includes(review.week.start+' to '+review.week.end),'The recap shows the current own week.');
 const metric=await panel.locator('dl > div').filter({has:p.locator('dt',{hasText:'Plan items with saved course actions this week'})}).locator('dd').innerText();
 assert.equal(Number(metric),review.evidence.total,'Weekly saved course actions');
 await panel.locator('details > summary').click();
 const detail=`Saved course actions: ${review.evidence.lessons} lessons completed · ${review.evidence.submissions} evidence submissions · ${review.evidence.reflections} reflections.`;
 // The paragraph continues with a fixed limitation sentence; the counts must lead it exactly.
 const paragraph=panel.locator('p',{hasText:'Saved course actions:'});await paragraph.waitFor();const said=await paragraph.innerText();
 assert.ok(said.startsWith(detail),`Expected ${JSON.stringify(detail)}; actual ${JSON.stringify(said)}`);
 return panel;
}
async function save(p,panel,button,name){
 const event=p.waitForEvent('download');await panel.getByRole('button',{name:button,exact:true}).click();const d=await event;
 assert.equal(await d.failure(),null);const url=new URL(d.url());assert.equal(url.protocol,'blob:');assert.equal(url.origin,origin);
 const path=evidence+'/downloads/'+name;await d.saveAs(path);const raw=readFileSync(path,'utf8');
 downloads.push({name,suggested:d.suggestedFilename(),file:path,sha256:createHash('sha256').update(raw).digest('hex'),localBlob:true});return {raw,suggested:d.suggestedFilename()};
}
const noCanary=(raw,v)=>{for(const c of canaries(v))assert.ok(!raw.includes(c),'Private value excluded from recap: '+c.slice(0,12));};
async function scenario(name,fn){try{await fn();cases.push({name,passed:true});console.log('passed: '+name);}catch(e){cases.push({name,passed:false,error:String(e?.message??e).slice(0,600)});console.log('FAILED: '+name+'\n  '+String(e?.message??e).slice(0,300));}finally{for(const c of contexts.splice(0))await c.close().catch(()=>{});}}

let passed=false,invariant=false;
const variants={week1:journey({second:false}),week2:journey(),later:journey({later:true}),skipped:journey({skipped:true})};
const frozenVariants=structuredClone(variants);
try{
 // Expected projections come from the actual model and must match the fixed semantics before any browser step.
 const w1=expected(variants.week1,FIRST_WEEK),w2=expected(variants.week2,SECOND_WEEK),lt=expected(variants.later,SECOND_WEEK),sk=expected(variants.skipped,SECOND_WEEK);
 assert.equal(w1.task(variants.week1.first.id).completedAt,FIRST);assert.equal(w1.review.evidence.reflections,1);
 assert.equal(w2.task(variants.week2.first.id).completedAt,FIRST);assert.equal(w2.review.evidence.reflections,0);assert.equal(variants.week2.state.followups.length,2);
 assert.equal(lt.task(variants.later.first.id).completedAt,FIRST);assert.equal(lt.task(variants.later.next.id).completedAt,SECOND);assert.equal(lt.review.evidence.reflections,1);
 assert.equal(sk.task(variants.skipped.first.id).status,'skipped');assert.equal(sk.review.evidence.reflections,0);
 browser=await chromium.launch(browserOptions);

 await scenario('week 1 after the first reflection: plan item shows its saved completion and the recap counts it once',async()=>{
  const {p}=await open(variants.week1,{now:FIRST_WEEK});await planTask(p,variants.week1.first,{label:'Reflection saved',completedAt:FIRST});await weekly(p,w1.review);
  await p.screenshot({path:evidence+'/week1-plan.png',fullPage:true});
 });
 await scenario('week 2 after a later reflection: the earlier plan item keeps its first completion date',async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK});await planTask(p,variants.week2.first,{label:'Reflection saved',completedAt:FIRST,notCompletedAt:SECOND});
  await p.screenshot({path:evidence+'/week2-plan.png',fullPage:true});
 });
 await scenario('week 2 after a later reflection: the weekly recap does not recount the earlier plan item',async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK});await weekly(p,w2.review);
 });
 await scenario('week 1 recap JSON download counts one plan reflection and excludes private content',async()=>{
  const {p}=await open(variants.week1,{now:FIRST_WEEK}),panel=await weekly(p,w1.review),{raw,suggested}=await save(p,panel,'Download recap JSON','week1-recap.json');
  const recap=JSON.parse(raw);assert.equal(suggested,'aplyd-weekly-plan-2026-10-05-2026-10-11.json');assert.deepEqual(recap,model.prepareOwnWeeklyRecap(w1.review));
  assert.equal(recap.savedCourseActions.reflections,1);assert.equal(recap.savedCourseActions.total,1);noCanary(raw,variants.week1);
 });
 await scenario('week 2 recap JSON download keeps the earlier plan item out of the later week',async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK}),panel=await weekly(p,w2.review),{raw,suggested}=await save(p,panel,'Download recap JSON','week2-recap.json');
  const recap=JSON.parse(raw);assert.equal(suggested,'aplyd-weekly-plan-2026-10-12-2026-10-18.json');assert.deepEqual(recap,model.prepareOwnWeeklyRecap(w2.review));
  assert.equal(recap.savedCourseActions.reflections,0);assert.equal(recap.savedCourseActions.total,0);assert.equal(recap.attention.completionDateNeedsCheck,0);noCanary(raw,variants.week2);
 });
 await scenario('week 2 printable recap download reports no plan reflection for the earlier item',async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK}),panel=await weekly(p,w2.review),{raw,suggested}=await save(p,panel,'Download printable recap','week2-recap.html');
  assert.equal(suggested,'aplyd-weekly-plan-2026-10-12-2026-10-18.html');assert.equal(raw,model.renderOwnWeeklyRecapHtml(w2.review),'Printable recap equals the actual renderer output');
  assert.ok(raw.includes('<th scope="row">Plan reflections saved this week</th><td>0</td>'),'Printable recap reflection row');assert.ok(!/<script|https?:\/\//i.test(raw),'Printable recap is self-contained');noCanary(raw,variants.week2);
 });
 await scenario('a plan item created in week 2 completes from its own first reflection while the earlier item stays put',async()=>{
  const {p}=await open(variants.later,{now:SECOND_WEEK});await planTask(p,variants.later.first,{label:'Reflection saved',completedAt:FIRST,notCompletedAt:SECOND});
  await planTask(p,variants.later.next,{label:'Reflection saved',completedAt:SECOND});await weekly(p,lt.review);
 });
 await scenario('a skipped reflection plan item stays skipped despite later reflections',async()=>{
  const {p}=await open(variants.skipped,{now:SECOND_WEEK});await planTask(p,variants.skipped.first,{label:'Skipped',completedAt:null});await weekly(p,sk.review);
 });
 await scenario('both reflections remain visible in own reflection history',async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK,hash:'credentials'});const items=p.locator('.reflection-item');await items.first().waitFor();
  const texts=await items.allInnerTexts();assert.equal(texts.length,2,'Both saved reflections are listed');
  assert.ok(texts[0].includes(R2)&&texts[1].includes(R1),'Newest first, both bodies retained');
 });
 for(const enlarged of [false,true])await scenario(`390px ${enlarged?'enlarged 32px body text':'normal text'} week 2 plan keeps the stable completion readable without horizontal scroll`,async()=>{
  const {p}=await open(variants.week2,{now:SECOND_WEEK,width:390,enlarged});await planTask(p,variants.week2.first,{label:'Reflection saved',completedAt:FIRST,notCompletedAt:SECOND});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal page scroll');
  const card=p.locator(`section[data-plan-task-id="${variants.week2.first.id}"]`);await card.scrollIntoViewIfNeeded();assert.ok(await card.getByText('Saved completion:',{exact:false}).isVisible());
  await p.screenshot({path:evidence+`/week2-plan-390-${enlarged?'body32':'normal'}.png`,fullPage:false});
 });
 assert.deepEqual(variants,frozenVariants,'In-memory display states were never changed by the browser run.');invariant=true;
 assert.deepEqual(forbidden,[]);assert.deepEqual(unexpectedApi,[]);assert.deepEqual(pageErrors,[]);
 assert.ok(requests.length>0&&requests.every(r=>['GET','HEAD'].includes(r.method)),'Only GET/HEAD requests were made.');
 assert.deepEqual(hashes(productFiles),sourceHashes);assert.deepEqual(hashes(harnessFiles),inspectedHarness);assert.equal(sha(modelPath),modelHash);
 assert.deepEqual(runtimeHashes(),frozen);assert.equal(sha(builtEntry),builtHash);
 assert.equal(cases.length,11);assert.equal(downloads.length,3);
 passed=cases.every(c=>c.passed);
}finally{
 if(browser)await browser.close();
 writeFileSync(evidence+'/browser-evidence.json',JSON.stringify({passed,at:new Date().toISOString(),worker:process.env.ACADEMY_QA_WORKER,base,runtimeDist,frozenRuntimeHashes:frozen,builtEntry,builtEntryHash:builtHash,modelHash,sourceHashes,harnessHashes:inspectedHarness,clock:{FIRST_WEEK,SECOND_WEEK},plannedCases:11,passedCases:cases.filter(c=>c.passed).length,cases,downloads,requestCount:requests.length,methods:[...new Set(requests.map(r=>r.method))],apiFulfilledInBrowser:apiFulfilled.length,unexpectedApi,forbidden,pageErrors,inMemoryStatesUnchanged:invariant,
  fixtureScope:'Fictional display-only learner; states produced in memory by the actual engine and plan commands; API responses fulfilled in the browser and never sent to the Worker or saved.',
  limits:['Local loopback GET/HEAD only; no account, enrolment, plan or reflection was persisted anywhere.','The /api/academy and /api/teams GET envelopes mirror the route source; server routes and D1 were not exercised.','Page clock fixed per scenario; this checks current-week display, not real elapsed time.','Service workers blocked so every request passed the read-only guard; the app registers none.','32px body text tests text enlargement, not browser zoom; layout checks are not a formal accessibility audit.']},null,2));
 console.log(JSON.stringify({passed,cases:cases.length,passedCases:cases.filter(c=>c.passed).length,downloads:downloads.length,forbidden:forbidden.length,unexpectedApi:unexpectedApi.length,pageErrors:pageErrors.length}));
 if(!passed)process.exitCode=1;
}
