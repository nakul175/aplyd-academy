import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const app=resolve(process.env.ACADEMY_APP_PATH??new URL('../../',import.meta.url).pathname);
const {identityFixture,qa,base,headers,current,action,get,post,success,identity,nonce}=await import(pathToFileURL(resolve(app,'tests/identity-fixture.mjs')));
export {qa,base,headers,current,action,get,post,success,identity,nonce};
export const out=resolve(process.env.ACADEMY_PERFORMANCE_QA_OUT??resolve(app,'.sites-runtime/performance-qa'));mkdirSync(out,{recursive:true});
export function record(name,value){writeFileSync(resolve(out,name),JSON.stringify(value,null,2))}
export const expectedSources={teams:'app/academy-teams-ui.tsx',content:'app/academy-authoring.tsx',review:'app/academy-studio.tsx',operations:'app/academy-operations-page.tsx',learning:'app/academy-learning.tsx',community:'app/academy-community.tsx',settings:'app/academy-settings.tsx'};
export function emittedAssets(){
 const manifest=JSON.parse(readFileSync(resolve(app,'dist/client/.vite/manifest.json'),'utf8')),assets={};
 for(const [name,source]of Object.entries(expectedSources)){
  const value=manifest[source]??Object.values(manifest).find(x=>x.src===source);
  assert.ok(value?.file,'Deferred source missing from current manifest: '+source+'. Wait for the reviewed v0.8 build; do not run against old assets.');
  assets[name]='/'+value.file;
 }
 const keyForFile=new Map(Object.entries(manifest).map(([k,v])=>[v.file,k]));
 const staticClosure=new Set();function add(key){if(staticClosure.has(key))return;staticClosure.add(key);for(const child of manifest[key]?.imports??[])add(child)}
 for(const [key,value]of Object.entries(manifest))if(value.isEntry||key==='app/academy.tsx')add(key);
 const initialFiles=new Set([...staticClosure].map(k=>'/'+manifest[k]?.file).filter(x=>x.endsWith('.js')));
 for(const name of ['teams','content','review','operations'])assert.ok(!initialFiles.has(assets[name]),name+' is still in the initial static closure.');
 return {manifest,assets,initialFiles,keyForFile};
}
export async function performanceFixture(){
 const f=await identityFixture(),{a:owner,b:backup,id,cid,p,outsider:learner}=f;
 const ownerRoles=['admin','learner','facilitator','assessor'];
 success(await action(owner,id,{type:'member',userId:owner.id,roles:ownerRoles,scopes:[cid],active:true}));
 let x=success(await action(learner,id,{type:'enroll',programId:p.id,cohortId:cid})),e=x.state.enrollments.at(-1);
 const canaries={evidence:'LAZY-PRIVATE-ASSIGNED-EVIDENCE-'+nonce+': fictional verified sources and accountable human approval.',content:'LAZY-PRIVATE-CONTENT-SUMMARY-'+nonce,goal:'LAZY-PRIVATE-OWNER-GOAL-'+nonce};
 for(const lesson of p.lessons)success(await action(learner,id,{type:'lesson',enrollmentId:e.id,lessonId:lesson.id,practice:canaries.evidence,answers:lesson.quiz.map(q=>q.correctOptionIndex)}));
 x=success(await action(learner,id,{type:'submit',enrollmentId:e.id,confirmed:true,fields:Object.fromEntries(p.practicalAssessment.submissionPrompts.map(prompt=>[prompt.id,canaries.evidence]))}));
 const attemptId=x.state.enrollments.find(x=>x.id===e.id).attempts.at(-1).id;
 success(await action(owner,id,{type:'assign',kind:'assessment',targetId:attemptId,staffId:owner.id}));
 success(await action(owner,id,{type:'learning-plan',goal:'explore',personalGoal:canaries.goal,weeklyMinutes:40,timeZone:'Asia/Kolkata',remindersEnabled:false}));
 const pin=success(await current(owner,id)).team.cohorts.find(c=>c.id===cid),ref=pin.contentRef??{scope:'global',programId:pin.programId,versionId:pin.version};
 x=success(await action(owner,id,{type:'content-copy',sourceRef:ref}));let d=x.team.content.drafts.at(-1),document=structuredClone(d.document);document.title='LAZY-PENDING-CONTENT-'+nonce.slice(0,16);document.summary=canaries.content+' Fictional practice using accountable checks and preserved references.';
 x=success(await action(owner,id,{type:'content-save',draftId:d.id,revision:d.revision,document}));d=x.team.content.drafts.find(x=>x.id===d.id);
 x=success(await action(owner,id,{type:'content-submit',draftId:d.id,revision:d.revision,reviewerId:backup.id,reviewDueAt:new Date(Date.now()+30*86400000).toISOString()}));d=x.team.content.drafts.find(x=>x.id===d.id);
 return {...f,owner,backup,learner,ownerRoles,attemptId,enrollmentId:e.id,targetDraft:d,canaries};
}
