'use client';
import {
  buildPartnerDiscussionBrief,
  ONBOARDING_QUESTIONS,
  type PartnerInspection,
} from '../lib/academy-partner-readiness';
import { hasPartnerReviewPack, renderPartnerReviewPack } from '../lib/academy-partner-review-pack.mjs';
import styles from './academy-partner-readiness.module.css';

function downloadBrief(partner: PartnerInspection['partner']) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(buildPartnerDiscussionBrief(partner), null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `aplyd-${partner}-discussion-brief.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadReviewChecklist(partner: PartnerInspection['partner']) {
  if (!hasPartnerReviewPack(partner)) return;
  const url = URL.createObjectURL(
    new Blob([renderPartnerReviewPack(partner)], { type: 'text/html;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `aplyd-${partner}-review-checklist.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Read-only component. Pass the current accepted shell projection on every render. */
export function PartnerReadiness({
  inspection: m,
  onOpenReferences,
}: {
  inspection: PartnerInspection;
  onOpenReferences?: () => void;
}) {
  if (m.scope === 'shared') return null;
  return (
    <details className={styles.inspector} data-partner-inspection={m.partner}>
      <summary>Understand this choice and the next steps</summary>
      <div className={styles.body}>
        <p className={styles.lead}>No live partner connection</p>
        <p>{m.explanation}</p>
        {m.choice && (
          <dl className={styles.facts}>
            <div>
              <dt>Saved local choice</dt>
              <dd>{m.choice.status}</dd>
            </div>
            <div>
              <dt>Allowed purpose</dt>
              <dd>Inspect a return contract inside your personal lab.</dd>
            </div>
            <div>
              <dt>Selected fields</dt>
              <dd>{m.choice.includedFields.join(', ')}</dd>
            </div>
            <div>
              <dt>Local test metadata</dt>
              <dd>
                {m.choice.envelopeFields.join(', ')}. The local receipt also contains internal event and
                enrollment references; these do not link a partner account.
              </dd>
            </div>
            <div>
              <dt>Exact expiry</dt>
              <dd>{m.choice.expiresAt}</dd>
            </div>
            {m.choice.revokedAt && (
              <div>
                <dt>Withdrawn</dt>
                <dd>{m.choice.revokedAt}</dd>
              </div>
            )}
            <div>
              <dt>Pinned learning</dt>
              <dd>
                {m.choice.pathwayId} · {m.choice.contentVersion}
              </dd>
            </div>
          </dl>
        )}
        {m.summary && (
          <section aria-label={`${m.partnerName} current local summary`}>
            <h3>Current local summary</h3>
            <p>
              The server checks these fields again when saving a local test. This inspection uses the browser
              time.
            </p>
            <dl className={styles.facts}>
              {m.summary.learning && (
                <div>
                  <dt>Lesson progress</dt>
                  <dd>
                    {m.summary.learning.completed_lessons} of {m.summary.learning.total_lessons} lessons ·{' '}
                    {m.summary.learning.status}
                  </dd>
                </div>
              )}
              {m.summary.practice_record && (
                <div>
                  <dt>Practice-record status</dt>
                  <dd>
                    {m.summary.practice_record.status} · Non-accredited practice ·{' '}
                    {m.summary.practice_record.review_mode === 'sample-workflow'
                      ? 'Sample review workflow'
                      : 'Not reviewed'}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}
        {m.history.state === 'available' && (
          <p>
            {m.history.receipts} retained local receipt{m.history.receipts === 1 ? '' : 's'} for this
            ecosystem{m.history.lastTestAt ? ` · Latest test ${m.history.lastTestAt}` : ''}. These do not
            establish a current permission, delivery or partner acknowledgement.
          </p>
        )}
        {m.legacyPreference && (
          <p>
            An earlier preview preference is retained. It grants no selected-field, enrollment or expiry
            choice.
          </p>
        )}
        <p>
          <strong>Excluded:</strong> {m.exclusions.join('; ')}.
        </p>
        <h3>Before a live connection can be considered</h3>
        <p>
          The partner and responsible institution need to establish these decisions. This product has no
          partner API specification or receiving account configured.
        </p>
        <ul className={styles.questions}>
          {ONBOARDING_QUESTIONS.map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong>
              <p>{q.detail}</p>
              <small>{q.source}</small>
            </li>
          ))}
        </ul>
        {m.partner === 'health' && (
          <p>
            Health Saha also needs a reviewed domain scope. The reference materials do not grant clinical
            authority or provide a clinical mapping.
          </p>
        )}
        <p>
          Saving, withdrawing or replacing a local choice changes future local tests. It does not retract a
          historical receipt or promise deletion by a partner.
        </p>
        <p>
          The downloads contain generic questions and field definitions. The printable checklist adds open
          decisions, learning limits and source references. They exclude your learning, identity, choice and
          receipt details.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={() => downloadBrief(m.partner)}>
            Download partner discussion brief
          </button>
          {hasPartnerReviewPack(m.partner) && (
            <button type="button" onClick={() => downloadReviewChecklist(m.partner)}>
              Download printable review checklist
            </button>
          )}
          {onOpenReferences && (
            <button type="button" onClick={onOpenReferences}>
              Read the governance references
            </button>
          )}
        </div>
        <p className={styles.note}>
          Teaching references support the discussion. They do not establish institutional approvals,
          permissions or a service-level agreement.
        </p>
      </div>
    </details>
  );
}
