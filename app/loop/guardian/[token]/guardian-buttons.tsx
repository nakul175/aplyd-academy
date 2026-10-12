'use client';
import { useState } from 'react';
import { call } from '../../client';
import s from '../../loop.module.css';

export function GuardianButtons({ token, status }: { token: string; status: string }) {
  const [now, setNow] = useState(status),
    [error, setError] = useState<string | null>(null);
  async function answer(decision: 'granted' | 'refused' | 'withdrawn') {
    try {
      await call('guardian.decide', { token, decision });
      setNow(decision);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div aria-live="polite">
      {now === 'pending' && (
        <div className={s.row}>
          <button className={s.button} onClick={() => answer('granted')}>
            I give consent
          </button>
          <button className={`${s.button} ${s.secondary}`} onClick={() => answer('refused')}>
            I do not give consent
          </button>
        </div>
      )}
      {now === 'granted' && (
        <>
          <div className={s.ok}>
            You gave consent. Your child has been invited. You can withdraw at any time with this link.
          </div>
          <button className={`${s.button} ${s.danger}`} onClick={() => answer('withdrawn')}>
            Withdraw consent and delete my child’s data
          </button>
        </>
      )}
      {(now === 'refused' || now === 'withdrawn') && (
        <div className={s.ok}>
          Recorded. Your child’s account is not created or has been closed, and their data has been deleted.
        </div>
      )}
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
