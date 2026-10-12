// ACA-E8: live sessions by level and cohort-only follow-up threads (facilitator view and learner view).
import Link from 'next/link';
import {Shell, pageContext, attempt, Refused} from '../../shell';
import {cohortThreads} from '@/lib/loop/community';
import {decision} from '@/lib/loop/core';
import type {Instrument} from '@/lib/loop/levels';
import {ActionForm} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Community({params}: {params: Promise<{cohortId: string}>}) {
  const {cohortId} = await params;
  const {db, user} = await pageContext(`/loop/community/${cohortId}`);
  const r = await attempt(() => cohortThreads(db, user, cohortId));
  if (!r.ok) return <Shell title="Community" screen="community"><Refused message={r.message} /></Shell>;
  const fac = await db.prepare(`SELECT 1 FROM loop_members m JOIN loop_cohorts c ON c.org_id=m.org_id WHERE c.id=? AND m.user_id=? AND m.role='facilitator' AND m.status='joined'`).bind(cohortId, user.userId).first();
  const bands = (await decision<Instrument>(db, 'placement.instrument'))?.value.bands ?? [];
  const sessions = r.value.sessions as {id: string; level: string; title: string; starts_at: string; ended_at: string | null; invited: number}[];
  return (
    <Shell title={`Community: ${r.value.cohort.name}`} screen="community">
      {fac && <section className={s.card}><h2>Schedule a live session for one level</h2>
        <ActionForm action="session.schedule" params={{cohortId}} fields={[{name: 'level', label: 'Level', type: 'select', options: bands.map(b => [b.level, b.label] as [string, string])}, {name: 'title', label: 'Title', required: true}, {name: 'startsAt', label: 'Starts at (date and time, UTC)', type: 'text', required: true, hint: 'For example 2026-11-20T10:00:00Z'}, {name: 'link', label: 'Meeting link', type: 'url', required: true}]} submit="Schedule and invite" success="Scheduled. Learners at that level were invited." /></section>}
      <section className={s.card}><h2>Sessions</h2><ul className={s.list}>{sessions.map(x => <li key={x.id}><strong>{x.title}</strong> · level {x.level} · {x.starts_at.slice(0, 16).replace('T', ' ')} UTC · {x.invited} invited {x.ended_at ? '· ended' : ''}
        {fac && !x.ended_at && <details><summary>End the session</summary><ActionForm id={`end-${x.id}`} action="session.end" params={{sessionId: x.id}} fields={[]} submit="End and open the follow-up thread" /></details>}</li>)}</ul>
        <p className={s.muted}>Attendance is noted as context only; it is never used to judge success.</p></section>
      <section className={s.card}><h2>Follow-up threads</h2><ul className={s.list}>{(r.value.threads as {id: string; title: string; posts: number; reported: number}[]).map(t => <li key={t.id}><Link href={`/loop/thread/${t.id}`}>{t.title}</Link> <span className={s.muted}>{t.posts} posts{fac && t.reported ? ` · ${t.reported} reported` : ''}</span></li>)}</ul></section>
    </Shell>
  );
}
