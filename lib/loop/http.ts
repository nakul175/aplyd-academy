// HTTP helpers for the practice-loop routes: same-origin JSON only, size-limited, no caching; LoopError → status.
import {expectedOrigin} from '@/lib/request-origin';
import {LoopError} from './core';
import {AiUnavailable} from '@/lib/ai/provider';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data ?? {ok: true}, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers}});

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== expectedOrigin(request)) throw new LoopError('This action must come from your Academy.', 403);
}

export async function readBody(request: Request, max = 300_000): Promise<Record<string, unknown>> {
  sameOrigin(request);
  if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json') throw new LoopError('Use a JSON request.', 415);
  const raw = await request.text();
  if (raw.length > max) throw new LoopError('This request is too large.', 413);
  try { const v = JSON.parse(raw); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
  throw new LoopError('The request is not valid JSON.');
}

export function fail(e: unknown) {
  if (e instanceof LoopError) return json({error: e.message}, e.status);
  if (e instanceof AiUnavailable) return json({error: 'AI help is paused right now. You can keep practising without it.'}, 503);
  if (e instanceof Error && e.name === 'SignInError') return json({error: e.message}, (e as Error & {status?: number}).status ?? 400);
  console.error('Practice loop request failed', e instanceof Error ? e.name : 'unknown');
  return json({error: 'Something went wrong. Please try again.'}, 500);
}
