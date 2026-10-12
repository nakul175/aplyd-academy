// ACA-US-21.2: a sponsor sees how its funded seats are used, in aggregate only.
import {Shell, pageContext, attempt, Refused, fmtShare} from '../../shell';
import {sponsorUsage} from '@/lib/loop/billing';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

type V = {value: number | null; numerator: number | null; denominator: number | null; suppressed?: boolean};

export default async function Sponsor({params}: {params: Promise<{sponsorId: string}>}) {
  const {sponsorId} = await params;
  const {db, user} = await pageContext(`/loop/sponsor/${sponsorId}`);
  const r = await attempt(() => sponsorUsage(db, user, sponsorId));
  if (!r.ok) return <Shell title="Sponsored seats" screen="sponsor"><Refused message={r.message} /></Shell>;
  return (
    <Shell title="Sponsored seats" screen="sponsor">
      <p className={s.muted}>Group numbers only; small groups are hidden. No individual learner data is shown.</p>
      {(r.value.cohorts as {cohort: string; fundedSeats: number; seatsInUse: V; practice: {week: number; groups: {S01: V}[]}[]}[]).map((c, i) => <section key={i} className={s.card}><h2>{c.cohort}</h2>
        <p>Funded seats: {c.fundedSeats}. Seats in use: {fmtShare(c.seatsInUse)}.</p>
        <ul className={s.list}>{c.practice.map(w => <li key={w.week}>Week {w.week}: practised {w.groups[0] ? fmtShare(w.groups[0].S01) : '–'}</li>)}</ul></section>)}
    </Shell>
  );
}
