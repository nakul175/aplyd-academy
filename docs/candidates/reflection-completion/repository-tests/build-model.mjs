import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),kit=resolve(here,'..'),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:existsSync('app/api/academy/route.ts')?'.':'work/aplyd-academy'));
const staged=existsSync(kit+'/lib/academy-plan.ts'),candidate=resolve(process.env.ACADEMY_REFLECTION_PLAN_MODEL??(staged?kit+'/lib/academy-plan.ts':app+'/lib/academy-plan.ts'));
const output=resolve(process.env.ACADEMY_REFLECTION_QA_OUTPUT??(staged?kit+'/runtime':app+'/.sites-runtime/reflection-completion-qa'));mkdirSync(output,{recursive:true});
const require=createRequire(app+'/package.json'),esbuild=require('esbuild'),ts=require('typescript'),rootPlan=app+'/lib/academy-plan.ts';
const hashes={};
for(const [name,override] of [['before',null],['model',candidate]]){
 const entry=output+'/'+name+'-entry.ts';
 writeFileSync(entry,`export {applyCommand,freshWorkspace,planOptions,RuleError,programs} from ${JSON.stringify(app+'/lib/academy-engine.ts')};export {applyLearningPlanCommand,taskProgress,learningPlanSummary,projectPlanTasks} from ${JSON.stringify(rootPlan)};export {deriveOwnWeeklyReview,prepareOwnWeeklyRecap} from ${JSON.stringify(app+'/lib/academy-weekly-review.mjs')};`);
 const bundle=await esbuild.build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:output+'/'+name+'.mjs',metafile:true,plugins:override?[{name:'staged-plan-only',setup(build){build.onResolve({filter:/academy-plan(?:\.ts)?$/},args=>{const target=resolve(dirname(args.importer),args.path.endsWith('.ts')?args.path:args.path+'.ts');return target===rootPlan?{path:override}:undefined;});}}]:[]});
 hashes[name]=Object.keys(bundle.metafile.inputs).filter(file=>resolve(file)!==entry).map(file=>({file:relative(app,file),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
}
const options={noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
const host=ts.createCompilerHost(options),program=ts.createProgram([candidate],options,host),diagnostics=ts.getPreEmitDiagnostics(program);if(diagnostics.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
writeFileSync(output+'/source-evidence.json',JSON.stringify({at:new Date().toISOString(),before:hashes.before,model:hashes.model,strictPlanTypecheck:true,limits:['Actual root engine/curriculum/weekly model; only academy-plan.ts overridden in staged AFTER model. BEFORE uses unchanged actual root modules. Pure bundle only, no app build or network, persisted fixtures, SQL, checkout edit, Worker or browser.']},null,2));
console.log(`Strict staged plan check; BEFORE ${hashes.before.length} sources, AFTER ${hashes.model.length} sources.`);
