'use client';
import {useReducer,useState,useEffect} from 'react';
import {ShieldCheck,UserCheck,Info,CheckCircle2,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import curriculum from '@/lib/academy-curriculum';
import {PLAN_GOALS} from '@/lib/academy-plan';
import {useAcademy,AcademyContext} from './academy-context';
import styles from './academy-onboarding.module.css';
import {ONBOARDING_STEPS,ONBOARDING_CONTEXTS,CONTEXT_LABELS,GOAL_LABELS,WEEKLY_MINUTE_CHOICES,READ_ALOUD_CHOICES,ASSISTANCE_CHOICES,CHANGE_ANYTIME_NOTE,LANGUAGE_PIN_NOTE,DIRECT_ACCOUNT,INVITE_COPY,JOIN_SUCCESS,STAFF_VISIBILITY,REGISTRATION_EXTERNAL_NOTE,languageOptions,initialAnswers,startFlow,flowReducer,stepNumber,answersProblem,completeCommand,skipCommand,classifyInvitationResponse,inviteSummary,type InviteState} from '@/lib/academy-onboarding';

const stepTitles:Record<string,string>={role:'Who you are learning for',goal:'What you want to achieve',access:'Language and help'};

/** Skippable first-run setup (max three short steps). Re-openable from Preferences with mode="reopen". */
export function OnboardingFlow({mode,onClose}:{mode:'first-run'|'reopen';onClose:()=>void}){
 const {state,cmd,busy,platformName}=useAcademy();
 const [flow,dispatch]=useReducer(flowReducer,undefined,()=>startFlow(initialAnswers(state,platformName)));
 const [problem,setProblem]=useState('');
 const a=flow.answers,set=(patch:any)=>dispatch({type:'set',patch}),languages=languageOptions(['en',curriculum.language]);
 useEffect(()=>{document.getElementById('onboarding-heading')?.focus()},[flow.step]);
 async function finish(){const p=answersProblem(a);if(p){setProblem(p);return}setProblem('');if(await cmd(completeCommand(a),'Preferences saved'))dispatch({type:'finish'})}
 async function skip(){if(await cmd(skipCommand,'Setup skipped. You can set it up anytime in Preferences.'))dispatch({type:'skip'})}
 if(flow.step==='done')return <section className={styles.flow} aria-labelledby="onboarding-heading"><CheckCircle2/><h2 id="onboarding-heading" tabIndex={-1} className="mt">{flow.outcome==='completed'?'Your preferences are saved':'Setup skipped'}</h2><p className="mt">{CHANGE_ANYTIME_NOTE}</p><div className={styles.actions}><Button onClick={onClose}>{mode==='first-run'?'Go to my overview':'Done'}</Button></div></section>;
 const n=stepNumber(flow),last=flow.step==='access';
 return <section className={styles.flow} aria-labelledby="onboarding-heading" data-onboarding-step={flow.step}>
  <div className={styles.top}><div><p className={styles.step}>{mode==='first-run'?'WELCOME · ':'SET UP AGAIN · '}STEP {n} OF {ONBOARDING_STEPS.length}</p><div className={styles.dots} aria-hidden="true">{ONBOARDING_STEPS.map((s,i)=><i key={s} data-on={i<n}/>)}</div></div><Button variant="outline" disabled={busy} onClick={mode==='first-run'?skip:onClose}>{mode==='first-run'?'Skip for now':'Close'}</Button></div>
  <h2 id="onboarding-heading" tabIndex={-1}>{stepTitles[flow.step]}</h2>
  {flow.step==='role'&&<>
   {mode==='first-run'&&<div className={styles.created}><strong><UserCheck size={18}/> {DIRECT_ACCOUNT.title}</strong><p>{DIRECT_ACCOUNT.body}</p><ul>{DIRECT_ACCOUNT.scope.map(s=><li key={s}>{s}</li>)}</ul><p className="form-hint">{DIRECT_ACCOUNT.external}</p></div>}
   <div className="field mt"><label htmlFor="onb-name">Display name</label><input id="onb-name" className={styles.text} value={a.name} maxLength={80} onChange={e=>set({name:e.target.value})}/></div>
   <fieldset className={styles.group}><legend>Your main work context</legend>{ONBOARDING_CONTEXTS.map(c=><label key={c} className={styles.choice}><input type="radio" name="onb-context" checked={a.context===c} onChange={()=>set({context:c})}/><span>{CONTEXT_LABELS[c]}</span></label>)}</fieldset></>}
  {flow.step==='goal'&&<>
   <fieldset className={styles.group}><legend>Choose one goal</legend>{PLAN_GOALS.map(g=><label key={g} className={styles.choice}><input type="radio" name="onb-goal" checked={a.goal===g} onChange={()=>set({goal:g})}/><span>{GOAL_LABELS[g]}</span></label>)}</fieldset>
   <fieldset className={styles.group}><legend>Time you can plan each week</legend><div className={styles.minutes}>{WEEKLY_MINUTE_CHOICES.map(m=><label key={m} className={styles.choice}><input type="radio" name="onb-minutes" checked={a.weeklyMinutes===m} onChange={()=>set({weeklyMinutes:m})}/><span>{m} minutes</span></label>)}</div></fieldset>
   <p className="form-hint">Planned minutes describe your intention, not verified time spent.</p></>}
  {flow.step==='access'&&<>
   <fieldset className={styles.group}><legend>Language</legend>{languages.map(l=><label key={l.value} className={styles.choice}><input type="radio" name="onb-language" checked={a.preferredLanguage===l.value} onChange={()=>set({preferredLanguage:l.value})}/><span>{l.label}<small>{l.note}</small></span></label>)}<p className="form-hint">{LANGUAGE_PIN_NOTE}</p></fieldset>
   <fieldset className={styles.group}><legend>Read aloud</legend>{READ_ALOUD_CHOICES.map(r=><label key={r.value} className={styles.choice}><input type="radio" name="onb-read" checked={a.readAloudMode===r.value} onChange={()=>set({readAloudMode:r.value})}/><span>{r.label}</span></label>)}</fieldset>
   <fieldset className={styles.group}><legend>Help with reading or writing</legend>{ASSISTANCE_CHOICES.map(r=><label key={r.value} className={styles.choice}><input type="radio" name="onb-assist" checked={a.assistancePreference===r.value} onChange={()=>set({assistancePreference:r.value})}/><span>{r.label}</span></label>)}</fieldset>
   <label className={styles.choice}><input type="checkbox" checked={a.reading} onChange={e=>set({reading:e.target.checked})}/><span>Comfortable reading mode<small>Larger text and a narrower reading area.</small></span></label></>}
  <p className={styles.note}><Info size={18}/><span>{CHANGE_ANYTIME_NOTE}</span></p>
  {problem&&<p role="alert" className={styles.problem}>{problem}</p>}
  <div className={styles.actions}>{n>1&&<Button variant="outline" disabled={busy} onClick={()=>dispatch({type:'back'})}>Back</Button>}{last?<Button disabled={busy} onClick={finish}>Save and finish</Button>:<Button disabled={busy||(flow.step==='role'&&!a.name.trim())} onClick={()=>dispatch({type:'next'})}>Next</Button>}</div>
 </section>;
}

/** Partner route: explains an invitation, then links the signed-in account to a workspace membership. */
export function JoinInvitation({token,onDone}:{token:string;onDone:()=>void}){
 const {teamCmd,busy}=useAcademy();
 const [view,setView]=useState<{state:InviteState|'loading';data?:any}>({state:'loading'}),[joined,setJoined]=useState<any>(null);
 useEffect(()=>{let alive=true;setView({state:'loading'});fetch('/api/teams?invite='+encodeURIComponent(token),{cache:'no-store'}).then(async r=>{let d:any=null;try{d=await r.json()}catch{}if(alive)setView({state:classifyInvitationResponse(r.status,d),data:d})}).catch(()=>{if(alive)setView({state:'error'})});return()=>{alive=false}},[token]);
 const inv=view.data?.invitation,s=inviteSummary(inv);
 async function accept(){if(await teamCmd({type:'accept',token},'Workspace membership accepted',{teamId:inv.workspaceId,revision:view.data.revision}))setJoined(s)}
 const dismiss=()=>{onDone();history.replaceState(null,'','/#teams')};
 if(joined)return <section className={`panel ${styles.join}`} aria-live="polite"><CheckCircle2/><p className="eyebrow mt">INVITATION ACCEPTED</p><h2>{JOIN_SUCCESS.title}: {joined.workspace}</h2><p className="mt">{JOIN_SUCCESS.body}</p><p className="mt">Your role: {joined.roles.join(' · ')||'Learner'}</p><div className={styles.actions}>{joined.deepLink&&<a className="text-button" href={joined.deepLink} onClick={onDone}>{JOIN_SUCCESS.open}</a>}</div></section>;
 return <section className={`panel ${styles.join}`} aria-live="polite"><p className="eyebrow">INVITATION TO LEARN TOGETHER</p>
  {view.state==='loading'?<p className="mt">Checking this invitation for your signed-in account…</p>:view.state==='ready'||view.state==='already-joined'?<>
   <h2 className="mt">{view.state==='already-joined'?INVITE_COPY['already-joined'].title:s.workspace}</h2>
   {view.state==='ready'&&<p className="mt">You are invited to <strong>{s.workspace}</strong>{inv.purpose?`: ${inv.purpose}`:''}</p>}
   <p className="mt">Signed-in account: <strong>{inv.recipientEmail}</strong>. Your platform sign-in becomes a membership here; no new password is created.</p>
   <p className="mt"><strong>Your role{s.roles.length===1?'':'s'}:</strong> {s.roles.join(' · ')||'Learner'}</p><ul className="mt">{s.abilities.map((x:any)=><li key={x.role}><strong>{x.role}.</strong> {x.text}</li>)}</ul>
   <p className="mt">{s.cohortLine}</p>{s.assistedNote&&<p className="mt"><strong>Note from the owner:</strong> {s.assistedNote}</p>}
   <p className="form-hint">Expires {new Date(inv.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}. {REGISTRATION_EXTERNAL_NOTE}</p>
   <div className={styles.two}><div><strong><Users size={16}/> Staff in this workspace can see</strong><ul>{STAFF_VISIBILITY.can.map(x=><li key={x}>{x}</li>)}</ul></div><div><strong><ShieldCheck size={16}/> Staff cannot see</strong><ul>{STAFF_VISIBILITY.cannot.map(x=><li key={x}>{x}</li>)}</ul></div></div>
   <div className={styles.actions}><Button disabled={busy} onClick={view.state==='already-joined'?()=>{onDone();location.assign(s.deepLink??'/#teams')}:accept}>{view.state==='already-joined'?JOIN_SUCCESS.open:'Accept membership'}</Button><Button variant="outline" onClick={dismiss}>Dismiss invitation</Button></div></>
  :<><h2 className="mt">{INVITE_COPY[view.state as InviteState].title}</h2><p role="alert" className="mt">{INVITE_COPY[view.state as InviteState].body}</p><div className={styles.actions}><Button variant="outline" onClick={dismiss}>Dismiss invitation</Button></div></>}
 </section>;
}

/** The shared-workspace screen keeps its own list; the invitation itself is explained once, by JoinInvitation. */
export function WithoutInvitation({children}:{children:React.ReactNode}){const ctx=useAcademy();return <AcademyContext.Provider value={{...ctx,invitationToken:''}}>{children}</AcademyContext.Provider>}
