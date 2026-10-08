import type { Metadata } from 'next';
import { findPublicCredential } from '../lookup';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Verify a demo credential',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
const fmt = (v: string) => v.slice(0, 10);
const tone: Record<string, string> = {
  active: '#1f7a3d',
  suspended: '#9a6700',
  revoked: '#b3261e',
  expired: '#5b6880',
};
export default async function Verify({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params,
    r = await findPublicCredential(token);
  const box: React.CSSProperties = { maxWidth: 640, margin: '48px auto', padding: '0 16px' },
    card: React.CSSProperties = {
      background: '#fff',
      border: '2px dashed #9a6700',
      borderRadius: 8,
      padding: 24,
    };
  if (r.state !== 'found')
    return (
      <main style={box}>
        <div style={card}>
          <p style={{ fontWeight: 700, color: '#9a6700' }}>DEMO / not accredited</p>
          <h1>
            {r.state === 'unavailable'
              ? 'Verification is temporarily unavailable'
              : 'No shared demo credential matches this link'}
          </h1>
          <p>
            The link may be mistyped, may not have been shared by its owner, or may not exist. Nothing more is
            disclosed.
          </p>
        </div>
      </main>
    );
  const c = r.credential,
    bad = c.status !== 'active' || c.integrity === 'failed';
  return (
    <main style={box}>
      <div style={card}>
        <p style={{ fontWeight: 700, color: '#9a6700', letterSpacing: 1 }}>{c.mark}</p>
        <p style={{ margin: 0 }}>Issued by: {c.issuer}</p>
        <h1 style={{ marginBottom: 4 }}>{c.pathway}</h1>
        <p style={{ marginTop: 0 }}>
          Edition {c.edition} · Label: <strong>{c.label}</strong>
        </p>
        <p
          role="status"
          style={{
            fontWeight: 700,
            fontSize: '1.1rem',
            color: c.integrity === 'failed' ? '#b3261e' : tone[c.status],
            border: '1px solid currentColor',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          {c.statusNote}
        </p>
        <p>{c.labelMeaning}</p>
        <p>
          Issued {fmt(c.issuedAt)} · {c.status === 'expired' ? 'Expired' : 'Valid until'} {fmt(c.expiresAt)}
          {c.lastChange && c.lastChange.action !== 'issue'
            ? ` · Last change: ${c.lastChange.action} on ${fmt(c.lastChange.at)}`
            : ''}
        </p>
        <p style={{ fontSize: '.9rem' }}>
          Credential reference: <code>{c.credentialId}</code>
        </p>
        <p style={{ fontSize: '.9rem', color: '#5b6880' }}>
          {c.notice} This page shows no name, email or learning evidence.
          {bad ? ' Do not rely on this credential.' : ''}
        </p>
      </div>
    </main>
  );
}
