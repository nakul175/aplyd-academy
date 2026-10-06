/**
 * Published assessment rules as DATA. This module is the single source of truth for the
 * retry limit, appeal window, independence rules, accommodation routes and assessment
 * methods. The engine reads these constants; the UI renders them. Pure: no I/O, no clock.
 */
export const MAX_ATTEMPTS=3;
export const APPEAL_WINDOW_DAYS=14;
const DAY_MS=86400000;

export const ACCOMMODATION_TYPES=Object.freeze([
 Object.freeze({id:'extra-time',label:'Extra time'}),
 Object.freeze({id:'alternative-format',label:'Alternative format'}),
 Object.freeze({id:'assistive-technology',label:'Assistive technology'}),
 Object.freeze({id:'human-scribe',label:'Human scribe'}),
 Object.freeze({id:'other',label:'Other (describe it)'}),
]);
export type AccommodationType='extra-time'|'alternative-format'|'assistive-technology'|'human-scribe'|'other';
export const ACCOMMODATION_LIMITS=Object.freeze({detailMax:600,otherDetailMin:10,reasonMin:10,reasonMax:1000,maxPending:3,maxTotal:20});
export const accommodationLabel=(id:string)=>ACCOMMODATION_TYPES.find(t=>t.id===id)?.label??'Accommodation';

export type AssessmentMethodId='quiz'|'practical'|'observed'|'oral';
export type AssessmentMethod={id:AssessmentMethodId;label:string;scoring:'auto'|'human';humanRecorded:boolean;claim:string};
export const ASSESSMENT_METHODS:readonly AssessmentMethod[]=Object.freeze([
 Object.freeze({id:'quiz' as const,label:'Quiz',scoring:'auto' as const,humanRecorded:false,claim:'Shows understanding of one lesson. It is scored automatically and never decides a practice record on its own.'}),
 Object.freeze({id:'practical' as const,label:'Practical evidence',scoring:'human' as const,humanRecorded:true,claim:'Written practical evidence scored by an assigned assessor against the rubric. Supports the practice-completion claim.'}),
 Object.freeze({id:'observed' as const,label:'Observed task',scoring:'human' as const,humanRecorded:true,claim:'The assessor watched the task and recorded what they saw against the same rubric. Supports the same claim as practical evidence.'}),
 Object.freeze({id:'oral' as const,label:'Oral explanation',scoring:'human' as const,humanRecorded:true,claim:'The learner explained their work aloud and the assessor recorded it against the same rubric. Supports the same claim as practical evidence.'}),
]);
const HUMAN_METHODS=ASSESSMENT_METHODS.filter(m=>m.humanRecorded).map(m=>m.id);

export type AssessmentRules={
 maxAttempts:number;appealWindowDays:number;
 retry:{blockedWhileReviewPending:boolean;blockedWhileAppealOpen:boolean;afterLimit:string};
 appeal:{latestAttemptOnly:boolean;independentReviewer:boolean;originalDecisionPreserved:boolean};
 independence:{assessorIndependentOfLearner:boolean;appealReviewerIndependentOfOriginalAssessor:boolean;accommodationDeciderIndependentOfRequester:boolean};
 accommodations:{types:readonly {id:string;label:string}[];decidedBy:string;rubricAndPassMarkUnchanged:boolean;decisionHistoryRetained:boolean;maxPending:number};
 methods:readonly (AssessmentMethod&{allowed:boolean})[];
 methodsRequire:string;
};

/** Per-offering rules. Attempt limit, window and independence come from the constants above; only the
 * assessment methods are offering-specific (`practicalAssessment.allowedMethods`, optional). */
export function assessmentRulesFor(program?:any):AssessmentRules{
 const declared=program?.practicalAssessment?.allowedMethods;
 const allowed:string[]=Array.isArray(declared)?(declared.filter((m:any)=>HUMAN_METHODS.includes(m)).length?declared.filter((m:any)=>HUMAN_METHODS.includes(m)):['practical']):[...HUMAN_METHODS];
 return {
  maxAttempts:MAX_ATTEMPTS,appealWindowDays:APPEAL_WINDOW_DAYS,
  retry:{blockedWhileReviewPending:true,blockedWhileAppealOpen:true,afterLimit:'Ask for support before continuing.'},
  appeal:{latestAttemptOnly:true,independentReviewer:true,originalDecisionPreserved:true},
  independence:{assessorIndependentOfLearner:true,appealReviewerIndependentOfOriginalAssessor:true,accommodationDeciderIndependentOfRequester:true},
  accommodations:{types:ACCOMMODATION_TYPES,decidedBy:'An assigned facilitator or assessor who is not the requester',rubricAndPassMarkUnchanged:true,decisionHistoryRetained:true,maxPending:ACCOMMODATION_LIMITS.maxPending},
  methods:ASSESSMENT_METHODS.map(m=>({...m,allowed:m.id==='quiz'?true:allowed.includes(m.id)})),
  methodsRequire:'Every human-recorded method uses the same rubric, the same critical gates, a per-criterion evidence reference and written feedback. The pass rule does not change with the method.',
 };
}

export const attemptsExhausted=(attemptCount:number,rules:{maxAttempts:number}=assessmentRulesFor())=>attemptCount>=rules.maxAttempts;
/** Same comparison the engine always used: closed only when strictly more than the window has elapsed. */
export const appealWindowClosed=(decidedAt:string,now:string|number,rules:{appealWindowDays:number}=assessmentRulesFor())=>(typeof now==='number'?now:Date.parse(now))-Date.parse(decidedAt)>rules.appealWindowDays*DAY_MS;

/** Chosen method for a decision; undefined `requested` means the default human practical method. */
export function resolveAssessmentMethod(program:any,requested:any,fallback:AssessmentMethodId='practical'):{ok:true;method:AssessmentMethodId}|{ok:false;message:string}{
 const method=requested===undefined||requested===null?fallback:requested;
 const found=ASSESSMENT_METHODS.find(m=>m.id===method);
 if(!found)return {ok:false,message:'Choose an assessment method from the published list.'};
 if(!found.humanRecorded)return {ok:false,message:'Quizzes are scored automatically and cannot be recorded as an assessor decision.'};
 const rules=assessmentRulesFor(program);
 if(!rules.methods.find(m=>m.id===method)?.allowed)return {ok:false,message:'This offering does not publish that assessment method.'};
 return {ok:true,method:found.id};
}
export const methodOf=(decision:any):AssessmentMethodId=>ASSESSMENT_METHODS.some(m=>m.id===decision?.method)?decision.method:'practical';

/** Accommodations the assessor must see at review time. Informational only: nothing here feeds scoring. */
export type ReviewAccommodation={id:string;type:string;label:string;detail:string;approvedAt:string;approvedBy:string;reason:string};
export function accommodationsForReview(enrollment:any):ReviewAccommodation[]{
 return (Array.isArray(enrollment?.accommodations)?enrollment.accommodations:[]).filter((a:any)=>a?.status==='approved'&&a.decision).map((a:any)=>({id:a.id,type:a.type,label:accommodationLabel(a.type),detail:a.detail??'',approvedAt:a.decision.decidedAt,approvedBy:a.decision.actorName??a.decision.actor,reason:a.decision.reason}));
}

/** Authority check for accommodation decisions; the Team layer should call this with the authenticated member. */
export function canDecideAccommodation(member:any,cohortId:string,learnerId:string){
 return !!member&&member.active===true&&member.userId!==learnerId&&Array.isArray(member.roles)&&member.roles.some((r:string)=>r==='facilitator'||r==='assessor')&&Array.isArray(member.scopes)&&member.scopes.includes(cohortId);
}

export type RuleSection={id:string;heading:string;lines:string[]};
/** Plain-language rendering generated only from the data, so the page cannot drift from the engine. */
export function describeAssessmentRules(rules:AssessmentRules):RuleSection[]{
 const n=rules.maxAttempts;
 return [
  {id:'retry',heading:'Retries',lines:[`You have ${n} attempts at the practical assessment.`,'A new attempt opens only after the previous one has a decision and no appeal is open.',rules.retry.afterLimit]},
  {id:'appeal',heading:'Appeals',lines:[`You may ask for an independent review within ${rules.appealWindowDays} days of a decision, for your latest attempt.`,'The reviewer is someone other than the original assessor. The original decision stays on record.']},
  {id:'independence',heading:'Independence',lines:['Decisions are made by an assigned assessor, never by you.','An appeal reviewer must be independent of the original decision.','An accommodation is decided by someone other than the person who asked for it.']},
  {id:'accommodations',heading:'Accommodations',lines:[`You can ask for: ${rules.accommodations.types.map(t=>t.label.replace(/ \(describe it\)$/,'').toLowerCase()).join(', ')}.`,'An approved accommodation changes how you can show your work. It never lowers the rubric or the pass mark.','Each request, decision and reason is kept in your record and cannot be edited afterwards.']},
  {id:'methods',heading:'Assessment methods and what they support',lines:[...rules.methods.map(m=>`${m.label}${m.scoring==='auto'?' (automatic)':m.allowed?' (assessor-recorded)':' (not offered here)'}: ${m.claim}`),rules.methodsRequire]},
 ];
}
