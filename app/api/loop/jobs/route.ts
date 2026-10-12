// Scheduled practice-loop jobs, called daily by the server timer (deploy/academy-jobs.timer) with a shared secret:
// reminders (ACA-E5) and retention deletion (ACA-US-6.5). Never reachable without ACADEMY_JOBS_SECRET.
import {timingSafeEqual} from 'node:crypto';
import {env} from '@/lib/platform-env';
import {runReminders} from '@/lib/loop/reminders';
import {runRetention, reapplyDeletionLog} from '@/lib/loop/retention';
import {configuredSenders} from '@/lib/loop/senders';
import {LoopError} from '@/lib/loop/core';
import {json, fail} from '@/lib/loop/http';
import {expectedOrigin} from '@/lib/request-origin';
export const dynamic = 'force-dynamic';

function authorised(request: Request) {
  const secret = process.env.ACADEMY_JOBS_SECRET ?? '';
  const got = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  return secret.length >= 32 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export async function POST(request: Request) {
  try {
    if (!authorised(request)) throw new LoopError('Not allowed.', 403);
    if (!env.DB) throw new LoopError('Database unavailable.', 503);
    const which = new URL(request.url).searchParams.get('job') ?? 'all';
    const out: Record<string, unknown> = {};
    if (which === 'all' || which === 'reminders') out.reminders = await runReminders(env.DB, configuredSenders(env.DB), process.env.ACADEMY_PUBLIC_ORIGIN ?? expectedOrigin(request));
    if (which === 'all' || which === 'retention') out.retention = await runRetention(env.DB);
    // After a restore from backup (deploy/README.md): deleted records must not come back (ACA-US-6.5-AC2).
    if (which === 'reapply-deletions') out.reapplied = await reapplyDeletionLog(env.DB);
    return json(out);
  } catch (e) { return fail(e); }
}
