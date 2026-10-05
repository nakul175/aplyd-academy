'use client';
import {useMemo,useState} from 'react';
import {BookOpen,Search,FileText,Presentation,Download,ArrowUpRight,LibraryBig} from 'lucide-react';
import {collections} from '@/lib/academy-library';
import {libraryIndex,libraryResults,librarySize,resourceKind,type LibraryResource} from '@/lib/academy-library-view';
import styles from './academy-library.module.css';

const formatLabel={docx:'Word document',pdf:'PDF',pptx:'PowerPoint'};
const audienceLabel={participant:'Suggested for participants',trainer:'Suggested for trainers & facilitators',all:'For participants & trainers'};
export function LibraryView(){
 const [query,setQuery]=useState(''),[collection,setCollection]=useState('all'),[audience,setAudience]=useState('all');
 const index=useMemo(()=>libraryIndex(collections),[]);
 const results=useMemo(()=>index?libraryResults(index,query,collection,audience):[],[index,query,collection,audience]);
 const shown=results.reduce((n,c)=>n+c.resources.length,0),total=index?.reduce((n,c)=>n+c.resources.length,0)??0;
 const clear=()=>{setQuery('');setCollection('all');setAudience('all')};
 if(!index)return <section className="empty-state" role="status"><LibraryBig aria-hidden="true"/><h1>Reference library unavailable</h1><p>The file catalog could not be read. Your saved learning is retained.</p></section>;
 return <div className={styles.library} data-library-view="reference"><header className={styles.hero}><p className="eyebrow">APLYD REFERENCE LIBRARY</p><h1>Learning for the work ahead</h1><p>Explore the handbooks, workshop tools and slide decks supplied for five work contexts. Find a useful reference and take it into your next conversation or practice session.</p><div className={styles.heroMeta}><span><BookOpen size={17} aria-hidden="true"/>{index.length} collections</span><span>{total} supplied files</span></div></header>
 <aside className={styles.note} aria-label="About these reference materials"><strong>Supplied reference material</strong><p>These supplied materials are references. Downloads and any certificate templates do not complete an Academy course or issue a practice record. Audience labels are recommendations. Review examples and procedures for your setting before use.</p></aside>
 <section className={styles.filters} aria-label="Find library resources"><div className={styles.search}><label htmlFor="library-search">Search the library</label><div><Search size={18} aria-hidden="true"/><input id="library-search" type="search" maxLength={120} placeholder="Title, topic or source filename" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div><label htmlFor="library-collection">Collection</label><select id="library-collection" value={collection} onChange={e=>setCollection(e.target.value)}><option value="all">All collections</option>{index.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></div><div><label htmlFor="library-audience">Suggested audience</label><select id="library-audience" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">Everyone · all files</option><option value="participant">Participants</option><option value="trainer">Trainers & facilitators</option></select></div></section>
 <div className={styles.resultLine}><p role="status" aria-live="polite" aria-atomic="true">{shown} of {total} files shown</p>{shown>0&&(query||collection!=='all'||audience!=='all')&&<button type="button" className={styles.clear} onClick={clear}>Clear library filters</button>}</div>
 {results.length?results.map(c=><section key={c.id} className={styles.collection} data-library-collection={c.id} aria-labelledby={'library-title-'+c.id}><div className={styles.collectionHeading}><h2 id={'library-title-'+c.id}>{c.title}</h2><p>{c.summary}</p>{c.reviewNote&&<aside className={styles.reviewNote}><strong>Review before use</strong><p>{c.reviewNote}</p></aside>}</div><div className={styles.grid}>{c.resources.map(r=><ResourceCard key={r.id} resource={r}/>)}</div></section>):<section className="empty-state"><Search aria-hidden="true"/><h2>No matching reference files</h2><p>Try another topic, source filename, collection or suggested audience.</p><button type="button" className={styles.clear} onClick={clear}>Clear library filters</button></section>}
 <p className={styles.footnote}>Files keep their original format. Your browser may download Word and PowerPoint files when you choose Open.</p></div>;
}
function ResourceCard({resource:r}:{resource:LibraryResource}){
 const Icon=r.format==='pptx'?Presentation:r.format==='pdf'?FileText:BookOpen;
 return <article className={styles.card} data-library-resource-id={r.id}><div className={styles.cardTop}><span className={styles.icon}><Icon size={22} aria-hidden="true"/></span><span className={styles.kind}>{resourceKind(r)}</span></div><h3>{r.title}</h3><p className={styles.audience}>{audienceLabel[r.audience]}</p><p className={styles.fileMeta}><span>{formatLabel[r.format]}</span><span>{librarySize(r.bytes)}</span></p><p className={styles.filename}><span>Source file</span>{r.filename}</p><div className={styles.actions}><a href={r.href} target="_blank" rel="noopener noreferrer" aria-label={'Open '+r.title+' in a new tab'}><ArrowUpRight size={17} aria-hidden="true"/>Open</a><a href={r.href} download={r.filename} aria-label={'Download '+r.title}><Download size={17} aria-hidden="true"/>Download</a></div></article>;
}
