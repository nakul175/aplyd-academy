import assert from 'node:assert/strict';
import {chromium} from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {performanceFixture,base,headers,record} from './performance-fixture.mjs';
const f=await performanceFixture(),scenarios=[],startedAt=new Date().toISOString();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
try{
 for(const name of ['Retry connection','Refresh saved progress']){
  const context=await browser.newContext({extraHTTPHeaders:headers(f.owner),viewport:{width:1440,height:1000}}),page=await context.newPage(),captured=deferred(),release=deferred(),delivered=deferred();let selectedReads=0,directoryFirst=true;
  await page.route('**/api/teams*',async route=>{
   const r=route.request(),u=new URL(r.url());if(r.method()!=='GET')return route.continue();
   if(u.pathname==='/api/teams'&&!u.search&&directoryFirst){directoryFirst=false;return route.fulfill({status:503,contentType:'application/json',json:{error:'Synthetic one-time access retry focus trigger.'}})}
   if(u.pathname==='/api/teams'&&u.searchParams.get('id')===f.id&&++selectedReads===2){const response=await route.fetch();captured.resolve();await release.promise;await route.fulfill({response});delivered.resolve();return}
   return route.continue();
  });
  try{
   await page.goto(base+'/?workspace='+f.id+'#home');const retry=page.getByRole('button',{name,exact:true});await retry.waitFor();await retry.focus();await retry.press('Enter');await captured.promise;
   const whilePending=await page.evaluate(()=>({id:document.activeElement?.id,tag:document.activeElement?.tagName}));assert.equal(whilePending.id,'main','Manual retry must focus main before its pending read completes.');
   release.resolve();await delivered.promise;await page.locator('[data-save-state="loaded"]').waitFor();await frames(page);const afterSuccess=await page.evaluate(()=>({id:document.activeElement?.id,tag:document.activeElement?.tagName}));assert.equal(afterSuccess.id,'main','Removing the successful retry control must retain main focus.');scenarios.push({name,passed:true,whilePending,afterSuccess});
  }catch(error){scenarios.push({name,passed:false,error:String(error)});throw error}finally{release.resolve();await context.close()}
 }
 record('read-retry-focus-result.json',{passed:true,startedAt,completedAt:new Date().toISOString(),scenarios,limits:['Actual current local UI with held genuine GET response','No rebuild or server change','No asynchronous focus steal after response']});console.log(JSON.stringify({passed:true,scenarios}));
}catch(error){record('read-retry-focus-result.json',{passed:false,startedAt,completedAt:new Date().toISOString(),scenarios,error:String(error)});throw error}finally{await browser.close()}
