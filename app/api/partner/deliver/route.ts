import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { PartnerDummyError } from '@/lib/academy-partner-dummy';
import { deliverProgress, viewFor } from '@/lib/academy-partner-dummy-service';
import { noStoreJson as respond, hasForeignOrigin } from '@/lib/http';
export const dynamic = 'force-dynamic';
/** Explicit "Send progress to partner (dummy)" button. No cron, no background retry. Loopback URL only. */
export async function POST(request: Request) {
  try {
    if (hasForeignOrigin(request))
      throw new PartnerDummyError('This action must come from your Academy.', 403);
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim() !== 'application/json')
      throw new PartnerDummyError('Use a JSON request.', 415);
    const raw = await request.text();
    if (raw.length > 500) throw new PartnerDummyError('This request is too large.', 413);
    let v: any;
    try {
      v = JSON.parse(raw);
    } catch {
      throw new PartnerDummyError('The request is not valid JSON.', 400);
    }
    if (!v || typeof v.linkId !== 'string' || Object.keys(v).some((k) => k !== 'linkId'))
      throw new PartnerDummyError('Choose a partner link.', 400);
    const user = await getChatGPTUser();
    if (!user) throw new PartnerDummyError('Sign in to open your private learning space.', 401);
    if (!env.DB) throw new PartnerDummyError('Temporarily unavailable.', 503);
    const url = (env as any).ACADEMY_DUMMY_PARTNER_URL,
      now = new Date().toISOString();
    const result = await deliverProgress(env.DB as any, user.userId, v.linkId, now, {
      partnerUrl: typeof url === 'string' && url.trim() ? url.trim() : undefined,
    });
    return respond({
      result,
      view: await viewFor(env.DB as any, user.userId, new Date().toISOString(), true),
    });
  } catch (e) {
    return e instanceof PartnerDummyError
      ? respond({ error: e.message }, e.status)
      : respond({ error: 'The dummy-partner request could not be completed. Nothing was sent.' }, 503);
  }
}
