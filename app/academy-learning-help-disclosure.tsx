'use client';
import {useState,useId} from 'react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {readAccessPreferences} from '@/lib/academy-inclusive-learning';
import {appendOwnLearningHelpDescription,ownSelectedLearningHelpCourse} from '@/lib/academy-content-readiness-adoption.mjs';
import {useAcademy} from './academy-context';
import {Pick} from './academy-ui';

const languageName=(tag:string)=>{try{return (new Intl.DisplayNames(['en'],{type:'language'}).of(tag)??tag)+' ('+tag+')'}catch{return tag}};
const assistanceNames={none:'No help requested', 'read-text':'Help reading the lesson', 'capture-response':'Help capturing my own response'};

/** Inside ordinary requester Intake only. Scope/input key changes remount all
 * disclosure choices; nothing here opens a request, changes its title/category/
 * cohort, copies evidence, grants helper access or changes the saved preference. */
export function OwnLearningHelpDisclosure({cohortId,currentBody,subject,category,audienceKey,disabled,onAppend,onIntentChange}:{cohortId:string;currentBody:string;subject:string;category:string;audienceKey:string;disabled:boolean;onAppend:(body:string)=>void;onIntentChange:()=>void}){
 const {state,accountKey,activeWorkspace,resolvePinned}=useAcademy();
 let preferences;try{preferences=readAccessPreferences(state.learningAccess)}catch{return <p className="form-hint">Saved learning-help preferences need a format check. You can describe your request yourself.</p>}
 const ownCourseScope=state.enrollments.filter((e:any)=>e.cohortId===cohortId).map((e:any)=>{let pinned;try{pinned=resolvePinned(e)}catch{}return [e.id,e.contentRef??e.version,e.withdrawn,pinned?.available?[pinned.snapshot.ref,pinned.snapshot.program.title,pinned.snapshot.language]:'unavailable'];});
 const key=JSON.stringify([accountKey,activeWorkspace,preferences,cohortId,ownCourseScope,currentBody,subject,category,audienceKey]);
 return <OwnLearningHelpDisclosureBody key={key} preferences={preferences} cohortId={cohortId} currentBody={currentBody} disabled={disabled} onAppend={onAppend} onIntentChange={onIntentChange}/>;
}
function OwnLearningHelpDisclosureBody({preferences,cohortId,currentBody,disabled,onAppend,onIntentChange}:any){
 const {state,team,resolvePinned}=useAcademy(),id=useId(),[enrollmentId,setEnrollmentId]=useState(''),[choices,setChoices]=useState({includeRequestedLanguage:false,includeAssistancePreference:false,includeCourse:false}),[error,setError]=useState('');
 const enrollments=state.enrollments.filter((e:any)=>e.cohortId===cohortId&&!e.withdrawn),course=ownSelectedLearningHelpCourse({enrollments:state.enrollments,cohorts:team.cohorts,cohortId,enrollmentId,resolvePinned});
 const toggle=(key:keyof typeof choices,value:boolean)=>{onIntentChange();setError('');setChoices(c=>({...c,[key]:value}));};
 return <details className="source-packet mt"><summary>Add saved learning-help details (optional)</summary><section aria-labelledby={id+'-title'}><h3 id={id+'-title'} className="mt">Choose what to add to this description</h3><p id={id+'-help'} className="form-hint">These are your own saved requests, not approved translations or accommodations. Choices start unchecked. Preparing adds only to your unsent description; review its audience before submitting.</p>
  <label className="check-line"><Checkbox disabled={disabled} aria-describedby={id+'-help'} checked={choices.includeRequestedLanguage} onCheckedChange={v=>toggle('includeRequestedLanguage',v===true)}/>Include my requested learning language: {languageName(preferences.preferredLanguage)}</label>
  <label className="check-line"><Checkbox disabled={disabled} checked={choices.includeAssistancePreference} onCheckedChange={v=>toggle('includeAssistancePreference',v===true)}/>Include my saved help request: {assistanceNames[preferences.assistancePreference as keyof typeof assistanceNames]}.</label>
  {enrollments.length>0&&<div className="field"><label>My saved course in this selected cohort</label><Pick label="My saved course in this selected cohort" value={enrollmentId} disabled={disabled} onChange={(value:string)=>{onIntentChange();setEnrollmentId(value);setChoices(c=>({...c,includeCourse:false}));setError('');}} options={enrollments.map((e:any)=>{let result;try{result=resolvePinned(e)}catch{}return {value:e.id,label:result?.available?result.snapshot.program.title:'Saved course edition unavailable'}})}/></div>}
  {course&&<label className="check-line"><Checkbox disabled={disabled} checked={choices.includeCourse} onCheckedChange={v=>toggle('includeCourse',v===true)}/>Include this saved course title and language: {course.title} · {languageName(course.language)}</label>}
  {!course&&<p className="form-hint">{cohortId==='workspace'?'Choose a cohort and then your own saved course if you want to include course details.':enrollmentId?'This exact selected course edition cannot be confirmed. No other course will replace it.':'Select your own saved course explicitly to include its title and language.'}</p>}
  {error&&<p role="alert" className="form-hint">{error}</p>}<Button type="button" variant="outline" className="mt" disabled={disabled} onClick={()=>{try{const result=appendOwnLearningHelpDescription({currentBody,preferences,course,choices});onIntentChange();setError('');onAppend(result.body);}catch(e){setError(e instanceof Error?e.message:'Review what to include before trying again.');}}}>Add chosen details to my unsent description</Button><p className="form-hint">Existing title, category and cohort stay as you chose them. No request is sent or saved by this step. The 2,000-character description limit applies without truncating your text.</p>
 </section></details>;
}
