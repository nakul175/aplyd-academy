/** Candidate: read-only observations from projectTeam(...).team only.
 * No raw Team, learner state, role grant, command, remote call or approval proof.
 * Client calendar observations never replace current server action validation. */
export const READINESS_LIMITS = {cohorts:20,members:100,drafts:24,publications:8,support:100,rows:8} as const;
export type ReadinessDestination = {view:'teams'|'support';section:'cohorts'|'content'|'queue';id?:string};
type ReviewDateState = 'elapsed'|'within_seven_days'|'future'|'unknown';
export type CohortReadiness = {
  id:string;title:string;state:'open'|'closed'|'paused'|'unknown';
  newContentEnrollment:'allowed_in_snapshot'|'blocked_in_snapshot'|'unknown';
  contentNotice:string|null;exactContentReferenceKnown:boolean;
  nextStep:'owner_may_review_or_pause'|'ask_current_owner';destination:ReadinessDestination;
};
export type ContentReadinessItem = {
  id:string;kind:'publication'|'draft';title:string;
  state:'retired'|'publication_review_elapsed'|'publication_review_soon'|'publication_date_unknown'|'awaiting_review'|'approved';
  reviewDueAt:string|null;reviewDateState:ReviewDateState;waitingDays:number|null;
  authorAvailable:boolean|null;reviewerAvailable:boolean|null;
  authorName:string|null;reviewerName:string|null;
  affectedCohorts:Array<{id:string;title:string;newEnrollmentBlocked:boolean}>;
  reasons:string[];nextStep:string;destination:ReadinessDestination;
};
export type SupportReadinessItem = {
  id:string;category:'learning'|'content'|'accessibility'|'access'|'technical'|'privacy';
  cohortTitle:string;openedDaysAgo:number|null;needsHandler:boolean;
  independentHandlerAvailable:boolean;destination:ReadinessDestination;
};
export type ContentReadiness = {
  workspaceId:string;audience:'owner'|'facilitator';asOf:string;
  counts:{scopedCohorts:number;pausedCohorts:number;contentEnrollmentBlocked:number;contentStatusUnknown:number;retiredPublications:number;elapsedPublicationReviews:number;pendingDraftReviews:number;reviewerUnavailable:number;authorUnavailable:number;openAccessRequests:number;supportNeedsHandler:number};
  cohorts:CohortReadiness[];
  content:{visible:boolean;totalAttention:number;items:ContentReadinessItem[]};
  support:{totalOpen:number;items:SupportReadinessItem[]};
  operatingBoundary:{pausePermission:'current_workspace_owners'|'ask_current_workspace_owner';workplaceEscalationOwner:'not_recorded';staffedResponseTime:'not_established';languageRequests:'private_unless_requester_includes_them'};
};
const DAY=86_400_000;
const text=(v:unknown,fallback:string,max=200)=>typeof v==='string'?v.slice(0,max):fallback;
const identifier=(v:unknown,max=160)=>typeof v==='string'&&v.length>0&&v.length<=max?v:null;
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canonicalTime=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v?v:null;
const elapsedDays=(v:unknown,clock:number)=>{const d=canonicalTime(v);return d&&Date.parse(d)<=clock?Math.floor((clock-Date.parse(d))/DAY):null;};
const dateState=(v:unknown,clock:number):ReviewDateState=>{const d=canonicalTime(v);return !d?'unknown':Date.parse(d)<=clock?'elapsed':Date.parse(d)<=clock+7*DAY?'within_seven_days':'future';};
const bounded=(v:unknown,max:number):any[]|null=>v===undefined?[]:Array.isArray(v)&&v.length<=max?v:null;
function distinctIds(rows:any[],key='id',max=160){const seen=new Set<string>();for(const r of rows){const k=record(r)?identifier(r[key],max):null;if(!k||seen.has(k))return false;seen.add(k);}return true;}
function refKey(value:unknown,workspaceId:string):string|null{
  if(!record(value)||!identifier(value.programId)||!identifier(value.versionId)||!['global',workspaceId].includes(value.scope))return null;
  return JSON.stringify([value.scope,value.programId,value.versionId]);
}
function cohortRef(c:any,workspaceId:string){
  if(Object.hasOwn(c,'contentRef'))return refKey(c.contentRef,workspaceId);
  return identifier(c.programId)&&c.version==='0.1-review-draft'?JSON.stringify(['global',c.programId,c.version]):null;
}
const categories=new Set(['learning','content','accessibility','access','technical','privacy']);

/** Null refuses absent current authority or malformed/oversized snapshots.
 * Explicitly selects canonical thin fields; private bodies are never copied. */
export function deriveContentReadiness(team:unknown,now:string):ContentReadiness|null{
  if(!record(team)||team.active!==true||!Array.isArray(team.roles)||!team.roles.some((r:any)=>r==='admin'||r==='facilitator')||!identifier(team.id)||!canonicalTime(now))return null;
  const owner=team.roles.includes('admin'),clock=Date.parse(now),workspaceId=team.id;
  if((team.support!==undefined&&!record(team.support))||(owner&&team.content!==undefined&&!record(team.content)))return null;
  const cohorts=bounded(team.cohorts,READINESS_LIMITS.cohorts),queue=bounded(team.support?.queue,READINESS_LIMITS.support),members=owner?bounded(team.members,READINESS_LIMITS.members):[],drafts=owner?bounded(team.content?.drafts,READINESS_LIMITS.drafts):[],publications=owner?bounded(team.content?.publications,READINESS_LIMITS.publications):[];
  if(!cohorts||!queue||!members||!drafts||!publications||!distinctIds(cohorts)||!distinctIds(queue)||!distinctIds(drafts)||!distinctIds(publications)||!distinctIds(members,'userId',1_800_000))return null;
  const scoped=cohorts.filter(c=>c.canHost===true),scopedById=new Map(scoped.map(c=>[c.id,c]));
  const cohortRows:CohortReadiness[]=scoped.map(c=>({id:c.id,title:text(c.title,'Unnamed cohort',100),state:['open','closed','paused'].includes(c.status)?c.status:'unknown',newContentEnrollment:c.contentOpen===true?'allowed_in_snapshot':c.contentOpen===false?'blocked_in_snapshot':'unknown',contentNotice:c.contentOpen===false?text(c.contentNotice,'Content availability needs owner review.',300):null,exactContentReferenceKnown:cohortRef(c,workspaceId)!==null,nextStep:owner?'owner_may_review_or_pause':'ask_current_owner',destination:{view:'teams',section:'cohorts',id:c.id}}));
  const contentRows:ContentReadinessItem[]=[];
  if(owner){
    const independentOwner=(id:any,authorId:any)=>{const m=members.find(m=>m.userId===id);return !!m&&m.active===true&&Array.isArray(m.roles)&&m.roles.includes('admin')&&m.userId!==authorId;};
    const currentOwner=(id:any)=>{const m=members.find(m=>m.userId===id);return !!m&&m.active===true&&Array.isArray(m.roles)&&m.roles.includes('admin');};
    for(const p of publications){
      if(!['available','retired'].includes(p.availability))return null;
      const key=refKey(p.ref,workspaceId);if(!key)return null;
      const reviewDateState=dateState(p.reviewDueAt,clock);
      if(p.availability==='available'&&reviewDateState==='future')continue;
      const affected=scoped.filter(c=>cohortRef(c,workspaceId)===key).map(c=>({id:c.id,title:text(c.title,'Unnamed cohort',100),newEnrollmentBlocked:c.contentOpen===false}));
      const state:ContentReadinessItem['state']=p.availability==='retired'?'retired':reviewDateState==='elapsed'?'publication_review_elapsed':reviewDateState==='within_seven_days'?'publication_review_soon':'publication_date_unknown';
      contentRows.push({id:p.id,kind:'publication',title:text(p.title,'Private publication',200),state,reviewDueAt:canonicalTime(p.reviewDueAt),reviewDateState,waitingDays:null,authorAvailable:null,reviewerAvailable:null,authorName:text(p.authorName,'Author',80),reviewerName:text(p.reviewerName,'Reviewer',80),affectedCohorts:affected,reasons:[p.availability==='retired'?'The stored publication is retired.':reviewDateState==='elapsed'?'Its content review date has elapsed at this observation.':reviewDateState==='unknown'?'Its stored review date needs checking.':'Its content review date is within seven days.'],nextStep:'Open the exact publication. Existing learners retain their pinned version; use a separate cohort pause only when continued learning must stop.',destination:{view:'teams',section:'content',id:p.id}});
    }
    for(const d of drafts){
      if(!['draft','in_review','approved','published','archived'].includes(d.state))return null;
      if(!['in_review','approved'].includes(d.state))continue;
      const authorAvailable=currentOwner(d.authorId),reviewerAvailable=independentOwner(d.reviewerId,d.authorId),reviewer=members.find(m=>m.userId===d.reviewerId),reviewDateState=dateState(d.reviewDueAt,clock);
      const reasons:string[]=[];
      if(!authorAvailable)reasons.push('The author is no longer a current owner and cannot edit or recall this draft. Current independent review and owner publication may remain available.');
      if(!reviewerAvailable)reasons.push('The assigned reviewer no longer has current independent owner authority.');
      if(reviewDateState==='elapsed')reasons.push('The proposed publication review date has passed. This is not a reviewer response deadline.');
      if(reviewDateState==='unknown')reasons.push('The proposed publication review date needs checking.');
      const reviewNeedsReset=!reviewerAvailable||reviewDateState==='elapsed'||reviewDateState==='unknown';
      const nextStep=!authorAvailable?(reviewNeedsReset?'The former author cannot recall for fresh review. A current owner may archive this unpublished draft to preserve history, then start a separate draft.':d.state==='in_review'?'The assigned independent owner may review the saved draft. If changes are needed, a current owner may archive it and start a separate draft; author edit authority cannot transfer.':'A current owner may publish the unchanged approved document after server checks. If changes are needed, archive it and start a separate draft.') :reviewNeedsReset?'The current author can recall the draft and arrange fresh review. Archiving is also available to a current owner.':d.state==='in_review'?'The assigned independent owner can review the exact saved document.':'Open the studio for current independent-review, hash and future-date publication checks.';
      contentRows.push({id:d.id,kind:'draft',title:text(d.document?.title,'Untitled private draft',200),state:d.state==='in_review'?'awaiting_review':'approved',reviewDueAt:canonicalTime(d.reviewDueAt),reviewDateState,waitingDays:elapsedDays(d.updatedAt,clock),authorAvailable,reviewerAvailable,authorName:text(d.authorName,'Author',80),reviewerName:reviewer?text(reviewer.name,'Reviewer',80):null,affectedCohorts:[],reasons,nextStep,destination:{view:'teams',section:'content',id:d.id}});
    }
  }
  const priority:Record<ContentReadinessItem['state'],number>={retired:0,publication_review_elapsed:1,publication_date_unknown:2,awaiting_review:3,approved:4,publication_review_soon:5};
  contentRows.sort((a,b)=>priority[a.state]-priority[b.state]||Number(b.reviewerAvailable===false)-Number(a.reviewerAvailable===false)||(a.reviewDueAt?Date.parse(a.reviewDueAt):Infinity)-(b.reviewDueAt?Date.parse(b.reviewDueAt):Infinity)||a.id.localeCompare(b.id));
  const supportRows:SupportReadinessItem[]=[];
  for(const r of queue){
    if(!['open','resolved','withdrawn'].includes(r.status))return null;
    if(r.status!=='open')continue;
    if(!categories.has(r.category)||(r.handlerName!==null&&typeof r.handlerName!=='string')||typeof r.eligibleHandlerAvailable!=='boolean')return null;
    const co=r.cohortId===null?null:scopedById.get(r.cohortId);
    if(!owner&&(!co||!['learning','content'].includes(r.category)))continue;
    if(r.cohortId!==null&&!identifier(r.cohortId))return null;
    supportRows.push({id:r.id,category:r.category,cohortTitle:co?text(co.title,'Unnamed cohort',100):r.cohortId===null?'Workspace support':text(r.cohortTitle,'Former cohort',100),openedDaysAgo:elapsedDays(r.createdAt,clock),needsHandler:r.handlerName===null,independentHandlerAvailable:r.eligibleHandlerAvailable===true,destination:{view:'support',section:'queue',id:r.id}});
  }
  supportRows.sort((a,b)=>Number(b.needsHandler)-Number(a.needsHandler)||(b.openedDaysAgo??-1)-(a.openedDaysAgo??-1)||a.id.localeCompare(b.id));
  return {workspaceId,audience:owner?'owner':'facilitator',asOf:now,counts:{scopedCohorts:cohortRows.length,pausedCohorts:cohortRows.filter(c=>c.state==='paused').length,contentEnrollmentBlocked:cohortRows.filter(c=>c.newContentEnrollment==='blocked_in_snapshot').length,contentStatusUnknown:cohortRows.filter(c=>c.newContentEnrollment==='unknown').length,retiredPublications:contentRows.filter(c=>c.state==='retired').length,elapsedPublicationReviews:contentRows.filter(c=>c.state==='publication_review_elapsed').length,pendingDraftReviews:contentRows.filter(c=>c.state==='awaiting_review').length,reviewerUnavailable:contentRows.filter(c=>c.reviewerAvailable===false).length,authorUnavailable:contentRows.filter(c=>c.authorAvailable===false).length,openAccessRequests:supportRows.filter(r=>r.category==='accessibility').length,supportNeedsHandler:supportRows.filter(r=>r.needsHandler).length},cohorts:cohortRows,content:{visible:owner,totalAttention:contentRows.length,items:contentRows.slice(0,READINESS_LIMITS.rows)},support:{totalOpen:supportRows.length,items:supportRows.slice(0,READINESS_LIMITS.rows)},operatingBoundary:{pausePermission:owner?'current_workspace_owners':'ask_current_workspace_owner',workplaceEscalationOwner:'not_recorded',staffedResponseTime:'not_established',languageRequests:'private_unless_requester_includes_them'}};
}

export type LearningHelpChoices={includeRequestedLanguage:boolean;includeAssistancePreference:boolean;includeCourse:boolean};
export type OwnLearningHelpInput={preferences:{preferredLanguage:string;assistancePreference:'none'|'read-text'|'capture-response'};course:{title:string;language:string;cohortId:string|null}|null;choices:LearningHelpChoices};
export type LearningHelpDraft={category:'accessibility';cohortId:string|null;subject:string;body:string};
/** Input must be the caller's own permitted profile. Returned draft is unsent;
 * filling/acknowledging the ordinary support intake remains a deliberate step. */
export function prepareOwnLearningHelp(input:OwnLearningHelpInput):LearningHelpDraft{
  const c=input.choices;
  if(Object.values(c).some(v=>typeof v!=='boolean')||Object.keys(c).sort().join(',')!=='includeAssistancePreference,includeCourse,includeRequestedLanguage')throw new Error('Choose exactly what you want to include.');
  const lines=['I would like help with access to learning. Please explain what is currently available and the next step.'];
  if(c.includeRequestedLanguage){if(!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.preferences.preferredLanguage)||input.preferences.preferredLanguage.length>35)throw new Error('Review the saved language request before including it.');lines.push('My requested learning language: '+input.preferences.preferredLanguage+'.');}
  if(c.includeAssistancePreference){const labels={none:'No reading or response-capture help requested.', 'read-text':'I would like help reading the lesson.', 'capture-response':'I would like help capturing my own response, with my meaning read back to me.'};if(!Object.hasOwn(labels,input.preferences.assistancePreference))throw new Error('Review the saved help preference before including it.');lines.push(labels[input.preferences.assistancePreference]);}
  let cohortId:string|null=null;
  if(c.includeCourse){if(!input.course||!identifier(input.course.title,200)||!identifier(input.course.language,35)||(input.course.cohortId!==null&&!identifier(input.course.cohortId)))throw new Error('Choose the current course before including it.');cohortId=input.course.cohortId;lines.push('Course: '+input.course.title+'. Saved course language: '+input.course.language+'.');}
  lines.push('This asks about available help. It does not request a changed assessment standard or claim an approved translation, helper or accommodation.');
  return {category:'accessibility',cohortId,subject:'Learning access support',body:lines.join('\n\n')};
}
