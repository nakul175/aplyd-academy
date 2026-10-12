import { env } from '@/lib/platform-env';
import { verifyCode, SignInError } from '@/lib/auth/email-otp';
import { json, readJson, failure, sessionCookie } from '@/lib/auth/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!env.DB) throw new SignInError('Sign-in is temporarily unavailable.', 503);
    const s = await verifyCode(env.DB, body.email, body.code);
    return json({ signedIn: true }, 200, { 'Set-Cookie': sessionCookie(s.token, s.maxAgeSeconds, request) });
  } catch (e) {
    return failure(e);
  }
}
