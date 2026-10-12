// Operator view of one cohort's evidence: S-04 (10.1), interviews (10.3), change list (10.5), cohort comparison (14.2).
import {Shell, pageContext, fmtShare} from '../../../shell';
import {operatorRole} from '@/lib/loop/core';
import {interviewCandidates, s04AtMonths, changeList} from '@/lib/loop/evidence';
import {compareCohorts} from '@/lib/loop/metrics';
import {ActionForm} from '../../../client';
import s from '../../../loop.module.css';
export const dynamic = 'force-dynamic';

type ShareView = {value: number | null; numerator: number | null; denominator: number | null; low?: number | null; high?: number | null};

export default async function CohortEvidence({params}: {params: Promise<{cohortId: string}>}) {
  const {cohortId} = await params;
  const {db, user} = await pageContext(`/loop/ops/cohort/${cohortId}`);
  if (!(await operatorRole(db, user.userId))) return <Shell title="Cohort evidence" screen="ops-cohort"><div className={s.error} role="alert">Only APLYD operators can open this page.</div></Shell>;
  const c = await db.prepare('SELECT c.name, c.org_id, o.name org FROM loop_cohorts c JOIN loop_orgs o ON o.id=c.org_id WHERE c.id=?').bind(cohortId).first<{name: string; org_id: string; org: string}>();
  if (!c) return <Shell title="Cohort evidence" screen="ops-cohort"><div className={s.error}>Cohort not found.</div></Shell>;
  const cand = await interviewCandidates(db, user, cohortId, 3);
  const s04 = await s04AtMonths(db, cohortId).catch((e: Error) => ({error: e.message}));
  const changes = await changeList(db, cohortId) as {id: number; change: string; evidence: string; expected_signal: string; status: string; decision_ref: string; comparison: string | null}[];
  const siblings = (await db.prepare('SELECT id FROM loop_cohorts WHERE org_id=?').bind(c.org_id).all<{id: string}>()).results.map(r => r.id);
  const cmp = await compareCohorts(db, siblings, 'cohort');
  const interviews = (await db.prepare('SELECT id, activity_band, held_at, summary FROM loop_interviews WHERE cohort_id=? ORDER BY held_at').bind(cohortId).all<{id: string; activity_band: string; held_at: string; summary: string | null}>()).results;
  return (
    <Shell title={`Evidence: ${c.org} · ${c.name}`} screen="ops-cohort">
      <section className={s.card}><h2>S-04 confirmed changed work</h2>
        {'error' in s04 ? <p className={s.muted}>{s04.error}</p> : <p>Month 3: {fmtShare(s04.month3[0]?.S04 ?? {value: null, numerator: 0, denominator: 0})} · Month 6: {fmtShare(s04.month6[0]?.S04 ?? {value: null, numerator: 0, denominator: 0})}</p>}
      </section>
      <section className={s.card}><h2>Day-90 interviews</h2>
        <p>{cand.consenting} of {cand.enrolled} learners consented to an interview.</p>
        <h3>Most active (consenting)</h3><ul className={s.list}>{cand.mostActive.map(x => <li key={x.id}>{x.name} · {x.email} · {x.cycles} cycles</li>)}</ul>
        <h3>Least active (consenting)</h3><ul className={s.list}>{cand.leastActive.map(x => <li key={x.id}>{x.name} · {x.email} · {x.cycles} cycles</li>)}</ul>
        <details><summary>Record an interview</summary><ActionForm id="iv" action="interview.record" fields={[{name: 'memberId', label: 'Learner', type: 'select', options: [...cand.mostActive, ...cand.leastActive].map(x => [x.id, x.name] as [string, string])}, {name: 'band', label: 'Group', type: 'select', options: [['most_active', 'Most active'], ['least_active', 'Least active']]}, {name: 'consentConfirmed', label: 'The learner confirmed consent at the start of the interview', type: 'checkbox'}, {name: 'notes', label: 'Notes', type: 'textarea', required: true, rows: 6}]} submit="Save interview" /></details>
        <ul className={s.list}>{interviews.map(i => <li key={i.id}>{i.activity_band} · {i.held_at.slice(0, 10)} · {i.summary ? <span>{i.summary}</span> : <details><summary>Write the anonymised summary</summary><ActionForm id={`sum-${i.id}`} action="interview.summary" params={{id: i.id}} fields={[{name: 'summary', label: 'Summary without names', type: 'textarea', required: true, rows: 3}]} submit="Save summary" /></details>}</li>)}</ul>
      </section>
      <section className={s.card}><h2>Change list after the week-6 decision</h2>
        <ul className={s.list}>{changes.map(x => <li key={x.id}><strong>{x.change}</strong> <span className={s.pill}>{x.status}</span><br /><span className={s.muted}>Evidence: {x.evidence} · expected to move {x.expected_signal} · {x.decision_ref}</span>{x.comparison && <p>Comparison: {x.comparison}</p>}
          <details><summary>Update</summary><ActionForm id={`ch-${x.id}`} action="change.update" params={{id: x.id}} fields={[{name: 'status', label: 'Status', type: 'select', options: [['planned', 'Planned'], ['built', 'Built'], ['compared', 'Compared on the next cohort']], value: x.status}, {name: 'comparison', label: 'Before-and-after comparison', type: 'textarea', rows: 3}]} submit="Save" /></details></li>)}</ul>
        <ActionForm action="change.add" params={{cohortId}} fields={[{name: 'change', label: 'Change', required: true}, {name: 'evidence', label: 'Evidence behind it', required: true}, {name: 'expectedSignal', label: 'Signal expected to move', required: true, hint: 'For example S-01'}]} submit="Add change" done="refresh" />
      </section>
      <section className={s.card}><h2>Cohorts of this organisation compared</h2>
        <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Scrollable table"><table className={s.table}><thead><tr><th scope="col">Week</th>{(cmp.cohorts as {id: string; name: string; loop_version: string}[]).map(x => <th scope="col" key={x.id}>{x.name} ({x.loop_version})</th>)}</tr></thead>
          <tbody>{(cmp.S01_S02 as {week: number; groups: {group: string; S01: ShareView}[]}[]).map(w => <tr key={w.week}><td>{w.week}</td>{(cmp.cohorts as {id: string}[]).map(x => <td key={x.id}>{fmtShare(w.groups.find(g => g.group === x.id)?.S01 ?? {value: null, numerator: 0, denominator: 0})}</td>)}</tr>)}</tbody></table></div>
      </section>
    </Shell>
  );
}
