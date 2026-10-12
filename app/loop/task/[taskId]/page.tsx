// ACA-US-4.1/4.2/4.4/7.3: the practice task. Works with AI off (task, checked guidance and submit stay available).
import Link from 'next/link';
import {Shell, pageContext, attempt, Refused, tr} from '../../shell';
import {decision} from '@/lib/loop/core';
import {taskView} from '@/lib/loop/practice';
import {publishedItems} from '@/lib/loop/packs';
import {ActionForm, Uploader, Coach, VoiceAttempt} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Task({params}: {params: Promise<{taskId: string}>}) {
  const {taskId} = await params;
  const {db, user} = await pageContext(`/loop/task/${taskId}`);
  const r = await attempt(() => taskView(db, user, taskId));
  if (!r.ok) return <Shell title="Practice task" screen="task"><Refused message={r.message} /></Shell>;
  const v = r.value, t = v.task;
  const member = await db.prepare('SELECT role, cohort_id FROM loop_members WHERE id=?').bind(t.member_id).first<{role: string; cohort_id: string}>();
  const cohort = await db.prepare('SELECT pack_id FROM loop_cohorts WHERE id=?').bind(t.cohort_id).first<{pack_id: string | null}>();
  const items = cohort?.pack_id ? (await publishedItems(db, cohort.pack_id)).items.filter(i => ['rule', 'example', 'pitfall'].includes(i.kind)) : [];
  const files = v.files as {id: string; name: string; size: number; status: string}[];
  const done = t.status === 'submitted';
  const {t: tx} = await tr();
  const scope = await decision<{epics: string[]}>(db, 'scope.release');
  const annotations = !!scope?.value.epics?.includes('ACA-E20');
  const voice = !!scope?.value.epics?.includes('ACA-E19') && !!(await decision<{allowed: boolean}>(db, 'speech.provider'))?.value.allowed && member?.role !== 'student';
  return (
    <Shell title={t.title} screen="task">
      <p className={s.muted}>{t.kind === 'workshop' ? 'Workshop practice (week 0)' : `Week ${t.week}`}{done ? ' · submitted' : ''}</p>
      <section className={s.card}><h2>{tx('task.your_task')}</h2><p className={s.prewrap}>{t.prompt}</p></section>
      {!v.ai.available && v.ai.notice && <div className={s.notice} role="status">{v.ai.notice}</div>}
      {v.checked.length > 0 && <section className={s.card} aria-labelledby="checked-h"><h2 id="checked-h">{tx('task.checked')}</h2>
        <p className={s.muted}>Checked by a sector expert. If something is wrong or unhelpful, flag it.</p>
        <ul className={s.list}>{items.map(i => <li key={i.id}><strong>{i.title}</strong><p>{i.body}</p>
          <details><summary>Flag this as wrong or unhelpful</summary><ActionForm id={`flag-${i.id}`} action="pack.flag" params={{memberId: t.member_id, itemId: i.id}} fields={[{name: 'reason', label: 'What is wrong?', type: 'textarea', required: true, rows: 2}]} submit="Send flag" success="Thank you. The expert will look at it." done="stay" /></details>
          {annotations && <details><summary>Add a note on part of this text</summary><ActionForm id={`ann-${i.id}`} action="annotation.add" params={{itemId: i.id}} fields={[{name: 'quote', label: 'Copy the exact words your note is about', required: true}, {name: 'note', label: 'Your note', type: 'textarea', required: true, rows: 2}]} submit="Save note" success="Saved. The expert sees it next to those words." done="stay" /></details>}</li>)}</ul>
      </section>}
      {!done && <Uploader memberId={t.member_id} taskId={t.id} officer={member?.role === 'officer'} />}
      {files.length > 0 && <section className={s.card}><h2>Your files (only you can see these)</h2><ul className={s.list}>{files.map(f => <li key={f.id}>{f.status === 'complete' ? <a href={`/api/loop/files/${f.id}`}>{f.name}</a> : <>{f.name} (upload not finished)</>} <span className={s.muted}>{Math.ceil(f.size / 1024)} KB</span></li>)}</ul></section>}
      {!done && <Coach taskId={t.id} available={v.ai.available} notice={v.ai.available ? null : v.ai.notice} messages={v.messages as {role: string; body: string}[]} />}
      {!done && voice && <VoiceAttempt memberId={t.member_id} taskId={t.id} />}
      {!done && <section className={s.card}><h2>{tx('task.attempt')}</h2><p className={s.muted}>Write what you did or would do. After this, the coach can give feedback and a worked answer.</p>
        <ActionForm action="task.attempt" params={{taskId: t.id}} fields={[{name: 'body', label: 'My attempt', type: 'textarea', required: true}]} submit="Save my attempt" success="Attempt saved." /></section>}
      {!done ? <section className={s.card}><h2>{tx('task.finish')}</h2>
        <ActionForm action="task.submit" params={{taskId: t.id}} fields={[
          {name: 'note', label: tx('task.note'), type: 'textarea', required: true, rows: 3},
          ...(files.some(f => f.status === 'complete') ? [{name: 'fileId', label: 'Which of your files is the result?', type: 'select' as const, options: [['', 'None'] as [string, string], ...files.filter(f => f.status === 'complete').map(f => [f.id, f.name] as [string, string])]}] : []),
          {name: 'link', label: 'Or a link to your result', type: 'url'},
        ]} submit={tx('task.submit')} success="Submitted. This counts as one practice cycle." /></section>
        : <div className={s.ok}>You submitted this task. <Link href={`/loop/history/${t.member_id}`}>See your history</Link>.</div>}
    </Shell>
  );
}
