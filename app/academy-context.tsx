'use client';
import {createContext,useContext,useRef} from 'react';
export const AcademyContext=createContext<any>(null);
export const useAcademy=()=>useContext(AcademyContext);

/** Own unsent input survives permission-refresh remounts, in memory only. */
export function useWorkspaceDraft<T>(key:string,initial:T|(()=>T)):[T,(value:T|((prior:T)=>T))=>void]{
 const {scratch,setScratch,activeWorkspace}=useAcademy();
 const storageKey=activeWorkspace+':'+key;
 const seed=useRef<{key:string,value:T}|null>(null);
 if(!seed.current||seed.current.key!==storageKey)seed.current={key:storageKey,value:typeof initial==='function'?(initial as ()=>T)():initial};
 const fallback=seed.current.value;
 const value=Object.hasOwn(scratch,storageKey)?scratch[storageKey]:fallback;
 const setValue=(next:T|((prior:T)=>T))=>setScratch((prior:Record<string,unknown>)=>{
  const current=Object.hasOwn(prior,storageKey)?prior[storageKey] as T:fallback;
  return {...prior,[storageKey]:typeof next==='function'?(next as (v:T)=>T)(current):next};
 });
 return [value,setValue];
}
