import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
const app=path.resolve('.'),out=path.resolve('.sites-runtime/inclusive-root/runtime.mjs');mkdirSync(path.dirname(out),{recursive:true});
const sourceFiles=['lib/academy-inclusive-learning.ts','lib/academy-engine.ts','lib/academy-teams.ts','lib/academy-curriculum.ts','lib/curriculum.json','lib/curriculum-versions/0.1-review-draft.json'];
const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const archiveHash='9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4';
await build({stdin:{contents:[`export * from ${JSON.stringify(path.join(app,'lib/academy-inclusive-learning.ts'))};`,`export {programs,currentRef,curriculumRegistry,createCurriculumRegistry} from ${JSON.stringify(path.join(app,'lib/academy-curriculum.ts'))};`,`export {applyCommand,freshWorkspace} from ${JSON.stringify(path.join(app,'lib/academy-engine.ts'))};`,`export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(path.join(app,'lib/academy-teams.ts'))};`].join('\n'),resolveDir:app,sourcefile:'actual-root-inclusive.ts'},outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
writeFileSync(path.join(path.dirname(out),'source-manifest.json'),JSON.stringify({app,archiveHash,sources:sourceHashes,scope:'Actual integrated root modules; pure tests, not UI/hosted proof.'},null,2));
const {canonicalLearningLanguage,freshAccessPreferences,readAccessPreferences,applyAccessPreferences,languageAvailability,readAloudPlan,confirmHumanCapture,assertConfirmedCapture,InclusiveLearningError,programs,currentRef,curriculumRegistry,createCurriculumRegistry,applyCommand,freshWorkspace,createTeam,applyTeamCommand,projectTeam}=await import(pathToFileURL(out));
const context={registry:curriculumRegistry,allowedScopes:['global']};
const NOW='2026-10-05T19:30:00.000Z';
const pref=(extra={})=>readAccessPreferences({...freshAccessPreferences(),...extra});
const enrolled=(i=1)=>applyCommand(freshWorkspace(),{type:'enroll',programId:programs[i].id},NOW);
const own=s=>s.enrollments[0];
const snapshot=i=>curriculumRegistry.resolve(currentRef(programs[i].id));
const fields=p=>Object.fromEntries(p.practicalAssessment.submissionPrompts.map(q=>[q.id,'My fictional response preserves the source reference and explains my checks and remaining uncertainty.']));
const policy=e=>({contentRef:e.contentRef,enabled:true,methods:['human-reading','human-transcription'],responseLanguages:['en']});
const declaration=(extra={})=>({method:'human-transcription',responseLanguage:'en',learnerConsent:true,learnerReadBackConfirmed:true,declaredNoAnswerCoaching:true,...extra});
const fail=(fn,status)=>assert.throws(fn,e=>e instanceof InclusiveLearningError&&e.status===status);

test('preference defaults are detached and imply no consent, translation or helper access',()=>{
 const p=readAccessPreferences(undefined);assert.equal(p.preferredLanguage,'en');assert.equal(p.assistancePreference,'none');assert.equal(p.readAloudMode,'off');assert.ok(Object.isFrozen(p));assert.notEqual(p,readAccessPreferences(undefined));assert.deepEqual(Object.keys(p).sort(),['assistancePreference','preferredLanguage','readAloudMode','schemaVersion']);
});
test('canonical ordinary language tags preserve script and region',()=>{
 assert.equal(canonicalLearningLanguage('HI-in'),'hi-IN');assert.equal(canonicalLearningLanguage('zh-hans-CN'),'zh-Hans-CN');assert.equal(canonicalLearningLanguage('en'),'en');
});
test('malformed, oversized, private-extension and control language inputs reject',()=>{
 for(const value of [null,{},['en'],'',' en ','en_x','en-x-private','en-US-u-ca-hebrew','en\n','a'.repeat(40),'<script>'])assert.throws(()=>canonicalLearningLanguage(value),InclusiveLearningError);
});
test('saved preference shape rejects legacy booleans and authority claims without fallback',()=>{
 for(const value of [null,true,{}, {...freshAccessPreferences(),schemaVersion:2},{...freshAccessPreferences(),reviewedTranslation:true},{...freshAccessPreferences(),readAloudMode:true},{...freshAccessPreferences(),assistancePreference:'approved'}])assert.throws(()=>readAccessPreferences(value),InclusiveLearningError);
});
test('own preference model leaves learning, plans, existing choices and records untouched',()=>{
 const s=enrolled(),before=JSON.stringify(s);s.ecosystemGrants=[];
 const next=applyAccessPreferences(s,{type:'learning-access-preferences',preferredLanguage:'hi',readAloudMode:'ask',assistancePreference:'capture-response'});
 assert.equal(next.learningAccess.preferredLanguage,'hi');assert.deepEqual(next.enrollments,s.enrollments);assert.deepEqual(next.learningPlan,s.learningPlan);assert.deepEqual(next.ecosystemGrants,s.ecosystemGrants);assert.equal(JSON.stringify(s.enrollments),JSON.stringify(JSON.parse(before).enrollments));assert.equal(s.learningAccess,undefined);
});
test('preference command cannot address another learner/helper or forge approval',()=>{
 const command={type:'learning-access-preferences',preferredLanguage:'en',readAloudMode:'off',assistancePreference:'none'};
 for(const extra of [{learnerId:'other'},{actor:'admin'},{helperId:'staff'},{approval:true}])fail(()=>applyAccessPreferences(freshWorkspace(),{...command,...extra}),400);
});
for(let i=0;i<3;i++)test('actual '+programs[i].id+' pin is English and not altered by Hindi preference',()=>{
 const s=enrolled(i),e=own(s),before=JSON.stringify(e),a=languageAvailability(e,context,pref({preferredLanguage:'hi'}));
 assert.equal(a.status,'requested-language-unavailable');assert.equal(a.contentLanguage,'en');assert.equal(a.requestedLanguage,'hi');assert.deepEqual(a.contentRef,e.contentRef);assert.equal(JSON.stringify(e),before);assert.equal(a.canSubmit,undefined);
});
test('actual English preference matches pin without accrediting its draft classification',()=>{
 const a=languageAvailability(own(enrolled()),context,pref());assert.equal(a.status,'matches-pinned-content');assert.match(a.message,/classification/);assert.match(snapshot(1).classification,/draft/i);
});
test('unknown explicit version fails closed and preserves original enrollment',()=>{
 const e={...own(enrolled()),version:'unknown-v',contentRef:{...currentRef(programs[1].id),versionId:'unknown-v'}},before=JSON.stringify(e);
 const a=languageAvailability(e,context,pref({preferredLanguage:'hi'}));assert.equal(a.status,'pinned-content-unavailable');assert.equal(a.contentLanguage,null);assert.equal(a.contentRef,null);assert.equal(JSON.stringify(e),before);
});
test('missing legacy version and mixed explicit version/reference reject without English/latest default',()=>{
 for(const e of [{programId:programs[1].id},{...own(enrolled()),version:'other'}])assert.equal(languageAvailability(e,context,pref()).status,'pinned-content-unavailable');
});
test('a new catalog version cannot change historical language projection',()=>{
 const old=snapshot(1),future={...structuredClone(old),ref:{...old.ref,versionId:'future-hi'},language:'hi'};
 const registry=createCurriculumRegistry([old,future]),e=own(enrolled());
 assert.equal(languageAvailability(e,{registry,allowedScopes:['global']},pref({preferredLanguage:'hi'})).contentLanguage,'en');
});
test('private scope is allowed only by trusted context, never by requested language/reference',()=>{
 const a='tw-'+ 'a'.repeat(24),b='tw-'+ 'b'.repeat(24),base=snapshot(1),entry={...structuredClone(base),ref:{scope:b,programId:base.program.id,versionId:'private-hi'},language:'hi'};
 const registry=createCurriculumRegistry([entry]),e={programId:entry.ref.programId,version:entry.ref.versionId,contentRef:entry.ref};
 assert.equal(languageAvailability(e,{registry,allowedScopes:['global',a]},pref({preferredLanguage:'hi'})).status,'pinned-content-unavailable');
 assert.equal(languageAvailability(e,{registry,allowedScopes:['global',b]},pref({preferredLanguage:'hi'})).status,'matches-pinned-content');
});
test('read aloud reads actual English pin even when Hindi is requested',()=>{
 const available=languageAvailability(own(enrolled()),context,pref({preferredLanguage:'hi'}));
 const plan=readAloudPlan(available,{supported:true,voicesLoaded:true,voices:[{language:'hi-IN',localService:true},{language:'en-IN',localService:true}]});assert.equal(plan.status,'ready');assert.equal(plan.utteranceLanguage,'en-IN');
});
test('unsupported speech, pending voices and no matching voice have truthful distinct states',()=>{
 const a=languageAvailability(own(enrolled()),context,pref());
 assert.equal(readAloudPlan(a,{supported:false,voicesLoaded:false,voices:[]}).status,'unsupported');
 assert.equal(readAloudPlan(a,{supported:true,voicesLoaded:false,voices:[]}).status,'voices-loading');
 assert.equal(readAloudPlan(a,{supported:true,voicesLoaded:true,voices:[{language:'hi-IN',localService:true}]}).status,'voice-unavailable');
});
test('unknown pin and malformed voice tags never enable read aloud',()=>{
 const unavailable=languageAvailability({programId:programs[1].id,version:'unknown'},context,pref());
 assert.equal(readAloudPlan(unavailable,{supported:true,voicesLoaded:true,voices:[{language:'en-IN',localService:true}]}).status,'content-unavailable');
 const a=languageAvailability(own(enrolled()),context,pref());assert.equal(readAloudPlan(a,{supported:true,voicesLoaded:true,voices:[{language:'bad_tag',localService:true},null]}).status,'voice-unavailable');
});
test('human capture needs explicit consent, read-back and no-answer-coaching declarations',()=>{
 const e=own(enrolled()),f=fields(programs[1]);
 for(const key of ['learnerConsent','learnerReadBackConfirmed','declaredNoAnswerCoaching'])fail(()=>confirmHumanCapture(e,context,f,declaration({[key]:false}),policy(e)),422);
 for(const extra of [{approved:true},{helperId:'other'},{audioUrl:'file:///recording'}])fail(()=>confirmHumanCapture(e,context,f,{...declaration(),...extra},policy(e)),400);
});
test('preference alone never enables policy, method or response-language assessment',()=>{
 const e=own(enrolled()),f=fields(programs[1]);
 fail(()=>confirmHumanCapture(e,context,f,declaration(),{...policy(e),enabled:false}),409);
 fail(()=>confirmHumanCapture(e,context,f,declaration(),{...policy(e),methods:['human-reading']}),409);
 fail(()=>confirmHumanCapture(e,context,f,declaration({responseLanguage:'hi'}),policy(e)),409);
});
test('trusted assisted policy must belong to exact immutable offering pin',()=>{
 const e=own(enrolled()),f=fields(programs[1]);
 fail(()=>confirmHumanCapture(e,context,f,declaration(),{...policy(e),contentRef:{...e.contentRef,versionId:'future'}}),409);
});
test('capture allows only exact prompts and current evidence-length requirements',()=>{
 const e=own(enrolled()),f=fields(programs[1]),key=Object.keys(f)[0];
 fail(()=>confirmHumanCapture(e,context,{...f,privateDiagnosis:'do not collect'},declaration(),policy(e)),400);
 fail(()=>confirmHumanCapture(e,context,{...f,[key]:'short'},declaration(),policy(e)),422);
 const missing={...f};delete missing[key];fail(()=>confirmHumanCapture(e,context,missing,declaration(),policy(e)),400);
});
test('confirmed copy is immutable; later editing requires another learner confirmation',()=>{
 const e=own(enrolled()),f=fields(programs[1]),proof=confirmHumanCapture(e,context,f,declaration(),policy(e));
 assert.ok(Object.isFrozen(proof.fields));assertConfirmedCapture(proof,e,context,f,policy(e));const key=Object.keys(f)[0];
 fail(()=>assertConfirmedCapture(proof,e,context,{...f,[key]:f[key]+' An edited conclusion.'},policy(e)),409);
});
test('capture confirmation cannot follow a different published pin or unavailable version',()=>{
 const e=own(enrolled()),f=fields(programs[1]),proof=confirmHumanCapture(e,context,f,declaration(),policy(e));
 fail(()=>assertConfirmedCapture(proof,{...e,version:'unknown',contentRef:{...e.contentRef,versionId:'unknown'}},context,f,policy(e)),409);
});
test('actual root submit keeps sequential progression and only legacy assistance self-declaration',()=>{
 let s=enrolled(),e=own(s),f=fields(programs[1]),proof=confirmHumanCapture(e,context,f,declaration(),policy(e));
 assert.throws(()=>applyCommand(s,{type:'submit',enrollmentId:e.id,fields:proof.fields,confirmed:true,assisted:true},NOW));
 for(const l of programs[1].lessons)s=applyCommand(s,{type:'lesson',enrollmentId:e.id,lessonId:l.id,practice:'I checked the fictional source references and corrected unsupported statements with my own reasoning.',answers:l.quiz.map(q=>q.correctOptionIndex)},NOW);
 e=own(s);assertConfirmedCapture(proof,e,context,f,policy(e));s=applyCommand(s,{type:'submit',enrollmentId:e.id,fields:proof.fields,confirmed:true,assisted:true},NOW);
 assert.equal(own(s).attempts.length,1);assert.equal(own(s).attempts[0].assisted,true);assert.deepEqual(own(s).attempts[0].fields,f);assert.equal(own(s).record,null);
});
test('actual root withdrawal remains an action fence after in-memory confirmation',()=>{
 let s=enrolled(),e=own(s),f=fields(programs[1]),proof=confirmHumanCapture(e,context,f,declaration(),policy(e));
 s=applyCommand(s,{type:'withdraw',enrollmentId:e.id},NOW);assertConfirmedCapture(proof,own(s),context,f,policy(e));
 assert.throws(()=>applyCommand(s,{type:'submit',enrollmentId:e.id,fields:proof.fields,confirmed:true,assisted:true},NOW));
});
test('actual source archive/current JSON remain byte-identical to preserved 0.1 hash',()=>{
 const manifest=JSON.parse(readFileSync(path.join(path.dirname(out),'source-manifest.json'),'utf8'));
 for(const file of ['lib/curriculum-versions/0.1-review-draft.json','lib/curriculum.json'])assert.equal(createHash('sha256').update(readFileSync(manifest.app+'/'+file)).digest('hex'),manifest.archiveHash);
});

test('remote or unknown-locality browser voices do not satisfy matching local reading',()=>{
 const a=languageAvailability(own(enrolled()),context,pref());
 for(const voice of [{language:'en-IN',localService:false},{language:'en-IN'}])assert.equal(readAloudPlan(a,{supported:true,voicesLoaded:true,voices:[voice]}).status,'voice-unavailable');
});

test('current offering policy may close or change after capture without granting lasting authority',()=>{
 const e=own(enrolled()),f=fields(programs[1]),proof=confirmHumanCapture(e,context,f,declaration(),policy(e));
 for(const change of [{enabled:false},{responseLanguages:['hi']},{methods:['human-reading']}])fail(()=>assertConfirmedCapture(proof,e,context,f,{...policy(e),...change}),409);
});
test('actual own preference command is strict, separate from profile and enrollment authority',()=>{
 const s=enrolled(),before=JSON.stringify(s),command={type:'learning-access-preferences',preferredLanguage:'hi',readAloudMode:'ask',assistancePreference:'capture-response'},next=applyCommand(s,command,NOW);
 assert.equal(next.learningAccess.preferredLanguage,'hi');assert.deepEqual(next.enrollments,s.enrollments);assert.deepEqual(next.profile,s.profile);assert.equal(JSON.stringify(s),before);
 for(const extra of [{learnerId:'another'},{actor:'assessor-a'},{helperId:'trusted'},{approved:true}])assert.throws(()=>applyCommand(s,{...command,...extra},NOW));
});
test('shared preferences stay learner-owned and never become staff summaries or directory choices',()=>{
 const owner={userId:'owner',email:'owner@academy.test',fullName:'Synthetic owner'},learner={userId:'learner',email:'learner@academy.test',fullName:'Synthetic learner'};
 let t=createTeam(owner,{name:'Private preference test',purpose:'Synthetic own preferences and projection isolation.',context:'msme'},'tw-'+crypto.randomUUID(),NOW);
 t.members.push({userId:learner.userId,email:learner.email,name:learner.fullName,roles:['learner'],scopes:[],active:true,joinedAt:NOW});
 t=applyTeamCommand(t,learner,{type:'learning-access-preferences',preferredLanguage:'hi',readAloudMode:'ask',assistancePreference:'capture-response'},NOW);
 const own=projectTeam(t,learner),admin=projectTeam(t,owner);assert.equal(own.state.learningAccess.preferredLanguage,'hi');assert.equal(admin.state.learningAccess,undefined);assert.equal(JSON.stringify(admin).includes('capture-response'),false);assert.equal(own.team.network.myProfile,null);
 t.members.find(m=>m.userId===learner.userId).active=false;assert.equal(projectTeam(t,learner).state.learningAccess.preferredLanguage,'hi');assert.throws(()=>applyTeamCommand(t,learner,{type:'learning-access-preferences',preferredLanguage:'en',readAloudMode:'off',assistancePreference:'none'},NOW));
});
test('actual submission stores bounded same-language learner declarations on its immutable attempt only',()=>{
 let s=enrolled();const e=own(s),p=programs[1],f=fields(p);
 for(const l of p.lessons)s=applyCommand(s,{type:'lesson',enrollmentId:e.id,lessonId:l.id,practice:'I checked fictional references and kept my own reasoning and remaining uncertainty.',answers:l.quiz.map(q=>q.correctOptionIndex)},NOW);
 const next=applyCommand(s,{type:'submit',enrollmentId:e.id,fields:f,confirmed:true,assisted:true,assistance:declaration()},NOW),attempt=own(next).attempts[0];
 assert.equal(attempt.assistance.mode,'learner-declared read-back');assert.deepEqual(attempt.assistance.contentRef,e.contentRef);assert.equal(attempt.assistance.responseLanguage,'en');assert.equal(attempt.assistance.confirmedAt,NOW);assert.equal(attempt.assistance.helperId,undefined);assert.equal(own(next).record,null);assert.equal(own(s).attempts.length,0);
 for(const change of [{responseLanguage:'hi'},{learnerConsent:false},{learnerReadBackConfirmed:false},{declaredNoAnswerCoaching:false},{helperId:'staff'},{actor:'admin'}])assert.throws(()=>applyCommand(s,{type:'submit',enrollmentId:e.id,fields:f,confirmed:true,assisted:true,assistance:declaration(change)},NOW));
 assert.throws(()=>applyCommand(s,{type:'submit',enrollmentId:e.id,fields:f,confirmed:true,assisted:false,assistance:declaration()},NOW));
});
