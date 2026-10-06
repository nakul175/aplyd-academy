'use client';
import {useState} from 'react';
import {KeyRound,ShieldCheck,UserPlus,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {useAcademy,useWorkspaceDraft} from './academy-context';
import {Head,Empty,Tag,FormError,date} from './academy-ui';

// Workspace-level recovery and assisted onboarding (BR-04). The identity check
// is a DUMMY checklist ticked by a workspace owner; nothing is sent anywhere.
const checks=[['cohort','They know their cohort'],['email','They know the email on the previous account'],['lastActivity','They know their last activity']] as const;
const tone=(s:string)=>s==='approved'?'success':'';
export default function RecoveryView(){
 const {team,go}=useAcademy();
 if(!team)return <><Head eyebrow="ACCOUNT RECOVERY" title="Recover access" body="Recovery works inside a shared workspace."/><section className="panel spacious"><KeyRound/><h2 className="mt">Your personal practice lab</h2><p className="mt">The personal lab belongs to the platform sign-in itself, so a workspace owner cannot re-link it. Open a shared workspace to request recovery there.</p><div className="actions"><Button onClick={()=>go('teams')}>Open shared workspaces</Button></div></section></>;
 return <RecoveryPage key={team.id}/>;
}
function RecoveryPage(){
 const {team,cmd,busy}=useAcademy(),rec=team.recovery??{mine:[],queue:[],canDecide:false,required:2},admin=!!rec.canDecide&&team.active;
 const [email,setEmail]=useWorkspaceDraft<string>('recovery-email',''),[cohort,setCohort]=useWorkspaceDraft<string>('recovery-cohort',''),[activity,setActivity]=useWorkspaceDraft<string>('recovery-activity',''),[note,setNote]=useWorkspaceDraft<string>('recovery-note','');
 const hasPending=rec.mine.some((r:any)=>r.status==='pending');
 return <><Head eyebrow="ACCOUNT RECOVERY" title="Recover access to your learning" body="Lost your old sign-in? Ask the workspace owner to move your learning to this account."/>
  <div className="notice"><ShieldCheck/><div><strong>Reviewed by a workspace owner · no email or message is sent.</strong><p>Your saved work and decisions move exactly as they are. Verification here is a simple owner checklist for this pilot, not strong identity proofing. Check back in this page for the outcome.</p></div></div>
  <FormError/>
  {team.active&&<section className="panel spacious mt"><h2>Request recovery</h2>
   <form onSubmit={async e=>{e.preventDefault();if(await cmd({type:'recovery-request',claimedEmail:email,cohortHint:cohort,activityHint:activity,note},'Recovery request saved for owner review')){setEmail('');setCohort('');setActivity('');setNote('')}}}>
    <div className="field"><label htmlFor="rec-email">Email on your previous account</label><input id="rec-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div>
    <div className="two-grid"><div className="field"><label htmlFor="rec-cohort">Cohort you remember (optional)</label><input id="rec-cohort" maxLength={100} value={cohort} onChange={e=>setCohort(e.target.value)}/></div><div className="field"><label htmlFor="rec-activity">Last thing you did (optional)</label><input id="rec-activity" maxLength={100} value={activity} onChange={e=>setActivity(e.target.value)}/></div></div>
    <div className="field"><label htmlFor="rec-note">Note for the owner (optional)</label><input id="rec-note" maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></div>
    <div className="actions"><Button type="submit" disabled={busy||hasPending||!email}>{hasPending?'Request awaiting review':'Submit recovery request'}</Button></div></form></section>}
  {rec.mine.length>0&&<section className="panel spacious mt"><h2>Your requests</h2>{rec.mine.map((r:any)=><div className="mt" key={r.id}><Tag tone={tone(r.status)}>{r.status}</Tag> <span className="form-hint">Filed {date(r.createdAt)}{r.reason?' · Owner note: '+r.reason:''}</span>{r.status==='pending'&&<Button className="mt" variant="outline" disabled={busy} onClick={()=>cmd({type:'recovery-withdraw',requestId:r.id},'Recovery request withdrawn')}>Withdraw</Button>}</div>)}</section>}
  {admin&&<><Queue rows={rec.queue}/><AssistedInvite/></>}
 </>;
}
function Queue({rows}:any){
 const {cmd,busy}=useAcademy(),[open,setOpen]=useState(''),[tick,setTick]=useState<Record<string,boolean>>({}),[reason,setReason]=useState('');
 const pick=(id:string)=>{setOpen(open===id?'':id);setTick({});setReason('')};
 return <section className="panel spacious mt"><div className="section-title no-top"><div><p className="eyebrow">OWNER REVIEW</p><h2>Recovery requests</h2></div></div>{!rows.length?<Empty icon={Users} title="No recovery requests" body="Requests from invited accounts appear here."/>:rows.map((r:any)=>{const n=checks.filter(([k])=>tick[k]).length,can=r.status==='pending'&&!r.isOwn;return <div className="mt" key={r.id} data-recovery-id={r.id}>
  <div className="discussion-meta"><Tag tone={tone(r.status)}>{r.status}</Tag><strong>{r.requesterName}</strong><span className="form-hint">claims {r.claimedEmail} · {date(r.createdAt)}</span></div>
  {r.candidate?<p className="form-hint">Matches member {r.candidate.name} ({r.candidate.recoverable?'recoverable learner':'not recoverable by this route'}) · {r.candidate.enrollmentCount} enrolment(s){r.candidate.cohorts.length?' in '+r.candidate.cohorts.join(', '):''}{r.candidate.lastActivityAt?' · last activity '+date(r.candidate.lastActivityAt):''}</p>:<p className="form-hint">No member matches that email. Decline unless you can explain it.</p>}
  <p className="form-hint">They remember: cohort {r.cohortHint||'not given'} · last activity {r.activityHint||'not given'}{r.note?' · '+r.note:''}</p>
  {r.decision&&<p className="form-hint">Decided by {r.decision.byName}: {r.decision.reason}{r.relink?` · moved ${r.relink.enrollments} enrolment(s) to the new account`:''}</p>}
  {r.isOwn&&r.status==='pending'&&<p className="form-hint">You filed this request, so another owner must decide it.</p>}
  {can&&<Button variant="outline" onClick={()=>pick(r.id)}>{open===r.id?'Close review':'Review'}</Button>}
  {can&&open===r.id&&<div className="mt"><fieldset><legend>Confirm at least {2} of 3 (pilot checklist)</legend>{checks.map(([k,l])=><label className="check-line" key={k}><Checkbox aria-label={l} checked={!!tick[k]} onCheckedChange={v=>setTick(t=>({...t,[k]:v===true}))}/>{l}</label>)}</fieldset>
   <div className="field"><label htmlFor={'rec-reason-'+r.id}>Decision reason (10–500 characters)</label><input id={'rec-reason-'+r.id} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></div>
   <div className="actions"><Button disabled={busy||n<2||reason.trim().length<10||!r.candidate?.recoverable} onClick={()=>cmd({type:'recovery-decide',requestId:r.id,decision:'approve',reason,reviewedVersion:r.version,checklist:{cohort:!!tick.cohort,email:!!tick.email,lastActivity:!!tick.lastActivity}},'Recovery approved; learning moved to the new account')}>Approve and move learning</Button><Button variant="outline" disabled={busy||reason.trim().length<10} onClick={()=>cmd({type:'recovery-decide',requestId:r.id,decision:'decline',reason,reviewedVersion:r.version,checklist:{cohort:!!tick.cohort,email:!!tick.email,lastActivity:!!tick.lastActivity}},'Recovery declined')}>Decline</Button></div></div>}
 </div>})}</section>;
}
function AssistedInvite(){
 const {cmd,busy}=useAcademy(),[email,setEmail]=useWorkspaceDraft<string>('assisted-email',''),[note,setNote]=useWorkspaceDraft<string>('assisted-note',''),[link,setLink]=useState('');
 async function create(){const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');if(await cmd({type:'invite',email,roles:['learner'],scopes:[],token,assistedNote:note},'Assisted invitation created. Nothing sent.')){setLink(location.origin+'/join?token='+token);setEmail('');setNote('')}}
 return <section className="panel spacious mt"><div className="section-title no-top"><div><p className="eyebrow">ASSISTED ONBOARDING</p><h2><UserPlus size={20}/> Invite someone who has no account yet</h2></div></div><p className="form-hint">Creates a normal seven-day learner invitation and records that you helped. Share the link with them yourself; nothing is sent.</p>
  <div className="two-grid"><div className="field"><label htmlFor="as-email">Their account email</label><input id="as-email" type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label htmlFor="as-note">Why you are assisting (10–300 characters)</label><input id="as-note" maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></div></div>
  <div className="actions"><Button disabled={busy||!email||note.trim().length<10} onClick={create}>Create assisted invitation</Button></div>{link&&<p className="form-hint pre-wrap">Share once: {link}</p>}</section>;
}
