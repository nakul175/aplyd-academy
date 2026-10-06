/** BR-04 recovery QA model: bundles the actual team layer, recovery module and engine as one pure module.
 * No network, SQL, Worker, browser or email. */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),nearby=resolve(here,'../..');
const app=resolve(process.env.ACADEMY_APP_PATH??(existsSync(nearby+'/lib/academy-recovery.ts')?nearby:'.'));
const output=resolve(process.env.ACADEMY_RECOVERY_QA_OUTPUT??app+'/.sites-runtime/recovery-qa');mkdirSync(output,{recursive:true});
const esbuild=createRequire(app+'/package.json')('esbuild'),entry=output+'/model-entry.ts';
writeFileSync(entry,`export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app+'/lib/academy-teams.ts')};export {programs,currentRef,freshWorkspace} from ${JSON.stringify(app+'/lib/academy-engine.ts')};export {learnerRecordIsEmpty,RECOVERY_LIMITS} from ${JSON.stringify(app+'/lib/academy-recovery.ts')};`);
await esbuild.build({entryPoints:[entry],absWorkingDir:app,bundle:true,platform:'node',format:'esm',outfile:output+'/model.mjs',logLevel:'warning'});
console.log('Recovery model bundled to '+output+'/model.mjs');
