'use client';
import { useState } from 'react';
import { Accessibility, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ACCOMMODATION_TYPES,
  ACCOMMODATION_LIMITS,
  accommodationLabel,
  accommodationsForReview,
  assessmentRulesFor,
  describeAssessmentRules,
  ASSESSMENT_METHODS,
  resolveAssessmentMethod,
} from '@/lib/academy-assessment-rules';
import { useAcademy } from './academy-context';
import { Field, Pick, Tag, date, FormError } from './academy-ui';

/** Published retry / appeal / accommodation / method rules, generated from the same data the engine enforces. */
export function AssessmentRulesPanel({ program }: { program: any }) {
  const sections = describeAssessmentRules(assessmentRulesFor(program));
  return (
    <section className="source-packet mt" aria-label="Retries, appeals and accommodations">
      <h3>Retries, appeals and accommodations</h3>
      {sections.map((s) => (
        <div key={s.id}>
          <p className="mt">
            <strong>{s.heading}</strong>
          </p>
          <ul className="outcome-list">
            {s.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Learner view: file a request and read the retained history. */
export function AccommodationRequests({ enrollment: e, paused }: { enrollment: any; paused?: boolean }) {
  const { cmd, busy } = useAcademy(),
    [type, setType] = useState('extra-time'),
    [detail, setDetail] = useState(''),
    items: any[] = e.accommodations ?? [],
    history: any[] = e.accommodationHistory ?? [];
  const other = type === 'other',
    ok = !other || detail.trim().length >= ACCOMMODATION_LIMITS.otherDetailMin;
  return (
    <section className="source-packet mt" aria-label="Accommodation requests">
      <h3>
        <Accessibility size={18} /> Accommodations
      </h3>
      <p className="form-hint">
        An approved accommodation changes how you can show your work. It never lowers the rubric or the pass
        mark. If a scribe or reader helps you, you still read the captured words back before submitting.
      </p>
      {items.length > 0 && (
        <ul className="outcome-list">
          {items.map((a) => (
            <li key={a.id}>
              <strong>{accommodationLabel(a.type)}</strong>{' '}
              <Tag tone={a.status === 'approved' ? 'success' : a.status === 'declined' ? 'warning' : ''}>
                {a.status === 'requested'
                  ? 'Awaiting decision'
                  : a.status === 'approved'
                    ? 'Approved'
                    : 'Declined'}
              </Tag>
              {a.detail && <p className="pre-wrap">{a.detail}</p>}
              {a.decision && (
                <p className="form-hint">
                  {a.decision.actorName || 'Assigned staff'} · {date(a.decision.decidedAt)} ·{' '}
                  {a.decision.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError />
      <div className="field">
        <label>Request type</label>
        <Pick
          label="Accommodation type"
          value={type}
          onChange={setType}
          options={ACCOMMODATION_TYPES.map((t) => ({ value: t.id, label: t.label }))}
        />
      </div>
      <Field
        id="accommodation-detail"
        rows={3}
        label={other ? 'Describe what you need' : 'Anything the decider should know (optional)'}
        help={`Up to ${ACCOMMODATION_LIMITS.detailMax} characters. Shared with assigned staff only.`}
        value={detail}
        onChange={(v: string) => setDetail(v.slice(0, ACCOMMODATION_LIMITS.detailMax))}
      />
      <Button
        variant="outline"
        disabled={busy || paused || !ok}
        onClick={async () => {
          if (
            await cmd(
              {
                type: 'accommodation-request',
                enrollmentId: e.id,
                accommodationType: type,
                ...(detail.trim() ? { detail } : {}),
              },
              'Accommodation request saved for assigned staff',
            )
          )
            setDetail('');
        }}
      >
        Request accommodation
      </Button>
      {history.length > 0 && (
        <details className="source-packet">
          <summary>Decision history · retained</summary>
          {history.map((h) => (
            <p key={h.id}>
              {date(h.at)} · {accommodationLabel(h.type)} · {h.event}
              {h.actorName ? ` by ${h.actorName}` : ''}
              {h.reason ? ` · ${h.reason}` : ''}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}

/** Assessor view: approved accommodations at review time. Informational; the rubric below is unchanged. */
export function AccommodationsForReview({ enrollment }: { enrollment: any }) {
  const list = accommodationsForReview(enrollment);
  if (!list.length) return null;
  return (
    <div className="notice" role="note">
      <ShieldCheck />
      <div>
        <strong>Approved accommodations for this learner</strong>
        <ul>
          {list.map((a) => (
            <li key={a.id}>
              {a.label}
              {a.detail ? ` · ${a.detail}` : ''} <small>(approved {date(a.approvedAt)})</small>
            </li>
          ))}
        </ul>
        <p>These change how evidence may be given. Score against the published rubric exactly as written.</p>
      </div>
    </div>
  );
}

/** Assessor method choice. Uses only methods the offering publishes. */
export function MethodPicker({
  program,
  value,
  onChange,
}: {
  program: any;
  value: string;
  onChange: (m: string) => void;
}) {
  const rules = assessmentRulesFor(program),
    options = ASSESSMENT_METHODS.filter(
      (m) => m.humanRecorded && resolveAssessmentMethod(program, m.id).ok,
    ).map((m) => ({ value: m.id, label: m.label })),
    current = rules.methods.find((m) => m.id === value);
  return (
    <div className="field">
      <label>How was this evidence gathered?</label>
      <Pick label="Assessment method" value={value} onChange={onChange} options={options} />
      {current && <p className="form-hint">{current.claim} Same rubric, gates and written feedback apply.</p>}
    </div>
  );
}

/** Staff decision panel: pending requests, approve/decline with a reason. Eligibility is enforced by the server. */
export function AccommodationDecisions({
  entries,
}: {
  entries: { enrollment: any; learnerId?: string; learnerName?: string }[];
}) {
  const { cmd, busy, team } = useAcademy(),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    pending = entries.flatMap((x) =>
      (x.enrollment.accommodations ?? [])
        .filter((a: any) => a.status === 'requested')
        .map((a: any) => ({ ...x, a })),
    );
  if (!pending.length) return <p className="form-hint">No accommodation requests are waiting.</p>;
  return (
    <>
      {pending.map(({ enrollment: e, a, learnerId, learnerName }) => {
        const r = reasons[a.id] ?? '',
          short = r.trim().length < ACCOMMODATION_LIMITS.reasonMin,
          send = (outcome: string) =>
            cmd(
              {
                type: 'accommodation-decide',
                enrollmentId: e.id,
                requestId: a.id,
                outcome,
                reason: r,
                ...(team ? { learnerId } : { actor: 'assessor-a' }),
              },
              outcome === 'approved'
                ? 'Accommodation approved and recorded'
                : 'Accommodation declined and recorded',
            );
        return (
          <section className="panel" key={a.id}>
            <h3>
              {accommodationLabel(a.type)}
              {learnerName ? ` · ${learnerName}` : ''}
            </h3>
            {a.detail && <p className="pre-wrap">{a.detail}</p>}
            <Field
              id={`acc-reason-${a.id}`}
              rows={2}
              label="Decision reason"
              help="At least 10 characters. Kept with the decision and visible to the learner."
              value={r}
              onChange={(v: string) => setReasons((s) => ({ ...s, [a.id]: v }))}
            />
            <div className="actions">
              <Button disabled={busy || short} onClick={() => send('approved')}>
                Approve
              </Button>
              <Button variant="outline" disabled={busy || short} onClick={() => send('declined')}>
                Decline
              </Button>
            </div>
          </section>
        );
      })}
    </>
  );
}
