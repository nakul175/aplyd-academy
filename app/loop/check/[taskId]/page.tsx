// ACA-US-4.3: unaided check. AI help is off for its duration and the learner is told so.
import {Shell, pageContext, attempt, Refused} from '../../shell';
import {startCheck} from '@/lib/loop/practice';
import {ChoiceQuiz} from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Check({params}: {params: Promise<{taskId: string}>}) {
  const {taskId} = await params;
  const {db, user} = await pageContext(`/loop/check/${taskId}`);
  const result = await db.prepare('SELECT r.score, r.max_score FROM loop_check_results r JOIN loop_tasks t ON t.id=r.task_id JOIN loop_members m ON m.id=t.member_id WHERE r.task_id=? AND m.user_id=?').bind(taskId, user.userId).first<{score: number; max_score: number}>();
  if (result) return <Shell title="Unaided check" screen="check"><div className={s.ok}>Your result: {result.score} of {result.max_score}. This is for you and the programme to see real skill; it is not a grade.</div></Shell>;
  const r = await attempt(() => startCheck(db, user, taskId));
  if (!r.ok) return <Shell title="Unaided check" screen="check"><Refused message={r.message} /></Shell>;
  return (
    <Shell title="Unaided check" screen="check">
      <div className={s.notice} role="status">{r.value.notice}</div>
      <ChoiceQuiz action="check.finish" params={{taskId}} questions={r.value.questions} submit="Finish the check" done={`/loop/check/${taskId}`} />
    </Shell>
  );
}
