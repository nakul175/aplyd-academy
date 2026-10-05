import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export const app=resolve(process.env.ACADEMY_APP_PATH??'.');
export const base=process.env.ACADEMY_LOCAL_URL??'http://127.0.0.1:8787';
const url=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'These candidates only operate on a local synthetic test server.');
export const curriculum=JSON.parse(readFileSync(resolve(app,'lib/curriculum.json'),'utf8'));
export const nonce=crypto.randomUUID();
export const identity=role=>({id:`qa-${role}-${nonce}`,email:`${role}-${nonce}@academy.test`,name:`Synthetic ${role}`});
export const headers=u=>({'Content-Type':'application/json','oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':encodeURIComponent(u.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
export async function get(u,path='/api/teams') {const r=await fetch(base+path,{headers:headers(u)});return {status:r.status,...await r.json()};}
export async function post(u,id,command,revision,actionId=crypto.randomUUID()) {const r=await fetch(base+'/api/teams',{method:'POST',headers:headers(u),body:JSON.stringify({teamId:id,command,revision,actionId})});return {status:r.status,...await r.json()};}
export const current=(u,id)=>get(u,'/api/teams?id='+encodeURIComponent(id));
export async function action(u,id,command) {const x=await current(u,id);assert.equal(x.status,200,JSON.stringify(x));return post(u,id,command,x.revision);}
export function success(x) {assert.equal(x.status,200,JSON.stringify(x));return x;}
export async function fixture() {
 const owner=identity('owner'),a=identity('learner-a'),b=identity('learner-b'),outsider=identity('unjoined'),mod=identity('moderator'),p=curriculum.pathways[1];
 const x=success(await post(owner,undefined,{type:'create',name:'Synthetic QA '+nonce.slice(0,8),purpose:'Fictional local networking and archive regression fixture.',context:'msme'},0)),id=x.team.id;
 let y=success(await action(owner,id,{type:'cohort-create',title:'Local customer practice circle',programId:p.id,capacity:10}));const cid=y.team.cohorts[0].id;
 y=success(await action(owner,id,{type:'cohort-create',title:'Other local source circle',programId:curriculum.pathways[2].id,capacity:10}));const otherCid=y.team.cohorts[1].id;
 for(const [u,roles,scopes] of [[a,['learner'],[]],[b,['learner'],[]],[outsider,['learner'],[]],[mod,['moderator'],[cid]]]) {
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  success(await action(owner,id,{type:'invite',email:u.email,roles,scopes,token}));const preview=success(await get(u,'/api/teams?invite='+token));success(await post(u,id,{type:'accept',token},preview.revision));
 }
 for(const u of [a,b])success(await action(u,id,{type:'enroll',programId:p.id,cohortId:cid}));
 return {owner,a,b,outsider,mod,p,id,cid,otherCid};
}
