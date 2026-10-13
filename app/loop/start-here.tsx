// "Start here" for APLYD operators: the five things that must exist before a cohort can practise, in order, each
// with one link and a tick when done. Read-only: it only counts rows; every action happens on the linked screen.
import Link from 'next/link';
import type { Db } from '@/lib/loop/core';
import s from './loop.module.css';

type Step = { title: string; why: string; href: string; cta: string; done: boolean };

async function count(db: Db, sql: string) {
  return (await db.prepare(sql).first<{ n: number }>())?.n ?? 0;
}

export async function StartHere({ db }: { db: Db }) {
  const firstOrg = await db
    .prepare(`SELECT id FROM loop_orgs ORDER BY created_at LIMIT 1`)
    .first<{ id: string }>();
  const firstCohort = await db
    .prepare(`SELECT id FROM loop_cohorts ORDER BY created_at LIMIT 1`)
    .first<{ id: string }>();
  const orgs = await count(db, `SELECT count(*) n FROM loop_orgs`);
  const admins = await count(
    db,
    `SELECT count(*) n FROM loop_members WHERE role='admin' AND status='joined'`,
  );
  const cohorts = await count(db, `SELECT count(*) n FROM loop_cohorts`);
  const learners = await count(
    db,
    `SELECT count(*) n FROM loop_members WHERE role NOT IN ('admin','facilitator') AND status IN ('invited','joined')`,
  );
  const packs = await count(db, `SELECT count(*) n FROM loop_cohorts WHERE pack_id IS NOT NULL`);
  const evalPassed = await count(db, `SELECT count(*) n FROM loop_eval_runs WHERE passed=1`);

  const steps: Step[] = [
    {
      title: 'Add the association',
      why: 'The organisation whose staff will practise, for example the textile association.',
      href: '/loop/ops#organisations',
      cta: 'Add organisation',
      done: orgs > 0,
    },
    {
      title: 'Name its admin',
      why: 'The person who uploads the staff list. Use your own email if you run the pilot yourself.',
      href: '/loop/ops#organisations',
      cta: 'Invite admin',
      done: admins > 0,
    },
    {
      title: 'Create the cohort and upload the staff list',
      why: 'One cohort per workshop. Paste name, email and job role, one person per line.',
      href: firstOrg ? `/loop/org/${firstOrg.id}` : '/loop/ops#organisations',
      cta: cohorts ? 'Upload staff list' : 'Create cohort',
      done: cohorts > 0 && learners > 0,
    },
    {
      title: 'Give the cohort a context pack',
      why: 'The weekly tasks come from this pack. Draft it with AI, review it, then attach it to the cohort.',
      href: '/loop/ops#packs',
      cta: 'Make the pack',
      done: packs > 0,
    },
    {
      title: 'Test the AI coach',
      why: 'The coach helps learners only after it passes the safety test (hints first, refuses what it should).',
      href: '/loop/ops#ai',
      cta: 'Run the test',
      done: evalPassed > 0,
    },
  ];
  const next = steps.findIndex((x) => !x.done);
  return (
    <section className={s.card} aria-labelledby="start-here">
      <h2 id="start-here">Start here</h2>
      <p className={s.muted}>
        {next === -1
          ? 'Everything is ready. Learners can join from their invite email.'
          : `Step ${next + 1} of ${steps.length}. Do these in order; each one unlocks the next.`}
        {firstCohort && (
          <>
            {' '}
            <Link href={`/loop/ops/cohort/${firstCohort.id}`}>See cohort progress</Link>
          </>
        )}
      </p>
      <ol className={s.list}>
        {steps.map((x, i) => (
          <li key={x.title} aria-current={i === next ? 'step' : undefined}>
            <strong>
              {x.done ? '✓ ' : ''}
              {x.title}
            </strong>
            {!x.done && (
              <>
                <br />
                <span className={s.muted}>{x.why}</span>
                {i === next && (
                  <>
                    <br />
                    <Link className={s.button} href={x.href}>
                      {x.cta}
                    </Link>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
