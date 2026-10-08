import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { RuleError } from '@/lib/academy-engine';
import {
  pseudonymMap,
  buildAuditQuery,
  pageOf,
  projectAuditRow,
  AuditQueryError,
} from '@/lib/academy-audit-detail';
export const dynamic = 'force-dynamic';
const response = (x: any, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
// A learner reads only the audit of their own personal practice lab (owner = signed-in user).
export async function GET(request: Request) {
  try {
    const u = await getChatGPTUser();
    if (!u) throw new RuleError('Sign in to read your activity record.', 401);
    if (!env.DB) throw new RuleError('Your activity record is temporarily unavailable.', 503);
    const url = new URL(request.url),
      param = (k: string) => url.searchParams.get(k) ?? undefined,
      refOf = await pseudonymMap([u.userId], 'personal');
    const q = buildAuditQuery('academy_audit', u.userId, {
      limit: param('limit'),
      before: param('before'),
      type: param('type'),
      target: param('target'),
      from: param('from'),
      to: param('to'),
    });
    const rows: any[] = (
        await env.DB.prepare(q.sql)
          .bind(...q.binds)
          .all()
      ).results,
      page = pageOf(rows, q.limit);
    return response({
      items: page.items.map((r) => projectAuditRow(r, refOf(u.userId))),
      nextBefore: page.nextBefore,
      actors: { [refOf(u.userId)]: 'You' },
    });
  } catch (e) {
    if (e instanceof AuditQueryError) return response({ error: e.message }, 400);
    if (e instanceof RuleError) return response({ error: e.message }, e.status);
    console.error('Academy activity record read failed');
    return response({ error: 'Could not open your activity record.' }, 503);
  }
}
