// ACA-US-12.5 get help and report a problem from any screen: an acknowledgement for the learner, a facilitator
// queue with time and screen, and security or privacy reports routed to Nakul Jain (security policy, SECURITY.md).
import {
  type Db,
  type Actor,
  LoopError,
  audit,
  refuse,
  requireRole,
  operatorRole,
  requireDecision,
  iso,
  text,
  oneOf,
} from './core';
import type { Send } from './enrolment';

export async function reportProblem(
  db: Db,
  actor: Actor,
  input: { screen?: unknown; kind?: unknown; body?: unknown; memberId?: unknown },
  send: Send,
  now = Date.now(),
) {
  const kind = oneOf(input.kind ?? 'problem', ['problem', 'content', 'security'] as const, 'Type');
  const body = text(input.body, 'What went wrong', 3000),
    screen = text(input.screen ?? 'unknown', 'Screen', 60);
  // The report goes to the organisation the person chose (or their only one); never guessed between organisations.
  const mine = (
    await db
      .prepare(`SELECT id, org_id FROM loop_members WHERE user_id=? AND status='joined'`)
      .bind(actor.userId)
      .all<{ id: string; org_id: string }>()
  ).results;
  const m =
    typeof input.memberId === 'string' && input.memberId
      ? (mine.find((x) => x.id === input.memberId) ??
        (await refuse(db, actor.userId, 'help.report', null, 'You do not have access to this.', now)))
      : new Set(mine.map((x) => x.org_id)).size === 1
        ? mine[0]
        : null;
  if (!m && mine.length > 1 && kind !== 'security')
    throw new LoopError('Choose which organisation this is about.');
  const r = await db
    .prepare(
      'INSERT INTO loop_help_reports(user_id,member_id,org_id,screen,kind,body,at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(actor.userId, m?.id ?? null, m?.org_id ?? null, screen, kind, body, iso(now))
    .run();
  const id = r.meta.last_row_id;
  if (kind === 'security') {
    const contact = await requireDecision<{ email: string }>(db, 'help.security_contact').catch(() => null);
    if (contact?.email)
      await send(
        contact.email,
        `Aplyd Academy security or privacy report #${id}`,
        `A security or privacy report was filed on screen "${screen}" at ${iso(now)}.\n\nOpen Operations to read it. The report text is not included in this email.`,
      );
  }
  await audit(db, actor.userId, `help.report_${kind}`, { org: m?.org_id ?? null, target: String(id), now });
  return {
    id,
    acknowledgement:
      kind === 'security'
        ? `Thank you. Report #${id} has gone to the APLYD product owner, who handles security and privacy reports.`
        : `Thank you. Report #${id} has reached your facilitators. They will reply.`,
  };
}

/** Facilitator queue for their organisation (security reports are not shown here; they go to the owner). */
export async function helpQueue(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  await requireRole(db, actor, orgId, ['facilitator'], 'help.queue', { now });
  return (
    await db
      .prepare(
        `SELECT h.id, h.screen, h.kind, h.body, h.at, m.name FROM loop_help_reports h LEFT JOIN loop_members m ON m.id=h.member_id WHERE h.org_id=? AND h.kind!='security' AND h.status='open' ORDER BY h.at`,
      )
      .bind(orgId)
      .all()
  ).results;
}
export async function securityQueue(db: Db, actor: Actor, now = Date.now()) {
  if ((await operatorRole(db, actor.userId)) !== 'owner')
    return refuse(
      db,
      actor.userId,
      'help.security_queue',
      null,
      'Only the product owner reads security reports.',
      now,
    );
  return (
    await db
      .prepare(
        `SELECT id, screen, body, at, status FROM loop_help_reports WHERE kind='security' ORDER BY at DESC`,
      )
      .all()
  ).results;
}
export async function resolveReport(db: Db, actor: Actor, id: number, resolution: unknown, now = Date.now()) {
  const h = await db
    .prepare('SELECT org_id, kind FROM loop_help_reports WHERE id=?')
    .bind(id)
    .first<{ org_id: string | null; kind: string }>();
  if (!h) throw new LoopError('Report not found.', 404);
  if (h.kind === 'security') {
    if ((await operatorRole(db, actor.userId)) !== 'owner')
      return refuse(
        db,
        actor.userId,
        'help.resolve',
        null,
        'Only the product owner resolves security reports.',
        now,
      );
  } else if (!h.org_id) {
    if (!(await operatorRole(db, actor.userId)))
      return refuse(db, actor.userId, 'help.resolve', null, 'You do not have access to this.', now);
  } else
    await requireRole(db, actor, h.org_id, ['facilitator'], 'help.resolve', { allowOperator: true, now });
  await db
    .prepare(
      `UPDATE loop_help_reports SET status='resolved', resolution=?, resolved_by=?, resolved_at=? WHERE id=?`,
    )
    .bind(text(resolution, 'Resolution', 1000), actor.userId, iso(now), id)
    .run();
  await audit(db, actor.userId, 'help.resolve', { org: h.org_id, target: String(id), now });
}
