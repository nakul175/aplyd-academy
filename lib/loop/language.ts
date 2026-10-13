// ACA-US-19.1 interface and packs in a local language (in scope only with scope.release including ACA-E19; the
// language itself is the owner's decision language.local). Interface strings and pack items are AI-drafted, then
// approved by a bilingual reviewer; learners see only approved text and fall back to English for the rest.
import {
  type Db,
  type Actor,
  LoopError,
  audit,
  refuse,
  requireOperator,
  requireDecision,
  requireEpic,
  decision,
  iso,
} from './core';
import { createPack, addDraftItems, publishedItems, type Item } from './packs';
import { generate, type AiRequest } from '@/lib/ai/provider';

/** English interface strings for the learner screens; keys are stable. */
export const UI_EN = {
  'nav.home': 'Home',
  'nav.help': 'Help',
  'home.title': 'Your practice',
  'home.access': 'Your practice access runs until',
  'home.placement': 'Take the 3-minute placement check',
  'home.level': 'Your AI level',
  'home.task': 'This week’s practice task',
  'home.workshop': 'Workshop: your first practice task',
  'home.history': 'My practice history',
  'home.settings': 'Settings and my data',
  'home.sessions': 'Live sessions',
  'home.community': 'Cohort community',
  'home.catch': 'This month’s catch-the-AI task',
  'home.brief': 'This month’s AI brief',
  'task.your_task': 'Your task',
  'task.checked': 'Checked guidance',
  'task.attempt': 'Your attempt',
  'task.finish': 'Finish this task',
  'task.submit': 'Submit my result',
  'task.note': 'What changed in your work? (one or two sentences)',
  'coach.title': 'Ask the AI coach',
  'coach.ask': 'Ask for a hint',
  'coach.paused':
    'AI help is paused right now. Your task and the checked guidance below still work, and you can submit as usual.',
  'settings.title': 'Settings and my data',
  'settings.language': 'Language',
  'settings.download': 'Download my practice data',
} as const;
export type UiKey = keyof typeof UI_EN;

export async function userLanguage(db: Db, userId: string) {
  return (
    (
      await db
        .prepare('SELECT language FROM loop_user_prefs WHERE user_id=?')
        .bind(userId)
        .first<{ language: string }>()
    )?.language ?? 'en'
  );
}
export async function setLanguage(db: Db, actor: Actor, language: unknown, now = Date.now()) {
  await requireEpic(db, 'ACA-E19');
  const local = await requireDecision<{ code: string; name: string }>(db, 'language.local');
  const lang = language === 'en' || language === local.code ? (language as string) : null;
  if (!lang) throw new LoopError(`Choose English or ${local.name}.`);
  await db
    .prepare(
      'INSERT INTO loop_user_prefs(user_id,language,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language, updated_at=excluded.updated_at',
    )
    .bind(actor.userId, lang, iso(now))
    .run();
  return { language: lang };
}

/** A translator for one user: approved strings in their language, English otherwise. Works without E19 (always English). */
export async function translator(db: Db, userId: string) {
  const lang = await userLanguage(db, userId);
  const scope = await decision<{ epics: string[] }>(db, 'scope.release');
  const rows =
    lang !== 'en' && scope?.value.epics?.includes('ACA-E19')
      ? (
          await db
            .prepare(`SELECT key, text FROM loop_ui_strings WHERE language=? AND status='approved'`)
            .bind(lang)
            .all<{ key: string; text: string }>()
        ).results
      : [];
  const map = new Map(rows.map((r) => [r.key, r.text]));
  return { lang, t: (k: UiKey) => map.get(k) ?? UI_EN[k] };
}

export async function draftUiStrings(
  db: Db,
  actor: Actor,
  gen: (r: AiRequest) => Promise<{ text: string }> = generate,
  now = Date.now(),
) {
  await requireEpic(db, 'ACA-E19');
  await requireOperator(db, actor, 'ui.draft', now);
  const local = await requireDecision<{ code: string; name: string }>(db, 'language.local');
  const r = await gen({
    purpose: 'ui-translate',
    maxTokens: 4000,
    temperature: 0,
    system: `Translate these app interface strings into ${local.name} for adult learners. Plain, everyday words. Keep the JSON keys; return JSON only.`,
    messages: [{ role: 'user', content: JSON.stringify(UI_EN) }],
  });
  let out: Record<string, string>;
  try {
    out = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new LoopError('The draft was not in the expected format.', 502);
  }
  let n = 0;
  for (const k of Object.keys(UI_EN))
    if (typeof out[k] === 'string' && out[k].trim()) {
      await db
        .prepare(
          `INSERT INTO loop_ui_strings(language,key,text,status,origin,at) VALUES(?,?,?,'unchecked','ai',?) ON CONFLICT(language,key) DO UPDATE SET text=excluded.text, status='unchecked', origin='ai', reviewer=NULL, at=excluded.at`,
        )
        .bind(local.code, k, out[k].slice(0, 400), iso(now))
        .run();
      n++;
    }
  await audit(db, actor.userId, 'ui.draft', { target: `${local.code}:${n}`, now });
  return { drafted: n };
}
/** A bilingual reviewer approves or corrects interface strings. Reviewers are named on the translated pack. */
export async function reviewUiString(
  db: Db,
  actor: Actor,
  key: unknown,
  input: { decision?: unknown; text?: unknown },
  now = Date.now(),
) {
  const local = await requireDecision<{ code: string }>(db, 'language.local');
  const bilingual = await db
    .prepare(
      `SELECT 1 FROM loop_pack_reviewers r JOIN loop_pack_links l ON l.pack_id=r.pack_id WHERE r.user_id=? AND r.role='bilingual' AND l.language=?`,
    )
    .bind(actor.userId, local.code)
    .first();
  if (!bilingual)
    return refuse(
      db,
      actor.userId,
      'ui.review',
      null,
      'Only the named bilingual reviewer can approve translations.',
      now,
    );
  if (typeof key !== 'string' || !(key in UI_EN)) throw new LoopError('Unknown string.');
  const d = input.decision === 'reject' ? 'rejected' : 'approved';
  await db
    .prepare(
      `UPDATE loop_ui_strings SET status=?, reviewer=?, text=COALESCE(?, text), at=? WHERE language=? AND key=?`,
    )
    .bind(
      d,
      actor.userId,
      typeof input.text === 'string' && input.text.trim() ? input.text.trim().slice(0, 400) : null,
      iso(now),
      local.code,
      key,
    )
    .run();
  await audit(db, actor.userId, 'ui.review', { target: `${local.code}:${key}:${d}`, now });
}

/** ACA-TT-19.1.2: create the translated pack and AI-draft translations of every published item (unchecked). */
export async function translatePack(
  db: Db,
  actor: Actor,
  packId: string,
  gen: (r: AiRequest) => Promise<{ text: string }> = generate,
  now = Date.now(),
) {
  await requireEpic(db, 'ACA-E19');
  await requireOperator(db, actor, 'pack.translate', now);
  const local = await requireDecision<{ code: string; name: string }>(db, 'language.local');
  const src = await db
    .prepare('SELECT sector, audience, title FROM loop_packs WHERE id=?')
    .bind(packId)
    .first<{ sector: string; audience: string; title: string }>();
  if (!src) throw new LoopError('Pack not found.', 404);
  let target = (
    await db
      .prepare('SELECT pack_id FROM loop_pack_links WHERE translation_of=? AND language=?')
      .bind(packId, local.code)
      .first<{ pack_id: string }>()
  )?.pack_id;
  if (!target) {
    target = (
      await createPack(
        db,
        actor,
        {
          sector: src.sector,
          audience: src.audience,
          title: `${src.title} (${local.name})`,
          language: local.code,
        },
        now,
      )
    ).id;
    await db
      .prepare('INSERT INTO loop_pack_links(pack_id,translation_of,language) VALUES(?,?,?)')
      .bind(target, packId, local.code)
      .run();
  }
  const { items } = await publishedItems(db, packId);
  const drafted = [];
  for (const i of items) {
    const r = await gen({
      purpose: 'pack-translate',
      maxTokens: 3000,
      temperature: 0,
      system: `Translate this practice-pack item into ${local.name} for adult learners. Keep facts, numbers and any JSON structure unchanged. Return JSON only: {"title":"...","body":"..."}.`,
      messages: [{ role: 'user', content: JSON.stringify({ title: i.title, body: i.body }) }],
    });
    let t: { title?: string; body?: string };
    try {
      t = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      continue;
    }
    if (!t.title || !t.body) continue;
    const { ids } = await addDraftItems(
      db,
      actor,
      target,
      [
        {
          kind: i.kind,
          jobRole: i.job_role,
          level: i.level,
          month: i.month ?? undefined,
          title: t.title,
          body: t.body,
          sources: JSON.parse(i.sources),
        },
      ],
      { origin: 'ai', now },
    );
    await db
      .prepare('INSERT INTO loop_item_translations(item_id,source_lineage) VALUES(?,?)')
      .bind(ids[0], i.lineage)
      .run();
    drafted.push(ids[0]);
  }
  await audit(db, actor.userId, 'pack.translate', { target: `${packId}->${target}:${drafted.length}`, now });
  return { packId: target, drafted: drafted.length };
}

/** Published items for a learner in their language: an approved, published translation replaces its English source. */
export async function itemsInLanguage(db: Db, packId: string, lang: string): Promise<Item[]> {
  const { items } = await publishedItems(db, packId);
  if (lang === 'en') return items;
  const link = await db
    .prepare('SELECT pack_id FROM loop_pack_links WHERE translation_of=? AND language=?')
    .bind(packId, lang)
    .first<{ pack_id: string }>();
  if (!link) return items;
  const translated = (await publishedItems(db, link.pack_id)).items;
  const bySource = new Map<string, Item>();
  for (const t of translated) {
    const s = await db
      .prepare('SELECT source_lineage FROM loop_item_translations WHERE item_id=?')
      .bind(t.id)
      .first<{ source_lineage: string }>();
    if (s) bySource.set(s.source_lineage, t);
  }
  return items.map((i) => bySource.get(i.lineage) ?? i);
}
