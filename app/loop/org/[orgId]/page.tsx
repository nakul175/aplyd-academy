// ACA-US-2.5: the admin lands on their organisation, creates cohorts and invites facilitators and experts.
import Link from 'next/link';
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { requireRole, decision } from '@/lib/loop/core';
import { renewalOffer } from '@/lib/loop/billing';
import { schoolReminderDigest } from '@/lib/loop/students';
import { headers } from 'next/headers';
import { ActionForm, ActionButton } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Org({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { db, user } = await pageContext(`/loop/org/${orgId}`);
  const ok = await attempt(() =>
    requireRole(db, user, orgId, ['admin'], 'org.view', { allowOperator: true }),
  );
  if (!ok.ok)
    return (
      <Shell title="Organisation" screen="org">
        <Refused message={ok.message} />
      </Shell>
    );
  const org = (await db
    .prepare('SELECT name, kind, sector FROM loop_orgs WHERE id=?')
    .bind(orgId)
    .first<{ name: string; kind: string; sector: string }>())!;
  const cohorts = (
    await db
      .prepare(
        `SELECT c.id, c.name, c.workshop_date, (SELECT count(*) FROM loop_members m WHERE m.cohort_id=c.id AND m.status='joined') joined FROM loop_cohorts c WHERE c.org_id=? ORDER BY c.created_at`,
      )
      .bind(orgId)
      .all<{ id: string; name: string; workshop_date: string | null; joined: number }>()
  ).results;
  const staff = (
    await db
      .prepare(
        `SELECT name, role, status FROM loop_members WHERE org_id=? AND role IN ('admin','facilitator','expert','reviewer') AND status!='removed' ORDER BY role, name`,
      )
      .bind(orgId)
      .all<{ name: string; role: string; status: string }>()
  ).results;
  const scope = await decision<{ epics: string[] }>(db, 'scope.release');
  const offer = scope?.value.epics?.includes('ACA-E21')
    ? await renewalOffer(db, user, orgId).catch(() => null)
    : null;
  const origin =
    process.env.ACADEMY_PUBLIC_ORIGIN ?? `http://${(await headers()).get('host') ?? 'localhost'}`;
  const teachers =
    org.kind === 'school'
      ? (
          await db
            .prepare(
              `SELECT id, name FROM loop_members WHERE org_id=? AND role='teacher' AND status='joined' ORDER BY name`,
            )
            .bind(orgId)
            .all<{ id: string; name: string }>()
        ).results
      : [];
  const digests =
    org.kind === 'school'
      ? await Promise.all(
          cohorts.map(async (c) => ({
            c,
            d: await schoolReminderDigest(db, user, c.id, origin).catch(() => null),
          })),
        )
      : [];
  return (
    <Shell title={org.name} screen="org">
      <p className={s.muted}>
        {org.kind} · {org.sector}
      </p>
      <section className={s.card}>
        <h2>Cohorts</h2>
        {cohorts.length === 0 ? (
          <p>No cohort yet. Create the first one below.</p>
        ) : (
          <ul className={s.list}>
            {cohorts.map((c) => (
              <li key={c.id}>
                <Link href={`/loop/cohort/${c.id}`}>{c.name}</Link>{' '}
                <span className={s.muted}>
                  workshop {c.workshop_date ?? 'not set'} · {c.joined} joined
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3>New cohort</h3>
        <ActionForm
          action="cohort.create"
          params={{ orgId }}
          fields={[
            { name: 'name', label: 'Cohort name', required: true },
            {
              name: 'workshopDate',
              label: 'Workshop date',
              type: 'date',
              hint: 'Practice access lasts one year from this date.',
            },
          ]}
          submit="Create cohort"
          done="go:/loop/cohort/{id}"
        />
      </section>
      {org.kind === 'school' && (
        <section className={s.card}>
          <h2>Classes and reminders</h2>
          <p className={s.muted}>
            APLYD never messages students. Relay this week’s reminder on the school’s own channel.
          </p>
          {digests.map(
            ({ c, d }) =>
              d && (
                <div key={c.id}>
                  <h3>{c.name}</h3>
                  <p>{d.message}</p>
                  <p className={s.muted}>
                    Not practised this week:{' '}
                    {d.students.map((x) => `${x.name} (${x.class})`).join(', ') || 'everyone has practised'}
                  </p>
                </div>
              ),
          )}
          {teachers.length > 0 && (
            <ActionForm
              id="cls"
              action="class.assign"
              params={{ orgId }}
              fields={[
                {
                  name: 'teacherMemberId',
                  label: 'Teacher',
                  type: 'select',
                  options: teachers.map((t) => [t.id, t.name] as [string, string]),
                },
                {
                  name: 'classLabel',
                  label: 'Class',
                  required: true,
                  hint: 'As written in the student list, for example 8A',
                },
              ]}
              submit="Give this teacher the class view"
              done="stay"
              success="Saved."
            />
          )}
        </section>
      )}
      {offer && (
        <section className={s.card}>
          <h2>Renewal</h2>
          {offer.available ? (
            <>
              <p>
                Your access year ends on {offer.ends}. Renewing for {offer.months} months for {offer.learners}{' '}
                learners costs ₹{((offer.amountPaise ?? 0) / 100).toLocaleString('en-IN')}.
              </p>
              <ActionButton action="renewal.accept" params={{ orgId }} label="Accept and get the invoice" />
            </>
          ) : (
            <p>
              The renewal offer opens {'opensInDays' in offer ? offer.opensInDays : ''} days before your
              access year ends on {offer.ends}.
            </p>
          )}
        </section>
      )}
      <section className={s.card}>
        <h2>Staff</h2>
        <ul className={s.list}>
          {staff.map((p, i) => (
            <li key={i}>
              {p.name} <span className={s.pill}>{p.role}</span> <span className={s.muted}>{p.status}</span>
            </li>
          ))}
        </ul>
        <h3>Invite a facilitator or expert</h3>
        <ActionForm
          action="org.invite"
          params={{ orgId }}
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            {
              name: 'role',
              label: 'Role',
              type: 'select',
              options: [
                ['facilitator', 'Facilitator'],
                ['expert', 'Sector expert'],
                ['reviewer', 'Reviewer'],
              ],
            },
          ]}
          submit="Send invite"
          success="Invite sent."
          done="stay"
        />
      </section>
    </Shell>
  );
}
