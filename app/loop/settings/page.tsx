// ACA-US-2.2-AC3 withdraw or give consents; ACA-US-6.4 download or delete my data; ACA-US-2.6 my access end date.
import Link from 'next/link';
import {Shell, pageContext} from '../shell';
import {myMemberships, LEARNER_ROLES, type Db, type Member} from '@/lib/loop/core';
import {currentConsents} from '@/lib/loop/enrolment';
import {accessStatus} from '@/lib/loop/levels';
import {ActionButton, ActionForm} from '../client';
import s from '../loop.module.css';
export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {reminder_whatsapp: 'WhatsApp reminders', reminder_sms: 'SMS reminders', reminder_email: 'Email reminders', share_examples: 'My notes may be quoted without my name in reports', research_interview: 'I may be invited to an interview'};

async function MembershipSettings({db, m}: {db: Db; m: Member & {org_name: string}}) {
        const c = await currentConsents(db, m.id), a = await accessStatus(db, m);
        return (
          <section key={m.id} className={s.card}>
            <h2>{m.org_name}</h2>
            {a.ends && <p>Practice access until <strong>{a.ends}</strong>.</p>}
            <p className={s.muted}>You agreed to notice version {c.core?.noticeVersion} on {c.core?.at.slice(0, 10)}.</p>
            <ul className={s.list}>{Object.entries(LABELS).map(([k, label]) => <li key={k} className={s.row}><span style={{flex: 1}}>{label}: <strong>{c[k]?.granted ? 'on' : 'off'}</strong></span>
              {c[k]?.granted ? <ActionButton action="consent.set" params={{memberId: m.id, purpose: k, granted: false}} label="Turn off" secondary />
                : (k === 'reminder_whatsapp' || k === 'reminder_sms') && !m.phone ? null : <ActionButton action="consent.set" params={{memberId: m.id, purpose: k, granted: true}} label="Turn on" secondary />}</li>)}</ul>
            {!m.phone && <details><summary>Add a mobile number for WhatsApp reminders</summary>
              <ActionForm id={`ph-${m.id}`} action="consent.set" params={{memberId: m.id, purpose: 'reminder_whatsapp', granted: true}} fields={[{name: 'phone', label: 'Mobile number with country code', type: 'tel', required: true, hint: 'For example +91 98765 43210'}]} submit="Turn on WhatsApp reminders" /></details>}
          </section>
        );
}

export default async function Settings() {
  const {db, user} = await pageContext('/loop/settings');
  const ms = (await myMemberships(db, user.userId)).filter(m => (LEARNER_ROLES as readonly string[]).includes(m.role));
  return (
    <Shell title="Settings and my data" screen="settings">
      {ms.map(m => <MembershipSettings key={m.id} db={db} m={m} />)}
      <section className={s.card}><h2>Your data</h2>
        <p><a className={s.button} href="/api/loop/export" download>Download my practice data</a></p>
        <p>To delete your account and all your data, go to <Link href="/account">Delete my data</Link>.</p>
      </section>
    </Shell>
  );
}
