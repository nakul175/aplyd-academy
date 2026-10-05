import type {JobTemplateOrigin} from './academy-job-templates';
import {
  curriculumRegistry, createCurriculumRegistry, contentRef, pinnedRef,
  programs, LEGACY_CONTENT_VERSION, contentKey,
  type ContentRef, type ContentSnapshot, type ContentScope,
} from './academy-curriculum';

export const AUTHORING_CLASSIFICATION='Private workspace practice draft · nonaccredited';
export const AUTHORING_LIMITS={activeDrafts:4,publications:8,totalDrafts:24,documentBytes:65_536,contentBytes:650_000} as const;
const CLAIM='Demonstrated the published synthetic practice exercise through checked work, careful information handling and human review';
const EXCLUSIONS=['Nonaccredited private practice record','No medical, legal, financial, agricultural or other professional qualification','No authority to make consequential professional decisions'];
const NOTICE='All sources, people, work records and AI drafts in this pathway are fictional teaching fixtures. Submit no actual private work records or credentials.';
export type Issue={path:string;kind:'shape'|'locked'|'limit'|'required'|'consistency';message:string};
export type Draft={templateOrigin?:JobTemplateOrigin;id:string;programId:string;baseRef:ContentRef;authorId:string;authorName:string;state:'draft'|'in_review'|'approved'|'published'|'archived';revision:number;documentRevision:number;document:any;createdAt:string;updatedAt:string;reviewerId?:string;reviewDueAt?:string;approval?:{reviewerId:string;reviewerName:string;documentRevision:number;documentHash:string;reviewedAt:string;note:string;checks:Record<string,boolean>};publishedRef?:ContentRef;history:any[]};
export type Publication={id:string;snapshot:ContentSnapshot&{policy:any};documentHash:string;authorId:string;authorName:string;reviewerId:string;reviewerName:string;reviewedAt:string;publishedBy:string;publishedByName:string;publishedAt:string;reviewDueAt:string;availability:'available'|'retired';retirement?:{reason:string;actor:string;actorName:string;at:string}};
export type AuthoringState={drafts:Draft[];publications:Publication[]};
export type ContentHost={id:string;members:{userId:string;name?:string;active:boolean;roles:string[]}[];content?:AuthoringState};
export type Identity={userId:string};
export class AuthoringError extends Error{constructor(message:string,public status=422){super(message)}}
const savedName=(value:any)=>String(value||'Workspace owner').slice(0,80);
const activeDraft=(d:Draft)=>!['published','archived'].includes(d.state);
const copy=<T>(value:T):T=>structuredClone(value);
export function freshAuthoring():AuthoringState{return {drafts:[],publications:[]}}
export const CONTENT_COMMANDS=['content-copy','content-save','content-submit','content-recall','content-review','content-publish','content-retire','content-archive'] as const;
export function isContentCommand(c:any){return !!c&&CONTENT_COMMANDS.includes(c.type)}
function member(host:ContentHost,user:Identity){const m=host.members.find(m=>m.userId===user.userId);if(!m||!m.active)throw new AuthoringError('This workspace is unavailable for your current account.',404);return m}
function owner(host:ContentHost,user:Identity){const m=member(host,user);if(!m.roles.includes('admin'))throw new AuthoringError('A current workspace owner permission is required.',403);return m}
function exact(c:any,allowed:string[]){if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['type',...allowed].includes(k)))throw new AuthoringError('This content action has unsupported fields.',400)}
function text(v:any,label:string,min:number,max:number){if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new AuthoringError(`${label} needs ${min}–${max} characters.`);return v.trim()}
function scopedRef(host:ContentHost,ref:any){try{const x=contentRef(ref);if(x.scope!=='global'&&x.scope!==host.id)throw new AuthoringError('Content from another workspace is unavailable.',404);return x}catch(e:any){if(e instanceof AuthoringError)throw e;throw new AuthoringError(e.message,e.status??409)}}
export function workspaceRegistry(host:ContentHost){return createCurriculumRegistry([...programs.map(program=>curriculumRegistry.resolve({scope:'global',programId:program.id,versionId:LEGACY_CONTENT_VERSION})),...(host.content?.publications??[]).map(p=>p.snapshot)])}
function resolve(host:ContentHost,ref:ContentRef){try{return workspaceRegistry(host).resolve(scopedRef(host,ref),['global',host.id as ContentScope])}catch(e:any){if(e instanceof AuthoringError)throw e;throw new AuthoringError(e.message,e.status??409)}}
function template(host:ContentHost,draft:Draft){const doc=copy(resolve(host,draft.baseRef).program) as any;doc.id=draft.programId;doc.estimatedMinutes=Math.max(doc.estimatedMinutes,doc.lessons.reduce((sum:number,l:any)=>sum+l.estimatedMinutes,0));doc.credentialClaim=CLAIM;doc.credentialExclusions=copy(EXCLUSIONS);doc.sourceNotice=NOTICE;doc.lessons.forEach((lesson:any)=>{const seen=new Set<string>();lesson.exercise.sourcePacket=lesson.exercise.sourcePacket.map((row:any,index:number)=>{const item=typeof row==='string'?{sourceId:lesson.id+'-source-'+(index+1),content:row}:row;const id=item.sourceId.trim();if(draft.baseRef.scope==='global'&&seen.has(id)&&typeof item.sourceNote==='string'&&/confirmed copied line/i.test(item.sourceNote))item.duplicateOf=id;seen.add(id);return item})});return doc}
function plain(v:any){if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=Object.getPrototypeOf(v);return p===Object.prototype||p===null}

export function canonicalJson(value:any):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
}
export async function documentHash(document:any){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson(document))))).map(x=>x.toString(16).padStart(2,'0')).join('')}

/** Drafts may save blank required text; malformed shapes, changed IDs and over-limit values cannot save. */
export function validateDocument(document:any,expected:any):Issue[]{
 const issues:Issue[]=[],issue=(path:string,kind:Issue['kind'],message:string)=>issues.push({path,kind,message});
 const locked=new Set(['id','ecosystem','role','level','credentialClaim','credentialExclusions','sourceNotice','followUp']);
 function walk(v:any,t:any,path:string){
  if(path.endsWith('.sourcePacket')){
   if(!Array.isArray(v)||v.length<1||v.length>20){issue(path,'shape','Provide 1–20 fictional source records.');return}
   v.forEach((row:any,i:number)=>{
    if(!plain(row)||Object.keys(row).length<2||Object.keys(row).length>15){issue(path+'.'+i,'shape','A source record needs a reference and bounded plain facts.');return}
    if(typeof row.sourceId!=='string'||row.sourceId.trim().length<1||row.sourceId.length>80)issue(path+'.'+i+'.sourceId','shape','Provide a source reference of 1–80 characters.');
    for(const [key,value]of Object.entries(row)){
     if(key.length>60||['__proto__','constructor','prototype'].includes(key)){issue(path+'.'+i,'shape','This source field name is unsupported.');continue}
     if(typeof value==='string'){if(value.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))issue(path+'.'+i+'.'+key,'limit','Keep source facts within 2,000 characters using ordinary text.')}
     else if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e12)issue(path+'.'+i+'.'+key,'shape','Use a finite bounded number.')}
     else if(value!==null&&typeof value!=='boolean')issue(path+'.'+i+'.'+key,'shape','Source facts must be plain text, numbers or simple flags.');
    }
   });return;
  }
  if(Array.isArray(t)){
   if(!Array.isArray(v)){issue(path,'shape','This field must be a list.');return}
   const fixed=/\.(lessons|quiz|options|submissionPrompts|rubric)$/.test(path);
   if((fixed&&v.length!==t.length)||(!fixed&&(v.length<1||v.length>20))){issue(path,'shape',fixed?`This pilot keeps exactly ${t.length} entries here.`:'Provide 1–20 entries.');return}
   v.forEach((child:any,i:number)=>walk(child,fixed?t[i]:t[0],path+'.'+i));return;
  }
  if(t===null){if(v!==null)issue(path,'locked','This pilot preserves the original critical-gate structure.');return}
  if(typeof t==='object'){
   if(!plain(v)){issue(path,'shape','Provide a plain content object.');return}
   if(Object.keys(v).some(k=>!Object.hasOwn(t,k))||Object.keys(t).some(k=>!Object.hasOwn(v,k))){issue(path,'shape','Content fields are missing or unsupported.');return}
   for(const key of Object.keys(t)){
    if((path==='program'&&locked.has(key))||key==='id'){
     if(canonicalJson(v[key])!==canonicalJson(t[key]))issue(path+'.'+key,'locked','Published identity, classification and supported structure are fixed for this pilot.');
    }else walk(v[key],t[key],path+'.'+key);
   }return;
  }
  if(typeof v!==typeof t){issue(path,'shape','This field has an unsupported value type.');return}
  if(typeof v==='string'&&(v.length>12000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)))issue(path,'limit','Use ordinary text within the field limit.');
  if(typeof v==='number'&&!Number.isFinite(v))issue(path,'shape','Use a finite number.');
 }
 walk(document,expected,'program');
 try{if(new TextEncoder().encode(JSON.stringify(document)).length>AUTHORING_LIMITS.documentBytes)issue('program','limit','This pathway exceeds the 64 KiB pilot document limit.')}catch{issue('program','shape','Content must be serializable text and facts.')}
 if(issues.some(x=>['shape','locked','limit'].includes(x.kind)))return issues;
 function required(value:any,path:string,min=10,max=2000){if(typeof value!=='string'||value.trim().length<min)issue(path,'required',`Add at least ${min} characters.`);else if(value.length>max)issue(path,'limit',`Keep this field within ${max} characters.`)}
 function minutes(value:any,path:string){if(!Number.isInteger(value)||value<5||value>720)issue(path,'consistency','Use whole minutes between 5 and 720.')}
 required(document.title,'program.title',3,160);required(document.summary,'program.summary',20,2000);required(document.promise,'program.promise',20,1000);minutes(document.estimatedMinutes,'program.estimatedMinutes');
 for(const key of ['prerequisites','outcomes'])document[key].forEach((v:any,i:number)=>required(v,'program.'+key+'.'+i,10,500));
 if(document.estimatedMinutes<document.lessons.reduce((sum:number,l:any)=>sum+l.estimatedMinutes,0))issue('program.estimatedMinutes','consistency','Total learning time must include all lesson estimates.');
 for(const [i,l]of document.lessons.entries()){
  const base='program.lessons.'+i;required(l.title,base+'.title',3,160);required(l.objective,base+'.objective',20,1000);required(l.lessonText,base+'.lessonText',100,12000);minutes(l.estimatedMinutes,base+'.estimatedMinutes');
  l.steps.forEach((v:any,j:number)=>required(v,base+'.steps.'+j,5,500));required(l.reflectionPrompt,base+'.reflectionPrompt',15,1000);required(l.returnToWorkAction,base+'.returnToWorkAction',30,2000);
  const ex=l.exercise;const sourceIds=new Set<string>();for(const [j,row]of ex.sourcePacket.entries()){const id=row.sourceId.trim();if(sourceIds.has(id)&&!(row.duplicateOf===id&&typeof row.sourceNote==='string'&&row.sourceNote.trim().length>=10))issue(base+'.exercise.sourcePacket.'+j+'.sourceId','consistency','Give distinct sources separate references, or explicitly mark and explain a teaching duplicate.');if(Object.hasOwn(row,'duplicateOf')&&(!sourceIds.has(id)||row.duplicateOf!==id))issue(base+'.exercise.sourcePacket.'+j+'.duplicateOf','consistency','A teaching duplicate must identify an earlier same-reference source.');sourceIds.add(id);if(!Object.entries(row).some(([key,value])=>!['sourceId','duplicateOf','sourceNote','type'].includes(key)&&value!==null&&(typeof value!=='string'||value.trim().length>0)))issue(base+'.exercise.sourcePacket.'+j,'required','Add at least one meaningful fictional source fact.');if(Object.hasOwn(row,'content')&&typeof row.content==='string'&&!row.content.trim())issue(base+'.exercise.sourcePacket.'+j+'.content','required','Add the fictional source text.');}
  for(const key of ['title','suppliedAiDraft','optionalAiPrompt','learnerTask','assessorReference'])required(ex[key],base+'.exercise.'+key,key==='title'?3:30,key==='title'?160:4000);
  ex.expectedEvidence.forEach((v:any,j:number)=>required(v,base+'.exercise.expectedEvidence.'+j,10,700));
  for(const [j,q]of l.quiz.entries()){
   required(q.question,base+'.quiz.'+j+'.question',10,1000);required(q.explanation,base+'.quiz.'+j+'.explanation',20,2000);q.options.forEach((v:any,k:number)=>required(v,base+'.quiz.'+j+'.options.'+k,1,500));
   if(new Set(q.options.map((option:string)=>option.trim())).size!==q.options.length)issue(base+'.quiz.'+j+'.options','consistency','Use four distinct answer options.');
   if(!Number.isInteger(q.correctOptionIndex)||q.correctOptionIndex<0||q.correctOptionIndex>3)issue(base+'.quiz.'+j+'.correctOptionIndex','consistency','Choose one of the four answer options.');
  }
 }
 const a=document.practicalAssessment;required(a.title,'program.practicalAssessment.title',3,160);required(a.scenario,'program.practicalAssessment.scenario',30,5000);
 for(const [i,p]of a.submissionPrompts.entries()){required(p.label,'program.practicalAssessment.submissionPrompts.'+i+'.label',3,160);required(p.help,'program.practicalAssessment.submissionPrompts.'+i+'.help',10,1000)}
 for(const [i,r]of a.rubric.entries()){
  const b='program.practicalAssessment.rubric.'+i;required(r.dimension,b+'.dimension',3,160);if(!Number.isInteger(r.weight)||r.weight<1||r.weight>97)issue(b+'.weight','consistency','Use a positive whole weight, keeping the total at 100.');
  for(const level of ['0','1','2','3','4'])required(r.anchors[level],b+'.anchors.'+level,10,1000);
  if(r.criticalGate!==null)required(r.criticalGate,b+'.criticalGate',30,2000);
 }
 if(a.rubric.reduce((n:number,r:any)=>n+r.weight,0)!==100)issue('program.practicalAssessment.rubric','consistency','Criterion weights must total exactly 100.');
 for(const key of ['samplePassingEvidence','sampleCriticalFailure','assessorNote'])required(a[key],'program.practicalAssessment.'+key,30,5000);
 return issues;
}

function findDraft(host:ContentHost,id:any,revision:any){const d=host.content?.drafts.find(d=>d.id===id);if(!d)throw new AuthoringError('Content draft not found in this workspace.',404);if(!Number.isInteger(revision)||revision!==d.revision)throw new AuthoringError('This content draft changed. Reload its latest revision before saving.',409);return d}
function byAuthor(d:Draft,user:Identity){if(d.authorId!==user.userId)throw new AuthoringError('Only this draft author may edit or submit it.',403)}
function due(value:any,now:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)<=Date.parse(now)||Date.parse(value)>Date.parse(now)+730*86400000)throw new AuthoringError('Choose a future content review date within two years.');return value}
function bump(d:Draft,actor:any,action:string,now:string,note?:string){d.revision++;d.updatedAt=now;d.history.push({id:crypto.randomUUID(),actor:actor.userId,actorName:savedName(actor.name),action,at:now,...(note?{note}:{})});if(d.history.length>(action==='archived private practice draft'?101:100))throw new AuthoringError('This draft reached its pilot history limit. Copy its latest publication or seek support.',409)}
const complete=(issues:Issue[])=>{if(issues.length)throw new AuthoringError('Resolve the content preview issues before requesting review or publishing.')};

/** Awaiting hash is safe only when the caller commits against the same workspace revision/CAS. */
export async function applyWorkspaceContentCommand<T extends ContentHost>(original:T,user:Identity,c:any,now=new Date().toISOString()):Promise<T>{
 if(!isContentCommand(c))throw new AuthoringError('Unknown content action.',400);
 if(!Number.isFinite(Date.parse(now)))throw new AuthoringError('A trusted action time is required.',400);now=new Date(now).toISOString();if(now.length!==24)throw new AuthoringError('A four-digit-year action time is required.',400);
 const t=copy(original),actor=owner(t,user);t.content??=freshAuthoring();
 switch(c.type){
 case 'content-copy':{
  exact(c,['sourceRef']);if(t.content.drafts.filter(activeDraft).length>=AUTHORING_LIMITS.activeDrafts)throw new AuthoringError('This pilot supports four active content drafts per workspace.',409);
  if(t.content.drafts.length>=AUTHORING_LIMITS.totalDrafts)throw new AuthoringError('This pilot retains up to 24 source drafts including archived history.',409);
  const source=scopedRef(t,c.sourceRef),resolved=resolve(t,source),programId=source.scope===t.id?source.programId:'path-'+crypto.randomUUID(),id='cd-'+crypto.randomUUID();
  const draft:Draft={id,programId,baseRef:source,authorId:user.userId,authorName:savedName(actor.name),state:'draft',revision:1,documentRevision:1,document:{},createdAt:now,updatedAt:now,history:[{id:crypto.randomUUID(),actor:user.userId,actorName:savedName(actor.name),action:'copied',at:now}]};
  draft.document=template(t,draft);t.content.drafts.push(draft);break;
 }
 case 'content-save':{
  exact(c,['draftId','revision','document']);const d=findDraft(t,c.draftId,c.revision);byAuthor(d,user);if(d.state!=='draft')throw new AuthoringError('Recall the draft before editing reviewed content.',409);
  const issues=validateDocument(c.document,template(t,d));if(issues.some(x=>['shape','locked','limit'].includes(x.kind)))throw new AuthoringError('Keep the supported content structure, classification and text limits.');
  d.document=copy(c.document);d.documentRevision++;delete d.approval;bump(d,actor,'saved',now);break;
 }
 case 'content-submit':{
  exact(c,['draftId','revision','reviewerId','reviewDueAt']);const d=findDraft(t,c.draftId,c.revision);byAuthor(d,user);if(d.state!=='draft')throw new AuthoringError('Only an editable draft can request review.',409);complete(validateDocument(d.document,template(t,d)));
  const reviewer=t.members.find(m=>m.userId===c.reviewerId&&m.active&&m.roles.includes('admin'));if(!reviewer||reviewer.userId===d.authorId)throw new AuthoringError('Choose another active workspace owner for independent content review.',403);
  d.reviewerId=reviewer.userId;d.reviewDueAt=due(c.reviewDueAt,now);d.state='in_review';delete d.approval;bump(d,actor,'submitted for independent review',now);break;
 }
 case 'content-recall':{
  exact(c,['draftId','revision','reason']);const d=findDraft(t,c.draftId,c.revision);byAuthor(d,user);if(!['in_review','approved'].includes(d.state))throw new AuthoringError('Only unpublished reviewed content may be recalled.',409);const reason=text(c.reason,'Reason for recall',10,1000);d.state='draft';delete d.approval;bump(d,actor,'recalled for editing',now,reason);break;
 }
 case 'content-review':{
  exact(c,['draftId','revision','decision','note','checks']);const d=findDraft(t,c.draftId,c.revision);if(d.state!=='in_review')throw new AuthoringError('This draft is not awaiting review.',409);if(d.reviewerId!==user.userId||d.authorId===user.userId)throw new AuthoringError('Only the assigned independent owner may review this content.',403);
  if(!['approve','changes'].includes(c.decision))throw new AuthoringError('Choose approval or request changes.');const note=text(c.note,'Content review note',30,2000);
  if(c.decision==='changes'){d.state='draft';delete d.approval;bump(d,actor,'changes requested',now,note);break}
  const keys=['sources','answers','rubric','safety','accessibility'];if(!plain(c.checks)||Object.keys(c.checks).some(k=>!keys.includes(k))||keys.some(k=>c.checks[k]!==true))throw new AuthoringError('Record every required content review check before approval.');complete(validateDocument(d.document,template(t,d)));due(d.reviewDueAt,now);
  d.approval={reviewerId:user.userId,reviewerName:savedName(actor.name),documentRevision:d.documentRevision,documentHash:await documentHash(d.document),reviewedAt:now,note,checks:copy(c.checks)};d.state='approved';bump(d,actor,'approved private practice draft',now,note);break;
 }
 case 'content-publish':{
  exact(c,['draftId','revision']);const d=findDraft(t,c.draftId,c.revision);if(d.state!=='approved'||!d.approval)throw new AuthoringError('Publish only content approved by an independent owner.',409);
  const reviewer=t.members.find(m=>m.userId===d.approval!.reviewerId&&m.active&&m.roles.includes('admin'));if(!reviewer||reviewer.userId===d.authorId)throw new AuthoringError('Independent reviewer permission changed. Request a current content review.',403);
  complete(validateDocument(d.document,template(t,d)));due(d.reviewDueAt,now);const hash=await documentHash(d.document);if(d.approval.documentRevision!==d.documentRevision||hash!==d.approval.documentHash)throw new AuthoringError('The document differs from the independently approved revision.',409);
  if(t.content.publications.length>=AUTHORING_LIMITS.publications)throw new AuthoringError('This pilot supports eight immutable workspace publications.',409);
  const ref=contentRef({scope:t.id,programId:d.programId,versionId:'cp-'+crypto.randomUUID()});
  t.content.publications.push({id:ref.versionId,snapshot:{ref,program:copy(d.document),language:'en',audience:'Adult learners',classification:AUTHORING_CLASSIFICATION,policy:{minimumWeightedScore:70,scoreMaximum:4,criticalGates:'all',maxAttempts:3,appealDays:14,lessonCount:3,questionsPerLesson:3,optionsPerQuestion:4,submissionFieldCount:7,evidenceMinCharacters:30,evidenceMaxCharacters:10000}},documentHash:hash,authorId:d.authorId,authorName:d.authorName,reviewerId:d.approval.reviewerId,reviewerName:d.approval.reviewerName,reviewedAt:d.approval.reviewedAt,publishedBy:user.userId,publishedByName:savedName(actor.name),publishedAt:now,reviewDueAt:d.reviewDueAt!,availability:'available'});
  d.state='published';d.publishedRef=ref;bump(d,actor,'published immutable private practice draft',now);break;
 }
 case 'content-archive':{
  exact(c,['draftId','revision','reason']);const d=findDraft(t,c.draftId,c.revision);if(!activeDraft(d))throw new AuthoringError('Only an unpublished active draft can be archived.',409);const reason=text(c.reason,'Reason for archiving',10,1000);d.state='archived';bump(d,actor,'archived private practice draft',now,reason);break;
 }
 case 'content-retire':{
  exact(c,['publicationId','reason']);const p=t.content.publications.find(p=>p.id===c.publicationId);if(!p)throw new AuthoringError('Publication not found in this workspace.',404);if(p.availability==='retired')throw new AuthoringError('This publication is already closed to new enrollment.',409);const reason=text(c.reason,'Reason for closing new enrollment',10,1000);p.availability='retired';p.retirement={reason,actor:user.userId,actorName:savedName(actor.name),at:now};break;
 }
 }
 const oldEffective=utf8JsonBytes(original.content??freshAuthoring())+authoringClosureReserve(original),newEffective=utf8JsonBytes(t.content)+authoringClosureReserve(t);
 if(newEffective>oldEffective&&newEffective>AUTHORING_LIMITS.contentBytes)throw new AuthoringError('This workspace must retain room to archive drafts and close publications. Keep your edits and seek support before adding more content.',413);
 return t;
}

export function previewDraft(host:ContentHost,user:Identity,id:string){owner(host,user);const d=host.content?.drafts.find(d=>d.id===id);if(!d)throw new AuthoringError('Content draft not found in this workspace.',404);return {draft:copy(d),issues:validateDocument(d.document,template(host,d)),classification:AUTHORING_CLASSIFICATION}}
export function requireAvailablePublication(host:ContentHost,refValue:ContentRef,now=new Date().toISOString()){const ref=scopedRef(host,refValue);if(ref.scope==='global')return resolve(host,ref);const p=host.content?.publications.find(p=>p.snapshot.ref.programId===ref.programId&&p.snapshot.ref.versionId===ref.versionId);if(!p||p.availability!=='available')throw new AuthoringError('This private pathway is closed to new cohort offerings and enrollment.',409);if(!Number.isFinite(Date.parse(now)))throw new AuthoringError('A trusted action time is required.',400);if(Date.parse(p.reviewDueAt)<=Date.parse(now))throw new AuthoringError('Content review is due before new enrollment.',409);return copy(p.snapshot)}

/** Caller first establishes current membership or own-history/assignment authority. */
export function projectWorkspaceContent(host:ContentHost,user:Identity,neededRefs:readonly ContentRef[]){
 const m=host.members.find(m=>m.userId===user.userId);if(!m)throw new AuthoringError('Workspace not found.',404);const admin=m.active&&m.roles.includes('admin'),content=host.content??freshAuthoring();
 const keys=new Set(neededRefs.map(ref=>contentKey(scopedRef(host,ref))));
 const versions=content.publications.filter(p=>admin||keys.has(contentKey(p.snapshot.ref))).map(p=>copy(p.snapshot));
 return {versions,...(admin?{drafts:copy(content.drafts),publications:content.publications.map(p=>({id:p.id,ref:p.snapshot.ref,title:p.snapshot.program.title,availability:p.availability,classification:p.snapshot.classification,authorName:p.authorName,reviewerName:p.reviewerName,publishedAt:p.publishedAt,reviewDueAt:p.reviewDueAt,documentHash:p.documentHash,retirement:p.retirement}))}:{})};
}

/** Reserve all terminal content closures, including worst JSON text escaping. */
export const utf8JsonBytes=(value:any)=>new TextEncoder().encode(JSON.stringify(value)).length;
const WORST_REASON=String.fromCharCode(0).repeat(1000),WORST_NAME=String.fromCharCode(0).repeat(80),CLOCK='2000-01-01T00:00:00.000Z';
function largestSavedActorId(host:ContentHost){let actor='';for(const m of host.members){if(utf8JsonBytes(m.userId)>utf8JsonBytes(actor))actor=m.userId;}return actor;}
export function retirementGrowth(publication:Publication,actorId:string){if(publication.availability!=='available')return 0;return Math.max(0,utf8JsonBytes({...publication,availability:'retired',retirement:{reason:WORST_REASON,actor:actorId,actorName:WORST_NAME,at:CLOCK}})-utf8JsonBytes(publication));}
export function archiveGrowth(draft:Draft,actorId:string){if(!activeDraft(draft))return 0;return Math.max(0,utf8JsonBytes({...draft,state:'archived',revision:draft.revision+1,updatedAt:CLOCK,history:[...draft.history,{id:'0'.repeat(36),actor:actorId,actorName:WORST_NAME,action:'archived private practice draft',at:CLOCK,note:WORST_REASON}]})-utf8JsonBytes(draft));}
export function authoringRetirementReserve(host:ContentHost){const actor=largestSavedActorId(host);return (host.content?.publications??[]).reduce((sum,p)=>sum+retirementGrowth(p,actor),0);}
export function authoringClosureReserve(host:ContentHost){const actor=largestSavedActorId(host);return authoringRetirementReserve(host)+(host.content?.drafts??[]).reduce((sum,d)=>sum+archiveGrowth(d,actor),0);}
