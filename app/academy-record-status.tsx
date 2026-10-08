'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAcademy } from './academy-context';
import { download } from './academy-download';
import type { AcceptedRecordResult, CheckedRecordResult } from '@/lib/academy-record-response';

/** Candidate widget: parent owns authenticated API response validation and identity/scope fencing. */
type Target = { recordId: string } | { decisionId: string };
type Props = {
  scopeKey: string;
  target: Target;
  canCheck: boolean;
  check: (target: Target, signal: AbortSignal) => Promise<AcceptedRecordResult>;
  exportSnapshot: (result: CheckedRecordResult) => void;
};
export function PrivateRecordStatusPanel({ scopeKey, target, canCheck, check, exportSnapshot }: Props) {
  const targetKey = JSON.stringify(target),
    sequence = useRef(0),
    abort = useRef<AbortController | null>(null),
    liveScope = useRef('');
  const currentScope = JSON.stringify([scopeKey, targetKey, canCheck]);
  liveScope.current = currentScope;
  const [saved, setSaved] = useState<{ scope: string; result: AcceptedRecordResult } | null>(null),
    [pending, setPending] = useState(''),
    [notice, setNotice] = useState<{ scope: string; text: string } | null>(null);
  useEffect(() => {
    sequence.current++;
    abort.current?.abort();
    abort.current = null;
    setSaved(null);
    setPending('');
    setNotice(null);
    return () => {
      sequence.current++;
      abort.current?.abort();
    };
  }, [currentScope]);
  const visible = saved?.scope === currentScope && canCheck ? saved.result : null,
    checked = visible?.outcome === 'checked' ? visible : null;
  const own = 'recordId' in target;
  async function run() {
    if (!canCheck) return;
    const captured = currentScope,
      token = ++sequence.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSaved(null);
    setNotice(null);
    setPending(captured);
    try {
      const result = await check(target, controller.signal);
      if (controller.signal.aborted || sequence.current !== token || liveScope.current !== captured) return;
      setSaved({ scope: captured, result });
    } catch {
      if (!controller.signal.aborted && sequence.current === token && liveScope.current === captured)
        setNotice({
          scope: captured,
          text: 'This private check is unavailable. Refresh your learning space and try again.',
        });
    } finally {
      if (sequence.current === token && liveScope.current === captured) setPending('');
    }
  }
  const s = checked?.snapshot,
    record = s?.kind === 'private-practice-record-status' ? s : null,
    decision = s?.kind === 'private-assigned-original-decision' ? s : null;
  return (
    <section
      className="private-record-status"
      aria-busy={pending === currentScope}
      aria-label={own ? 'Private saved record check' : 'Assigned original decision check'}
    >
      <p>
        {own
          ? 'Check your current saved record and its retained review history.'
          : 'Check only the original decision already visible in this currently assigned appeal.'}
      </p>
      <Button type="button" variant="outline" disabled={!canCheck || pending === currentScope} onClick={run}>
        {pending === currentScope
          ? 'Checking saved state…'
          : own
            ? 'Check current saved status'
            : 'Check assigned original decision'}
      </Button>
      {notice?.scope === currentScope && <p role="status">{notice.text}</p>}
      {visible?.outcome === 'unavailable' && <p role="status">{visible.message}</p>}
      {checked && s && (
        <div role="status" aria-live="polite">
          <h3>{own ? 'Current saved status' : 'Assigned original decision'}</h3>
          <p>
            <strong>{s.classification}</strong>
          </p>
          {record && (
            <p>
              <strong>{record.status === 'active' ? 'Active' : 'Suspended'}</strong>
              {record.hasOpenAppeal ? ' · Appeal open' : ''}
              {record.hasPendingAssessment ? ' · Review pending' : ''}
            </p>
          )}
          <p>
            Checked at {s.checkedAt} · saved revision {s.asOfRevision}. Recheck after a new decision.
          </p>
          <p>
            Exact course version: <span className="private-record-reference">{s.contentRef.versionId}</span>
          </p>
          {record ? (
            <>
              <p>Originally recorded {record.issuedAt}</p>
              <p>
                First passing review: {record.firstPassingDecision.actorDisplay} ·{' '}
                {record.firstPassingDecision.decidedAt}
              </p>
              <p>
                Effective review: {record.effectiveDecision.actorDisplay} ·{' '}
                {record.effectiveDecision.decidedAt} ·{' '}
                {record.effectiveDecision.passed ? 'Passed' : 'Did not pass'}
              </p>
              <p>{record.issuerAuthority}</p>
            </>
          ) : decision ? (
            <p>
              Original review: {decision.decision.actorDisplay} · {decision.decision.decidedAt} ·{' '}
              {decision.decision.passed ? 'Passed' : 'Did not pass'}
            </p>
          ) : null}
          <details>
            <summary>Snapshot checksum and limits</summary>
            <p className="private-record-reference">{checked.integrity.checksum}</p>
            <p>{checked.integrity.meaning}</p>
            <p>
              This private snapshot contains no submitted evidence, drafts, private review notes or public
              verification link.
            </p>
          </details>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (saved?.scope === liveScope.current && canCheck && checked) exportSnapshot(checked);
            }}
          >
            Download private status snapshot
          </Button>
        </div>
      )}
    </section>
  );
}

/** Export remains bound to the live authenticated read stamp, including changes before a render. */
export function CurrentPrivateRecordStatus({ target }: { target: Target }) {
  const { accountKey, loading, saving, checkPrivateRecord, getPrivateRecordScope } = useAcademy();
  const scopeKey = getPrivateRecordScope(),
    canCheck = !!accountKey && !loading && !saving;
  return (
    <PrivateRecordStatusPanel
      scopeKey={scopeKey}
      target={target}
      canCheck={canCheck}
      check={checkPrivateRecord}
      exportSnapshot={(result) => {
        if (getPrivateRecordScope() !== scopeKey) return;
        download('aplyd-private-status-snapshot-' + result.snapshot.checkedAt.slice(0, 10) + '.json', {
          format: 'aplyd-academy-private-record-status-snapshot',
          formatVersion: 1,
          snapshot: result.snapshot,
          integrity: result.integrity,
        });
      }}
    />
  );
}
