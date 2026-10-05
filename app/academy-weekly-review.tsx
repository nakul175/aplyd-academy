'use client';
import {useId,useState} from 'react';
import {Button} from '@/components/ui/button';
import {deriveOwnWeeklyReview,prepareOwnWeeklyRecap,renderOwnWeeklyRecapHtml} from '@/lib/academy-weekly-review.mjs';
import {download} from './academy-download';
import {useAcademy,focusOperationItem} from './academy-context';
import {Tag} from './academy-ui';
import styles from './academy-weekly-review.module.css';

function localHtml(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/html;charset=utf-8'}));try{const a=document.createElement('a');a.href=url;a.download=name;a.click();}finally{URL.revokeObjectURL(url);}}
/** Replaces the existing combined weekly stats and explanation. No extra
 * dashboard or saved state. Props are the already projected own summary. */
export function OwnWeeklyReview({summary,observedAt}:any){
 const {accountKey,activeWorkspace,team,loading,saving,error}=useAcademy(),id=useId(),[exportError,setExportError]=useState('');
 const review=deriveOwnWeeklyReview(summary,observedAt);
 const accepted=!!accountKey&&!loading&&!error&&(activeWorkspace==='lab'?team===null:team?.id===activeWorkspace&&team.currentUserId===accountKey);
 if(!review)return <section className={'panel '+styles.review}><h2>Your weekly recap needs a check</h2><p className="form-hint">Your plan and course evidence remain in their existing views. Refresh saved learning before using a recap.</p></section>;
 const exportRecap=(format:'json'|'html')=>{if(!accepted||saving)return;try{setExportError('');const filename='aplyd-weekly-plan-'+review.week.start+'-'+review.week.end;if(format==='json')download(filename+'.json',prepareOwnWeeklyRecap(review));else localHtml(filename+'.html',renderOwnWeeklyRecapHtml(review));}catch{setExportError('The local recap could not be downloaded. Your plan and saved learning are unchanged.');}};
 return <section className={'panel '+styles.review} aria-labelledby={id+'-title'} data-own-weekly-review>
  <h2 id={id+'-title'}>Your week of practice</h2><p className="form-hint">{review.week.start} to {review.week.end} · Saved timezone: {review.week.timeZone}.</p>
  <dl className={styles.metrics}><div><dt>Activities planned for this week</dt><dd>{review.planned.activities}</dd></div><div><dt>Plan items with saved course actions this week</dt><dd>{review.evidence.total}</dd></div><div><dt>Private practices marked complete this week</dt><dd>{review.selfReported.practice}</dd><small>Self-reported</small></div></dl>
  <p className="form-hint">{review.planned.minutes} minutes planned · {review.planned.budgetMinutes} saved weekly budget. These are intentions, not verified time spent. This recap covers retained plan items; completion dates may differ from planned dates.</p>
  <p className="form-hint">{review.attention.blockedOpen} blocked open activities · {review.attention.undatedOpen} open activities without a date. These counts can overlap.</p>
  <details className="source-packet"><summary>Review open work and download a private recap</summary>
   <p className="form-hint">Saved course actions: {review.evidence.lessons} lessons completed · {review.evidence.submissions} evidence submissions · {review.evidence.reflections} reflections. A saved submission is not a passed assessment; a reflection does not verify work impact.</p>
   <p className="form-hint">{review.planned.stillOpen} activities dated this week remain open · {review.attention.earlierOpen} open activities have an earlier date · {review.attention.skippedThisWeek} activities dated this week were skipped.</p>
   {review.completionDateNeedsCheck>0&&<p className="form-hint">{review.completionDateNeedsCheck} completed plan items have a missing or future completion date. They are not placed in this week’s completion counts.</p>}
   <ul className={styles.attention}>{review.attentionRows.map(row=><li key={row.id}><strong>{row.title}</strong><div>{row.blocked&&<Tag tone="warning">Blocked</Tag>}{row.undated&&<Tag>No date chosen</Tag>}{row.earlier&&<Tag>Earlier planned date</Tag>}</div>{row.blockedReason&&<p className="form-hint">{row.blockedReason}</p>}<Button type="button" size="sm" variant="outline" aria-label={'Find planned activity '+row.title} onClick={()=>focusOperationItem('data-plan-task-id',row.id)}>Find this activity</Button></li>)}</ul>
   {!review.attentionRowsTotal&&<p className="form-hint">No blocked, undated or earlier open activities in this snapshot.</p>}{review.attentionRowsTotal>review.attentionRows.length&&<p className="form-hint">Showing {review.attentionRows.length} of {review.attentionRowsTotal} open activities needing a decision. The full list remains below.</p>}
   <p className="form-hint">Download only aggregate counts and dates. Private goals, notes, activity titles, evidence, contact details and identifiers are excluded. A file is saved on this device; your Academy plan stays unchanged.</p>
   {!accepted&&<p className="form-hint">Refresh your saved learning to download a current recap.</p>}
   <div className="actions"><Button type="button" variant="outline" disabled={!accepted||saving} onClick={()=>exportRecap('json')}>Download recap JSON</Button><Button type="button" variant="outline" disabled={!accepted||saving} onClick={()=>exportRecap('html')}>Download printable recap</Button></div>
   {exportError&&<p className="form-hint" role="alert">{exportError}</p>}
  </details>
 </section>;
}
