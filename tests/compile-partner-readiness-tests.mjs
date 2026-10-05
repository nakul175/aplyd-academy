// Portable actual-root readiness compiler. Candidate mode is explicit and writes only the selected QA output.
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),app=resolve(process.env.ACADEMY_APP_PATH??here+'/..');
const candidate=process.env.ACADEMY_READINESS_CANDIDATE_ROOT?resolve(process.env.ACADEMY_READINESS_CANDIDATE_ROOT):null,source=candidate??app;
const out=resolve(process.env.ACADEMY_READINESS_QA_OUT??app+'/.sites-runtime/partner-readiness-qa');mkdirSync(out,{recursive:true});
const require=createRequire(app+'/package.json'),esbuild=require('esbuild'),ts=require('typescript');
const model=source+'/lib/academy-partner-readiness.ts',ui=source+'/app/academy-partner-readiness.tsx',connections=source+'/app/academy-ecosystems.tsx';
const staged=['lib/academy-partner-readiness.ts','app/academy-partner-readiness.tsx','app/academy-ecosystems.tsx'];
const lookup=(base)=>[base,base+'.ts',base+'.tsx',base+'.json',base+'/index.ts',base+'/index.tsx'].find(existsSync);
const mapping={'./academy-ecosystems':app+'/lib/academy-ecosystems.ts','./academy-curriculum':app+'/lib/academy-curriculum.ts','../lib/academy-partner-readiness':model,'./academy-partner-readiness':ui};
const actual=['lib/academy-ecosystems.ts','lib/academy-curriculum.ts','lib/academy-engine.ts','lib/curriculum-versions/0.1-review-draft.json','lib/curriculum.json','app/academy-ecosystems.tsx'];
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),before=Object.fromEntries(actual.map(f=>[f,hash(app+'/'+f)]));
function modulePath(name,containing){if(name.startsWith('@/')){const f=name.slice(2);return lookup(resolve(candidate&&staged.includes(f+'.ts')?source:app,f))}if(mapping[name])return mapping[name];if(candidate&&containing.startsWith(source+'/app/')&&name.startsWith('./')&&name!=='./academy-partner-readiness'&&!name.endsWith('.module.css'))return lookup(resolve(app,'app',name.slice(2)));return null}
const plugin={name:'actual-domain-with-explicit-source-selection',setup(build){build.onResolve({filter:/^@\/|^\.\//},args=>{const path=modulePath(args.path,args.importer);return path?{path}:undefined})}};
writeFileSync(out+'/entry.ts','export * from '+JSON.stringify(model)+';\nexport {readTestGrants,readTestReceipts} from '+JSON.stringify(app+'/lib/academy-ecosystems.ts')+';\nexport {applyCommand,freshWorkspace} from '+JSON.stringify(app+'/lib/academy-engine.ts')+';\nexport {programs,CONTENT_VERSION,createCurriculumRegistry,curriculumRegistry} from '+JSON.stringify(app+'/lib/academy-curriculum.ts')+';');
const result=await esbuild.build({entryPoints:[out+'/entry.ts'],bundle:true,platform:'node',format:'esm',outfile:out+'/readiness.mjs',metafile:true,plugins:[plugin]});
await esbuild.build({entryPoints:[ui,connections],bundle:true,platform:'browser',format:'esm',outdir:out+'/ui',external:['react','react/*','lucide-react','@/components/*'],plugins:[plugin]});
writeFileSync(out+'/css.d.ts','declare module "*.module.css" { const classes: Record<string,string>; export default classes; }');
const options={noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,resolveJsonModule:true,esModuleInterop:true,skipLibCheck:true,typeRoots:[app+'/node_modules/@types'],types:['react','react-dom','node'],baseUrl:app,paths:{'@/*':['./*']}};
const host=ts.createCompilerHost(options);host.resolveModuleNames=(names,containing)=>names.map(name=>{const p=modulePath(name,containing);if(p)return {resolvedFileName:p,extension:p.endsWith('.tsx')?ts.Extension.Tsx:p.endsWith('.json')?ts.Extension.Json:ts.Extension.Ts};return ts.resolveModuleName(name,containing,options,host).resolvedModule??ts.resolveModuleName(name,app+'/app/academy.tsx',options,host).resolvedModule});
const program=ts.createProgram([model,ui,connections,out+'/css.d.ts'],options,host),diagnostics=ts.getPreEmitDiagnostics(program);
const after=Object.fromEntries(actual.map(f=>[f,hash(app+'/'+f)]));if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Actual root sources changed while preparing readiness proof');
const dependencies=Object.fromEntries(Object.keys(result.metafile.inputs).map(f=>resolve(f)).filter(f=>!f.includes('/node_modules/')).map(f=>[f,hash(f)]));
const clockBeforeReader=readFileSync(connections,'utf8').indexOf('const [clock,setClock]')<readFileSync(connections,'utf8').indexOf('readTestReceipts(state.ecosystemReceipts,grants,clock)');
if(!clockBeforeReader||!readFileSync(connections,'utf8').includes('readTestReceipts(state.ecosystemReceipts,grants,clock)'))throw new Error('Current clock was not supplied to the existing receipt listing');
writeFileSync(out+'/compilation-evidence.json',JSON.stringify({passed:diagnostics.length===0,typeDiagnostics:diagnostics.length,mode:candidate?'explicit-candidate':'actual-adopted-checkout',app,source,at:new Date().toISOString(),rootSourcesBefore:before,rootUnchanged:true,clockBeforeReader,files:[model,ui,connections,source+'/app/academy-partner-readiness.module.css'].map(path=>({path,sha256:hash(path)})),dependencies,limits:['Pure compiler/typecheck only. No app framework build, server, API, browser, storage mutation or external partner call.']},null,2)+'\n');
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>here,getCanonicalFileName:f=>f,getNewLine:()=>"\n"}));process.exitCode=1}else console.log((candidate?'Candidate':'Actual adopted')+' readiness model, UI and connections integration passed strict typecheck and pure compilation.');

