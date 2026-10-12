'use client';
// ACA-US-1.4: two-step email code sign-in. Phone first: large inputs, numeric keypad for the code,
// one-time-code autofill, errors announced to screen readers.
import { useState } from 'react';
import { Button } from '@/components/ui/button';

async function call(path: string, body: unknown) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(data.error ?? 'Sign-in is unavailable. Please try again.');
  return data;
}

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await call('/api/auth/request-code', { email });
      setStep('code');
      setCode('');
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await call('/api/auth/verify', { email, code });
      window.location.assign(returnTo);
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="panel spacious" aria-labelledby="signin-title">
      <p className="eyebrow">APLYD ACADEMY</p>
      <h1 id="signin-title">Sign in</h1>
      {step === 'email' ? (
        <form onSubmit={send}>
          <p className="mt">We will email you a 6-digit code. No password needed.</p>
          <div className="field">
            <label htmlFor="signin-email">Email address</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="mt">
            We sent a code to <strong>{email}</strong>. It works for 10 minutes.
          </p>
          <div className="field">
            <label htmlFor="signin-code">6-digit code</label>
            <input
              id="signin-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="actions">
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </Button>
            <button type="button" className="text-button" disabled={busy} onClick={() => send()}>
              Send a new code
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setStep('email');
                setError('');
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
      <p role="alert" aria-live="assertive" className={error ? 'notice error-notice' : ''}>
        {error}
      </p>
    </section>
  );
}
