// ACA-US-2.5: the admin lands on their organisation, creates cohorts and invites facilitators and experts.
import Link from 'next/link';
import {Shell, pageContext, attempt, Refused} from '../../shell';
import {requireRole} from '@/lib/loop/core';
import {ActionForm} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Org({params}: {params: Promise<{orgId: string}>}) {
  const {orgId} = await params;
  const {db, user} = await pageContext(`/loop/org/${orgId}`);
  const ok = await attempt(() => requireRole(db, user, orgId, ['admin'], 'org.view', {allowOperator: true}));
  if (!ok.ok) return <Shell title="Organisation" screen="org"><Refused message={ok.message} /></Shell>;
  const org = (await db.prepare('SELECT name, kind, sector FROM loop_orgs WHERE id=?').bind(orgId).first<{name: string; kind: string; sector: string}>())!;
  const cohorts = (await db.prepare(`SELECT c.id, c.name, c.workshop_date, (SELECT count(*) FROM loop_members m WHERE m.cohort_id=c.id AND m.status='joined') joined FROM loop_cohorts c WHERE c.org_id=? ORDER BY c.created_at`).bind(orgId).all<{id: string; name: string; workshop_date: string | null; joined: number}>()).results;
  const staff = (await db.prepare(`SELECT name, role, status FROM loop_members WHERE org_id=? AND role IN ('admin','facilitator','expert','reviewer') AND status!='removed' ORDER BY role, name`).bind(orgId).all<{name: string; role: string; status: string}>()).results;
  return (
    <Shell title={org.name} screen="org">
      <p className={s.muted}>{org.kind} · {org.sector}</p>
      <section className={s.card}><h2>Cohorts</h2>
        {cohorts.length === 0 ? <p>No cohort yet. Create the first one below.</p> : <ul className={s.list}>{cohorts.map(c => <li key={c.id}><Link href={`/loop/cohort/${c.id}`}>{c.name}</Link> <span className={s.muted}>workshop {c.workshop_date ?? 'not set'} · {c.joined} joined</span></li>)}</ul>}
        <h3>New cohort</h3>
        <ActionForm action="cohort.create" params={{orgId}} fields={[{name: 'name', label: 'Cohort name', required: true}, {name: 'workshopDate', label: 'Workshop date', type: 'date', hint: 'Practice access lasts one year from this date.'}]} submit="Create cohort" done="go:/loop/cohort/{id}" />
      </section>
      <section className={s.card}><h2>Staff</h2>
        <ul className={s.list}>{staff.map((p, i) => <li key={i}>{p.name} <span className={s.pill}>{p.role}</span> <span className={s.muted}>{p.status}</span></li>)}</ul>
        <h3>Invite a facilitator or expert</h3>
        <ActionForm action="org.invite" params={{orgId}} fields={[{name: 'name', label: 'Name', required: true}, {name: 'email', label: 'Email', type: 'email', required: true}, {name: 'role', label: 'Role', type: 'select', options: [['facilitator', 'Facilitator'], ['expert', 'Sector expert'], ['reviewer', 'Reviewer']]}]} submit="Send invite" success="Invite sent." done="stay" />
      </section>
    </Shell>
  );
}
