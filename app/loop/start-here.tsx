// "Start here" for APLYD operators: one button into the guided set-up, with where it stands.
import Link from 'next/link';
import type { Db } from '@/lib/loop/core';
import s from './loop.module.css';

export async function StartHere({ db }: { db: Db }) {
  const c = await db
    .prepare(
      `SELECT c.name, o.name AS org,
        (SELECT count(*) FROM loop_members m WHERE m.cohort_id=c.id AND m.role NOT IN ('admin','facilitator')) AS people,
        (SELECT max(version) FROM loop_pack_versions v WHERE v.pack_id=c.pack_id) AS version
       FROM loop_cohorts c JOIN loop_orgs o ON o.id=c.org_id ORDER BY c.created_at DESC LIMIT 1`,
    )
    .first<{ name: string; org: string; people: number; version: number | null }>();
  return (
    <section className={s.card} aria-labelledby="start-here">
      <h2 id="start-here">Start here</h2>
      <p className={s.muted}>
        {c
          ? `${c.org}, ${c.name}: ${c.people} people invited; practice tasks ${c.version ? 'live' : 'not live yet'}.`
          : 'Set up your first workshop: the association, the date and the staff list, in one form.'}
      </p>
      <p>
        <Link className={s.button} href="/loop/setup">
          {c ? 'Continue set-up' : 'Set up a workshop'}
        </Link>
      </p>
    </section>
  );
}
