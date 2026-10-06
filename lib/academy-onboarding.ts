/** First-run onboarding, direct-account scope text and partner-invitation states. Pure: no network, storage or React.
 * Saves go through the existing profile, learning-plan and learning-access-preferences actions (the `onboarding`
 * engine action only composes them, all or nothing). Real email/OTP/SSO registration is external (BASELINE open item). */
import {PLAN_GOALS,type PlanGoal} from './academy-plan';

export const ONBOARDING_CONTEXTS=['farmer','msme','public'] as const;
export const ONBOARDING_STEPS=['role','goal','access'] as const;
export type OnboardingStep=typeof ONBOARDING_STEPS[number];
export type OnboardingMark='completed'|'skipped';
export const WEEKLY_MINUTE_CHOICES=[30,60,90,120] as const;
export const CHANGE_ANYTIME_NOTE='You can change this anytime in Preferences & privacy.';
export const GOAL_LABELS:Record<PlanGoal,string>={explore:'Explore a useful skill',records:'Keep better work records','check-draft':'Check an AI draft carefully','clear-response':'Write a clearer response','expert-questions':'Prepare questions for an expert'};
export const CONTEXT_LABELS:Record<typeof ONBOARDING_CONTEXTS[number],string>={farmer:'Farmer',msme:'MSME owner',public:'Public servant'};
export const READ_ALOUD_CHOICES=[{value:'off',label:'Off'},{value:'ask',label:'Offer read-aloud on lessons (when my browser supports it)'}] as const;
export const ASSISTANCE_CHOICES=[{value:'none',label:'No extra help needed'},{value:'read-text',label:'Someone may read text to me'},{value:'capture-response',label:'Someone may write down my spoken response'}] as const;
export const HINDI_NOTICE='Hindi draft available for one pathway';
export const HINDI_UNAVAILABLE_NOTICE='Hindi is saved as a request only. No Hindi edition is in this release yet.';

export type OnboardingProfile={name:string;context:string;reading:boolean;networking:boolean;onboarding?:string};
export type OnboardingAnswers={name:string;context:string;reading:boolean;goal:string;weeklyMinutes:number;preferredLanguage:string;readAloudMode:string;assistancePreference:string};

/** Only languages the shipped content supports honestly. Selecting one never changes a pinned course version. */
export function languageOptions(contentLanguages:readonly string[]=['en']):{value:string;label:string;note:string}[]{
 const has=(l:string)=>contentLanguages.some(x=>x.toLowerCase().split('-')[0]===l);
 return [{value:'en',label:'English',note:'All current pathways are available in English.'},{value:'hi',label:'Hindi · हिन्दी',note:has('hi')?HINDI_NOTICE:HINDI_UNAVAILABLE_NOTICE}];
}
export const LANGUAGE_PIN_NOTE='Choosing a language never changes the course version you are already learning. Your saved work stays on its original version.';

/** Old saved states have no marker; established learners are never interrupted, but may still open setup from Preferences. */
export function onboardingStatus(profile:OnboardingProfile|undefined,established=false):'pending'|'completed'|'skipped'|'established'{
 const m=profile?.onboarding;
 if(m==='completed'||m==='skipped')return m;
 return established?'established':'pending';
}
export function isEstablished(state:{profile?:{name?:string};enrollments?:unknown[];learningPlan?:{tasks?:unknown[]}}):boolean{
 return (state.enrollments?.length??0)>0||(state.learningPlan?.tasks?.length??0)>0||(!!state.profile?.name&&state.profile.name!=='Learner');
}
/** First-run setup shows only on the personal Overview, never while an invite or deep link is being followed. */
export function shouldShowOnboarding(o:{state:any;workspace:string;view:string;viaInvitation:boolean;deepLinked:boolean;dismissedThisVisit?:boolean}):boolean{
 if(o.workspace!=='lab'||o.view!=='home'||o.viaInvitation||o.deepLinked||o.dismissedThisVisit)return false;
 return onboardingStatus(o.state?.profile,isEstablished(o.state??{}))==='pending';
}

export type OnboardingFlow={step:OnboardingStep|'done';answers:OnboardingAnswers;outcome:OnboardingMark|null};
export function initialAnswers(state:any,platformName?:string|null):OnboardingAnswers{
 const profile=state?.profile??{},plan=state?.learningPlan??{},access=state?.learningAccess??{};
 const name=profile.name&&profile.name!=='Learner'?profile.name:(platformName&&platformName.trim()?platformName.trim().slice(0,80):profile.name||'Learner');
 return {name,context:ONBOARDING_CONTEXTS.some(c=>c===profile.context)?profile.context:'msme',reading:!!profile.reading,goal:PLAN_GOALS.some(g=>g===plan.goal)?plan.goal:'explore',weeklyMinutes:typeof plan.weeklyMinutes==='number'?plan.weeklyMinutes:60,preferredLanguage:access.preferredLanguage==='hi'?'hi':'en',readAloudMode:access.readAloudMode==='ask'?'ask':'off',assistancePreference:['read-text','capture-response'].includes(access.assistancePreference)?access.assistancePreference:'none'};
}
export function startFlow(answers:OnboardingAnswers):OnboardingFlow{return {step:'role',answers,outcome:null}}
export type FlowAction={type:'next'}|{type:'back'}|{type:'skip'}|{type:'set';patch:Partial<OnboardingAnswers>}|{type:'finish'};
export function stepNumber(flow:OnboardingFlow):number{return flow.step==='done'?ONBOARDING_STEPS.length:ONBOARDING_STEPS.indexOf(flow.step)+1}
export function flowReducer(flow:OnboardingFlow,a:FlowAction):OnboardingFlow{
 if(flow.step==='done')return flow;
 switch(a.type){
  case 'set':return {...flow,answers:{...flow.answers,...a.patch}};
  case 'next':{const i=ONBOARDING_STEPS.indexOf(flow.step);return i>=ONBOARDING_STEPS.length-1?flow:{...flow,step:ONBOARDING_STEPS[i+1]}}
  case 'back':{const i=ONBOARDING_STEPS.indexOf(flow.step);return i<=0?flow:{...flow,step:ONBOARDING_STEPS[i-1]}}
  case 'skip':return {...flow,step:'done',outcome:'skipped'};
  case 'finish':return flow.step==='access'?{...flow,step:'done',outcome:'completed'}:flow;
 }
}
export function answersProblem(a:OnboardingAnswers):string|null{
 if(!a.name.trim()||a.name.length>80)return 'Enter a display name of up to 80 characters.';
 if(!ONBOARDING_CONTEXTS.some(c=>c===a.context))return 'Choose your main work context.';
 if(!PLAN_GOALS.some(g=>g===a.goal))return 'Choose one learning goal.';
 if(!(WEEKLY_MINUTE_CHOICES as readonly number[]).includes(a.weeklyMinutes))return 'Choose a weekly learning time.';
 if(!languageOptions(['en','hi']).some(l=>l.value===a.preferredLanguage))return 'Choose English or Hindi.';
 return null;
}
/** The single composed command sent for a finished flow. */
export function completeCommand(a:OnboardingAnswers){return {type:'onboarding',outcome:'completed',name:a.name.trim(),context:a.context,reading:a.reading,goal:a.goal,weeklyMinutes:a.weeklyMinutes,preferredLanguage:a.preferredLanguage,readAloudMode:a.readAloudMode,assistancePreference:a.assistancePreference} as const}
export const skipCommand={type:'onboarding',outcome:'skipped'} as const;
/** The same result by hand with the three existing actions, in the order the engine applies them. */
export function handCommands(a:OnboardingAnswers,networking:boolean){return [{type:'profile',name:a.name.trim(),context:a.context,reading:a.reading,networking,onboarding:'completed'},{type:'learning-plan',goal:a.goal,weeklyMinutes:a.weeklyMinutes},{type:'learning-access-preferences',preferredLanguage:a.preferredLanguage,readAloudMode:a.readAloudMode,assistancePreference:a.assistancePreference}]}

/** Direct route: the first sign-in lands in setup and creates the Academy profile. */
export const DIRECT_ACCOUNT={
 title:'Account created: your Academy profile',
 body:'You signed in with the platform, so your private Academy profile now exists. Your display name starts from your platform name and you can edit it below.',
 scope:['Your Academy profile is a private workspace for you: display name, work context, learning plan, preferences, progress, drafts and records.','It is not a separate login. Sign-in, email verification and passwords are handled by the platform, outside the Academy.','Joining a shared workspace later adds a membership to this same profile. It does not copy your private practice into it.'],
 external:'Real email, one-time-code or single sign-on registration is provided by the platform, not by the Academy.'
};

export type InviteState='ready'|'already-joined'|'unavailable'|'closed'|'issuer-lost'|'removed'|'invalid-link'|'error';
/** Maps the invitation API response to a state. Unknown token and wrong account both land on `unavailable` so no email ownership is revealed. */
export function classifyInvitationResponse(status:number,body:any):InviteState{
 if(status>=200&&status<300)return body?.invitation?.status==='accepted'?'already-joined':'ready';
 const msg=String(body?.error??'');
 if(status===400)return 'invalid-link';
 if(status===404)return 'unavailable';
 if(status===403)return 'removed';
 if(status===409)return /issuer/i.test(msg)?'issuer-lost':'closed';
 return 'error';
}
export const INVITE_COPY:Record<InviteState,{title:string;body:string}>={
 ready:{title:'You are invited to join a workspace',body:'Review what joining means, then accept.'},
 'already-joined':{title:'You have already joined this workspace',body:'Your membership is active. Open the workspace to continue.'},
 unavailable:{title:'This invitation is unavailable for your account',body:'The link may be wrong, or it may have been created for a different sign-in account. Sign in with the account the owner invited, or ask the owner for a new link.'},
 closed:{title:'This invitation can no longer be used',body:'It has expired, was withdrawn by the owner, or has already been used. Ask the workspace owner for a new link.'},
 'issuer-lost':{title:'This invitation needs a new link',body:'The person who created it no longer manages this workspace. Ask a current owner for a new link.'},
 removed:{title:'An invitation cannot restore removed access',body:'Your access to this workspace was removed. Ask a workspace owner to restore your membership.'},
 'invalid-link':{title:'This invitation link is not valid',body:'Check that the whole link was copied, or ask the owner to send it again.'},
 error:{title:'We could not check this invitation',body:'Nothing was changed. Check your connection and try again.'}
};
export const INVITE_DENIED_STATES:readonly InviteState[]=['unavailable','closed','issuer-lost','removed','invalid-link','error'];

const ROLE_NAMES:Record<string,string>={admin:'Workspace owner',learner:'Learner',facilitator:'Facilitator',assessor:'Assessor',reviewer:'Appeal reviewer',moderator:'Moderator'};
const ROLE_ABILITIES:Record<string,string>={admin:'Manage members, cohorts and assignments. No automatic access to evidence.',learner:'Enroll in cohorts, practise, submit your own evidence and join cohort discussions.',facilitator:'See progress summaries for the cohorts you are given.',assessor:'Review only the submissions assigned to you.',reviewer:'Resolve only appeals assigned to you, independently of the learner and assessor.',moderator:'Read reports and publish or hide discussion in the cohorts you are given.'};
export function inviteSummary(inv:any){
 const roles:string[]=Array.isArray(inv?.roles)?inv.roles.filter((r:any)=>typeof r==='string'):[];
 const cohorts:string[]=Array.isArray(inv?.scopes)?inv.scopes.filter((r:any)=>typeof r==='string'):[];
 return {
  workspace:typeof inv?.workspaceName==='string'?inv.workspaceName:'A shared workspace',
  roles:roles.map(r=>ROLE_NAMES[r]??r),
  abilities:roles.map(r=>({role:ROLE_NAMES[r]??r,text:ROLE_ABILITIES[r]??'Role-specific access set by the workspace owner.'})),
  cohorts,
  cohortLine:cohorts.length?'Cohorts: '+cohorts.join(' · '):'No specific cohort is attached. Joining does not enroll you or reserve a seat.',
  assistedNote:typeof inv?.assistedNote==='string'&&inv.assistedNote.trim()?inv.assistedNote.trim().slice(0,500):null,
  deepLink:typeof inv?.workspaceId==='string'?'/?workspace='+encodeURIComponent(inv.workspaceId)+'#teams':null
 };
}
export const STAFF_VISIBILITY={
 can:['Your display name, sign-in email and role in this workspace.','Progress summaries for the cohorts a facilitator or the owner runs.','Your submitted evidence and attempts, only for the assessor or reviewer assigned to you.','Your posts and replies in cohort discussions.'],
 cannot:['Your personal practice lab: drafts, reflections, learning plan and preferences.','Your other workspaces or anything you did before joining.','Evidence for staff who are not assigned to you. Owners have no automatic access to it.']
};
export const JOIN_SUCCESS={title:'You have joined the workspace',body:'Your sign-in is linked to a membership. Joining does not enroll you in a cohort.',open:'Open my workspace'};
export const REGISTRATION_EXTERNAL_NOTE='Registration by email, one-time code or single sign-on is provided by the platform. The Academy links your existing sign-in to a workspace membership.';
