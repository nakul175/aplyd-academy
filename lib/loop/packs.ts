// ACA-E3 context packs: ACA-US-3.1 AI-drafted pack with sources (unchecked), ACA-US-3.2 expert review and
// immutable versions, ACA-US-3.3 learner flags and the error log. Items never change in place: a correction is a
// new revision of the same lineage, so every published version stays exactly as it was.
import {
  type Db,
  type Actor,
  LoopError,
  audit,
  refuse,
  requireOperator,
  operatorRole,
  iso,
  newId,
  text,
  oneOf,
  memberById,
} from './core';
import { generate, type AiRequest } from '@/lib/ai/provider';

export const ITEM_KINDS = ['task', 'rule', 'example', 'pitfall', 'planted_errors', 'brief', 'check'] as const;
export type Item = {
  id: string;
  pack_id: string;
  lineage: string;
  revision: number;
  kind: string;
  job_role: string;
  level: string;
  language: string;
  title: string;
  body: string;
  sources: string;
  origin: string;
  status: string;
  month: string | null;
  created_at: string;
};
type Source = { title: string; url?: string; note?: string };

export async function createPack(
  db: Db,
  actor: Actor,
  input: { sector?: unknown; audience?: unknown; title?: unknown; language?: unknown },
  now = Date.now(),
) {
  await requireOperator(db, actor, 'pack.create', now);
  const id = newId('pack');
  await db
    .prepare(
      'INSERT INTO loop_packs(id,sector,audience,language,title,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      text(input.sector, 'Sector', 60).toLowerCase(),
      oneOf(
        input.audience ?? 'learner',
        ['learner', 'teacher', 'university', 'student'] as const,
        'Audience',
      ),
      text(input.language ?? 'en', 'Language', 10),
      text(input.title, 'Pack title', 120),
      actor.userId,
      iso(now),
    )
    .run();
  await audit(db, actor.userId, 'pack.create', { target: id, now });
  return { id };
}

export async function assignReviewer(
  db: Db,
  actor: Actor,
  packId: string,
  input: { email?: unknown; role?: unknown },
  now = Date.now(),
) {
  await requireOperator(db, actor, 'pack.assign_reviewer', now);
  const email = text(input.email, 'Email', 254).toLowerCase();
  const u = await db
    .prepare('SELECT id FROM academy_users WHERE email=?')
    .bind(email)
    .first<{ id: string }>();
  if (!u)
    throw new LoopError(
      'That person needs to sign in to the Academy once before they can be named a reviewer.',
      404,
    );
  const role = oneOf(input.role ?? 'expert', ['expert', 'reviewer', 'bilingual'] as const, 'Reviewer role');
  await db
    .prepare(
      'INSERT OR REPLACE INTO loop_pack_reviewers(pack_id,user_id,role,granted_by,granted_at) VALUES(?,?,?,?,?)',
    )
    .bind(packId, u.id, role, actor.userId, iso(now))
    .run();
  await audit(db, actor.userId, 'pack.assign_reviewer', { target: `${packId}:${u.id}:${role}`, now });
}
export async function reviewerRole(db: Db, packId: string, userId: string) {
  return (
    (
      await db
        .prepare('SELECT role FROM loop_pack_reviewers WHERE pack_id=? AND user_id=?')
        .bind(packId, userId)
        .first<{ role: string }>()
    )?.role ?? null
  );
}
/** ACA-US-3.2-AC3: only the named expert (or reviewer for teacher and university packs) may decide on items. */
export async function requireReviewer(
  db: Db,
  actor: Actor,
  packId: string,
  action: string,
  now = Date.now(),
) {
  const role = await reviewerRole(db, packId, actor.userId);
  if (!role)
    return refuse(db, actor.userId, action, null, 'Only the named reviewer for this pack can do this.', now);
  return role;
}
async function canDraft(db: Db, actor: Actor, packId: string, now: number) {
  if (await operatorRole(db, actor.userId)) return;
  await requireReviewer(db, actor, packId, 'pack.draft', now);
}

function cleanSources(raw: unknown): Source[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new LoopError('Each item needs at least one source.');
  return raw.slice(0, 10).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const url = typeof o.url === 'string' && /^https?:\/\//.test(o.url) ? o.url.slice(0, 500) : undefined;
    return {
      title: text(o.title, 'Source title', 300),
      ...(url ? { url } : {}),
      ...(typeof o.note === 'string' ? { note: o.note.slice(0, 300) } : {}),
    };
  });
}

/** Store drafted items as unchecked (ACA-US-3.1-AC1). Used by the AI drafter and to import an agent-drafted file. */
export async function addDraftItems(
  db: Db,
  actor: Actor,
  packId: string,
  items: unknown,
  { origin = 'ai' as 'ai' | 'expert', now = Date.now() } = {},
) {
  await canDraft(db, actor, packId, now);
  if (!Array.isArray(items) || items.length === 0 || items.length > 200)
    throw new LoopError('Provide between 1 and 200 items.');
  const pack = await db
    .prepare('SELECT language FROM loop_packs WHERE id=?')
    .bind(packId)
    .first<{ language: string }>();
  if (!pack) throw new LoopError('Pack not found.', 404);
  const statements = [],
    ids: string[] = [];
  for (const raw of items) {
    const o = (raw ?? {}) as Record<string, unknown>;
    if ('memberFileIds' in o || 'files' in o)
      throw new LoopError('Members’ work files cannot be used to draft a pack (ACA-US-3.1-AC3).', 403);
    const id = newId('item');
    ids.push(id);
    const month = typeof o.month === 'string' && /^\d{4}-\d{2}$/.test(o.month) ? o.month : null;
    statements.push(
      db
        .prepare(
          `INSERT INTO loop_pack_items(id,pack_id,lineage,revision,kind,job_role,level,language,title,body,sources,origin,status,month,created_by,created_at) VALUES(?,?,?,1,?,?,?,?,?,?,?,?,'unchecked',?,?,?)`,
        )
        .bind(
          id,
          packId,
          id,
          oneOf(o.kind, ITEM_KINDS, 'Item kind'),
          text(o.jobRole ?? '*', 'Job role', 60).toLowerCase(),
          text(o.level ?? '*', 'Level', 20),
          pack.language,
          text(o.title, 'Item title', 200),
          text(o.body, 'Item text', 8000),
          JSON.stringify(cleanSources(o.sources)),
          origin,
          month,
          actor.userId,
          iso(now),
        ),
    );
  }
  await db.batch(statements);
  await audit(db, actor.userId, 'pack.draft', { target: `${packId}:${ids.length}`, now });
  return { ids };
}

/** ACA-US-3.1: ask the AI to draft items from approved inputs only (the association's role list and public sources). */
export async function draftPackWithAi(
  db: Db,
  actor: Actor,
  packId: string,
  input: { roles?: unknown; sources?: unknown; focus?: unknown },
  gen: (r: AiRequest) => Promise<{ text: string }> = generate,
  now = Date.now(),
) {
  await canDraft(db, actor, packId, now);
  const roles = Array.isArray(input.roles) ? input.roles.map((r) => text(r, 'Role', 60)).slice(0, 30) : [];
  if (roles.length === 0) throw new LoopError('Give the association’s role list.');
  const sources = cleanSources(input.sources);
  const pack = await db
    .prepare('SELECT sector, audience, title FROM loop_packs WHERE id=?')
    .bind(packId)
    .first<{ sector: string; audience: string; title: string }>();
  const r = await gen({
    purpose: 'pack-draft',
    maxTokens: 8000,
    temperature: 0.2,
    system:
      'You draft context-pack items for adult learners practising AI on their own work. Use only the given sources. Return JSON only: an array of objects with kind, jobRole, level ("*" for all), title, body, sources (array of {title,url} chosen from the given sources). Kinds: "task" (one practice task on the learner\'s own work), "rule" (one rule to follow when using AI), "example", "pitfall": body in plain English, short sentences. Also include two "check" items, an unaided quiz without AI: body is an object {"questions":[{"id":"q1","text":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"...","correct":true}]}]} with 3 questions and exactly one correct option each. And one "planted_errors" item, an AI answer with mistakes to catch: body is an object {"intro":"...","segments":[{"id":"s1","text":"..."},{"id":"s2","text":"...","planted":true,"explanation":"..."}]} with 5 to 7 segments, 2 or 3 of them planted. Never invent facts, figures or rules not in the sources; when unsure, leave the item out.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          sector: pack?.sector,
          audience: pack?.audience,
          roles,
          sources,
          focus: typeof input.focus === 'string' ? input.focus.slice(0, 500) : undefined,
        }),
      },
    ],
  });
  let items: unknown;
  try {
    items = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new LoopError('The AI draft was not in the expected format; nothing was saved.', 502);
  }
  const allowed = new Set(sources.map((s) => s.title));
  // Check and planted-errors items come back with an object body; they are stored as JSON text.
  if (Array.isArray(items))
    for (const i of items as { body?: unknown }[])
      if (i && typeof i.body === 'object' && i.body !== null) i.body = JSON.stringify(i.body);
  const kept = (Array.isArray(items) ? items : []).filter(
    (i) =>
      Array.isArray((i as { sources?: unknown }).sources) &&
      (i as { sources: Source[] }).sources.every((s) => allowed.has(s?.title)),
  );
  if (kept.length === 0) throw new LoopError('The AI draft cited no given source; nothing was saved.', 502);
  return addDraftItems(db, actor, packId, kept, { origin: 'ai', now });
}

// ---- ACA-US-3.2 ----
export async function reviewQueue(db: Db, actor: Actor, packId: string, now = Date.now()) {
  await requireReviewer(db, actor, packId, 'pack.review_queue', now);
  return (
    await db
      .prepare(
        `SELECT * FROM loop_pack_items WHERE pack_id=? AND status='unchecked' ORDER BY kind, job_role, created_at`,
      )
      .bind(packId)
      .all<Item>()
  ).results;
}

export async function reviewItem(
  db: Db,
  actor: Actor,
  itemId: string,
  input: { decision?: unknown; note?: unknown; title?: unknown; body?: unknown; sources?: unknown },
  now = Date.now(),
) {
  const item = await db.prepare('SELECT * FROM loop_pack_items WHERE id=?').bind(itemId).first<Item>();
  if (!item) throw new LoopError('Item not found.', 404);
  await requireReviewer(db, actor, item.pack_id, 'pack.review', now);
  if (item.status !== 'unchecked')
    throw new LoopError('This item has already been decided. Change it with a correction instead.', 409);
  const decision = oneOf(input.decision, ['approve', 'correct', 'reject'] as const, 'Decision');
  const note = text(input.note, 'Note', 1000, { optional: true }) || null;
  const statements = [
    db
      .prepare('INSERT INTO loop_pack_reviews(item_id,decision,reviewer,note,at) VALUES(?,?,?,?,?)')
      .bind(item.id, decision, actor.userId, note, iso(now)),
  ];
  let resultId = item.id;
  if (decision === 'approve')
    statements.push(db.prepare(`UPDATE loop_pack_items SET status='approved' WHERE id=?`).bind(item.id));
  else if (decision === 'reject')
    statements.push(db.prepare(`UPDATE loop_pack_items SET status='rejected' WHERE id=?`).bind(item.id));
  else {
    resultId = newId('item');
    statements.push(db.prepare(`UPDATE loop_pack_items SET status='superseded' WHERE id=?`).bind(item.id));
    statements.push(
      db
        .prepare(
          `INSERT INTO loop_pack_items(id,pack_id,lineage,revision,kind,job_role,level,language,title,body,sources,origin,status,month,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'expert','approved',?,?,?)`,
        )
        .bind(
          resultId,
          item.pack_id,
          item.lineage,
          item.revision + 1,
          item.kind,
          item.job_role,
          item.level,
          item.language,
          text(input.title ?? item.title, 'Item title', 200),
          text(input.body, 'Corrected text', 8000),
          input.sources === undefined ? item.sources : JSON.stringify(cleanSources(input.sources)),
          item.month,
          actor.userId,
          iso(now),
        ),
    );
  }
  await db.batch(statements);
  await audit(db, actor.userId, `pack.review_${decision}`, { target: item.id, now });
  return { id: resultId };
}

/** ACA-US-3.2-AC2: a published item is changed by adding a new revision; it reaches learners only after review and a new version. */
export async function reviseItem(
  db: Db,
  actor: Actor,
  itemId: string,
  input: { title?: unknown; body?: unknown; sources?: unknown },
  now = Date.now(),
) {
  const item = await db.prepare('SELECT * FROM loop_pack_items WHERE id=?').bind(itemId).first<Item>();
  if (!item) throw new LoopError('Item not found.', 404);
  await requireReviewer(db, actor, item.pack_id, 'pack.revise', now);
  const latest = await db
    .prepare('SELECT max(revision) r FROM loop_pack_items WHERE lineage=?')
    .bind(item.lineage)
    .first<{ r: number }>();
  const id = newId('item');
  await db
    .prepare(
      `INSERT INTO loop_pack_items(id,pack_id,lineage,revision,kind,job_role,level,language,title,body,sources,origin,status,month,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'expert','approved',?,?,?)`,
    )
    .bind(
      id,
      item.pack_id,
      item.lineage,
      latest!.r + 1,
      item.kind,
      item.job_role,
      item.level,
      item.language,
      text(input.title ?? item.title, 'Item title', 200),
      text(input.body ?? item.body, 'Item text', 8000),
      input.sources === undefined ? item.sources : JSON.stringify(cleanSources(input.sources)),
      item.month,
      actor.userId,
      iso(now),
    )
    .run();
  await db
    .prepare(
      `INSERT INTO loop_pack_reviews(item_id,decision,reviewer,note,at) VALUES(?,'correct',?,'Revision of a published item',?)`,
    )
    .bind(id, actor.userId, iso(now))
    .run();
  await audit(db, actor.userId, 'pack.revise', { target: id, now });
  return { id };
}

/** The approved item of each lineage with the highest revision. */
async function approvedHeads(db: Db, packId: string) {
  return (
    await db
      .prepare(
        `SELECT i.* FROM loop_pack_items i WHERE i.pack_id=? AND i.status='approved'
    AND i.revision=(SELECT max(revision) FROM loop_pack_items j WHERE j.lineage=i.lineage AND j.status='approved') ORDER BY i.kind, i.job_role, i.title`,
      )
      .bind(packId)
      .all<Item>()
  ).results;
}

export async function latestVersion(db: Db, packId: string) {
  const v = await db
    .prepare('SELECT * FROM loop_pack_versions WHERE pack_id=? ORDER BY version DESC LIMIT 1')
    .bind(packId)
    .first<{ version: number; item_ids: string; changes: string; published_at: string }>();
  return v
    ? {
        version: v.version,
        itemIds: JSON.parse(v.item_ids) as string[],
        changes: JSON.parse(v.changes) as Change[],
        publishedAt: v.published_at,
      }
    : null;
}
export type Change = {
  lineage: string;
  title: string;
  change: 'added' | 'changed' | 'removed';
  from?: number;
  to?: number;
};

/** ACA-US-3.2-AC1/AC2 and ACA-US-14.1-AC2: publish the approved heads as a new immutable version with a change list. */
export async function publishVersion(
  db: Db,
  actor: Actor,
  packId: string,
  { retire = [] as string[], now = Date.now() } = {},
) {
  await requireReviewer(db, actor, packId, 'pack.publish', now);
  const prev = await latestVersion(db, packId);
  const retired = new Set(retire);
  const heads = (await approvedHeads(db, packId)).filter((i) => !retired.has(i.lineage));
  if (heads.length === 0) throw new LoopError('There are no approved items to publish.', 409);
  const prevItems = prev
    ? (
        await db
          .prepare(
            `SELECT id, lineage, revision, title FROM loop_pack_items WHERE id IN (SELECT value FROM json_each(?))`,
          )
          .bind(JSON.stringify(prev.itemIds))
          .all<{ id: string; lineage: string; revision: number; title: string }>()
      ).results
    : [];
  const before = new Map(prevItems.map((i) => [i.lineage, i]));
  const changes: Change[] = [];
  for (const h of heads) {
    const b = before.get(h.lineage);
    if (!b) changes.push({ lineage: h.lineage, title: h.title, change: 'added', to: h.revision });
    else if (b.id !== h.id)
      changes.push({
        lineage: h.lineage,
        title: h.title,
        change: 'changed',
        from: b.revision,
        to: h.revision,
      });
    before.delete(h.lineage);
  }
  for (const b of before.values())
    changes.push({ lineage: b.lineage, title: b.title, change: 'removed', from: b.revision });
  if (prev && changes.length === 0)
    throw new LoopError('Nothing has changed since the last published version.', 409);
  const version = (prev?.version ?? 0) + 1;
  await db
    .prepare(
      'INSERT INTO loop_pack_versions(pack_id,version,item_ids,changes,published_by,published_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(
      packId,
      version,
      JSON.stringify(heads.map((h) => h.id)),
      JSON.stringify(changes),
      actor.userId,
      iso(now),
    )
    .run();
  await audit(db, actor.userId, 'pack.publish', { target: `${packId}:v${version}`, now });
  return { version, changes };
}

/** What learners may see: items of a published version only (ACA-US-3.1-AC2). */
export async function publishedItems(db: Db, packId: string, version?: number) {
  const v = version
    ? await db
        .prepare('SELECT version, item_ids FROM loop_pack_versions WHERE pack_id=? AND version=?')
        .bind(packId, version)
        .first<{ version: number; item_ids: string }>()
    : await db
        .prepare(
          'SELECT version, item_ids FROM loop_pack_versions WHERE pack_id=? ORDER BY version DESC LIMIT 1',
        )
        .bind(packId)
        .first<{ version: number; item_ids: string }>();
  if (!v) return { version: 0, items: [] as Item[] };
  const items = (
    await db
      .prepare(
        `SELECT * FROM loop_pack_items WHERE id IN (SELECT value FROM json_each(?)) ORDER BY kind, title`,
      )
      .bind(v.item_ids)
      .all<Item>()
  ).results;
  return { version: v.version, items };
}

// ---- ACA-US-3.3 ----
export async function flagItem(
  db: Db,
  actor: Actor,
  memberId: string,
  itemId: string,
  reason: unknown,
  now = Date.now(),
) {
  const m = await memberById(db, memberId);
  if (!m || m.user_id !== actor.userId || m.status !== 'joined' || !m.cohort_id)
    return refuse(db, actor.userId, 'pack.flag', m?.org_id ?? null, 'You do not have access to this.', now);
  const cohort = await db
    .prepare('SELECT pack_id FROM loop_cohorts WHERE id=?')
    .bind(m.cohort_id)
    .first<{ pack_id: string | null }>();
  const item = await db
    .prepare('SELECT pack_id FROM loop_pack_items WHERE id=?')
    .bind(itemId)
    .first<{ pack_id: string }>();
  const pub =
    cohort?.pack_id && item?.pack_id === cohort.pack_id
      ? await db
          .prepare(
            `SELECT max(v.version) v FROM loop_pack_versions v, json_each(v.item_ids) e WHERE v.pack_id=? AND e.value=?`,
          )
          .bind(item.pack_id, itemId)
          .first<{ v: number | null }>()
      : null;
  if (!pub?.v)
    return refuse(db, actor.userId, 'pack.flag', m.org_id, 'You can flag only items from your pack.', now);
  await db
    .prepare('INSERT INTO loop_flags(item_id,pack_version,member_id,reason,at) VALUES(?,?,?,?,?)')
    .bind(itemId, pub.v, m.id, text(reason, 'Reason', 1000), iso(now))
    .run();
  await audit(db, actor.userId, 'pack.flag', { org: m.org_id, target: itemId, now });
  return { flagged: true };
}

/** The error log: flags with the item and version; the flagging learner is never shown to the expert. */
export async function errorLog(
  db: Db,
  actor: Actor,
  packId: string,
  { status = 'open', now = Date.now() } = {},
) {
  await requireReviewer(db, actor, packId, 'pack.error_log', now);
  return (
    await db
      .prepare(
        `SELECT f.id, f.item_id, f.pack_version, f.reason, f.at, f.status, f.resolution, f.resolved_at, i.title, i.lineage, i.revision
    FROM loop_flags f JOIN loop_pack_items i ON i.id=f.item_id WHERE i.pack_id=? AND (?='all' OR f.status=?) ORDER BY f.at`,
      )
      .bind(packId, status, status)
      .all()
  ).results;
}

export async function resolveFlag(
  db: Db,
  actor: Actor,
  flagId: number,
  resolution: unknown,
  now = Date.now(),
) {
  const f = await db
    .prepare('SELECT f.*, i.pack_id FROM loop_flags f JOIN loop_pack_items i ON i.id=f.item_id WHERE f.id=?')
    .bind(flagId)
    .first<{ id: number; status: string; pack_id: string }>();
  if (!f) throw new LoopError('Flag not found.', 404);
  await requireReviewer(db, actor, f.pack_id, 'pack.resolve_flag', now);
  if (f.status !== 'open') throw new LoopError('This flag is already resolved.', 409);
  await db
    .prepare(`UPDATE loop_flags SET status='resolved', resolution=?, resolved_by=?, resolved_at=? WHERE id=?`)
    .bind(text(resolution, 'Resolution', 1000), actor.userId, iso(now), f.id)
    .run();
  await audit(db, actor.userId, 'pack.resolve_flag', { target: String(f.id), now });
}

export async function attachPackToCohort(
  db: Db,
  actor: Actor,
  cohortId: string,
  packId: string,
  now = Date.now(),
) {
  await requireOperator(db, actor, 'cohort.attach_pack', now);
  const c = await db
    .prepare('SELECT org_id FROM loop_cohorts WHERE id=?')
    .bind(cohortId)
    .first<{ org_id: string }>();
  if (!c) throw new LoopError('Cohort not found.', 404);
  await db.prepare('UPDATE loop_cohorts SET pack_id=? WHERE id=?').bind(packId, cohortId).run();
  await audit(db, actor.userId, 'cohort.attach_pack', {
    org: c.org_id,
    target: `${cohortId}:${packId}`,
    now,
  });
}
