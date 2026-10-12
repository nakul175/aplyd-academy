// Practice loop actions (POST {action, params}). Permission checks live in lib/loop; see lib/loop/api.ts.
import {env} from '@/lib/platform-env';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {dispatch} from '@/lib/loop/api';
import {LoopError} from '@/lib/loop/core';
import {json, readBody, fail} from '@/lib/loop/http';
import {expectedOrigin} from '@/lib/request-origin';
import '@/lib/loop/extensions';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (!env.DB) throw new LoopError('The Academy is temporarily unavailable.', 503);
    const user = await getChatGPTUser();
    const result = await dispatch({db: env.DB, actor: user ? {userId: user.userId, email: user.email} : null, origin: expectedOrigin(request), now: Date.now()}, body);
    return json(result ?? {ok: true});
  } catch (e) { return fail(e); }
}
