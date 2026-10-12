// Report view with owner approval and decision recording. A report never records a decision or sends itself.
import {Shell, pageContext, attempt, Refused} from '../../../shell';
import {getReport} from '@/lib/loop/metrics';
import {operatorRole} from '@/lib/loop/core';
import {ActionForm, ActionButton} from '../../../client';
import s from '../../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Report({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const {db, user} = await pageContext(`/loop/ops/reports/${id}`);
  const r = await attempt(() => getReport(db, user, id));
  if (!r.ok) return <Shell title="Report" screen="report"><Refused message={r.message} /></Shell>;
  const rep = r.value, owner = (await operatorRole(db, user.userId)) === 'owner';
  return (
    <Shell title={rep.body.title ?? rep.kind} screen="report">
      <p className={s.muted}>{rep.kind} · prepared {rep.created_at.slice(0, 16)} · {rep.approved_at ? `approved ${rep.approved_at.slice(0, 10)}` : 'draft, not approved'}{rep.shared_at ? ` · shared ${rep.shared_at.slice(0, 10)} (${rep.shared_note})` : ''}</p>
      {rep.body.ruleOutcome && <div className={s.notice}>{rep.body.rule}<br /><strong>{rep.body.ruleOutcome}</strong></div>}
      <pre className={`${s.card} ${s.prewrap}`}>{JSON.stringify(rep.body, null, 2)}</pre>
      {owner && rep.kind === 'week6' && <section className={s.card}><h2>Your A-01 decision</h2><ActionForm action="a01.decide" params={{reportId: id}} fields={[{name: 'decision', label: 'Decision', type: 'select', options: [['continue', 'Continue'], ['redesign', 'Redesign before another cohort']]}, {name: 'source', label: 'Note (optional)'}]} submit="Record my decision" done="stay" success="Recorded and linked to the strategy’s learning section." /></section>}
      {owner && !rep.approved_at && <ActionButton action="report.approve" params={{reportId: id}} label="Approve this report" />}
      {owner && rep.approved_at && !rep.shared_at && <ActionForm action="report.shared" params={{reportId: id}} fields={[{name: 'note', label: 'Shared with (after you sent it yourself)', required: true}]} submit="Record that I shared it" />}
    </Shell>
  );
}
