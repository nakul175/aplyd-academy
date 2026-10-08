'use client';
import { useState } from 'react';
import { ShieldCheck, Download, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAcademy } from './academy-context';
import { Field, Head, Empty, Tag, Pick, FormError, date } from './academy-ui';

// Saves the exact export text (so the carried checksum still matches). Called only from a button click.
export function downloadDataExport(name: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const kinds = [
  { value: 'export', label: 'Export my workspace data' },
  { value: 'correction', label: 'Correct my profile fields' },
  { value: 'erasure', label: 'Erase my data / withdraw consent' },
];
const kindLabel: Record<string, string> = {
  export: 'Export',
  correction: 'Correction',
  erasure: 'Erasure / withdrawal of consent',
};
const statusLabel: Record<string, string> = {
  received: 'Received · awaiting verification',
  verified: 'Identity verified · awaiting decision',
  'verification-failed': 'Verification not passed',
  completed: 'Completed',
  declined: 'Declined',
  held: 'Held — retention policy pending',
  withdrawn: 'Withdrawn',
};
const contexts = [
  { value: 'msme', label: 'MSME' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'public', label: 'Public service' },
];
const newRef = () =>
  'dr-' + (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));

export default function DataRequestsView() {
  const { team } = useAcademy();
  if (!team)
    return (
      <>
        <Head
          eyebrow="YOUR DATA"
          title="My data requests"
          body="Ask for a copy, a correction or erasure of your workspace data."
        />
        <section className="panel spacious">
          <ShieldCheck />
          <h2 className="mt">Your personal practice lab</h2>
          <p className="mt">
            Data requests are handled inside a shared workspace by its owners. Your personal lab has its own
            private snapshot export in the learning space menu.
          </p>
        </section>
      </>
    );
  return <Page />;
}
function Page() {
  const { team, busy } = useAcademy(),
    dr = team.dataRequests,
    [open, setOpen] = useState(false);
  if (!dr)
    return (
      <Empty
        icon={ShieldCheck}
        title="Data requests are unavailable"
        body="Refresh your workspace and try again."
      />
    );
  const admin = team.roles.includes('admin');
  return (
    <>
      <Head
        eyebrow="YOUR DATA"
        title="My data requests"
        body={`Requests follow a documented process: identity check, owner decision with a reason, and a ${dr.slaDays}-day response target.`}
      >
        <Button disabled={busy || !team.active} onClick={() => setOpen(true)}>
          <FileText size={17} />
          New request
        </Button>
      </Head>
      <FormError />
      <div className="notice">
        <ShieldCheck />
        <div>
          <strong>How this works.</strong>
          <p>
            A workspace owner other than you records two of three identity checks, then decides with a written
            reason. You cannot verify your own request. The checks here are a pilot stand-in for real identity
            proofing.
          </p>
          <p>{dr.erasureNotice}</p>
        </div>
      </div>
      {dr.restrictedSelf && (
        <div className="notice" role="status">
          <Clock />
          <div>
            <strong>Your directory profile is hidden.</strong>
            <p>
              An erasure request is held pending the retention policy. Nothing was deleted. An owner can lift
              this restriction.
            </p>
          </div>
        </div>
      )}
      <h2 className="mt">Your requests</h2>
      {!dr.mine.length ? (
        <Empty
          icon={FileText}
          title="No data requests yet"
          body="Use New request to ask for an export, a correction or erasure."
        />
      ) : (
        <div className="support-cards mt">
          {dr.mine.map((r: any) => (
            <Card key={r.id} r={r} own />
          ))}
        </div>
      )}
      {admin && (
        <>
          <h2 className="mt">Owner queue</h2>
          {!dr.queue.length ? (
            <Empty
              icon={ShieldCheck}
              title="Queue is empty"
              body="Requests from workspace members appear here."
            />
          ) : (
            <div className="support-cards mt">
              {dr.queue.map((r: any) => (
                <Card key={r.id} r={r} admin />
              ))}
            </div>
          )}
        </>
      )}
      <NewRequest open={open} onClose={() => setOpen(false)} />
    </>
  );
}
function Card({ r, own, admin }: any) {
  const { team, cmd, busy } = useAcademy(),
    dr = team.dataRequests,
    [passed, setPassed] = useState<string[]>([]),
    [reason, setReason] = useState(''),
    [note, setNote] = useState(''),
    mineOnQueue = admin && r.isOwn,
    openState = ['received', 'verified', 'verification-failed'].includes(r.status);
  const base = { requestId: r.id, requestRev: r.rev };
  return (
    <section className="panel support-card" data-data-request-id={r.id}>
      <div className="discussion-meta">
        <strong>{kindLabel[r.type]}</strong>
        <Tag>{statusLabel[r.status] ?? r.status}</Tag>
        {r.overdue && <Tag tone="warn">Overdue</Tag>}
      </div>
      <p className="form-hint">
        {admin ? `${r.requesterName} · ` : ''}Filed {date(r.createdAt)} · response due {date(r.dueAt)} · Ref{' '}
        {r.id}
      </p>
      {r.detail && <p>{r.detail}</p>}
      {r.proposed && (
        <p className="form-hint">
          Proposed:{' '}
          {Object.entries(r.proposed)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join('; ')}
        </p>
      )}
      <p className="form-hint">
        Identity check (pilot stand-in):{' '}
        {r.verification.status === 'pending'
          ? 'not yet recorded'
          : `${r.verification.passed.length} of ${dr.checks.length} passed — ${r.verification.status}`}
      </p>
      {r.decision && (
        <p>
          <strong>
            {r.decision.outcome === 'approve' ? 'Approved' : 'Declined'} by {r.decision.actorName}:
          </strong>{' '}
          {r.decision.reason}
        </p>
      )}
      {r.hold && (
        <p>
          <strong>{r.hold.label}.</strong> Directory profile {r.hold.restricted ? 'hidden' : 'visible'}. No
          data was deleted.
        </p>
      )}
      {own && r.export && (
        <p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadDataExport(`aplyd-workspace-data-${r.id.slice(0, 8)}.json`, r.export.json)}
          >
            <Download size={15} />
            Download export
          </Button>{' '}
          <span className="form-hint">SHA-256 {r.export.sha256.slice(0, 16)}… · your own data only</span>
        </p>
      )}
      {own && openState && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => cmd({ type: 'data-request-withdraw', ...base }, 'Request withdrawn')}
        >
          Withdraw request
        </Button>
      )}
      <details>
        <summary>History</summary>
        <ol>
          {r.events.map((e: any) => (
            <li key={e.id}>
              {date(e.at)} · {e.type} · {e.actorName}
            </li>
          ))}
        </ol>
      </details>
      {admin && mineOnQueue && (
        <p className="form-hint">This is your own request. Another owner must verify and decide it.</p>
      )}
      {admin && !mineOnQueue && (
        <div className="mt">
          {['received', 'verification-failed'].includes(r.status) && (
            <fieldset>
              <legend>Record identity checks passed (two of three needed)</legend>
              {dr.checks.map((k: any) => (
                <label className="check-line" key={k.id}>
                  <Checkbox
                    checked={passed.includes(k.id)}
                    onCheckedChange={(v) =>
                      setPassed((p) => (v === true ? [...p, k.id] : p.filter((x) => x !== k.id)))
                    }
                  />
                  {k.label}
                </label>
              ))}
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  cmd(
                    { type: 'data-request-verify', ...base, passed, note: note || undefined },
                    'Verification recorded',
                  )
                }
              >
                Record verification
              </Button>
            </fieldset>
          )}
          {openState && (
            <>
              <Field
                id={`dr-reason-${r.id}`}
                label="Decision reason (shared with the requester)"
                value={reason}
                onChange={setReason}
                rows={3}
                maxLength={1000}
              />
              <Button
                size="sm"
                disabled={busy || reason.trim().length < 10 || r.verification.status !== 'verified'}
                onClick={() =>
                  cmd(
                    { type: 'data-request-decide', ...base, outcome: 'approve', reason },
                    r.type === 'erasure' ? 'Request held' : 'Request approved',
                  )
                }
              >
                {r.type === 'erasure' ? 'Approve: record and hold' : 'Approve'}
              </Button>{' '}
              <Button
                size="sm"
                variant="outline"
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  cmd(
                    { type: 'data-request-decide', ...base, outcome: 'decline', reason },
                    'Request declined',
                  )
                }
              >
                Decline
              </Button>
            </>
          )}
          {r.status === 'held' && (
            <>
              <Field
                id={`dr-restrict-${r.id}`}
                label="Reason to change the restriction"
                value={reason}
                onChange={setReason}
                rows={2}
                maxLength={1000}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  cmd(
                    { type: 'data-request-restriction', ...base, restricted: !r.hold.restricted, reason },
                    r.hold.restricted ? 'Restriction lifted' : 'Restriction applied',
                  )
                }
              >
                {r.hold.restricted ? 'Lift restriction (show profile again)' : 'Re-apply restriction'}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
function NewRequest({ open, onClose }: any) {
  const { cmd, busy } = useAcademy(),
    [kind, setKind] = useState('export'),
    [detail, setDetail] = useState(''),
    [name, setName] = useState(''),
    [context, setContext] = useState(''),
    [ref, setRef] = useState(newRef);
  if (!open) return null;
  const proposed =
      kind === 'correction'
        ? { ...(name.trim() ? { name: name.trim() } : {}), ...(context ? { context } : {}) }
        : undefined,
    ok =
      kind === 'export' ||
      (detail.trim().length >= 10 && (kind !== 'correction' || Object.keys(proposed!).length > 0));
  return (
    <section className="panel spacious mt" aria-label="New data request">
      <Pick label="Request type" value={kind} onChange={setKind} options={kinds} />
      {kind === 'correction' && (
        <>
          <div className="field">
            <label htmlFor="dr-name">Corrected display name</label>
            <input id="dr-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Corrected work context</label>
            <Pick label="Work context" value={context} onChange={setContext} options={contexts} />
          </div>
        </>
      )}
      <Field
        id="dr-detail"
        label={kind === 'export' ? 'Anything we should know (optional)' : 'Reason'}
        value={detail}
        onChange={setDetail}
        rows={3}
        maxLength={1000}
      />
      {kind === 'erasure' && (
        <p className="form-hint">
          Erasure is not available yet. We will record this request, hold it pending the retention policy and
          hide your directory profile. Nothing is deleted.
        </p>
      )}
      <Button
        disabled={busy || !ok}
        onClick={async () => {
          if (
            await cmd(
              {
                type: 'data-request-open',
                kind,
                detail: detail.trim() || undefined,
                ...(proposed ? { proposed } : {}),
                clientRef: ref,
              },
              'Request filed',
            )
          ) {
            setDetail('');
            setName('');
            setContext('');
            setRef(newRef());
            onClose();
          }
        }}
      >
        File request
      </Button>{' '}
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
    </section>
  );
}
