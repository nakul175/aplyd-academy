// ACA-US-11.6: a teacher's own class only, alphabetical, within what the legal review allows. No ranking or profile.
import {Shell, pageContext, attempt, Refused} from '../../shell';
import {classView} from '@/lib/loop/students';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function ClassPage({params}: {params: Promise<{orgId: string}>}) {
  const {orgId} = await params;
  const {db, user} = await pageContext(`/loop/class/${orgId}`);
  const classes = (await db.prepare(`SELECT ct.class_label FROM loop_class_teachers ct JOIN loop_members m ON m.id=ct.teacher_member_id WHERE m.user_id=? AND ct.org_id=? ORDER BY ct.class_label`).bind(user.userId, orgId).all<{class_label: string}>()).results;
  if (!classes.length) return <Shell title="My class" screen="class"><p>No class is assigned to you yet. Ask the school admin.</p></Shell>;
  const views = await Promise.all(classes.map(async c => ({label: c.class_label, r: await attempt(() => classView(db, user, orgId, c.class_label))})));
  return (
    <Shell title="My class" screen="class">
      <p className={s.muted}>Shown in alphabetical order. This is to help students who struggle, not to rank anyone.</p>
      {views.map(v => <section key={v.label} className={s.card}><h2>Class {v.label.toUpperCase()}</h2>
        {!v.r.ok ? <Refused message={v.r.message} /> : <div className={s.tableWrap} tabIndex={0} role="region" aria-label={`Class ${v.label}`}><table className={s.table}><thead><tr><th scope="col">Student</th><th scope="col">Practice cycles</th><th scope="col">Unaided checks</th></tr></thead>
          <tbody>{(v.r.value as {name: string; practiceCycles?: number; checkResults?: string}[]).map((x, i) => <tr key={i}><td>{x.name}</td><td>{x.practiceCycles ?? '–'}</td><td>{x.checkResults || '–'}</td></tr>)}</tbody></table></div>}
      </section>)}
    </Shell>
  );
}
