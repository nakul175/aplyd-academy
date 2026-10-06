/**
 * Remediation routes: maps each failed rubric criterion / critical gate of a failed decision to concrete next steps.
 * Pure. Uses only metadata already in the pinned pathway (lesson ids/titles/objectives/steps, rubric ids/names/anchors/gates)
 * and the reviewer's own words. No new content is authored here.
 *
 * The curriculum has no explicit criterion-to-lesson link, so lessons and steps are matched by shared wording. The match is
 * deterministic and reported as `basis`. The reviewer's written note is always shown beside it and is the authority.
 */
import {assessmentRulesFor,attemptsExhausted,type AssessmentRules} from './academy-assessment-rules';
import {learningNavigationHash} from './academy-offering-navigation';

export const WEAK_SCORE_BELOW=3;
const STOP=new Set('this that with from have must does not and the for are was were into only than then them they their your you any all can may should would could about which when what where there been being each other such more most also very make made use used using without within across over under per its it\'s'.split(' '));
const stem=(w:string)=>w.replace(/(ing|ed|es|s)$/,'');
export function wordsOf(text:unknown):Set<string>{
 const out=new Set<string>();
 for(const raw of String(text??'').toLowerCase().split(/[^a-z0-9]+/)){if(raw.length<4||STOP.has(raw))continue;out.add(stem(raw));}
 return out;
}
const overlap=(a:Set<string>,b:Set<string>)=>{let n=0;for(const w of a)if(b.has(w))n++;return n};

export type RemediationRoute={
 kind:'reread-lesson'|'redo-step'|'reviewer-next-step'|'resubmit'|'support';
 label:string;
 hash:string|null;tab:'learn'|'assessment'|'feedback'|null;lessonId:string|null;stepIndex:number|null;
 section?:string;detail?:string;
};
export type RemediationItem={
 id:string;kind:'criterion'|'gate';criterionId:string;dimension:string;score:number;maxScore:4;
 gate:string|null;reviewerNote:string;basis:'wording-match'|'whole-pathway';routes:RemediationRoute[];
};
export type Remediation={
 applies:boolean;reason:'passed'|'no-decision'|'gaps';items:RemediationItem[];reviewerFeedback:string;
 retry:{attemptsUsed:number;maxAttempts:number;attemptsLeft:number;canRetry:boolean;blockedBy:'appeal-open'|'review-pending'|'limit'|'record-active'|null};
 closing:RemediationRoute[];
};

type Program={id:string;lessons:any[];practicalAssessment:{rubric:any[]}};
const link=(programId:string,tab:'learn'|'assessment'|'feedback',lessonId:string|null)=>'#'+learningNavigationHash('learn',programId,lessonId?{tab,lessonId}:{tab});
const lessonWords=(l:any)=>({core:wordsOf([l.title,l.objective,...(Array.isArray(l.steps)?l.steps:[])].join(' ')),body:wordsOf(l.lessonText)});

function matchLessons(program:Program,criterionWords:Set<string>){
 const scored=program.lessons.map((l:any,index:number)=>{const w=lessonWords(l);return {l,index,s:overlap(criterionWords,w.core)*3+overlap(criterionWords,w.body)}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.index-b.index);
 if(!scored.length)return [];
 const top=scored[0].s;
 return scored.filter(x=>x.s>=Math.max(1,top*0.6)).slice(0,2).sort((a,b)=>a.index-b.index);
}
function matchStep(lesson:any,criterionWords:Set<string>){
 let best=-1,bestScore=0;
 (Array.isArray(lesson.steps)?lesson.steps:[]).forEach((step:string,i:number)=>{const s=overlap(criterionWords,wordsOf(step));if(s>bestScore){best=i;bestScore=s}});
 return best;
}

/** `decision` is the controlling decision for the attempt (appeal resolution if present, else the original). */
export function buildRemediation(program:Program|null|undefined,enrollment:any,attempt:any,decision:any,rules:AssessmentRules=assessmentRulesFor(program)):Remediation{
 const used=Array.isArray(enrollment?.attempts)?enrollment.attempts.length:0;
 const openAppeal=(enrollment?.appeals??[]).some((a:any)=>a.status==='open');
 const pending=(enrollment?.attempts??[]).some((a:any)=>!a.decision);
 const exhausted=attemptsExhausted(used,rules);
 const blockedBy=enrollment?.record?.status==='active'?'record-active':exhausted?'limit':openAppeal?'appeal-open':pending?'review-pending':null;
 const retry={attemptsUsed:used,maxAttempts:rules.maxAttempts,attemptsLeft:Math.max(0,rules.maxAttempts-used),canRetry:blockedBy===null,blockedBy} as Remediation['retry'];
 const empty=(reason:Remediation['reason']):Remediation=>({applies:false,reason,items:[],reviewerFeedback:'',retry,closing:[]});
 if(!decision||!program)return empty('no-decision');
 if(decision.passed===true)return empty('passed');
 const rubric=program.practicalAssessment.rubric;
 const critical=rubric.filter((r:any)=>r.criticalGate);
 const failedGateIds=new Set<string>();
 critical.forEach((r:any,j:number)=>{if(Array.isArray(decision.gates)&&decision.gates[j]===false)failedGateIds.add(r.id)});
 const scores:number[]=Array.isArray(decision.scores)?decision.scores:[];
 let picked=rubric.map((r:any,i:number)=>({r,i,score:Number.isInteger(scores[i])?scores[i]:0})).filter((x:any)=>x.score<WEAK_SCORE_BELOW||failedGateIds.has(x.r.id));
 if(!picked.length){const min=Math.min(...rubric.map((_:any,i:number)=>scores[i]??0));picked=rubric.map((r:any,i:number)=>({r,i,score:scores[i]??0})).filter((x:any)=>x.score===min)}
 const items:RemediationItem[]=picked.map(({r,i,score}:any)=>{
  const gateFailed=failedGateIds.has(r.id);
  const words=wordsOf([r.dimension,gateFailed?r.criticalGate:'',r.anchors?.['3'],r.anchors?.['4']].join(' '));
  const lessons=matchLessons(program,words);
  const routes:RemediationRoute[]=[];
  for(const {l} of lessons){
   routes.push({kind:'reread-lesson',label:`Re-read: ${l.title}`,section:'Lesson text and worked exercise',hash:link(program.id,'learn',l.id),tab:'learn',lessonId:l.id,stepIndex:null});
   const si=matchStep(l,words);
   if(si>=0)routes.push({kind:'redo-step',label:`Redo practice step ${si+1}`,detail:l.steps[si],hash:link(program.id,'learn',l.id),tab:'learn',lessonId:l.id,stepIndex:si});
  }
  const note=typeof decision.notes?.[i]==='string'?decision.notes[i]:'';
  routes.push({kind:'reviewer-next-step',label:'Your reviewer’s note on this criterion',detail:note,hash:link(program.id,'feedback',null),tab:'feedback',lessonId:null,stepIndex:null});
  return {id:`${attempt?.id??'attempt'}:${r.id}`,kind:gateFailed?'gate':'criterion',criterionId:r.id,dimension:r.dimension,score,maxScore:4,gate:gateFailed?r.criticalGate:null,reviewerNote:note,basis:lessons.length?'wording-match':'whole-pathway',routes};
 });
 const closing:RemediationRoute[]=[];
 if(retry.canRetry)closing.push({kind:'resubmit',label:`Revise your evidence and submit attempt ${used+1} of ${rules.maxAttempts}`,hash:link(program.id,'assessment',null),tab:'assessment',lessonId:null,stepIndex:null});
 else if(blockedBy==='limit')closing.push({kind:'support',label:`All ${rules.maxAttempts} attempts are used. ${rules.retry.afterLimit}`,hash:'#settings',tab:null,lessonId:null,stepIndex:null});
 else if(blockedBy==='appeal-open')closing.push({kind:'support',label:'Your appeal is open. A new attempt starts after it is resolved.',hash:null,tab:null,lessonId:null,stepIndex:null});
 else if(blockedBy==='review-pending')closing.push({kind:'support',label:'Another attempt is waiting for review.',hash:null,tab:null,lessonId:null,stepIndex:null});
 return {applies:true,reason:'gaps',items,reviewerFeedback:typeof decision.feedback==='string'?decision.feedback:'',retry,closing};
}
