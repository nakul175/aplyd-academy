/** Isolated candidate: private status snapshots, not certificates, signatures or access grants. */
import {pinnedRef,tryResolvePinnedContent,deepFreeze,type ContentRef,type ContentContext} from './academy-curriculum';
import {scoreDecision} from './academy-engine';
export class RecordCheckError extends Error{constructor(message:string,public status=409){super(message);this.name='RecordCheckError'}}
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const bounded=(v:unknown,n=200):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const refString=(v:unknown):v is string=>bounded(v,120)&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
function exactRequest(value:unknown,key:'recordId'|'decisionId'){
 if(!plain(value)||Object.keys(value).length!==1||!Object.hasOwn(value,key)||!refString(value[key]))throw new RecordCheckError('Use the exact private '+key+' reference.',400);
 return value[key] as string;
}
function iso(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value}
export type RecordCheckContext=Readonly<{actorId:string;learnerId:string;space:'personal'|'shared';workspaceId:string|null;revision:number;checkedAt:string;content:ContentContext}>;
function checkContext(c:RecordCheckContext){
 if(!bounded(c.actorId)||!bounded(c.learnerId)||!['personal','shared'].includes(c.space)||!Number.isSafeInteger(c.revision)||c.revision<0||!iso(c.checkedAt)||(c.space==='personal'?c.workspaceId!==null:!refString(c.workspaceId)))throw new RecordCheckError('The authenticated record-check context is unavailable.',400);
}
function canonical(value:any,seen=new Set<object>()):string{
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if((!Array.isArray(value)&&!plain(value))||seen.has(value))throw new RecordCheckError('The snapshot contains unsupported values.');
 seen.add(value);
 const text=Array.isArray(value)?'['+value.map(v=>canonical(v,seen)).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],seen)).join(',')+'}';
 seen.delete(value);return text;
}
export async function snapshotChecksum(value:unknown):Promise<string>{
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export type DecisionMetadata=Readonly<{decisionId:string;kind:'assessment'|'appeal';attemptId:string;appealId:string|null;actorRef:string;actorDisplay:string;decidedAt:string;mode:string;passed:boolean}>;
const decisionKeys=['id','score','passed','scores','gates','notes','feedback','actor','actorName','decidedAt','mode','method','accommodationsConsidered'];
function decision(d:any,kind:'assessment'|'appeal',attemptId:string,appealId:string|null,program:any,context:RecordCheckContext):DecisionMetadata{
 if(!plain(d)||Object.keys(d).some(k=>!decisionKeys.includes(k))||!refString(d.id)||!bounded(d.actor)||!iso(d.decidedAt)||Date.parse(d.decidedAt)>Date.parse(context.checkedAt)||typeof d.passed!=='boolean'||!Number.isFinite(d.score)||!Array.isArray(d.notes)||d.notes.length!==program.practicalAssessment.rubric.length||d.notes.some((n:any)=>typeof n!=='string'||n.trim().length<10||n.length>3000)||typeof d.feedback!=='string'||d.feedback.trim().length<30||d.feedback.length>3000||(d.actorName!==undefined&&!bounded(d.actorName,80)))throw new RecordCheckError('The saved decision metadata needs inspection.');
 let expected;try{expected=scoreDecision(program,d.scores,d.gates)}catch{throw new RecordCheckError('The saved decision does not match its exact rubric.')}
 if(d.score!==expected.score||d.passed!==expected.passed)throw new RecordCheckError('The saved decision and exact rubric disagree.');
 const expectedMode=context.space==='personal'?(kind==='assessment'?'manual sample-assessor review':'manual sample-reviewer appeal'):(kind==='assessment'?'authenticated assigned assessment':'authenticated independent appeal');
 if(d.mode!==expectedMode||(context.space==='personal'&&d.actor!==(kind==='assessment'?'assessor-a':'reviewer-b'))||(context.space==='shared'&&d.actor===context.learnerId))throw new RecordCheckError('The saved review provenance does not match this learning space.');
 return Object.freeze({decisionId:d.id,kind,attemptId,appealId,actorRef:d.actor,actorDisplay:context.space==='personal'?(kind==='assessment'?'Sample Assessor A':'Sample Reviewer B'):(d.actorName??'Assigned staff'),decidedAt:d.decidedAt,mode:d.mode,passed:d.passed});
}
function recordShape(r:any,context:RecordCheckContext,ref:ContentRef,program:any){
 const keys=['id','issuedAt','title','claim','issuer','contentVersion','kind','status','share','workspaceId','reviewedBy','decisionId','lastReviewedAt'];
 if(!plain(r)||Object.keys(r).some(k=>!keys.includes(k))||!refString(r.id)||!iso(r.issuedAt)||Date.parse(r.issuedAt)>Date.parse(context.checkedAt)||!bounded(r.title,300)||!bounded(r.claim,3000)||!bounded(r.issuer,200)||r.contentVersion!==ref.versionId||!['active','suspended'].includes(r.status)||typeof r.share!=='boolean'||r.title!==program.title||r.claim!==program.credentialClaim)throw new RecordCheckError('The stored practice record does not match its pinned learning.');
 if(context.space==='personal'){
  if(r.kind!=='Nonaccredited practice completion'||r.issuer!=='Aplyd Academy · private practice workspace'||['workspaceId','decisionId','lastReviewedAt','reviewedBy'].some(k=>Object.hasOwn(r,k)))throw new RecordCheckError('The stored sample record has unsupported issuer metadata.');
 }else if(r.kind!=='Reviewed practice record · draft learning content, nonaccredited'||!r.issuer.endsWith(' · Aplyd Academy')||r.workspaceId!==context.workspaceId||!refString(r.decisionId)||!iso(r.lastReviewedAt)||(r.reviewedBy!==undefined&&!bounded(r.reviewedBy,80)))throw new RecordCheckError('The stored workspace review metadata is incomplete.');
}
function history(e:any,program:any,context:RecordCheckContext){
 if(!Array.isArray(e.attempts)||e.attempts.length<1||e.attempts.length>3||!Array.isArray(e.appeals)||e.appeals.length>3)throw new RecordCheckError('The retained review history needs inspection.');
 const attempts=new Map<string,any>(),appeals=new Map<string,any>(),ids=new Set<string>(),timeline:DecisionMetadata[]=[];let pendingAssessment=false;
 for(const [index,a]of e.attempts.entries()){
  if(!plain(a)||!refString(a.id)||attempts.has(a.id)||a.number!==index+1||!iso(a.submittedAt)||Date.parse(a.submittedAt)>Date.parse(context.checkedAt))throw new RecordCheckError('The retained attempt references need inspection.');
  attempts.set(a.id,a);ids.add(a.id);if(a.decision==null){if(pendingAssessment||index!==e.attempts.length-1)throw new RecordCheckError('The pending attempt is not the latest attempt.');pendingAssessment=true;}
 }
 let openAppeal=false;
 for(const ap of e.appeals){
  const a=attempts.get(ap?.attemptId);
  if(!plain(ap)||!refString(ap.id)||ids.has(ap.id)||!a?.decision||appeals.has(ap.attemptId)||!['open','resolved'].includes(ap.status)||!iso(ap.createdAt)||Date.parse(ap.createdAt)>Date.parse(context.checkedAt)||(ap.status==='open'?ap.resolution!==undefined:!plain(ap.resolution)))throw new RecordCheckError('The retained appeal references need inspection.');
  ids.add(ap.id);appeals.set(ap.attemptId,ap);if(ap.status==='open'){if(openAppeal||a!==e.attempts.at(-1))throw new RecordCheckError('The open appeal is not the latest attempt.');openAppeal=true;}
 }
 for(const [index,a]of e.attempts.entries()){
  const previous=timeline.at(-1);if(index>0&&(!previous||previous.passed||Date.parse(a.submittedAt)<Date.parse(previous.decidedAt)))throw new RecordCheckError('The retry history is not sequential or follows an active completion.');
  if(!a.decision)continue;
  const initial=decision(a.decision,'assessment',a.id,null,program,context);if(ids.has(initial.decisionId)||Date.parse(initial.decidedAt)<Date.parse(a.submittedAt))throw new RecordCheckError('The retained decision references need inspection.');ids.add(initial.decisionId);timeline.push(initial);
  const ap=appeals.get(a.id);
  if(ap){
   if(Date.parse(ap.createdAt)<Date.parse(initial.decidedAt))throw new RecordCheckError('The appeal precedes its original decision.');
   if(ap.status==='resolved'){
    const resolved=decision(ap.resolution,'appeal',a.id,ap.id,program,context);
    if(ids.has(resolved.decisionId)||resolved.actorRef===initial.actorRef||Date.parse(resolved.decidedAt)<Date.parse(ap.createdAt))throw new RecordCheckError('The retained independent appeal provenance needs inspection.');ids.add(resolved.decisionId);timeline.push(resolved);
   }
  }
 }
 if(openAppeal&&pendingAssessment)throw new RecordCheckError('Pending assessment and appeal history disagree.');
 const firstPassing=timeline.find(d=>d.passed),effective=timeline.at(-1);
 if(!firstPassing||!effective)throw new RecordCheckError('A practice record has no retained passing decision.');
 return {timeline,firstPassing,effective,openAppeal,pendingAssessment};
}
export type RecordStatusResult=Readonly<{outcome:'unavailable';message:string}|{outcome:'checked';snapshot:any;integrity:Readonly<{algorithm:'SHA-256';checksum:string;meaning:string}>}>;
const unavailable=(message:string):RecordStatusResult=>Object.freeze({outcome:'unavailable',message});
export const checksumMeaning='Checksum of this private snapshot only; not a signature, issuer approval, public credential verification or guarantee of later status.';
/** API caller supplies only the authenticated learner's CURRENT own state, never another learner document. */
export async function lookupOwnPracticeRecord(state:any,request:unknown,context:RecordCheckContext):Promise<RecordStatusResult>{
 checkContext(context);const recordId=exactRequest(request,'recordId');
 if(context.actorId!==context.learnerId)throw new RecordCheckError('This private record is unavailable for your account.',404);
 if(!plain(state)||!Array.isArray(state.enrollments))throw new RecordCheckError('Your saved learning needs a format review.');
 const matches=state.enrollments.filter((e:any)=>plain(e)&&plain(e.record)&&e.record.id===recordId);
 if(!matches.length)throw new RecordCheckError('This private record is unavailable for your account.',404);
 if(matches.length!==1)return unavailable('Duplicate private record references need inspection. Export your own workspace for support.');
 const e=matches[0],resolved=tryResolvePinnedContent(e,context.content.allowedScopes,context.content.registry);
 if(!resolved.available)return unavailable('The exact saved course is unavailable. Your own stored record remains available in your workspace export; its rubric status was not checked.');
 try{
  const ref=pinnedRef(e),program=resolved.snapshot.program,r=e.record;
  if(!refString(e.id)||e.withdrawn||!Array.isArray(e.completed)||e.completed.length!==program.lessons.length||new Set(e.completed).size!==e.completed.length||program.lessons.some(l=>!e.completed.includes(l.id)))throw new RecordCheckError('The record enrollment needs inspection.');
  recordShape(r,context,ref,program);const h=history(e,program,context),expectedStatus=h.effective.passed?'active':'suspended';
  if(r.status!==expectedStatus||(r.status==='active'&&h.pendingAssessment)||r.issuedAt!==h.firstPassing.decidedAt||(context.space==='shared'&&(r.decisionId!==h.effective.decisionId||r.lastReviewedAt!==h.effective.decidedAt||r.reviewedBy!==h.effective.actorDisplay)))throw new RecordCheckError('The stored record and effective review history disagree.');
  const snapshot=deepFreeze({schemaVersion:1,kind:'private-practice-record-status',recordId:r.id,enrollmentId:e.id,space:context.space,workspaceId:context.workspaceId,contentRef:ref,contentLanguage:resolved.snapshot.language,contentFingerprint:await snapshotChecksum(program),title:r.title,claim:r.claim,exclusions:[...program.credentialExclusions],classification:'Nonaccredited practice record',issuerDisplay:r.issuer,issuerAuthority:'Workspace display label only; no recognised issuer authority asserted',status:r.status,hasOpenAppeal:h.openAppeal,hasPendingAssessment:h.pendingAssessment,issuedAt:r.issuedAt,checkedAt:context.checkedAt,asOfRevision:context.revision,firstPassingDecision:h.firstPassing,effectiveDecision:h.effective,decisionHistory:h.timeline,limitations:['Private authenticated saved-state check only','Personal sample reviews remain sample when space is personal','No raw evidence, drafts, private feedback, email or support notes in this snapshot','Recheck current saved state after an appeal or new decision']});
  return deepFreeze({outcome:'checked',snapshot,integrity:{algorithm:'SHA-256',checksum:await snapshotChecksum(snapshot),meaning:checksumMeaning}});
 }catch(e){if(e instanceof RecordCheckError)return unavailable('The stored record or retained review history needs inspection. Your own workspace export is retained; no validated status snapshot was produced.');throw e}
}
/** Only a CURRENT canonical projectTeam projection is admissible; historical actor/owner role is insufficient. */
export async function lookupAssignedDecision(projection:any,request:unknown,context:RecordCheckContext):Promise<RecordStatusResult>{
 checkContext(context);const decisionId=exactRequest(request,'decisionId'),team=projection?.team;
 if(context.space!=='shared'||!plain(team)||team.currentUserId!==context.actorId||team.id!==context.workspaceId||team.active!==true||!Array.isArray(team.assigned))throw new RecordCheckError('This assigned decision is unavailable for your account.',404);
 const matches=team.assigned.filter((q:any)=>q?.kind==='appeal'&&q.ap?.status==='open'&&q.a?.decision?.id===decisionId&&q.targetId===q.ap.id&&q.ap.attemptId===q.a.id&&q.e?.learnerId===context.learnerId);
 if(matches.length!==1)throw new RecordCheckError('This assigned decision is unavailable for your account.',404);
 const q=matches[0],resolved=tryResolvePinnedContent(q.e,context.content.allowedScopes,context.content.registry);
 if(!resolved.available)return unavailable('The exact assigned course is unavailable; its decision rubric was not checked.');
 try{
  if(!refString(q.e.id)||!refString(q.a.id)||!refString(q.ap.id)||!Number.isInteger(q.a.number)||q.a.number<1||q.a.number>3||!iso(q.a.submittedAt)||!iso(q.ap.createdAt)||Date.parse(q.ap.createdAt)>Date.parse(context.checkedAt)||q.ap.resolution!==undefined)throw new RecordCheckError('The assigned appeal references need inspection.');
  const original=decision(q.a.decision,'assessment',q.a.id,null,resolved.snapshot.program,context);
  if(original.actorRef===context.actorId||context.actorId===context.learnerId||new Set([q.a.id,q.ap.id,original.decisionId]).size!==3||Date.parse(original.decidedAt)<Date.parse(q.a.submittedAt)||Date.parse(q.ap.createdAt)<Date.parse(original.decidedAt))throw new RecordCheckError('The assigned appeal is not independent or its timeline disagrees.');
  const snapshot=deepFreeze({schemaVersion:1,kind:'private-assigned-original-decision',workspaceId:context.workspaceId,enrollmentId:q.e.id,contentRef:pinnedRef(q.e),contentFingerprint:await snapshotChecksum(resolved.snapshot.program),classification:'Nonaccredited practice decision',decision:original,openAssignedAppealId:q.ap.id,checkedAt:context.checkedAt,asOfRevision:context.revision,limitations:['Only the original decision already present in the current assigned appeal is checked','No current practice-record status or other learner history is disclosed','No raw evidence, notes, feedback, email or public bearer URL','Current assignment/role must be rechecked by the API on each request']});
  return deepFreeze({outcome:'checked',snapshot,integrity:{algorithm:'SHA-256',checksum:await snapshotChecksum(snapshot),meaning:checksumMeaning}});
 }catch(e){if(e instanceof RecordCheckError)return unavailable('The assigned decision metadata needs inspection; no validated snapshot was produced.');throw e}
}
