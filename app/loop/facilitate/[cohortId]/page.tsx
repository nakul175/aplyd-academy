// Facilitator: ACA-US-4.6 workshop session (completion only), ACA-US-5.4 follow-up list, ACA-US-2.3 level reviews,
// ACA-US-4.3 schedule an unaided check, ACA-US-7.3 report an AI incident.
import { Shell, pageContext, attempt, Refused } from '../../shell';
import { workshopView } from '@/lib/loop/practice';
import { followUpList } from '@/lib/loop/reminders';
import { openLevelRequests, levelLabel, type Instrument } from '@/lib/loop/levels';
import { publishedItems } from '@/lib/loop/packs';
import { decision } from '@/lib/loop/core';
import { helpQueue } from '@/lib/loop/help';
import { ActionForm, ActionButton } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Facilitate({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const { db, user } = await pageContext(`/loop/facilitate/${cohortId}`);
  const ws = await attempt(() => workshopView(db, user, cohortId));
  if (!ws.ok)
    return (
      <Shell title="Facilitate" screen="facilitate">
        <Refused message={ws.message} />
      </Shell>
    );
  const cohort = (await db
    .prepare('SELECT name, org_id, pack_id FROM loop_cohorts WHERE id=?')
    .bind(cohortId)
    .first<{ name: string; org_id: string; pack_id: string | null }>())!;
  const live = await db
    .prepare('SELECT started_at FROM loop_workshops WHERE cohort_id=? AND ended_at IS NULL')
    .bind(cohortId)
    .first<{ started_at: string }>();
  const fu = await attempt(() => followUpList(db, user, cohortId));
  const reqs = (await openLevelRequests(db, user, cohort.org_id)) as {
    id: number;
    reason: string;
    name: string;
    level: string;
  }[];
  const bands = (await decision<Instrument>(db, 'placement.instrument'))?.value.bands ?? [];
  const help = (await helpQueue(db, user, cohort.org_id)) as {
    id: number;
    screen: string;
    kind: string;
    body: string;
    at: string;
    name: string | null;
  }[];
  const checks = cohort.pack_id
    ? (await publishedItems(db, cohort.pack_id)).items.filter((i) => i.kind === 'check')
    : [];
  return (
    <Shell title={`Facilitate: ${cohort.name}`} screen="facilitate">
      <section className={s.card} aria-labelledby="ws-h">
        <h2 id="ws-h">Workshop practice session</h2>
        {live ? (
          <>
            <p>
              Session running since {live.started_at.slice(11, 16)} UTC. {ws.value.finished} of{' '}
              {ws.value.total} have finished a first cycle.
            </p>
            <ul className={s.list}>
              {ws.value.participants.map((p, i) => (
                <li key={i}>
                  {p.name}:{' '}
                  <strong>
                    {p.finished ? 'finished' : p.hasTask ? 'working' : 'no task yet (placement not done)'}
                  </strong>
                </li>
              ))}
            </ul>
            <p className={s.muted}>You see who has finished, never anyone’s files or answers.</p>
            <ActionButton action="workshop.end" params={{ cohortId }} label="End the session" secondary />
          </>
        ) : (
          <ActionButton
            action="workshop.start"
            params={{ cohortId }}
            label="Start the workshop practice session"
          />
        )}
      </section>
      <section className={s.card} aria-labelledby="fu-h">
        <h2 id="fu-h">Follow up</h2>
        {!fu.ok ? (
          <p className={s.muted}>{fu.message}</p>
        ) : fu.value.learners.length === 0 ? (
          <p>No one has stopped practising for {fu.value.weeks} weeks or more.</p>
        ) : (
          <ul className={s.list}>
            {fu.value.learners.map((l) => (
              <li key={l.memberId}>
                <strong>{l.name}</strong> · {l.email}
                <br />
                <span className={s.muted}>
                  Last practice {l.lastPractice?.slice(0, 10) ?? 'never'}
                  {l.lastFollowUp
                    ? ` · last follow-up ${l.lastFollowUp.at.slice(0, 10)}: ${l.lastFollowUp.outcome}`
                    : ''}
                </span>
                <details>
                  <summary>Log a follow-up</summary>
                  <ActionForm
                    id={`fu-${l.memberId}`}
                    action="followup.log"
                    params={{ memberId: l.memberId }}
                    fields={[
                      { name: 'outcome', label: 'What happened?', type: 'textarea', required: true, rows: 2 },
                    ]}
                    submit="Save"
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={s.card}>
        <h2>Level reviews</h2>
        {reqs.length === 0 ? (
          <p>No open requests.</p>
        ) : (
          <ul className={s.list}>
            {await Promise.all(
              reqs.map(async (q) => (
                <li key={q.id}>
                  <strong>{q.name}</strong> (now {await levelLabel(db, q.level)}): {q.reason}
                  <ActionForm
                    id={`lv-${q.id}`}
                    action="level.resolve"
                    params={{ requestId: q.id }}
                    fields={[
                      {
                        name: 'level',
                        label: 'Level',
                        type: 'select',
                        options: bands.map((b) => [b.level, b.label] as [string, string]),
                        value: q.level,
                      },
                      { name: 'reason', label: 'Reason', required: true },
                    ]}
                    submit="Save decision"
                  />
                </li>
              )),
            )}
          </ul>
        )}
      </section>
      <section className={s.card}>
        <h2>Unaided checks</h2>
        {checks.length === 0 ? (
          <p>No published check in the pack yet.</p>
        ) : (
          <ul className={s.list}>
            {checks.map((c) => (
              <li key={c.id}>
                {c.title}{' '}
                <ActionButton
                  action="check.schedule"
                  params={{ cohortId, itemId: c.id }}
                  label="Give this check now"
                  secondary
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={s.card} aria-labelledby="help-h">
        <h2 id="help-h">Help requests ({help.length})</h2>
        {help.map((h) => (
          <article key={h.id} className={s.card}>
            <p>
              <strong>#{h.id}</strong> {h.name ?? 'Someone'} · {h.kind} · screen “{h.screen}” ·{' '}
              {h.at.slice(0, 16).replace('T', ' ')}
            </p>
            <p className={s.prewrap}>{h.body}</p>
            <ActionForm
              id={`h-${h.id}`}
              action="help.resolve"
              params={{ id: h.id }}
              fields={[{ name: 'resolution', label: 'What you did', required: true }]}
              submit="Mark resolved"
            />
          </article>
        ))}
      </section>
      <section className={s.card}>
        <h2>Report an AI problem</h2>
        <ActionForm
          action="ai.incident"
          fields={[
            {
              name: 'effect',
              label: 'What happened and who was affected?',
              type: 'textarea',
              required: true,
              rows: 3,
            },
            { name: 'action', label: 'What did you do?', required: true },
          ]}
          submit="Log incident"
          done="stay"
          success="Logged. The product owner can switch AI off if needed."
        />
      </section>
    </Shell>
  );
}
