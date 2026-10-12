// ACA-US-6.4-AC1: download my practice-loop data as a readable JSON file.
import {env} from '@/lib/platform-env';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {exportLoopData} from '@/lib/loop/retention';
import {LoopError} from '@/lib/loop/core';
import {fail} from '@/lib/loop/http';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!env.DB) throw new LoopError('The Academy is temporarily unavailable.', 503);
    const u = await getChatGPTUser();
    if (!u) throw new LoopError('Sign in to continue.', 401);
    const data = await exportLoopData(env.DB, {userId: u.userId});
    return new Response(JSON.stringify(data, null, 2), {headers: {'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="aplyd-academy-my-data.json"', 'Cache-Control': 'no-store'}});
  } catch (e) { return fail(e); }
}
