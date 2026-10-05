'use client';
import {CalendarDays,Clock} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {LearnerNextAction} from '@/lib/academy-plan';
import {useAcademy} from './academy-context';
import {refineNextUsefulStep,ownDraftSaveNotice} from '@/lib/academy-learner-guidance.mjs';

/** Existing NextActionCard passes its actual action and resolved pin here.
 * No dependency back to academy-plan.tsx: avoid a component import cycle.
 * Replace that card's render, never add another Overview card.
 */
export function NextUsefulStep({next,context,location='overview'}:{next:LearnerNextAction;context:{mode:'personal'|'shared';contentAvailable?:boolean;canLearn?:boolean;offlineSeed?:boolean};location?:'overview'|'plan'}){
 const {go}=useAcademy();
 const guided=refineNextUsefulStep(next,context);
 const action=guided.action;
 return <section className="panel next-action"><p className="eyebrow">YOUR NEXT USEFUL STEP</p><h2>{action.title}</h2><p className="mt">{action.reason}</p>{guided.help&&<p className="form-hint">{guided.help}</p>}{action.estimatedMinutes&&<small className="line-item mt"><Clock aria-hidden="true" size={16}/>About {action.estimatedMinutes} minutes</small>}<div className="actions"><Button onClick={()=>go(action.view,action.programId??'',{tab:action.tab,lessonId:action.lessonId})}>{action.actionLabel}</Button>{guided.secondary&&<Button variant="outline" onClick={()=>go(guided.secondary!.view)}>{guided.secondary.label}</Button>}{location==='overview'&&action.view!=='plan'&&<Button variant="outline" onClick={()=>go('plan')}><CalendarDays aria-hidden="true" size={17}/>My learning plan</Button>}</div><p className="form-hint">Based on your saved learning and private plan.</p></section>;
}

/** Beside the existing Save button, not a global claim about all learner work. */
export function OwnDraftSaveNotice({local,saved,keys,hasSavedDraft,saveLabel}:{local:Record<string,unknown>;saved:Record<string,unknown>;keys:string[];hasSavedDraft:boolean;saveLabel:string}){
 const {saving,loading}=useAcademy();
 const status=ownDraftSaveNotice({local,saved,keys,hasSavedDraft,saveLabel,pending:saving,accepted:!loading});
 return <p className="form-hint" role="status" aria-live="polite" aria-atomic="true">{status.message}</p>;
}
