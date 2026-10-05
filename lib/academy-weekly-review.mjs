import {planToday,planWeek,validatePlanDate,validatePlanTimeZone} from './academy-plan.ts';

const KINDS=new Set(['practice','lesson','practical','reflection']);
const STATUSES=new Set(['planned','done','skipped']);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const dateIn=(date,week)=>date>=week.start&&date<=week.end;
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const zeroEvidence=()=>({lessons:0,submissions:0,reflections:0,total:0});

/** Thin own-view model from the actual existing learningPlanSummary projection.
 * It never resolves another version, recalculates completion/gates, reads staff
 * aggregates, mutates a task or invents attendance/minutes/streaks/grades.
 * Completion counts cover retained plan items, not every course action. */
export function deriveOwnWeeklyReview(summary,observedAt){
 try{
  if(!summary||typeof summary!=='object'||!summary.plan||!Array.isArray(summary.tasks)||summary.tasks.length>200||!stamp(observedAt))return null;
  const timeZone=validatePlanTimeZone(summary.plan.timeZone),today=planToday(observedAt,timeZone),week=planWeek(today);
  if(summary.today!==today||summary.week?.start!==week.start||summary.week?.end!==week.end||!integer(summary.plan.weeklyMinutes,10,600))return null;
  const ids=new Set(),planned={activities:0,minutes:0,budgetMinutes:summary.plan.weeklyMinutes,stillOpen:0},evidence=zeroEvidence(),selfReported={practice:0},attention={blockedOpen:0,undatedOpen:0,earlierOpen:0,openTotal:0,skippedThisWeek:0},rows=[];
  let completionDateNeedsCheck=0;
  for(const task of summary.tasks){
   // Linked titles come from the exact published lesson/submission or retained
   // record; authoring permits 160 characters and reflection adds a fixed prefix.
   // The 100-character practice input limit must not reject those saved links.
   if(!task||typeof task!=='object'||!text(task.id,100)||!task.id||ids.has(task.id)||!KINDS.has(task.kind)||!STATUSES.has(task.status)||!text(task.title,task.kind==='practice'?100:200)||!integer(task.plannedMinutes,5,240)||typeof task.blocked!=='boolean'||(task.blockedReason!==null&&!text(task.blockedReason,1000)))return null;
   ids.add(task.id);
   const dueDate=task.dueDate===null?null:validatePlanDate(task.dueDate),scheduledHere=dueDate!==null&&dateIn(dueDate,week),open=task.status==='planned';
   if(scheduledHere&&task.status!=='skipped'){planned.activities++;planned.minutes+=task.plannedMinutes;if(open)planned.stillOpen++;}
   if(scheduledHere&&task.status==='skipped')attention.skippedThisWeek++;
   if(task.status==='done'){
    if(!stamp(task.completedAt)||Date.parse(task.completedAt)>Date.parse(observedAt))completionDateNeedsCheck++;
    else if(dateIn(planToday(task.completedAt,timeZone),week)){
     if(task.kind==='practice')selfReported.practice++;
     else {evidence.total++;if(task.kind==='lesson')evidence.lessons++;else if(task.kind==='practical')evidence.submissions++;else evidence.reflections++;}
    }
   }
   if(open){
    attention.openTotal++;
    const undated=dueDate===null,earlier=dueDate!==null&&dueDate<today;
    if(task.blocked)attention.blockedOpen++;if(undated)attention.undatedOpen++;if(earlier)attention.earlierOpen++;
    if(task.blocked||undated||earlier)rows.push({id:task.id,title:task.title,kind:task.kind,dueDate,blocked:task.blocked,blockedReason:task.blockedReason,undated,earlier});
   }
  }
  // These are overlapping attention observations, not another activity total.
  rows.sort((a,b)=>Number(b.blocked)-Number(a.blocked)||Number(b.earlier)-Number(a.earlier)||(a.dueDate??'9999-12-31').localeCompare(b.dueDate??'9999-12-31')||a.id.localeCompare(b.id));
  return {week:{...week,timeZone,today},observedAt:new Date(observedAt).toISOString(),planned,evidence,selfReported,attention,completionDateNeedsCheck,attentionRows:rows.slice(0,6),attentionRowsTotal:rows.length,coverage:'retained-own-plan-items'};
 }catch{return null;}
}

/** Whitelist-only local export. No task/title/goal/note/body/pin/account/workspace/
 * contact/revision/identifier is retained, even if supplied on the view model. */
export function prepareOwnWeeklyRecap(review){
 if(!review||typeof review!=='object'||review.coverage!=='retained-own-plan-items')throw new Error('Refresh your own learning plan before downloading a recap.');
 const timeZone=validatePlanTimeZone(review.week?.timeZone),start=validatePlanDate(review.week?.start),end=validatePlanDate(review.week?.end);
 if(!start||!end||planWeek(start).start!==start||planWeek(start).end!==end)throw new Error('The saved recap week needs checking.');
 const read=(value,max=200)=>{if(!integer(value,0,max))throw new Error('The weekly recap counts need checking.');return value;};
 const e=review.evidence;
 if(!e||read(e.total)!==read(e.lessons)+read(e.submissions)+read(e.reflections))throw new Error('The weekly recap evidence counts need checking.');
 return {
  format:'aplyd-academy-own-weekly-plan-recap',schemaVersion:1,
  coverage:'Retained activities in my own saved plan; this does not include all course actions.',
  week:{start,end,timeZone},
  planned:{activities:read(review.planned?.activities),minutes:read(review.planned?.minutes,48000),budgetMinutes:(()=>{const n=review.planned?.budgetMinutes;if(!integer(n,10,600))throw new Error('The saved weekly budget needs checking.');return n;})(),stillOpen:read(review.planned?.stillOpen)},
  savedCourseActions:{lessons:read(e.lessons),submissions:read(e.submissions),reflections:read(e.reflections),total:read(e.total)},
  selfReportedPractice:read(review.selfReported?.practice),
  attention:{blockedOpen:read(review.attention?.blockedOpen),undatedOpen:read(review.attention?.undatedOpen),earlierOpen:read(review.attention?.earlierOpen),openTotal:read(review.attention?.openTotal),skippedThisWeek:read(review.attention?.skippedThisWeek),completionDateNeedsCheck:read(review.completionDateNeedsCheck)},
  limits:['Planned minutes and budget describe intention, not verified time spent.','Course counts describe saved lesson, submission or reflection actions; they do not claim a passed assessment, qualification or job impact.','Private practice completion is self-reported.','Planned and completion dates are independent. Open attention counts can overlap. Items with missing or future completion dates are not counted as completed in the week.','No private notes, goals, activity titles, evidence, contact details or account/workspace/task identifiers are included.'],
 };
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Printable offline document. No scripts, links, external assets or auto-print. */
export function renderOwnWeeklyRecapHtml(review){
 const recap=prepareOwnWeeklyRecap(review),esc=escapeHtml;
 const rows=[['Activities planned for this week',recap.planned.activities],['Intended planned minutes',recap.planned.minutes],['Saved weekly minute budget',recap.planned.budgetMinutes],['Planned items still open this week',recap.planned.stillOpen],['Plan lessons with saved completion this week',recap.savedCourseActions.lessons],['Plan submissions saved this week',recap.savedCourseActions.submissions],['Plan reflections saved this week',recap.savedCourseActions.reflections],['Private practices marked complete this week (self-reported)',recap.selfReportedPractice],['Blocked open plan activities',recap.attention.blockedOpen],['Open activities without a date',recap.attention.undatedOpen],['Open activities with an earlier planned date',recap.attention.earlierOpen],['Skipped activities dated this week',recap.attention.skippedThisWeek],['Completed items with a date needing review',recap.attention.completionDateNeedsCheck]];
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My weekly learning plan recap</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:1rem/1.6 system-ui,sans-serif;color:#17223b}h1{font-size:1.7rem}p,th,td,li{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}th,td{padding:.6rem;border-bottom:1px solid #ccd6e7;text-align:left;vertical-align:top}th{font-weight:500}td{font-weight:700;width:1%;white-space:nowrap}li{margin-bottom:.5rem}@media print{body{margin:0;max-width:none;padding:0}h1{font-size:18pt}tr{break-inside:avoid}}@media(max-width:25rem){body{margin:1rem auto}th,td{padding:.5rem .2rem}}</style></head><body><h1>My weekly learning plan recap</h1><p>'+esc(recap.week.start)+' to '+esc(recap.week.end)+' · '+esc(recap.week.timeZone)+'</p><p>'+esc(recap.coverage)+'</p><table><caption>Planned work, saved course actions and self-reported practice</caption><tbody>'+rows.map(([label,value])=>'<tr><th scope="row">'+esc(label)+'</th><td>'+esc(value)+'</td></tr>').join('')+'</tbody></table><h2>How to read this recap</h2><ul>'+recap.limits.map(limit=>'<li>'+esc(limit)+'</li>').join('')+'</ul><p>Created locally from the current own plan display. It is not an independently verified certificate. Use your browser’s Print command if you want a paper copy.</p></body></html>';
}
