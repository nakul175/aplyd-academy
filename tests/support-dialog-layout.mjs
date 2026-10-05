import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium} from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,base,headers} from './local-qa.mjs';

// Targeted final-CSS regression. No submitted support request or external call.
const {owner,id}=await fixture(),errors=[],checks=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(owner)});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?workspace='+id+'#support');
 await page.getByRole('heading',{name:'Help with your learning',exact:true}).waitFor();
 await page.getByText('Workspace saved',{exact:true}).waitFor();
 for(const [width,enlarged] of [[1440,false],[390,true]]) {
  await page.setViewportSize({width,height:1000});
  const font=await page.evaluate(enlarged=>{document.documentElement.style.fontSize='';document.body.style.fontSize='';const root=parseFloat(getComputedStyle(document.documentElement).fontSize),body=parseFloat(getComputedStyle(document.body).fontSize);if(enlarged){document.documentElement.style.fontSize=(root*2)+'px';document.body.style.fontSize=(body*2)+'px'}return {baselineBody:body,actualBody:parseFloat(getComputedStyle(document.body).fontSize)}},enlarged);
  assert.ok(Math.abs(font.actualBody/font.baselineBody-(enlarged?2:1))<.01);
  const opener=page.getByRole('button',{name:'Request help',exact:true});await opener.click();
  const dialog=page.getByRole('dialog',{name:'Request help in this workspace',exact:true});await dialog.waitFor();
  await page.waitForFunction(()=>{const d=document.querySelector('[role=dialog]');return d&&Number(getComputedStyle(d).opacity)>=.99});
  const geometry=await dialog.evaluate(d=>{
   const title=d.querySelector('[data-slot=dialog-title]'),close=d.querySelector('[data-slot=dialog-close]');
   if(!title||!close)throw Error('Missing title or close button.');
   const box=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
   const closeBox=box(close.getBoundingClientRect()),textRects=[],walk=document.createTreeWalker(title,NodeFilter.SHOW_TEXT);
   let node;while(node=walk.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width&&rect.height)textRects.push(box(rect))}
   const intersects=r=>Math.min(r.right,closeBox.right)-Math.max(r.left,closeBox.left)>0.1&&Math.min(r.bottom,closeBox.bottom)-Math.max(r.top,closeBox.top)>0.1;
   const css=getComputedStyle(title);return {closeBox,textRects,intersections:textRects.filter(intersects),paddingInlineEnd:parseFloat(css.paddingInlineEnd),lineHeight:parseFloat(css.lineHeight),titleFontSize:parseFloat(css.fontSize),documentOverflow:document.documentElement.scrollWidth>innerWidth,dialogScrollHeight:d.scrollHeight,dialogClientHeight:d.clientHeight};
  });
  assert.equal(geometry.paddingInlineEnd,48,'Final deployed local CSS must reserve 48px for Close.');
  assert.ok(Math.abs(geometry.lineHeight/geometry.titleFontSize-1.25)<.01,'Final local title line-height must be 1.25.');
  assert.ok(geometry.textRects.length>0);assert.deepEqual(geometry.intersections,[],'Title text must not intersect the Close control.');assert.equal(geometry.documentOverflow,false);
  await page.screenshot({path:new URL(`../.sites-runtime/support-dialog-final-${width}-${enlarged?'text200':'normal'}.png`,import.meta.url).pathname,fullPage:false,animations:'disabled'});
  // Enable the action with synthetic input, then inspect hit-testing without
  // clicking it. A disabled button intentionally has pointer-events disabled.
  await dialog.getByLabel('Request title',{exact:true}).fill('Synthetic layout verification');
  await dialog.getByLabel('Request description',{exact:true}).fill('Only fictional local layout verification; this request is never submitted.');
  await dialog.getByRole('checkbox',{name:'I understand the request audience and kept private records out.',exact:true}).check();
  const submit=dialog.getByRole('button',{name:'Submit help request',exact:true});assert.equal(await submit.isEnabled(),true);await submit.scrollIntoViewIfNeeded();
  const reachable=await submit.evaluate(el=>{const b=el.getBoundingClientRect(),x=(b.left+b.right)/2,y=(b.top+b.bottom)/2,hit=document.elementFromPoint(x,y);return {rect:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},inViewport:x>=0&&x<innerWidth&&y>=0&&y<innerHeight,hitSelf:!!hit&&(hit===el||el.contains(hit))}});
  assert.equal(reachable.inViewport,true);assert.equal(reachable.hitSelf,true,'Bottom action must be reachable without an overlay obscuring it.');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await opener.waitFor();
  const focusRestored=await opener.evaluate(el=>document.activeElement===el);assert.equal(focusRestored,true,'Escape must restore Request help focus.');
  checks.push({width,enlarged,...font,...geometry,bottomActionReachable:reachable,escapeRestoresOpener:focusRestored});
 }
 assert.deepEqual(errors,[]);
 const result={passed:true,fixtureId:id,exactFinalTitleCSSVerified:true,titleTextDoesNotIntersectClose:true,bottomActionsReachable:true,escapeRestoresRequestHelp:true,checks,pageErrors:errors,limits:['Synthetic local loopback fixture only','Focused CSS regression; prior full support and race results remain separate']};
 writeFileSync(new URL('../.sites-runtime/support-dialog-final.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} catch(error) {writeFileSync(new URL('../.sites-runtime/support-dialog-final.json',import.meta.url),JSON.stringify({passed:false,fixtureId:id,error:String(error),checks,pageErrors:errors},null,2));throw error}
finally {await browser.close()}
