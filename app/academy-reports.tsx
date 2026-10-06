'use client';
import {Download,LockKeyhole,BarChart3} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {useAcademy} from './academy-context';
import {Head,Tag} from './academy-ui';
import {METRIC_DICTIONARY,exportReport,SMALL_CELL_THRESHOLD,type Row,type Rollup} from '../lib/academy-reports';

/** Programme reporting from the server projection team.reports. The projection is built
 * for the signed-in member only (owner: all cohorts; facilitator or assessor: scoped
 * cohorts) and already hides counts below 3. Exports re-apply the same rule. */
const COLUMNS:Array<[keyof Row,string]>=[['enrolled','Enrolled'],['active','Active'],['completedLessons','Lessons completed'],['submitted','Submitted'],['passed','Passed'],['needsRetry','Needs retry'],['appeals','Appeals'],['appealRate','Appeal rate %'],['medianDaysToReview','Median days to review'],['supportRequests','Support requests'],['discussionReports','Discussion reports']];
const show=(v:unknown)=>v===null||v===undefined?'—':String(v);
function save(name:string,mime:string,content:string){try{const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}catch{/* download unavailable */}}
function RollupTable({title,rows,label}:{title:string;rows:Row[];label:(r:Row)=>string}){
 if(!rows.length)return null;
 return <section className="panel mt" aria-label={title}><h2>{title}</h2><div className="table-scroll"><Table><TableHeader><TableRow><TableHead>{title.startsWith('Pathway')?'Pathway':title.startsWith('Cohort')?'Cohort':'Scope'}</TableHead>{COLUMNS.map(([k,l])=><TableHead key={k as string}>{l}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={(r.cohortId??r.programId??'all')+r.level}><TableCell>{label(r)}</TableCell>{COLUMNS.map(([k])=><TableCell key={k as string}>{show(r[k])}</TableCell>)}</TableRow>)}</TableBody></Table></div></section>;
}
export default function ReportsView(){
 const {team}=useAcademy(),rollup:Rollup|null|undefined=team?.reports;
 if(!team||!rollup)return <section className="panel spacious"><LockKeyhole/><h2 className="mt">Programme reports are unavailable</h2><p className="mt">Reports are available to workspace owners and to facilitators or assessors for their own cohorts. Refresh your workspace access or return to your Overview.</p></section>;
 const owner=rollup.audience==='owner',name=(id:string|null)=>id??'Pathway';
 const doExport=(format:'csv'|'json')=>{const x=exportReport(rollup,format);save(x.filename,x.mime,x.content);if(format==='csv')save(x.filename.replace(/\.csv$/,'')+'-manifest.json','application/json',x.manifestJson)};
 return <div className="reports-view" data-reports-workspace={rollup.workspaceId}>
  <Head eyebrow="PROGRAMME REPORTS" title="Defined numbers, shown only to those who may see them." body={owner?'All cohorts in this workspace.':'Only the cohorts in your current facilitator or assessor scope.'}>
   <div className="actions"><Button variant="outline" onClick={()=>doExport('csv')}><Download size={17}/>Download CSV with manifest</Button><Button variant="outline" onClick={()=>doExport('json')}><Download size={17}/>Download JSON</Button></div>
  </Head>
  <div className="notice"><LockKeyhole/><p>Aggregates only. Any count below {SMALL_CELL_THRESHOLD} is shown as &lt;{SMALL_CELL_THRESHOLD} here and in every export so individual learners cannot be picked out. Counts describe saved learning; they do not measure job impact or establish a qualification. Each export carries a manifest with a SHA-256 checksum. Generated {new Date(rollup.generatedAt).toLocaleString('en-IN')}.</p></div>
  <RollupTable title="Cohort rollup" rows={rollup.cohorts} label={r=>r.cohortTitle??'Cohort'}/>
  <RollupTable title="Pathway rollup" rows={rollup.pathways} label={r=>name(r.programId)}/>
  <RollupTable title="Total in scope" rows={[rollup.total]} label={()=>owner?'Whole workspace':'Your cohorts'}/>
  {!rollup.cohorts.length&&<p className="mt">No cohorts are in your reporting scope. Ask a workspace owner to arrange cohort access.</p>}
  <section className="panel mt" aria-labelledby="metric-dictionary"><div className="section-title no-top"><h2 id="metric-dictionary"><BarChart3 size={21}/> Metric dictionary</h2><Tag>{METRIC_DICTIONARY.length} metrics</Tag></div>
   <p className="form-hint">What each number means, how it is calculated, where it comes from, who can see it and what it cannot tell you.</p>
   <div className="metric-dictionary">{METRIC_DICTIONARY.filter(m=>owner||m.visibleTo.some(r=>r!=='owner')).map(m=><details key={m.id} className="mt"><summary><strong>{m.name}</strong> <Tag>{m.visibleTo.join(' · ')}</Tag></summary><dl><dt>Definition</dt><dd>{m.definition}</dd><dt>Formula</dt><dd>{m.formula}</dd><dt>Source</dt><dd>{m.source}</dd><dt>Known limits</dt><dd>{m.limits}</dd></dl></details>)}</div>
  </section>
 </div>;
}
