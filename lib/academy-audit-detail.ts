/** BR-46 significant-action audit detail. Pure, dependency-free, strict whitelist.
 *
 * The detail answers "who changed what": a pseudonymous actor reference, the command type,
 * the target ids, the outcome and a small before/after summary of whitelisted fields only
 * (statuses, roles, scopes, decision outcomes, publication states).
 *
 * Nothing is copied from a command or from learner state unless it passes a field-specific
 * sanitiser: enumerations are matched against fixed sets (anything else becomes 'other'),
 * identifiers must be UUID/workspace-id shaped or already exist in the saved state, and numbers
 * are clamped. Free text (answers, practice text, evidence, feedback, reasons, notes, names,
 * emails, passphrases, tokens) has no path into the output. */

export const AUDIT_DETAIL_VERSION=1;
export const MAX_DETAIL_BYTES=3000,MAX_CHANGES=24;

const COMMAND_TYPES=['create','accept','invite','revoke-invite','member','cohort-create','cohort-status','assign','assess','resolve','post','reply','report','moderate','enroll','learning-access-preferences','profile','lesson-draft','lesson','draft','submit','appeal','share','withdraw','followup','interest','reset','pause','connection','deliver','ecosystem-grant','ecosystem-withdraw','ecosystem-test','content-copy','content-save','content-submit','content-recall','content-review','content-publish','content-retire','content-archive','content-job-template'];
const CATEGORY:Record<string,string>={create:'workspace',accept:'membership',invite:'membership',['revoke-invite']:'membership',member:'permissions',['cohort-create']:'content',['cohort-status']:'content',assign:'permissions',assess:'assessment',resolve:'assessment',submit:'assessment',appeal:'assessment',share:'credential',enroll:'enrollment',withdraw:'enrollment',reset:'recovery',pause:'content',moderate:'moderation',post:'discussion',reply:'discussion',report:'moderation','content-job-template':'content'};
const ENUM={
 role:['admin','facilitator','moderator','learner','assessor','reviewer','author'],
 invite:['active','accepted','revoked','expired'],cohort:['open','paused','closed'],
 draft:['draft','in_review','approved','published','archived'],availability:['available','retired'],
 post:['pending','visible','hidden'],decision:['none','passed','not-passed'],appeal:['none','open','resolved'],
 record:['none','active','suspended'],kind:['assessment','appeal']
} as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,WORKSPACE_ID=/^tw-[a-z0-9-]{20,80}$/i,SLUG=/^[a-z0-9][a-z0-9-]{0,59}$/;

export type Scalar=string|number|boolean|null;
export type AuditChange={entity:string;id:string;field:string;before:Scalar|string[];after:Scalar|string[]};
export type AuditDetail={v:1;scope:'workspace'|'personal';actor:string;type:string;category:string;target:Record<string,string>;outcome:'applied'|'no-change';changes:AuditChange[];truncated?:true};
export type RefOf=(userId:string)=>string;

const isObj=(x:any):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const enumOf=(set:readonly string[],v:any)=>typeof v==='string'&&set.includes(v)?v:'other';
const idOf=(v:any,known?:Set<string>)=>typeof v==='string'&&v.length<=80&&(UUID.test(v)||WORKSPACE_ID.test(v)||!!known?.has(v))?v:null;
const slugOf=(v:any)=>typeof v==='string'&&SLUG.test(v)?v:null;
const nOf=(v:any)=>typeof v==='number'&&Number.isFinite(v)?Math.round(Math.min(Math.max(v,0),1000)*10)/10:null;
export const commandType=(v:any)=>typeof v==='string'&&COMMAND_TYPES.includes(v)?v:'other';

/** Stable pseudonym for a user inside one scope (workspace id, or 'personal'): first 12 hex of SHA-256(scope|userId). */
export async function pseudonymMap(userIds:string[],scope:string):Promise<RefOf>{
 const map=new Map<string,string>();
 for(const id of new Set(userIds.filter(x=>typeof x==='string'))){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('aplyd-audit|'+scope+'|'+id));map.set(id,'a-'+Array.from(new Uint8Array(d)).slice(0,6).map(n=>n.toString(16).padStart(2,'0')).join(''))}
 return id=>map.get(id)??'a-unknown000';
}
export const isActorRef=(v:any)=>typeof v==='string'&&/^a-[0-9a-f]{12}$/.test(v);

type Snap=Map<string,Record<string,Scalar|string[]>>;
type Snaps=Record<string,Snap>;
const put=(s:Snaps,entity:string,id:string|null,fields:Record<string,Scalar|string[]>)=>{if(!id)return;(s[entity]??=new Map()).set(id,fields)};
const list=(v:any,max=20)=>Array.isArray(v)?v.slice(0,max):[];

function enrollmentFields(e:any):Record<string,Scalar|string[]>{
 const attempts=list(e?.attempts,50),last=attempts.at(-1),appeals=list(e?.appeals,50),appeal=appeals.at(-1);
 const decision=last?.decision?(last.decision.passed===true?'passed':'not-passed'):'none';
 const resolution=appeal?.resolution?(appeal.resolution.passed===true?'passed':'not-passed'):'none';
 return {attempts:attempts.length,decision,score:nOf(last?.decision?.score),appeal:appeal?enumOf(ENUM.appeal,appeal.status):'none',appealOutcome:resolution,record:e?.record?enumOf(ENUM.record,e.record.status):'none',shared:e?.record?e.record.share===true:false,withdrawn:e?.withdrawn===true,completedLessons:Array.isArray(e?.completed)?Math.min(e.completed.length,999):0};
}
function snapshotWorkspaceState(s:Snaps,state:any,refOf:RefOf,owner:string|null){
 for(const e of list(state?.enrollments,100)){const id=idOf(e?.id);if(!id)continue;const rec=idOf(e?.record?.id);put(s,'enrollment',id,{...enrollmentFields(e),learner:owner?refOf(owner):'self',credentialId:rec,cohortId:idOf(e?.cohortId),programId:slugOf(e?.programId)})}
 for(const p of list(state?.paused,50)){const id=slugOf(p);put(s,'content-pause',id,{paused:true})}
}
function snapshotTeam(t:any,refOf:RefOf):Snaps{
 const s:Snaps={};if(!isObj(t))return s;
 for(const m of list(t.members,100)){if(typeof m?.userId!=='string')continue;const ref=refOf(m.userId);put(s,'member',ref,{roles:list(m.roles,10).map(r=>enumOf(ENUM.role,r)).sort(),scopes:list(m.scopes,50).map(x=>idOf(x)).filter((x):x is string=>!!x).sort(),active:m.active===true})}
 for(const i of list(t.invites,200))put(s,'invite',idOf(i?.id),{status:enumOf(ENUM.invite,i?.status),roles:list(i?.roles,10).map(r=>enumOf(ENUM.role,r)).sort(),scopes:list(i?.scopes,50).map(x=>idOf(x)).filter((x):x is string=>!!x).sort()});
 for(const c of list(t.cohorts,50))put(s,'cohort',idOf(c?.id),{status:enumOf(ENUM.cohort,c?.status),capacity:nOf(c?.capacity),programId:slugOf(c?.programId)});
 for(const a of list(t.assignments,300)){const k=enumOf(ENUM.kind,a?.kind),id=idOf(a?.targetId);if(id)put(s,'assignment',k+':'+id,{reviewer:typeof a?.staffId==='string'?refOf(a.staffId):null})}
 for(const d of list(t.content?.drafts,200))put(s,'draft',idOf(d?.id),{state:enumOf(ENUM.draft,d?.state),approved:!!d?.approval,publishedRef:!!d?.publishedRef,programId:slugOf(d?.programId)});
 for(const p of list(t.content?.publications,200))put(s,'publication',idOf(p?.id),{availability:enumOf(ENUM.availability,p?.availability)});
 for(const p of list(t.posts,500)){const pid=idOf(p?.id);put(s,'post',pid,{status:enumOf(ENUM.post,p?.status)});for(const r of list(p?.replies,200))put(s,'reply',idOf(r?.id),{status:enumOf(ENUM.post,r?.status)})}
 for(const l of list(t.learners,100)){if(typeof l?.userId==='string')snapshotWorkspaceState(s,l.state,refOf,l.userId)}
 return s;
}
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
function diff(before:Snaps,after:Snaps):AuditChange[]{
 const out:AuditChange[]=[];
 for(const entity of new Set([...Object.keys(before),...Object.keys(after)])){
  const b=before[entity]??new Map(),a=after[entity]??new Map();
  for(const id of new Set([...b.keys(),...a.keys()])){
   const x=b.get(id),y=a.get(id);
   if(!x||!y){out.push({entity,id,field:'presence',before:x?'present':'absent',after:y?'present':'absent'});
    const fields=y??x!;for(const f of Object.keys(fields)){if(['learner','credentialId','cohortId','programId'].includes(f))continue;out.push({entity,id,field:f,before:x?x[f]:null,after:y?y[f]:null})}continue}
   for(const f of Object.keys(y))if(!same(x[f],y[f])&&!['learner','credentialId','cohortId','programId'].includes(f))out.push({entity,id,field:f,before:x[f]??null,after:y[f]})
  }
 }
 return out;
}
function knownIds(...s:Snaps[]){const ids=new Set<string>();for(const snap of s)for(const m of Object.values(snap))for(const k of m.keys())ids.add(k);return ids}

function programIds(...s:Snaps[]){const ids=new Set<string>();for(const snap of s){for(const f of Object.values(snap))for(const x of f.values())if(typeof x?.programId==='string')ids.add(x.programId);for(const k of snap['content-pause']?.keys()??[])ids.add(k)}return ids}
function targetOf(c:any,after:Snaps,before:Snaps,refOf:RefOf,changes:AuditChange[],teamId?:string){
 const known=knownIds(before,after),t:Record<string,string>={};const set=(k:string,v:string|null)=>{if(v)t[k]=v};
 if(isObj(c)){
  set('enrollmentId',idOf(c.enrollmentId,known));set('cohortId',idOf(c.cohortId,known));set('attemptId',idOf(c.attemptId));set('appealId',idOf(c.appealId));
  set('inviteId',idOf(c.inviteId,known));set('postId',idOf(c.postId,known));
  set('contentId',idOf(c.draftId,known)??idOf(c.publicationId,known));
  if(!t.contentId&&typeof c.programId==='string'&&programIds(before,after).has(c.programId))set('contentId',slugOf(c.programId));
  if(typeof c.userId==='string')set('memberRef',refOf(c.userId));
  if(typeof c.learnerId==='string')set('learnerRef',refOf(c.learnerId));
  if(typeof c.staffId==='string')set('reviewerRef',refOf(c.staffId));
 }
 const changed=(entity:string)=>changes.filter(x=>x.entity===entity).map(x=>x.id);
 if(!t.cohortId){const ids=[...new Set(changed('cohort'))];if(ids.length===1)set('cohortId',ids[0])}
 if(!t.inviteId){const ids=[...new Set(changed('invite'))];if(ids.length===1&&c?.type!=='member')set('inviteId',ids[0])}
 if(!t.contentId){const ids=[...new Set([...changed('draft'),...changed('publication')])];if(ids.length>=1)set('contentId',ids[0])}
 if(!t.enrollmentId){const ids=[...new Set(changed('enrollment'))];if(ids.length===1)set('enrollmentId',ids[0])}
 const rec=t.enrollmentId?after.enrollment?.get(t.enrollmentId)?.credentialId:null;if(typeof rec==='string')set('credentialId',rec);
 if(c?.type==='create'&&teamId)set('workspaceId',idOf(teamId)??'');
 for(const k of Object.keys(t))if(!t[k])delete t[k];
 return t;
}
function finish(d:AuditDetail):AuditDetail{
 let out=d;
 if(out.changes.length>MAX_CHANGES)out={...out,changes:out.changes.slice(0,MAX_CHANGES),truncated:true};
 while(JSON.stringify(out).length>MAX_DETAIL_BYTES&&out.changes.length>0)out={...out,changes:out.changes.slice(0,Math.floor(out.changes.length/2)),truncated:true};
 return out;
}
function build(scope:'workspace'|'personal',before:Snaps,after:Snaps,command:any,actorId:string,refOf:RefOf,teamId?:string):AuditDetail{
 const type=commandType(command?.type),changes=diff(before,after);
 return finish({v:1,scope,actor:refOf(actorId),type,category:CATEGORY[type]??(type.startsWith('content-')?'content':'learning'),target:targetOf(command,after,before,refOf,changes,teamId),outcome:changes.length?'applied':'no-change',changes});
}
/** before is null for a workspace-create command. */
export function summarizeTeamCommand(i:{before:any|null;after:any;command:any;actorId:string;refOf:RefOf}):AuditDetail{
 return build('workspace',i.before?snapshotTeam(i.before,i.refOf):{},snapshotTeam(i.after,i.refOf),i.command,i.actorId,i.refOf,i.command?.type==='create'?i.after?.id:undefined);
}
export function summarizePersonalCommand(i:{before:any;after:any;command:any;actorId:string;refOf:RefOf}):AuditDetail{
 const b:Snaps={},a:Snaps={};snapshotWorkspaceState(b,i.before,i.refOf,null);snapshotWorkspaceState(a,i.after,i.refOf,null);
 return build('personal',b,a,i.command,i.actorId,i.refOf);
}
/** Never throws: audit detail is best effort and must not block a saved command. */
export function safeDetailJson(fn:()=>AuditDetail):string|null{try{return JSON.stringify(fn())}catch{return null}}

/** Re-sanitises a stored detail string for output. Old rows (null) return null; corrupt or foreign shapes return null. */
export function parseDetail(json:any):AuditDetail|null{
 if(typeof json!=='string'||json.length>MAX_DETAIL_BYTES+500)return null;
 let d:any;try{d=JSON.parse(json)}catch{return null}
 if(!isObj(d)||d.v!==1||!isActorRef(d.actor))return null;
 const scalar=(v:any):Scalar|string[]=>Array.isArray(v)?v.slice(0,50).filter(x=>typeof x==='string'&&x.length<=80&&(UUID.test(x)||ENUM.role.includes(x as any)||x==='other')):typeof v==='boolean'||v===null?v:typeof v==='number'?nOf(v):typeof v==='string'&&v.length<=40&&/^[a-z0-9_-]+$/.test(v)?v:'other';
 const target:Record<string,string>={};if(isObj(d.target))for(const [k,v] of Object.entries(d.target))if(['enrollmentId','cohortId','contentId','credentialId','attemptId','appealId','inviteId','postId','workspaceId','memberRef','learnerRef','reviewerRef'].includes(k)&&typeof v==='string'&&v.length<=80&&/^[A-Za-z0-9-]+$/.test(v))target[k]=v;
 const changes=list(d.changes,MAX_CHANGES).filter(isObj).map(c=>({entity:String(c.entity).replace(/[^a-z-]/g,'').slice(0,24),id:typeof c.id==='string'&&/^[A-Za-z0-9:-]{1,100}$/.test(c.id)?c.id:'other',field:String(c.field).replace(/[^A-Za-z]/g,'').slice(0,24),before:scalar(c.before),after:scalar(c.after)}));
 return {v:1,scope:d.scope==='personal'?'personal':'workspace',actor:d.actor,type:commandType(d.type),category:typeof d.category==='string'&&/^[a-z-]{1,24}$/.test(d.category)?d.category:'other',target,outcome:d.outcome==='no-change'?'no-change':'applied',changes,...(d.truncated?{truncated:true as const}:{})};
}

export type AuditRow={revision:number;at:string;type:string;actor:string;detail:AuditDetail|null;legacy:boolean};
/** Projects a stored row. Old rows (no detail) stay readable: type and time only, legacy=true. actorRef is derived by the caller from the retained actor column. */
export function projectAuditRow(r:{revision:number;created_at:string;action:string;detail?:string|null},actor:string):AuditRow{
 const detail=parseDetail(r.detail??null);return {revision:r.revision,at:r.created_at,type:commandType(r.action),actor:detail?.actor??actor,detail,legacy:!detail};
}

export type AuditQuery={limit?:any;before?:any;type?:any;target?:any;from?:any;to?:any;actorUserId?:string|null};
export class AuditQueryError extends Error{status=400}
const isoDay=(v:any,end:boolean)=>{if(v===null||v===undefined||v==='')return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(v)||Number.isNaN(Date.parse(v)))throw new AuditQueryError('Use a valid date filter.');return v.length===10?v+(end?'T23:59:59.999Z':'T00:00:00.000Z'):v};
/** Builds a parameterised, read-only page query. keyColumn/keyValue scope the rows (team_id or owner). Fetches limit+1 rows for the cursor. */
export function buildAuditQuery(table:'academy_team_audit'|'academy_audit',keyValue:string,q:AuditQuery){
 const team=table==='academy_team_audit',key=team?'team_id':'owner';
 const limit=q.limit===undefined||q.limit===null||q.limit===''?25:Number(q.limit);if(!Number.isInteger(limit)||limit<1||limit>50)throw new AuditQueryError('Choose a page size from 1 to 50.');
 const where=[key+'=?'],binds:any[]=[keyValue];
 if(q.before!==undefined&&q.before!==null&&q.before!==''){const b=Number(q.before);if(!Number.isSafeInteger(b)||b<1)throw new AuditQueryError('Use a valid audit cursor.');where.push('revision<?');binds.push(b)}
 if(q.type){if(!COMMAND_TYPES.includes(String(q.type)))throw new AuditQueryError('Choose a known action type.');where.push('action=?');binds.push(String(q.type))}
 if(q.target){const t=String(q.target);if(t.length>80||!/^[A-Za-z0-9-]+$/.test(t))throw new AuditQueryError('Use a valid target id.');where.push("EXISTS (SELECT 1 FROM json_each(detail,'$.target') WHERE value=?)");binds.push(t)}
 const from=isoDay(q.from,false),to=isoDay(q.to,true);if(from){where.push('created_at>=?');binds.push(from)}if(to){where.push('created_at<=?');binds.push(to)}
 if(q.actorUserId!==undefined){if(!team)throw new AuditQueryError('Actor filters apply to workspaces only.');where.push('actor=?');binds.push(q.actorUserId??'')}
 const sql=`SELECT revision,${team?'actor,':''}action,created_at,detail FROM ${table} WHERE ${where.join(' AND ')} ORDER BY revision DESC LIMIT ${limit+1}`;
 return {sql,binds,limit};
}
export function pageOf<T extends {revision:number}>(rows:T[],limit:number){const more=rows.length>limit,items=more?rows.slice(0,limit):rows;return {items,nextBefore:more?items.at(-1)!.revision:null}}

const csvCell=(v:any)=>{let s=v===null||v===undefined?'':Array.isArray(v)?v.join(' '):String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
/** CSV of already-projected rows. Spreadsheet formula prefixes are neutralised. */
export function auditCsv(rows:AuditRow[]):string{
 const head=['revision','time','actor','type','category','outcome','targets','changes'];
 const lines=rows.map(r=>[r.revision,r.at,r.actor,r.type,r.detail?.category??'legacy',r.detail?.outcome??'not recorded',Object.entries(r.detail?.target??{}).map(([k,v])=>k+'='+v).join('; '),(r.detail?.changes??[]).map(c=>`${c.entity} ${c.id} ${c.field}: ${Array.isArray(c.before)?c.before.join('|'):c.before} -> ${Array.isArray(c.after)?c.after.join('|'):c.after}`).join('; ')].map(csvCell).join(','));
 return [head.join(','),...lines].join('\r\n')+'\r\n';
}
