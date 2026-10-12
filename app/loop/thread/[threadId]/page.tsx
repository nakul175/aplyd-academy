// ACA-US-8.2: a cohort-only follow-up thread; learners report posts, facilitators hide them (audited).
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { readThread } from '@/lib/loop/community';
import { ActionForm, ActionButton } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Thread({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const { db, user } = await pageContext(`/loop/thread/${threadId}`);
  const r = await attempt(() => readThread(db, user, threadId));
  if (!r.ok)
    return (
      <Shell title="Thread" screen="thread">
        <Refused message={r.message} />
      </Shell>
    );
  const v = r.value;
  return (
    <Shell title={v.thread.title} screen="thread">
      <p className={s.muted}>Only your cohort and its facilitators can see this thread.</p>
      <ul className={s.list}>
        {v.posts.map((p) => (
          <li key={p.id}>
            <strong>{p.author_name}</strong>{' '}
            <span className={s.muted}>{p.at.slice(0, 16).replace('T', ' ')}</span>
            <p className={s.prewrap}>{p.body}</p>
            <div className={s.row}>
              {!p.hidden && !v.facilitator && !p.reported && (
                <ActionButton action="thread.report" params={{ postId: p.id }} label="Report" secondary />
              )}
              {v.facilitator && !p.hidden && (
                <ActionButton
                  action="thread.hide"
                  params={{ postId: p.id }}
                  label={p.reported ? 'Hide (reported)' : 'Hide'}
                  secondary
                />
              )}
              {p.hidden && v.facilitator ? <span className={s.pill}>hidden</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <ActionForm
        action="thread.post"
        params={{ threadId }}
        fields={[{ name: 'body', label: 'Your post', type: 'textarea', required: true, rows: 3 }]}
        submit="Post"
        done="refresh"
      />
    </Shell>
  );
}
