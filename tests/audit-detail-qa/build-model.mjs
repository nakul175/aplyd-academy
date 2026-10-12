/** BR-46 audit detail QA model: bundles the pure whitelist summariser with the actual engine and team model.
 * No network, SQL, Worker or browser; the source is hashed before and after to prove it was not edited while bundling. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),output=resolve(process.env.ACADEMY_AUDIT_QA_OUTPUT??app+'/.sites-runtime/audit-detail-qa');mkdirSync(output,{recursive:true});
const esbuild=createRequire(app+'/package.json')('esbuild'),entry=output+'/model-entry.ts';
writeFileSync(entry,`export * from ${JSON.stringify(app+'/lib/academy-audit-detail.ts')};export {applyCommand,freshWorkspace,programs} from ${JSON.stringify(app+'/lib/academy-engine.ts')};export {createTeam,applyTeamCommand} from ${JSON.stringify(app+'/lib/academy-teams.ts')};`);
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex'),pure=app+'/lib/academy-audit-detail.ts',before=sha(pure);
const r=await esbuild.build({entryPoints:[entry],absWorkingDir:app,bundle:true,platform:'node',format:'esm',outfile:output+'/model.mjs',metafile:true,logLevel:'warning',tsconfig:app+'/tsconfig.json'});
if(before!==sha(pure))throw new Error('Audit detail source changed while bundling.');
if(!Object.keys(r.metafile.inputs).some(f=>f.endsWith('lib/academy-audit-detail.ts')))throw new Error('Audit detail module missing from bundle.');
/* The real route handlers, bundled with the platform imports replaced by in-test stubs (D1 shim over node:sqlite, header-free identity). */
const stubs={name:'platform-stubs',setup(b){
 b.onResolve({filter:/^cloudflare:workers$|platform-env$/},()=>({path:'workers',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));
 b.onLoad({filter:/^workers$/,namespace:'stub'},()=>({contents:'export const env={get DB(){return globalThis.__auditDb}};',loader:'js'}));
 b.onLoad({filter:/^auth$/,namespace:'stub'},()=>({contents:'export async function getChatGPTUser(){return globalThis.__auditUser??null}',loader:'js'}));
}};
for(const [name,file] of [['route-teams','app/api/teams/route.ts'],['route-teams-audit','app/api/teams/audit/route.ts'],['route-academy','app/api/academy/route.ts'],['route-academy-audit','app/api/academy/audit/route.ts']])
 await esbuild.build({entryPoints:[app+'/'+file],absWorkingDir:app,bundle:true,platform:'node',format:'esm',outfile:output+'/'+name+'.mjs',logLevel:'warning',tsconfig:app+'/tsconfig.json',plugins:[stubs]});
writeFileSync(output+'/source-evidence.json',JSON.stringify({at:new Date().toISOString(),sha256:before},null,2));
console.log('Audit detail model bundled with the actual engine and team model; source stable.');
