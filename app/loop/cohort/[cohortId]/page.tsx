// ACA-US-2.1 enrol from a list and watch joins; ACA-US-2.4 start groups; ACA-US-5.3 cadences; ACA-US-6.2 aggregate view.
import {Shell, pageContext, attempt, Refused, fmtShare} from '../../shell';
import {cohortRoster} from '@/lib/loop/enrolment';
import {adminDashboard} from '@/lib/loop/metrics';
import {ActionForm, ActionButton} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

type ShareView = {value: number | null; numerator: number | null; denominator: number | null; suppressed?: boolean; low?: number | null; high?: number | null};

export default async function CohortAdmin({params}: {params: Promise<{cohortId: string}>}) {
  const {cohortId} = await params;
  const {db, user} = await pageContext(`/loop/cohort/${cohortId}`);
  const r = await attempt(() => cohortRoster(db, user, cohortId));
  if (!r.ok) return <Shell title="Cohort" screen="cohort"><Refused message={r.message} /></Shell>;
  const {cohort, members} = r.value as unknown as {cohort: {name: string; workshop_date: string | null}; members: {id: string; name: string; email: string; job_role: string | null; status: string; start_group: string | null}[]};
  const dash = await attempt(() => adminDashboard(db, user, cohortId));
  const joined = members.filter(m => m.status === 'joined').length;
  const kind = (await db.prepare('SELECT o.kind FROM loop_cohorts c JOIN loop_orgs o ON o.id=c.org_id WHERE c.id=?').bind(cohortId).first<{kind: string}>())!.kind;
  return (
    <Shell title={cohort.name} screen="cohort-admin">
      <p className={s.muted}>Workshop {cohort.workshop_date ?? 'date not set'} · {joined} joined · {members.length - joined} invited</p>
      <section className={s.card} aria-labelledby="enrol-h"><h2 id="enrol-h">Enrol members</h2>
        <p>Paste one member per line: <code>name, email, role, mobile (optional)</code>. Members must be 18 or older.</p>
        <ActionForm action="cohort.enrol" params={{cohortId}} fields={[
          ...(kind === 'association' ? [] : [{name: 'role', label: 'Who are they?', type: 'select' as const, options: (kind === 'school' ? [['teacher', 'Teachers'], ['student', 'Students (needs the agreement, legal review and guardian consent)']] : kind === 'university' ? [['faculty', 'Faculty'], ['student', 'Adult students']] : [['officer', 'Officers']]) as [string, string][]}]),
          {name: 'list', label: 'Member list', type: 'textarea', required: true, rows: 8, hint: kind === 'school' ? 'Teachers: name, email, subject. Students: name, email, class, parent or guardian email.' : 'Example: Asha Rao, asha@example.com, accountant, +91 98765 43210'}]} submit="Check and send invites" success="Done. Every valid row was invited (students: their guardian was asked first)." done="refresh" />
      </section>
      <section className={s.card} aria-labelledby="roster-h"><h2 id="roster-h">Invite status</h2>
        <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Scrollable table"><table className={s.table}><thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Start group</th><th scope="col"><span className={s.sr}>Actions</span></th></tr></thead>
          <tbody>{members.map(m => <tr key={m.id}><td>{m.name}<br /><span className={s.muted}>{m.email}</span></td><td>{m.job_role}</td><td>{m.status}</td><td>{m.start_group ?? '–'}</td><td>{m.status === 'invited' && <ActionButton action="cohort.resend" params={{memberId: m.id}} label="Resend invite" secondary />}</td></tr>)}</tbody></table></div>
      </section>
      <section className={s.card}><h2>Start dates and reminder cadences</h2>
        <p className={s.muted}>Staggered starts and cadence comparisons need the product owner’s recorded agreement. Without it everyone starts together.</p>
        <div className={s.row}><ActionButton action="cohort.startGroups" params={{cohortId}} label="Apply start groups" secondary /><ActionButton action="cadence.assign" params={{cohortId}} label="Assign approved cadences" secondary /></div>
      </section>
      <section className={s.card} aria-labelledby="dash-h"><h2 id="dash-h">Progress (aggregates only)</h2>
        {!dash.ok ? <p className={s.muted}>{dash.message}</p> : <>
          <p className={s.muted}>Numbers for your whole cohort. Groups smaller than the minimum size are hidden. No one’s work, answers or files are shown here.</p>
          <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Scrollable table"><table className={s.table}><thead><tr><th scope="col">Week</th><th scope="col">Practised (S-01)</th><th scope="col">With own work file or link (S-02)</th></tr></thead>
            <tbody>{(dash.value.weekly as {week: number; groups: {S01: ShareView; S02: ShareView}[]}[]).map(w => <tr key={w.week}><td>{w.week === 0 ? '0 (workshop)' : w.week}</td><td>{w.groups[0] ? fmtShare(w.groups[0].S01) : '–'}</td><td>{w.groups[0] ? fmtShare(w.groups[0].S02) : '–'}</td></tr>)}</tbody></table></div>
        </>}
      </section>
    </Shell>
  );
}
