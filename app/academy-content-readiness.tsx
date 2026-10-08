'use client';
import { FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from './academy-ui';
import type { OperationsDestination } from '@/lib/academy-operations';
import { deriveOperationsContentAttention } from '@/lib/academy-content-readiness-adoption.mjs';

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-IN') : 'Date needs checking';
const labels = {
  retired: 'Retired publication · new enrollment closed',
  publication_review_elapsed: 'Publication review date elapsed',
  publication_review_soon: 'Publication review within seven days',
  publication_date_unknown: 'Publication review date needs checking',
  awaiting_review: 'Awaiting independent owner review',
  approved: 'Approved draft · final publication checks remain',
};
/** Replace the existing owner-only Content review section. No new dashboard.
 * Props are the same current accepted Team projection and observation clock. */
export function OperationsContentAttention({
  team,
  now,
  onOpen,
}: {
  team: any;
  now: string;
  onOpen: (destination: OperationsDestination) => void;
}) {
  const model = deriveOperationsContentAttention(team, now);
  if (!model)
    return (
      <section className="panel operations-panel" aria-labelledby="ops-content-title">
        <h2 id="ops-content-title">Content review</h2>
        <p className="mt">
          The current content snapshot needs checking. Refresh work before opening content actions.
        </p>
      </section>
    );
  return (
    <section className="panel operations-panel" aria-labelledby="ops-content-title">
      <div className="section-title no-top">
        <h2 id="ops-content-title">
          <FileCheck2 aria-hidden="true" size={21} /> Content review
        </h2>
        <Tag>{model.total} attention items</Tag>
      </div>
      <p>
        {model.counts.retired} retired publications · {model.counts.elapsed} elapsed publication review dates
        · {model.counts.waiting} drafts awaiting review.
      </p>
      {(model.counts.authorUnavailable > 0 || model.counts.reviewerUnavailable > 0) && (
        <p className="operations-warning">
          {model.counts.authorUnavailable} drafts have a former author · {model.counts.reviewerUnavailable}{' '}
          assigned reviewers lack current independent owner authority.
        </p>
      )}
      <p className="form-hint">
        Observed {date(model.asOf)}. Dates describe this observation. Refresh before an action; current server
        checks still apply.
      </p>
      <ul className="operations-list">
        {model.items.map((item) => (
          <li key={item.kind + item.id} data-operations-content-id={item.id}>
            <h3>{item.title}</h3>
            <Tag
              tone={
                ['retired', 'publication_review_elapsed', 'publication_date_unknown'].includes(item.state)
                  ? 'warning'
                  : ''
              }
            >
              {labels[item.state]}
            </Tag>
            <p className="form-hint">
              {item.kind === 'publication'
                ? 'Content review date: ' + date(item.reviewDueAt)
                : item.waitingDays === null
                  ? 'Last update date needs checking.'
                  : 'Last draft update ' +
                    item.waitingDays +
                    ' elapsed days ago; this is not a response deadline.'}
            </p>
            {item.reasons.length > 0 && (
              <ul className="mt">
                {item.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {item.affectedCohorts.length > 0 && (
              <div className="mt">
                <p>These cohorts keep this exact saved edition:</p>
                <ul>
                  {item.affectedCohorts.map((cohort) => (
                    <li key={cohort.id}>
                      {cohort.title}
                      {cohort.newEnrollmentBlocked ? ' · new enrollment closed in snapshot' : ''}
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpen({ view: 'teams', section: 'cohorts', id: cohort.id })}
                        >
                          Open {cohort.title}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.reference && (
              <details className="source-packet mt">
                <summary>Exact publication reference</summary>
                <p className="form-hint pre-wrap">
                  {item.reference.scope} · {item.reference.programId} · {item.reference.versionId}
                </p>
                <p className="form-hint pre-wrap">
                  {item.documentHash
                    ? 'SHA256 ' + item.documentHash
                    : 'Stored publication hash needs checking.'}
                </p>
              </details>
            )}
            <p className="form-hint mt">{item.nextStep}</p>
            <Button size="sm" variant="outline" onClick={() => onOpen(item.destination)}>
              Open exact content
            </Button>
          </li>
        ))}
      </ul>
      {model.total > model.items.length && (
        <p className="form-hint mt">
          Showing {model.items.length} of {model.total}. Open the content studio for the full retained list.
        </p>
      )}
      {!model.total && (
        <p className="mt">
          No retained publications or submitted/approved drafts need attention in this view. This is not
          sector approval.
        </p>
      )}
      {model.cohorts.length > 0 && (
        <details className="source-packet mt">
          <summary>Cohorts with paused or uncertain content access ({model.cohorts.length})</summary>
          <ul className="operations-list">
            {model.cohorts.map((cohort) => (
              <li key={cohort.id}>
                <h3>{cohort.title}</h3>
                <p>
                  {cohort.state === 'paused'
                    ? 'Learning and review actions are paused.'
                    : cohort.newContentEnrollment === 'blocked_in_snapshot'
                      ? (cohort.contentNotice ?? 'New content enrollment is closed.')
                      : cohort.newContentEnrollment === 'unknown'
                        ? 'Content enrollment status needs checking.'
                        : 'The exact saved content reference needs checking.'}
                </p>
                <Button size="sm" variant="outline" onClick={() => onOpen(cohort.destination)}>
                  Open cohort
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="form-hint mt">
        Retirement and the server’s current review-date checks govern new enrollment. Existing learners retain
        their saved edition. Pausing learning and review is a separate current-owner action.
      </p>
    </section>
  );
}
