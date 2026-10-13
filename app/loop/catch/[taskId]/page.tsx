// ACA-US-4.5: monthly catch-the-AI task; results show caught ÷ shown and what each planted mistake was.
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { catchView } from '@/lib/loop/practice';
import { CatchForm } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Catch({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { db, user } = await pageContext(`/loop/catch/${taskId}`);
  const r = await attempt(() => catchView(db, user, taskId));
  if (!r.ok)
    return (
      <Shell title="Catch the AI" screen="catch">
        <Refused message={r.message} />
      </Shell>
    );
  const v = r.value,
    res = v.result as { shown: number; caught: number; false_marks: number } | null;
  return (
    <Shell title="Catch the AI" screen="catch">
      <p>{v.intro}</p>
      {res ? (
        <>
          <div className={s.ok}>
            You caught {res.caught} of {res.shown} planted mistakes
            {res.false_marks
              ? ` and marked ${res.false_marks} correct part${res.false_marks > 1 ? 's' : ''} as wrong`
              : ''}
            .
          </div>
          <ul className={s.list}>
            {(
              v.segments as { id: string; text: string; planted?: boolean; explanation?: string | null }[]
            ).map((x) => (
              <li key={x.id}>
                {x.planted ? <strong>Planted mistake: </strong> : null}
                {x.text}
                {x.explanation ? <p className={s.muted}>{x.explanation}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <CatchForm taskId={taskId} segments={v.segments} />
      )}
    </Shell>
  );
}
