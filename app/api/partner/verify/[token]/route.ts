import { env } from 'cloudflare:workers';
import { PartnerDummyError } from '@/lib/academy-partner-dummy';
import { handleVerify } from '@/lib/academy-partner-dummy-service';
import { noStoreJson as respond } from '@/lib/http';
export const dynamic = 'force-dynamic';
/**
 * DUMMY partner permissioned verification. :token is the DEMO member code. The request must be HMAC-signed over
 * "verify:<code>". Only fields behind scopes the learner currently grants are returned; unknown and ungranted look identical.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!env.DB) throw new PartnerDummyError('Temporarily unavailable.', 503);
    const out = await handleVerify(env.DB as any, token, request.headers, Date.now());
    return respond(out.body, out.status);
  } catch (e) {
    if (e instanceof PartnerDummyError) return respond({ error: e.message }, e.status);
    return respond({ error: 'The dummy-partner request could not be completed.' }, 503);
  }
}
