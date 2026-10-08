'use client';
import { useState } from 'react';
import { Siren, ShieldAlert, LockKeyhole, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcademy } from './academy-context';
import { Field, Head, Empty, Tag, Pick, date } from './academy-ui';

/** Escalation of discussion reports to the workspace owner. Everything shown comes from
 * the server projection (team.escalations); roles and scope are enforced again by the
 * protected commands, so nothing here confers authority. No external notification exists. */
const SEVERITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  safeguarding: 'Safeguarding',
};
const when = (v: string) =>
  new Date(v).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const hours = (h: number) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`);
const stepLabel: Record<string, string> = {
  escalated: 'Escalated',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export default function EscalationsView() {
  const { team, state, cmd, busy } = useAcademy();
  const [severity, setSeverity] = useState<Record<string, string>>({}),
    [reason, setReason] = useState<Record<string, string>>({}),
    [decision, setDecision] = useState<Record<string, string>>({}),
    [hide, setHide] = useState<Record<string, boolean>>({});
  const esc = team?.escalations;
  if (!team || !esc)
    return (
      <section className="panel spacious">
        <LockKeyhole />
        <h2 className="mt">Escalations are unavailable</h2>
        <p className="mt">
          Escalations belong to a shared workspace. Refresh your workspace access or return to your Overview.
        </p>
      </section>
    );
  const escalatedReportIds = new Set(esc.items.map((i: any) => i.reportId)),
    eligible = esc.canEscalate ? (state.reports ?? []).filter((r: any) => !escalatedReportIds.has(r.id)) : [],
    owner = esc.canDecide;
  const posts = new Map<string, any>((state.posts ?? []).map((p: any) => [p.id, p]));
  const items = esc.items as any[];
  return (
    <div className="escalations-view">
      <Head
        eyebrow={owner ? 'WORKSPACE OWNER' : 'SCOPED MODERATOR'}
        title="Escalate what needs an owner’s decision."
        body={
          owner
            ? 'Reports raised by moderators, with response targets. You can decide any escalation in this workspace.'
            : 'Escalate a report in your moderator cohorts to the workspace owner. You see only escalations you raised.'
        }
      />
      <div className="notice">
        <LockKeyhole />
        <p>
          Escalations stay inside this workspace. Academy sends no email or message to anyone. Reporters are
          told only that their report was reviewed and whether action was taken, never who reviewed it or what
          others wrote. Response targets are internal and are not promised to reporters.
        </p>
      </div>
      {esc.notices.length > 0 && (
        <section className="panel mt" aria-labelledby="esc-notices">
          <h2 id="esc-notices">Outcome of your reports</h2>
          <ul className="operations-list">
            {esc.notices.map((n: any) => (
              <li key={n.id}>
                <p>{n.text}</p>
                <p className="form-hint">{date(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {esc.canEscalate && (
        <section className="panel mt" aria-labelledby="esc-new">
          <div className="section-title no-top">
            <h2 id="esc-new">
              <Siren size={21} /> Reports you can escalate
            </h2>
            <Tag>{eligible.length}</Tag>
          </div>
          {!eligible.length && <p className="mt">No unescalated reports in your moderator cohorts.</p>}
          {eligible.map((r: any) => {
            const sev = severity[r.id] ?? 'medium',
              text = reason[r.id] ?? '',
              p = posts.get(r.postId);
            return (
              <div className="panel mt" key={r.id} data-escalation-report-id={r.id}>
                <p>
                  <strong>{p?.title ?? 'Reported discussion'}</strong> · {date(r.createdAt)} ·{' '}
                  <Tag>{r.status}</Tag>
                </p>
                <p className="pre-wrap muted">Report: {r.reason}</p>
                <Pick
                  label="Severity"
                  value={sev}
                  onChange={(v: string) => setSeverity((s) => ({ ...s, [r.id]: v }))}
                  options={esc.severities.map((s: string) => ({
                    value: s,
                    label: `${SEVERITY_LABEL[s]} · target ${hours(esc.slaHours[s])}`,
                  }))}
                />
                {sev === 'safeguarding' && (
                  <div className="notice" role="note">
                    <ShieldAlert />
                    <p>{esc.handlingNote}</p>
                  </div>
                )}
                <Field
                  id={`escalate-${r.id}`}
                  rows={3}
                  label="Why does this need the owner?"
                  help="10 to 1000 characters. Share only what the owner needs."
                  value={text}
                  onChange={(v: string) => setReason((s) => ({ ...s, [r.id]: v }))}
                />
                <div className="actions">
                  <Button
                    disabled={busy || text.trim().length < 10}
                    onClick={() =>
                      cmd(
                        { type: 'escalate-report', reportId: r.id, severity: sev, reason: text },
                        'Report escalated to the workspace owner',
                      )
                    }
                  >
                    Escalate to owner
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}
      <section className="panel mt" aria-labelledby="esc-list">
        <div className="section-title no-top">
          <h2 id="esc-list">
            <Clock size={21} /> {owner ? 'Escalations' : 'Your escalations'}
          </h2>
          <div>
            <Tag>{esc.counts.open} open</Tag>
            {esc.counts.overdue > 0 && <Tag tone="warning">{esc.counts.overdue} overdue</Tag>}
          </div>
        </div>
        {!items.length && (
          <Empty
            icon={CheckCircle2}
            title="Nothing escalated"
            body={
              owner
                ? 'When a moderator escalates a report it will appear here with its response target.'
                : 'Reports you escalate will appear here with their outcome.'
            }
          />
        )}
        <ul className="operations-list">
          {items.map((i: any) => {
            const open = i.status === 'open',
              dec = decision[i.id] ?? 'resolve',
              text = reason['d' + i.id] ?? '';
            return (
              <li key={i.id} data-escalation-id={i.id}>
                <div>
                  <Tag tone={i.severity === 'safeguarding' || i.severity === 'high' ? 'warning' : ''}>
                    {SEVERITY_LABEL[i.severity]}
                  </Tag>{' '}
                  <Tag>{open ? 'Open' : i.status === 'resolved' ? 'Resolved' : 'Dismissed'}</Tag>
                  {i.overdue && (
                    <Tag tone="warning">
                      Overdue {i.hoursOverdue > 0 ? `by ${hours(i.hoursOverdue)}` : ''}
                    </Tag>
                  )}
                </div>
                <h3>{i.postTitle ?? 'Discussion no longer available'}</h3>
                <p className="form-hint">
                  {i.cohortTitle} · Escalated {when(i.escalatedAt)}
                  {owner ? ` by ${i.escalatedByName}` : ''} ·{' '}
                  {open
                    ? `Target ${when(i.dueAt)}`
                    : i.withinTarget === null
                      ? ''
                      : i.withinTarget
                        ? 'Decided within target'
                        : 'Decided after target'}
                </p>
                <p className="pre-wrap">{i.reason}</p>
                {i.severity === 'safeguarding' && (
                  <p className="form-hint">
                    Handled inside this workspace only. No external notification is sent.
                  </p>
                )}
                {i.resolution && (
                  <p className="mt">
                    <strong>{i.resolution.decision === 'resolve' ? 'Action taken' : 'No action'}</strong>
                    {i.resolution.hidPost ? ' · discussion hidden' : ''}
                    {i.resolution.reason ? ` · ${i.resolution.reason}` : ''}
                  </p>
                )}
                <details className="mt">
                  <summary>History ({i.history.length})</summary>
                  <ol>
                    {i.history.map((h: any) => (
                      <li key={h.id}>
                        {stepLabel[h.type] ?? h.type} · {h.actorName} · {when(h.at)}
                      </li>
                    ))}
                  </ol>
                </details>
                {owner && open && (
                  <div className="mt">
                    {i.severity === 'safeguarding' && (
                      <div className="notice" role="note">
                        <ShieldAlert />
                        <p>{esc.handlingNote}</p>
                      </div>
                    )}
                    <Pick
                      label="Decision"
                      value={dec}
                      onChange={(v: string) => setDecision((s) => ({ ...s, [i.id]: v }))}
                      options={[
                        { value: 'resolve', label: 'Resolve — action taken' },
                        { value: 'dismiss', label: 'Dismiss — no action' },
                      ]}
                    />
                    <Field
                      id={`decide-${i.id}`}
                      rows={3}
                      label="Reason for the decision"
                      help="10 to 1000 characters. Kept in the escalation history."
                      value={text}
                      onChange={(v: string) => setReason((s) => ({ ...s, ['d' + i.id]: v }))}
                    />
                    {dec === 'resolve' && (
                      <label className="toggle-line">
                        <input
                          type="checkbox"
                          checked={!!hide[i.id]}
                          onChange={(e) => setHide((s) => ({ ...s, [i.id]: e.target.checked }))}
                        />{' '}
                        <span>Also hide the discussion (recorded in moderation history)</span>
                      </label>
                    )}
                    <div className="actions">
                      <Button
                        disabled={busy || text.trim().length < 10}
                        onClick={() =>
                          cmd(
                            {
                              type: 'escalation-resolve',
                              escalationId: i.id,
                              decision: dec,
                              reason: text,
                              expectedHistory: i.historyLength,
                              ...(dec === 'resolve' && hide[i.id] ? { hidePost: true } : {}),
                            },
                            dec === 'resolve'
                              ? 'Escalation resolved. The reporter is told action was taken'
                              : 'Escalation dismissed. The reporter is told no action was needed',
                          )
                        }
                      >
                        {dec === 'resolve' ? 'Resolve escalation' : 'Dismiss escalation'}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
