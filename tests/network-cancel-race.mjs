import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const app=resolve(process.env.ACADEMY_APP_PATH??new URL('../',import.meta.url).pathname),qa=await import(pathToFileURL(resolve(app,'tests/local-qa.mjs')));
const {fixture,current,action,post,success,base}=qa;
// local-qa rejects non-loopback URLs before any request; all identities are fresh.
const out=resolve(process.env.ACADEMY_PR05_QA_OUT??resolve(app,'.sites-runtime/pr05-cancel-race'));mkdirSync(out,{recursive:true});
const startedAt=new Date().toISOString(),observations=[];let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++},ok=(value,label)=>{assert.ok(value,label);checks++};
const session=(payload,id)=>payload.team.network.sessions.find(s=>s.id===id);
try{
 const f=await fixture(),{owner,a,b,id,cid}=f;
 const aBefore=success(await current(a,id)),bBefore=success(await current(b,id));
 const startsAt=new Date(Date.now()+3600000).toISOString(),endsAt=new Date(Date.now()+7200000).toISOString();
 const reason='PR05 fictional local cancellation: source packet needs review before practice.',instructions='PR05-PRIVATE-JOIN: fictional classroom only.';
 const created=success(await action(owner,id,{type:'session-create',cohortId:cid,title:'PR05 fictional cancellation race',description:'Fictional supported-API cancellation and reservation conflict acceptance.',instructions,startsAt,endsAt,capacity:2}));
 const sid=created.team.network.sessions.at(-1).id;
 // Keep an independent earlier registration so cancellation must preserve truthful history
 // regardless of which concurrent operation wins. There is one available seat for A.
 const prior=success(await action(b,id,{type:'session-rsvp',sessionId:sid,going:true}));
 eq(session(prior,sid).myRsvp,'going','B earlier confirmed registration');
 const before=success(await current(owner,id)),revision=before.revision;
 eq(session(before,sid).status,'scheduled');eq(session(before,sid).occupied,1);
 const cancellation={type:'session-cancel',sessionId:sid,reason},reservation={type:'session-rsvp',sessionId:sid,going:true};
 const actionIds={cancel:crypto.randomUUID(),rsvp:crypto.randomUUID()};
 const [cancel,rsvp]=await Promise.all([post(owner,id,cancellation,revision,actionIds.cancel),post(a,id,reservation,revision,actionIds.rsvp)]);
 eq([cancel.status,rsvp.status].sort((x,y)=>x-y),[200,409],'Exactly one same-revision concurrent command commits');
 const winner=cancel.status===200?'cancel':'rsvp',loser=winner==='cancel'?'rsvp':'cancel';
 const after=success(await current(owner,id));eq(after.revision,revision+1,'One actual revision committed');eq(session(after,sid).status,winner==='cancel'?'cancelled':'scheduled');eq(session(after,sid).occupied,winner==='cancel'?1:2);
 const aAfter=success(await current(a,id)),aHadRegistration=winner==='rsvp';
 eq(session(aAfter,sid).myRsvp,aHadRegistration?'going':'none');eq(aAfter.team.network.history.filter(h=>h.id===sid).length,aHadRegistration?1:0);
 if(winner==='rsvp')ok(session(aAfter,sid).instructions?.includes(instructions),'Winner reservation receives current instructions before deliberate cancellation');
 else ok(!JSON.stringify(aAfter.team.network).includes(instructions),'Cancelled session never exposes instructions');
 observations.push({phase:'concurrent pair',sameRevision:revision,statuses:{cancel:cancel.status,rsvp:rsvp.status},winner,loser,committedRevision:after.revision});
 // A deliberate user retry uses the observed current revision and a fresh action reference.
 // No retry is made after an unreadable/uncertain transport response.
 const retryActor=loser==='cancel'?owner:a,retryCommand=loser==='cancel'?cancellation:reservation;
 const fresh=success(await current(retryActor,id)),retryId=crypto.randomUUID();
 const retry=await post(retryActor,id,retryCommand,fresh.revision,retryId);
 eq(retry.status,loser==='cancel'?200:409,'Refreshed loser retry respects current session state');
 const finalOwner=success(await current(owner,id)),finalA=success(await current(a,id)),finalB=success(await current(b,id));
 eq(finalOwner.revision,revision+(winner==='rsvp'?2:1));
 for(const payload of [finalOwner,finalA,finalB]){const s=session(payload,sid);eq(s.status,'cancelled');eq(s.cancellation.reason,reason);ok(!JSON.stringify(payload.team.network).includes(instructions),'Cancellation hides joining instructions even for host');}
 const priorHistory=finalB.team.network.history.find(h=>h.id===sid);ok(priorHistory,'B committed earlier reservation remains in own history');eq(priorHistory.status,'cancelled');eq(priorHistory.myRsvp,'going','Prior confirmed choice is retained as history alongside cancelled session status');eq(priorHistory.cancellationReason,reason);eq(priorHistory.attendance,[],'No attendance invented');
 for(const forbidden of ['hostId','userId','instructions','registrations'])ok(!(forbidden in priorHistory),'Own history excludes '+forbidden);
 const ownHistory=finalA.team.network.history.find(h=>h.id===sid);eq(!!ownHistory,aHadRegistration,'No fabricated history for a losing uncommitted reservation');if(ownHistory){eq(ownHistory.status,'cancelled');eq(ownHistory.myRsvp,'going');eq(ownHistory.cancellationReason,reason);eq(ownHistory.attendance,[]);}
 eq(finalA.state.enrollments,aBefore.state.enrollments,'Cancellation/RSVP cannot complete learning or issue records');eq(finalB.state.enrollments,bBefore.state.enrollments);
 const finalRevision=finalOwner.revision;
 const rejected=await post(a,id,reservation,finalA.revision);eq(rejected.status,409,'Cancelled session never accepts a new/refreshed reservation');
 const rejectedPrior=await post(b,id,reservation,finalB.revision);eq(rejectedPrior.status,409,'Even previously confirmed member cannot rejoin a cancelled session');
 const afterRejections=success(await current(owner,id));eq(afterRejections.revision,finalRevision,'Rejected reservations do not mutate revision');eq(session(afterRejections,sid).registrations.length,aHadRegistration?2:1,'No later registration added');
 observations.push({phase:'deliberate refreshed loser retry',actorRole:loser==='cancel'?'host':'learner',command:retryCommand.type,revision:fresh.revision,status:retry.status,actionId:retryId});observations.push({phase:'final reads',revision:finalRevision,sessionStatus:'cancelled',cancellationReasonVisible:true,joiningInstructionsAbsent:true,earlierRegistrationPreserved:true,uncommittedRegistrationHistoryAbsent:!aHadRegistration,finalNewRSVPStatuses:[rejected.status,rejectedPrior.status],learningUnchanged:true});
 const files=['tests/local-qa.mjs','app/api/teams/route.ts','lib/academy-network.ts'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(resolve(app,file))).digest('hex')}));
 const result={passed:true,startedAt,completedAt:new Date().toISOString(),base,worker:process.env.ACADEMY_PR05_WORKER??'parent-confirmed stable local Worker',fixtureId:id,sessionId:sid,checks,observations,sourceHashes:files,limits:['Fresh synthetic local identities and supported API only; existing fixtures are not modified','One actual nondeterministic cancel-vs-RSVP race; this run does not prove both possible scheduling orders','No SQL, clock injection, production request, notification, hosted identity, actual attendance or throughput claim','Reservation going in own history is the prior saved choice; cancelled session status and reason prevent an attendance/completion inference']};writeFileSync(resolve(out,'network-cancel-race-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,checks,winner,loser,fixtureId:id,sessionId:sid}));
}catch(error){writeFileSync(resolve(out,'network-cancel-race-result.json'),JSON.stringify({passed:false,startedAt,completedAt:new Date().toISOString(),checks,observations,error:String(error)},null,2)+'\n');throw error}
