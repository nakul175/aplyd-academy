import {deriveContentReadiness,prepareOwnLearningHelp} from './academy-content-readiness.ts';

/** Select only content attention for the existing owner panel. No support
 * dashboard, preference state, role grant, command or body is returned. */
export function deriveOperationsContentAttention(team,now){
 const ready=deriveContentReadiness(team,now);
 if(!ready||ready.audience!=='owner'||!ready.content.visible)return null;
 const items=ready.content.items.map(item=>{const publication=item.kind==='publication'?team.content?.publications.find(p=>p.id===item.id):null;return {...item,reference:publication?{scope:publication.ref.scope,programId:publication.ref.programId,versionId:publication.ref.versionId}:null,documentHash:publication&&typeof publication.documentHash==='string'&&/^[a-f0-9]{64}$/.test(publication.documentHash)?publication.documentHash:null};});
 return {workspaceId:ready.workspaceId,asOf:ready.asOf,total:ready.content.totalAttention,items,cohorts:ready.cohorts.filter(c=>c.state==='paused'||c.newContentEnrollment!=='allowed_in_snapshot'||!c.exactContentReferenceKnown),counts:{retired:ready.counts.retiredPublications,elapsed:ready.counts.elapsedPublicationReviews,waiting:ready.counts.pendingDraftReviews,authorUnavailable:ready.counts.authorUnavailable,reviewerUnavailable:ready.counts.reviewerUnavailable}};
}

/** Append only to the current unsent description. Other intake fields and
 * ordinary category/audience/send controls are intentionally outside this model. */
export function appendOwnLearningHelpDescription({currentBody,preferences,course,choices}){
 if(typeof currentBody!=='string'||currentBody.length>2000)throw new Error('Keep your current description and shorten it before adding learning-help details.');
 const prepared=prepareOwnLearningHelp({preferences,course,choices});
 const body=currentBody+(currentBody.length?'\n\n':'')+prepared.body;
 if(body.length>2000)throw new Error('These details would exceed the 2,000-character description limit. Keep your text and shorten it or include fewer details before trying again.');
 return {body};
}

/** Current cohort and explicit enrollment only. Unknown/withdrawn/foreign
 * references are never replaced by another course. Resolve is the existing
 * accepted exact-pin resolver; returned data contains title/language only. */
export function ownSelectedLearningHelpCourse({enrollments,cohorts,cohortId,enrollmentId,resolvePinned}){
 if(typeof cohortId!=='string'||cohortId==='workspace'||!Array.isArray(cohorts)||!cohorts.some(c=>c?.id===cohortId)||typeof enrollmentId!=='string'||!enrollmentId||!Array.isArray(enrollments))return null;
 const cohort=cohorts.find(c=>c?.id===cohortId),enrollment=enrollments.find(e=>e?.id===enrollmentId&&e.cohortId===cohortId&&!e.withdrawn);
 if(!enrollment||cohort.programId!==enrollment.programId)return null;
 let pinned;try{pinned=resolvePinned(enrollment)}catch{return null}
 if(pinned?.available!==true||!pinned.snapshot?.ref||!pinned.snapshot?.program||typeof pinned.snapshot.program.title!=='string'||typeof pinned.snapshot.language!=='string'||pinned.snapshot.ref.programId!==enrollment.programId)return null;
 const ref=pinned.snapshot.ref,original=enrollment.contentRef;
 if(original&&(ref.scope!==original.scope||ref.programId!==original.programId||ref.versionId!==original.versionId))return null;
 if(!original&&ref.versionId!==enrollment.version)return null;
 const offered=cohort.contentRef;
 if(offered&&(ref.scope!==offered.scope||ref.programId!==offered.programId||ref.versionId!==offered.versionId))return null;
 if(!offered&&ref.versionId!==cohort.version)return null;
 return {title:pinned.snapshot.program.title,language:pinned.snapshot.language,cohortId};
}

/** In-memory equality fence for local audience acknowledgement. Never put this
 * string in storage, logs, DOM attributes, URLs or a server command. */
export function supportIntakeConsentKey(scope,fields,audience){return JSON.stringify([scope,fields.category,fields.cohortId,fields.subject,fields.body,audience]);}
