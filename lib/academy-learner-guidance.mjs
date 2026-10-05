/** Presentational refinement of the real learnerNextAction result. No command,
 * permission, persistence, curriculum replacement or learner selection lives here.
 * @param {object} action A real learnerNextAction result, based on accepted own state.
 * @param {{mode:'personal'|'shared',contentAvailable?:boolean,canLearn?:boolean,offlineSeed?:boolean}} context
 */
export function refineNextUsefulStep(action,context){
 const result={...action},personal=context.mode==='personal';
 let help='',secondary=null;
 // Keep the existing gate priority, including pending review/appeal before lookup.
 // Missing content only adds an explanation and a real help destination below.
 switch(action.kind){
  case 'catalog':
   help=personal?'Open a pathway, read its fictional task, then choose Start this pathway when you are ready. An AI account is optional.':'Joining a workspace does not enroll you. Choose an open cohort before starting its pathway.';
   if(!personal&&context.canLearn===false){help='Your current membership can browse available learning but cannot enroll. Ask the owner about learner access.';secondary={label:'Ask about learner access',view:'support'};}
   else if(!personal){result.actionLabel='Find a cohort';result.view='teams';}
   break;
  case 'lesson':help='Save practice draft keeps your current text and quiz choices online. Complete lesson is a separate step after the checks.';break;
  case 'practical':help=personal?'Save draft keeps your response private in this lab. Submit evidence starts a labelled sample review.':'Save draft keeps your response private. Submit evidence makes its snapshot available to the staff account assigned to assess it.';break;
  case 'review':
   result.title=personal?'Your saved evidence is waiting for a sample review':'Your saved evidence is waiting for its assigned assessor';
   result.reason=personal?'This personal lab uses sample staff roles. Your submitted words are retained, and another submission is not needed.':'Your submitted words are retained. The workspace owner assigns an assessor; another submission is not needed while review is pending.';
   help=personal?'Open Review studio to practise the sample review workflow.':'Open Feedback to see the submission and any saved review decision.';
   if(personal)secondary={label:'Open sample Review studio',view:'studio'};
   break;
  case 'appeal':
   result.title=personal?'Your sample appeal is waiting for review':'Your appeal is waiting for an independent reviewer';
   result.reason=personal?'Your original decision and submitted words remain in history. Finish the sample appeal before another attempt.':'Your original decision and submitted words remain in history. A separately assigned reviewer handles the appeal before another attempt.';
   if(personal)secondary={label:'Open sample Review studio',view:'studio'};
   break;
  case 'revise':help='Read the feedback before editing. Your earlier submission and decision stay in history; saving a draft does not replace them.';break;
  case 'paused':help='Learning actions wait while the content or cohort is reviewed. You can keep your own saved work and ask for help.';secondary={label:'Ask about paused learning',view:'support'};break;
  case 'unavailable':help='Keep your own saved edition. A missing course is not replaced with a newer one.';secondary={label:'Ask about this saved edition',view:'support'};break;
  case 'support':help='Read the latest feedback and any appeal option before choosing your next step.';secondary={label:'Ask for learning support',view:'support'};break;
  case 'history':help='Only your own retained learning is shown. A work-context preference does not restore access or grant a role.';break;
  case 'reflection':help='Your reflection is your own account of a permitted task; it is not proof of job competence or measured impact.';break;
  case 'practice':help='This is your private plan. Marking practice complete is self-reported and does not complete a course.';break;
 }
 if(action.enrollmentId&&context.contentAvailable===false){
  help+=' Your saved course edition cannot open. Your own work is retained; a newer course will not replace it. Preferences & privacy can export your own learning.';
  secondary={label:'Help with my saved edition',view:'support'};
 }
 if(!secondary&&personal&&context.offlineSeed===true&&context.canLearn!==false&&!action.blocked&&['lesson','practical'].includes(action.kind)){
  secondary={label:'Prepare for a connection gap',view:'offline'};
  help+=' Offline practice starts with an online access check; its notes stay unsent until a separate save.';
 }
 return {action:result,help,secondary};
}

/** Compare only explicit current-input keys. Returns no text, answers or field names.
 * Matching is a comparison to the last accepted saved copy, never an optimistic ack.
 * @param {{local:Record<string,unknown>,saved:Record<string,unknown>,keys:string[],hasSavedDraft:boolean,pending?:boolean,accepted?:boolean,saveLabel:string}} input
 */
export function ownDraftSaveNotice(input){
 if(input.pending)return {kind:'pending',message:'Saving your action. Keep this screen open until the save finishes.'};
 if(input.accepted===false)return {kind:'unknown',message:'The saved copy cannot be confirmed here. Keep your text and refresh saved progress before another action.'};
 if(!Array.isArray(input.keys)||!input.keys.length)return {kind:'unknown',message:'Choose a saved activity before checking this draft.'};
 if(!input.hasSavedDraft)return {kind:'new',message:`This activity has no saved online draft yet. ${input.saveLabel} keeps the current draft; typing alone does not save it.`};
 const equal=input.keys.every(key=>{
  const local=Object.hasOwn(input.local,key)?input.local[key]:'';
  const saved=Object.hasOwn(input.saved,key)?input.saved[key]:'';
  return JSON.stringify(local)===JSON.stringify(saved);
 });
 return equal?{kind:'matching',message:'This screen matches the last accepted saved draft. Saving a draft does not complete a lesson or submit evidence.'}:{kind:'changed',message:`Changes on this screen differ from the last accepted saved draft. ${input.saveLabel} keeps them online.`};
}
