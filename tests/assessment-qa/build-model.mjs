/** Assessment QA model: bundles the actual engine, rules, remediation and curriculum into one pure module.
 * No network, SQL, Worker, browser or checkout edit. */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:'.'));
const output=resolve(process.env.ACADEMY_ASSESSMENT_QA_OUTPUT??app+'/.sites-runtime/assessment-qa');mkdirSync(output,{recursive:true});
const require=createRequire(app+'/package.json'),esbuild=require('esbuild');
const entry=output+'/model-entry.ts';
writeFileSync(entry,`export {applyCommand,freshWorkspace,resumeLearning,RuleError,programs,scoreDecision} from ${JSON.stringify(app+'/lib/academy-engine.ts')};export * from ${JSON.stringify(app+'/lib/academy-assessment-rules.ts')};export * from ${JSON.stringify(app+'/lib/academy-remediation.ts')};`);
await esbuild.build({entryPoints:[entry],absWorkingDir:app,bundle:true,platform:'node',format:'esm',outfile:output+'/model.mjs',logLevel:'warning'});
// the UI files must at least parse
for(const f of ['app/academy-learning.tsx','app/academy-remediation.tsx','app/academy-accommodations.tsx'])if(existsSync(app+'/'+f))await esbuild.transform(readFileSync(app+'/'+f,'utf8'),{loader:'tsx',jsx:'preserve',sourcefile:f});
console.log('Assessment QA model bundled from actual sources.');
