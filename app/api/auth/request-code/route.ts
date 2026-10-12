import { env } from '@/lib/platform-env';
import { requestCode, SignInError } from '@/lib/auth/email-otp';
import { mailSender } from '@/lib/auth/mail';
import { json, readJson, failure } from '@/lib/auth/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!env.DB) throw new SignInError('Sign-in is temporarily unavailable.', 503);
    await requestCode(env.DB, body.email, mailSender(env.DB));
    return json({ sent: true });
  } catch (e) {
    return failure(e);
  }
}
