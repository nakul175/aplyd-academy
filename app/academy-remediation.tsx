'use client';
import {ListChecks} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {buildRemediation,type RemediationRoute} from '@/lib/academy-remediation';
import {useAcademy} from './academy-context';
/** "What to do next" for one failed decision. Renders nothing for a pass or an undecided attempt. */
export function WhatToDoNext({program,enrollment,attempt,decision,onGoto}:{program:any;enrollment:any;attempt:any;decision:any;onGoto?:(tab:'learn'|'assessment'|'feedback',lessonId:string|null)=>void}){
 const {go}=useAcademy(),plan=buildRemediation(program,enrollment,attempt,decision);
 if(!plan.applies)return null;
 const open=(r:RemediationRoute)=>{if(!r.tab){if(r.hash==='#settings')go('settings');return}onGoto?.(r.tab,r.lessonId);go('learn',program.id,{tab:r.tab,...(r.lessonId?{lessonId:r.lessonId}:{})})};
 const Route=({r}:{r:RemediationRoute})=>r.kind==='reviewer-next-step'?<li><strong>{r.label}.</strong> {r.detail?<span className="pre-wrap">{r.detail}</span>:<span>See the reviewer’s feedback above.</span>}</li>:r.hash?<li>{r.kind==='redo-step'&&<span>{r.label}: </span>}{r.kind==='redo-step'&&r.detail&&<em>{r.detail}. </em>}<a href={r.hash} onClick={ev=>{ev.preventDefault();open(r)}}>{r.kind==='redo-step'?'Open the lesson':r.label}</a>{r.section&&<small> · {r.section}</small>}</li>:<li>{r.label}</li>;
 return <section className="source-packet mt" aria-label="What to do next"><div className="section-title no-top"><h3><ListChecks size={18}/> What to do next</h3></div>
  <p className="form-hint">Each gap below is matched to the lesson wording closest to it, followed by your reviewer’s own note. Where the match is only approximate, the reviewer’s note is the authority.</p>
  <ol className="outcome-list">{plan.items.map(it=><li key={it.id}><p><strong>{it.dimension}: {it.score}/4.</strong> {it.gate&&<>A critical gate was not met: <em>{it.gate}</em>. </>}</p><ul>{it.routes.map((r,i)=><Route key={i} r={r}/>)}</ul></li>)}</ol>
  {plan.closing.map((r,i)=><p className="mt" key={i}>{r.hash&&r.tab?<Button variant="outline" onClick={()=>open(r)}>{r.label}</Button>:<strong>{r.label}</strong>}</p>)}
  <p className="form-hint">Attempts used: {plan.retry.attemptsUsed} of {plan.retry.maxAttempts}.</p></section>;
}
