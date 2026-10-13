// ACA-US-19.2: transcribe a spoken answer. The recording stays in memory, is sent once and discarded.
import { env } from '@/lib/platform-env';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { transcribe, MAX_AUDIO_BYTES } from '@/lib/loop/voice';
import { LoopError } from '@/lib/loop/core';
import { json, fail, sameOrigin, readCapped } from '@/lib/loop/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!env.DB) throw new LoopError('The Academy is temporarily unavailable.', 503);
    const u = await getChatGPTUser();
    if (!u) throw new LoopError('Sign in to continue.', 401);
    const memberId = new URL(request.url).searchParams.get('member') ?? '';
    const audio = await readCapped(request, MAX_AUDIO_BYTES);
    return json(
      await transcribe(
        env.DB,
        { userId: u.userId },
        memberId,
        audio,
        request.headers.get('content-type') ?? '',
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
