// Delivery adapters for reminders. Email uses the Academy mail transport (Resend in production, outbox locally).
// WhatsApp and SMS providers are not chosen yet (owner decision pending): only the local outbox exists for them,
// enabled with ACADEMY_MESSAGE_TRANSPORT=outbox outside production. Adding a provider means adding an adapter here.
import {mailSender} from '@/lib/auth/mail';
import {outboxSenders, type Senders} from './reminders';
import type {Db} from './core';

export function configuredSenders(db: Db): Senders {
  const s: Senders = {};
  try { const m = mailSender(db); s.email = msg => m(msg.to, 'Your Aplyd Academy practice', msg.body); } catch { /* email not configured */ }
  if (process.env.ACADEMY_MESSAGE_TRANSPORT === 'outbox' && process.env.ACADEMY_ENVIRONMENT !== 'production') Object.assign(s, outboxSenders(db, ['whatsapp', 'sms']));
  return s;
}
