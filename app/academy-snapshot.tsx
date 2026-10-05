'use client';
import {useState,useRef,useEffect} from 'react';
import {Download,FileCheck2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {inspectPersonalSnapshot,recognizedPersonalSnapshot,SNAPSHOT_LIMITS,type SnapshotInspection} from '@/lib/academy-snapshot';
import {useAcademy} from './academy-context';
import {readAcademyResponse} from './academy-response';
import {download} from './academy-download';
export function PersonalSnapshotControls(){
 const {accountKey,busy,load}=useAcademy(),[working,setWorking]=useState(false),[error,setError]=useState(''),[inspection,setInspection]=useState<SnapshotInspection|null>(null),generation=useRef(0);
 useEffect(()=>{generation.current++;setInspection(null);setError('');return()=>{generation.current++;};},[accountKey]);
 async function exportSnapshot(){
  const ticket=++generation.current,subject=accountKey;setWorking(true);setError('');
  try{
   if(!subject)throw new Error('Refresh saved progress to verify your personal lab before exporting.');
   const response=await fetch('/api/academy/export',{cache:'no-store'}),data=await readAcademyResponse(response,'read');
   if(ticket!==generation.current)return;
   if(!response.ok){if([401,403,404].includes(response.status))await load();throw new Error(typeof data.error==='string'?data.error:'Your private snapshot could not be exported.');}
   if(!recognizedPersonalSnapshot(data)||data.subjectId!==subject)throw new Error('This snapshot could not be matched to your open personal lab. Refresh saved progress before exporting again.');
   const check=await inspectPersonalSnapshot(JSON.stringify(data),subject);if(ticket!==generation.current)return;
   if(check.integrity!=='matches')throw new Error('This snapshot could not be checked. Refresh saved progress before exporting again.');
   download('aplyd-personal-snapshot.json',data);
  }catch(e){if(ticket===generation.current)setError(e instanceof Error?e.message:'Your private snapshot could not be exported.');}
  finally{if(ticket===generation.current)setWorking(false);}
 }
 async function inspectFile(file:File|undefined){
  if(!file)return;const ticket=++generation.current;setWorking(true);setError('');setInspection(null);
  try{
   if(file.size>SNAPSHOT_LIMITS.fileBytes)throw new Error('Choose a snapshot file smaller than 8 MB.');
   const result=await inspectPersonalSnapshot(await file.text(),accountKey??undefined);if(ticket===generation.current)setInspection(result);
  }catch(e){if(ticket===generation.current)setError(e instanceof Error?e.message:'This file could not be inspected.');}
  finally{if(ticket===generation.current)setWorking(false);}
 }
 return <div className="mt"><Button variant="outline" disabled={busy||working||!accountKey} onClick={exportSnapshot}><Download size={16}/>{working?'Checking private copy…':'Export a fresh private snapshot'}</Button><p className="form-hint">This reads your currently saved personal lab. The file contains your private evidence and is unencrypted. Keep it somewhere private. It cannot restore a workspace.</p><details className="source-packet"><summary><FileCheck2 size={16}/>Inspect a saved snapshot</summary><p className="mt">The selected file stays in this browser. Inspection checks its format and carried checksum; it does not authenticate an issuer or change saved learning.</p><div className="field"><label htmlFor="personal-snapshot-file">Choose your private JSON snapshot</label><input id="personal-snapshot-file" type="file" accept="application/json,.json" disabled={working||busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';void inspectFile(file);}}/></div>{inspection&&<div className="notice" role="status"><div><strong>{inspection.format==='versioned'?'Versioned private snapshot':inspection.format==='legacy'?'Older workspace export':'Unsupported file'}</strong><p>{inspection.message}</p>{inspection.sourceRevision!==null&&<p>Saved revision {inspection.sourceRevision} · {inspection.enrollments===null?'Enrollment count unavailable':`${inspection.enrollments} retained enrollments`}</p>}{inspection.withinPilotSize===false&&<p>The carried contents exceed the current personal-lab size bound.</p>}</div></div>}</details>{error&&<p role="alert" className="form-hint">{error}</p>}</div>;
}
