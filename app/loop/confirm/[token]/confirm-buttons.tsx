'use client';
import {useState} from 'react';
import {call} from '../../client';
import s from '../../loop.module.css';

export function ConfirmButtons({token}: {token: string}) {
  const [done, setDone] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function answer(decision: 'confirmed' | 'declined') {
    try { await call('confirm.decide', {token, decision}); setDone(decision); } catch (e) { setError((e as Error).message); }
  }
  if (done) return <div className={s.ok} role="status">Thank you. You {done === 'confirmed' ? 'confirmed' : 'declined'} this change.</div>;
  return <div><div className={s.row}><button className={s.button} onClick={() => answer('confirmed')}>Yes, I confirm this change</button><button className={`${s.button} ${s.secondary}`} onClick={() => answer('declined')}>No, I cannot confirm it</button></div>{error && <div className={s.error} role="alert">{error}</div>}</div>;
}
