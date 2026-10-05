/** Strict response projection and digest checks. Not an issuer signature or a permission grant. */
import {contentRef,contentKey,deepFreeze,type ContentRef} from './academy-curriculum';
import {snapshotChecksum,checksumMeaning,type DecisionMetadata,type RecordStatusResult} from './academy-record-check';

export type OwnRecordSnapshot=Readonly<{
 schemaVersion:1;kind:'private-practice-record-status';recordId:string;enrollmentId:string;space:'personal'|'shared';workspaceId:string|null;
 contentRef:ContentRef;contentLanguage:string;contentFingerprint:string;title:string;claim:string;exclusions:readonly string[];
 classification:'Nonaccredited practice record';issuerDisplay:string;issuerAuthority:'Workspace display label only; no recognised issuer authority asserted';
 status:'active'|'suspended';hasOpenAppeal:boolean;hasPendingAssessment:boolean;issuedAt:string;checkedAt:string;asOfRevision:number;
 firstPassingDecision:DecisionMetadata;effectiveDecision:DecisionMetadata;decisionHistory:readonly DecisionMetadata[];limitations:readonly string[];
}>;
export type AssignedDecisionSnapshot=Readonly<{
 schemaVersion:1;kind:'private-assigned-original-decision';workspaceId:string;enrollmentId:string;contentRef:ContentRef;contentFingerprint:string;
 classification:'Nonaccredited practice decision';decision:DecisionMetadata;openAssignedAppealId:string;checkedAt:string;asOfRevision:number;limitations:readonly string[];
}>;
export type CheckedRecordResult=Readonly<{outcome:'checked';snapshot:OwnRecordSnapshot|AssignedDecisionSnapshot;integrity:Readonly<{algorithm:'SHA-256';checksum:string;meaning:typeof checksumMeaning}>}>;
export type AcceptedRecordResult=Readonly<{outcome:'unavailable';message:string}>|CheckedRecordResult;
export type AcceptedRecordEnvelope=Readonly<{
 format:'aplyd-academy-private-record-check';formatVersion:1;currentUserId:string;workspaceId:string|null;sourceRevision:number;checkedAt:string;
 target:Readonly<{kind:'record'|'decision';id:string}>;result:AcceptedRecordResult;
}>;
export type RecordResponseExpectation=Readonly<{
 accountId:string;workspaceId:string|null;sourceRevision:number;
 /** Trusted pure derivation from the detached captured accepted projection; never from response JSON. */
 deriveExpectedResult:(checkedAt:string)=>Promise<RecordStatusResult>;
 target:Readonly<{kind:'record';id:string;enrollmentId:string;contentRef:ContentRef;contentFingerprint:string}|
 {kind:'decision';id:string;enrollmentId:string;contentRef:ContentRef;contentFingerprint:string;appealId:string;learnerId:string}>;
}>;
export class RecordResponseError extends Error{
 constructor(){super('The private record-check response could not be verified. Refresh saved progress before checking again.');this.name='RecordResponseError'}
}
const reject=():never=>{throw new RecordResponseError()};
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v:unknown,keys:readonly string[]):v is Record<string,any>=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const bounded=(v:unknown,max=300):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const id=(v:unknown):v is string=>bounded(v,120)&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const iso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const rev=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const words=(v:unknown,maxCount:number,maxLength:number)=>Array.isArray(v)&&v.length<=maxCount&&v.every(x=>bounded(x,maxLength));
const ownLimits=['Private authenticated saved-state check only','Personal sample reviews remain sample when space is personal','No raw evidence, drafts, private feedback, email or support notes in this snapshot','Recheck current saved state after an appeal or new decision'];
const assignedLimits=['Only the original decision already present in the current assigned appeal is checked','No current practice-record status or other learner history is disclosed','No raw evidence, notes, feedback, email or public bearer URL','Current assignment/role must be rechecked by the API on each request'];
const equivalent=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sameDecision=(a:DecisionMetadata,b:DecisionMetadata)=>['decisionId','kind','attemptId','appealId','actorRef','actorDisplay','decidedAt','mode','passed'].every(k=>a[k as keyof DecisionMetadata]===b[k as keyof DecisionMetadata]);
function ref(value:unknown,expected:RecordResponseExpectation):ContentRef{
 let actual:ContentRef;try{actual=contentRef(value)}catch{return reject()}
 if((actual.scope!=='global'&&actual.scope!==expected.workspaceId)||contentKey(actual)!==contentKey(expected.target.contentRef))return reject();
 return actual;
}
function decision(value:unknown,expected:RecordResponseExpectation,checkedAt:string):DecisionMetadata{
 if(!exact(value,['decisionId','kind','attemptId','appealId','actorRef','actorDisplay','decidedAt','mode','passed'])
  ||!id(value.decisionId)||!['assessment','appeal'].includes(value.kind)||!id(value.attemptId)
  ||(value.kind==='assessment'?value.appealId!==null:!id(value.appealId))||!bounded(value.actorRef)
  ||!bounded(value.actorDisplay,80)||!iso(value.decidedAt)||Date.parse(value.decidedAt)>Date.parse(checkedAt)||typeof value.passed!=='boolean')return reject();
 const personal=expected.workspaceId===null;
 const expectedMode=personal?(value.kind==='assessment'?'manual sample-assessor review':'manual sample-reviewer appeal'):(value.kind==='assessment'?'authenticated assigned assessment':'authenticated independent appeal');
 if(value.mode!==expectedMode)return reject();
 if(personal&&(value.actorRef!==(value.kind==='assessment'?'assessor-a':'reviewer-b')||value.actorDisplay!==(value.kind==='assessment'?'Sample Assessor A':'Sample Reviewer B')))return reject();
 if(!personal&&(value.actorRef===expected.accountId||(expected.target.kind==='decision'&&value.actorRef===expected.target.learnerId)))return reject();
 return value as DecisionMetadata;
}
function ownSnapshot(value:unknown,e:RecordResponseExpectation,checkedAt:string):OwnRecordSnapshot{
 const keys=['schemaVersion','kind','recordId','enrollmentId','space','workspaceId','contentRef','contentLanguage','contentFingerprint','title','claim','exclusions','classification','issuerDisplay','issuerAuthority','status','hasOpenAppeal','hasPendingAssessment','issuedAt','checkedAt','asOfRevision','firstPassingDecision','effectiveDecision','decisionHistory','limitations'];
 if(!exact(value,keys)||e.target.kind!=='record'||value.schemaVersion!==1||value.kind!=='private-practice-record-status'
  ||value.recordId!==e.target.id||value.enrollmentId!==e.target.enrollmentId||value.workspaceId!==e.workspaceId
  ||value.space!==(e.workspaceId===null?'personal':'shared')||!bounded(value.contentLanguage,50)||value.contentFingerprint!==e.target.contentFingerprint
  ||!bounded(value.title,300)||!bounded(value.claim,3000)||!words(value.exclusions,30,1000)
  ||value.classification!=='Nonaccredited practice record'||!bounded(value.issuerDisplay,200)
  ||value.issuerAuthority!=='Workspace display label only; no recognised issuer authority asserted'
  ||!['active','suspended'].includes(value.status)||typeof value.hasOpenAppeal!=='boolean'||typeof value.hasPendingAssessment!=='boolean'
  ||(value.hasOpenAppeal&&value.hasPendingAssessment)||(value.status==='active'&&value.hasPendingAssessment)
  ||!iso(value.issuedAt)||value.checkedAt!==checkedAt||value.asOfRevision!==e.sourceRevision
  ||!Array.isArray(value.decisionHistory)||value.decisionHistory.length<1||value.decisionHistory.length>6
  ||!equivalent(value.limitations,ownLimits))return reject();
 ref(value.contentRef,e);
 const decisions=value.decisionHistory.map((d:unknown)=>decision(d,e,checkedAt));
 const unique=new Set(decisions.map((d:DecisionMetadata)=>d.decisionId));if(unique.size!==decisions.length)return reject();
 for(let i=1;i<decisions.length;i++)if(Date.parse(decisions[i].decidedAt)<Date.parse(decisions[i-1].decidedAt))return reject();
 const first=decisions.find((d:DecisionMetadata)=>d.passed),last=decisions.at(-1)!;
 const firstDeclared=decision(value.firstPassingDecision,e,checkedAt),effectiveDeclared=decision(value.effectiveDecision,e,checkedAt);
 if(!first||!sameDecision(first,firstDeclared)||!sameDecision(last,effectiveDeclared)||value.issuedAt!==first.decidedAt
  ||value.status!==(last.passed?'active':'suspended'))return reject();
 for(const d of decisions){if(d.kind==='appeal'){
   const original=decisions.find((x:DecisionMetadata)=>x.kind==='assessment'&&x.attemptId===d.attemptId);
   if(!original||original.actorRef===d.actorRef||Date.parse(d.decidedAt)<Date.parse(original.decidedAt))return reject();
  }}
 return value as OwnRecordSnapshot;
}
function assignedSnapshot(value:unknown,e:RecordResponseExpectation,checkedAt:string):AssignedDecisionSnapshot{
 if(!exact(value,['schemaVersion','kind','workspaceId','enrollmentId','contentRef','contentFingerprint','classification','decision','openAssignedAppealId','checkedAt','asOfRevision','limitations'])
  ||e.target.kind!=='decision'||e.workspaceId===null||value.schemaVersion!==1||value.kind!=='private-assigned-original-decision'
  ||value.workspaceId!==e.workspaceId||value.enrollmentId!==e.target.enrollmentId||value.openAssignedAppealId!==e.target.appealId
  ||value.contentFingerprint!==e.target.contentFingerprint||value.classification!=='Nonaccredited practice decision'||value.checkedAt!==checkedAt||value.asOfRevision!==e.sourceRevision
  ||!equivalent(value.limitations,assignedLimits))return reject();
 ref(value.contentRef,e);const original=decision(value.decision,e,checkedAt);
 if(original.kind!=='assessment'||original.decisionId!==e.target.id)return reject();
 return value as AssignedDecisionSnapshot;
}

/** Caller MUST also fence account/workspace/authority epoch/revision/request sequence before and after await. */
export async function acceptRecordCheckEnvelope(value:unknown,expected:RecordResponseExpectation):Promise<AcceptedRecordEnvelope>{
 if(typeof expected.deriveExpectedResult!=='function'||!bounded(expected.accountId)||!rev(expected.sourceRevision)||!id(expected.target.id)||!id(expected.target.enrollmentId)||!hex(expected.target.contentFingerprint)
  ||(expected.workspaceId!==null&&!/^tw-[a-z0-9-]{20,80}$/i.test(expected.workspaceId))
  ||(expected.target.kind==='decision'&&(!id(expected.target.appealId)||!bounded(expected.target.learnerId)||expected.workspaceId===null)))return reject();
 // Detach before hashing or local derivation so an await cannot expose caller-owned body edits.
 try{value=structuredClone(value)}catch{return reject()}
 if(!exact(value,['format','formatVersion','currentUserId','workspaceId','sourceRevision','checkedAt','target','result'])
  ||value.format!=='aplyd-academy-private-record-check'||value.formatVersion!==1||value.currentUserId!==expected.accountId
  ||value.workspaceId!==expected.workspaceId||value.sourceRevision!==expected.sourceRevision||!iso(value.checkedAt)
  ||!exact(value.target,['kind','id'])||value.target.kind!==expected.target.kind||value.target.id!==expected.target.id
  ||!plain(value.result))return reject();
 try{contentRef(expected.target.contentRef)}catch{return reject()}
 const result=value.result;
 if(result.outcome==='unavailable'){
  if(!exact(result,['outcome','message'])||!bounded(result.message,1000))return reject();
 }else{
  if(!exact(result,['outcome','snapshot','integrity'])||result.outcome!=='checked'
   ||!exact(result.integrity,['algorithm','checksum','meaning'])||result.integrity.algorithm!=='SHA-256'
   ||!hex(result.integrity.checksum)||result.integrity.meaning!==checksumMeaning)return reject();
  const snapshot=expected.target.kind==='record'?ownSnapshot(result.snapshot,expected,value.checkedAt):assignedSnapshot(result.snapshot,expected,value.checkedAt);
  if(await snapshotChecksum(snapshot)!==result.integrity.checksum)return reject();
 }
 // A carried checksum describes integrity only. Require agreement with every thin field
 // independently derived from the exact same captured saved projection and pinned course.
 // This does not grant authority; the API must still authenticate and authorize each read.
 let derived:RecordStatusResult;
 try{derived=await expected.deriveExpectedResult(value.checkedAt)}catch{return reject()}
 if(!derived||derived.outcome!==result.outcome)return reject();
 try{if(await snapshotChecksum(derived)!==await snapshotChecksum(result))return reject()}catch{return reject()}
 // Freeze detached validated data; never retain a caller-owned mutable body.
 return deepFreeze(structuredClone(value)) as AcceptedRecordEnvelope;
}
