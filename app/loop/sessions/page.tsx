// ACA-US-8.1: my invitations to live sessions at my level, and their follow-up threads.
import Link from 'next/link';
import { Shell, pageContext } from '../shell';
import { mySessions } from '@/lib/loop/community';
import s from '../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Sessions() {
  const { db, user } = await pageContext('/loop/sessions');
  const list = (await mySessions(db, user)) as {
    id: string;
    title: string;
    starts_at: string;
    link: string;
    ended_at: string | null;
    thread_id: string | null;
  }[];
  return (
    <Shell title="Live sessions" screen="sessions">
      {list.length === 0 && (
        <p>No sessions yet. You will be invited to sessions for people at your AI level.</p>
      )}
      <ul className={s.list}>
        {list.map((x) => (
          <li key={x.id}>
            <strong>{x.title}</strong>
            <br />
            {x.starts_at.slice(0, 16).replace('T', ' ')} UTC ·{' '}
            {x.ended_at ? (
              'ended'
            ) : (
              <a href={x.link} rel="noreferrer">
                Join the call
              </a>
            )}
            {x.thread_id && (
              <>
                {' '}
                · <Link href={`/loop/thread/${x.thread_id}`}>Follow-up thread</Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
