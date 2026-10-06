'use client';
import {useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import curriculum from '@/lib/academy-curriculum';
import {contexts} from '@/lib/academy-engine';
import {indexCatalog,filterCatalog,facetOptions,activeFilterCount,resultsAnnouncement,FACET_KEYS,FACET_LABELS,DERIVED_FACETS,DERIVED_LABEL,EMPTY_SELECTION,type FacetKey,type Selection} from '@/lib/academy-catalog-facets';
import {derivePreEnrollmentInfo,type PreEnrollmentInfo} from '@/lib/academy-pre-enrollment';
import {recommend} from '@/lib/academy-recommendations';
import {useAcademy} from './academy-context';
import {roleOptions} from './academy-context-select';
import {Tag} from './academy-ui';
import css from './academy-discovery.module.css';

const roleOf=(p:any)=>roleOptions[curriculum.pathways.findIndex(seed=>seed.role===p.role)]??roleOptions[1];

/** Exact-edition snapshot for a card, or null when the saved edition is unavailable. Never substitutes a newer edition. */
function cardSnapshot(p:any,ctx:any){
 const e=ctx.state.enrollments.find((x:any)=>x.programId===p.id&&!x.withdrawn);
 if(e){const r=ctx.resolvePinned(e);return r?.available?r.snapshot:null;}
 const offering=ctx.catalogOfferingTargets?.[p.id];
 if(offering){const cohort=ctx.team?.cohorts.find((c:any)=>c.id===offering.cohortId),r=cohort?ctx.resolvePinned(cohort):null;return r?.available?r.snapshot:null;}
 return {ref:{scope:'global',programId:p.id,versionId:curriculum.contentVersion},program:p};
}

export function PreEnrollmentPanel({info,compact=false}:{info:PreEnrollmentInfo;compact?:boolean}){
 return <div>
  <p className={css.edition}>{info.edition.label}</p>
  {!compact&&<><h4>What you will be able to do</h4><ul>{info.outcomes.map(x=><li key={x}>{x}</li>)}</ul></>}
  <h4>Time needed</h4><p>{info.effort.pacingNote}</p>
  {!compact&&<><h4>What you need first</h4>{info.prerequisites.length?<ul>{info.prerequisites.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>No prerequisites are listed for this edition.</p>}</>}
  <h4>How you are assessed</h4><p>{info.assessmentMethod}</p>
  {!compact&&<p><strong>Pass rule:</strong> {info.passRule??'The pass rule for this edition is unavailable. Ask for support before starting.'}</p>}
  <h4>What the record says</h4><p>{info.credential.claims}.</p><p>{info.credential.notAccredited}</p>
  {info.credential.doesNotClaim.length>0&&<><p><strong>It does not claim:</strong></p><ul>{info.credential.doesNotClaim.map(x=><li key={x}>{x}</li>)}</ul></>}
  {info.cohorts&&<><h4>Cohort availability</h4>{info.cohorts.length?<ul>{info.cohorts.map(c=><li key={c.id}>{c.title}: {c.placesLeft} place{c.placesLeft===1?'':'s'} left</li>)}</ul>:<p>No cohort in your workspace has an open place for this pathway.</p>}</>}
 </div>;
}

function CatalogCard({p,index,why}:any){
 const ctx=useAcademy(),{state,go,team,catalogOfferingTargets}=ctx,r=roleOf(p),Icon=r.icon,e=state.enrollments.find((x:any)=>x.programId===p.id&&!x.withdrawn),offering=catalogOfferingTargets?.[p.id];
 const snapshot=cardSnapshot(p,ctx),shown=snapshot?.program??(e?null:p);
 const info=useMemo(()=>snapshot?derivePreEnrollmentInfo({snapshot,globalSeed:curriculum,cohorts:team?team.cohorts:null}):null,[snapshot,team]);
 const total=shown?.lessons?.length;
 return <article className={css.card} aria-labelledby={'cat-'+p.id} data-offering-cohort-id={!e?offering?.cohortId:undefined}>
  <span className="eyebrow"><Icon size={14} aria-hidden="true"/> {r.label}</span>
  {index>=3&&<Tag>Private workspace practice draft</Tag>}
  <h3 id={'cat-'+p.id}>{shown?.title??'Saved content unavailable'}</h3>
  <p>{shown?.summary??'Your saved work is retained; open your pathway for support and export.'}</p>
  {shown&&<p className={css.meta}><span>{e?`${e.completed.length}/${total??'?'} lessons complete`:`${total??'?'} lessons`}</span><span>{shown.estimatedMinutes?`About ${shown.estimatedMinutes} minutes`:'Time not stated'}</span><span>{shown.level??'Level not stated'}</span></p>}
  {info&&<p className={css.edition}>{info.edition.label} · nonaccredited practice record</p>}
  <Button className={css.cardOpen} variant={e?'outline':'default'} onClick={()=>go('learn',p.id,!e&&offering?{offering}:null)} aria-label={`${e?'Continue learning':'See details and enrol'}: ${shown?.title??'pathway'}`}>{e?'Continue learning':'See details and enrol'}</Button>
  {info&&<details className={css.cardInfo}><summary>Before you enrol: what to expect</summary><PreEnrollmentPanel info={info}/></details>}
  {why&&<details className={css.why}><summary>Why this is suggested</summary><ul>{why.basis.map((b:string,i:number)=><li key={i}>{b}</li>)}</ul></details>}
 </article>;
}

export function Catalog(){
 const {catalogPrograms,state,team,catalogOfferingTargets,go}=useAcademy(),[sel,setSel]=useState<Selection>(EMPTY_SELECTION);
 const items=useMemo(()=>indexCatalog(catalogPrograms,curriculum.language),[catalogPrograms]);
 const found=filterCatalog(items,sel),active=activeFilterCount(sel);
 const rec=useMemo(()=>recommend({programs:catalogPrograms,profileContext:state.profile?.context,contextPrograms:contexts,goal:state.learningPlan?.goal,enrollments:state.enrollments,planTasks:state.learningPlan?.tasks,cohortProgramIds:team?team.cohorts.filter((c:any)=>c.status==='open'&&c.contentOpen!==false&&c.occupied<c.capacity).map((c:any)=>c.programId):Object.keys(catalogOfferingTargets??{})}),[catalogPrograms,state,team,catalogOfferingTargets]);
 const whyById=Object.fromEntries(rec.items.map(i=>[i.programId,i])),top=rec.items.find(i=>!i.completed),topProgram=top&&catalogPrograms.find((p:any)=>p.id===top.programId);
 const clear=()=>setSel(EMPTY_SELECTION);
 return <>
  <div className="page-heading"><div><p className="eyebrow">PRACTICAL LEARNING</p><h1>Choose a skill. Make it useful.</h1><p>Each pathway connects learning, guided practice, and evidence of your work.</p></div></div>
  {topProgram&&top&&<section className={`${css.panel} ${css.suggest}`} aria-labelledby="suggest-title"><h2 id="suggest-title">Suggested first: {topProgram.title}</h2><p><strong>Why this is suggested</strong></p><ul>{top.basis.map((b,i)=><li key={i}>{b}</li>)}</ul><p className={css.note}>{rec.note}</p><Button variant="outline" className="mt" onClick={()=>go('learn',topProgram.id,catalogOfferingTargets?.[topProgram.id]&&!state.enrollments.some((x:any)=>x.programId===topProgram.id&&!x.withdrawn)?{offering:catalogOfferingTargets[topProgram.id]}:null)}>Look at this pathway</Button></section>}
  <form className={css.panel} role="search" aria-label="Find a pathway" onSubmit={ev=>ev.preventDefault()}>
   <div className={css.search}><label htmlFor="catalog-search">Search pathways</label><input id="catalog-search" type="search" placeholder="Search by skill, goal, role or topic" value={sel.query} onChange={ev=>setSel({...sel,query:ev.target.value})} autoComplete="off"/></div>
   <fieldset className={css.facets}><legend>Filter by</legend>{FACET_KEYS.map((key:FacetKey)=>{const opts=facetOptions(items,sel,key);return <div key={key}><label htmlFor={'facet-'+key}>{FACET_LABELS[key]}{DERIVED_FACETS.includes(key)?' *':''}</label><select id={'facet-'+key} value={sel[key]??''} onChange={ev=>setSel({...sel,[key]:ev.target.value||undefined})}><option value="">Any ({items.length})</option>{opts.map(o=><option key={o.value} value={o.value} disabled={!o.count&&sel[key]!==o.value}>{o.value} ({o.count})</option>)}</select></div>})}</fieldset>
   <p className={css.derived}>* {DERIVED_LABEL}. Topic, language, format and total effort bands are grouped here from each pathway&apos;s existing details.</p>
   <div className={css.resultLine}><p role="status" aria-live="polite" aria-atomic="true">{resultsAnnouncement(found.length,items.length,sel)}</p>{active>0&&<button type="button" className={css.clear} onClick={clear}>Clear filters ({active})</button>}</div>
  </form>
  {found.length>0&&<div className={css.grid} role="list" aria-label="Pathways">{found.map(it=><div role="listitem" key={it.program.id} style={{display:'contents'}}><CatalogCard p={it.program} index={it.index} why={whyById[it.program.id]}/></div>)}</div>}
  {!found.length&&<div className="empty-state"><Search aria-hidden="true"/><h2>No matching pathway</h2><p>Nothing fits all of these choices. Remove a filter or try a different word.</p><Button variant="outline" onClick={clear}>Clear filters</Button></div>}
  <div className="notice"><div><strong>A useful skill needs careful practice.</strong><p>These draft pathways use fictional information. They do not qualify anyone to provide medical, legal, financial, or agricultural professional advice.</p></div></div>
 </>;
}
