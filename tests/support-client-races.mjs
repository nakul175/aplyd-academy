import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium} from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,base,headers,current,action,success} from './local-qa.mjs';
const {owner,a:requester,mod:handler,id,cid}=await fixture(),errors=[];
success(await action(owner,id,{type:'member',userId:handler.id,roles:['facilitator'],scopes:[cid],active:true}));
const privateBody='RACE-PRIVATE-THREAD-CANARY: a permitted fictional source activity needs an explanation.';
const opened=success(await action(requester,id,{type:'support-open',category:'learning',cohortId:cid,subject:'A generic source activity question',body:privateBody,audienceAcknowledged:true})),rid=opened.team.support.mine.at(-1).id;
success(await action(handler,id,{type:'support-claim',requestId:rid}));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const isRead=r=>{const url=new URL(r.url());return r.request().method()==='GET'&&url.pathname==='/api/teams'&&url.searchParams.get('id')===id};
const isPost=r=>new URL(r.url()).pathname==='/api/teams'&&r.request().method()==='POST';
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
try{
 async function person(u,tab){const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(u)}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?workspace='+id+'#support');await page.getByRole('heading',{name:'Help with your learning',exact:true}).waitFor();await page.getByText('Workspace saved',{exact:true}).waitFor();const t=page.getByRole('tab',{name:tab,exact:true});if(await t.getAttribute('aria-selected')!=='true')await t.click();await page.locator(`[data-support-request-id="${rid}"]`).getByRole('button',{name:'View request',exact:true}).click();await page.locator(`[data-support-thread-id="${rid}"]`).getByText(privateBody,{exact:true}).waitFor();return page}
 const r=await person(requester,'My requests');
 // Capture a genuine earlier GET response, then delay delivery until the next
 // POST has been acknowledged. Releasing it must not revert that saved write.
 const oldCaptured=deferred(),oldRelease=deferred(),oldFulfilled=deferred();let holdOld=true,oldSnapshot;
 await r.route('**/api/teams?**',async route=>{const url=new URL(route.request().url());if(!holdOld||route.request().method()!=='GET'||url.searchParams.get('id')!==id)return route.continue();holdOld=false;const response=await route.fetch();oldSnapshot=await response.json();oldCaptured.resolve();await oldRelease.promise;await route.fulfill({response,json:oldSnapshot});oldFulfilled.resolve()});
 await r.getByRole('button',{name:'Refresh requests',exact:true}).click();await oldCaptured.promise;
 const acknowledged='ACKNOWLEDGED-REPLY-CANARY: this fictional reply must survive a late earlier read.';assert.ok(!JSON.stringify(oldSnapshot).includes(acknowledged));const rt=r.locator(`[data-support-thread-id="${rid}"]`);await rt.getByLabel('My reply',{exact:true}).fill(acknowledged);const [writeResponse]=await Promise.all([r.waitForResponse(x=>isPost(x)&&x.status()===200),rt.getByRole('button',{name:'Save reply',exact:true}).click()]);const writeResult=await writeResponse.json();await rt.locator('.support-messages p').filter({hasText:acknowledged}).waitFor();assert.ok(writeResult.revision>oldSnapshot.revision);oldRelease.resolve();await oldFulfilled.promise;await frames(r);assert.equal(await rt.locator('.support-messages p').filter({hasText:acknowledged}).count(),1);assert.equal((await current(requester,id)).revision,writeResult.revision);
 await r.unroute('**/api/teams?**');
 // Now capture a valid handler read before removing authority. Hold the forced
 // post-403 current read too, to prove private cache masking happens immediately
 // before the fresh server projection arrives. Release the stale read last.
 const h=await person(handler,'My handled requests'),staleCaptured=deferred(),staleRelease=deferred(),staleFulfilled=deferred(),freshCaptured=deferred(),freshRelease=deferred(),freshFulfilled=deferred();let intercepted=0,staleSnapshot,freshSnapshot;
 await h.route('**/api/teams?**',async route=>{const url=new URL(route.request().url());if(route.request().method()!=='GET'||url.searchParams.get('id')!==id)return route.continue();const ordinal=++intercepted;if(ordinal>2)return route.continue();const response=await route.fetch(),snapshot=await response.json();if(ordinal===1){staleSnapshot=snapshot;staleCaptured.resolve();await staleRelease.promise;await route.fulfill({response,json:snapshot});staleFulfilled.resolve()}else{freshSnapshot=snapshot;freshCaptured.resolve();await freshRelease.promise;await route.fulfill({response,json:snapshot});freshFulfilled.resolve()}});
 await h.getByRole('button',{name:'Refresh requests',exact:true}).click();await staleCaptured.promise;assert.ok(JSON.stringify(staleSnapshot.team.support.assigned).includes(privateBody));
 const unsent='RACE-UNSENT-REPLY-CANARY: this is my local text, never a persisted reply after removal.';const ht=h.locator(`[data-support-thread-id="${rid}"]`);await ht.getByLabel('My reply',{exact:true}).fill(unsent);success(await action(owner,id,{type:'member',userId:handler.id,roles:['facilitator'],scopes:[cid],active:false}));
 const [denied]=await Promise.all([h.waitForResponse(x=>isPost(x)&&x.status()===403),ht.getByRole('button',{name:'Save reply',exact:true}).click()]);assert.equal(denied.status(),403);await freshCaptured.promise;assert.equal(freshSnapshot.team.active,false);assert.deepEqual(freshSnapshot.team.support.assigned,[]);
 await h.getByRole('heading',{name:'Your access to this request changed',exact:true}).waitFor();assert.ok(!(await h.locator('main').innerText()).includes(privateBody));assert.equal(await h.getByLabel('My unsent reply',{exact:true}).inputValue(),unsent);assert.equal(await h.locator('[data-support-thread-id]').count(),0);
 freshRelease.resolve();await freshFulfilled.promise;await frames(h);assert.ok(!(await h.locator('main').innerText()).includes(privateBody));staleRelease.resolve();await staleFulfilled.promise;await frames(h);assert.ok(!(await h.locator('main').innerText()).includes(privateBody));assert.equal(await h.getByLabel('My unsent reply',{exact:true}).inputValue(),unsent);assert.equal(await h.getByRole('tab',{name:'My handled requests',exact:true}).count(),0);assert.ok(!JSON.stringify((await current(requester,id)).team.support.mine).includes(unsent));
 await h.screenshot({path:new URL('../.sites-runtime/support-client-race-masked-thread.png',import.meta.url).pathname,fullPage:true});
 assert.deepEqual(errors,[]);
 const result={passed:true,actualDelayedEarlierGET:true,acknowledgedPOSTReplyPreserved:true,privateCacheMaskedBeforeForcedGETCompletes:true,current403ProjectionApplied:true,lateAuthorizedGETCannotRestoreRemovedThread:true,ownUnsentReplyRetained:true,deniedReplyNotPersisted:true,fixtureId:id,pageErrors:errors,limits:['Deterministic local browser response interception with synthetic identities','No hosted authentication or real notification is exercised']};writeFileSync(new URL('../.sites-runtime/support-client-races.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}
