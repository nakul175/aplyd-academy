import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..'),app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:'.'));
const output=resolve(process.env.ACADEMY_ASSESSMENT_QA_OUTPUT??app+'/.sites-runtime/assessment-qa');mkdirSync(output,{recursive:true});
globalThis.fetch=()=>{throw new Error('Network disabled in assessment tests.');};
const m=await import(pathToFileURL(output+'/model.mjs'));
const {applyCommand,freshWorkspace,programs,RuleError}=m,DAY=86400000,T0='2026-10-05T12:00:00.000Z';
const at=(ms=0)=>new Date(Date.parse(T0)+ms).toISOString();
const staff={userId:'staff-1',name:'Fatima Facilitator',workspaceId:'tw-aaaaaaaaaaaaaaaaaaaa',workspaceName:'Pilot'};
for(const p of programs){
 const prompts=p.practicalAssessment.submissionPrompts,rubric=p.practicalAssessment.rubric,gates=rubric.filter(r=>r.criticalGate).length;
 const evidence=()=>Object.fromEntries(prompts.map(f=>[f.id,'Synthetic checked evidence. Sources are verified and private fields excluded.']));
 const apply=(s,c,now=T0,st)=>applyCommand(s,c,now,st);
 const prepared=()=>{let s=apply(freshWorkspace(),{type:'enroll',programId:p.id});const id=s.enrollments[0].id;for(const l of p.lessons)s=apply(s,{type:'lesson',enrollmentId:id,lessonId:l.id,practice:'I used the fictional packet and checked the source references carefully.',answers:l.quiz.map(q=>q.correctOptionIndex)});return s};
 const submit=(s,now=T0)=>apply(s,{type:'submit',enrollmentId:s.enrollments[0].id,fields:evidence(),confirmed:true},now);
 const review=(s,o={},now=T0)=>({type:'assess',enrollmentId:s.enrollments[0].id,attemptId:s.enrollments[0].attempts.at(-1).id,actor:'assessor-a',scores:o.scores??rubric.map(()=>4),gates:o.gates??Array(gates).fill(true),notes:rubric.map(()=>'Checked submitted evidence against the fictional source packet.'),feedback:'Next time cite the source row for each figure and keep unsupported claims out of the brief.',...(o.method!==undefined?{method:o.method}:{})});
 const failed=(s,now=T0)=>apply(s,review(s,{scores:rubric.map(()=>1),gates:Array(gates).fill(false)}),now);
 const decisionOf=(s)=>s.enrollments[0].attempts.at(-1).decision;
 const label=n=>`${p.id}: ${n}`;

 test(label('remediation maps every failed criterion and every failed critical gate'),()=>{
  let s=failed(submit(prepared()));const e=s.enrollments[0],a=e.attempts[0],d=a.decision;
  const plan=m.buildRemediation(p,e,a,d);assert.equal(plan.applies,true);
  assert.deepEqual(plan.items.map(i=>i.criterionId).sort(),rubric.map(r=>r.id).sort());
  for(const it of plan.items){const r=rubric.find(x=>x.id===it.criterionId);assert.equal(it.kind,r.criticalGate?'gate':'criterion');assert.equal(it.gate,r.criticalGate??null);
   assert.ok(it.routes.some(x=>x.kind==='reviewer-next-step'),'reviewer note route');assert.equal(it.reviewerNote,d.notes[rubric.indexOf(r)]);
   assert.ok(it.routes.some(x=>x.kind==='reread-lesson'),'a lesson route exists for '+it.criterionId);
   for(const x of it.routes.filter(x=>x.lessonId)){assert.ok(p.lessons.some(l=>l.id===x.lessonId));assert.equal(x.hash,`#learn/${p.id}/learn/${x.lessonId}`);if(x.kind==='redo-step')assert.equal(x.detail,p.lessons.find(l=>l.id===x.lessonId).steps[x.stepIndex])}}
  // only the gate fails: only that criterion appears when others score 3+
  const scores=rubric.map(()=>3),gs=Array(gates).fill(true);gs[0]=false;
  const t0=submit(prepared());let t=apply(t0,review(t0,{scores,gates:gs}));
  const q=m.buildRemediation(p,t.enrollments[0],t.enrollments[0].attempts[0],t.enrollments[0].attempts[0].decision);
  assert.deepEqual(q.items.map(i=>i.criterionId),[rubric.filter(r=>r.criticalGate)[0].id]);assert.equal(q.items[0].kind,'gate');
 });
 test(label('weak non-gate criterion alone is mapped; strong criteria are not'),()=>{
  const sc=rubric.map(()=>4);sc[0]=0;let t=prepared();t=submit(t);const dd=review(t,{scores:sc});t=apply(t,dd);const e=t.enrollments[0];
  // 40-weight criterion at 0 => score 60 < 70 => fail
  assert.equal(e.attempts[0].decision.passed,false);
  const q=m.buildRemediation(p,e,e.attempts[0],e.attempts[0].decision);assert.deepEqual(q.items.map(i=>i.criterionId),[rubric[0].id]);assert.equal(q.items[0].score,0);
 });
 test(label('no remediation for a pass, a pending attempt, or a passing appeal'),()=>{
  let s=submit(prepared());const pending=m.buildRemediation(p,s.enrollments[0],s.enrollments[0].attempts[0],s.enrollments[0].attempts[0].decision);assert.equal(pending.applies,false);assert.equal(pending.reason,'no-decision');
  s=apply(s,review(s,{scores:rubric.map(()=>3)}));const e=s.enrollments[0],pass=m.buildRemediation(p,e,e.attempts[0],e.attempts[0].decision);assert.equal(pass.applies,false);assert.equal(pass.reason,'passed');assert.deepEqual(pass.items,[]);
  // failed then appeal resolved as a pass: controlling decision is the resolution
  let t=failed(submit(prepared()));t=apply(t,{type:'appeal',enrollmentId:t.enrollments[0].id,attemptId:t.enrollments[0].attempts[0].id,reason:'The evidence references were not fully considered by the assessor.'});
  t=apply(t,{...review(t),type:'resolve',appealId:t.enrollments[0].appeals[0].id,actor:'reviewer-b'});const te=t.enrollments[0],res=te.appeals[0].resolution;
  assert.equal(m.buildRemediation(p,te,te.attempts[0],res).applies,false);assert.equal(m.buildRemediation(p,te,te.attempts[0],te.attempts[0].decision).retry.blockedBy,'record-active');
 });
 test(label('retry rule: three attempts exactly as before; remediation reflects it'),()=>{
  let s=prepared();
  for(let n=1;n<=3;n++){s=submit(s);s=failed(s);const e=s.enrollments[0],plan=m.buildRemediation(p,e,e.attempts.at(-1),decisionOf(s));assert.equal(plan.retry.attemptsUsed,n);assert.equal(plan.retry.attemptsLeft,3-n);
   if(n<3){assert.equal(plan.retry.canRetry,true);assert.ok(plan.closing.some(c=>c.kind==='resubmit'&&c.hash===`#learn/${p.id}/assessment`&&c.label.includes(`attempt ${n+1} of 3`)))}
   else{assert.equal(plan.retry.canRetry,false);assert.equal(plan.retry.blockedBy,'limit');assert.ok(plan.closing.every(c=>c.kind==='support'));assert.ok(plan.closing.every(c=>c.kind!=='resubmit'))}}
  assert.throws(()=>submit(s),e=>e instanceof RuleError&&e.status===409&&e.message==='The private pilot allows three attempts. Ask for support before continuing.');
  assert.equal(m.resumeLearning(s.enrollments[0],p).tab,'feedback');
 });
 test(label('rules-as-data equal engine behaviour: attempts 1-4 and appeal day 13/14/15'),()=>{
  const rules=m.assessmentRulesFor(p);assert.equal(rules.maxAttempts,3);assert.equal(rules.appealWindowDays,14);
  let s=prepared(),accepted=0;
  for(let n=1;n<=4;n++){let threw=false;try{s=submit(s)}catch(e){threw=e instanceof RuleError&&e.status===409}
   assert.equal(!threw,n<=rules.maxAttempts,'attempt '+n);if(threw)break;accepted++;s=failed(s)}
  assert.equal(accepted,rules.maxAttempts);
  for(const [days,extra,ok] of [[13,0,true],[14,0,true],[14,1,false],[15,0,false]]){
   let t=failed(submit(prepared()));const e=t.enrollments[0],when=at(days*DAY+extra);const call=()=>apply(t,{type:'appeal',enrollmentId:e.id,attemptId:e.attempts[0].id,reason:'The evidence references were not fully considered by the assessor.'},when);
   if(ok)call();else assert.throws(call,x=>x instanceof RuleError&&x.status===409&&x.message==='The 14-day appeal window has ended.');
   assert.equal(!m.appealWindowClosed(e.attempts[0].decision.decidedAt,when,rules),ok,`day ${days}+${extra}ms`);
  }
 });
 test(label('accommodation lifecycle: request, decide, immutable history, never lowers the rubric'),()=>{
  let s=prepared();const eid=s.enrollments[0].id;
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'not-a-type'}),RuleError);
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'other'}),RuleError);
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'extra-time',detail:'x'.repeat(601)}),RuleError);
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'extra-time',payload:1}),e=>e.status===400);
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'extra-time'},T0,staff),e=>e.status===403);
  s=apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'extra-time',detail:'I need longer to read the packet.'});
  const req=s.enrollments[0].accommodations[0];assert.equal(req.status,'requested');assert.equal(m.accommodationsForReview(s.enrollments[0]).length,0);
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'extra-time'}),e=>e.status===409,'duplicate open type');
  const decide=(o={})=>({type:'accommodation-decide',enrollmentId:eid,requestId:req.id,outcome:'approved',reason:'Reasonable and documented need for more reading time.',...o});
  assert.throws(()=>apply(s,decide()),e=>e.status===403,'non-staff without sample role');
  assert.throws(()=>apply(s,decide({actor:'learner'})),e=>e.status===403);
  assert.throws(()=>apply(s,decide(),T0,{...staff,learnerId:staff.userId}),e=>e.status===403,'requester cannot decide');
  assert.throws(()=>apply(s,decide({reason:'short'}),T0,staff),RuleError);
  assert.throws(()=>apply(s,decide({outcome:'maybe'}),T0,staff),RuleError);
  assert.throws(()=>apply(s,decide({requestId:'missing'}),T0,staff),e=>e.status===404);
  assert.throws(()=>apply(s,decide({extra:1}),T0,staff),e=>e.status===400);
  const before=JSON.stringify(s);
  const d=apply(s,decide(),at(1000),{...staff,learnerId:'learner-9'});assert.equal(JSON.stringify(s),before,'input state untouched');
  const hist=structuredClone(d.enrollments[0].accommodationHistory);assert.deepEqual(hist.map(h=>h.event),['requested','approved']);assert.equal(hist[1].actor,staff.userId);assert.equal(hist[1].actorName,staff.name);
  assert.equal(m.accommodationsForReview(d.enrollments[0])[0].type,'extra-time');
  assert.throws(()=>apply(d,decide({outcome:'declined'}),at(2000),staff),e=>e.status===409,'decision cannot be changed');
  // history is append-only across later commands
  let later=submit(d,at(3000));later=apply(later,review(later),at(4000));assert.deepEqual(later.enrollments[0].accommodationHistory.slice(0,2),hist);
  // a declined request is retained and does not attach
  let x=apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'human-scribe'});const r2=x.enrollments[0].accommodations[1];
  x=apply(x,{...decide({requestId:r2.id,outcome:'declined',reason:'Use the read-back route instead for this task.'})},at(1000),staff);
  assert.equal(x.enrollments[0].accommodations[1].status,'declined');assert.equal(m.accommodationsForReview(x.enrollments[0]).length,0);assert.equal(x.enrollments[0].accommodationHistory.length,3);
 });
 test(label('accommodation request limits and stale states'),()=>{
  let s=prepared();const eid=s.enrollments[0].id;
  for(const t of ['extra-time','alternative-format','assistive-technology'])s=apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:t});
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:eid,accommodationType:'human-scribe'}),e=>e.status===409,'max pending');
  assert.throws(()=>apply(s,{type:'accommodation-request',enrollmentId:'gone',accommodationType:'extra-time'}),e=>e.status===404);
  const w=apply(s,{type:'withdraw',enrollmentId:eid});assert.throws(()=>apply(w,{type:'accommodation-decide',enrollmentId:eid,requestId:s.enrollments[0].accommodations[0].id,outcome:'approved',reason:'Reasonable and documented need.'},T0,staff),e=>e.status===409);
  assert.throws(()=>apply(w,{type:'accommodation-request',enrollmentId:eid,accommodationType:'other',detail:'A descriptive request here.'}),e=>e.status===409);
 });
 test(label('approved accommodation does not change score, pass outcome, or gates; it is stamped for the record'),()=>{
  for(const scores of [rubric.map(()=>3),rubric.map(()=>2),rubric.map(()=>4)]){
   let a=submit(prepared()),b=submit(prepared());const eid=b.enrollments[0].id;
   b=apply(b,{type:'accommodation-request',enrollmentId:eid,accommodationType:'alternative-format'});b=apply(b,{type:'accommodation-decide',enrollmentId:eid,requestId:b.enrollments[0].accommodations[0].id,outcome:'approved',reason:'Reasonable and documented need.',actor:'assessor-a'});
   a=apply(a,review(a,{scores}));b=apply(b,review(b,{scores}));const da=decisionOf(a),db=decisionOf(b);
   assert.equal(db.score,da.score);assert.equal(db.passed,da.passed);assert.deepEqual(db.scores,da.scores);assert.deepEqual(db.gates,da.gates);
   assert.deepEqual(db.accommodationsConsidered.map(x=>x.type),['alternative-format']);assert.equal(da.accommodationsConsidered,undefined);
   assert.deepEqual(m.scoreDecision(p,scores,Array(gates).fill(true)),{score:da.score,passed:da.passed});
  }
 });
 test(label('assessment methods: practical default; observed and oral recorded; quiz and unknown rejected; pass logic unchanged'),()=>{
  const res={};
  for(const method of [undefined,'practical','observed','oral']){const s=submit(prepared());const t=apply(s,review(s,{method,scores:rubric.map(()=>3)}));const d=decisionOf(t);res[method??'default']=[d.score,d.passed];assert.equal(d.method,method??'practical');assert.equal(t.enrollments[0].record.status,'active')}
  assert.deepEqual(new Set(Object.values(res).map(String)).size,1);
  for(const bad of ['quiz','written','','toString',5]){const s=submit(prepared());assert.throws(()=>apply(s,review(s,{method:bad})),RuleError)}
  // a method cannot weaken the rubric: still needs all notes/feedback
  const s=submit(prepared());assert.throws(()=>apply(s,{...review(s,{method:'oral'}),feedback:'short'}),RuleError);
  const t=failed(submit(prepared()));assert.equal(decisionOf(t).passed,false);
 });
}
test('offering policy can restrict methods; default publishes human methods; quiz is automatic only',()=>{
 const restricted={practicalAssessment:{allowedMethods:['practical']}};
 assert.deepEqual(m.resolveAssessmentMethod(restricted,'oral'),{ok:false,message:'This offering does not publish that assessment method.'});
 assert.deepEqual(m.resolveAssessmentMethod(restricted,undefined),{ok:true,method:'practical'});
 assert.deepEqual(m.resolveAssessmentMethod({practicalAssessment:{allowedMethods:['observed','junk']}},'observed'),{ok:true,method:'observed'});
 assert.deepEqual(m.resolveAssessmentMethod({practicalAssessment:{allowedMethods:['junk']}},'observed').ok,false,'invalid declaration falls back to practical only');
 assert.equal(m.resolveAssessmentMethod(programs[0],'oral').ok,true);
 const rules=m.assessmentRulesFor(programs[0]);assert.equal(rules.methods.find(x=>x.id==='quiz').scoring,'auto');assert.ok(rules.methods.every(x=>x.claim.length>20));
 const text=m.describeAssessmentRules(rules).flatMap(s=>s.lines).join('\n');for(const w of ['Quiz','Practical evidence','Observed task','Oral explanation','same rubric'])assert.ok(text.includes(w),w);
});
test('published rules text is generated from the data, not typed beside it',()=>{
 const rules={...m.assessmentRulesFor(),maxAttempts:5,appealWindowDays:7},text=m.describeAssessmentRules(rules).flatMap(s=>s.lines).join('\n');
 assert.ok(text.includes('5 attempts')&&text.includes('within 7 days'));assert.ok(!text.includes('3 attempts'));
 const own=m.describeAssessmentRules(m.assessmentRulesFor()).find(s=>s.id==='accommodations').lines.join(' ');assert.ok(/never lowers the rubric/.test(own));
});
test('accommodation decision authority is facilitator/assessor, scoped, active, and never the requester',()=>{
 const ok={userId:'u1',active:true,roles:['facilitator'],scopes:['c1']};
 assert.equal(m.canDecideAccommodation(ok,'c1','learner'),true);assert.equal(m.canDecideAccommodation({...ok,roles:['assessor']},'c1','learner'),true);
 assert.equal(m.canDecideAccommodation(ok,'c1','u1'),false);assert.equal(m.canDecideAccommodation(ok,'c2','learner'),false);assert.equal(m.canDecideAccommodation({...ok,active:false},'c1','learner'),false);
 assert.equal(m.canDecideAccommodation({...ok,roles:['learner','moderator']},'c1','learner'),false);assert.equal(m.canDecideAccommodation(undefined,'c1','learner'),false);
});
test('no network is reachable from the assessment model',()=>{assert.throws(()=>fetch('https://example.invalid'),/Network disabled/)});
