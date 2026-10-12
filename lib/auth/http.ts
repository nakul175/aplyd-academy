// Shared request handling for the sign-in routes: JSON only, same origin only, no caching.
import { expectedOrigin } from '@/lib/request-origin';
import { SignInError } from './email-otp';

export const SESSION_COOKIE = 'academy_session';
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin && origin !== expectedOrigin(request))
    throw new SignInError('This action must come from your Academy.', 403);
  if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json')
    throw new SignInError('Use a JSON request.', 415);
  const raw = await request.text();
  if (raw.length > 2000) throw new SignInError('This request is too large.', 413);
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {}
  throw new SignInError('The request is not valid JSON.');
}

export function failure(e: unknown) {
  if (e instanceof SignInError) return json({ error: e.message }, e.status);
  console.error('Academy sign-in request failed');
  return json({ error: 'Sign-in is unavailable. Please try again.' }, 503);
}

export function sessionCookie(token: string, maxAgeSeconds: number, request: Request) {
  const secure = expectedOrigin(request).startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
export const clearedCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
