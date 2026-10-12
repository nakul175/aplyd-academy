// ACA-US-1.2 AC2: when a signed-in user is refused another workspace's data (HTTP 403 or 404 from a rule check),
// the attempt is recorded. Only a pseudonymous actor reference, the route path, the method and the status are
// stored: no workspace ID, token, query string or request body. Recording is best effort and never changes
// the response the user gets.
import { env } from '@/lib/platform-env';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { pseudonymMap } from '@/lib/academy-audit-detail';

export async function recordRefusal(request: Request, status: number): Promise<void> {
  if (status !== 403 && status !== 404) return;
  try {
    const db = env.DB;
    const user = await getChatGPTUser();
    if (!db || !user) return;
    const ref = (await pseudonymMap([user.userId], 'refusal'))(user.userId);
    await db
      .prepare(
        'INSERT INTO academy_access_refusals(actor_ref,route,method,status,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(ref, new URL(request.url).pathname, request.method, status, new Date().toISOString())
      .run();
  } catch {
    console.error('Academy refusal could not be recorded');
  }
}
