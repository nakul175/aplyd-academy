// Guided set-up for an APLYD operator running a pilot alone: one form creates the workshop, then three plain steps
// (draft the tasks, review them, test the coach). Everything else stays in Operations for later.
import Link from 'next/link';
import { Shell, pageContext } from '../shell';
import { operatorRole } from '@/lib/loop/core';
import { aiEnabled } from '@/lib/ai/provider';
import { ActionButton, ActionForm } from '../client';
import s from '../loop.module.css';
export const dynamic = 'force-dynamic';

type Cohort = {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  pack_id: string | null;
  workshop_date: string | null;
};

export default async function Setup() {
  const { db, user } = await pageContext('/loop/setup');
  if (!(await operatorRole(db, user.userId)))
    return (
      <Shell title="Set up a workshop" screen="home">
        <p>Only APLYD staff can set up a workshop. Open the invite link your association sent you.</p>
      </Shell>
    );
  const cohort = await db
    .prepare(
      `SELECT c.id, c.name, c.org_id, o.name AS org_name, c.pack_id, c.workshop_date FROM loop_cohorts c
       JOIN loop_orgs o ON o.id=c.org_id ORDER BY c.created_at DESC LIMIT 1`,
    )
    .first<Cohort>();
  const today = new Date().toISOString().slice(0, 10);
  const newWorkshop = (
    <ActionForm
      id="setup"
      action="setup.workshop"
      fields={[
        {
          name: 'orgName',
          label: 'Association name',
          required: true,
          hint: 'For example: Tiruppur Exporters Association',
        },
        { name: 'sector', label: 'Sector', required: true, value: 'textile' },
        { name: 'cohortName', label: 'Workshop name', value: 'Workshop 1' },
        { name: 'workshopDate', label: 'Workshop date', type: 'date', value: today, required: true },
        {
          name: 'list',
          label: 'Staff list',
          type: 'textarea',
          rows: 6,
          required: true,
          hint: 'One person per line: name, email, job role. Example: Asha Rao, asha@example.com, merchandiser',
        },
      ]}
      submit="Create the workshop and send invites"
      success="Workshop created. Invites sent."
    />
  );
  if (!cohort)
    return (
      <Shell title="Set up a workshop" screen="home">
        <section className={s.card}>
          <h2>1. The workshop</h2>
          <p className={s.muted}>
            This creates the association, makes you its admin, creates the workshop and emails each person a
            link to join. Nothing else is needed for this step.
          </p>
          {newWorkshop}
        </section>
      </Shell>
    );

  const people = await db
    .prepare(
      `SELECT count(*) n, sum(status='joined') joined FROM loop_members WHERE cohort_id=? AND role NOT IN ('admin','facilitator')`,
    )
    .bind(cohort.id)
    .first<{ n: number; joined: number }>();
  const roles = (
    await db
      .prepare(
        `SELECT DISTINCT job_role FROM loop_members WHERE cohort_id=? AND job_role IS NOT NULL AND job_role<>'' ORDER BY job_role`,
      )
      .bind(cohort.id)
      .all<{ job_role: string }>()
  ).results.map((r) => r.job_role);
  const items = cohort.pack_id
    ? await db
        .prepare(
          `SELECT sum(status='unchecked') unchecked, sum(status='approved') approved, count(*) n FROM loop_pack_items WHERE pack_id=?`,
        )
        .bind(cohort.pack_id)
        .first<{ unchecked: number; approved: number; n: number }>()
    : null;
  const version = cohort.pack_id
    ? await db
        .prepare(`SELECT max(version) v FROM loop_pack_versions WHERE pack_id=?`)
        .bind(cohort.pack_id)
        .first<{ v: number | null }>()
    : null;
  const evalPassed =
    ((await db.prepare(`SELECT count(*) n FROM loop_eval_runs WHERE passed=1`).first<{ n: number }>())?.n ??
      0) > 0;
  const lastEval = await db
    .prepare(`SELECT passed, at FROM loop_eval_runs ORDER BY at DESC LIMIT 1`)
    .first<{ passed: number; at: string }>();
  const ai = aiEnabled();
  const published = (version?.v ?? 0) > 0;
  const drafted = (items?.n ?? 0) > 0;

  return (
    <Shell title={`Set up: ${cohort.org_name}`} screen="home">
      <section className={s.card}>
        <h2>✓ 1. The workshop</h2>
        <p>
          {cohort.name}
          {cohort.workshop_date ? ` on ${cohort.workshop_date}` : ''}: {people?.n ?? 0} people invited,{' '}
          {people?.joined ?? 0} joined. <Link href={`/loop/cohort/${cohort.id}`}>See people or add more</Link>
        </p>
      </section>

      <section className={s.card}>
        <h2>{published ? '✓ ' : ''}2. The practice tasks</h2>
        {published ? (
          <p>
            Version {version?.v} is live. Learners get their weekly task from it.{' '}
            <Link href={`/loop/review/${cohort.pack_id}`}>Change tasks</Link>
          </p>
        ) : drafted ? (
          <>
            <p>
              The AI drafted {items?.n} items. Read each one, approve or fix it, then press “Publish a new
              version”. Learners see nothing until you publish.
            </p>
            <p>
              <Link className={s.button} href={`/loop/review/${cohort.pack_id}`}>
                Review {items?.unchecked ?? 0} drafted items
              </Link>
            </p>
          </>
        ) : !ai ? (
          <p className={s.notice} role="status">
            AI is not switched on for this server yet (no AI key), so tasks cannot be drafted. Add the key,
            then come back here.
          </p>
        ) : (
          <>
            <p className={s.muted}>
              Tell the AI who will practise and what about. It drafts short tasks and rules; you check every
              one before anyone sees it.
            </p>
            <ActionForm
              id="draft"
              action="setup.draftPack"
              params={{ packId: cohort.pack_id }}
              fields={[
                {
                  name: 'roles',
                  label: 'Job roles',
                  required: true,
                  value: roles.join(', '),
                  hint: 'Taken from the staff list. Separate with commas.',
                },
                {
                  name: 'focus',
                  label: 'What should they practise?',
                  type: 'textarea',
                  rows: 3,
                  hint: 'For example: checking supplier invoices, writing buyer emails, costing an order',
                },
                {
                  name: 'sources',
                  label: 'Sources the AI may use',
                  type: 'textarea',
                  rows: 3,
                  hint: 'One per line: title | link. Leave empty to use only your description.',
                },
              ]}
              submit="Draft the tasks with AI"
              success="Drafted. Review them now."
            />
          </>
        )}
      </section>

      <section className={s.card}>
        <h2>{evalPassed ? '✓ ' : ''}3. The AI coach safety test</h2>
        {evalPassed ? (
          <p>Passed. The coach can help learners.</p>
        ) : !ai ? (
          <p className={s.muted}>
            Waits for the AI key, like step 2. Until it passes, learners practise without the coach.
          </p>
        ) : (
          <>
            <p className={s.muted}>
              Checks that the coach gives hints before answers and refuses what it should. Takes about a
              minute.
              {lastEval &&
                !lastEval.passed &&
                ' The last run did not pass; see Operations, AI assurance, for which cases failed.'}
            </p>
            <ActionButton action="eval.run" params={{}} label="Run the safety test" />
          </>
        )}
      </section>

      <section className={s.card}>
        <h2>{published && (people?.joined ?? 0) > 0 ? '✓ ' : ''}4. Learners join</h2>
        <p className={s.muted}>
          Each person got an email with a join link. After joining they do a 5-question check and get their
          first task. You can resend an invite from{' '}
          <Link href={`/loop/cohort/${cohort.id}`}>the people list</Link>.
        </p>
        <p className={s.muted}>
          On the workshop day, start the practice session so everyone gets the same first task in the room.
        </p>
        <p>
          <Link className={s.button} href={`/loop/facilitate/${cohort.id}`}>
            Run the workshop session
          </Link>
        </p>
      </section>

      <details className={s.card}>
        <summary>Set up another workshop</summary>
        {newWorkshop}
      </details>
      <p className={s.muted}>
        Everything else (reports, decisions, billing) is in <Link href="/loop/ops">Operations</Link>.
      </p>
    </Shell>
  );
}
