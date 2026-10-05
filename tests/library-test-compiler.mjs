import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
export const app=resolve(process.env.ACADEMY_APP_PATH??new URL('../',import.meta.url).pathname);
export const output=resolve(process.env.ACADEMY_LIBRARY_QA_OUT??resolve(app,'.sites-runtime/library-qa'));mkdirSync(output,{recursive:true});
const require=createRequire(resolve(app,'package.json')),ts=require('typescript');
export async function compileLibraryFile(relative){
 // Deliberately reads only the chosen checkout. Missing adopted sources fail loudly.
 const file=resolve(app,relative),source=readFileSync(file,'utf8'),result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);assert.deepEqual(errors,[],relative+' must compile without syntax diagnostics.');
 const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputText).toString('base64'));
 return {module,evidence:{file,relative,sha256:createHash('sha256').update(source).digest('hex'),typescriptVersion:ts.version,syntaxDiagnostics:errors.length}};
}
export function recordLibrary(name,evidence){writeFileSync(resolve(output,name),JSON.stringify(evidence,null,2)+'\n')}
