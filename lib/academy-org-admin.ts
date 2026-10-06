import {isOverdue} from './academy-data-requests';
import {escalationSla} from './academy-escalation';

/** Organisation administration overview (BR-38). Read only, counts only.
 *
 * Input is a list of full team aggregates the SERVER already loaded for the signed-in user;
 * this function re-checks ownership itself and drops every workspace where the user is not an
 * ACTIVE owner (role admin). It therefore can never describe a workspace the user does not own,
 * even if the caller passes extra ones. Output holds counts and workspace identity only: no
 * learner names, evidence, post text, support text, emails or ids of other people.
 * Admin ACTIONS are not implemented here. They go through the existing protected team command
 * route (invite, revoke-invite, member, cohort-status), which re-checks ownership per workspace. */
export const ORG_LIMITS={workspaces:25} as const;
export const ORG_ROLES=['admin','learner','facilitator','assessor','reviewer','moderator'] as const;
export const isActiveOwner=(t:any,userId:string)=>{const m=Array.isArray(t?.members)?t.members.find((x:any)=>x?.userId===userId):null;return !!m&&m.active===true&&Array.isArray(m.roles)&&m.roles.includes('admin')};
export function projectWorkspaceCounts(t:any,now:string){
 const members=(t.members??[]).filter((m:any)=>m.active),roles:Record<string,number>=Object.fromEntries(ORG_ROLES.map(r=>[r,0]));
 for(const m of members)for(const r of m.roles??[])if(r in roles)roles[r]++;
 const seats=(cid:string)=>(t.learners??[]).reduce((n:number,l:any)=>n+(l.state?.enrollments??[]).filter((e:any)=>e.cohortId===cid&&!e.withdrawn).length,0);
 const cohorts=t.cohorts??[],byStatus={open:0,paused:0,closed:0} as Record<string,number>;for(const c of cohorts)if(c.status in byStatus)byStatus[c.status]++;
 const nowMs=Date.parse(now),invites=(t.invites??[]).filter((i:any)=>i.status==='active'),pendingInvites=invites.filter((i:any)=>Date.parse(i.expiresAt)>nowMs).length;
 const escalations=(t.escalations??[]).filter((e:any)=>e.status==='open');
 const requests=t.dataRequests?.requests??[];
 return {
  workspaceId:t.id,name:t.name,context:t.context,
  members:{active:members.length,removed:(t.members??[]).length-members.length,byRole:roles},
  cohorts:{total:cohorts.length,...byStatus,pathways:new Set(cohorts.map((c:any)=>c.programId)).size},
  seats:{occupied:cohorts.reduce((n:number,c:any)=>n+seats(c.id),0),capacity:cohorts.reduce((n:number,c:any)=>n+(Number.isInteger(c.capacity)?c.capacity:0),0)},
  invites:{pending:pendingInvites,expired:invites.length-pendingInvites},
  escalations:{open:escalations.length,overdue:escalations.filter((e:any)=>escalationSla(e,now).overdue).length},
  dataRequests:{open:requests.filter((r:any)=>['received','verified','verification-failed'].includes(r.status)).length,overdue:requests.filter((r:any)=>isOverdue(r,now)).length},
  recoveryPending:(t.recovery??[]).filter((r:any)=>r.status==='pending').length
 };
}
export function projectOrgOverview(teams:any[],userId:string,now=new Date().toISOString()){
 const owned=(Array.isArray(teams)?teams:[]).filter(t=>isActiveOwner(t,userId)).slice(0,ORG_LIMITS.workspaces).map(t=>projectWorkspaceCounts(t,now));
 return {generatedAt:now,workspaces:owned,totals:{workspaces:owned.length,activeMembers:owned.reduce((n,w)=>n+w.members.active,0),pendingInvites:owned.reduce((n,w)=>n+w.invites.pending,0),openEscalations:owned.reduce((n,w)=>n+w.escalations.open,0),overdueEscalations:owned.reduce((n,w)=>n+w.escalations.overdue,0),overdueDataRequests:owned.reduce((n,w)=>n+w.dataRequests.overdue,0)}};
}
