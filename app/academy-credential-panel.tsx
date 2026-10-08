'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAcademy } from './academy-context';
import { ownerView, DEMO_MARK, DEMO_ISSUER, DEMO_NOTICE, type Credential } from '@/lib/academy-credential';
const day = (v: string) => v.slice(0, 10);
/** Learner view of the DEMO credential. The verification link works only while sharing is switched on for this record. */
export function CredentialPanel({ e }: { e: any }) {
  const { cmd, busy } = useAcademy(),
    [copied, setCopied] = useState(''),
    c: Credential | undefined = e.credential,
    shared = e.record ? e.record.share === true : e.credentialShare === true;
  if (!c)
    return (
      <div className="mt">
        <p className="eyebrow">{DEMO_MARK}</p>
        <p className="form-hint">No demo credential yet. {DEMO_NOTICE}</p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => cmd({ type: 'credential-issue', enrollmentId: e.id }, 'Demo credential saved')}
        >
          Create my demo credential
        </Button>
      </div>
    );
  const v = ownerView(c, new Date().toISOString()),
    link = typeof window === 'undefined' ? '/verify/' + c.id : window.location.origin + '/verify/' + c.id;
  return (
    <div className="mt" aria-label="Demo credential">
      <p className="eyebrow">{DEMO_MARK}</p>
      <p>
        <strong>Demo credential: {v.label}</strong> · <strong>{v.status}</strong> · valid until{' '}
        {day(v.expiresAt)}
      </p>
      <p className="form-hint">
        {v.labelMeaning} Issuer: {DEMO_ISSUER}. {DEMO_NOTICE}
      </p>
      {v.integrity === 'failed' && (
        <p role="alert">This credential failed its integrity check and should not be relied on.</p>
      )}
      <details className="source-packet">
        <summary>Credential history ({v.history.length})</summary>
        {v.history.map((h) => (
          <p key={h.id}>
            {day(h.at)} · {h.action}
            {h.before ? ` (${h.before} to ${h.after})` : ''} · {h.actorRole}
            {h.actorName ? ` ${h.actorName}` : ''} · {h.reason}
          </p>
        ))}
      </details>
      {shared ? (
        <div className="actions">
          <input
            readOnly
            style={{ flex: '1 1 260px', minWidth: 0 }}
            /* acceptance fix: the link field rendered about 200px wide and clipped the URL */ aria-label="Demo verification link"
            value={link}
            onFocus={(ev) => ev.currentTarget.select()}
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied('Link copied');
              } catch {
                setCopied('Select the link and copy it');
              }
            }}
          >
            Copy verification link
          </Button>
          {copied && <span role="status">{copied}</span>}
        </div>
      ) : (
        <p className="form-hint">
          Verification link is off. Turn on sharing for this record to let anyone with the link see only its
          label, pathway, dates and status. It shows no name or email.
        </p>
      )}
    </div>
  );
}
