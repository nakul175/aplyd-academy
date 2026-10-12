// ACA-US-5.1-AC2: inbound STOP replies from the WhatsApp or SMS provider. The provider is not chosen yet, so this
// accepts a minimal JSON shape {from, text} behind a shared secret; the chosen provider's adapter maps onto it.
import {timingSafeEqual} from 'node:crypto';
import {env} from '@/lib/platform-env';
import {handleStop} from '@/lib/loop/reminders';
import {LoopError} from '@/lib/loop/core';
import {json, fail} from '@/lib/loop/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, {params}: {params: Promise<{channel: string}>}) {
  try {
    const secret = process.env.ACADEMY_INBOUND_SECRET ?? '', got = request.headers.get('x-academy-inbound-secret') ?? '';
    if (secret.length < 32 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) throw new LoopError('Not allowed.', 403);
    const channel = (await params).channel;
    if (channel !== 'whatsapp' && channel !== 'sms') throw new LoopError('Unknown channel.', 404);
    if (!env.DB) throw new LoopError('Database unavailable.', 503);
    const body = await request.json() as {from?: string; text?: string};
    if (typeof body.from !== 'string' || typeof body.text !== 'string') throw new LoopError('Expected {from, text}.');
    if (!/^\s*(stop|unsubscribe|band|रोकें)\s*$/i.test(body.text)) return json({ignored: true});
    return json(await handleStop(env.DB, channel, body.from));
  } catch (e) { return fail(e); }
}
