// ACA-E20 (in scope only with scope.release including ACA-E20): 20.1 highlight part of a published pack item and add a
// note, stored with the item version and position, seen in place and resolved by the expert (moderation: hide);
// 20.2 the AI proposes a refinement answering open annotations; the expert compares side by side and approves or
// rejects; an approved refinement becomes a new revision that reaches learners only after the expert publishes.
import { type Db, type Actor, LoopError, audit, refuse, requireEpic, iso, newId, text } from './core';
import { requireReviewer, reviewerRole, reviseItem, type Item } from './packs';
import { generate, type AiRequest } from '@/lib/ai/provider';

async function publishedItem(db: Db, itemId: string) {
  const it = await db.prepare('SELECT * FROM loop_pack_items WHERE id=?').bind(itemId).first<Item>();
  const pub = it
    ? await db
        .prepare(
          `SELECT 1 FROM loop_pack_versions v, json_each(v.item_ids) e WHERE v.pack_id=? AND e.value=?`,
        )
        .bind(it.pack_id, itemId)
        .first()
    : null;
  if (!it || !pub) throw new LoopError('Only published items can be annotated.', 404);
  return it;
}

export async function annotate(
  db: Db,
  actor: Actor,
  itemId: string,
  input: { start?: unknown; end?: unknown; quote?: unknown; note?: unknown },
  now = Date.now(),
) {
  await requireEpic(db, 'ACA-E20');
  const it = await publishedItem(db, itemId);
  // Learners of a cohort using the pack, or the pack's reviewers, may annotate.
  const member = await db
    .prepare(
      `SELECT m.id FROM loop_members m JOIN loop_cohorts c ON c.id=m.cohort_id WHERE m.user_id=? AND m.status='joined' AND c.pack_id=?`,
    )
    .bind(actor.userId, it.pack_id)
    .first<{ id: string }>();
  if (!member && !(await reviewerRole(db, it.pack_id, actor.userId)))
    return refuse(
      db,
      actor.userId,
      'annotation.add',
      null,
      'You can annotate only items from your own pack.',
      now,
    );
  // The position comes from a text selection (start/end) or, for keyboard and screen-reader users, from the quoted words.
  let start = Number(input.start),
    end = Number(input.end);
  if (typeof input.quote === 'string' && input.quote.trim()) {
    start = it.body.indexOf(input.quote.trim());
    end = start + input.quote.trim().length;
    if (start < 0) throw new LoopError('Those words are not in the item. Copy them exactly.');
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > it.body.length)
    throw new LoopError('Select some text in the item first.');
  const r = await db
    .prepare(
      'INSERT INTO loop_annotations(item_id,start,end,quote,note,user_id,member_id,at) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(
      it.id,
      start,
      end,
      it.body.slice(start, end),
      text(input.note, 'Note', 1000),
      actor.userId,
      member?.id ?? null,
      iso(now),
    )
    .run();
  await audit(db, actor.userId, 'annotation.add', { target: it.id, now });
  return { id: r.meta.last_row_id };
}

/** The expert sees each annotation in place (offsets into the exact revision annotated). */
export async function itemWithAnnotations(db: Db, actor: Actor, itemId: string, now = Date.now()) {
  const it = await db.prepare('SELECT * FROM loop_pack_items WHERE id=?').bind(itemId).first<Item>();
  if (!it) throw new LoopError('Item not found.', 404);
  await requireReviewer(db, actor, it.pack_id, 'annotation.view', now);
  const anns = (
    await db
      .prepare(
        `SELECT id, start, end, quote, note, at, status FROM loop_annotations WHERE item_id=? AND status!='hidden' ORDER BY start`,
      )
      .bind(itemId)
      .all<{ id: number; start: number; end: number; quote: string; note: string; status: string }>()
  ).results;
  return { item: it, annotations: anns };
}
export async function setAnnotationStatus(
  db: Db,
  actor: Actor,
  id: number,
  status: unknown,
  now = Date.now(),
) {
  const a = await db
    .prepare(
      'SELECT a.id, i.pack_id FROM loop_annotations a JOIN loop_pack_items i ON i.id=a.item_id WHERE a.id=?',
    )
    .bind(id)
    .first<{ id: number; pack_id: string }>();
  if (!a) throw new LoopError('Annotation not found.', 404);
  await requireReviewer(db, actor, a.pack_id, 'annotation.status', now);
  const s = status === 'hidden' ? 'hidden' : 'resolved';
  await db
    .prepare('UPDATE loop_annotations SET status=?, resolved_by=?, resolved_at=? WHERE id=?')
    .bind(s, actor.userId, iso(now), id)
    .run();
  await audit(db, actor.userId, `annotation.${s}`, { target: String(id), now });
}

export async function proposeRefinement(
  db: Db,
  actor: Actor,
  itemId: string,
  gen: (r: AiRequest) => Promise<{ text: string }> = generate,
  now = Date.now(),
) {
  await requireEpic(db, 'ACA-E20');
  const { item, annotations } = await itemWithAnnotations(db, actor, itemId, now);
  const open = annotations.filter((a) => a.status === 'open');
  if (!open.length) throw new LoopError('There are no open annotations on this item.', 409);
  const r = await gen({
    purpose: 'pack-refine',
    maxTokens: 3000,
    temperature: 0.2,
    system:
      "Improve this practice-pack item so it answers the readers' notes. Change only what the notes need; keep correct facts; do not add facts that are not in the item. Return only the new item text.",
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          item: item.body,
          notes: open.map((a) => ({ quote: a.quote, note: a.note })),
        }),
      },
    ],
  });
  const body = r.text.trim();
  if (!body) throw new LoopError('The AI returned nothing; try again later.', 502);
  const id = newId('ref');
  await db
    .prepare(
      'INSERT INTO loop_refinements(id,item_id,proposed_body,annotation_ids,created_at) VALUES(?,?,?,?,?)',
    )
    .bind(id, item.id, body.slice(0, 8000), JSON.stringify(open.map((a) => a.id)), iso(now))
    .run();
  await audit(db, actor.userId, 'refinement.propose', { target: id, now });
  return { id, current: item.body, proposed: body, answers: open };
}
export async function decideRefinement(
  db: Db,
  actor: Actor,
  refinementId: string,
  decisionInput: unknown,
  now = Date.now(),
) {
  const r = await db
    .prepare(
      'SELECT r.*, i.pack_id FROM loop_refinements r JOIN loop_pack_items i ON i.id=r.item_id WHERE r.id=?',
    )
    .bind(refinementId)
    .first<{
      id: string;
      item_id: string;
      pack_id: string;
      proposed_body: string;
      annotation_ids: string;
      status: string;
    }>();
  if (!r) throw new LoopError('Proposal not found.', 404);
  await requireReviewer(db, actor, r.pack_id, 'refinement.decide', now);
  if (r.status !== 'pending') throw new LoopError('This proposal is already decided.', 409);
  if (decisionInput === 'approve') {
    const { id } = await reviseItem(db, actor, r.item_id, { body: r.proposed_body }, now); // a new approved revision; published only when the expert publishes
    await db
      .prepare(
        `UPDATE loop_refinements SET status='approved', result_item_id=?, decided_by=?, decided_at=? WHERE id=?`,
      )
      .bind(id, actor.userId, iso(now), r.id)
      .run();
    for (const a of JSON.parse(r.annotation_ids) as number[])
      await db
        .prepare(
          `UPDATE loop_annotations SET status='resolved', resolved_by=?, resolved_at=? WHERE id=? AND status='open'`,
        )
        .bind(actor.userId, iso(now), a)
        .run();
    await audit(db, actor.userId, 'refinement.approve', { target: r.id, now });
    return { status: 'approved', newItemId: id };
  }
  await db
    .prepare(`UPDATE loop_refinements SET status='rejected', decided_by=?, decided_at=? WHERE id=?`)
    .bind(actor.userId, iso(now), r.id)
    .run();
  await audit(db, actor.userId, 'refinement.reject', { target: r.id, now });
  return { status: 'rejected' };
}
