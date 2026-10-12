// Email delivery for sign-in codes (ACA-US-1.4). The provider is an open owner decision, so production
// refuses to send until one is configured. The "outbox" transport stores messages in the database for
// local tests only: it keeps codes in plain text and must never be used with real learners.
import {SignInError, type MailSender} from './email-otp';

export function mailSender(db: D1Database): MailSender {
  const transport = process.env.ACADEMY_MAIL_TRANSPORT;
  if (transport === 'outbox') {
    if (process.env.ACADEMY_ENVIRONMENT === 'production') throw new SignInError('Email sign-in is not set up on this server.', 503);
    return async (to, subject, body) => {
      await db.prepare('INSERT INTO academy_mail_outbox(to_address,subject,body,created_at) VALUES(?,?,?,?)')
        .bind(to, subject, body, new Date().toISOString()).run();
    };
  }
  throw new SignInError('Email sign-in is not set up on this server yet.', 503);
}
