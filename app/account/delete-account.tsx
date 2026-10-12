'use client';
// ACA-US-6.4: the learner deletes their own account and personal practice data.
import {useState} from 'react';
import {Button} from '@/components/ui/button';
const CONFIRMATION = 'DELETE MY DATA';

export function DeleteAccount({email}: {email: string}) {
  const [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [done, setDone] = useState(false);
  async function erase(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const r = await fetch('/api/account/erase', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({confirm: typed})});
    const data = (await r.json().catch(() => ({}))) as {erased?: boolean; error?: string};
    if (data.erased) { setDone(true); } else { setMessage(data.error ?? 'Deletion failed. Please try again.'); }
    setBusy(false);
  }
  if (done) return <section className="panel spacious"><h1>Your data is deleted</h1><p className="mt">Your account and your personal practice work have been removed. You are signed out.</p><a className="text-button mt" href="/signin">Back to sign-in</a></section>;
  return (
    <section className="panel spacious" aria-labelledby="delete-title">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1 id="delete-title">Delete my data</h1>
      <p className="mt">This permanently deletes the account for <strong>{email}</strong> and everything in your personal practice lab. It cannot be undone. Download anything you want to keep first.</p>
      <form onSubmit={erase}>
        <div className="field">
          <label htmlFor="confirm-delete">Type {CONFIRMATION} to confirm</label>
          <input id="confirm-delete" autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} />
        </div>
        <Button type="submit" variant="destructive" disabled={busy || typed !== CONFIRMATION}>{busy ? 'Deleting…' : 'Delete my data permanently'}</Button>
      </form>
      <p role="alert" aria-live="assertive" className={message ? 'notice error-notice' : ''}>{message}</p>
    </section>
  );
}
