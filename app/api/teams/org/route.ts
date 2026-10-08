import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { projectOrgOverview, isActiveOwner, ORG_LIMITS } from '@/lib/academy-org-admin';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const response = (data: any, status = 200) => Response.json(data, { status, headers });
const NOT_FOUND = { error: 'Not found.' };
/** Read-only organisation overview (BR-38). GET only; there is no write path here.
 * Signed-out users get 401 as elsewhere. A signed-in user who owns no workspace always gets the same
 * 404 body, so they cannot tell "no such feature" from "not allowed". Ownership is re-checked per
 * workspace against the stored aggregate by projectOrgOverview; workspaces the user does not own
 * never leave the server. */
export async function GET() {
  try {
    const u = await getChatGPTUser();
    if (!u) return response({ error: 'Sign in to access Academy workspaces.' }, 401);
    const db = env.DB;
    if (!db) return response({ error: 'Workspaces are temporarily unavailable.' }, 503);
    // Same candidate discovery as GET /api/teams (directory table plus not-yet-projected legacy rows), bound to the trusted userId.
    const ids = await db
      .prepare(
        "WITH candidates AS (SELECT team_id FROM academy_team_directory WHERE user_id = ? UNION SELECT legacy.id FROM academy_teams legacy WHERE legacy.directory_projected = 0 AND EXISTS (SELECT 1 FROM json_each(legacy.data, '$.members') lm WHERE json_extract(lm.value, '$.userId') = ?)) SELECT t.id AS id FROM academy_teams t JOIN json_each(t.data, '$.members') m WHERE t.id IN (SELECT team_id FROM candidates) AND json_extract(m.value, '$.userId') = ? AND json_extract(m.value, '$.active') = 1 AND json_extract(m.value, '$.roles') LIKE '%\"admin\"%' ORDER BY t.updated_at DESC, t.id ASC LIMIT ?",
      )
      .bind(u.userId, u.userId, u.userId, ORG_LIMITS.workspaces)
      .all();
    const teams: any[] = [];
    for (const r of ids.results as any[]) {
      if (teams.length >= ORG_LIMITS.workspaces) break;
      const row: any = await db.prepare('SELECT data FROM academy_teams WHERE id=?').bind(r.id).first();
      if (!row) continue;
      const t = JSON.parse(row.data);
      if (isActiveOwner(t, u.userId)) teams.push(t);
    }
    if (!teams.length) return response(NOT_FOUND, 404);
    return response(projectOrgOverview(teams, u.userId));
  } catch {
    console.error('Organisation overview failed');
    return response({ error: 'Could not load the organisation overview.' }, 503);
  }
}
