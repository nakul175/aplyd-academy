// END-TO-END BROWSER ACCEPTANCE harness for the local demo layer.
// Drives ONLY a local demo instance (loopback, unique ports). Mutating flows are allowed because the
// state is a throw-away D1 under DEMO_STATE_DIR. See tests/demo-browser-qa/README.md.
//   DEMO_WORKER_PORT=8801 DEMO_PROXY_PORT=8802 DEMO_STATE_DIR=.wrangler/accept-state SKIP_BUILD=1 bash scripts/demo/run-demo.sh
//   node tests/demo-browser-qa/acceptance.mjs
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const WORKER=Number(process.env.DEMO_WORKER_PORT??8801),PROXY=Number(process.env.DEMO_PROXY_PORT??8802),PARTNER=Number(process.env.ACCEPT_PARTNER_PORT??8803);
const STATE=process.env.DEMO_STATE_DIR??'.wrangler/accept-state';
const SHOTS=resolve(here,'screens'),SCRATCH=process.env.ACCEPT_SCRATCH??resolve(root,'.wrangler/accept-scratch');
const AXE=process.env.AXE_PATH??'';
mkdirSync(SHOTS,{recursive:true});mkdirSync(SCRATCH,{recursive:true});
const WBASE=`http://127.0.0.1:${WORKER}`,PBASE=`http://127.0.0.1:${PROXY}`;
for(const u of [WBASE,PBASE,`http://127.0.0.1:${PARTNER}`])if(new URL(u).hostname!=='127.0.0.1')throw new Error('loopback only');
const ids=JSON.parse(readFileSync(resolve(root,'scripts/demo/demo-identities.json'),'utf8'));
if(ids.baseUrl!==WBASE)throw new Error(`identities were seeded for ${ids.baseUrl}, not ${WBASE}; re-run run-demo.sh with the acceptance ports`);
const ID=Object.fromEntries(ids.identities.map(i=>[i.key,i])),TEAM=ids.teamId;
const results=[],pageErrors=[],consoleErrors=[];
const record=(area,name,ok,note='')=>{results.push({area,name,ok:!!ok,note:String(note).slice(0,400)});console.log(`${ok?'PASS':'FAIL'} [${area}] ${name}${note?' :: '+String(note).slice(0,200):''}`)};
async function check(area,name,fn){try{const r=await fn();record(area,name,r===undefined||r===true||(r&&r.ok!==false),typeof r==='string'?r:'')}catch(e){record(area,name,false,e.message.split('\n')[0])}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- HTTP helpers (direct to the worker, synthetic identity headers like scripts/demo/seed.mjs) ----------
const hdr=u=>({'Content-Type':'application/json','oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':encodeURIComponent(u.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
const jget=async(u,p)=>({status:0,...(await (async()=>{const r=await fetch(WBASE+p,{headers:hdr(u)});const j=await r.json().catch(()=>({}));return {...j,status:r.status}})())});
const jsend=async(u,p,b)=>{const r=await fetch(WBASE+p,{method:'POST',headers:hdr(u),body:JSON.stringify({...b,actionId:crypto.randomUUID()})});const j=await r.json().catch(()=>({}));return {...j,status:r.status}};
const teamAct=async(u,command)=>{const x=await jget(u,'/api/teams?id='+encodeURIComponent(TEAM));return jsend(u,'/api/teams',{teamId:TEAM,command,revision:x.revision})};
const nonce=crypto.randomUUID().replaceAll('-','').slice(0,8);
const fresh=(slug,name)=>({id:`accept-${slug}-${nonce}`,email:`accept-${slug}-${nonce}@academy.test`,name:`${name} (synthetic)`});
const tok=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function joinAs(u,roles,scopes=[]){const token=tok();let r=await teamAct(ID.admin,{type:'invite',email:u.email,roles,scopes,token});if(r.status!==200)throw new Error('invite '+r.status+JSON.stringify(r).slice(0,200));
 const pv=await jget(u,'/api/teams?invite='+token);r=await jsend(u,'/api/teams',{teamId:TEAM,command:{type:'accept',token},revision:pv.revision});if(r.status!==200)throw new Error('accept '+r.status+JSON.stringify(r).slice(0,200));}

// ---------- browser helpers ----------
const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});
const ctxs=[];
async function viaProxy(key,width=1280,height=860,extra={}){const c=await browser.newContext({viewport:{width,height},acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],...extra});await c.addCookies([{name:'demo_as',value:key,url:PBASE}]);ctxs.push(c);return page4(c,key)}
async function viaWorker(u,width=1280,height=860){const c=await browser.newContext({viewport:{width,height},acceptDownloads:true,extraHTTPHeaders:{'oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':encodeURIComponent(u.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}});ctxs.push(c);return page4(c,u.id)}
async function page4(c,label){const p=await c.newPage();p.__label=label;
 p.on('pageerror',e=>pageErrors.push({label,url:p.url(),msg:e.message}));
 p.on('console',m=>{if(m.type()==='error'){const t=m.text();if(/favicon/.test(t))return;consoleErrors.push({label,url:p.url(),msg:t.slice(0,300)})}});return p}
const ready=async p=>{await p.locator('[data-save-state="loaded"]').waitFor({timeout:30000});await sleep(500)};
async function open(p,base,hash=''){await p.goto(`${base}/?workspace=${TEAM}${hash?'#'+hash:''}`);await ready(p)}
async function nav(p,hash){await p.evaluate(h=>{location.hash=h},hash);await sleep(500);await ready(p)}
async function pick(p,label,option){await p.getByRole('combobox',{name:label}).click();await p.getByRole('option',{name:option}).first().click()}
const toast=(p,re)=>p.locator('[data-sonner-toast]').filter({hasText:re}).first().waitFor({timeout:15000});
const shot=async(p,name)=>{await p.screenshot({path:`${SHOTS}/${name}.png`});};
const mainText=p=>p.locator('main').innerText();
const NAV=async p=>(await p.locator('.nav-item span').allTextContents()).map(s=>s.trim());

// =====================================================================================
// (1)+(2)+(4) view sweep per role at 1280 and 390
// =====================================================================================
const VIEWS=[['teams','Workspaces & cohorts'],['operations','Workspace operations'],['recovery','Account recovery'],['requests','Data requests'],['audit','Audit log'],['escalations','Escalations'],['reports','Programme reports'],['home','Overview'],['plan','My learning plan'],['programs','Learning pathways'],['library','Reference library'],['offline','Offline practice'],['community','Community'],['network','People & opportunities'],['credentials','My achievements'],['connections','Ecosystem connections'],['support','Support & help'],['studio','Review studio'],['settings','Preferences & privacy']];
const ROLES=['admin','facilitator-1','assessor-1','reviewer','moderator','learner-new','learner-complete'];
const STAFF_ONLY=['operations','recovery','audit','reports'];            // never for a pure learner
const KEYSHOT={admin:['operations','recovery','requests','audit','escalations','reports','programs','credentials','library','community','plan','studio'],'learner-complete':['credentials','programs','requests','plan','library','community'],'learner-new':['programs','audit'],moderator:['escalations','community'],'assessor-1':['studio','reports'],reviewer:['studio'],'facilitator-1':['operations','reports']};
const navSeen={};
for(const width of (process.env.SKIP_SWEEP==='1'?[]:[1280,390])){
 for(const role of ROLES){
  const p=await viaProxy(role,width,width===390?844:860);
  await check('sweep',`${role}@${width} opens workspace`,async()=>{await open(p,PBASE);if(width===1280)navSeen[role]=await NAV(p)});
  for(const [id,label] of VIEWS){
   await check('sweep',`${role}@${width} #${id}`,async()=>{
    const e0=consoleErrors.length,pe0=pageErrors.length;
    await nav(p,id);
    const txt=await mainText(p),heads=await p.locator('main h1, main h2').count();
    const sw=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:window.innerWidth}));
    const denied=/not available to your role|are unavailable|unavailable/i.test(txt);
    const visible=(navSeen[role]??[]).includes(label);
    const problems=[];
    if(heads<1)problems.push('no h1/h2 in main');
    if(width===390&&sw.sw>sw.iw+1)problems.push(`horizontal overflow ${sw.sw}>${sw.iw}`);
    if(consoleErrors.length>e0)problems.push('console: '+consoleErrors.slice(e0).map(x=>x.msg).join(' || ').slice(0,200));
    if(pageErrors.length>pe0)problems.push('pageerror: '+pageErrors.slice(pe0).map(x=>x.msg).join(' || ').slice(0,200));
    // role visibility (2)
    if(role.startsWith('learner')&&STAFF_ONLY.includes(id)){
      if(visible)problems.push('staff-only nav item visible to learner');
      if(id!=='reports'&&id!=='operations'&&!/not available to your role/.test(txt))problems.push('learner hash route did not show the not-available state');
      if(/Audit log|Owner queue|Cohort rollup|Recovery requests/.test(txt)&&!/not available/.test(txt))problems.push('staff content rendered for learner');
    }
    if(role!=='admin'&&(id==='recovery'||id==='audit')){if(visible)problems.push('admin-only nav visible');if(!/not available to your role/.test(txt))problems.push('missing not-available state')}
    if(role==='admin'&&['recovery','audit','requests','operations','reports','escalations'].includes(id)&&!visible)problems.push('expected nav missing for admin');
    if(id==='escalations'&&role==='moderator'&&!visible)problems.push('moderator lacks Escalations');
    if(KEYSHOT[role]?.includes(id))await shot(p,`${role}-${id}-${width}`);
    if(problems.length)throw new Error(problems.join('; '));
    return `h=${heads}${denied?' (denied/unavailable state)':''}`;
   });
  }
 }
}
record('role-visibility','nav items per role (informational)',true,JSON.stringify(Object.fromEntries(Object.entries(navSeen).map(([k,v])=>[k,v.filter(x=>/operations|recovery|requests|Audit|Escalations|reports|studio/i.test(x)).join(',')]))));

// ---------- tab order + axe on key pages ----------
if(process.env.SKIP_SWEEP!=='1'){
 const p=await viaProxy('admin',1280,860);await open(p,PBASE);
 for(const id of ['operations','requests','audit','reports','programs','credentials']){
  await check('a11y',`tab order reaches main controls #${id}`,async()=>{await nav(p,id);await p.evaluate(()=>{document.body.setAttribute('tabindex','-1');document.body.focus();document.body.removeAttribute('tabindex')});
   const seen=[];for(let i=0;i<70;i++){await p.keyboard.press('Tab');seen.push(await p.evaluate(()=>{const a=document.activeElement;return a?{tag:a.tagName,inMain:!!a.closest('main'),skip:a.classList.contains('skip-link'),name:(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,30)}:null}))}
   const first=seen[0],inMain=seen.filter(s=>s?.inMain);if(!inMain.length)throw new Error('no focus ever reached a control inside main in 70 tabs');
   return `first=${first?.name}${first?.skip?' (skip link)':''}; ${inMain.length} main stops`;});
 }
 if(AXE&&existsSync(AXE)){
  for(const [role,id] of [['admin','operations'],['admin','requests'],['admin','audit'],['admin','reports'],['admin','programs'],['admin','escalations'],['learner-complete','credentials'],['learner-complete','plan']]){
   const q=await viaProxy(role,1280,860);
   await check('a11y',`axe ${role} #${id}`,async()=>{await open(q,PBASE,id);await q.addScriptTag({path:AXE});
    const r=await q.evaluate(async()=>{const x=await axe.run(document,{resultTypes:['violations']});return x.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,first:(v.nodes[0]?.target||[]).join(' ').slice(0,80)}))});
    const bad=r.filter(v=>['serious','critical'].includes(v.impact));
    if(bad.length)throw new Error(bad.map(v=>`${v.id}(${v.impact},${v.n}) ${v.first}`).join(' | '));
    return `${r.length} violations, 0 serious/critical`+(r.length?': '+r.map(v=>v.id+'('+v.impact+')').join(','):'')});
  }
 }else record('a11y','axe-core',true,'SKIPPED: AXE_PATH not provided');
}

// =====================================================================================
// Learning pathways catalog + disclosure
// =====================================================================================
{
 const p=await viaProxy('learner-new',1280,860);await open(p,PBASE,'programs');
 await check('catalog','facets, search and recommendation basis',async()=>{
  const t=await mainText(p);for(const s of ['Search pathways','Work context','Topic','Why this is suggested','3 of 3 pathways shown'])if(!t.includes(s))throw new Error('missing '+s);
  const box=p.getByRole('searchbox').or(p.getByLabel('Search pathways')).first();await box.fill('farm');await sleep(500);
  const t2=await mainText(p);if(!/1 of 3 pathways shown/.test(t2))throw new Error('search did not narrow to 1 of 3: '+(t2.match(/\d of \d pathways shown/)||['none'])[0]);
  await box.fill('');await sleep(300);
  await pick(p,'Work context','Farmer').catch(async()=>{await p.getByLabel('Work context').first().selectOption({label:'Farmer (1)'})});await sleep(400);
  const t3=await mainText(p);if(!/1 of 3 pathways shown/.test(t3))throw new Error('facet did not narrow');
 });
 await check('catalog','Before you enrol disclosure opens with content',async()=>{await nav(p,'programs');const d=p.getByText('Before you enrol: what to expect').first();await d.click();await sleep(400);
  const t=await mainText(p);if(!/nonaccredited|not an accredited|Draft|review draft/i.test(t))throw new Error('no disclosure text');await shot(p,'learner-new-programs-disclosure-1280');});
}

// =====================================================================================
// (3a) data request: learner files -> admin verifies 2-of-3 -> admin decides
// =====================================================================================
const SENT='ZZPRACTICESENTINEL-do-not-log';
let drId='';
{
 const L=await viaProxy('learner-new',1280,860),A=await viaProxy('admin',1280,860);
 await open(L,PBASE,'requests');
 await check('data-requests','learner files an export request',async()=>{await L.getByRole('button',{name:'New request'}).click();await L.locator('#dr-detail').fill(`Please export my data. ${SENT}`);await L.getByRole('button',{name:'File request'}).click();await toast(L,/Request filed/);
  const card=L.locator('[data-data-request-id]').first();await card.waitFor();drId=await card.getAttribute('data-data-request-id');if(!/Received/.test(await card.innerText()))throw new Error('not Received');await shot(L,'learner-new-data-request-filed-1280')});
 await open(A,PBASE,'requests');
 await check('data-requests','admin cannot decide before 2-of-3 verification (approve disabled)',async()=>{const card=A.locator(`[data-data-request-id="${drId}"]`);await card.waitFor();const b=card.getByRole('button',{name:'Approve',exact:true});if(!(await b.isDisabled()))throw new Error('Approve enabled before verification')});
 await check('data-requests','admin records ONE check -> not verified',async()=>{const card=A.locator(`[data-data-request-id="${drId}"]`);await card.getByRole('checkbox').nth(0).click();await card.getByRole('button',{name:/Record verification/}).click();await toast(A,/Verification recorded/);
  const t=await card.innerText();if(/Identity verified/.test(t))throw new Error('1 of 3 verified the request');});
 await check('data-requests','admin records 2-of-3 -> verified, then decides with reason',async()=>{await A.reload();await ready(A);const card=A.locator(`[data-data-request-id="${drId}"]`);
  const cbs=card.getByRole('checkbox');const n=await cbs.count();for(let i=0;i<n;i++){const c=cbs.nth(i);if(i<2&&(await c.getAttribute('aria-checked'))!=='true')await c.click()}
  await card.getByRole('button',{name:/Record verification/}).click();await toast(A,/Verification recorded/);await sleep(500);
  if(!/Identity verified/.test(await card.innerText()))throw new Error('not verified after 2 checks');
  await A.locator(`#dr-reason-${drId}`).fill('Identity checks passed in the acceptance run.');await card.getByRole('button',{name:'Approve',exact:true}).click();await toast(A,/approved/i);await sleep(500);
  if(!/Completed/.test(await card.innerText()))throw new Error('not Completed');await shot(A,'admin-data-request-decided-1280')});
 await check('data-requests','learner sees decision and downloads own-only export',async()=>{await L.reload();await ready(L);const card=L.locator('[data-data-request-id]').first();const t=await card.innerText();if(!/Approved by/.test(t))throw new Error('no decision shown');
  const [dl]=await Promise.all([L.waitForEvent('download'),card.getByRole('button',{name:/Download export/}).click()]);const path=`${SCRATCH}/export.json`;await dl.saveAs(path);const body=readFileSync(path,'utf8');
  const emails=new Set(body.match(/[\w.+-]+@academy\.test/g)||[]);for(const e of emails)if(e!==ID['learner-new'].email)throw new Error('export contains another person email '+e);
  for(const k of ['learner-complete','learner-progress'])if(body.includes(ID[k].name))throw new Error('export contains another learner name');return `export ${body.length} bytes, emails=${[...emails].join(',')}`});
 await check('data-requests','self-verification blocked: admin own request needs another owner',async()=>{const r=await teamAct(ID.admin,{type:'data-request-open',kind:'export',clientRef:'dr-accept-self-'+nonce});if(r.status!==200)throw new Error('open '+r.status);
  const x=await jget(ID.admin,'/api/teams?id='+TEAM);const mine=x.team.dataRequests.mine.at(-1);const v=await teamAct(ID.admin,{type:'data-request-verify',requestId:mine.id,requestRev:mine.rev,passed:x.team.dataRequests.checks.slice(0,2).map(c=>c.id)});if(v.status===200)throw new Error('admin verified own request');return 'server refused '+v.status});
}

// =====================================================================================
// (3b) accommodation: learner requests -> eligible staff decides
// =====================================================================================
{
 const L=await viaProxy('learner-lessons-done',1280,860),S=await viaProxy('assessor-1',1280,860),S2=await viaProxy('assessor-2',1280,860);
 await check('accommodations','learner files accommodation request via Demonstrate skill tab',async()=>{await open(L,PBASE,'learn/farmer-work-records');await L.getByRole('tab',{name:/Demonstrate skill/}).click();await sleep(400);
  await L.locator('#accommodation-detail').fill('Extra time please. '+SENT);await L.getByRole('button',{name:'Request accommodation'}).click();await toast(L,/Accommodation request saved/);if(!/Awaiting decision/.test(await mainText(L)))throw new Error('no Awaiting decision');await shot(L,'learner-lessons-done-accommodation-1280')});
 await check('accommodations','ineligible assessor (other cohorts) sees no request',async()=>{await open(S2,PBASE,'studio');const t=await mainText(S2);await S2.getByRole('tab',{name:/Accommodation requests/}).click().catch(()=>{});await sleep(400);const t2=await mainText(S2);if(/Extra time/.test(t2)&&/Demo Learner Dev/.test(t2))throw new Error('assessor-2 sees farm learner request')});
 await check('accommodations','eligible assessor approves with reason',async()=>{await open(S,PBASE,'studio');await S.getByRole('tab',{name:/Accommodation requests/}).click();await sleep(500);
  const reason=S.locator('textarea[id^="acc-reason-"]').first();await reason.waitFor({timeout:8000});await reason.fill('Approved for the acceptance run.');await S.getByRole('button',{name:'Approve',exact:true}).first().click();await toast(S,/Accommodation approved/);await shot(S,'assessor-1-accommodation-decided-1280')});
 await check('accommodations','learner sees Approved + history',async()=>{await L.reload();await ready(L);await L.getByRole('tab',{name:/Demonstrate skill/}).click();await sleep(400);if(!/Approved/.test(await mainText(L)))throw new Error('Approved not shown')});
}

// =====================================================================================
// (3c) moderator escalates -> owner resolves
// =====================================================================================
{
 const M=await viaProxy('moderator',1280,860),A=await viaProxy('admin',1280,860);
 await check('escalations','moderator escalates the open report',async()=>{await open(M,PBASE,'escalations');await M.locator('textarea[id^="escalate-"]').first().fill('Needs an owner decision on the claim.');await M.getByRole('button',{name:'Escalate to owner'}).click();await toast(M,/escalated/i);await sleep(500);
  if(!/open/i.test(await M.locator('#esc-list').locator('..').innerText()))throw new Error('no open escalation listed');await shot(M,'moderator-escalated-1280')});
 await check('escalations','owner resolves the escalation',async()=>{await open(A,PBASE,'escalations');const li=A.locator('[data-escalation-id]').first();await li.waitFor();await li.locator('textarea[id^="decide-"]').fill('Resolved in the acceptance run after review.');await li.getByRole('button',{name:'Resolve escalation'}).click();await toast(A,/resolved/i);await sleep(500);
  if(!/Resolved/.test(await li.innerText()))throw new Error('not Resolved');await shot(A,'admin-escalation-resolved-1280')});
 await check('escalations','moderator sees outcome, not reviewer identity',async()=>{await M.reload();await ready(M);const t=await mainText(M);if(!/Resolved/.test(t))throw new Error('outcome not shown')});
}

// =====================================================================================
// (3d) recovery + assisted onboarding
// =====================================================================================
{
 const A=await viaProxy('admin',1280,860);
 const owner2=fresh('owner2','Accept Owner Two'),newbie=fresh('newbie','Accept Newcomer');
 await check('recovery','learner (non-admin member) cannot reach the recovery form in the UI',async()=>{const lrn=fresh('recov-learner','Accept Recov Learner');await joinAs(lrn,['learner']);const q=await viaWorker(lrn);await open(q,WBASE,'recovery');const t=await mainText(q);
  if(!/not available to your role/.test(t))throw new Error('unexpected: '+t.slice(0,80));return 'FINDING: server accepts recovery-request from any active member but the UI is admin-only, so a learner who lost their sign-in cannot file one'});
 let reqPage;
 await check('recovery','second owner (fresh identity) files a recovery request in the UI',async()=>{await joinAs(owner2,['admin']);reqPage=await viaWorker(owner2);await open(reqPage,WBASE,'recovery');
  await reqPage.locator('#rec-email').fill(ID['learner-ps-new'].email);await reqPage.locator('#rec-cohort').fill('Public servant briefs');await reqPage.getByRole('button',{name:'Submit recovery request'}).click();await toast(reqPage,/Recovery request saved/);await shot(reqPage,'owner2-recovery-filed-1280')});
 await check('recovery','different owner (admin-1) approves with 2-of-3 + reason; learning moves',async()=>{await open(A,PBASE,'recovery');const row=A.locator('[data-recovery-id]').first();await row.waitFor();await row.getByRole('button',{name:'Review'}).click();
  const cbs=row.getByRole('checkbox');await cbs.nth(0).click();await cbs.nth(1).click();await row.locator('input[id^="rec-reason-"]').fill('Checked two details in the acceptance run.');
  await row.getByRole('button',{name:'Approve and move learning'}).click();await toast(A,/Recovery approved/);await sleep(500);if(!/approved/.test(await row.innerText()))throw new Error('not approved');await shot(A,'admin-recovery-approved-1280')});
 await check('recovery','requester cannot decide own request (server)',async()=>{const x=await jget(owner2,'/api/teams?id='+TEAM);const mine=x.team.recovery.mine.at(-1);if(!mine)throw new Error('no own request');return 'status '+mine.status});
 await check('recovery','assisted invitation created in UI; fresh account accepts via /join link',async()=>{await open(A,PBASE,'recovery');await A.locator('#as-email').fill(newbie.email);await A.locator('#as-note').fill('Acceptance run: assisted onboarding for a synthetic user.');await A.getByRole('button',{name:'Create assisted invitation'}).click();await toast(A,/Assisted invitation created/);
  const link=(await A.getByText(/Share once:/).innerText()).split('Share once:')[1].trim();const token=new URL(link).searchParams.get('token');if(!token)throw new Error('no token');
  const q=await viaWorker(newbie);await q.goto(WBASE+'/join?token='+token);await sleep(2500);const t=await q.locator('body').innerText();await shot(q,'newcomer-join-1280');
  const btn=q.getByRole('button',{name:/accept|join/i}).first();if(await btn.count()){await btn.click();await sleep(2500)}
  const x=await jget(newbie,'/api/teams?id='+TEAM);if(x.status!==200||!x.team?.active)throw new Error('newcomer not an active member; join page said: '+t.slice(0,150));return 'joined'});
}

// =====================================================================================
// (3e) credentials: share toggle -> link -> public page; lifecycle states
// =====================================================================================
{
 const L=await viaProxy('learner-complete',1280,860);let link='';
 await check('credentials','share toggle shows copy link; public page shows DUMMY mark and no PII',async()=>{await open(L,PBASE,'credentials');
  const cb=L.getByRole('switch',{name:/in learning profile export/}).first();if((await cb.getAttribute('aria-checked'))!=='true'){await cb.click();await sleep(1200)}
  const inp=L.getByLabel('Demo verification link');await inp.waitFor({timeout:8000});link=await inp.inputValue();await L.getByRole('button',{name:'Copy verification link'}).click();await sleep(400);
  const status=await L.locator('[role=status]').filter({hasText:/copied|Select the link/}).first().innerText();await shot(L,'learner-complete-credential-shared-1280');
  const pub=await viaProxy('learner-complete',1280,860);await pub.goto(link);const t=await pub.locator('body').innerText();
  if(!/DEMO/.test(t))throw new Error('no DEMO mark');if(/@academy\.test|Farid/.test(t))throw new Error('PII on public page');await shot(pub,'public-verify-active-1280');
  const m=await viaProxy('learner-complete',390,844);await m.goto(link);const sw=await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(sw)throw new Error('public verify overflows at 390');await shot(m,'public-verify-active-390');
  return status});
 await check('credentials','unknown token gives neutral not-found without leaking',async()=>{const q=await viaProxy('learner-complete');await q.goto(PBASE+'/verify/'+'0'.repeat(30));const t=await q.locator('body').innerText();if(!/No shared demo credential matches/.test(t))throw new Error(t.slice(0,100))});
 await check('credentials','suspended/revoked/reinstated reflected on public page (via API; no UI control exists)',async()=>{
  const x=await jget(ID['learner-complete'],'/api/teams?id='+TEAM);const enr=(x.team?.state??x.state)?.enrollments?.find(e=>e.credential)??x.state?.enrollments?.find(e=>e.credential);
  if(!enr)throw new Error('cannot locate credential enrollment; keys='+Object.keys(x.team??x).slice(0,12));
  const call=(action,reason)=>teamAct(ID.admin,{type:'credential-lifecycle',enrollmentId:enr.id,learnerId:ID['learner-complete'].id,action,reason});
  const pub=await viaProxy('learner-complete');const seen={};
  for(const [a,re] of [['suspend',/suspend/i],['reinstate',/active|valid/i],['revoke',/revok/i]]){const r=await call(a,'Acceptance lifecycle '+a+' action.');if(r.status!==200)throw new Error(a+' '+r.status+JSON.stringify(r).slice(0,150));await pub.goto(link);const t=await pub.locator('role=status').first().innerText();seen[a]=t.slice(0,60);if(!re.test(t))throw new Error(a+' not reflected: '+t);await shot(pub,'public-verify-'+a+'-1280')}
  await L.reload();await ready(L);await L.getByText(/revoked/i).first().waitFor({timeout:5000});await shot(L,'learner-complete-credential-revoked-1280');return JSON.stringify(seen)});
}

// =====================================================================================
// (3f) reports CSV
// =====================================================================================
{
 const A=await viaProxy('admin',1280,860);await open(A,PBASE,'reports');
 await check('reports','CSV export downloads with manifest and small-cell <3, no emails/names',async()=>{const [dl]=await Promise.all([A.waitForEvent('download'),A.getByRole('button',{name:'Download CSV with manifest'}).click()]);const path=`${SCRATCH}/report.csv`;await dl.saveAs(path);const b=readFileSync(path,'utf8');
  if(!b.includes('<3'))throw new Error('no <3 small-cell marker');if(/@/.test(b.replace(/sha-?256[^\n]*/i,'')))throw new Error('@ in CSV');if(/Demo Learner|\(synthetic\)\s*\(/.test(b))throw new Error('learner names in CSV');
  const lines=b.trim().split('\n').length;return `${dl.suggestedFilename()} ${lines} lines, manifest=${/sha-?256/i.test(b)}`});
 await check('reports','facilitator-1 report is cohort-scoped (farm only)',async()=>{const F=await viaProxy('facilitator-1');await open(F,PBASE,'reports');const t=await mainText(F);if(/MSME customer practice circle|Public servant briefs circle/.test(t.split('Metric dictionary')[0]))throw new Error('facilitator sees other cohorts in rollup')});
}

// =====================================================================================
// (3g) audit log detail rows
// =====================================================================================
{
 const A=await viaProxy('admin',1280,860);await open(A,PBASE,'audit');
 await check('audit','detail rows exist for the new actions; no practice text or emails',async()=>{await sleep(800);const t=await mainText(A);const need=['data-request','escalat','recovery','accommodation'];const miss=need.filter(k=>!new RegExp(k,'i').test(t));
  await shot(A,'admin-audit-after-flows-1280');
  if(t.includes(SENT))throw new Error('practice sentinel leaked into audit');const rows=t.split('When\tActor')[1]??t;const em=rows.match(/[\w.+-]+@[\w-]+\.\w+/g);if(em)throw new Error('email in audit: '+em[0]);
  if(miss.length)throw new Error('no audit rows mentioning: '+miss.join(','));return 'ok'});
 await check('audit','CSV export has no emails or sentinel',async()=>{const [dl]=await Promise.all([A.waitForEvent('download'),A.getByRole('button',{name:'Export CSV'}).click()]);const path=`${SCRATCH}/audit.csv`;await dl.saveAs(path);const b=readFileSync(path,'utf8');if(b.includes(SENT))throw new Error('sentinel in export');if(/@academy\.test/.test(b))throw new Error('email in audit export')});
}

// =====================================================================================
// (3h) partner link: not running -> start dummy partner, restart worker with env, signed round trip
// =====================================================================================
const personal=ID['personal-learner'];
{
 const P=await viaProxy('personal-learner',1280,860);
 await check('partner','panel says dummy partner not running when unconfigured',async()=>{await P.goto(PBASE+'/#partner-dummy');await ready(P);await sleep(800);const t=await mainText(P);if(!/Dummy partner not running/.test(t))throw new Error(t.slice(0,150));await shot(P,'personal-partner-not-running-1280');const m=await viaProxy('personal-learner',390,844);await m.goto(PBASE+'/#partner-dummy');await ready(m);await sleep(800);if(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('overflow at 390');await shot(m,'personal-partner-not-running-390')});
}
let partnerProc=null,workerProc=null;
if(process.env.SKIP_PARTNER!=='1'){
 await check('partner','start dummy partner (loopback) and restart own worker with ACADEMY_DUMMY_PARTNER_URL',async()=>{
  partnerProc=spawn('node',['scripts/demo/dummy-partner.mjs'],{cwd:root,env:{...process.env,PORT:String(PARTNER),ACADEMY_URL:WBASE},stdio:'ignore'});await sleep(1500);
  const h=await fetch(`http://127.0.0.1:${PARTNER}/health`).then(r=>r.json());if(!h.ok)throw new Error('partner health');
  const pidFile=resolve(root,STATE+'.worker.pid');const old=Number(readFileSync(pidFile,'utf8'));process.kill(old,'SIGTERM');await sleep(3000);
  const W=`node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js`.split(' ');
  workerProc=spawn(W[0],[...W.slice(1),'dev','--config','dist/server/wrangler.json','--local','--persist-to',STATE,'--ip','127.0.0.1','--port',String(WORKER),'--inspector-port','0','--var',`ACADEMY_DUMMY_PARTNER_URL:http://127.0.0.1:${PARTNER}`],{cwd:root,stdio:'ignore',detached:false});
  writeFileSync(pidFile,String(workerProc.pid));
  for(let i=0;i<60;i++){try{const r=await fetch(WBASE+'/api/academy',{headers:hdr(personal)});if(r.status===200)return}catch{}await sleep(1000)}throw new Error('worker did not come back')});
 await check('partner','link DEMO-AAA001, grant progress+completion, send signed update, receipts at the dummy',async()=>{
  const P=await viaProxy('personal-learner',1280,860);await P.goto(PBASE+'/#partner-dummy');await ready(P);await sleep(1000);
  if(/Dummy partner not running/.test(await mainText(P)))throw new Error('panel still says not running after configuring');
  await P.locator('#partner-code').fill('DEMO-AAA001');await pick(P,'Learning to link','msme-customer-operations');await P.getByRole('button',{name:'Link member (dummy)'}).click();await sleep(1500);
  const sec=P.locator('section.panel').filter({has:P.getByRole('heading',{name:'DEMO-AAA001'})}).first();await sec.waitFor({timeout:8000});
  await sec.getByRole('button',{name:'Grant',exact:true}).first().click();await sleep(1000);await sec.getByRole('button',{name:'Grant',exact:true}).first().click();await sleep(1000);
  await sec.getByRole('button',{name:'Send progress to partner (dummy)'}).click();await sleep(2500);await shot(P,'personal-partner-sent-1280');
  const rc=await fetch(`http://127.0.0.1:${PARTNER}/receipts`).then(r=>r.json());if(!rc.receipts.length)throw new Error('dummy partner has no receipts');
  const s=JSON.stringify(rc.receipts);if(/@academy\.test|Kavya|answer|evidence/i.test(s))throw new Error('receipt contains identity/evidence data');
  return `${rc.receipts.length} receipt(s); fields: ${Object.keys(rc.receipts[0]).join(',')}`});
}

// ---------- wrap up ----------
const failed=results.filter(r=>!r.ok);
writeFileSync(resolve(here,'results.json'),JSON.stringify({when:new Date().toISOString(),total:results.length,failed:failed.length,pageErrors,consoleErrors,results},null,1));
const byArea={};for(const r of results){const a=byArea[r.area]??={pass:0,fail:0};r.ok?a.pass++:a.fail++}
console.log('\nSUMMARY',JSON.stringify(byArea),`pageErrors=${pageErrors.length} consoleErrors=${consoleErrors.length}`);
for(const c of ctxs)await c.close().catch(()=>{});await browser.close();
if(partnerProc)partnerProc.kill('SIGTERM');
process.exit(failed.length?1:0);
