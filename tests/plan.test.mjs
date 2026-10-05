import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLearningPlanCommand, freshLearningPlan, readLearningPlan, LearningPlanError,
  validatePlanDate, validatePlanTimeZone, planToday, planWeek,
  projectPlanTasks, taskProgress, learningPlanSummary, learnerNextAction, enrollmentNextAction,
  isLearningPlanCommand, PLAN_LIMITS,
} from '../.sites-runtime/plan.mjs';

const NOW = '2026-10-05T08:00:00.000Z';
const p1 = { id: 'msme-course', title: 'Checked customer responses', lessons: [
  {id:'l1',title:'Check the record',estimatedMinutes:25},
  {id:'l2',title:'Check the draft',estimatedMinutes:30},
  {id:'l3',title:'Prepare a response',estimatedMinutes:20},
], practicalAssessment:{title:'Demonstrate careful customer handling'} };
const p2 = { ...p1, lessons: [{id:'new-1',title:'Changed lesson',estimatedMinutes:40}] };
let nextId = 0;
const opts = {
  now: NOW,
  resolveProgram: (id, version) => id === p1.id ? version === 'v1' ? p1 : version === 'v2' ? p2 : undefined : undefined,
  newId: () => `task-${++nextId}`,
  contextPrograms: {msme:p1.id},
};
const enrollment = (extra = {}) => ({id:'e-own',programId:p1.id,version:'v1',startedAt:NOW,completed:[],practice:{},attempts:[],appeals:[],record:null,withdrawn:false,...extra});
const state = (e = enrollment()) => ({profile:{context:'msme'},enrollments:e?[e]:[],followups:[],paused:[]});
const command = (s,c,overrides={}) => ({...structuredClone(s),learningPlan:applyLearningPlanCommand(s,c,{...opts,...overrides})});
const addPractice = (s, extra = {}) => command(s,{type:'plan-task',kind:'practice',title:'Check a fictional work example',...extra});
const task = s => s.learningPlan.tasks.at(-1);
const errorStatus = (fn,status) => assert.throws(fn,e=>e instanceof LearningPlanError&&e.status===status);

test('old aggregate defaults are detached; read and derivation do not mutate saved learner evidence',()=>{
  const s=state(),before=JSON.stringify(s),plan=readLearningPlan(s);
  assert.deepEqual(plan,freshLearningPlan());plan.goal='records';plan.tasks.push({id:'local-only'});
  assert.equal(readLearningPlan(s).goal,'explore');assert.equal(readLearningPlan(s).tasks.length,0);
  assert.equal(learnerNextAction(s,opts).lessonId,'l1');assert.equal(JSON.stringify(s),before);
});

test('preference writes preserve tasks, validate optional in-app reminders and never change enrollment or roles',()=>{
  let s=addPractice(state()),before=JSON.stringify(s.enrollments);
  s=command(s,{type:'learning-plan',goal:'clear-response',personalGoal:' Write clearer customer replies ',weeklyMinutes:90,timeZone:'Asia/Kolkata',remindersEnabled:true});
  assert.equal(s.learningPlan.personalGoal,'Write clearer customer replies');assert.equal(s.learningPlan.tasks.length,1);
  assert.equal(s.learningPlan.remindersEnabled,true);assert.equal(JSON.stringify(s.enrollments),before);
  const n=command(s,{type:'learning-plan',remindersEnabled:false});assert.equal(n.learningPlan.goal,'clear-response');assert.equal(n.learningPlan.tasks.length,1);
});

test('unsupported fields, forged learner/actor references and invalid preference values reject atomically',()=>{
  const s=state(),before=JSON.stringify(s);
  for(const c of [
    {type:'learning-plan',learnerId:'other',goal:'records'},
    {type:'learning-plan',actor:'admin',goal:'records'},
    {type:'learning-plan',goal:'__proto__'},
    {type:'learning-plan',weeklyMinutes:NaN},
    {type:'learning-plan',weeklyMinutes:30.5},
    {type:'learning-plan',weeklyMinutes:'60'},
    {type:'learning-plan',weeklyMinutes:9},
    {type:'learning-plan',weeklyMinutes:601},
    {type:'learning-plan',remindersEnabled:'true'},
    {type:'learning-plan',timeZone:'Invented/Zone'},
    {type:'learning-plan',timeZone:'+05:30'},
    {type:'learning-plan',personalGoal:'x'.repeat(201)},
    {type:'learning-plan'},
  ])assert.throws(()=>command(s,c),LearningPlanError);
  assert.equal(JSON.stringify(s),before);
});

test('nullable due dates remain unscheduled; leap dates and impossible rollover are validated',()=>{
  assert.equal(validatePlanDate(null),null);assert.equal(validatePlanDate('2028-02-29'),'2028-02-29');
  for(const d of ['2026-02-29','2026-02-30','2026-13-01','2026-00-10','2026-10-00','26-10-05','2026-10-05T00:00Z','0000-01-01',undefined])assert.throws(()=>validatePlanDate(d),LearningPlanError);
  const s=addPractice(state());assert.equal(task(s).dueDate,null);assert.equal(projectPlanTasks(s,s.learningPlan,opts)[0].due,'unscheduled');
});

test('date-only timezone calculations handle UTC midnight, local year boundary and DST without shifting stored dates',()=>{
  assert.equal(planToday('2026-12-31T20:00:00.000Z','Asia/Kolkata'),'2027-01-01');
  assert.equal(planToday('2026-01-01T02:00:00.000Z','America/New_York'),'2025-12-31');
  assert.equal(planToday('2026-11-01T05:30:00.000Z','America/New_York'),'2026-11-01');
  assert.equal(planToday('2026-11-01T06:30:00.000Z','America/New_York'),'2026-11-01');
  assert.deepEqual(planWeek('2027-01-01'),{start:'2026-12-28',end:'2027-01-03'});
  assert.deepEqual(planWeek('2026-10-05'),{start:'2026-10-05',end:'2026-10-11'});
  assert.equal(validatePlanTimeZone('UTC'),'UTC');
});

test('linked titles and lesson estimates use exact pinned content rather than latest content',()=>{
  const s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1',dueDate:'2026-10-06'});
  assert.equal(task(s).title,p1.lessons[0].title);assert.equal(task(s).plannedMinutes,25);
  errorStatus(()=>command(s,{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'new-1'}),404);
  errorStatus(()=>command(state(enrollment({version:'missing'})),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'}),409);
  errorStatus(()=>command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1',title:'Forged replacement title'}),400);
});

test('foreign enrollment/item references and private-practice course links cannot target another learner',()=>{
  errorStatus(()=>command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-other',lessonId:'l1'}),404);
  errorStatus(()=>command(state(),{type:'plan-task',kind:'practice',title:'A private task',enrollmentId:'e-other'}),400);
  errorStatus(()=>command(state(),{type:'plan-task-status',taskId:'foreign-task',status:'done'}),404);
  errorStatus(()=>command(state(),{type:'plan-task-remove',taskId:'foreign-task'}),404);
});

test('a linked planning activity cannot be retargeted or renamed; dates can be cleared without losing note',()=>{
  let s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1',dueDate:'2026-10-06',note:'Keep the synthetic source packet ready.'});
  const id=task(s).id;
  for(const change of [{kind:'practice'},{enrollmentId:'e-other'},{lessonId:'l2'},{title:'Unrelated title'}])errorStatus(()=>command(s,{type:'plan-task',taskId:id,...change}),400);
  s=command(s,{type:'plan-task',taskId:id,dueDate:null});assert.equal(task(s).dueDate,null);assert.equal(task(s).note,'Keep the synthetic source packet ready.');
});

test('private practice completion is self-reported, idempotent in timestamp, reversible, and does not complete a course',()=>{
  let s=addPractice(state()),id=task(s).id,before=JSON.stringify(s.enrollments);
  s=command(s,{type:'plan-task-status',taskId:id,status:'done'});assert.equal(task(s).completedAt,NOW);
  assert.equal(projectPlanTasks(s,s.learningPlan,opts)[0].label,'Self-reported practice');
  s=command(s,{type:'plan-task-status',taskId:id,status:'done'},{now:'2026-10-06T08:00:00.000Z'});assert.equal(task(s).completedAt,NOW);
  assert.equal(JSON.stringify(s.enrollments),before);
  s=command(s,{type:'plan-task-status',taskId:id,status:'planned'});assert.equal(task(s).completedAt,null);assert.equal(task(s).status,'planned');
});

test('linked task cannot manually fabricate progress; derived completion requires saved exact own evidence',()=>{
  let s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'}),t=task(s);
  assert.throws(()=>command(s,{type:'plan-task-status',taskId:t.id,status:'done'}),LearningPlanError);
  assert.equal(taskProgress(s,{...t,status:'done',completedAt:NOW},opts).status,'planned');
  s.enrollments[0].completed=['l1'];s.enrollments[0].practice.l1={completedAt:'2026-10-05T08:15:00.000Z'};
  const progress=taskProgress(s,t,opts);assert.equal(progress.status,'done');assert.equal(progress.label,'Lesson completed');assert.equal(progress.completedAt,'2026-10-05T08:15:00.000Z');
});

test('planning a future lesson keeps prerequisite locked and does not issue a learning completion',()=>{
  const s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l3'}),p=projectPlanTasks(s,s.learningPlan,opts)[0];
  assert.equal(p.status,'planned');assert.equal(p.blocked,true);assert.match(p.blockedReason,/previous lesson/);assert.deepEqual(s.enrollments[0].completed,[]);
});

test('duplicate linked open task is rejected, including restoring a skipped duplicate',()=>{
  let s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'}),id=task(s).id;
  errorStatus(()=>command(s,{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'}),409);
  s=command(s,{type:'plan-task-status',taskId:id,status:'skipped'});
  s=command(s,{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'});
  errorStatus(()=>command(s,{type:'plan-task-status',taskId:id,status:'planned'}),409);
});

test('submission task completes upon a new evidence snapshot, never from an older attempt or an assessment claim',()=>{
  let s=state(enrollment({completed:['l1','l2','l3'],attempts:[{id:'old',submittedAt:'2026-10-04T08:00:00Z',decision:{passed:false}}]}));
  s=command(s,{type:'plan-task',kind:'practical',enrollmentId:'e-own'});
  assert.equal(taskProgress(s,task(s),opts).status,'planned');
  s.enrollments[0].attempts.push({id:'new',submittedAt:'2026-10-05T08:01:00Z',decision:null});
  const progress=taskProgress(s,task(s),opts);assert.equal(progress.status,'done');assert.equal(progress.label,'Evidence submitted');assert.equal(s.enrollments[0].record,null);
});

test('reflection planning needs an active record; later saved reflection remains historical after record suspension',()=>{
  errorStatus(()=>command(state(),{type:'plan-task',kind:'reflection',enrollmentId:'e-own'}),409);
  let s=state(enrollment({record:{status:'active',title:'Checked customer responses'}}));
  s=command(s,{type:'plan-task',kind:'reflection',enrollmentId:'e-own'});
  s.followups.push({enrollmentId:'another',createdAt:'2026-10-05T09:00:00Z'});assert.equal(taskProgress(s,task(s),opts).status,'planned');
  s.followups.push({enrollmentId:'e-own',createdAt:'2026-10-05T09:00:00Z'});s.enrollments[0].record.status='suspended';
  const progress=taskProgress(s,task(s),opts);assert.equal(progress.status,'done');assert.equal(progress.label,'Reflection saved');
});

test('revoked membership blocks every plan write; loss of learner role blocks linked progress but permits own private practice',()=>{
  for(const c of [{type:'learning-plan',goal:'records'},{type:'plan-task',kind:'practice',title:'Private practice'},{type:'plan-task-status',taskId:'x',status:'done'},{type:'plan-task-remove',taskId:'x'}])errorStatus(()=>command(state(),c,{memberActive:false}),403);
  errorStatus(()=>command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'},{canLearn:false}),403);
  assert.equal(command(state(),{type:'plan-task',kind:'practice',title:'Private practice'},{canLearn:false}).learningPlan.tasks.length,1);
});

test('paused/withdrawn learning blocks new linked progress, preserves plan, and active-record reflection remains allowed',()=>{
  const s=state();s.paused=[p1.id];errorStatus(()=>command(s,{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l1'}),409);
  errorStatus(()=>command(state(enrollment({withdrawn:true})),{type:'plan-task',kind:'practical',enrollmentId:'e-own'}),409);
  const completed=state(enrollment({cohortId:'c1',record:{status:'active',title:'My practice record'}}));
  assert.equal(command(completed,{type:'plan-task',kind:'reflection',enrollmentId:'e-own'},{cohorts:[{id:'c1',status:'paused'}]}).learningPlan.tasks.length,1);
});

test('open and total limits reject without silently deleting plan history',()=>{
  let s=state(null);for(let i=0;i<PLAN_LIMITS.openTasks;i++)s=addPractice(s);
  const before=JSON.stringify(s);errorStatus(()=>addPractice(s),409);assert.equal(JSON.stringify(s),before);
  s.learningPlan.tasks=s.learningPlan.tasks.map(t=>({...t,status:'skipped'}));
  while(s.learningPlan.tasks.length<PLAN_LIMITS.totalTasks){s=addPractice(s);s=command(s,{type:'plan-task-status',taskId:task(s).id,status:'skipped'});}
  errorStatus(()=>addPractice(s),409);assert.equal(s.learningPlan.tasks.length,PLAN_LIMITS.totalTasks);
  s=command(s,{type:'plan-task-remove',taskId:s.learningPlan.tasks[0].id});assert.equal(addPractice(s).learningPlan.tasks.length,PLAN_LIMITS.totalTasks);
});

test('reminders default off, appear only for available own due tasks, and vanish without erasing the plan',()=>{
  let s=addPractice(state(),{dueDate:'2026-10-05'});s=addPractice(s,{dueDate:'2026-10-04'});s=addPractice(s,{dueDate:null});s=addPractice(s,{dueDate:'2026-10-06'});
  assert.equal(learningPlanSummary(s,opts).reminders.length,0);
  s=command(s,{type:'learning-plan',remindersEnabled:true});assert.deepEqual(learningPlanSummary(s,opts).reminders.map(t=>t.due),['earlier','today']);
  assert.equal(learningPlanSummary(s,{...opts,memberActive:false}).reminders.length,0);
  s=command(s,{type:'learning-plan',remindersEnabled:false});assert.equal(learningPlanSummary(s,opts).reminders.length,0);assert.equal(s.learningPlan.tasks.length,4);
});

test('weekly metrics distinguish planned allocation from actual dated evidence completion',()=>{
  let s=addPractice(state(),{dueDate:'2026-10-05',plannedMinutes:20}),first=task(s).id;
  s=addPractice(s,{dueDate:null,plannedMinutes:10});s=command(s,{type:'plan-task-status',taskId:task(s).id,status:'done'});
  s=command(s,{type:'plan-task-status',taskId:first,status:'done'},{now:'2026-10-12T08:00:00Z'});
  const summary=learningPlanSummary(s,opts);assert.equal(summary.plannedMinutesThisWeek,20);assert.equal(summary.completedActivitiesThisWeek,1);
});

test('resume derives first incomplete pinned lesson, saved draft and correct published effort',()=>{
  const s=state(enrollment({completed:['l1'],lessonDrafts:{l2:{practice:'Saved draft'}}})),a=learnerNextAction(s,opts);
  assert.equal(a.kind,'lesson');assert.equal(a.lessonId,'l2');assert.equal(a.estimatedMinutes,30);assert.match(a.reason,/saved practice/);
});

test('next action reflects no-attempt, pending review, independent appeal, active record, revision and exhausted attempts',()=>{
  const done={completed:['l1','l2','l3']};
  const cases=[
    [done,'practical','assessment'],
    [{...done,attempts:[{id:'a',decision:null}]},'review','feedback'],
    [{...done,attempts:[{id:'a',decision:{passed:false}}],appeals:[{id:'ap',attemptId:'a',status:'open'}]},'appeal','feedback'],
    [{...done,record:{status:'active'}},'reflection',null],
    [{...done,attempts:[{id:'a',decision:{passed:false}}]},'revise','feedback'],
    [{...done,record:{status:'suspended'},attempts:[{id:'a',decision:{passed:true}}],appeals:[{attemptId:'a',status:'resolved',resolution:{passed:false}}]},'revise','feedback'],
    [{...done,attempts:Array.from({length:3},(_,i)=>({id:String(i),decision:{passed:false}}))},'support','feedback'],
  ];
  for(const [extra,kind,tab] of cases){const s=state(enrollment(extra)),a=learnerNextAction(s,opts);assert.equal(a.kind,kind);assert.equal(a.tab,tab);}
});

test('missing pinned version, paused learning, role loss and removed membership never present a working progress action',()=>{
  assert.equal(learnerNextAction(state(enrollment({version:'missing'})),opts).kind,'unavailable');
  const s=state();s.paused=[p1.id];assert.equal(learnerNextAction(s,opts).kind,'paused');
  assert.equal(learnerNextAction(state(),{...opts,canLearn:false}).blocked,true);
  assert.equal(learnerNextAction(state(),{...opts,memberActive:false}).view,'credentials');
  assert.equal(enrollmentNextAction(state(enrollment({withdrawn:true})),enrollment({withdrawn:true}),opts).kind,'history');
});

test('planned own activity influences next action without bypassing locked prerequisite or enrollment ownership',()=>{
  let s=command(state(),{type:'plan-task',kind:'lesson',enrollmentId:'e-own',lessonId:'l3',dueDate:'2026-10-05'});
  assert.equal(learnerNextAction(s,opts).lessonId,'l1');
  s=addPractice(s,{dueDate:'2026-10-04',title:'Check my own fictional draft'});assert.equal(learnerNextAction(s,opts).kind,'practice');
  errorStatus(()=>learnerNextAction(s,{...opts,preferredEnrollmentId:'e-other'}),404);
});

test('unmatched/no-enrollment learner gets actual catalog exploration and no fabricated recommended course',()=>{
  const s=state(null);s.learningPlan={...freshLearningPlan(),goal:'expert-questions'};
  const a=learnerNextAction(s,opts);assert.equal(a.kind,'catalog');assert.equal(a.programId,null);assert.equal(a.estimatedMinutes,null);
  assert.equal(isLearningPlanCommand({type:'learning-plan'}),true);assert.equal(isLearningPlanCommand({type:'assess'}),false);
});
