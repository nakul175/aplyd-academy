// Email delivery for sign-in codes (ACA-US-1.4). Provider: Resend (owner decision, 12 October 2026).
// Production refuses to send until RESEND_API_KEY and ACADEMY_MAIL_FROM are set. The "outbox" transport stores messages in the database for
// local tests only: it keeps codes in plain text and must never be used with real learners.
import { SignInError, type MailSender } from './email-otp';

export function mailSender(db: D1Database): MailSender {
  const transport = process.env.ACADEMY_MAIL_TRANSPORT;
  if (transport === 'outbox') {
    if (process.env.ACADEMY_ENVIRONMENT === 'production')
      throw new SignInError('Email sign-in is not set up on this server.', 503);
    return async (to, subject, body) => {
      await db
        .prepare('INSERT INTO academy_mail_outbox(to_address,subject,body,created_at) VALUES(?,?,?,?)')
        .bind(to, subject, body, new Date().toISOString())
        .run();
    };
  }
  if (transport === 'resend') return resendSender();
  throw new SignInError('Email sign-in is not set up on this server yet.', 503);
}

// Resend HTTP API: POST /emails with from, to, subject and text. A failed send is reported to the
// learner as "try again"; the address and the code are never logged.
function resendSender(): MailSender {
  const key = process.env.RESEND_API_KEY,
    from = process.env.ACADEMY_MAIL_FROM;
  if (!key || !from) throw new SignInError('Email sign-in is not set up on this server yet.', 503);
  const base = process.env.ACADEMY_RESEND_API_URL ?? 'https://api.resend.com';
  return async (to, subject, text) => {
    let status = 0;
    try {
      const r = await fetch(base + '/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      status = r.status;
      if (r.ok) return;
    } catch {
      /* network error or timeout */
    }
    console.error(`Academy sign-in email not sent (provider status ${status || 'none'})`);
    throw new SignInError('We could not send the email. Please try again in a minute.', 503);
  };
}
