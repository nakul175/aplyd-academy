'use client';
import {useState,useEffect,useCallback} from 'react';
import {ScrollText,Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {auditCsv,type AuditRow} from '@/lib/academy-audit-detail';
import {download} from './academy-download';
import {Head,Empty,Tag} from './academy-ui';

const TYPES=['create','accept','invite','revoke-invite','member','cohort-create','cohort-status','assign','assess','resolve','submit','appeal','share','enroll','withdraw','reset','pause','moderate','content-save','content-submit','content-review','content-publish','content-retire','content-archive','content-recall','content-copy'];
const when=(s:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));
const show=(v:any)=>Array.isArray(v)?(v.length?v.join(', '):'none'):v===null||v===undefined?'none':String(v);
const csvFile=(rows:AuditRow[])=>{const blob=new Blob([auditCsv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='academy-audit.csv';a.click();URL.revokeObjectURL(url)};

/** Mount: <AcademyAudit scope="workspace" teamId={team.id}/> for workspace owners, <AcademyAudit scope="personal"/> for a learner's own lab. */
export default function AcademyAudit({scope,teamId}:{scope:'workspace'|'personal';teamId?:string}){
 const [rows,setRows]=useState<AuditRow[]>([]),[actors,setActors]=useState<Record<string,string>>({}),[next,setNext]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[f,setF]=useState({type:'',actor:'',target:'',from:'',to:''});
 const personal=scope==='personal';
 const query=useCallback((before?:number)=>{const p=new URLSearchParams();if(!personal&&teamId)p.set('teamId',teamId);for(const [k,v] of Object.entries(f))if(v&&!(personal&&k==='actor'))p.set(k,v);if(before)p.set('before',String(before));p.set('limit','25');return (personal?'/api/academy/audit?':'/api/teams/audit?')+p},[f,personal,teamId]);
 const load=useCallback(async(more?:number)=>{setLoading(true);setError('');try{const r=await fetch(query(more),{cache:'no-store'}),b:any=await r.json().catch(()=>({}));if(!r.ok)throw new Error(r.status===404?'The audit is available to workspace owners only.':b.error||'Could not open the audit.');setRows(old=>more?[...old,...b.items]:b.items);setActors(old=>({...old,...b.actors}));setNext(b.nextBefore)}catch(e:any){setError(e.message);if(!more)setRows([])}finally{setLoading(false)}},[query]);
 useEffect(()=>{load()},[load]);
 const set=(k:string)=>(e:any)=>setF(x=>({...x,[k]:e.target.value}));
 return <div>
  <Head eyebrow={personal?'Your record':'Workspace'} title={personal?'My activity record':'Audit log'} body={personal?'Your own actions in your practice lab: what you did, when, and which fields changed. Your answers and evidence are never copied here.':'Who changed what in this workspace. Details list statuses, roles, scopes, decisions and publication states only. Learner answers, evidence, feedback, emails and passphrases are never recorded.'}>
   <Button variant="outline" disabled={!rows.length} onClick={()=>csvFile(rows)}><Download size={16}/> Export CSV</Button>
   <Button variant="outline" disabled={!rows.length} onClick={()=>download('academy-audit.json',rows)}>Export JSON</Button>
  </Head>
  <form className="two-grid mt" onSubmit={e=>{e.preventDefault();load()}} aria-label="Audit filters">
   <label className="field"><span>Action type</span><select value={f.type} onChange={set('type')}><option value="">All actions</option>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   {!personal&&<label className="field"><span>Actor</span><select value={f.actor} onChange={set('actor')}><option value="">Anyone</option>{Object.entries(actors).map(([ref,name])=><option key={ref} value={ref}>{name} ({ref})</option>)}</select></label>}
   <label className="field"><span>Target id</span><input value={f.target} onChange={set('target')} placeholder="enrollment, cohort, content or credential id" maxLength={80}/></label>
   <label className="field"><span>From</span><input type="date" value={f.from} onChange={set('from')}/></label>
   <label className="field"><span>To</span><input type="date" value={f.to} onChange={set('to')}/></label>
  </form>
  {error&&<p role="alert" className="form-hint mt">{error}</p>}
  {!error&&!loading&&!rows.length&&<Empty icon={ScrollText} title="No matching audit records" body={Object.values(f).some(Boolean)?'Clear the filters to see all recorded actions.':'Significant actions will appear here once they are saved.'}/>}
  {rows.length>0&&<div className="mt" style={{overflowX:'auto'}}><table aria-label="Audit records" style={{width:'100%',borderCollapse:'collapse'}}>
   <thead><tr>{['When','Actor','Action','Target','What changed'].map(h=><th key={h} scope="col" style={{textAlign:'left',padding:'6px 8px'}}>{h}</th>)}</tr></thead>
   <tbody>{rows.map(r=><tr key={r.revision} style={{borderTop:'1px solid var(--border, #ddd)',verticalAlign:'top'}}>
    <td style={{padding:'6px 8px'}}>{when(r.at)}</td>
    <td style={{padding:'6px 8px'}}>{actors[r.actor]??'Member'}<br/><span className="muted">{r.actor}</span></td>
    <td style={{padding:'6px 8px'}}>{r.type}{r.detail&&<><br/><Tag>{r.detail.category}</Tag></>}</td>
    <td style={{padding:'6px 8px'}}>{r.detail&&Object.keys(r.detail.target).length?Object.entries(r.detail.target).map(([k,v])=><div key={k}><span className="muted">{k}</span> {v}</div>):<span className="muted">Not recorded</span>}</td>
    <td style={{padding:'6px 8px'}}>{r.legacy?<span className="muted">Recorded before change details were kept.</span>:r.detail!.changes.length?r.detail!.changes.map((c,i)=><div key={i}>{c.entity} {c.field}: {show(c.before)} to {show(c.after)}</div>):<span className="muted">{r.detail!.outcome==='no-change'?'No tracked field changed':'No details'}</span>}</td>
   </tr>)}</tbody></table></div>}
  {loading&&<p className="muted mt" aria-live="polite">Loading audit records...</p>}
  {next!==null&&!loading&&<div className="mt"><Button variant="outline" onClick={()=>load(next)}>Load older records</Button></div>}
 </div>
}
