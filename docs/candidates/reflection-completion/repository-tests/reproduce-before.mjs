import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {twoReflections,recap,FIRST,SECOND,FIRST_WEEK,SECOND_WEEK} from './workflow.mjs';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..'),app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:existsSync('app/api/academy/route.ts')?'.':'work/aplyd-academy'));
const output=resolve(process.env.ACADEMY_REFLECTION_QA_OUTPUT??(existsSync(resolve(here,'../lib/academy-plan.ts'))?resolve(here,'../runtime'):app+'/.sites-runtime/reflection-completion-qa'));mkdirSync(output,{recursive:true});
globalThis.fetch=()=>{throw new Error('Network disabled in reflection reproduction.');};
const model=await import(pathToFileURL(output+'/before.mjs')),fixture=twoReflections(model),actual=model.taskProgress(fixture.state,fixture.task,model.planOptions(SECOND_WEEK));
let desiredFailure;try{assert.equal(actual.completedAt,FIRST,'A later work reflection must not move the first completion date.');}catch(error){desiredFailure={name:error.name,code:error.code,actual:error.actual,expected:error.expected,message:'A later reflection changes this existing task completion date.'};}
assert.ok(desiredFailure,'This BEFORE reproduction is only valid on the still-unfixed root plan.');
assert.equal(actual.completedAt,SECOND);assert.deepEqual(fixture.state.followups.map(f=>f.createdAt),[SECOND,FIRST]);
const firstWeek=recap(model,fixture.state,FIRST_WEEK),secondWeek=recap(model,fixture.state,SECOND_WEEK);
assert.equal(firstWeek.evidence.reflections,0);assert.equal(secondWeek.evidence.reflections,1);
writeFileSync(output+'/before-failure-proof.json',JSON.stringify({at:new Date().toISOString(),observedBug:true,desiredInvariantFailure:desiredFailure,taskCount:fixture.state.learningPlan.tasks.length,followupInsertionOrder:fixture.state.followups.map(f=>f.createdAt),actualCompletion:actual.completedAt,firstWeekReflections:firstWeek.evidence.reflections,secondWeekReflections:secondWeek.evidence.reflections,source:JSON.parse(readFileSync(output+'/source-evidence.json','utf8')).before,limits:['Actual unchanged root engine and plan, actual weekly model. All fictional learning/review commands executed only in memory. No network, SQL, persisted fixtures or app runtime.']},null,2));
console.log('BEFORE bug reproduced: desired stable-date assertion fails; old task moves to next week.');
