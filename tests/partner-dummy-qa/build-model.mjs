// Bundles the ACTUAL pure module, service and routes (with a mocked Worker host) for node:test. No network, no Worker.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(app,'.sites-runtime/partner-dummy-qa');mkdirSync(out,{recursive:true});
const esbuild=createRequire(app+'/package.json')('esbuild');
const q=p=>JSON.stringify(resolve(app,p));
const host=out+'/host-mock.ts';
writeFileSync(host,'export const env:{DB:any}={DB:null};let identity:any=null;export function setIdentity(v:any){identity=v;}export async function getChatGPTUser(){return identity;}');
const entry=`export * from ${q('lib/academy-partner-dummy.ts')};
export * from ${q('lib/academy-partner-dummy-service.ts')};
export {freshWorkspace,applyCommand} from ${q('lib/academy-engine.ts')};
export {POST as enrolPOST} from ${q('app/api/partner/enrol/route.ts')};
export {GET as verifyGET} from ${q('app/api/partner/verify/[token]/route.ts')};
export {GET as linksGET,POST as linksPOST} from ${q('app/api/partner/links/route.ts')};
export {POST as deliverPOST} from ${q('app/api/partner/deliver/route.ts')};
export {env,setIdentity} from ${JSON.stringify(host)};`;
await esbuild.build({stdin:{contents:entry,resolveDir:app,sourcefile:'partner-dummy-model.ts'},outfile:out+'/model.mjs',bundle:true,platform:'node',format:'esm',target:'es2022',tsconfig:app+'/tsconfig.json',
 plugins:[{name:'pure-host',setup(b){b.onResolve({filter:/^cloudflare:workers$|chatgpt-auth$/},()=>({path:host}))}}]});
console.log('partner-dummy model built');
