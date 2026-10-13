// ACA-US-2.3: placement check on a phone; the learner sees the level and can ask a facilitator to review it.
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { placementQuestions, currentLevel, levelLabel } from '@/lib/loop/levels';
import { ChoiceQuiz, ActionForm } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Placement({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { db, user } = await pageContext(`/loop/placement/${memberId}`);
  const qs = await attempt(() => placementQuestions(db, user, memberId));
  if (!qs.ok)
    return (
      <Shell title="Placement check" screen="placement">
        <Refused message={qs.message} />
      </Shell>
    );
  const level = await currentLevel(db, memberId);
  return (
    <Shell title="Placement check" screen="placement">
      {level ? (
        <>
          <div className={s.ok}>
            Your AI level is <strong>{await levelLabel(db, level.level)}</strong>. Tasks and live sessions use
            this level, not your job title.
          </div>
          <section className={s.card}>
            <h2>Does this level feel wrong?</h2>
            <ActionForm
              action="level.request"
              params={{ memberId }}
              fields={[
                {
                  name: 'reason',
                  label: 'Tell the facilitator why',
                  type: 'textarea',
                  required: true,
                  rows: 3,
                },
              ]}
              submit="Ask for a review"
              success="Sent. A facilitator will review your level."
              done="stay"
            />
          </section>
        </>
      ) : (
        <>
          <p>
            A few quick questions about how you use AI today. There are no right or wrong answers, and this is
            not a test or a grade.
          </p>
          <ChoiceQuiz
            action="placement.submit"
            params={{ memberId }}
            questions={qs.value}
            submit="See my level"
            done={`/loop/placement/${memberId}`}
          />
        </>
      )}
    </Shell>
  );
}
