// ACA-E13 staying current in my own context (in scope only when the owner records it: scope.release includes ACA-E13).
// 13.1 an AI-drafted monthly brief per role and level from approved sources, within the owner's length limit;
// 13.2 the expert reviews it like any pack item (briefs are pack items of kind "brief"); learners flag it into the
// same error log; 13.3 an optional task that applies the change to the learner's own work, counted and tagged.
import {
  type Db,
  type Actor,
  LoopError,
  audit,
  requireSelf,
  requireOperator,
  requireDecision,
  requireEpic,
  iso,
  newId,
  text,
} from './core';
import { cohortOf } from './enrolment';
import { currentLevel, requireActiveAccess } from './levels';
import { addDraftItems, publishedItems, type Item } from './packs';
import { weekOf } from './practice';
import { pausedByHarm } from './students';
import { generate, type AiRequest } from '@/lib/ai/provider';

const monthOfDate = (now: number) => iso(now).slice(0, 7);

export async function draftBriefs(
  db: Db,
  actor: Actor,
  packId: string,
  input: { month?: unknown; roles?: unknown; levels?: unknown; sources?: unknown },
  gen: (r: AiRequest) => Promise<{ text: string }> = generate,
  now = Date.now(),
) {
  await requireEpic(db, 'ACA-E13');
  await requireOperator(db, actor, 'brief.draft', now);
  const words = (await requireDecision<{ words: number }>(db, 'brief.max_words')).words;
  const month =
    typeof input.month === 'string' && /^\d{4}-\d{2}$/.test(input.month) ? input.month : monthOfDate(now);
  const roles = Array.isArray(input.roles) ? input.roles.map((r) => text(r, 'Role', 60)) : [];
  const levels = Array.isArray(input.levels) ? input.levels.map((l) => text(l, 'Level', 20)) : [];
  const sources = Array.isArray(input.sources) ? (input.sources as { title: string; url?: string }[]) : [];
  if (!roles.length || !levels.length || !sources.length)
    throw new LoopError('Give roles, levels and approved sources.');
  const items = [];
  for (const role of roles)
    for (const level of levels) {
      const r = await gen({
        purpose: 'brief-draft',
        maxTokens: 1200,
        temperature: 0.2,
        system: `Write a monthly brief for an adult ${role} at AI level ${level}. Explain ONE change in AI that matters for their work this month, what it means for them, and one thing to try. At most ${words} words, plain English. Use only the given sources and cite them. Return JSON only: {"title":"...","body":"...","sources":[{"title":"...","url":"..."}]}.`,
        messages: [{ role: 'user', content: JSON.stringify({ month, sources }) }],
      });
      let b: { title?: string; body?: string; sources?: { title: string }[] };
      try {
        b = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      } catch {
        continue;
      }
      if (!b.title || !b.body || b.body.trim().split(/\s+/).length > words) continue; // over the owner's limit: not kept
      const allowed = new Set(sources.map((s) => s.title));
      if (!b.sources?.length || !b.sources.every((s) => allowed.has(s.title))) continue;
      items.push({
        kind: 'brief',
        jobRole: role,
        level,
        month,
        title: b.title,
        body: b.body,
        sources: b.sources,
      });
    }
  if (!items.length) throw new LoopError('No brief met the length and source rules; nothing was saved.', 502);
  return addDraftItems(db, actor, packId, items, { origin: 'ai', now });
}

/** ACA-US-13.1-AC2/AC3: the learner's published brief for this month, written for their own role and level. */
export async function myBrief(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  await requireEpic(db, 'ACA-E13');
  const m = await requireSelf(db, actor, memberId, 'brief.view', now);
  const c = m.cohort_id ? await cohortOf(db, m.cohort_id) : null;
  if (!c?.pack_id) return null;
  const level = (await currentLevel(db, m.id))?.level ?? null;
  const pub = await publishedItems(db, c.pack_id);
  const month = monthOfDate(now);
  const pick = (i: Item) =>
    i.kind === 'brief' &&
    i.month === month &&
    i.level === level &&
    (i.job_role === '*' || i.job_role === (m.job_role ?? '').toLowerCase());
  return pub.items.find(pick) ?? null;
}

/** ACA-US-13.3: an optional task that applies the brief to the learner's own work; counted as a cycle, tagged "brief". */
export async function tryBrief(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  const brief = await myBrief(db, actor, memberId, now);
  if (!brief) throw new LoopError('There is no brief for you this month yet.', 404);
  const m = await requireSelf(db, actor, memberId, 'brief.try', now);
  await requireActiveAccess(db, m, now);
  if (await pausedByHarm(db, m)) throw new LoopError('Practice is paused for your group.', 403);
  const existing = await db
    .prepare(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='brief' AND item_id=?`)
    .bind(m.id, brief.id)
    .first<{ id: string }>();
  if (existing) return { taskId: existing.id };
  const id = newId('task');
  const version = (await db
    .prepare(`SELECT max(v.version) v FROM loop_pack_versions v, json_each(v.item_ids) e WHERE e.value=?`)
    .bind(brief.id)
    .first<{ v: number }>())!.v;
  await db
    .prepare(
      'INSERT INTO loop_tasks(id,member_id,cohort_id,kind,week,item_id,pack_version,title,prompt,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      m.id,
      m.cohort_id,
      'brief',
      await weekOf(db, m, now),
      brief.id,
      version,
      `Try it: ${brief.title}`,
      `${brief.body}\n\nTry this change on one piece of your own real work this week, then note what changed. Remove other people’s private details first.`,
      iso(now),
    )
    .run();
  await audit(db, actor.userId, 'brief.try', { org: m.org_id, target: id, now });
  return { taskId: id };
}
