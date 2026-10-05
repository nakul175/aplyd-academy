import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {base,headers,identity} from './local-qa.mjs';
import {chromium,browserOptions} from './scoped-workbench-qa/browser-runtime.mjs';
const output=path.resolve('.sites-runtime/snapshot-browser');fs.mkdirSync(output,{recursive:true});
const user=identity('snapshot-browser'),browser=await chromium.launch(browserOptions),context=await browser.newContext({extraHTTPHeaders:headers(user),viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],requests=[];let passed=false;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({method:r.method(),url:r.url()}));
try{
 await page.goto(base+'/#settings');await page.getByRole('button',{name:'Export a fresh private snapshot'}).waitFor();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export a fresh private snapshot'}).click();const download=await pending,file=path.join(output,'synthetic-export.json');await download.saveAs(file);const exported=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(exported.subjectId,user.id);assert.equal(exported.snapshotSha256,createHash('sha256').update(exported.snapshotJson).digest('hex'));
 await page.getByText('Inspect a saved snapshot',{exact:true}).click();const before=requests.length;await page.locator('#personal-snapshot-file').setInputFiles(file);await page.getByText('The carried checksum matches.',{exact:false}).waitFor();assert.equal(requests.slice(before).length,0,'Local file inspection sends no network request');
 const altered=path.join(output,'altered.json');fs.writeFileSync(altered,JSON.stringify({...exported,snapshotJson:exported.snapshotJson+' '}));await page.locator('#personal-snapshot-file').setInputFiles(altered);await page.getByText('The carried checksum differs',{exact:false}).waitFor();
 const mismatch=path.join(output,'other.json');fs.writeFileSync(mismatch,JSON.stringify({...exported,subjectId:'different-synthetic-account'}));await page.locator('#personal-snapshot-file').setInputFiles(mismatch);await page.getByText('Its account reference differs',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(requests.filter(r=>r.method==='POST').length,0);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'snapshot-mobile.png'),fullPage:true});passed=true;
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed,at:new Date().toISOString(),worker:base,scope:'Actual local browser export/inspection, synthetic account,390px viewport. No production authentication, restore or human screen-reader proof.',checks:6,pageErrors:errors,posts:requests.filter(r=>r.method==='POST').length,sourceHashes:Object.fromEntries(['app/academy-snapshot.tsx','lib/academy-snapshot.ts','app/academy-settings.tsx'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2));console.log(JSON.stringify({passed,checks:6}));}
