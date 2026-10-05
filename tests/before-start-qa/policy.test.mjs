import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {app,output,modelUrl} from './qa-paths.mjs';
const {deriveBeforeStartSummary:derive,scoreDecision,validateDocument,applyWorkspaceContentCommand}=await import(modelUrl);
const seed=JSON.parse(await readFile(app+'/lib/curriculum-versions/0.1-review-draft.json','utf8'));
const authoring=await readFile(app+'/lib/academy-authoring.ts','utf8');
const literal=authoring.match(/policy:(\{minimumWeightedScore:[^}]+\})/)?.[1];
assert.ok(literal,'Use the actual explicit private publication policy, never a fabricated compatibility policy');
const policy=JSON.parse(literal.replace(/([{,])([A-Za-z]\w*):/g,'$1"$2":').replace(/'([^']*)'/g,'"$1"'));
const rule='At least 70 out of 100, and every critical safety check must pass. A failed safety check cannot be averaged away.';
const workspace='tw-'+ 'a'.repeat(24);
const host={id:workspace,members:[{userId:'owner',name:'Fictional owner',active:true,roles:['admin']}]};
const now='2026-10-06T00:00:00.000Z';
const copied=[];
for(const program of seed.pathways){
 const result=await applyWorkspaceContentCommand(host,{userId:'owner'},{type:'content-copy',sourceRef:{scope:'global',programId:program.id,versionId:seed.contentVersion}},now);
 copied.push(result.content.drafts[0].document);
}
const snapshot=(index=0)=>({ref:{scope:workspace,programId:copied[index].id,versionId:'v-approved-old'},program:structuredClone(copied[index]),policy:structuredClone(policy)});
const result=s=>derive({snapshot:s,globalSeed:seed});
let groups=0;const check=(name,fn)=>test(name,()=>{fn();groups++;});
check('every archived global pathway retains its own prerequisites and exact policy wording',()=>{
 for(const program of seed.pathways){const actual=derive({snapshot:{ref:{scope:'global',programId:program.id,versionId:seed.contentVersion},program},globalSeed:seed});assert.deepEqual(actual.prerequisites,program.prerequisites);assert.equal(actual.passRule,seed.assessmentPolicy.passingRule);}
});
check('current authoring publication constants agree with actual server scoring',()=>{
 assert.deepEqual([policy.minimumWeightedScore,policy.scoreMaximum,policy.criticalGates],[70,4,'all']);
 for(let i=0;i<copied.length;i++){const s=snapshot(i);assert.equal(result(s).passRule,rule);assert.equal(s.program.practicalAssessment.rubric.reduce((n,r)=>n+r.weight,0),100);assert.equal(validateDocument(s.program,s.program).some(i=>i.path.includes('rubric')),false);}
});
check('actual scoring refuses scores above four and cannot average a critical failure away',()=>{
 const p=copied[0],gates=p.practicalAssessment.rubric.filter(r=>r.criticalGate).map(()=>true);assert.ok(gates.length);
 assert.equal(scoreDecision(p,p.practicalAssessment.rubric.map(()=>3),gates).passed,true);
 gates[0]=false;assert.equal(scoreDecision(p,p.practicalAssessment.rubric.map(()=>4),gates).passed,false);
 assert.throws(()=>scoreDecision(p,p.practicalAssessment.rubric.map(()=>5),gates),/0 to 4/);
});
check('actual scoreDecision uses seventy even if an unsupported saved private policy says seventy-five',()=>{
 const s=snapshot();s.policy.minimumWeightedScore=75;
 const gates=s.program.practicalAssessment.rubric.filter(r=>r.criticalGate).map(()=>true);
 let exact;
 const find=(scores,weighted)=>{if(exact)return;if(scores.length===s.program.practicalAssessment.rubric.length){if(weighted===70)exact=scores;return;}for(let score=0;score<=4;score++)find([...scores,score],weighted+s.program.practicalAssessment.rubric[scores.length].weight*score/4);};
 find([],0);assert.ok(exact,'Actual published rubric must provide a concrete seventy-point decision');
 const decision=scoreDecision(s.program,exact,gates);assert.equal(decision.score,70);assert.equal(decision.passed,true);assert.ok(decision.score<s.policy.minimumWeightedScore);
 assert.equal(result(s).passRule,null);assert.deepEqual(result(s).prerequisites,s.program.prerequisites);
});
check('doubled rubric is rejected by actual authoring and cannot manufacture out-of-two-hundred rule',()=>{
 const s=snapshot(),expected=structuredClone(s.program);s.program.practicalAssessment.rubric.forEach(r=>r.weight*=2);s.policy.minimumWeightedScore=75;
 assert.ok(validateDocument(s.program,expected).some(i=>i.path==='program.practicalAssessment.rubric'&&i.kind==='consistency'));
 assert.equal(result(s).passRule,null);assert.deepEqual(result(s).prerequisites,s.program.prerequisites);
});
check('current threshold cannot hide an unsupported two-hundred-point or ninety-nine-point rubric',()=>{
 for(const change of [s=>s.program.practicalAssessment.rubric.forEach(r=>r.weight*=2),s=>s.program.practicalAssessment.rubric[0].weight--]){const s=snapshot();change(s);assert.equal(result(s).passRule,null);}
});
check('noninteger same-total rubric is rejected by actual authoring and display guard',()=>{
 const s=snapshot(),expected=structuredClone(s.program);s.program.practicalAssessment.rubric[0].weight+=0.5;s.program.practicalAssessment.rubric[1].weight-=0.5;
 assert.equal(s.program.practicalAssessment.rubric.reduce((n,r)=>n+r.weight,0),100);
 assert.ok(validateDocument(s.program,expected).some(i=>i.path.endsWith('.weight')&&i.kind==='consistency'));assert.equal(result(s).passRule,null);
});
check('malformed private policy values never borrow global policy',()=>{
 for(const value of [undefined,null,[],{},'70/4',...['minimumWeightedScore','scoreMaximum','criticalGates'].map(key=>{const p=structuredClone(policy);delete p[key];return p;})]){const s=snapshot();s.policy=value;assert.equal(result(s).passRule,null);assert.deepEqual(result(s).prerequisites,s.program.prerequisites);}
});
check('unsupported numerical policies stay unavailable even when mathematically positive',()=>{
 for(const [key,value]of [['minimumWeightedScore',0],['minimumWeightedScore',69],['minimumWeightedScore',71],['minimumWeightedScore','70'],['minimumWeightedScore',NaN],['scoreMaximum',1],['scoreMaximum',5],['scoreMaximum',4.5],['scoreMaximum','4'],['criticalGates','average']]){const s=snapshot();s.policy[key]=value;assert.equal(result(s).passRule,null);}
});
check('missing/null/array/nonfinite or out-of-range rubric rows stay unavailable',()=>{
 for(const alter of [s=>delete s.program.practicalAssessment,s=>s.program.practicalAssessment.rubric=null,s=>s.program.practicalAssessment.rubric=[],s=>s.program.practicalAssessment.rubric[0]=null,s=>s.program.practicalAssessment.rubric[0].weight=Infinity,s=>s.program.practicalAssessment.rubric[0].weight=-1,s=>s.program.practicalAssessment.rubric[0].weight=98]){const s=snapshot();alter(s);assert.equal(result(s).passRule,null);}
});
check('malformed critical-gate shape cannot present a supported safety policy',()=>{
 for(const value of [undefined,true,{},'', 'short']){const s=snapshot();s.program.practicalAssessment.rubric[0].criticalGate=value;assert.equal(result(s).passRule,null);}
});
check('private prerequisites are from the resolved older pin despite a newer same-program document',()=>{
 const s=snapshot();s.program.prerequisites=['Older independently reviewed edition requirement'];const newer=structuredClone(seed);newer.pathways[0].prerequisites=['Newer requirement'];assert.deepEqual(derive({snapshot:s,globalSeed:newer}).prerequisites,s.program.prerequisites);
});
check('unknown global edition has no fallback to the archived seed rule',()=>{
 const program=seed.pathways[0];assert.equal(derive({snapshot:{ref:{scope:'global',programId:program.id,versionId:'unknown'},program},globalSeed:seed}),null);
});
check('mismatched or malformed content identity is omitted',()=>{
 for(const alter of [s=>s.ref.programId='other',s=>s.ref.scope='partner',s=>s.ref.scope='tw-short',s=>s.ref.versionId='']){const s=snapshot();alter(s);assert.equal(result(s),null);}
});
check('unavailable resolution cannot invent readiness',()=>{assert.equal(derive({snapshot:null,globalSeed:seed}),null);assert.equal(derive({globalSeed:seed}),null);});
check('invalid prerequisites are not invented or borrowed',()=>{
 for(const value of [undefined,'Read',[null],[' ']]){const s=snapshot();s.program.prerequisites=value;assert.equal(result(s),null);}
});
check('empty prerequisite list remains honestly empty',()=>{const s=snapshot();s.program.prerequisites=[];assert.deepEqual(result(s).prerequisites,[]);});
check('projection never mutates snapshot/global seed and detaches prerequisite display',()=>{
 const s=snapshot(),before=JSON.stringify(s),seedBefore=JSON.stringify(seed),shown=result(s);shown.prerequisites.push('Browser-only copy');assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(seed),seedBefore);
});
test.after(async()=>{await writeFile(output+'/policy-test-evidence.json',JSON.stringify({passed:groups===18,groups,at:new Date().toISOString(),limits:['Actual scoring/authoring pure modules; staged policy guard. No network, persistent mutation or integrated browser acceptance.']},null,2));});
