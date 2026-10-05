import {out,runtimeModuleHref} from './qa-paths.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium,browserOptions} from './browser-runtime.mjs';
import {base,headers} from '../local-qa.mjs';
const f=JSON.parse(readFileSync(new URL('operations-fixture.json',out),'utf8'));
const browser=await chromium.launch(browserOptions),cases=[];
try{
 for(const {status,endpoint} of ['selected','directory'].flatMap(endpoint=>[401,403,404].map(status=>({status,endpoint})))){
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(f.owner)}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?workspace='+f.id+'#operations');await page.getByText('Workspace saved',{exact:true}).waitFor();await page.locator('[data-operations-workspace]').waitFor();let injected=false;
  await page.route('**/api/teams*',async route=>{const request=route.request(),url=new URL(request.url()),target=endpoint==='selected'?url.searchParams.get('id')===f.id:url.pathname==='/api/teams'&&!url.search;if(!injected&&request.method()==='GET'&&target){injected=true;await route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:'Synthetic denied current workspace read.'})});}else await route.continue();});
  await page.getByRole('button',{name:'Refresh work',exact:true}).click();await page.getByRole('button',{name:'Retry connection',exact:true}).waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const retainedOperations=await page.locator('[data-operations-workspace]').count(),retainedNav=await page.getByRole('button',{name:'Workspace operations',exact:true}).count(),retainedAssignedReviewButton=await page.getByRole('button',{name:'Open my review',exact:true}).count();
  await page.screenshot({path:new URL(`operations-read-${endpoint}-${status}.png`,out).pathname,fullPage:true,animations:'disabled'});
  if(retainedAssignedReviewButton)await page.getByRole('button',{name:'Open my review',exact:true}).click();else await page.evaluate(()=>{location.hash='#studio';});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const studio=await page.locator('main').innerText(),retainedAssignedEvidence=studio.includes(f.canaries.evidenceA)||studio.includes(f.canaries.appealReason)||studio.includes(f.canaries.assessorNote);
  const passed=retainedOperations===0&&retainedNav===0&&retainedAssignedReviewButton===0&&!retainedAssignedEvidence&&errors.length===0;
  cases.push({endpoint,status,injected,passed,retainedOperations,retainedNav,retainedAssignedReviewButton,retainedAssignedEvidence,errors});await context.close();
 }
 const passed=cases.every(c=>c.passed);writeFileSync(new URL('operations-read-denial-result.json',out),JSON.stringify({passed,at:new Date().toISOString(),workspace:f.id,cases,scope:'Synthetic intercepted loopback current-workspace GET authority denial, then protected review navigation.'},null,2));console.log(JSON.stringify({passed,cases}));assert.ok(passed,'Denied current-workspace read must discard protected operations/navigation/assigned evidence');
}finally{await browser.close();}
