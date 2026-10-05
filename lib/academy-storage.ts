import {supportClosureReserve} from './academy-support';
import {RuleError} from './academy-engine';
import type {Team} from './academy-teams';
export const WORKSPACE_CONTENT_BYTES=1_200_000;
export const WORKSPACE_PROTECTIVE_BYTES=1_800_000;
const subset=(next:any,prior:any[])=>Array.isArray(next)&&next.every(x=>prior.includes(x));
export function protectiveMutation(before:Team,c:any){
 if(c.type==='support-withdraw')return true;
 if(c.type==='revoke-invite')return true;
 if(c.type==='cohort-status')return ['paused','closed'].includes(c.status);
 if(c.type==='moderate')return c.status==='hidden';
 if(c.type==='network-profile')return c.enabled===false;
 if(c.type==='session-rsvp')return c.going===false;
 if(c.type==='session-cancel')return true;
 if(c.type==='member'){const m=before.members.find(m=>m.userId===c.userId);return !!m&&(c.active===false||(c.active===m.active&&subset(c.roles,m.roles)&&subset(c.scopes,m.scopes)))}
 return false;
}
export function checkMutationBudget(before:Team,after:Team,c:any){
 const bytes=(x:any)=>new TextEncoder().encode(JSON.stringify(x)).length,oldBytes=bytes(before),newBytes=bytes(after),protective=protectiveMutation(before,c),cap=protective?WORKSPACE_PROTECTIVE_BYTES:WORKSPACE_CONTENT_BYTES;
 const oldReserved=oldBytes+supportClosureReserve(before),newReserved=newBytes+supportClosureReserve(after);
 if(newReserved>oldReserved&&newReserved>WORKSPACE_PROTECTIVE_BYTES)throw new RuleError('This workspace must retain room for open support requests to be withdrawn. Keep your input and contact the owner before adding more history.',413);
 if(newBytes>oldBytes&&newBytes>cap)throw new RuleError(protective?'This workspace needs support to free its protective storage reserve. Your input has been retained.':'This pilot workspace is near its content limit. Access removal, content hiding and cancellations remain available. Contact the workspace owner before adding more content.',413);
 return {oldBytes,newBytes,protective};
}
// API persists this packet atomically with the revision update before removing
// it from the hot aggregate. Assessment and learner evidence are never archived
// by this helper. Reads remain subject to admin / moderator cohort authority.
export function separateHistory(t:Team){const packet:{activity:any[];moderation:any[]}={activity:[],moderation:[]};for(const key of ['activity','moderation'] as const){const history=t[key]??[];if(history.length>200){packet[key]=history.slice(0,-200);t[key]=history.slice(-200)}}return packet.activity.length||packet.moderation.length?packet:null}
