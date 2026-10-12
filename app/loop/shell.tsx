// Shared frame for practice-loop screens: skip link, header with Home and Help on every screen (ACA-US-12.5-AC1).
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {env} from '@/lib/platform-env';
import {getChatGPTUser, chatGPTSignInPath} from '@/app/chatgpt-auth';
import type {Db} from '@/lib/loop/core';
import s from './loop.module.css';

export function Shell({title, children, screen}: {title: string; children: React.ReactNode; screen: string}) {
  return (
    <div className={s.page}>
      <a href="#main" className={s.skip}>Skip to content</a>
      <header className={s.header}>
        <Link href="/loop" className={s.brand}>Aplyd Academy</Link>
        <nav aria-label="Main" className={s.nav}>
          <Link href="/loop">Home</Link>
          <Link href={`/loop/help?screen=${encodeURIComponent(screen)}`}>Help</Link>
        </nav>
      </header>
      <main id="main" className={s.main}>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** Signed-in user and database for a page; redirects to sign-in. */
export async function pageContext(returnTo: string): Promise<{db: Db; user: {userId: string; email: string}}> {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  if (!env.DB) throw new Error('The Academy database is unavailable.');
  return {db: env.DB, user: {userId: user.userId, email: user.email}};
}

/** Runs a lib call for a page and turns a refusal into a readable message instead of a crash. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ok: true; value: T} | {ok: false; message: string; status: number}> {
  try { return {ok: true, value: await fn()}; }
  catch (e) {
    if (e instanceof Error && e.name === 'LoopError') return {ok: false, message: e.message, status: (e as Error & {status: number}).status};
    throw e;
  }
}

export function Refused({message}: {message: string}) {
  return <div className={s.error} role="alert">{message}</div>;
}

export const fmtShare = (v: {value: number | null; numerator: number | null; denominator: number | null; suppressed?: boolean; low?: number | null; high?: number | null}) =>
  v.suppressed ? 'hidden (small group)' : v.value === null ? '–' : `${Math.round(v.value * 100)}% (${v.numerator}/${v.denominator}${v.low != null ? `, 95% CI ${Math.round(v.low * 100)}–${Math.round((v.high ?? 0) * 100)}%` : ''})`;
