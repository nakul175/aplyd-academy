/** Onboarding QA model: bundles the actual engine and the actual onboarding module into one pure ESM file.
 * No network, SQL, Worker, browser or checkout edit. */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/app/api/academy/route.ts')?nearby:'.'));
const output=resolve(process.env.ACADEMY_ONBOARDING_QA_OUTPUT??app+'/.sites-runtime/onboarding-qa');mkdirSync(output,{recursive:true});
const require=createRequire(app+'/package.json'),esbuild=require('esbuild');
const entry=output+'/model-entry.ts';
writeFileSync(entry,`export {applyCommand,freshWorkspace,contexts,RuleError} from ${JSON.stringify(app+'/lib/academy-engine.ts')};export * from ${JSON.stringify(app+'/lib/academy-onboarding.ts')};export {PLAN_GOALS} from ${JSON.stringify(app+'/lib/academy-plan.ts')};`);
await esbuild.build({entryPoints:[entry],absWorkingDir:app,bundle:true,platform:'node',format:'esm',outfile:output+'/model.mjs',logLevel:'warning'});
console.log('Onboarding model built from the actual engine and onboarding sources.');
