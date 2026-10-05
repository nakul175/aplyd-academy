/** Private inspection copies only. A checksum neither authenticates nor restores data. */
export const SNAPSHOT_LIMITS=Object.freeze({fileBytes:8_000_000,contentBytes:1_000_000});
export type PersonalSnapshot={format:'aplyd-academy-personal-snapshot';formatVersion:1;exportedAt:string;subjectId:string;sourceRevision:number;saved:boolean;sourceUpdatedAt:string|null;snapshotEncoding:'utf8-json';snapshotJson:string;snapshotSha256:string};
export type SnapshotInspection={format:'versioned'|'legacy'|'unsupported';integrity:'matches'|'changed'|'unavailable';account:'matches'|'different'|'not-compared';content:'readable'|'unreadable'|'not-inspected';withinPilotSize:boolean|null;sourceRevision:number|null;enrollments:number|null;message:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canonicalTime=(v:unknown)=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const bytes=(v:string)=>new TextEncoder().encode(v).length;
const subject=(v:unknown):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=300&&!/[\u0000-\u001f\u007f]/.test(v);
const metadata=(saved:boolean,revision:number,updated:unknown)=>saved?revision>=1&&canonicalTime(updated):revision===0&&updated===null;
export async function snapshotChecksum(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function buildPersonalSnapshot(input:{subjectId:string;sourceRevision:number;saved:boolean;sourceUpdatedAt:string|null;snapshotJson:string},now=new Date().toISOString()):Promise<PersonalSnapshot>{
 if(!canonicalTime(now)||!subject(input.subjectId)||!Number.isSafeInteger(input.sourceRevision)||input.sourceRevision<0||typeof input.saved!=='boolean'||!metadata(input.saved,input.sourceRevision,input.sourceUpdatedAt)||typeof input.snapshotJson!=='string')throw new Error('The saved snapshot metadata is unavailable.');
 return {format:'aplyd-academy-personal-snapshot',formatVersion:1,exportedAt:now,subjectId:input.subjectId,sourceRevision:input.sourceRevision,saved:input.saved,sourceUpdatedAt:input.sourceUpdatedAt,snapshotEncoding:'utf8-json',snapshotJson:input.snapshotJson,snapshotSha256:await snapshotChecksum(input.snapshotJson)};
}
export function recognizedPersonalSnapshot(v:unknown):v is PersonalSnapshot{
 const keys=['format','formatVersion','exportedAt','subjectId','sourceRevision','saved','sourceUpdatedAt','snapshotEncoding','snapshotJson','snapshotSha256'];
 return object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))&&v.format==='aplyd-academy-personal-snapshot'&&v.formatVersion===1&&canonicalTime(v.exportedAt)&&subject(v.subjectId)&&Number.isSafeInteger(v.sourceRevision)&&Number(v.sourceRevision)>=0&&typeof v.saved==='boolean'&&metadata(v.saved,Number(v.sourceRevision),v.sourceUpdatedAt)&&v.snapshotEncoding==='utf8-json'&&typeof v.snapshotJson==='string'&&typeof v.snapshotSha256==='string'&&/^[a-f0-9]{64}$/.test(v.snapshotSha256);
}
/** Returns labels and counts, never evidence, names, grants or command permissions. */
export async function inspectPersonalSnapshot(fileText:string,expectedSubject?:string):Promise<SnapshotInspection>{
 const none:SnapshotInspection={format:'unsupported',integrity:'unavailable',account:'not-compared',content:'not-inspected',withinPilotSize:null,sourceRevision:null,enrollments:null,message:'This file is not a supported private snapshot. No data was changed.'};
 if(bytes(fileText)>SNAPSHOT_LIMITS.fileBytes)return {...none,message:'This file is too large to inspect here. No data was changed.'};
 let v:unknown;try{v=JSON.parse(fileText)}catch{return {...none,message:'This file could not be read as JSON. No data was changed.'};}
 if(!recognizedPersonalSnapshot(v)){
  if(object(v)&&object(v.profile)&&Array.isArray(v.enrollments)&&!Object.hasOwn(v,'format'))return {...none,format:'legacy',content:'readable',enrollments:v.enrollments.length,message:'This is an older unversioned export. It has no carried checksum or verified account reference. No data was changed.'};
  return none;
 }
 const integrity=await snapshotChecksum(v.snapshotJson)===v.snapshotSha256?'matches':'changed',account=expectedSubject?(v.subjectId===expectedSubject?'matches':'different'):'not-compared';
 const result:SnapshotInspection={...none,format:'versioned',integrity,account,withinPilotSize:bytes(v.snapshotJson)<=SNAPSHOT_LIMITS.contentBytes,sourceRevision:v.sourceRevision,content:'unreadable',message:'The carried checksum matches. This copy is unencrypted, unsigned and cannot restore a workspace.'};
 if(integrity==='changed')return {...result,content:'not-inspected',message:'The carried checksum differs from the contents. No data was changed.'};
 try{const content:unknown=JSON.parse(v.snapshotJson);if(object(content)){result.content='readable';result.enrollments=Array.isArray(content.enrollments)?content.enrollments.length:null;}else result.message='The carried checksum matches, but the stored contents are not a learning-space object. No data was changed.';}catch{result.message='The carried checksum matches, but the stored contents could not be read. Keep this private copy for diagnosis. No data was changed.';}
 if(account==='different')result.message+=' Its account reference differs from your currently open personal lab.';
 return result;
}
