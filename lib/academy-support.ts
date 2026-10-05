// Requester threads and explicit staff assignments. No external message sender.
export class SupportRuleError extends Error {
 constructor(message:string,public status=422){super(message);this.name='SupportRuleError'}
}
export const SUPPORT_CATEGORIES=['access','learning','technical','content','accessibility','privacy'] as const;
export type SupportCategory=typeof SUPPORT_CATEGORIES[number];
export type SupportMember={userId:string;name:string;active:boolean;roles:string[];scopes:string[]};
export type SupportMessage={id:string;actorId:string;actorName:string;authorKind:'requester'|'handler';body:string;createdAt:string};
export type SupportResolution={id:string;actorId:string;actorName:string;body:string;resolvedAt:string};
export type SupportEvent={id:string;type:'opened'|'claimed'|'reopened'|'resolved'|'withdrawn';actorId:string;actorName:string;createdAt:string;previousHandlerId?:string|null;previousHandlerName?:string|null;handlerId?:string|null;handlerName?:string|null};
export type SupportRequest={id:string;requesterId:string;requesterName:string;category:SupportCategory;cohortId:string|null;subject:string;status:'open'|'resolved'|'withdrawn';createdAt:string;updatedAt:string;assignedTo:string|null;messages:SupportMessage[];resolution:SupportResolution|null;resolutions:SupportResolution[];events:SupportEvent[]};
export type SupportTeam={members:SupportMember[];cohorts:Array<{id:string;title:string;status?:string}>;support?:SupportRequest[]};
export const MAX_SUPPORT_BYTES=250_000,MAX_REQUESTS=100,MAX_OPEN=5,MAX_MESSAGES=20,MAX_EVENTS=100,MAX_RESOLUTIONS=20;
const snapshotName=(name:string)=>String(name||'Academy member').slice(0,80);
const commands=new Set(['support-open','support-claim','support-reply','support-resolve','support-reopen','support-withdraw']);
const exact=(c:any,keys:string[])=>{if(Object.keys(c).some(k=>!['type',...keys].includes(k)))throw new SupportRuleError('This support request includes unsupported fields.',400)};
function text(v:any,label:string,min:number,max:number){if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new SupportRuleError(`${label} needs ${min}–${max} characters.`);return v.trim()}
function member(t:SupportTeam,userId:string,active=true){const m=t.members.find(m=>m.userId===userId);if(!m)throw new SupportRuleError('Workspace support is unavailable for this account.',404);if(active&&!m.active)throw new SupportRuleError('Workspace access is no longer active. Your past requests remain available to read.',403);return m}
const owner=(m:SupportMember)=>m.active&&m.roles.includes('admin');
export function eligibleSupportHandler(t:SupportTeam,m:SupportMember|undefined,r:SupportRequest){return !!m&&m.active&&m.userId!==r.requesterId&&(owner(m)||(m.roles.includes('facilitator')&&['learning','content'].includes(r.category)&&r.cohortId!==null&&t.cohorts.some(c=>c.id===r.cohortId)&&m.scopes.includes(r.cohortId)))}
function handler(t:SupportTeam,r:SupportRequest){const m=t.members.find(m=>m.userId===r.assignedTo);return eligibleSupportHandler(t,m,r)?m:null}
// The lead should call this after EVERY protected Team mutation, not only after
// support commands. The membership command's durable audit preserves the reason
// for the authority change, while prior support claim/message events retain
// historical attribution. A restored role then needs a fresh explicit claim.
export function reconcileSupportAssignments(t:SupportTeam){let released=0;for(const r of t.support??[]){if(r.assignedTo&&!handler(t,r)){r.assignedTo=null;released++}}return released}
function canQueue(t:SupportTeam,m:SupportMember,r:SupportRequest){return m.active&&(owner(m)||(m.roles.includes('facilitator')&&['learning','content'].includes(r.category)&&r.cohortId!==null&&t.cohorts.some(c=>c.id===r.cohortId)&&m.scopes.includes(r.cohortId)))}
function request(t:SupportTeam,c:any,m:SupportMember){if(typeof c.requestId!=='string')throw new SupportRuleError('Choose a support request.',400);const r=t.support?.find(r=>r.id===c.requestId);if(!r||(r.requesterId!==m.userId&&!canQueue(t,m,r)&&handler(t,r)?.userId!==m.userId))throw new SupportRuleError('Support request not found for this account.',404);return r}
function intakeCohort(t:SupportTeam,m:SupportMember,id:any){if(id===null)return null;if(typeof id!=='string')throw new SupportRuleError('Choose a current cohort or workspace access.',400);const c=t.cohorts.find(c=>c.id===id);if(!c)throw new SupportRuleError('Current workspace cohort not found.',404);if(!owner(m)&&!m.roles.includes('learner')&&!(m.scopes.includes(id)&&m.roles.some(r=>['facilitator','assessor','reviewer','moderator'].includes(r))))throw new SupportRuleError('This cohort is outside your current request scope.',403);return c.id}
function appendMessage(r:SupportRequest,m:SupportMember,kind:'requester'|'handler',body:string,now:string){if(r.messages.length>=MAX_MESSAGES)throw new SupportRuleError('This pilot request reached its 20-message limit. Keep your input and ask the workspace owner for support.',409);r.messages.push({id:crypto.randomUUID(),actorId:m.userId,actorName:snapshotName(m.name),authorKind:kind,body,createdAt:now})}
function event(r:SupportRequest,m:SupportMember,type:SupportEvent['type'],now:string,extra:Partial<SupportEvent>={}){if(r.events.length>=MAX_EVENTS&&type!=='withdrawn')throw new SupportRuleError('This pilot request reached its lifecycle history limit.',409);r.events.push({id:crypto.randomUUID(),type,actorId:m.userId,actorName:snapshotName(m.name),createdAt:now,...extra})}
function mustOpen(r:SupportRequest){if(r.status!=='open')throw new SupportRuleError('Only open requests allow this action.',409)}
function assertOwn(r:SupportRequest,m:SupportMember){if(r.requesterId!==m.userId)throw new SupportRuleError('Only the requester can do this.',403)}
function assertHandler(t:SupportTeam,r:SupportRequest,m:SupportMember){if(handler(t,r)?.userId!==m.userId)throw new SupportRuleError('Only the currently assigned eligible handler can do this.',403)}

// Called within the Team's existing revision fence, using the authenticated
// subject. It commits only the support slice after all validation and byte checks
// pass. Failed commands leave the passed document unchanged.
export function applySupportCommand(t:SupportTeam,actorId:string,c:any,now:string):boolean {
 if(!c||typeof c!=='object'||!commands.has(c.type))return false;
 if(typeof now!=='string'||!Number.isFinite(Date.parse(now)))throw new SupportRuleError('A valid support timestamp is required.',400);now=new Date(now).toISOString();if(now.length!==24)throw new SupportRuleError('A four-digit-year support timestamp is required.',400);
 const actor=member(t,actorId),next:SupportTeam={members:t.members,cohorts:t.cohorts,support:structuredClone(t.support??[])},cases=next.support!;
 switch(c.type){
 case 'support-open':{
  exact(c,['category','cohortId','subject','body','audienceAcknowledged']);if(c.audienceAcknowledged!==true)throw new SupportRuleError('Acknowledge who can see the request before submitting.');if(!SUPPORT_CATEGORIES.includes(c.category))throw new SupportRuleError('Choose an existing support category.');
  const cohortId=intakeCohort(next,actor,c.cohortId),subject=text(c.subject,'Request title',5,160),body=text(c.body,'Request description',10,2000);
  if(cases.length>=MAX_REQUESTS)throw new SupportRuleError('This pilot workspace reached its 100-request limit. Keep your input and ask the workspace owner for support.',409);if(cases.filter(r=>r.requesterId===actorId&&r.status==='open').length>=MAX_OPEN)throw new SupportRuleError('You already have five open requests. Continue an existing request before opening another.',409);
  const r:SupportRequest={id:crypto.randomUUID(),requesterId:actorId,requesterName:snapshotName(actor.name),category:c.category,cohortId,subject,status:'open',createdAt:now,updatedAt:now,assignedTo:null,messages:[],resolution:null,resolutions:[],events:[]};appendMessage(r,actor,'requester',body,now);event(r,actor,'opened',now);cases.push(r);break;
 }
 case 'support-claim':{
  exact(c,['requestId']);const r=request(next,c,actor);mustOpen(r);if(!eligibleSupportHandler(next,actor,r))throw new SupportRuleError('A current eligible staff member independent of the requester must handle this request.',403);if(handler(next,r))throw new SupportRuleError('This request already has a current eligible handler.',409);
  const prior=next.members.find(m=>m.userId===r.assignedTo);event(r,actor,'claimed',now,{previousHandlerId:r.assignedTo,previousHandlerName:prior?snapshotName(prior.name):null,handlerId:actorId,handlerName:snapshotName(actor.name)});r.assignedTo=actorId;r.updatedAt=now;break;
 }
 case 'support-reply':{
  exact(c,['requestId','body']);const r=request(next,c,actor);mustOpen(r);const kind=r.requesterId===actorId?'requester':'handler';if(kind==='handler')assertHandler(next,r,actor);appendMessage(r,actor,kind,text(c.body,'Reply',10,2000),now);r.updatedAt=now;break;
 }
 case 'support-resolve':{
  exact(c,['requestId','resolution']);const r=request(next,c,actor);mustOpen(r);assertHandler(next,r,actor);if(r.resolutions.length>=MAX_RESOLUTIONS)throw new SupportRuleError('This pilot request reached its resolution history limit.',409);const resolution:SupportResolution={id:crypto.randomUUID(),actorId,actorName:snapshotName(actor.name),body:text(c.resolution,'Resolution',20,2000),resolvedAt:now};r.resolutions.push(resolution);r.resolution=structuredClone(resolution);event(r,actor,'resolved',now);r.status='resolved';r.updatedAt=now;break;
 }
 case 'support-reopen':{
  exact(c,['requestId','body']);const r=request(next,c,actor);assertOwn(r,actor);if(r.status!=='resolved')throw new SupportRuleError('Only a resolved request can be reopened. Withdrawn requests stay read only.',409);if(cases.filter(x=>x.requesterId===actorId&&x.status==='open').length>=MAX_OPEN)throw new SupportRuleError('You already have five open requests. Continue an existing request first.',409);appendMessage(r,actor,'requester',text(c.body,'Reason for reopening',10,2000),now);event(r,actor,'reopened',now);r.resolution=null;r.status='open';r.updatedAt=now;break;
 }
 case 'support-withdraw':{
  exact(c,['requestId']);const r=request(next,c,actor);assertOwn(r,actor);mustOpen(r);event(r,actor,'withdrawn',now);r.status='withdrawn';r.updatedAt=now;break;
 }
 }
 const bytes=new TextEncoder().encode(JSON.stringify(cases)).length;if(bytes+supportClosureReserve(next)>MAX_SUPPORT_BYTES)throw new SupportRuleError('This pilot workspace reached its support storage limit. Keep your input and ask the workspace owner for support.',413);
 t.support=cases;return true;
}

function fullThread(t:SupportTeam,r:SupportRequest){const effective=handler(t,r),{requesterId,assignedTo,...safe}=structuredClone(r);return {...safe,handlerName:effective?.name??null,messages:safe.messages.map(({actorId,...m})=>m),resolution:safe.resolution?(({actorId,...v})=>v)(safe.resolution):null,resolutions:safe.resolutions.map(({actorId,...v})=>v),events:safe.events.map(({actorId,handlerId,previousHandlerId,...e})=>e)}}
export function projectSupport(t:SupportTeam,actorId:string){
 const m=member(t,actorId,false),cases=t.support??[],mine=cases.filter(r=>r.requesterId===actorId).map(r=>fullThread(t,r));if(!m.active)return {mine,queue:[],assigned:[]};
 const queue=cases.filter(r=>canQueue(t,m,r)).map(r=>{const effective=handler(t,r);return {id:r.id,category:r.category,cohortId:r.cohortId,cohortTitle:r.cohortId?t.cohorts.find(c=>c.id===r.cohortId)?.title??'Former cohort':null,subject:r.subject,requesterName:r.requesterName,createdAt:r.createdAt,updatedAt:r.updatedAt,status:r.status,handlerName:effective?.name??null,canClaim:r.status==='open'&&!effective&&eligibleSupportHandler(t,m,r),eligibleHandlerAvailable:t.members.some(x=>eligibleSupportHandler(t,x,r))}});
 const assigned=cases.filter(r=>handler(t,r)?.userId===actorId).map(r=>fullThread(t,r));return {mine,queue,assigned};
}

/** Reserve the exact worst final event for every open case. Identity strings come
 * from admitted saved requests; future name snapshots are bounded to 80 UTF-16
 * units. NUL is the worst JSON encoding per unit (six bytes). No body is erased. */
export function supportClosureReserve(t:SupportTeam):number{
 const bytes=(v:any)=>new TextEncoder().encode(JSON.stringify(v)).length;
 return (t.support??[]).filter(r=>r.status==='open').reduce((total,r)=>{
  const final={id:'0'.repeat(36),type:'withdrawn',actorId:r.requesterId,actorName:'\0'.repeat(80),createdAt:'2000-01-01T00:00:00.000Z'};
  return total+bytes(final)+(r.events.length?1:0)+5+Math.max(0,24-r.updatedAt.length);
 },0);
}
