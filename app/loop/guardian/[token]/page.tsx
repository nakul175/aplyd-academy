// ACA-US-11.2: a parent or guardian gives, refuses or later withdraws consent for their child. No account needed.
import {env} from '@/lib/platform-env';
import {openGuardianRequest} from '@/lib/loop/students';
import {Shell, attempt, Refused} from '../../shell';
import {GuardianButtons} from './guardian-buttons';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Guardian({params}: {params: Promise<{token: string}>}) {
  const {token} = await params;
  if (!env.DB) throw new Error('The Academy database is unavailable.');
  const db = env.DB;
  const r = await attempt(() => openGuardianRequest(db, token));
  if (!r.ok) return <Shell title="Consent for your child" screen="guardian"><Refused message={r.message} /></Shell>;
  const v = r.value;
  return (
    <Shell title="Consent for your child" screen="guardian">
      <p>{v.school} would like {v.child ?? 'your child'} to practise with Aplyd Academy. The school decides how your child’s data is used; APLYD processes it only on the school’s instructions.</p>
      {v.notice ? <section className={s.card}><h2>How your child’s data is used</h2><div className={s.prewrap}>{v.notice.body}</div><p className={s.muted}>Notice version {v.notice.version}</p></section> : <div className={s.notice}>The school’s notice is not available yet. Please contact the school before you decide.</div>}
      <GuardianButtons token={token} status={v.status} />
    </Shell>
  );
}
