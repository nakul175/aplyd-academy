// ACA-US-4.4-AC2: my practice cycles by week.
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { history } from '@/lib/loop/practice';
import { ActionForm } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function History({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { db, user } = await pageContext(`/loop/history/${memberId}`);
  const r = await attempt(() => history(db, user, memberId));
  if (!r.ok)
    return (
      <Shell title="My practice history" screen="history">
        <Refused message={r.message} />
      </Shell>
    );
  return (
    <Shell title="My practice history" screen="history">
      {r.value.length === 0 && <p>No finished tasks yet.</p>}
      {r.value.map((w) => (
        <section key={w.week} className={s.card}>
          <h2>{w.week === 0 ? 'Workshop (week 0)' : `Week ${w.week}`}</h2>
          <ul className={s.list}>
            {(
              w.cycles as unknown as {
                id: string;
                title: string;
                note: string;
                at: string;
                link: string | null;
                file_id: string | null;
                file_name: string | null;
              }[]
            ).map((c) => (
              <li key={c.id}>
                <strong>{c.title}</strong>
                <p>{c.note}</p>
                <p className={s.muted}>
                  {c.at.slice(0, 10)}
                  {c.link && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={c.link} rel="noreferrer">
                        link
                      </a>
                    </>
                  )}
                  {c.file_id && (
                    <>
                      {' '}
                      · <a href={`/api/loop/files/${c.file_id}`}>{c.file_name}</a>
                    </>
                  )}
                </p>
                <details>
                  <summary>Ask a supervisor or peer to confirm this change</summary>
                  <ActionForm
                    id={`cf-${c.id}`}
                    action="confirm.request"
                    params={{ submissionId: c.id }}
                    fields={[
                      { name: 'email', label: 'Their email', type: 'email', required: true },
                      {
                        name: 'relation',
                        label: 'They are my',
                        type: 'select',
                        options: [
                          ['supervisor', 'Supervisor'],
                          ['peer', 'Peer'],
                        ],
                      },
                      {
                        name: 'sharedText',
                        label: 'What they will see (only this)',
                        type: 'textarea',
                        required: true,
                        rows: 3,
                        hint: 'Describe the change in your own words. Your files and notes are not shown.',
                      },
                    ]}
                    submit="Send request"
                    done="stay"
                    success="Request sent."
                  />
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
