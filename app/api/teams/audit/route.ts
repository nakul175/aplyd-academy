import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { RuleError } from '@/lib/academy-engine';
import { Team } from '@/lib/academy-teams';
import {
  pseudonymMap,
  buildAuditQuery,
  pageOf,
  projectAuditRow,
  isActorRef,
  AuditQueryError,
} from '@/lib/academy-audit-detail';
export const dynamic = 'force-dynamic';
const response = (x: any, status = 200) =>
  Response.json(x, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
const denied = () => new RuleError('Workspace audit is not available for your account.', 404);
// Workspace owners only. Non-members, inactive members, learners, moderators and unknown workspaces all receive the same 404.
export async function GET(request: Request) {
  try {
    const u = await getChatGPTUser();
    if (!u) throw new RuleError('Sign in to read the workspace audit.', 401);
    if (!env.DB) throw new RuleError('Workspace audit is temporarily unavailable.', 503);
    const url = new URL(request.url),
      id = url.searchParams.get('teamId');
    if (!id) throw denied();
    const row: any = await env.DB.prepare('SELECT data FROM academy_teams WHERE id=?').bind(id).first();
    if (!row) throw denied();
    const t = JSON.parse(row.data) as Team,
      me = t.members.find((m) => m.userId === u.userId);
    if (!me || !me.active || !me.roles.includes('admin')) throw denied();
    const refOf = await pseudonymMap(
        t.members.map((m) => m.userId),
        t.id,
      ),
      param = (k: string) => url.searchParams.get(k) ?? undefined;
    let actorUserId: string | null | undefined;
    const actor = param('actor');
    if (actor) {
      const hit = t.members.find(
        (m) => m.userId === actor || (isActorRef(actor) && refOf(m.userId) === actor),
      );
      actorUserId = hit?.userId ?? null;
    }
    const q = buildAuditQuery('academy_team_audit', t.id, {
      limit: param('limit'),
      before: param('before'),
      type: param('type'),
      target: param('target'),
      from: param('from'),
      to: param('to'),
      actorUserId,
    });
    const rows: any[] = (
        await env.DB.prepare(q.sql)
          .bind(...q.binds)
          .all()
      ).results,
      page = pageOf(rows, q.limit);
    return response({
      items: page.items.map((r) => projectAuditRow(r, refOf(r.actor))),
      nextBefore: page.nextBefore,
      actors: Object.fromEntries(
        t.members.map((m) => [refOf(m.userId), String(m.name || 'Member').slice(0, 80)]),
      ),
    });
  } catch (e) {
    if (e instanceof AuditQueryError) return response({ error: e.message }, 400);
    if (e instanceof RuleError) return response({ error: e.message }, e.status);
    console.error('Academy audit read failed');
    return response({ error: 'Could not open the workspace audit.' }, 503);
  }
}
