// Practice loop home: what each of my roles needs this week.
import Link from 'next/link';
import {Shell, pageContext} from './shell';
import {myMemberships, operatorRole, LEARNER_ROLES, type Member} from '@/lib/loop/core';
import {currentLevel, levelLabel, accessStatus} from '@/lib/loop/levels';
import {ensureWeeklyTask, ensureWorkshopTask} from '@/lib/loop/practice';
import {reviewerRole} from '@/lib/loop/packs';
import {ActionButton} from './client';
import type {Db} from '@/lib/loop/core';
import s from './loop.module.css';
export const dynamic = 'force-dynamic';

async function LearnerCard({db, m, userId}: {db: Db; m: Member & {org_name: string}; userId: string}) {
  const actor = {userId};
  const level = await currentLevel(db, m.id);
  const access = await accessStatus(db, m);
  const workshopTask = await ensureWorkshopTask(db, actor, m.id).catch(() => null);
  const weekly = level ? await ensureWeeklyTask(db, actor, m.id).catch((e: Error) => ({state: 'error' as const, message: e.message})) : null;
  const checks = (await db.prepare(`SELECT id, title FROM loop_tasks WHERE member_id=? AND kind='check' AND status='open'`).bind(m.id).all<{id: string; title: string}>()).results;
  return (
    <section className={s.card} aria-labelledby={`m-${m.id}`}>
      <h2 id={`m-${m.id}`}>{m.org_name}</h2>
      {access.ends && <p>Your practice access runs until <strong>{access.ends}</strong>.</p>}
      {access.endingSoon && <div className={s.notice} role="status">Your access ends on {access.ends} ({access.daysLeft} days). Your data stays as described in the privacy notice, and you can download it any time from <Link href="/loop/settings">Settings</Link>.</div>}
      {!access.active && <div className={s.notice} role="status">Your practice access has ended. You can still see your history and download your data.</div>}
      {!level ? <p><Link className={s.button} href={`/loop/placement/${m.id}`}>Take the 3-minute placement check</Link></p>
        : <p>Your AI level: <span className={s.pill}>{await levelLabel(db, level.level)}</span></p>}
      {workshopTask && <p><Link className={s.button} href={`/loop/task/${workshopTask}`}>Workshop: your first practice task</Link></p>}
      {weekly && 'state' in weekly && weekly.state === 'ready' && <p><Link className={s.button} href={`/loop/task/${weekly.taskId}`}>This week’s practice task (week {weekly.week})</Link></p>}
      {weekly && weekly.state === 'not_started' && <p>Your weekly practice starts on {weekly.startsOn}.</p>}
      {weekly && weekly.state === 'no_task_yet' && <p>Your task for this week is being prepared. Check back soon.</p>}
      {weekly && weekly.state === 'error' && <p className={s.muted}>{weekly.message}</p>}
      {checks.map(c => <p key={c.id}><Link className={s.button} href={`/loop/check/${c.id}`}>Unaided check: {c.title}</Link></p>)}
      {level && access.active && <div className={s.row}><ActionButton action="catch.open" params={{memberId: m.id}} label="This month’s catch-the-AI task" done="go:/loop/catch/{taskId}" secondary /></div>}
      <p className={s.row}><Link href={`/loop/history/${m.id}`}>My practice history</Link> · <Link href="/loop/sessions">Live sessions</Link> · {m.cohort_id && <Link href={`/loop/community/${m.cohort_id}`}>Cohort community</Link>} · <Link href="/loop/settings">Settings and my data</Link></p>
    </section>
  );
}

export default async function LoopHome() {
  const {db, user} = await pageContext('/loop');
  const memberships = await myMemberships(db, user.userId);
  const op = await operatorRole(db, user.userId);
  const packs = (await db.prepare('SELECT p.id, p.title FROM loop_packs p JOIN loop_pack_reviewers r ON r.pack_id=p.id WHERE r.user_id=?').bind(user.userId).all<{id: string; title: string}>()).results;
  const learner = memberships.filter(m => (LEARNER_ROLES as readonly string[]).includes(m.role));
  const staff = memberships.filter(m => !(LEARNER_ROLES as readonly string[]).includes(m.role));
  const cohorts = staff.length ? (await db.prepare(`SELECT id, org_id, name FROM loop_cohorts WHERE org_id IN (SELECT value FROM json_each(?)) ORDER BY created_at`).bind(JSON.stringify(staff.map(m => m.org_id))).all<{id: string; org_id: string; name: string}>()).results : [];
  return (
    <Shell title="Your practice" screen="home">
      {learner.map(m => <LearnerCard key={m.id} db={db} m={m} userId={user.userId} />)}
      {staff.map(m => (
        <section key={m.id} className={s.card}>
          <h2>{m.org_name} <span className={s.pill}>{m.role}</span></h2>
          {m.role === 'admin' && <p><Link href={`/loop/org/${m.org_id}`}>Organisation and cohorts</Link></p>}
          <ul className={s.list}>{cohorts.filter(c => c.org_id === m.org_id).map(c => <li key={c.id}>{c.name}: {m.role === 'admin' && <Link href={`/loop/cohort/${c.id}`}>Enrol and progress</Link>}{m.role === 'facilitator' && <Link href={`/loop/facilitate/${c.id}`}>Facilitate</Link>}{m.role === 'facilitator' && <> · <Link href={`/loop/community/${c.id}`}>Sessions and community</Link></>}</li>)}</ul>
        </section>
      ))}
      {packs.length > 0 && <section className={s.card}><h2>Packs you review</h2><ul className={s.list}>{packs.map(p => <li key={p.id}><Link href={`/loop/review/${p.id}`}>{p.title}</Link></li>)}</ul></section>}
      {op && <section className={s.card}><h2>APLYD {op}</h2><p><Link href="/loop/ops">Operations</Link></p></section>}
      {!memberships.length && !op && !packs.length && <p>You have not joined a programme yet. Open the invite link your association sent you.</p>}
    </Shell>
  );
}
