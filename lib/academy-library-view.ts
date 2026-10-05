/** A bounded presentation model for supplied public reference files, not enrollment data. */
export const libraryCollectionIds=['government','development','oversight','emerging-leaders','frontline'] as const;
export type LibraryAudience='participant'|'trainer'|'all';
export type LibraryFormat='docx'|'pdf'|'pptx';
export type LibraryResource={id:string;title:string;audience:LibraryAudience;format:LibraryFormat;bytes:number;href:string;sha256:string;sourceFilename:string;filename:string};
export type LibraryCollection={id:typeof libraryCollectionIds[number];title:string;summary:string;reviewNote:string|null;resources:LibraryResource[]};
const short=(v:unknown,n:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
export function libraryFilename(href:unknown,format:unknown):string|null{
 if(typeof href!=='string'||href.length>500||!/^\/library\//.test(href)||/[?#\\]/.test(href))return null;
 let path:string;try{path=decodeURIComponent(href)}catch{return null}
 if(!/^\/library\/[A-Za-z0-9_./-]+$/.test(path)||path.includes('//')||path.split('/').some(x=>x==='.'||x==='..'))return null;
 const filename=path.split('/').at(-1)??'';
 return short(filename,180)&&['docx','pdf','pptx'].includes(String(format))&&filename.toLowerCase().endsWith('.'+format)?filename:null;
}
export function libraryIndex(raw:unknown):LibraryCollection[]|null{
 if(!Array.isArray(raw)||raw.length<1||raw.length>5)return null;
 const seenCollections=new Set<string>(),seenResources=new Set<string>(),seenHrefs=new Set<string>();let total=0;
 const output:LibraryCollection[]=[];
 for(const c of raw){
  if(!c||typeof c!=='object'||!libraryCollectionIds.includes(c.id)||seenCollections.has(c.id)||!short(c.title,180)||!short(c.summary,700)||!Array.isArray(c.resources)||c.resources.length<1||c.resources.length>4)return null;
  if(c.reviewNote!=null&&!short(c.reviewNote,1000))return null;
  seenCollections.add(c.id);const resources:LibraryResource[]=[];
  for(const r of c.resources){
   if(++total>20||!r||typeof r!=='object'||!short(r.id,100)||seenResources.has(r.id)||!short(r.title,200)||!['participant','trainer','all'].includes(r.audience)||!['docx','pdf','pptx'].includes(r.format)||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>50_000_000||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256))return null;
   const hrefFilename=libraryFilename(r.href,r.format);if(!hrefFilename||seenHrefs.has(r.href)||!short(r.sourceFilename,180)||/[\/\\]/.test(r.sourceFilename)||!r.sourceFilename.toLowerCase().endsWith('.'+r.format))return null;
   const filename=r.sourceFilename;
   seenResources.add(r.id);seenHrefs.add(r.href);resources.push({id:r.id,title:r.title,audience:r.audience,format:r.format,bytes:r.bytes,href:r.href,sha256:r.sha256,sourceFilename:r.sourceFilename,filename});
  }
  output.push({id:c.id,title:c.title,summary:c.summary,reviewNote:c.reviewNote??null,resources});
 }
 return output;
}
export function libraryResults(index:LibraryCollection[],query='',collection='all',audience='all'):LibraryCollection[]{
 const words=query.slice(0,120).trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
 return index.filter(c=>collection==='all'||c.id===collection).map(c=>({...c,resources:c.resources.filter(r=>{
  const recommended=audience==='all'||r.audience===audience||r.audience==='all';
  const haystack=[c.title,c.summary,r.title,r.filename,r.audience,resourceKind(r)].join(' ').toLocaleLowerCase('en');
  return recommended&&words.every(word=>haystack.includes(word));
 })})).filter(c=>c.resources.length>0);
}
export function resourceKind(r:Pick<LibraryResource,'format'|'audience'>){return r.format==='pdf'?'Printables':r.format==='pptx'?'Slide deck':r.audience==='participant'?'Participant handbook':r.audience==='trainer'?'Trainer handbook':'Reference document';}
export function librarySize(bytes:number){return bytes<1_000_000?`${Math.max(1,Math.round(bytes/1000))} KB`:`${(bytes/1_000_000).toFixed(1)} MB`;}
