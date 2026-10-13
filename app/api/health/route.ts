// Health check for the load balancer, deploy script and uptime monitor (ACA-US-1.3, ACA-US-1.5).
// Answers 200 only when the database answers; reveals no data, only the release ID.
import { env } from '@/lib/platform-env';
export const dynamic = 'force-dynamic';

export async function GET() {
  const release = process.env.ACADEMY_RELEASE ?? 'local';
  try {
    if (!env.DB) throw new Error('no database');
    const row = await env.DB.prepare('SELECT count(*) AS n FROM academy_migrations').first<{ n: number }>();
    return Response.json(
      { ok: true, release, migrations: row?.n ?? 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ ok: false, release }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
