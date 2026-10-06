// Pure in-memory probe: does re-running a completed lesson move a lesson plan item's completion?
// Uses the actual checkout model bundle; no network, no persistence.
import {pathToFileURL} from 'node:url';
globalThis.fetch=()=>{throw new Error('network disabled');};
const model=await import(pathToFileURL(process.argv[2]).href);
const {applyCommand,freshWorkspace,programs,taskProgress,planOptions}=model;
const p=programs.find(x=>x.id==='msme-customer-operations'),lesson=p.lessons[0];
let s=applyCommand(freshWorkspace(),{type:'enroll',programId:p.id},'2026-10-04T06:00:00.000Z');
const enrollmentId=s.enrollments[0].id;
s=applyCommand(s,{type:'plan-task',kind:'lesson',enrollmentId,lessonId:lesson.id,dueDate:'2026-10-06',plannedMinutes:20},'2026-10-05T08:00:00.000Z');
const task=s.learningPlan.tasks.at(-1);
const run=(state,at)=>applyCommand(state,{type:'lesson',enrollmentId,lessonId:lesson.id,answers:lesson.quiz.map(q=>q.correctOptionIndex),practice:'I checked this fictional packet against every source and kept unsupported claims out.'},at);
s=run(s,'2026-10-06T09:00:00.000Z');
const first=taskProgress(s,task,planOptions('2026-10-13T12:00:00.000Z')).completedAt;
let rerunAccepted=true,again=s;
try{again=run(s,'2026-10-12T10:00:00.000Z');}catch(e){rerunAccepted=false;console.log('rerun rejected:',e.message);}
const after=taskProgress(again,task,planOptions('2026-10-13T12:00:00.000Z')).completedAt;
console.log(JSON.stringify({rerunAccepted,firstCompletion:first,afterRerunCompletion:after,moved:first!==after,completedList:again.enrollments[0].completed}));
