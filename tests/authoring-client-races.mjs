import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium} from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,base,headers,current,action,success,nonce} from './local-qa.mjs';

// Candidate only until root executes against the reviewed integration. The held
// responses below come from actual loopback GETs; no fabricated authority data.
const {owner,mod:reviewer,id,p:seed}=await fixture(),errors=[];
success(await action(owner,id,{type:'member',userId:reviewer.id,roles:['admin'],scopes:[],active:true}));
let x=success(await action(owner,id,{type:'content-copy',sourceRef:{scope:'global',programId:seed.id,versionId:'0.1-review-draft'}})),d=x.team.content.drafts.at(-1);const did=d.id,document=structuredClone(d.document);
document.summary='PRIVATE-AUTHORING-RACE-'+nonce+' Fictional checked records and accountable human approval for local teaching practice.';
x=success(await action(owner,id,{type:'content-save',draftId:did,revision:d.revision,document}));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(owner)}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?workspace='+id+'#teams');await page.getByText('Workspace saved',{exact:true}).waitFor();
 const editor=()=>page.locator(`[data-content-editor-id="${did}"]`);
 async function studio(){await page.getByRole('button',{name:'Workspaces & cohorts',exact:true}).click();const tab=page.getByRole('tab',{name:'Content studio',exact:true});await tab.waitFor();if(await tab.getAttribute('aria-selected')!=='true')await tab.click();if(!await editor().count())await page.locator(`[data-content-draft-id="${did}"]`).getByRole('button',{name:'Open content draft',exact:true}).click();await editor().getByRole('navigation',{name:'Content draft sections',exact:true}).getByRole('button',{name:'Overview',exact:true}).click();await editor().getByLabel('Pathway title',{exact:true}).waitFor()}
 async function holdRead(capture){await page.getByRole('button',{name:'Support & help',exact:true}).click();await page.getByRole('heading',{name:'Help with your learning',exact:true}).waitFor();await page.getByRole('button',{name:'Refresh requests',exact:true}).click();await capture.promise;await studio()}
 async function save(expected){const [res]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/teams')&&r.request().method()==='POST'),editor().getByRole('button',{name:'Save content draft',exact:true}).click()]);const value=await res.json();assert.equal(res.status(),expected,JSON.stringify(value));return value}
 const matcher='**/api/teams?**';
 await studio();

 // A support refresh calls the same application loader without clearing the
 // author's workspace-scoped scratch. Navigate back to the editor while held.
 const oldCaptured=deferred(),releaseOld=deferred(),oldFinished=deferred();let intercepted=false;
 const firstRoute=async route=>{const u=new URL(route.request().url());if(route.request().method()!=='GET'||u.searchParams.get('id')!==id||intercepted)return route.continue();intercepted=true;const response=await route.fetch();assert.equal(response.status(),200);const body=await response.json();assert.ok(body.team.content.drafts.some(z=>z.id===did));oldCaptured.resolve();await releaseOld.promise;await route.fulfill({response});oldFinished.resolve()};
 await page.route(matcher,firstRoute);await holdRead(oldCaptured);
 const acknowledged='ACKNOWLEDGED-CONTENT-TITLE-'+nonce;await editor().getByLabel('Pathway title',{exact:true}).fill(acknowledged);await save(200);await page.getByText('Workspace saved',{exact:true}).waitFor();releaseOld.resolve();await oldFinished.promise;await frames(page);assert.equal(await editor().getByLabel('Pathway title',{exact:true}).inputValue(),acknowledged);assert.equal((await current(owner,id)).team.content.drafts.find(z=>z.id===did).document.title,acknowledged);assert.equal(await editor().getByText('The saved draft changed. Your unsaved document is still here.',{exact:true}).count(),0);await page.unroute(matcher,firstRoute);

 // Capture an older authorized owner read, then remove authority and hold the
 // mandatory fresh 403 projection. Private content must mask immediately.
 const olderCaptured=deferred(),releaseOlder=deferred(),olderFinished=deferred(),freshCaptured=deferred(),releaseFresh=deferred(),freshFinished=deferred();let count=0;
 const secondRoute=async route=>{const u=new URL(route.request().url());if(route.request().method()!=='GET'||u.searchParams.get('id')!==id)return route.continue();const ordinal=++count;if(ordinal>2)return route.continue();const response=await route.fetch();assert.equal(response.status(),200);const body=await response.json();if(ordinal===1){assert.ok(body.team.content.drafts.some(z=>z.id===did));olderCaptured.resolve();await releaseOlder.promise;await route.fulfill({response});olderFinished.resolve()}else{assert.equal(body.team.roles.includes('admin'),false);assert.equal(body.team.content?.drafts?.length??0,0);freshCaptured.resolve();await releaseFresh.promise;await route.fulfill({response});freshFinished.resolve()}};
 await page.route(matcher,secondRoute);await holdRead(olderCaptured);
 const unsent='MY-UNSENT-CONTENT-TITLE-'+nonce;await editor().getByLabel('Pathway title',{exact:true}).fill(unsent);success(await action(reviewer,id,{type:'member',userId:owner.id,roles:['learner'],scopes:[],active:false}));await save(403);await freshCaptured.promise;
 await page.waitForFunction(()=>document.querySelectorAll('[data-content-editor-id]').length===0);const beforeFresh=await page.locator('main').innerText();assert.ok(!beforeFresh.includes(document.summary));assert.ok(!beforeFresh.includes(acknowledged));assert.ok(!beforeFresh.includes(unsent));await page.screenshot({path:new URL('../.sites-runtime/authoring-race-private-cache-masked.png',import.meta.url).pathname,fullPage:false,animations:'disabled'});
 releaseFresh.resolve();await freshFinished.promise;await frames(page);releaseOlder.resolve();await olderFinished.promise;await frames(page);assert.equal(await page.locator('[data-content-editor-id]').count(),0);assert.equal(await page.getByRole('tab',{name:'Content studio',exact:true}).count(),0);assert.ok(!(await page.locator('main').innerText()).includes(document.summary));assert.equal((await current(reviewer,id)).team.content.drafts.find(z=>z.id===did).document.title,acknowledged);await page.unroute(matcher,secondRoute);
 success(await action(reviewer,id,{type:'member',userId:owner.id,roles:['admin','learner'],scopes:[],active:true}));await page.getByRole('button',{name:'Retry connection',exact:true}).click();await page.getByText('Workspace saved',{exact:true}).waitFor();await studio();assert.equal(await editor().getByLabel('Pathway title',{exact:true}).inputValue(),unsent);
 assert.deepEqual(errors,[]);
 const result={passed:true,executedAt:new Date().toISOString(),fixtureId:id,actualEarlierAuthorizedReads:true,acknowledgedDocumentSavePreserved:true,protectedContentMaskedBeforeForcedGET:true,lateAuthorizedGETCannotRestoreOwnerContent:true,ownUnsentDocumentRetainedAfterAuthorityRefresh:true,deniedSaveNotPersisted:true,pageErrors:errors,limits:['Synthetic loopback identities only','Uses Support refresh to exercise the shared loader while returning to Content studio','No hosted authentication or real sharing']};writeFileSync(new URL('../.sites-runtime/authoring-client-races-result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){writeFileSync(new URL('../.sites-runtime/authoring-client-races-result.json',import.meta.url),JSON.stringify({passed:false,fixtureId:id,error:String(error),pageErrors:errors},null,2));throw error}
finally {await browser.close()}
