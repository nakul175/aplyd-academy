import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const app=resolve(process.env.ACADEMY_APP_PATH??'.');
const qa=await import(pathToFileURL(resolve(app,'tests/local-qa.mjs')).href);
const {base,curriculum,identity,headers,get,fixture,current,action}=qa;
const {chromium}=await import(pathToFileURL(process.env.ACADEMY_PLAYWRIGHT_MODULE??'/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const artifactDir=resolve(process.env.ACADEMY_QA_OUTPUT??resolve(app,'.sites-runtime'));
mkdirSync(artifactDir,{recursive:true});

/** Only adapt this block if reviewed UI copy changes; keep behavioral assertions intact. */
const ui={
  nav:'My learning plan',heading:'My learning plan',goalTheme:'Goal theme',goalOption:'Write a clearer response',
  personalGoal:'My personal work goal',weeklyMinutes:'Weekly learning minutes',timeZone:'Plan timezone',
  reminders:'Show in-app learning reminders',savePreferences:'Save learning plan',add:'Add practice activity',
  dialog:'Add a planned activity',kind:'Activity type',enrollment:'Enrollment for activity',lesson:'Lesson for activity',
  practiceKind:'Private practice',lessonKind:'Lesson',practicalKind:'Practical submission',reflectionKind:'Work reflection',
  title:'Practice activity title',date:'Planned date (optional)',minutes:'Planned minutes',note:'Private planning note',
  saveTask:'Save planned activity',completePractice:'Mark practice complete',edit:'Edit planned activity',
  openLearning:'Open planned learning',cancel:'Cancel',reminderSelector:'.plan-reminder',taskSelector:'[data-plan-task-id]',
};
let checks=0,error,contexts=[];const pageErrors=[],postRequests=[],coverage=[],layout=[];
const equal=(a,b)=>{assert.deepEqual(a,b);checks++};
const truth=(v,label)=>{assert.ok(v,label);checks++};
const p=curriculum.pathways[1],u=identity('plan-browser'),nonce=crypto.randomUUID();
const goal='PRIVATE-BROWSER-GOAL-'+nonce,note='PRIVATE-BROWSER-NOTE-'+nonce;
const browser=await chromium.launch({executablePath:process.env.ACADEMY_CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
async function pageFor(person){
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers(person)});contexts.push(context);
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST')postRequests.push(r.url());});
  return page;
}
const read=u=>get(u,'/api/academy');
async function labAction(command){
  const current=await read(u);equal(current.status,200);
  const r=await fetch(base+'/api/academy',{method:'POST',headers:headers(u),body:JSON.stringify({command,revision:current.revision,actionId:crypto.randomUUID()})});
  const x={status:r.status,...await r.json()};equal(x.status,200);return x;
}
async function uiWrite(page,work){
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&['/api/academy','/api/teams'].includes(new URL(r.url()).pathname));
  await work();const r=await response,x=await r.json();equal(r.status(),200);return x;
}
async function select(page,label,option){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click();}
async function setReminders(page,enabled){const control=page.getByRole('switch',{name:ui.reminders,exact:true});if((await control.getAttribute('aria-checked')==='true')!==enabled)await control.click();}
async function openPlan(page){await page.getByRole('button',{name:ui.nav,exact:true}).first().click();await page.getByRole('heading',{name:ui.heading,exact:true}).waitFor();}
const taskRow=(page,id)=>page.locator(`[data-plan-task-id="${id}"]`);
async function addTask(page,kind,{title,dueDate='',minutes='15',privateNote='',lesson}={}){
  await page.getByRole('button',{name:ui.add,exact:true}).click();await page.getByRole('dialog',{name:ui.dialog,exact:true}).waitFor();
  if(kind!==ui.practiceKind)await select(page,ui.kind,kind);
  if(kind===ui.practiceKind)await page.getByLabel(ui.title,{exact:true}).fill(title);
  else {await select(page,ui.enrollment,p.title);if(kind===ui.lessonKind)await select(page,ui.lesson,lesson);}
  await page.getByLabel(ui.date,{exact:true}).fill(dueDate);await page.getByLabel(ui.minutes,{exact:true}).fill(minutes);await page.getByLabel(ui.note,{exact:true}).fill(privateNote);
  const x=await uiWrite(page,()=>page.getByRole('button',{name:ui.saveTask,exact:true}).click());
  await page.getByRole('dialog',{name:ui.dialog,exact:true}).waitFor({state:'hidden'});
  const t=x.state.learningPlan.tasks.at(-1);await taskRow(page,t.id).waitFor();return t;
}
async function finishVisibleLesson(page,lesson){
  await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
  await page.getByLabel('Your corrected work and reasoning',{exact:true}).fill('I checked the fictional source packet, removed unsupported promises and kept the human approval route.');
  for(const q of lesson.quiz)await page.getByRole('radiogroup',{name:q.question,exact:true}).getByRole('radio',{name:q.options[q.correctOptionIndex],exact:true}).click();
  await page.getByRole('button',{name:'Check my answers',exact:true}).click();
  await uiWrite(page,()=>page.getByRole('button',{name:'Complete lesson',exact:true}).click());
  await page.getByRole('button',{name:'Next step',exact:true}).click();
}

try{
  let x=await labAction({type:'enroll',programId:p.id}),eid=x.state.enrollments[0].id;
  const first=p.lessons[0];await labAction({type:'lesson',enrollmentId:eid,lessonId:first.id,practice:'A checked synthetic practice answer uses the source references and keeps human approval.',answers:first.quiz.map(q=>q.correctOptionIndex)});
  const page=await pageFor(u);await page.goto(base+'/');await page.locator('[data-save-state="loaded"]').waitFor();await openPlan(page);
  await select(page,ui.goalTheme,ui.goalOption);await page.getByLabel(ui.personalGoal,{exact:true}).fill(goal);
  await page.getByLabel(ui.weeklyMinutes,{exact:true}).fill('45');await page.getByLabel(ui.timeZone,{exact:true}).fill('Asia/Kolkata');await setReminders(page,false);
  await uiWrite(page,()=>page.getByRole('button',{name:ui.savePreferences,exact:true}).click());
  const practice=await addTask(page,ui.practiceKind,{title:'Check my fictional customer draft',privateNote:note});equal(practice.dueDate,null);
  await page.reload();await page.locator('[data-save-state="loaded"]').waitFor();await page.getByRole('heading',{name:ui.heading,exact:true}).waitFor();
  equal(await page.getByLabel(ui.personalGoal,{exact:true}).inputValue(),goal);equal(await page.getByLabel(ui.weeklyMinutes,{exact:true}).inputValue(),'45');equal(await page.getByLabel(ui.timeZone,{exact:true}).inputValue(),'Asia/Kolkata');
  truth((await taskRow(page,practice.id).innerText()).includes(note));truth((await taskRow(page,practice.id).innerText()).includes('Unscheduled'));
  coverage.push('Personal preferences and nullable private activity persist across reload');

  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const dated=`${today.find(p=>p.type==='year').value}-${today.find(p=>p.type==='month').value}-${today.find(p=>p.type==='day').value}`;
  const linked=await addTask(page,ui.lessonKind,{lesson:p.lessons[1].title,dueDate:dated,privateNote:'Synthetic course plan note'});equal(linked.enrollmentId,eid);equal(linked.lessonId,p.lessons[1].id);
  await setReminders(page,true);await uiWrite(page,()=>page.getByRole('button',{name:ui.savePreferences,exact:true}).click());
  await page.locator(ui.reminderSelector).waitFor();truth((await page.locator(ui.reminderSelector).innerText()).includes('This notice appears when Academy is open.'));
  await setReminders(page,false);await uiWrite(page,()=>page.getByRole('button',{name:ui.savePreferences,exact:true}).click());await page.locator(ui.reminderSelector).waitFor({state:'hidden'});
  const persisted=await read(u);equal(persisted.state.learningPlan.remindersEnabled,false);truth(persisted.state.learningPlan.tasks.some(t=>t.id===linked.id));equal(persisted.state.deliveries.length,0);
  coverage.push('Optional due notices appear only in Academy and can be turned off without deleting tasks');

  const before=structuredClone(persisted.state.enrollments);
  await uiWrite(page,()=>taskRow(page,practice.id).getByRole('button',{name:ui.completePractice,exact:true}).click());
  await taskRow(page,practice.id).getByText('Self-reported practice',{exact:true}).waitFor();equal((await read(u)).state.enrollments,before);
  coverage.push('Manual practice completion changes only the private plan');

  await taskRow(page,linked.id).getByRole('button',{name:ui.edit,exact:true}).click();
  await page.getByLabel(ui.date,{exact:true}).fill('');await uiWrite(page,()=>page.getByRole('button',{name:ui.saveTask,exact:true}).click());
  const edited=(await read(u)).state.learningPlan.tasks.find(t=>t.id===linked.id);equal(edited.dueDate,null);equal(edited.enrollmentId,eid);equal(edited.lessonId,p.lessons[1].id);
  await taskRow(page,linked.id).getByRole('button',{name:ui.openLearning,exact:true}).click();
  await page.getByRole('heading',{name:p.lessons[1].title,exact:true}).waitFor();
  await finishVisibleLesson(page,p.lessons[1]);await finishVisibleLesson(page,p.lessons[2]);
  equal((await read(u)).state.enrollments[0].completed.length,3);coverage.push('Pinned linked task keeps its enrollment and opens the next saved lesson');

  await openPlan(page);const practical=await addTask(page,ui.practicalKind,{dueDate:dated,minutes:'35'});
  await taskRow(page,practical.id).getByRole('button',{name:ui.openLearning,exact:true}).click();
  await page.getByRole('heading',{name:p.practicalAssessment.title,exact:true}).waitFor();
  for(const f of p.practicalAssessment.submissionPrompts)await page.getByLabel(f.label,{exact:true}).fill(p.practicalAssessment.samplePassingEvidence);
  await page.getByRole('checkbox',{name:'I used fictional or permitted information and checked this response.',exact:true}).check();
  const submitted=await uiWrite(page,()=>page.getByRole('button',{name:'Submit evidence',exact:true}).click());
  equal(submitted.state.enrollments[0].record,null);await openPlan(page);await taskRow(page,practical.id).getByText('Evidence submitted',{exact:true}).waitFor();
  coverage.push('Practical planning completes upon actual evidence submission and does not issue a record');

  const attempt=submitted.state.enrollments[0].attempts.at(-1);
  await labAction({type:'assess',enrollmentId:eid,attemptId:attempt.id,actor:'assessor-a',scores:p.practicalAssessment.rubric.map(()=>4),gates:p.practicalAssessment.rubric.filter(r=>r.criticalGate).map(()=>true),notes:p.practicalAssessment.rubric.map(()=>'Checked the synthetic source reference against the submitted evidence.'),feedback:'This synthetic local fixture demonstrates careful checks, permitted data and a clear human approval route.'});
  await page.reload();await page.locator('[data-save-state="loaded"]').waitFor();
  const reflection=await addTask(page,ui.reflectionKind,{dueDate:'',minutes:'15'});
  await taskRow(page,reflection.id).getByRole('button',{name:ui.openLearning,exact:true}).click();
  await select(page,'Pathway for reflection',p.title);await page.getByLabel('My return-to-work reflection',{exact:true}).fill('I checked a fictional customer draft against its source packet, removed an unsupported promise, and kept human approval.');
  await page.getByLabel('Time before, in minutes (optional)',{exact:true}).fill('');await page.getByLabel('Time with help and checks, in minutes (optional)',{exact:true}).fill('0');
  const followup=await uiWrite(page,()=>page.getByRole('button',{name:'Save my reflection',exact:true}).click());equal(followup.state.followups[0].minutesBefore,null);equal(followup.state.followups[0].minutesAfter,0);
  await openPlan(page);await taskRow(page,reflection.id).getByText('Reflection saved',{exact:true}).waitFor();
  coverage.push('Reflection completes from saved own work reflection; absent times and explicit zero remain distinct');

  await page.getByRole('button',{name:'Preferences & privacy',exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export my workspace',exact:true}).click();const download=await downloading;
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));equal(exported.learningPlan.personalGoal,goal);truth(exported.learningPlan.tasks.some(t=>t.id===reflection.id));
  coverage.push('Own-data export includes private plan');

  await openPlan(page);await page.screenshot({path:resolve(artifactDir,'learning-plan-desktop.png'),fullPage:true});
  for(const width of [1440,768,390])for(const enlarged of [false,true]){
    await page.setViewportSize({width,height:1000});await page.evaluate(v=>document.documentElement.style.fontSize=v?'200%':'',enlarged);
    layout.push({width,enlarged,surface:'plan',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    await taskRow(page,practice.id).getByRole('button',{name:ui.edit,exact:true}).click();await page.getByRole('dialog',{name:'Edit planned activity',exact:true}).waitFor();
    layout.push({width,enlarged,surface:'activity-dialog',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    await page.getByRole('dialog').getByRole('button',{name:ui.cancel,exact:true}).click();
  }
  truth(!layout.some(r=>r.overflow),'Plan or activity dialog has document overflow');await page.evaluate(()=>document.documentElement.style.fontSize='');await page.screenshot({path:resolve(artifactDir,'learning-plan-mobile.png'),fullPage:true});
  coverage.push('Plan and activity dialog at desktop/tablet/phone widths and 200% text');

  const team=await fixture(),teamPage=await pageFor(team.a),ownerPage=await pageFor(team.owner);
  await teamPage.goto(base+'/?workspace='+encodeURIComponent(team.id)+'#plan');await teamPage.locator('[data-save-state="loaded"]').waitFor();
  await teamPage.getByLabel(ui.personalGoal,{exact:true}).fill(goal);await uiWrite(teamPage,()=>teamPage.getByRole('button',{name:ui.savePreferences,exact:true}).click());
  const privateTeamTask=await addTask(teamPage,ui.practiceKind,{title:'Synthetic team learner private practice',privateNote:note});
  await ownerPage.goto(base+'/?workspace='+encodeURIComponent(team.id)+'#teams');await ownerPage.locator('[data-save-state="loaded"]').waitFor();
  truth(!(await ownerPage.locator('body').innerText()).includes(goal));truth(!(await ownerPage.locator('body').innerText()).includes(note));
  await action(team.owner,team.id,{type:'member',userId:team.a.id,roles:['learner'],scopes:[],active:false});
  await teamPage.reload();await teamPage.locator('[data-save-state="loaded"]').waitFor();
  equal(await teamPage.getByLabel(ui.personalGoal,{exact:true}).inputValue(),goal);truth((await taskRow(teamPage,privateTeamTask.id).innerText()).includes(note));
  truth(await teamPage.getByRole('button',{name:ui.savePreferences,exact:true}).isDisabled());truth(await teamPage.getByRole('button',{name:ui.add,exact:true}).isDisabled());
  coverage.push('Team private plan retained after removal; owner UI excludes private data and removed learner writes are disabled');

  equal(pageErrors,[]);
  const unexpected=postRequests.filter(url=>!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname));equal(unexpected,[]);
  coverage.push('No external POST from these planning and reflection journeys');
}catch(e){error=e;}finally{await browser.close();}
const result={passed:!error,checks,coverage,responsiveChecks:layout.length,layout,pageErrors,error:error?String(error.message):null,limits:[
  'Synthetic loopback identity headers; this is not hosted dispatcher authentication or real participant access verification.',
  'Private-lab assessment uses the labelled sample staff fixture, not an independently accredited issuer.',
  'Absence of external POST applies to this executed journey; no email/push sender is implemented.',
]};
writeFileSync(resolve(artifactDir,'learning-plan-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(error)throw error;
