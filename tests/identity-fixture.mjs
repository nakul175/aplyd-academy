import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';

// Uses the checkout's loopback-only QA identity convention. No production URL,
// authentication cookie or real account is read or used by this candidate.
export const app=resolve(process.env.ACADEMY_APP_PATH??new URL('../',import.meta.url).pathname);
export const qa=await import(pathToFileURL(resolve(app,'tests/local-qa.mjs')));
export const {base,headers,current,action,post,get,success,identity,nonce}=qa;
export const out=resolve(process.env.ACADEMY_IDENTITY_QA_OUT??new URL('../.sites-runtime/identity-qa',import.meta.url).pathname);
mkdirSync(out,{recursive:true});
export const seed=qa.curriculum.pathways[1];
export function record(name,result){writeFileSync(resolve(out,name),JSON.stringify(result,null,2));}
export async function personalRead(u){const r=await fetch(base+'/api/academy',{headers:headers(u)});return {status:r.status,...await r.json()};}
export async function personalPost(u,command,revision,actionId=crypto.randomUUID()){
 const r=await fetch(base+'/api/academy',{method:'POST',headers:headers(u),body:JSON.stringify({command,revision,actionId})});return {status:r.status,...await r.json()};
}
export async function personalName(u,name){const x=success(await personalRead(u));return success(await personalPost(u,{type:'profile',...x.state.profile,name},x.revision));}
export async function workspaceName(u,id,name){const x=success(await current(u,id));return success(await action(u,id,{type:'profile',...x.state.profile,name}));}
export async function identityFixture(){
 const f=await qa.fixture(),a=f.owner,b=f.mod;
 success(await action(a,f.id,{type:'member',userId:b.id,roles:['admin','learner'],scopes:[],active:true}));
 const other=identity('identity-unjoined');
 const names={a:'SAVED-PERSONAL-A-'+nonce.slice(0,16),b:'SAVED-PERSONAL-B-'+nonce.slice(0,16),sharedA:'SAVED-SHARED-A-'+nonce.slice(0,16),sharedB:'SAVED-SHARED-B-'+nonce.slice(0,16)};
 await personalName(a,names.a);await personalName(b,names.b);
 await workspaceName(a,f.id,names.sharedA);await workspaceName(b,f.id,names.sharedB);
 const pinned=success(await current(a,f.id)).team.cohorts.find(c=>c.id===f.cid);
 const globalRef=pinned.contentRef??{scope:'global',programId:pinned.programId,versionId:pinned.version};
 assert.equal(globalRef.scope,'global');assert.equal(globalRef.programId,seed.id);assert.equal(typeof globalRef.versionId,'string');
 const xa=success(await action(a,f.id,{type:'content-copy',sourceRef:globalRef}));let da=xa.team.content.drafts.at(-1);
 const document=structuredClone(da.document);document.title='CANONICAL-PRIVATE-SOURCE-'+nonce.slice(0,16);
 const saved=success(await action(a,f.id,{type:'content-save',draftId:da.id,revision:da.revision,document}));da=saved.team.content.drafts.find(d=>d.id===da.id);
 const xb=success(await action(b,f.id,{type:'content-copy',sourceRef:globalRef})),db=xb.team.content.drafts.at(-1);
 assert.equal(da.authorId,a.id);assert.equal(db.authorId,b.id);
 const createOwn=async(u,name)=>success(await post(u,undefined,{type:'create',name,purpose:'An entirely fictional local directory identity isolation fixture.',context:'msme'},0));
 const ownA=await createOwn(a,'ACCOUNT-A-ONLY-'+nonce.slice(0,16)),ownB=await createOwn(b,'ACCOUNT-B-ONLY-'+nonce.slice(0,16));
 return {...f,a,b,other,names,da,db,ownA:ownA.team,ownB:ownB.team};
}
