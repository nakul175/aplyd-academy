/** Synthetic fixture shared by the wave 3 QA suites. Fictional people only. */
import {createTeam,applyTeamCommand,programs} from '../../.sites-runtime/wave3-qa/model.mjs';
export const NOW='2026-10-05T09:00:00.000Z';
export const at=(hours)=>new Date(Date.parse(NOW)+hours*3600000).toISOString();
export const user=(id)=>({userId:id,email:id+'@example.test'});
export const apply=(t,u,c,time=NOW)=>applyTeamCommand(t,typeof u==='string'?user(u):u,c,time);
export const status=(fn)=>{try{fn();return null}catch(e){return {status:e.status,message:e.message}}};
export const denied=(fn,code)=>{const r=status(fn);if(!r||r.status!==code)throw new Error(`expected ${code}, got ${JSON.stringify(r)}`);return r};
export const PROG_A=programs[1],PROG_B=programs[0];
export const LONG='Synthetic evidence with source references, verification and human approval steps.';
/** Build a workspace. Cohort A (programs[1]) and cohort B (programs[0]).
 * owner: admin+learner. modA moderates A; modB moderates B; facA facilitates A;
 * assessB assesses B; revA reviews A; lrnA1..3 learn in A; lrnB1 in B. */
export function workspace(id='ws-one',ownerId='owner'){
 let t=createTeam(user(ownerId),{name:'Fictional pilot '+id,purpose:'A synthetic workspace for boundary checks.',context:'msme'},id,NOW);
 t=apply(t,ownerId,{type:'cohort-create',title:'Cohort A '+id,programId:PROG_A.id,capacity:10});
 t=apply(t,ownerId,{type:'cohort-create',title:'Cohort B '+id,programId:PROG_B.id,capacity:10});
 const A=t.cohorts[0].id,B=t.cohorts[1].id;
 const staff=[['modA',['moderator'],[A]],['modB',['moderator'],[B]],['facA',['facilitator'],[A]],['assessB',['assessor'],[B]],['revA',['reviewer','assessor'],[A]],['lrnA1',['learner'],[]],['lrnA2',['learner'],[]],['lrnA3',['learner'],[]],['lrnB1',['learner'],[]],['plain',['learner'],[]]];
 staff.forEach(([n,r,s],i)=>{const h=(i+1).toString(16).padStart(2,'0').repeat(32);t=apply(t,ownerId,{type:'invite',email:n+'@'+id+'.example.test',roles:r,scopes:s,tokenHash:h});t=apply(t,{userId:n+'@'+id,email:n+'@'+id+'.example.test'},{type:'accept',tokenHash:h})});
 return {t,A,B,ids:Object.fromEntries(staff.map(([n])=>[n,n+'@'+id])),owner:ownerId};
}
export const u=(w,n)=>({userId:w.ids[n]??n,email:(w.ids[n]??n)+'.example.test'});
/** lrnA1/lrnA2 enrol in A, lrnB1 in B; lrnA1 posts, modA publishes; lrnA2 reports. */
export function withReport(w){
 let t=w.t;
 for(const [n,c,p] of [['lrnA1',w.A,PROG_A],['lrnA2',w.A,PROG_A],['lrnA3',w.A,PROG_A],['lrnB1',w.B,PROG_B]])t=apply(t,u(w,n),{type:'enroll',programId:p.id,cohortId:c});
 t=apply(t,u(w,'lrnA1'),{type:'post',cohortId:w.A,title:'A fictional discussion title',body:'A fictional discussion body long enough to pass validation.'});
 const postId=t.posts[0].id;
 t=apply(t,u(w,'modA'),{type:'moderate',postId,status:'visible',reason:'Publishing a fictional discussion post.'});
 t=apply(t,u(w,'lrnA2'),{type:'report',postId,reason:'Fictional reason: this seems unsuitable for the circle.'});
 return {...w,t,postId,reportId:t.reports[0].id};
}
export const escalate=(w,who='modA',extra={})=>apply(w.t,u(w,who),{type:'escalate-report',reportId:w.reportId,severity:'medium',reason:'Needs the workspace owner to decide this fictional matter.',...extra});
export {createTeam,applyTeamCommand,programs};
