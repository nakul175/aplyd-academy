import {RuleError,programs} from './academy-engine';
import type {Team} from './academy-teams';

/** Programme-level and ecosystem discussion spaces (BR-32).
 *
 * Pure rules that run inside the Team revision fence. State lives in the existing team JSON
 * aggregate (t.spaces); there is no table, migration or cross-workspace lookup.
 *
 * Spaces:
 *  - programme:<programId>  one per pathway that has at least one cohort in THIS workspace.
 *    Visible to owners, to staff scoped to any cohort of that pathway and to learners with a
 *    non-withdrawn enrollment in that pathway. A learner of another pathway cannot see it.
 *  - ecosystem  an opt-in space an owner switches on for this workspace's context
 *    (t.context, for example farmer, msme or public). Any ACTIVE member of this workspace
 *    may read and post. It never reaches another workspace: the Team is the boundary.
 *
 * Honest limit: cross-workspace or ecosystem-wide membership is NOT built. Ecosystems in
 * lib/academy-ecosystems.ts are local, test-only adapters. The ecosystem space is a
 * workspace-local room named after the workspace context, nothing more.
 *
 * Separate from cohort boards: posts here live in t.spaces.posts, never in t.posts, so cohort
 * access rules, cohort moderation and cohort escalations are untouched. Space reports are
 * decided by moderators in scope or by an owner; they are not wired into the escalation
 * queue (that queue is keyed by cohort).
 * Removed members lose access at once; posts they wrote stay attributed by their stored name. */
export const ECOSYSTEM_SPACE_ID='ecosystem';
export const SPACE_LIMITS={posts:300,replies:50} as const;
export const ECOSYSTEM_BOUNDARY_NOTE='This room belongs to this workspace only. Only active members of this workspace can read or write here. It does not connect you to people in other workspaces or to any partner system.';
const STAFF=['facilitator','assessor','reviewer','moderator'];
export type SpaceState={ecosystemOpen:boolean;ecosystemChangedBy:string|null;ecosystemChangedAt:string|null;posts:any[];reports:any[];moderation:any[]};
const commands=new Set(['space-ecosystem','space-post','space-reply','space-report','space-moderate']);
export const isSpaceCommand=(c:any)=>!!c&&typeof c.type==='string'&&commands.has(c.type);
export const programmeSpaceId=(programId:string)=>'programme:'+programId;
const NOT_FOUND_SPACE='Discussion space not found.',NOT_FOUND_POST='Discussion not found.',DENIED='Your current membership does not permit this action.';
const exact=(c:any,keys:string[])=>{if(Object.keys(c).some(k=>!['type',...keys].includes(k)))throw new RuleError('This request includes unsupported fields.',400)};
const text=(v:any,label:string,min:number,max:number)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new RuleError(`${label} needs ${min}–${max} characters.`);return v.trim()};
const store=(t:any):SpaceState=>t.spaces??={ecosystemOpen:false,ecosystemChangedBy:null,ecosystemChangedAt:null,posts:[],reports:[],moderation:[]};
const isOwner=(m:any)=>!!m&&m.active===true&&Array.isArray(m.roles)&&m.roles.includes('admin');
const cohortIdsOf=(t:any,programId:string):string[]=>(t.cohorts??[]).filter((c:any)=>c.programId===programId).map((c:any)=>c.id);
const programmeOf=(spaceId:any):string|null=>typeof spaceId==='string'&&spaceId.startsWith('programme:')&&spaceId.length<=140?spaceId.slice(10):null;
/** Read and write access. Unknown spaces and spaces the member may not see answer identically. */
export function spaceAccess(t:any,m:any,spaceId:any):boolean{
 if(!m||m.active!==true||!Array.isArray(m.roles))return false;
 if(spaceId===ECOSYSTEM_SPACE_ID)return store(t).ecosystemOpen===true;
 const pid=programmeOf(spaceId);if(!pid)return false;
 const cohorts=cohortIdsOf(t,pid);if(!cohorts.length)return false;
 if(m.roles.includes('admin'))return true;
 const scopes:string[]=Array.isArray(m.scopes)?m.scopes:[];
 if(m.roles.some((r:string)=>STAFF.includes(r))&&cohorts.some(id=>scopes.includes(id)))return true;
 return m.roles.includes('learner')&&!!t.learners.find((l:any)=>l.userId===m.userId)?.state.enrollments.some((e:any)=>e.programId===pid&&!e.withdrawn);
}
/** Moderator scope = cohorts of the pathway. Owners moderate every space of their workspace. */
export function canModerateSpace(t:any,m:any,spaceId:any):boolean{
 if(!spaceAccess(t,m,spaceId))return false;
 if(isOwner(m))return true;
 if(!m.roles.includes('moderator'))return false;
 if(spaceId===ECOSYSTEM_SPACE_ID)return false;
 const cohorts=cohortIdsOf(t,programmeOf(spaceId)!),scopes:string[]=Array.isArray(m.scopes)?m.scopes:[];
 return cohorts.some(id=>scopes.includes(id));
}
const snap=(n:any)=>String(n||'Academy member').slice(0,80);

export function applySpaceCommand(t:Team,m:any,c:any,now:string):boolean{
 if(!isSpaceCommand(c))return false;
 const s=store(t);
 if(c.type==='space-ecosystem'){
  exact(c,['enabled']);if(!isOwner(m))throw new RuleError(DENIED,403);if(typeof c.enabled!=='boolean')throw new RuleError('Choose whether to open the ecosystem room.');
  if(s.ecosystemOpen===c.enabled)return true;
  s.ecosystemOpen=c.enabled;s.ecosystemChangedBy=m.userId;s.ecosystemChangedAt=now;
  (t.activity??=[]).push({id:crypto.randomUUID(),actor:m.userId,actorName:snap(m.name),action:c.type,createdAt:now,detail:{enabled:c.enabled}});return true;
 }
 if(c.type==='space-post'){
  exact(c,['spaceId','title','body']);
  if(!spaceAccess(t,m,c.spaceId))throw new RuleError(NOT_FOUND_SPACE,404);
  if(s.posts.length>=SPACE_LIMITS.posts)throw new RuleError('Pilot discussion limit reached.',409);
  s.posts.unshift({id:crypto.randomUUID(),spaceId:c.spaceId,title:text(c.title,'Title',5,140),body:text(c.body,'Discussion',20,3000),author:snap(m.name),authorId:m.userId,status:'pending',createdAt:now,replies:[]});return true;
 }
 const p=typeof c.postId==='string'?s.posts.find(p=>p.id===c.postId):undefined;
 if(!p||!spaceAccess(t,m,p.spaceId))throw new RuleError(NOT_FOUND_POST,404);
 if(c.type==='space-moderate'){
  exact(c,['postId','replyId','status','reason']);if(!canModerateSpace(t,m,p.spaceId))throw new RuleError(DENIED,403);
  if(!['visible','hidden'].includes(c.status))throw new RuleError('Choose publish or hide.');
  const reason=text(c.reason,'Moderation reason',10,1000),reply=c.replyId?p.replies.find((r:any)=>r.id===c.replyId):null;
  if(c.replyId&&!reply)throw new RuleError('Reply not found.',404);
  s.moderation.push({id:crypto.randomUUID(),postId:p.id,replyId:c.replyId||null,spaceId:p.spaceId,actor:m.userId,actorName:snap(m.name),reason,previousStatus:reply?reply.status:p.status,status:c.status,createdAt:now});
  if(reply)reply.status=c.status;else{p.status=c.status;for(const r of s.reports.filter(r=>r.postId===p.id))r.status='resolved'}
  return true;
 }
 // reply and report need a visible post
 if(p.status!=='visible')throw new RuleError(NOT_FOUND_POST,404);
 if(c.type==='space-reply'){
  exact(c,['postId','body']);if(p.replies.length>=SPACE_LIMITS.replies)throw new RuleError('Reply limit reached.');
  p.replies.push({id:crypto.randomUUID(),body:text(c.body,'Reply',10,1500),author:snap(m.name),authorId:m.userId,status:'pending',createdAt:now});return true;
 }
 exact(c,['postId','reason']);
 if(s.reports.some(r=>r.postId===p.id&&r.reporterId===m.userId&&r.status==='open'))throw new RuleError('Your report is already awaiting review.',409);
 s.reports.push({id:crypto.randomUUID(),postId:p.id,spaceId:p.spaceId,reporterId:m.userId,reason:text(c.reason,'Report reason',10,1000),status:'open',createdAt:now});return true;
}

const title=(t:any,spaceId:string)=>{const pid=programmeOf(spaceId);if(!pid)return 'Ecosystem room';const prog=programs.find((p:any)=>p.id===pid);return (prog?.title??t.cohorts.find((c:any)=>c.programId===pid)?.title??'Pathway')+' · pathway discussion'};
/** Per-viewer projection. Nothing here grants authority: every command re-checks on the server. */
export function projectSpaces(t:any,m:any){
 const s=store(t),active=!!m&&m.active===true;
 const empty={items:[] as any[],posts:[] as any[],reports:[] as any[],moderationHistory:[] as any[],ecosystem:null as any,note:ECOSYSTEM_BOUNDARY_NOTE,canOpenEcosystem:false};
 if(!active)return empty;
 const programmeIds=[...new Set<string>((t.cohorts??[]).map((c:any)=>c.programId))],ids=[...programmeIds.map(programmeSpaceId),ECOSYSTEM_SPACE_ID].filter(id=>spaceAccess(t,m,id));
 const mod=(id:string)=>canModerateSpace(t,m,id),owner=isOwner(m);
 const items=ids.map(id=>({id,kind:id===ECOSYSTEM_SPACE_ID?'ecosystem':'programme',programId:programmeOf(id),title:title(t,id),canModerate:mod(id)}));
 const posts=s.posts.filter(p=>ids.includes(p.spaceId)&&(p.status==='visible'||p.authorId===m.userId||mod(p.spaceId))).map(p=>{const x=structuredClone(p);delete x.authorId;x.replies=x.replies.filter((r:any)=>r.status==='visible'||r.authorId===m.userId||mod(p.spaceId)).map((r:any)=>{const z=structuredClone(r);delete z.authorId;return z});return x});
 const reports=s.reports.filter(r=>ids.includes(r.spaceId)&&mod(r.spaceId)).map(r=>({id:r.id,postId:r.postId,spaceId:r.spaceId,reason:r.reason,status:r.status,createdAt:r.createdAt}));
 const moderationHistory=s.moderation.filter(x=>ids.includes(x.spaceId)&&mod(x.spaceId));
 return {items,posts,reports,moderationHistory,ecosystem:owner||s.ecosystemOpen?{enabled:s.ecosystemOpen,context:t.context,canManage:owner}:null,note:ECOSYSTEM_BOUNDARY_NOTE,canOpenEcosystem:owner};
}
