/** Existing sample learning/review workflow, in memory only. No saved fixture or host/API. */
export const CREATED='2026-10-05T08:00:00.000Z',FIRST='2026-10-06T09:00:00.000Z',SECOND='2026-10-12T10:00:00.000Z';
export const FIRST_WEEK='2026-10-07T12:00:00.000Z',SECOND_WEEK='2026-10-13T12:00:00.000Z';
export function reviewedWorkspace(model,original=model.freshWorkspace(),programId='msme-customer-operations'){
 const {applyCommand,programs}=model,p=programs.find(p=>p.id===programId);
 let state=applyCommand(original,{type:'enroll',programId:p.id},'2026-10-04T06:00:00.000Z');
 const enrollmentId=state.enrollments.find(e=>e.programId===p.id&&!e.withdrawn).id;
 for(const lesson of p.lessons)state=applyCommand(state,{type:'lesson',enrollmentId,lessonId:lesson.id,answers:lesson.quiz.map(q=>q.correctOptionIndex),practice:'I checked this fictional packet against every source and kept unsupported claims out of the draft.'},'2026-10-04T07:00:00.000Z');
 state=applyCommand(state,{type:'submit',enrollmentId,fields:Object.fromEntries(p.practicalAssessment.submissionPrompts.map(prompt=>[prompt.id,'I use the supplied fictional source, check each claim, mark the missing information, and ask an appropriate person before acting.'])),confirmed:true,assisted:false},'2026-10-04T08:00:00.000Z');
 state=applyCommand(state,{type:'assess',enrollmentId,attemptId:state.enrollments.find(e=>e.id===enrollmentId).attempts[0].id,actor:'assessor-a',scores:p.practicalAssessment.rubric.map(()=>4),gates:p.practicalAssessment.rubric.filter(r=>r.criticalGate).map(()=>true),notes:p.practicalAssessment.rubric.map(()=> 'The fictional response cites its source and identifies the limitation.'),feedback:'This fictional response meets the sample practice standard; retain the sources and ask for help where the facts are incomplete.'},'2026-10-04T09:00:00.000Z');
 return {state,enrollmentId};
}
export function addReflectionTask(model,state,enrollmentId,at=CREATED){
 const next=model.applyCommand(state,{type:'plan-task',kind:'reflection',enrollmentId,dueDate:at.slice(0,10),plannedMinutes:15,note:'Own fictional planning note.'},at);
 return {state:next,task:next.learningPlan.tasks.at(-1)};
}
export function saveReflection(model,state,enrollmentId,at){
 return model.applyCommand(state,{type:'followup',enrollmentId,reflection:'I tried the fictional work task, checked each source, kept the unsupported claim out, and recorded where I still needed help.',before:'20',after:'15'},at);
}
export function twoReflections(model){let {state,enrollmentId}=reviewedWorkspace(model);const planned=addReflectionTask(model,state,enrollmentId);state=planned.state;state=saveReflection(model,state,enrollmentId,FIRST);state=saveReflection(model,state,enrollmentId,SECOND);return {state,enrollmentId,task:planned.task};}
export function recap(model,state,now){return model.deriveOwnWeeklyReview(model.learningPlanSummary(state,model.planOptions(now)),now);}
