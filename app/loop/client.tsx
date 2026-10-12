'use client';
// Client pieces of the practice-loop screens: a generic action form, the resumable uploader, the coach, and the
// join, placement, check and catch-the-AI forms. All talk to POST /api/loop; errors are announced (aria-live).
import {useState, useRef} from 'react';
import {useRouter} from 'next/navigation';
import s from './loop.module.css';

export async function call<T = Record<string, unknown>>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/loop', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action, params})});
  const data = await r.json().catch(() => ({error: 'The server did not answer. Check your connection and try again.'}));
  if (!r.ok) throw new Error((data as {error?: string}).error ?? 'Something went wrong.');
  return data as T;
}

export type Field = {name: string; label: string; type?: 'text' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number' | 'tel' | 'url'; options?: [string, string][]; required?: boolean; hint?: string; rows?: number; value?: string | boolean};

function Status({error, ok}: {error: string | null; ok: string | null}) {
  return <div aria-live="polite">{error && <div className={s.error} role="alert">{error}</div>}{ok && <div className={s.ok}>{ok}</div>}</div>;
}

/** Posts the fields (plus fixed params) as one action; refreshes the page, follows a redirect, or shows the result. */
export function ActionForm({action, params = {}, fields, submit, done = 'refresh', success, danger = false, id}: {action: string; params?: Record<string, unknown>; fields: Field[]; submit: string; done?: 'refresh' | 'show' | 'stay' | `go:${string}`; success?: string; danger?: boolean; id?: string}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [ok, setOk] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null); setOk(null);
    const fd = new FormData(e.currentTarget), values: Record<string, unknown> = {...params};
    for (const f of fields) values[f.name] = f.type === 'checkbox' ? fd.get(f.name) === 'on' : f.type === 'number' ? Number(fd.get(f.name)) : String(fd.get(f.name) ?? '');
    try {
      const r = await call(action, values);
      setResult(r); setOk(success ?? 'Saved.');
      if (done === 'refresh') router.refresh();
      else if (done.startsWith('go:')) router.push(done.slice(3).replace(/\{(\w+)\}/g, (_, k) => String((r as Record<string, unknown>)[k] ?? '')));
      else if (done === 'stay') (e.target as HTMLFormElement).reset();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const problems = Array.isArray(result?.problems) ? result!.problems as {line: number; text: string; reason: string}[] : [];
  return (
    <form onSubmit={onSubmit} id={id} noValidate>
      {fields.map(f => <FieldInput key={f.name} f={f} formId={id ?? action} />)}
      <button className={`${s.button} ${danger ? s.danger : ''}`} disabled={busy}>{busy ? 'Working…' : submit}</button>
      <Status error={error} ok={ok} />
      {problems.length > 0 && (
        <div className={s.card}>
          <h3>Rows not invited ({problems.length})</h3>
          <p className={s.muted}>Correct these rows and upload them again.</p>
          <ul className={s.list}>{problems.map(p => <li key={p.line}><strong>Line {p.line}:</strong> {p.reason}<br /><span className={s.muted}>{p.text}</span></li>)}</ul>
        </div>
      )}
      {done === 'show' && result && !problems.length && <pre className={`${s.card} ${s.prewrap}`}>{JSON.stringify(result, null, 2)}</pre>}
    </form>
  );
}

function FieldInput({f, formId}: {f: Field; formId: string}) {
  const id = `${formId}-${f.name}`, hint = f.hint ? <span id={id + '-hint'} className={s.hint}>{f.hint}</span> : null;
  const aria = f.hint ? {'aria-describedby': id + '-hint'} : {};
  if (f.type === 'checkbox') return <div className={s.check}><input type="checkbox" id={id} name={f.name} defaultChecked={f.value === true} {...aria} /><label htmlFor={id}>{f.label}{hint && <><br />{hint}</>}</label></div>;
  return (
    <div className={s.field}>
      <label htmlFor={id}>{f.label}{f.required ? '' : ' (optional)'}</label>
      {hint}
      {f.type === 'textarea' ? <textarea id={id} name={f.name} className={s.textarea} rows={f.rows ?? 5} required={f.required} defaultValue={typeof f.value === 'string' ? f.value : undefined} {...aria} />
        : f.type === 'select' ? <select id={id} name={f.name} className={s.select} required={f.required} defaultValue={typeof f.value === 'string' ? f.value : undefined} {...aria}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        : <input id={id} name={f.name} type={f.type ?? 'text'} className={s.input} required={f.required} defaultValue={typeof f.value === 'string' ? f.value : undefined} {...aria} />}
    </div>
  );
}

export function ActionButton({action, params, label, done = 'refresh', confirmText, secondary}: {action: string; params: Record<string, unknown>; label: string; done?: 'refresh' | `go:${string}`; confirmText?: string; secondary?: boolean}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [armed, setArmed] = useState(false);
  async function go() {
    if (confirmText && !armed) { setArmed(true); return; }
    setBusy(true); setError(null);
    try { const r = await call(action, params); if (done === 'refresh') router.refresh(); else router.push(done.slice(3).replace(/\{(\w+)\}/g, (_, k) => String((r as Record<string, unknown>)[k] ?? ''))); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); setArmed(false); }
  }
  return <span><button type="button" className={`${s.button} ${secondary ? s.secondary : ''}`} onClick={go} disabled={busy}>{armed ? confirmText : busy ? 'Working…' : label}</button><Status error={error} ok={null} /></span>;
}

// ---- Resumable uploader (ACA-TT-4.1.2) ----
async function sha256(file: File) { const d = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }

export function Uploader({memberId, taskId, officer = false}: {memberId: string; taskId: string; officer?: boolean}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null), [error, setError] = useState<string | null>(null), [ok, setOk] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null), confirm = useRef<HTMLInputElement>(null);
  async function upload() {
    const file = input.current?.files?.[0]; if (!file) { setError('Choose a file first.'); return; }
    setError(null); setOk(null); setProgress(0);
    try {
      const start = await call<{fileId: string; received: number; chunk: number}>('file.start', {memberId, taskId, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, sha256: await sha256(file), noConfidential: confirm.current?.checked === true});
      let offset = start.received, tries = 0;
      while (offset < file.size) {
        try {
          const r = await fetch(`/api/loop/files/${start.fileId}`, {method: 'PUT', headers: {'x-upload-offset': String(offset), 'content-type': 'application/octet-stream'}, body: file.slice(offset, offset + start.chunk)});
          const d = await r.json() as {received?: number; error?: string};
          if (!r.ok) throw Object.assign(new Error(d.error ?? 'Upload failed.'), {fatal: r.status < 500});
          offset = d.received ?? offset; tries = 0; setProgress(Math.round(100 * offset / file.size));
        } catch (e) {
          if ((e as {fatal?: boolean}).fatal) throw e;
          if (++tries > 8) throw new Error('The connection keeps dropping. Your upload is saved so far; try again later and it will continue.');
          await new Promise(r => setTimeout(r, Math.min(15000, 1000 * 2 ** tries))); // slow connection: wait and resume from the server's offset
          offset = (await call<{received: number}>('file.status', {fileId: start.fileId})).received;
        }
      }
      setOk(`Uploaded ${file.name}. Only you can see it.`); router.refresh();
    } catch (e) { setError((e as Error).message); setProgress(null); }
  }
  return (
    <div className={s.card}>
      <div className={s.field}>
        <label htmlFor={`file-${taskId}`}>Attach your own work (photo, PDF, Word, Excel, text)</label>
        <span className={s.hint} id={`file-hint-${taskId}`}>Up to 15 MB. Remove other people’s private details first. Only you can see your files.</span>
        <input ref={input} id={`file-${taskId}`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv,.docx,.xlsx,image/*" aria-describedby={`file-hint-${taskId}`} className={s.input} />
      </div>
      {officer && <div className={s.check}><input ref={confirm} type="checkbox" id={`conf-${taskId}`} /><label htmlFor={`conf-${taskId}`}>I confirm this file holds no confidential or classified government material.</label></div>}
      <button type="button" className={s.button} onClick={upload} disabled={progress !== null && progress < 100 && !error}>Upload</button>
      {progress !== null && <p><label htmlFor={`prog-${taskId}`}>Upload progress</label> <progress id={`prog-${taskId}`} className={s.progress} max={100} value={progress}>{progress}%</progress></p>}
      <Status error={error} ok={ok} />
    </div>
  );
}

// ---- Coach (ACA-US-4.2) ----
export function Coach({taskId, available, notice, messages}: {taskId: string; available: boolean; notice: string | null; messages: {role: string; body: string}[]}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [text, setText] = useState('');
  async function ask(e: React.FormEvent) {
    e.preventDefault(); if (!text.trim()) return; setBusy(true); setError(null);
    try { await call('coach.ask', {taskId, message: text}); setText(''); router.refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <section aria-labelledby={`coach-${taskId}`} className={s.card}>
      <h2 id={`coach-${taskId}`}>Ask the AI coach</h2>
      <p className={s.muted}>The coach gives hints first. You see a worked answer after you send your own attempt.</p>
      {notice && <div className={s.notice} role="status">{notice}</div>}
      <div className={s.chat} aria-live="polite">
        {messages.map((m, i) => <div key={i} className={m.role === 'learner' ? s.bubbleLearner : s.bubbleCoach}><span className={s.sr}>{m.role === 'learner' ? 'You: ' : m.role === 'coach' ? 'Coach: ' : 'Notice: '}</span>{m.body}</div>)}
      </div>
      {available && <form onSubmit={ask}>
        <div className={s.field}><label htmlFor={`ask-${taskId}`}>Your question</label><textarea id={`ask-${taskId}`} className={s.textarea} rows={3} value={text} onChange={e => setText(e.target.value)} /></div>
        <button className={s.button} disabled={busy}>{busy ? 'Thinking…' : 'Ask for a hint'}</button>
      </form>}
      <Status error={error} ok={null} />
    </section>
  );
}

// ---- Join (ACA-US-2.2) ----
export function JoinForm({token, learner, signedIn, emailMatches, hasPhone, signInHref}: {token: string; learner: boolean; signedIn: boolean; emailMatches: boolean; hasPhone: boolean; signInHref: string}) {
  const router = useRouter();
  const [adult, setAdult] = useState<'yes' | 'no' | ''>(''), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [refused, setRefused] = useState(false);
  async function under18() { setBusy(true); try { await call('join.under18', {token}); setRefused(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const consents = Object.fromEntries(['core', 'reminder_whatsapp', 'reminder_sms', 'reminder_email', 'share_examples', 'research_interview'].map(k => [k, fd.get(k) === 'on']));
    try { await call('join.accept', {token, adult: learner ? adult === 'yes' : undefined, consents}); router.push('/loop'); router.refresh(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (refused) return <div className={s.notice} role="status">Thank you. Aplyd Academy is for adults (18 and over) at this stage, so you cannot join now. Nothing about you has been kept.</div>;
  if (learner && adult === '') return (
    <fieldset className={s.card}>
      <legend className={s.legend}>Are you 18 or older?</legend>
      <div className={s.row}><button type="button" className={s.button} onClick={() => setAdult('yes')}>Yes, I am 18 or older</button><button type="button" className={`${s.button} ${s.secondary}`} onClick={() => { setAdult('no'); void under18(); }} disabled={busy}>No, I am under 18</button></div>
      <Status error={error} ok={null} />
    </fieldset>
  );
  if (!signedIn) return <div className={s.card}><p>Next, sign in with the email address this invite was sent to. You will come back here to finish joining.</p><a className={s.button} href={signInHref}>Sign in to join</a></div>;
  if (!emailMatches) return <div className={s.error} role="alert">You are signed in with a different email from the one this invite was sent to. Sign out and sign in with the invited email.</div>;
  return (
    <form onSubmit={join} className={s.card}>
      {learner && <>
        <h2>Your choices</h2>
        <div className={s.check}><input type="checkbox" id="c-core" name="core" /><label htmlFor="c-core"><strong>I agree to the use of my practice data as the notice above explains.</strong> (Needed to join. You can leave and delete your data at any time.)</label></div>
        <fieldset><legend className={s.legend}>Weekly reminders (optional)</legend>
          <div className={s.check}><input type="checkbox" id="c-wa" name="reminder_whatsapp" disabled={!hasPhone} /><label htmlFor="c-wa">WhatsApp {hasPhone ? '' : '(your association did not give a mobile number; add one later in Settings)'}</label></div>
          <div className={s.check}><input type="checkbox" id="c-sms" name="reminder_sms" disabled={!hasPhone} /><label htmlFor="c-sms">SMS</label></div>
          <div className={s.check}><input type="checkbox" id="c-email" name="reminder_email" /><label htmlFor="c-email">Email</label></div>
        </fieldset>
        <fieldset><legend className={s.legend}>Other choices (optional)</legend>
          <div className={s.check}><input type="checkbox" id="c-ex" name="share_examples" /><label htmlFor="c-ex">My short notes may be quoted without my name in reports to my association</label></div>
          <div className={s.check}><input type="checkbox" id="c-int" name="research_interview" /><label htmlFor="c-int">I may be invited to a short interview about my experience</label></div>
        </fieldset>
      </>}
      <button className={s.button} disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
      <Status error={error} ok={null} />
    </form>
  );
}

// ---- Placement, unaided check and catch-the-AI ----
export function ChoiceQuiz({action, params, questions, submit, done}: {action: string; params: Record<string, unknown>; questions: {id: string; text: string; options: {id: string; text: string}[]}[]; submit: string; done: string}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget), answers = Object.fromEntries(questions.map(q => [q.id, String(fd.get(q.id) ?? '')]));
    try { await call(action, {...params, answers}); router.push(done); router.refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit}>
      {questions.map((q, i) => (
        <fieldset key={q.id} className={s.card}>
          <legend className={s.legend}>{i + 1}. {q.text}</legend>
          {q.options.map(o => <div key={o.id} className={s.check}><input type="radio" id={`${q.id}-${o.id}`} name={q.id} value={o.id} required /><label htmlFor={`${q.id}-${o.id}`}>{o.text}</label></div>)}
        </fieldset>
      ))}
      <button className={s.button} disabled={busy}>{busy ? 'Saving…' : submit}</button>
      <Status error={error} ok={null} />
    </form>
  );
}

export function CatchForm({taskId, segments}: {taskId: string; segments: {id: string; text: string}[]}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try { await call('catch.submit', {taskId, marked: segments.filter(x => fd.get(x.id) === 'on').map(x => x.id)}); router.refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit}>
      <fieldset><legend className={s.legend}>Tick every part you think is wrong</legend>
        {segments.map(x => <div key={x.id} className={s.segment}><input type="checkbox" id={`seg-${x.id}`} name={x.id} /><label htmlFor={`seg-${x.id}`}>{x.text}</label></div>)}
      </fieldset>
      <button className={s.button} disabled={busy}>{busy ? 'Checking…' : 'Check my answers'}</button>
      <Status error={error} ok={null} />
    </form>
  );
}
