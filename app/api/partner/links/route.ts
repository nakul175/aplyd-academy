import { env } from '@/lib/platform-env';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { PartnerDummyError } from '@/lib/academy-partner-dummy';
import { viewFor, applyLearnerCommand } from '@/lib/academy-partner-dummy-service';
import { noStoreJson as respond, hasForeignOrigin } from '@/lib/http';
export const dynamic = 'force-dynamic';
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
    if (hasForeignOrigin(request))
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
