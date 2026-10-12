// ACA-US-3.2 expert review and versions; ACA-US-3.3 error log. Only the named reviewer of the pack gets in.
import {Shell, pageContext, attempt, Refused} from '../../shell';
import {reviewQueue, errorLog, latestVersion, publishedItems} from '@/lib/loop/packs';
import {v2Readiness} from '@/lib/loop/evidence';
import {decision} from '@/lib/loop/core';
import {ActionForm, ActionButton} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

const show = (body: string, kind: string) => (kind === 'check' || kind === 'planted_errors') ? (() => { try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } })() : body;

export default async function Review({params}: {params: Promise<{packId: string}>}) {
  const {packId} = await params;
  const {db, user} = await pageContext(`/loop/review/${packId}`);
  const q = await attempt(() => reviewQueue(db, user, packId));
  if (!q.ok) return <Shell title="Pack review" screen="review"><Refused message={q.message} /></Shell>;
  const pack = (await db.prepare('SELECT title, sector, audience, language FROM loop_packs WHERE id=?').bind(packId).first<{title: string; sector: string; audience: string; language: string}>())!;
  const v = await latestVersion(db, packId), pub = await publishedItems(db, packId);
  const log = await errorLog(db, user, packId) as {id: number; title: string; pack_version: number; reason: string; at: string}[];
  const ready = await v2Readiness(db, user, packId) as unknown as {flags: {id: number; title: string; reason: string; kind: string | null; text: string | null; decided: string | null}[]; ready: boolean};
  const e20 = !!(await decision<{epics: string[]}>(db, 'scope.release'))?.value.epics?.includes('ACA-E20');
  const notes = e20 ? (await db.prepare(`SELECT a.id, a.item_id, a.start, a.end, a.quote, a.note, a.at, i.title FROM loop_annotations a JOIN loop_pack_items i ON i.id=a.item_id WHERE i.pack_id=? AND a.status='open' ORDER BY i.title, a.start`).bind(packId).all<{id: number; item_id: string; quote: string; note: string; at: string; title: string}>()).results : [];
  const proposals = e20 ? (await db.prepare(`SELECT r.id, r.item_id, r.proposed_body, r.annotation_ids, i.body AS current_body, i.title FROM loop_refinements r JOIN loop_pack_items i ON i.id=r.item_id WHERE i.pack_id=? AND r.status='pending'`).bind(packId).all<{id: string; item_id: string; proposed_body: string; current_body: string; title: string}>()).results : [];
  const approvedUnpublished = (await db.prepare(`SELECT count(*) n FROM loop_pack_items i WHERE pack_id=? AND status='approved' AND id NOT IN (SELECT value FROM json_each(?))`).bind(packId, JSON.stringify(v?.itemIds ?? [])).first<{n: number}>())!.n;
  return (
    <Shell title={`Review: ${pack.title}`} screen="review">
      <p className={s.muted}>{pack.sector} · {pack.audience} · {pack.language} · published version {v?.version ?? 'none yet'}</p>
      <section className={s.card}><h2>Publish</h2>
        <p>{approvedUnpublished} approved item(s) not yet in a published version. Learners see only published versions; earlier versions are kept.</p>
        <ActionButton action="pack.publish" params={{packId}} label="Publish a new version" />
        {v && v.changes.length > 0 && <><h3>Changes in version {v.version}</h3><ul className={s.list}>{v.changes.map(c => <li key={c.lineage}>{c.change}: {c.title}{c.from ? ` (revision ${c.from} → ${c.to ?? 'removed'})` : ''}</li>)}</ul></>}
      </section>
      <section className={s.card} aria-labelledby="q-h"><h2 id="q-h">To review ({q.value.length})</h2>
        {q.value.length === 0 && <p>Nothing waiting.</p>}
        {q.value.map(i => {
          const sources = JSON.parse(i.sources) as {title: string; url?: string}[];
          return <article key={i.id} className={s.card}>
            <h3>{i.title}</h3><p className={s.muted}>{i.kind} · role {i.job_role} · level {i.level} · drafted by {i.origin === 'ai' ? 'AI' : 'expert'}</p>
            <p className={s.prewrap}>{show(i.body, i.kind)}</p>
            <p className={s.muted}>Sources: {sources.map((x, k) => <span key={k}>{x.url ? <a href={x.url} rel="noreferrer">{x.title}</a> : x.title}{k < sources.length - 1 ? '; ' : ''}</span>)}</p>
            <div className={s.row}><ActionButton action="pack.review" params={{itemId: i.id, decision: 'approve'}} label="Approve" /><ActionButton action="pack.review" params={{itemId: i.id, decision: 'reject'}} label="Reject" secondary /></div>
            <details><summary>Correct and approve</summary><ActionForm id={`c-${i.id}`} action="pack.review" params={{itemId: i.id, decision: 'correct'}} fields={[{name: 'title', label: 'Title', value: i.title, required: true}, {name: 'body', label: 'Corrected text', type: 'textarea', value: i.body, required: true, rows: 6}, {name: 'note', label: 'What you changed'}]} submit="Save correction" /></details>
          </article>;
        })}
      </section>
      <section className={s.card} aria-labelledby="log-h"><h2 id="log-h">Error log ({log.length} open)</h2>
        {log.map(f => <article key={f.id} className={s.card}><h3>{f.title} <span className={s.muted}>(version {f.pack_version})</span></h3><p>{f.reason}</p><p className={s.muted}>Flagged {f.at.slice(0, 10)}</p>
          <ActionForm id={`f-${f.id}`} action="pack.resolveFlag" params={{flagId: f.id}} fields={[{name: 'resolution', label: 'Resolution', required: true}]} submit="Resolve" /></article>)}
      </section>
      <section className={s.card} aria-labelledby="v2-h"><h2 id="v2-h">Next version from the error log</h2>
        <p>{ready.flags.length === 0 ? 'No flags logged yet.' : ready.ready ? 'Every logged error has a proposed fix or a reason for no change.' : `${ready.flags.filter(f => !f.kind || f.decided === 'rejected').length} logged error(s) still need a proposal.`}</p>
        <ActionButton action="pack.proposeFixes" params={{packId}} label="Ask AI to propose fixes" secondary />
        <ul className={s.list}>{ready.flags.map(f => <li key={f.id}><strong>{f.title}</strong>: {f.reason}{f.kind && <p className={s.muted}>{f.kind === 'fix' ? 'Proposed fix' : 'No change'}: {f.text} {f.decided ? `(${f.decided})` : ''}</p>}
          {f.kind && !f.decided && <div className={s.row}><ActionButton action="pack.decideProposal" params={{flagId: f.id, decision: 'accepted'}} label="Accept" secondary /><ActionButton action="pack.decideProposal" params={{flagId: f.id, decision: 'rejected'}} label="Reject" secondary /></div>}
          <details><summary>Write my own proposal</summary><ActionForm id={`own-${f.id}`} action="pack.decideProposal" params={{flagId: f.id, decision: 'own'}} fields={[{name: 'kind', label: 'Kind', type: 'select', options: [['fix', 'Fix'], ['no_change', 'No change']]}, {name: 'text', label: 'Fix text or reason', type: 'textarea', required: true, rows: 3}]} submit="Save" /></details></li>)}</ul>
        <p className={s.muted}>Apply accepted fixes with “Change this item” below, then publish a new version; its change list and the earlier version are kept.</p>
      </section>
      {e20 && <section className={s.card} aria-labelledby="notes-h"><h2 id="notes-h">Notes from readers ({notes.length})</h2>
        {[...new Set(notes.map(n => n.item_id))].map(itemId => <article key={itemId} className={s.card}><h3>{notes.find(n => n.item_id === itemId)!.title}</h3>
          <ul className={s.list}>{notes.filter(n => n.item_id === itemId).map(n => <li key={n.id}><mark>{n.quote}</mark>: {n.note} <div className={s.row}><ActionButton action="annotation.status" params={{id: n.id, status: 'resolved'}} label="Resolve" secondary /><ActionButton action="annotation.status" params={{id: n.id, status: 'hidden'}} label="Hide" secondary /></div></li>)}</ul>
          <ActionButton action="refinement.propose" params={{itemId}} label="Ask AI to propose a refinement" secondary /></article>)}
        {proposals.map(p => <article key={p.id} className={s.card}><h3>Proposed refinement: {p.title}</h3>
          <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Compare current and proposed text"><table className={s.table}><thead><tr><th scope="col">Current</th><th scope="col">Proposed</th></tr></thead><tbody><tr><td className={s.prewrap}>{p.current_body}</td><td className={s.prewrap}>{p.proposed_body}</td></tr></tbody></table></div>
          <div className={s.row}><ActionButton action="refinement.decide" params={{refinementId: p.id, decision: 'approve'}} label="Approve as a new revision" /><ActionButton action="refinement.decide" params={{refinementId: p.id, decision: 'reject'}} label="Reject" secondary /></div>
          <p className={s.muted}>Approved text reaches learners only after you publish a new version.</p></article>)}
      </section>}
      <section className={s.card}><h2>Published items</h2>
        <ul className={s.list}>{pub.items.map(i => <li key={i.id}><strong>{i.title}</strong> <span className={s.muted}>({i.kind}, revision {i.revision})</span>
          <details><summary>Change this item</summary><ActionForm id={`r-${i.id}`} action="pack.revise" params={{itemId: i.id}} fields={[{name: 'body', label: 'New text', type: 'textarea', value: i.body, required: true, rows: 6}]} submit="Save as new revision" success="Saved. Publish a new version to show it to learners." /></details></li>)}</ul>
      </section>
    </Shell>
  );
}
