import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectTeam,ESCALATION_SLA_HOURS,ESCALATION_SEVERITIES,SAFEGUARDING_HANDLING_NOTE,escalationSla} from '../../.sites-runtime/wave3-qa/model.mjs';
import {NOW,at,apply,u,workspace,withReport,escalate,denied,status} from './fixture.mjs';

const setup=()=>withReport(workspace());
const esc=(w,who='modA')=>({...w,t:escalate(w,who)});
const resolveCmd=(w,extra={})=>({type:'escalation-resolve',escalationId:w.t.escalations[0].id,decision:'resolve',reason:'Reviewed the fictional matter and acted on it.',...extra});

test('a scoped moderator escalates with a fixed severity and the history starts',()=>{
 const w=esc(setup()),e=w.t.escalations[0];
 assert.equal(e.status,'open');assert.equal(e.severity,'medium');assert.equal(e.history.length,1);assert.equal(e.history[0].type,'escalated');
 assert.equal(e.dueAt,at(ESCALATION_SLA_HOURS.medium));
 assert.deepEqual([...ESCALATION_SEVERITIES],['low','medium','high','safeguarding']);
 denied(()=>escalate(w,'modA',{severity:'urgent'}),422);
});
test('defined scope: out-of-scope moderator, facilitator, learner, reporter and unknown id get the identical 404',()=>{
 const w=setup(),probes=[['modB',w.reportId],['facA',w.reportId],['lrnA2',w.reportId],['lrnA1',w.reportId],['plain',w.reportId],['owner',w.reportId],['modA','no-such-report'],['modA',42]];
 const results=probes.map(([who,id])=>denied(()=>apply(w.t,u(w,who),{type:'escalate-report',reportId:id,severity:'low',reason:'A fictional reason for probing.'}),404));
 assert.equal(new Set(results.map(r=>r.message)).size,1);
});
test('invalid fields are not checked before scope, so a denied caller learns nothing from validation errors',()=>{
 const w=setup();
 const bad=status(()=>apply(w.t,u(w,'modB'),{type:'escalate-report',reportId:w.reportId,severity:'bogus',reason:'x'}));
 const unknown=status(()=>apply(w.t,u(w,'modB'),{type:'escalate-report',reportId:'nope',severity:'bogus',reason:'x'}));
 assert.deepEqual(bad,unknown);
});
test('a moderator whose cohort scope was removed can no longer escalate or see the escalation',()=>{
 let w=esc(setup());
 w.t=apply(w.t,'owner',{type:'member',userId:w.ids.modA,roles:['moderator'],scopes:[w.B],active:true});
 denied(()=>escalate(w,'modA',{}),404);
 assert.equal(projectTeam(w.t,u(w,'modA')).team.escalations.items.length,0);
});
test('moderators see only escalations they raised; owner sees all; others see none',()=>{
 const w=esc(setup());
 assert.equal(projectTeam(w.t,u(w,'modA')).team.escalations.items.length,1);
 assert.equal(projectTeam(w.t,u(w,'owner')).team.escalations.items.length,1);
 for(const n of ['modB','facA','lrnA2','lrnA1','revA','assessB','plain'])assert.equal(projectTeam(w.t,u(w,n)).team.escalations.items.length,0,n);
});
test('a second moderator of the same cohort does not see another moderator escalation',()=>{
 let w=setup();
 w.t=apply(w.t,'owner',{type:'invite',email:'modA2@x.example.test',roles:['moderator'],scopes:[w.A],tokenHash:'f'.repeat(64)});
 const m2={userId:'modA2',email:'modA2@x.example.test'};w.t=apply(w.t,m2,{type:'accept',tokenHash:'f'.repeat(64)});
 w=esc(w);assert.equal(projectTeam(w.t,m2).team.escalations.items.length,0);
 denied(()=>apply(w.t,m2,{type:'escalation-resolve',escalationId:w.t.escalations[0].id,decision:'dismiss',reason:'A fictional attempted decision.'}),404);
});
test('only an active owner decides; moderator, facilitator and unknown id get the same 404',()=>{
 const w=esc(setup()),c=resolveCmd(w);
 const r=['modA','modB','facA','lrnA2','plain'].map(n=>denied(()=>apply(w.t,u(w,n),c),404));
 r.push(denied(()=>apply(w.t,'owner',{...c,escalationId:'unknown'}),404));
 assert.equal(new Set(r.map(x=>x.message)).size,1);
 const removed=apply(w.t,'owner',{type:'member',userId:'owner',roles:['admin','learner'],scopes:[],active:true});
 assert.equal(removed.escalations[0].status,'open');
});
test('owner resolves with decision and reason; history, notice and moderation are recorded',()=>{
 let w=esc(setup());w.t=apply(w.t,'owner',resolveCmd(w,{hidePost:true}),at(2));
 const e=w.t.escalations[0];assert.equal(e.status,'resolved');assert.equal(e.resolution.decision,'resolve');assert.equal(e.history.length,2);assert.equal(e.history[1].type,'resolved');
 assert.equal(w.t.posts[0].status,'hidden');assert.equal(w.t.moderation.at(-1).actor,'owner');assert.equal(w.t.moderation.at(-1).previousStatus,'visible');
 const mod=projectTeam(w.t,u(w,'modA')).team.escalations.items[0];assert.equal(mod.status,'resolved');assert.equal(mod.history[1].actorName,'Workspace owner');
});
test('owner dismisses; a dismissal cannot hide the post; reasons are bounded',()=>{
 let w=esc(setup());
 denied(()=>apply(w.t,'owner',resolveCmd(w,{decision:'dismiss',hidePost:true})),422);
 denied(()=>apply(w.t,'owner',resolveCmd(w,{reason:'short'})),422);
 denied(()=>apply(w.t,'owner',resolveCmd(w,{decision:'maybe'})),422);
 denied(()=>apply(w.t,'owner',resolveCmd(w,{extra:1})),400);
 w.t=apply(w.t,'owner',resolveCmd(w,{decision:'dismiss'}));assert.equal(w.t.escalations[0].status,'dismissed');assert.equal(w.t.posts[0].status,'visible');
});
test('SLA targets per severity, overdue flag turns on after the target and off after a decision',()=>{
 for(const [sev,h] of Object.entries({low:168,medium:72,high:24,safeguarding:4})){
  const w=setup(),t=escalate(w,'modA',{severity:sev}),e=t.escalations[0];
  assert.equal(ESCALATION_SLA_HOURS[sev],h);assert.equal(e.dueAt,at(h));
  assert.equal(escalationSla(e,at(h)).overdue,false);assert.equal(escalationSla(e,at(h)+'').overdue,false);
  assert.equal(escalationSla(e,at(h+0.01)).overdue,true);
  const proj=projectTeam(t,u(w,'owner'),at(h+2));assert.equal(proj.team.escalations.items[0].overdue,true);assert.equal(proj.team.escalations.counts.overdue,1);assert.equal(proj.team.escalations.items[0].hoursOverdue,2);
  const done=apply(t,'owner',{type:'escalation-resolve',escalationId:e.id,decision:'resolve',reason:'Late but decided fictional matter.'},at(h+2));
  const item=projectTeam(done,u(w,'owner'),at(h+3)).team.escalations.items[0];assert.equal(item.overdue,false);assert.equal(item.withinTarget,false);
 }
});
test('reporter gets a generic outcome notice that reveals no moderator, owner or other content',()=>{
 let w=esc(setup());
 assert.equal(projectTeam(w.t,u(w,'lrnA2')).team.escalations.notices.length,0,'no notice before a decision');
 w.t=apply(w.t,'owner',resolveCmd(w));
 const notice=projectTeam(w.t,u(w,'lrnA2')).team.escalations.notices;assert.equal(notice.length,1);
 assert.match(notice[0].text,/reviewed/);assert.match(notice[0].text,/action was taken/);
 const blob=JSON.stringify(projectTeam(w.t,u(w,'lrnA2')).team.escalations);
 for(const secret of ['modA','owner','Reviewed the fictional matter','Needs the workspace owner','severity','medium','Academy member','lrnA1'])assert.ok(!blob.includes(secret),'leaked '+secret);
 assert.deepEqual(projectTeam(w.t,u(w,'lrnA1')).team.escalations.notices,[]);
 assert.deepEqual(projectTeam(w.t,u(w,'lrnB1')).team.escalations.notices,[]);
 let d=esc(setup());d.t=apply(d.t,'owner',resolveCmd(d,{decision:'dismiss'}));assert.match(projectTeam(d.t,u(d,'lrnA2')).team.escalations.notices[0].text,/no action was needed/);
});
test('safeguarding: documented handling note, no external notification fields, reporter notice is identical, owner reason stays from the moderator',()=>{
 const w=setup();let t=escalate(w,'modA',{severity:'safeguarding',reason:'Fictional safeguarding concern for the owner only.'});
 const proj=projectTeam(t,u(w,'owner')).team.escalations;
 assert.equal(proj.handlingNote,SAFEGUARDING_HANDLING_NOTE);assert.match(proj.handlingNote,/no email, message or report to anyone outside/);assert.match(proj.handlingNote,/emergency or child-protection service/);
 const e=t.escalations[0];t=apply(t,'owner',{type:'escalation-resolve',escalationId:e.id,decision:'resolve',reason:'Private fictional safeguarding decision detail.'},at(1));
 const mod=projectTeam(t,u(w,'modA')).team.escalations.items[0];assert.equal(mod.resolution.reason,null);assert.equal(mod.resolution.decision,'resolve');
 assert.equal(projectTeam(t,u(w,'owner')).team.escalations.items[0].resolution.reason,'Private fictional safeguarding decision detail.');
 const n=projectTeam(t,u(w,'lrnA2')).team.escalations.notices[0];assert.ok(!/safeguard/i.test(JSON.stringify(n)));
 assert.ok(!/(webhook|email|notify|recipient)/i.test(Object.keys(e).join(' ')));
});
test('owner cannot decide an escalation about their own report or post',()=>{
 let w=setup();
 // owner authors a post that another member reports and a moderator escalates
 let t=apply(w.t,'owner',{type:'enroll',programId:w.A?w.t.cohorts[0].programId:'',cohortId:w.A});
 t=apply(t,'owner',{type:'post',cohortId:w.A,title:'An owner authored discussion',body:'A fictional discussion body long enough to pass validation.'});
 const p=t.posts[0];t=apply(t,u(w,'modA'),{type:'moderate',postId:p.id,status:'visible',reason:'Publishing the fictional owner post.'});
 t=apply(t,u(w,'lrnA2'),{type:'report',postId:p.id,reason:'A fictional reason for the owner authored post.'});
 const rep=t.reports.find(r=>r.postId===p.id);t=apply(t,u(w,'modA'),{type:'escalate-report',reportId:rep.id,severity:'low',reason:'A fictional reason for escalation here.'});
 const e=t.escalations.find(x=>x.reportId===rep.id);
 denied(()=>apply(t,'owner',{type:'escalation-resolve',escalationId:e.id,decision:'resolve',reason:'A conflicted fictional decision attempt.'}),403);
});
test('stale and repeated commands: duplicate escalate, repeated resolve, stale expectedHistory leave the record unchanged',()=>{
 let w=esc(setup());
 denied(()=>escalate(w,'modA'),409);
 denied(()=>apply(w.t,'owner',resolveCmd(w,{expectedHistory:0})),409);
 const before=JSON.stringify(w.t);w.t=apply(w.t,'owner',resolveCmd(w,{expectedHistory:1}));
 const decided=JSON.stringify(w.t.escalations[0].resolution);
 denied(()=>apply(w.t,'owner',resolveCmd(w,{decision:'dismiss',reason:'A late contradictory fictional decision.'})),409);
 assert.equal(JSON.stringify(w.t.escalations[0].resolution),decided);
 assert.notEqual(before,JSON.stringify(w.t));
});
test('commands never mutate the supplied team (revision fence works on a copy)',()=>{
 const w=setup(),snap=JSON.stringify(w.t);escalate(w,'modA');assert.equal(JSON.stringify(w.t),snap);
 status(()=>escalate(w,'modB'));assert.equal(JSON.stringify(w.t),snap);
});
test('removed members cannot escalate or decide',()=>{
 let w=esc(setup());w.t=apply(w.t,'owner',{type:'member',userId:w.ids.modA,roles:['moderator'],scopes:[w.A],active:false});
 denied(()=>apply(w.t,u(w,'modA'),{type:'escalate-report',reportId:w.reportId,severity:'low',reason:'A fictional reason after removal.'}),403);
});
test('escalations are workspace-bound: another workspace cannot see or decide them',()=>{
 const w=esc(setup()),o=withReport(workspace('ws-two','owner2'));
 denied(()=>apply(o.t,'owner2',{type:'escalation-resolve',escalationId:w.t.escalations[0].id,decision:'resolve',reason:'A fictional cross workspace attempt.'}),404);
 assert.equal(projectTeam(o.t,{userId:'owner2',email:'o'}).team.escalations.items.length,0);
 denied(()=>projectTeam(o.t,u(w,'owner')),404);denied(()=>apply(o.t,'owner',{type:'escalation-resolve',escalationId:w.t.escalations[0].id,decision:'resolve',reason:'A fictional cross workspace attempt.'}),404);
});
