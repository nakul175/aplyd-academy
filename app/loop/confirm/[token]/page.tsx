// ACA-US-10.1: a supervisor or peer confirms or declines a changed task. No account needed; they see only what the
// learner chose to share.
import {env} from '@/lib/platform-env';
import {openConfirmation} from '@/lib/loop/evidence';
import {Shell, attempt, Refused} from '../../shell';
import {ConfirmButtons} from './confirm-buttons';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Confirm({params}: {params: Promise<{token: string}>}) {
  const {token} = await params;
  if (!env.DB) throw new Error('The Academy database is unavailable.');
  const db = env.DB;
  const r = await attempt(() => openConfirmation(db, token));
  if (!r.ok) return <Shell title="Confirm a change in work" screen="confirm"><Refused message={r.message} /></Shell>;
  return (
    <Shell title="Confirm a change in work" screen="confirm">
      <p>{r.value.learner} asks you, as their {r.value.relation}, to confirm this change in their work:</p>
      <blockquote className={`${s.card} ${s.prewrap}`}>{r.value.shared}</blockquote>
      <p className={s.muted}>This is all they shared with you. Your answer is used only to count confirmed changes in work across the programme.</p>
      <ConfirmButtons token={token} />
    </Shell>
  );
}
