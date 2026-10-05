import './qa-paths.mjs';
import assert from 'node:assert/strict';
import {base,headers,identity,get,curriculum} from '../local-qa.mjs';
export {base,headers,identity,curriculum};
export {out} from './qa-paths.mjs';
export const mappings=[{partner:'agri',name:'Agri Saha',programId:'farmer-work-records'},{partner:'msme',name:'MSME',programId:'msme-customer-operations'},{partner:'public',name:'Public service',programId:'public-servant-source-briefs'}];
export const own=u=>get(u,'/api/academy');
export async function ownPost(u,command,revision,actionId=crypto.randomUUID()){
 const r=await fetch(base+'/api/academy',{method:'POST',headers:headers(u),body:JSON.stringify({command,revision,actionId})});
 return {status:r.status,...await r.json()};
}
export function pass(x){assert.equal(x.status,200,JSON.stringify(x));return x;}
export async function ownAction(u,command){const x=pass(await own(u));return pass(await ownPost(u,command,x.revision));}
export async function enrolled(u){const ids={};for(const m of mappings){const x=await ownAction(u,{type:'enroll',programId:m.programId});ids[m.partner]=x.state.enrollments.find(e=>e.programId===m.programId&&!e.withdrawn).id;}return ids;}
export const choice=(partner,enrollmentId,scopes=['learning.progress'],durationDays=7)=>({type:'ecosystem-grant',partner,enrollmentId,scopes,durationDays});
export function protectedAbsent(receipt,values){const text=JSON.stringify(receipt);for(const value of values)assert.ok(!text.includes(value),'A protected value appeared in the minimal receipt');}
