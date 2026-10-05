/** Read-only explanations of the personal-lab simulator. Never an authority or transport. */
import {
  ADAPTERS, RETURN_CONTRACT, RETURN_SCOPES, SCOPED_LIMITS, TEST_PURPOSE,
  adapter, canonicalTime, ensureUniqueActiveChoices, grantStatus,
  readTestGrants, readTestReceipts, type AdapterId, type ReturnScope, type TestGrant,
} from './academy-ecosystems';
import {curriculumRegistry, resolvePinnedContent, type CurriculumRegistry} from './academy-curriculum';

export const INSPECTION_FORMAT = 'aplyd.local-choice-inspection/1' as const;
export const DISCUSSION_FORMAT = 'aplyd.partner-discussion-brief/1' as const;
export const ENVELOPE_FIELDS = [
  'contract_version','mode','partner','event_id','occurred_at','enrollment_ref',
  'pathway_id','content_version','purpose','scopes',
] as const;
export const SUMMARY_FIELDS = {
  'learning.progress': ['learning.completed_lessons', 'learning.total_lessons', 'learning.status'],
  'practice.record': ['practice_record.status', 'practice_record.claim_type', 'practice_record.review_mode'],
} as const;
export const EXCLUDED_FIELDS = [
  'names and contact details', 'private task evidence', 'assessment scores and review notes',
  'goals and reflections', 'support conversations', 'other people’s records',
] as const;

export const ONBOARDING_QUESTIONS = [
  {id:'recipient', title:'Who will receive the summary?', detail:'Identify the partner service and account-link process. Agree how the correct recipient is authenticated.', source:'C5 · consent conversation, §6.7'},
  {id:'purpose', title:'What may they use it for?', detail:'Agree the exact purpose, allowed fields, retention period, and an explanation of what happens when a learner declines.', source:'C5 · consent conversation, §6.7'},
  {id:'contract', title:'Which return contract will both sides support?', detail:'Obtain the partner-owned API specification and version policy. Agree sample acknowledgements, errors, corrections and compatibility tests.', source:'Engineering requirement; no partner specification supplied'},
  {id:'withdrawal', title:'How will stopping or correcting a return work?', detail:'Agree the stop boundary, treatment of in-flight requests, correction of changed practice status, and retention or deletion responsibilities.', source:'C1 · procurement and sunset, §§4.6, 4.15'},
  {id:'authority', title:'Who can pause and resolve a problem?', detail:'Name the operating owner and backup, pause authority, escalation path and tested recovery procedure.', source:'C1 · governance architecture, §4.8'},
  {id:'frontline', title:'What protections are confirmed for the people doing the work?', detail:'Confirm responsibility for failures, written override permission and protection for reporting concerns with the relevant institution.', source:'C5 · OPEN items, §8'},
  {id:'exit', title:'What continues if the partner leaves?', detail:'Agree audit and remediation rights, export and continuity responsibilities, and a funded exit plan where relevant.', source:'C1 · procurement and sunset; C2 · funder conditions, §4.11'},
] as const;

export type SummaryInspection = {
  learning?: {completed_lessons:number;total_lessons:number;status:'in-progress'|'completed'};
  practice_record?: {status:'not-issued'|'active'|'suspended';claim_type:'nonaccredited-practice';review_mode:'not-reviewed'|'sample-workflow'};
};
export type LocalChoiceInspection = {
  status:'active'|'expired'|'withdrawn'; purpose:typeof TEST_PURPOSE;
  contractVersion:typeof RETURN_CONTRACT; contentVersion:string; pathwayId:string;
  scopes:ReturnScope[]; includedFields:string[]; envelopeFields:string[];
  createdAt:string; expiresAt:string; revokedAt:string|null;
};
export type PartnerInspection = {
  format:typeof INSPECTION_FORMAT; partner:AdapterId; partnerName:string;
  liveExchangeEnabled:false; recipientConnected:false; authorizesDelivery:false; authorizesLocalTest:false;
  clockBasis:'informational-only'; inspectedAt:string|null;
  scope:'personal-lab'|'shared'; state:'local-only'|'domain-review-needed'|'shared-unavailable'|'unavailable';
  choice:LocalChoiceInspection|null; legacyPreference:boolean;
  localReadiness:'no-choice'|'inspectable'|'expired'|'withdrawn'|'paused'|'unavailable'|'receipt-limit';
  explanation:string; summary:SummaryInspection|null;
  history:{state:'available'|'unavailable'|'not-inspected';receipts:number|null;lastTestAt:string|null};
  exclusions:readonly string[];
};
export type InspectionInput = {workspace:string; state:unknown; now:string};
type Saved = Record<string,unknown>;
function plain(value:unknown):value is Saved {
  return !!value && typeof value==='object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null);
}
function cloneChoice(g:TestGrant,now:string):LocalChoiceInspection {
  return {status:grantStatus(g,now),purpose:g.purpose,contractVersion:g.contractVersion,
    contentVersion:g.contentVersion,pathwayId:g.contentRef.programId,scopes:[...g.scopes],
    includedFields:g.scopes.flatMap(scope=>[...SUMMARY_FIELDS[scope]]),envelopeFields:[...ENVELOPE_FIELDS],createdAt:g.createdAt,
    expiresAt:g.expiresAt,revokedAt:g.revokedAt};
}
function unavailable(model:PartnerInspection, explanation:string):PartnerInspection {
  return {...model,state:'unavailable',localReadiness:'unavailable',explanation,summary:null};
}

/**
 * Call only with the shell's accepted current projection. This does not authenticate
 * an actor, validate an HTTP acknowledgement, or replace server command checks.
 * Shared scope is returned before inspecting any supplied private state.
 */
export function derivePartnerInspection(
  input:InspectionInput, partner:unknown, registry:CurriculumRegistry=curriculumRegistry,
):PartnerInspection {
  const a=adapter(partner);
  let model:PartnerInspection={format:INSPECTION_FORMAT,partner:a.id,partnerName:a.name,
    liveExchangeEnabled:false,recipientConnected:false,authorizesDelivery:false,authorizesLocalTest:false,
    clockBasis:'informational-only',inspectedAt:null,scope:input.workspace==='lab'?'personal-lab':'shared',
    state:'local-only',choice:null,legacyPreference:false,localReadiness:'no-choice',
    explanation:'No explicit local test choice is saved. Earlier preview preferences do not create a choice.',
    summary:null,history:{state:'not-inspected',receipts:null,lastTestAt:null},exclusions:EXCLUDED_FIELDS};
  if(input.workspace!=='lab')return {...model,state:'shared-unavailable',explanation:'Ecosystem contract tests belong in the personal lab. Shared workspace records are not inspected here.'};
  if(!plain(input.state))return unavailable(model,'Saved personal-lab data is unavailable for inspection.');
  const state=input.state;
  model.legacyPreference=plain(state.connections)&&Object.hasOwn(state.connections,a.id)&&state.connections[a.id]===true;
  if(a.status!=='test-only')return {...model,state:'domain-review-needed',explanation:'Health Saha has no mapped pathway or return controls. Domain, privacy and institutional review are still required.'};
  try {model.inspectedAt=canonicalTime(input.now,'Inspection time');}
  catch {return unavailable(model,'The inspection time is unavailable. The server still decides expiry and permission when a command is saved.');}
  let grants:TestGrant[];
  try {grants=readTestGrants(state.ecosystemGrants);ensureUniqueActiveChoices(grants,input.now);}
  catch {return unavailable(model,'Saved local choices are unavailable. No choice or summary has been inferred from an earlier preference.');}
  // Active choice first; otherwise the most recently created retained choice.
  // This does not rely on the JSON array's historical ordering for authority.
  const candidates=grants.filter(g=>g.partner===a.id);
  const g=candidates.find(g=>grantStatus(g,input.now)==='active')
    ?? [...candidates].sort((x,y)=>Date.parse(y.createdAt)-Date.parse(x.createdAt))[0];
  if(g)model.choice=cloneChoice(g,input.now);
  let allReceiptCount=0;
  try {
    const allReceipts=readTestReceipts(state.ecosystemReceipts,grants,input.now);
    allReceiptCount=allReceipts.length;
    const receipts=allReceipts.filter(r=>r.partner===a.id);
    model.history={state:'available',receipts:receipts.length,
      lastTestAt:receipts.length?[...receipts].sort((x,y)=>Date.parse(y.createdAt)-Date.parse(x.createdAt))[0].createdAt:null};
  } catch {
    return unavailable({...model,history:{state:'unavailable',receipts:null,lastTestAt:null}},
      'Saved receipt history is unavailable. A valid saved choice can still be withdrawn; receipt data is not displayed or used to infer permission.');
  }
  if(!g)return model;
  if(model.choice!.status!=='active')return {...model,localReadiness:model.choice!.status,
    explanation:'This choice has stopped allowing new local tests. Earlier receipts remain historical snapshots; no partner was contacted.'};
  if(!Array.isArray(state.enrollments)||!Array.isArray(state.paused)||state.paused.some(p=>typeof p!=='string'))
    return unavailable(model,'Current saved learning is unavailable. The retained choice and receipts have not been changed.');
  const matches=state.enrollments.filter(e=>plain(e)&&e.id===g.enrollmentId);
  if(matches.length!==1||!plain(matches[0]))return unavailable(model,'This choice no longer has one matching saved enrollment.');
  const e=matches[0];
  if(e.withdrawn!==false)return {...model,localReadiness:'withdrawn',explanation:'The saved learning has been withdrawn. Its retained choice and receipts do not permit a new local test.'};
  if(state.paused.includes(a.pathwayId))return {...model,localReadiness:'paused',explanation:'The mapped pathway is paused. Earlier receipts remain unchanged and withdrawal is still available.'};
  try {
    const snapshot=resolvePinnedContent(e,['global'],registry);
    if(snapshot.ref.programId!==a.pathwayId||snapshot.ref.programId!==g.contentRef.programId
      ||snapshot.ref.versionId!==g.contentVersion||e.version!==g.contentVersion
      ||snapshot.program.id!==snapshot.ref.programId)throw new Error('pin mismatch');
    const lessonIds=new Set(snapshot.program.lessons.map(l=>l.id));
    if(snapshot.program.lessons.length<1||snapshot.program.lessons.length>100
      ||!Array.isArray(e.completed)||new Set(e.completed).size!==e.completed.length
      ||e.completed.some(id=>typeof id!=='string'||!lessonIds.has(id)))throw new Error('progress mismatch');
    const summary:SummaryInspection={};
    if(g.scopes.includes('learning.progress'))summary.learning={completed_lessons:e.completed.length,
      total_lessons:snapshot.program.lessons.length,status:e.completed.length===snapshot.program.lessons.length?'completed':'in-progress'};
    if(g.scopes.includes('practice.record')) {
      if(e.record!==undefined&&e.record!==null&&!plain(e.record))throw new Error('record shape');
      const record=plain(e.record)?e.record:null,status=record?.status??'not-issued';
      if(!['not-issued','active','suspended'].includes(status as string)||record?.workspaceId
        ||((status==='not-issued')!==(record===null)))throw new Error('record authority');
      summary.practice_record={status:status as 'not-issued'|'active'|'suspended',
        claim_type:'nonaccredited-practice',review_mode:record?'sample-workflow':'not-reviewed'};
    }
    if(allReceiptCount>=SCOPED_LIMITS.receipts)return {...model,localReadiness:'receipt-limit',
      explanation:'The retained local receipt limit is reached. Previous receipts remain and a valid choice can still be withdrawn.'};
    return {...model,localReadiness:'inspectable',summary,
      explanation:'These are the fields a local test would inspect now. This preview does not authorize a test or a live return; the server rechecks the saved choice and learning on every command.'};
  } catch {
    return unavailable(model,'The exact pinned personal-lab learning or selected summary is unavailable. Current content is not substituted for a missing historical version.');
  }
}

/** Generic contract discussion brief, intentionally independent of any learner snapshot. */
export function buildPartnerDiscussionBrief(partner:unknown) {
  const a=adapter(partner);
  return {format:DISCUSSION_FORMAT,partner:a.id,partnerName:a.name,
    mode:'discussion-only' as const,liveExchangeEnabled:false as const,
    recipientConnected:false as const,notPermission:true as const,
    localContractVersion:RETURN_CONTRACT,localPurpose:TEST_PURPOSE,
    mapping:a.pathwayId?{scope:'global' as const,pathwayId:a.pathwayId}:null,
    supportedLocalSummaryFields:a.status==='test-only'?RETURN_SCOPES.flatMap(scope=>[...SUMMARY_FIELDS[scope]]):[],
    fixedLocalEnvelopeFields:a.status==='test-only'?[...ENVELOPE_FIELDS]:[],
    excludedFields:[...EXCLUDED_FIELDS],
    missingPartnerDecisions:ONBOARDING_QUESTIONS.map(q=>({...q,status:'not-established' as const})),
    domainReviewRequired:a.id==='health',
    note:'This generic brief contains no learner identity, enrollment, choice, receipt, progress, record status, expiry or private evidence. It is not a consent record or a delivery receipt. Supplied teaching references confer no institutional authority.'};
}

export const READINESS_ADAPTERS=ADAPTERS;
