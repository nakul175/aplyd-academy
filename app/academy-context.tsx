'use client';
import {createContext,useContext,useRef,useEffect} from 'react';
export const AcademyContext=createContext<any>(null);
export const useAcademy=()=>useContext(AcademyContext);

/** Navigation carries only an item reference, never bodies or command rights. */
export function useOperationsNavigation(view:string,handle:(destination:any)=>boolean|void){
 const {operationTarget,setOperationTarget,activeWorkspace}=useAcademy();
 const latest=useRef(handle);latest.current=handle;
 useEffect(()=>{
  const target=operationTarget;
  if(!target||target.workspaceId!==activeWorkspace||target.view!==view)return;
  if(latest.current(target)!==false)setOperationTarget((prior:any)=>prior===target?null:prior);
 },[operationTarget,activeWorkspace,view,setOperationTarget]);
}

let focusRequest=0;
export function focusOperationItem(attribute:string,id:string|undefined){
 const request=++focusRequest;
 if(!id)return;
 const main=document.getElementById('main'),scope=main?.getAttribute('data-operation-scope'),hash=location.hash,initialFocus=document.activeElement,deadline=performance.now()+1000;
 const attempt=()=>{
  if(request!==focusRequest||performance.now()>deadline||document.visibilityState==='hidden'||!main?.isConnected||main.getAttribute('data-operation-scope')!==scope||location.hash!==hash)return;
  if(document.activeElement!==initialFocus&&document.activeElement!==main&&document.activeElement!==document.body)return;
  const item=[...main.querySelectorAll<HTMLElement>('['+attribute+']')].find(e=>e.getAttribute(attribute)===id);
  const control=item?[...item.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary')].find(e=>e.getClientRects().length&&!e.closest('[inert],[hidden],[aria-hidden="true"]')&&getComputedStyle(e).visibility==='visible'):undefined;
  if(item&&control){item.scrollIntoView({block:'center',behavior:'instant'});control.focus({preventScroll:true});return;}
  if(performance.now()<deadline)requestAnimationFrame(attempt);
 };
 requestAnimationFrame(()=>requestAnimationFrame(attempt));
}

/** Own unsent input survives permission-refresh remounts, in memory only. */
export function useWorkspaceDraft<T>(key:string,initial:T|(()=>T)):[T,(value:T|((prior:T)=>T))=>void]{
 const {scratch,setScratch,activeWorkspace,accountKey}=useAcademy();
 const storageKey=JSON.stringify([accountKey??'unknown',activeWorkspace,key]);
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
