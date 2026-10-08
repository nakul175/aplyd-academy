import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { PartnerDummyError } from '@/lib/academy-partner-dummy';
import { viewFor, applyLearnerCommand } from '@/lib/academy-partner-dummy-service';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const respond = (v: unknown, status = 200) => Response.json(v, { status, headers });
const partnerUrl = () => {
  const v = (env as any).ACADEMY_DUMMY_PARTNER_URL;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};
async function who() {
  const user = await getChatGPTUser();
  if (!user) throw new PartnerDummyError('Sign in to open your private learning space.', 401);
  if (!env.DB) throw new PartnerDummyError('Temporarily unavailable.', 503);
  return user;
}
const fail = (e: unknown) =>
  e instanceof PartnerDummyError
    ? respond({ error: e.message }, e.status)
    : respond({ error: 'The dummy-partner request could not be completed. Nothing was sent.' }, 503);
export async function GET() {
  try {
    const u = await who();
    return respond(await viewFor(env.DB as any, u.userId, new Date().toISOString(), !!partnerUrl()));
  } catch (e) {
    return fail(e);
  }
}
/** Learner-only commands: link | grant | withdraw | unlink. Consent never comes from the partner. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new PartnerDummyError('This action must come from your Academy.', 403);
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim() !== 'application/json')
      throw new PartnerDummyError('Use a JSON request.', 415);
    const raw = await request.text();
    if (raw.length > 2000) throw new PartnerDummyError('This request is too large.', 413);
    let cmd: unknown;
    try {
      cmd = JSON.parse(raw);
    } catch {
      throw new PartnerDummyError('The request is not valid JSON.', 400);
    }
    const u = await who();
    await applyLearnerCommand(env.DB as any, u.userId, cmd, new Date().toISOString(), {
      partnerUrl: partnerUrl(),
    });
    return respond(await viewFor(env.DB as any, u.userId, new Date().toISOString(), !!partnerUrl()));
  } catch (e) {
    return fail(e);
  }
}
