import { cookies } from 'next/headers';
import { env } from '@/lib/platform-env';
import { endSession } from '@/lib/auth/email-otp';
import { SESSION_COOKIE, clearedCookie } from '@/lib/auth/http';
export const dynamic = 'force-dynamic';

// Signing out ends the session on the server, not only in the browser.
export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    if (env.DB) await endSession(env.DB, token);
  } catch {
    console.error('Academy sign-out could not end the session');
  }
  return new Response(null, {
    status: 303,
    headers: { Location: '/signin', 'Set-Cookie': clearedCookie, 'Cache-Control': 'no-store' },
  });
}
