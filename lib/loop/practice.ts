// ACA-E4 the practice loop: ACA-US-4.1 weekly task from my own work, 4.2 hint-first AI guidance (with the 7.3
// fallback), 4.3 unaided checks, 4.4 submit and reflect, 4.5 monthly catch-the-AI, 4.6 first cycle at the workshop.
import {
  type Db,
  type Actor,
  type Member,
  LoopError,
  audit,
  refuse,
  requireRole,
  requireSelf,
  decision,
  iso,
  DAY,
  newId,
  text,
} from './core';
import { cohortOf, startDateOf } from './enrolment';
import { currentLevel, startingLevel, requireActiveAccess } from './levels';
import { publishedItems, type Item } from './packs';
import { coachReply, aiStatus, PAUSED_NOTICE, type CheckedContent } from './ai';
import { textExcerpt } from './files';
import { pausedByHarm } from './students';
import { userLanguage, itemsInLanguage } from './language';
import { AiUnavailable, type AiRequest } from '@/lib/ai/provider';

const WEEK = 7 * DAY;
/** Week 0 is the workshop week; week n starts n×7 days after the learner's start date. */
export async function weekOf(db: Db, m: Member, now = Date.now()) {
  const start = Date.parse((await startDateOf(db, m)) + 'T00:00:00Z');
  return now < start ? -1 : Math.floor((now - start) / WEEK);
}
export const COACH_PER_HOUR = 30;
const BRING_OWN =
  'Bring your own work for this: attach a document or photo from your real work, or paste an example in your own words. Remove other people’s private details first.';
type Task = {
  id: string;
  member_id: string;
  cohort_id: string;
  kind: string;
  week: number;
  item_id: string | null;
  pack_version: number | null;
  title: string;
  prompt: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

async function packFor(db: Db, m: Member) {
  const c = m.cohort_id ? await cohortOf(db, m.cohort_id) : null;
  if (!c?.pack_id) return null;
  const pub = await publishedItems(db, c.pack_id);
  if (!pub.version) return null;
  const lang = m.user_id ? await userLanguage(db, m.user_id) : 'en'; // ACA-US-19.1: approved translations replace their source
  return {
    cohort: c,
    version: pub.version,
    items: lang === 'en' ? pub.items : await itemsInLanguage(db, c.pack_id, lang),
  };
}
const fits = (i: Item, jobRole: string | null, level: string | null) =>
  (i.job_role === '*' || i.job_role === (jobRole ?? '').toLowerCase()) &&
  (i.level === '*' || i.level === level);

/** Pick the matching task item this learner has used least (ties broken by title) so tasks rotate. */
async function pickItem(db: Db, m: Member, items: Item[], kind: string) {
  const level = (await currentLevel(db, m.id))?.level ?? null;
  const pool = items.filter((i) => i.kind === kind && fits(i, m.job_role, level));
  if (pool.length === 0) return null;
  const used = new Map(
    (
      await db
        .prepare('SELECT item_id, count(*) n FROM loop_tasks WHERE member_id=? GROUP BY item_id')
        .bind(m.id)
        .all<{ item_id: string; n: number }>()
    ).results.map((r) => [r.item_id, r.n]),
  );
  return [...pool].sort(
    (a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || a.title.localeCompare(b.title),
  )[0];
}

async function createTask(
  db: Db,
  m: Member,
  kind: Task['kind'],
  week: number,
  item: Item,
  packVersion: number,
  now: number,
) {
  const id = newId('task');
  const prompt = kind === 'check' || kind === 'catch_ai' ? item.title : `${item.body}\n\n${BRING_OWN}`;
  await db
    .prepare(
      'INSERT INTO loop_tasks(id,member_id,cohort_id,kind,week,item_id,pack_version,title,prompt,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(id, m.id, m.cohort_id, kind, week, item.id, packVersion, item.title, prompt, iso(now))
    .run();
  return id;
}

/** ACA-US-4.1-AC1: when a new week starts the learner has a task for their role and level from the published pack. */
export async function ensureWeeklyTask(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'task.weekly', now);
  const access = await requireActiveAccess(db, m, now);
  if (await pausedByHarm(db, m))
    throw new LoopError('Practice is paused for your group by a decision of your school and APLYD.', 403);
  const week = await weekOf(db, m, now);
  if (week < 1) return { state: 'not_started' as const, startsOn: await startDateOf(db, m), access };
  if (!(await currentLevel(db, m.id))) return { state: 'needs_placement' as const, access };
  const existing = await db
    .prepare(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='weekly' AND week=?`)
    .bind(m.id, week)
    .first<{ id: string }>();
  if (existing) return { state: 'ready' as const, taskId: existing.id, week, access };
  const pack = await packFor(db, m);
  const item = pack ? await pickItem(db, m, pack.items, 'task') : null;
  if (!pack || !item) return { state: 'no_task_yet' as const, week, access };
  return {
    state: 'ready' as const,
    taskId: await createTask(db, m, 'weekly', week, item, pack.version, now),
    week,
    access,
  };
}

export async function taskFor(db: Db, actor: Actor, taskId: string, action = 'task.open', now = Date.now()) {
  const t = await db.prepare('SELECT * FROM loop_tasks WHERE id=?').bind(taskId).first<Task>();
  if (!t) return refuse(db, actor.userId, action, null, 'You do not have access to this.', now);
  const m = await requireSelf(db, actor, t.member_id, action, now);
  if (!VIEW_ACTIONS.has(action)) {
    // doing practice (not just looking) needs active access and no harm-review pause
    await requireActiveAccess(db, m, now);
    if (await pausedByHarm(db, m))
      throw new LoopError('Practice is paused for your group by a decision of your school and APLYD.', 403);
  }
  return { task: t, member: m };
}
const VIEW_ACTIONS = new Set(['task.open', 'catch.view']);

/** Checked content for a task: published items of the cohort's pack that fit the learner (never unchecked items). */
async function checkedContent(db: Db, m: Member): Promise<CheckedContent> {
  const pack = await packFor(db, m);
  if (!pack) return [];
  const level = (await currentLevel(db, m.id))?.level ?? null;
  return pack.items
    .filter((i) => ['rule', 'example', 'pitfall'].includes(i.kind) && fits(i, m.job_role, level))
    .map((i) => ({ title: i.title, body: i.body }));
}

/** The task screen: works with AI on or off (ACA-US-7.3-AC1). Files are listed for their owner only. */
export async function taskView(db: Db, actor: Actor, taskId: string, now = Date.now()) {
  const { task, member } = await taskFor(db, actor, taskId, 'task.open', now);
  const [checked, ai, attempts, messages, files, submission] = await Promise.all([
    checkedContent(db, member),
    aiStatus(db),
    db
      .prepare('SELECT id, body, at FROM loop_attempts WHERE task_id=? ORDER BY id')
      .bind(task.id)
      .all()
      .then((r) => r.results),
    db
      .prepare('SELECT role, mode, body, at FROM loop_coach_messages WHERE task_id=? ORDER BY id')
      .bind(task.id)
      .all()
      .then((r) => r.results),
    db
      .prepare(
        `SELECT id, name, size, received, status FROM loop_files WHERE task_id=? AND member_id=? ORDER BY created_at`,
      )
      .bind(task.id, member.id)
      .all()
      .then((r) => r.results),
    db
      .prepare('SELECT id, note, link, file_id, at FROM loop_submissions WHERE task_id=?')
      .bind(task.id)
      .first(),
  ]);
  const inCheck = task.kind === 'check' || (await activeCheck(db, member.id, now));
  return {
    task,
    checked,
    ai: {
      available: ai.available && !inCheck && task.kind !== 'catch_ai',
      notice: inCheck ? 'AI help is off during an unaided check.' : ai.available ? null : PAUSED_NOTICE,
    },
    attempts,
    messages,
    files,
    submission,
  };
}

async function activeCheck(db: Db, memberId: string, now: number) {
  const r = await db
    .prepare(
      `SELECT started_at FROM loop_tasks WHERE member_id=? AND kind='check' AND started_at IS NOT NULL AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    )
    .bind(memberId)
    .first<{ started_at: string }>();
  return !!r && now - Date.parse(r.started_at) < 3 * 3_600_000; // a check left open counts for at most 3 hours
}

/** ACA-US-4.2: hints before an attempt, feedback and a worked answer after; honest uncertainty; files only if AIA allows. */
export async function askCoach(
  db: Db,
  actor: Actor,
  taskId: string,
  input: { message?: unknown; includeFileId?: unknown },
  gen?: (r: AiRequest) => Promise<{ text: string }>,
  now = Date.now(),
) {
  const { task, member } = await taskFor(db, actor, taskId, 'coach.ask', now);
  await requireActiveAccess(db, member, now);
  if (task.kind === 'check' || task.kind === 'catch_ai' || (await activeCheck(db, member.id, now)))
    throw new LoopError('AI help is off during an unaided check.', 409);
  if (task.status === 'submitted')
    throw new LoopError('This task is finished. Start your next task to keep practising.', 409);
  const message = text(input.message, 'Your question', 2000);
  // Abuse and cost guard (ACA-US-12.2 finding F-03): at most 30 coach questions per learner per hour.
  const recent = await db
    .prepare(`SELECT count(*) n FROM loop_coach_messages WHERE member_id=? AND role='learner' AND at>?`)
    .bind(member.id, iso(now - 3_600_000))
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= COACH_PER_HOUR)
    throw new LoopError(
      'You have asked the coach a lot in the last hour. Try the task yourself and ask again later.',
      429,
    );
  const attempted = !!(await db
    .prepare('SELECT 1 FROM loop_attempts WHERE task_id=? LIMIT 1')
    .bind(task.id)
    .first());
  const schoolStudent =
    member.role === 'student' &&
    (await db.prepare('SELECT kind FROM loop_orgs WHERE id=?').bind(member.org_id).first<{ kind: string }>())
      ?.kind === 'school';
  const mode = schoolStudent ? ('hint_only' as const) : attempted ? ('feedback' as const) : ('hint' as const); // ACA-US-11.3: students get hints only
  let content = message;
  if (typeof input.includeFileId === 'string') {
    const allowed = await decision<{ allowed: boolean }>(db, 'ai.files_to_provider');
    if (!allowed?.value.allowed)
      throw new LoopError(
        'Your files are not sent to the AI. Describe the part you need help with in your own words instead.',
        403,
      );
    const f = await db
      .prepare(`SELECT id, member_id, mime FROM loop_files WHERE id=? AND member_id=? AND status='complete'`)
      .bind(input.includeFileId, member.id)
      .first<{ id: string; member_id: string; mime: string }>();
    const excerpt = f ? textExcerpt(f) : null;
    if (!excerpt)
      throw new LoopError(
        'Only text and CSV files can be included; describe other files in your own words.',
        415,
      );
    content = `${message}\n\n--- From my file ---\n${excerpt}`;
  }
  const history = (
    await db
      .prepare(
        `SELECT role, body FROM loop_coach_messages WHERE task_id=? AND role!='notice' ORDER BY id DESC LIMIT 8`,
      )
      .bind(task.id)
      .all<{ role: string; body: string }>()
  ).results
    .reverse()
    .map((r) => ({
      role: r.role === 'learner' ? ('user' as const) : ('assistant' as const),
      content: r.body,
    }));
  const attempt = attempted
    ? (await db
        .prepare('SELECT body FROM loop_attempts WHERE task_id=? ORDER BY id DESC LIMIT 1')
        .bind(task.id)
        .first<{ body: string }>())!.body
    : null;
  const messages = [
    ...history,
    {
      role: 'user' as const,
      content: attempt ? `My attempt:\n${attempt}\n\nMy question: ${content}` : content,
    },
  ];
  await db
    .prepare(
      `INSERT INTO loop_coach_messages(task_id,member_id,role,mode,body,at) VALUES(?,?,'learner',?,?,?)`,
    )
    .bind(task.id, member.id, mode, message, iso(now))
    .run();
  try {
    const cohort = await cohortOf(db, member.cohort_id!);
    const reply = await coachReply(
      db,
      mode,
      task.prompt,
      await checkedContent(db, member),
      cohort?.sector ?? 'textile',
      messages,
      gen,
    );
    await db
      .prepare(
        `INSERT INTO loop_coach_messages(task_id,member_id,role,mode,body,at) VALUES(?,?,'coach',?,?,?)`,
      )
      .bind(task.id, member.id, mode, reply, iso(now))
      .run();
    return { mode, reply, paused: false };
  } catch (e) {
    if (!(e instanceof AiUnavailable)) throw e;
    await db
      .prepare(
        `INSERT INTO loop_coach_messages(task_id,member_id,role,mode,body,at) VALUES(?,?,'notice',?,?,?)`,
      )
      .bind(task.id, member.id, mode, PAUSED_NOTICE, iso(now))
      .run();
    return { mode, reply: null, paused: true, notice: PAUSED_NOTICE };
  }
}

/** An attempt unlocks feedback and the worked answer (ACA-US-4.2-AC1). */
export async function submitAttempt(db: Db, actor: Actor, taskId: string, body: unknown, now = Date.now()) {
  const { task, member } = await taskFor(db, actor, taskId, 'task.attempt', now);
  if (task.status === 'submitted') throw new LoopError('This task is already submitted.', 409);
  await db
    .prepare('INSERT INTO loop_attempts(task_id,member_id,body,at) VALUES(?,?,?,?)')
    .bind(task.id, member.id, text(body, 'Your attempt', 8000), iso(now))
    .run();
  return { attempted: true };
}

/** ACA-US-4.4: submitting with a short note completes one practice cycle (week 0 at the workshop). */
export async function submitTask(
  db: Db,
  actor: Actor,
  taskId: string,
  input: { note?: unknown; link?: unknown; fileId?: unknown },
  now = Date.now(),
) {
  const { task, member } = await taskFor(db, actor, taskId, 'task.submit', now);
  await requireActiveAccess(db, member, now);
  if (task.status === 'submitted') throw new LoopError('This task is already submitted.', 409);
  if (task.kind === 'check' || task.kind === 'catch_ai')
    throw new LoopError('Finish this activity on its own screen.', 409);
  const note = text(input.note, 'A short note on what changed', 1000);
  const link = typeof input.link === 'string' && input.link.trim() ? input.link.trim() : null;
  if (link && (!/^https?:\/\/\S+$/.test(link) || link.length > 500))
    throw new LoopError('The link must start with http:// or https://.');
  let fileId: string | null = null;
  if (typeof input.fileId === 'string' && input.fileId) {
    const f = await db
      .prepare(`SELECT id FROM loop_files WHERE id=? AND member_id=? AND status='complete'`)
      .bind(input.fileId, member.id)
      .first<{ id: string }>();
    if (!f) throw new LoopError('That file has not finished uploading.', 409);
    fileId = f.id;
  }
  // A cycle counts for the week it is completed in, so old tasks finished late cannot fill earlier weeks (A-01).
  const week = task.kind === 'workshop' ? 0 : Math.max(0, await weekOf(db, member, now));
  const id = newId('sub');
  await db.batch([
    db
      .prepare(
        'INSERT INTO loop_submissions(id,task_id,member_id,cohort_id,week,kind,file_id,link,note,has_artefact,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        task.id,
        member.id,
        task.cohort_id,
        week,
        task.kind,
        fileId,
        link,
        note,
        fileId || link ? 1 : 0,
        iso(now),
      ),
    db
      .prepare(`UPDATE loop_tasks SET status='submitted', finished_at=? WHERE id=? AND status='open'`)
      .bind(iso(now), task.id),
  ]);
  await audit(db, actor.userId, 'task.submit', { org: member.org_id, target: id, now });
  return { submissionId: id, week };
}

/** ACA-US-4.4-AC2: my cycles by week. */
export async function history(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  await requireSelf(db, actor, memberId, 'history.view', now);
  const rows = (
    await db
      .prepare(
        `SELECT s.id, s.week, s.kind, s.note, s.link, s.file_id, s.at, t.title, f.name AS file_name FROM loop_submissions s JOIN loop_tasks t ON t.id=s.task_id LEFT JOIN loop_files f ON f.id=s.file_id WHERE s.member_id=? ORDER BY s.week DESC, s.at DESC`,
      )
      .bind(memberId)
      .all<{ week: number }>()
  ).results;
  const weeks = new Map<number, typeof rows>();
  for (const r of rows) weeks.set(r.week, [...(weeks.get(r.week) ?? []), r]);
  return [...weeks.entries()].map(([week, cycles]) => ({ week, cycles }));
}

// ---- ACA-US-4.3: unaided checks ----
type CheckBody = {
  questions: { id: string; text: string; options: { id: string; text: string; correct?: boolean }[] }[];
};
function parseCheck(item: Item): CheckBody {
  try {
    const b = JSON.parse(item.body) as CheckBody;
    if (Array.isArray(b.questions) && b.questions.length) return b;
  } catch {}
  throw new LoopError('This check is not set up correctly.', 503);
}

export async function scheduleCheck(
  db: Db,
  actor: Actor,
  cohortId: string,
  itemId: string,
  now = Date.now(),
) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'check.schedule', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'check.schedule', { now });
  const pub = c.pack_id ? await publishedItems(db, c.pack_id) : null;
  const item = pub?.items.find((i) => i.id === itemId && i.kind === 'check');
  if (!item) throw new LoopError('Choose a published check from the cohort’s pack.', 404);
  parseCheck(item);
  const members = (
    await db
      .prepare(
        `SELECT * FROM loop_members WHERE cohort_id=? AND status='joined' AND role IN ('learner','teacher','officer','faculty','student')`,
      )
      .bind(cohortId)
      .all<Member>()
  ).results;
  let created = 0;
  for (const m of members) {
    if (
      await db
        .prepare(`SELECT 1 FROM loop_tasks WHERE member_id=? AND kind='check' AND item_id=?`)
        .bind(m.id, item.id)
        .first()
    )
      continue;
    await createTask(db, m, 'check', await weekOf(db, m, now), item, pub!.version, now);
    created++;
  }
  await audit(db, actor.userId, 'check.schedule', {
    org: c.org_id,
    target: `${cohortId}:${item.id}:${created}`,
    now,
  });
  return { created };
}

export async function startCheck(db: Db, actor: Actor, taskId: string, now = Date.now()) {
  const { task } = await taskFor(db, actor, taskId, 'check.start', now);
  if (task.kind !== 'check') throw new LoopError('This is not a check.', 400);
  if (task.status === 'submitted') throw new LoopError('You have already finished this check.', 409);
  if (!task.started_at)
    await db.prepare('UPDATE loop_tasks SET started_at=? WHERE id=?').bind(iso(now), task.id).run();
  const item = (await db
    .prepare('SELECT * FROM loop_pack_items WHERE id=?')
    .bind(task.item_id)
    .first<Item>())!;
  return {
    aiOff: true,
    notice: 'AI help is off for this check, on every screen, until you finish it.',
    questions: parseCheck(item).questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

export async function finishCheck(db: Db, actor: Actor, taskId: string, answers: unknown, now = Date.now()) {
  const { task, member } = await taskFor(db, actor, taskId, 'check.finish', now);
  if (task.kind !== 'check' || !task.started_at) throw new LoopError('Start the check first.', 409);
  if (task.status === 'submitted') throw new LoopError('You have already finished this check.', 409);
  const item = (await db
    .prepare('SELECT * FROM loop_pack_items WHERE id=?')
    .bind(task.item_id)
    .first<Item>())!;
  const qs = parseCheck(item).questions,
    a = (answers ?? {}) as Record<string, unknown>;
  const score = qs.filter((q) => q.options.find((o) => o.id === a[q.id])?.correct === true).length;
  await db.batch([
    db
      .prepare(
        'INSERT INTO loop_check_results(task_id,member_id,cohort_id,item_id,score,max_score,starting_level,at) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(
        task.id,
        member.id,
        task.cohort_id,
        item.id,
        score,
        qs.length,
        await startingLevel(db, member.id),
        iso(now),
      ),
    db.prepare(`UPDATE loop_tasks SET status='submitted', finished_at=? WHERE id=?`).bind(iso(now), task.id),
  ]);
  return { score, max: qs.length };
}

/** ACA-US-4.3-AC2 (A-06): check results reported by starting level. Aggregates only. */
export async function checkReport(db: Db, cohortId: string) {
  return (
    await db
      .prepare(
        `SELECT starting_level, count(*) AS learners, avg(1.0*score/max_score) AS mean_share FROM loop_check_results WHERE cohort_id=? GROUP BY starting_level ORDER BY starting_level`,
      )
      .bind(cohortId)
      .all<{ starting_level: string; learners: number; mean_share: number }>()
  ).results;
}

// ---- ACA-US-4.5: monthly catch-the-AI ----
type CatchBody = {
  intro?: string;
  segments: { id: string; text: string; planted?: boolean; explanation?: string }[];
};
function parseCatch(item: Item): CatchBody {
  try {
    const b = JSON.parse(item.body) as CatchBody;
    if (Array.isArray(b.segments) && b.segments.some((s) => s.planted)) return b;
  } catch {}
  throw new LoopError('This catch-the-AI set is not set up correctly.', 503);
}
export async function monthOf(db: Db, m: Member, now = Date.now()) {
  const start = Date.parse((await startDateOf(db, m)) + 'T00:00:00Z');
  return now < start ? 0 : Math.floor((now - start) / (30 * DAY)) + 1;
}

export async function ensureCatchTask(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'catch.open', now);
  await requireActiveAccess(db, m, now);
  if (await pausedByHarm(db, m))
    throw new LoopError('Practice is paused for your group by a decision of your school and APLYD.', 403);
  const month = await monthOf(db, m, now);
  if (month < 1) return { state: 'not_started' as const };
  const existing = await db
    .prepare(
      `SELECT t.id FROM loop_tasks t WHERE t.member_id=? AND t.kind='catch_ai' AND t.week>=? AND t.week<?`,
    )
    .bind(m.id, (month - 1) * 100, month * 100)
    .first<{ id: string }>();
  if (existing) return { state: 'ready' as const, taskId: existing.id, month };
  const pack = await packFor(db, m);
  const item = pack ? await pickItem(db, m, pack.items, 'planted_errors') : null;
  if (!pack || !item) return { state: 'none_yet' as const, month };
  // week column holds month×100 for catch tasks so a month has one task
  return {
    state: 'ready' as const,
    taskId: await createTask(db, m, 'catch_ai', month * 100 - 100, item, pack.version, now),
    month,
  };
}

export async function catchView(db: Db, actor: Actor, taskId: string, now = Date.now()) {
  const { task } = await taskFor(db, actor, taskId, 'catch.view', now);
  if (task.kind !== 'catch_ai') throw new LoopError('This is not a catch-the-AI task.', 400);
  const item = (await db
    .prepare('SELECT * FROM loop_pack_items WHERE id=?')
    .bind(task.item_id)
    .first<Item>())!;
  const b = parseCatch(item);
  const result = await db
    .prepare('SELECT shown, caught, false_marks FROM loop_catch_results WHERE task_id=?')
    .bind(task.id)
    .first();
  return {
    intro: b.intro ?? 'This AI answer has some planted mistakes. Mark every part you think is wrong.',
    segments: b.segments.map((s) => ({
      id: s.id,
      text: s.text,
      ...(result ? { planted: !!s.planted, explanation: s.explanation ?? null } : {}),
    })),
    result,
  };
}

export async function submitCatch(db: Db, actor: Actor, taskId: string, marked: unknown, now = Date.now()) {
  const { task, member } = await taskFor(db, actor, taskId, 'catch.submit', now);
  if (task.kind !== 'catch_ai') throw new LoopError('This is not a catch-the-AI task.', 400);
  if (task.status === 'submitted') throw new LoopError('You have already finished this task.', 409);
  const item = (await db
    .prepare('SELECT * FROM loop_pack_items WHERE id=?')
    .bind(task.item_id)
    .first<Item>())!;
  const b = parseCatch(item),
    marks = new Set(Array.isArray(marked) ? marked.filter((x) => typeof x === 'string') : []);
  const planted = b.segments.filter((s) => s.planted);
  const caught = planted.filter((s) => marks.has(s.id)).length,
    falseMarks = b.segments.filter((s) => !s.planted && marks.has(s.id)).length;
  const month = Math.floor(task.week / 100) + 1;
  await db.batch([
    db
      .prepare(
        'INSERT INTO loop_catch_results(task_id,member_id,cohort_id,month,shown,caught,false_marks,baseline,at) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        task.id,
        member.id,
        task.cohort_id,
        month,
        planted.length,
        caught,
        falseMarks,
        month === 1 ? 1 : 0,
        iso(now),
      ),
    db.prepare(`UPDATE loop_tasks SET status='submitted', finished_at=? WHERE id=?`).bind(iso(now), task.id),
  ]);
  return { shown: planted.length, caught, falseMarks, baseline: month === 1 };
}

// ---- ACA-US-4.6: first cycle during the workshop ----
export async function startWorkshop(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'workshop.start', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'workshop.start', { now });
  const pub = c.pack_id ? await publishedItems(db, c.pack_id) : null;
  if (!pub?.version) throw new LoopError('The cohort’s pack has no published version yet.', 409);
  let ws = await db
    .prepare('SELECT id FROM loop_workshops WHERE cohort_id=? AND ended_at IS NULL')
    .bind(cohortId)
    .first<{ id: string }>();
  if (!ws) {
    ws = { id: newId('ws') };
    await db
      .prepare('INSERT INTO loop_workshops(id,cohort_id,started_by,started_at) VALUES(?,?,?,?)')
      .bind(ws.id, cohortId, actor.userId, iso(now))
      .run();
  }
  const members = (
    await db
      .prepare(
        `SELECT * FROM loop_members WHERE cohort_id=? AND status='joined' AND role IN ('learner','teacher','officer','faculty','student')`,
      )
      .bind(cohortId)
      .all<Member>()
  ).results;
  let created = 0,
    waiting = 0;
  for (const m of members) {
    if (await db.prepare(`SELECT 1 FROM loop_tasks WHERE member_id=? AND kind='workshop'`).bind(m.id).first())
      continue;
    const item = await pickItem(db, m, pub.items, 'task');
    if (!item) {
      waiting++;
      continue;
    } // not placed yet or no task for their role: they get one once placed
    await createTask(db, m, 'workshop', 0, item, pub.version, now);
    created++;
  }
  await audit(db, actor.userId, 'workshop.start', { org: c.org_id, target: `${cohortId}:${created}`, now });
  return { workshopId: ws.id, created, waiting };
}

/** A participant who places after the session started gets their first task on opening the app. */
export async function ensureWorkshopTask(db: Db, actor: Actor, memberId: string, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'workshop.task', now);
  if (await pausedByHarm(db, m)) return null;
  const t = await db
    .prepare(`SELECT id FROM loop_tasks WHERE member_id=? AND kind='workshop'`)
    .bind(m.id)
    .first<{ id: string }>();
  if (t) return t.id;
  if (
    !m.cohort_id ||
    !(await db
      .prepare('SELECT 1 FROM loop_workshops WHERE cohort_id=? AND ended_at IS NULL')
      .bind(m.cohort_id)
      .first())
  )
    return null;
  const pack = await packFor(db, m);
  const item = pack ? await pickItem(db, m, pack.items, 'task') : null;
  return item ? createTask(db, m, 'workshop', 0, item, pack!.version, now) : null;
}

/** ACA-US-4.6-AC3: completion only. Names and whether a first cycle is done; never files or answers. */
export async function workshopView(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'workshop.view', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'workshop.view', { now });
  const rows = (
    await db
      .prepare(
        `SELECT m.name, EXISTS(SELECT 1 FROM loop_submissions s WHERE s.member_id=m.id AND s.kind='workshop') AS finished, EXISTS(SELECT 1 FROM loop_tasks t WHERE t.member_id=m.id AND t.kind='workshop') AS has_task
    FROM loop_members m WHERE m.cohort_id=? AND m.status='joined' AND m.role IN ('learner','teacher','officer','faculty','student') ORDER BY m.name`,
      )
      .bind(cohortId)
      .all<{ name: string; finished: number; has_task: number }>()
  ).results;
  return {
    participants: rows.map((r) => ({ name: r.name, finished: r.finished === 1, hasTask: r.has_task === 1 })),
    finished: rows.filter((r) => r.finished).length,
    total: rows.length,
  };
}
export async function endWorkshop(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'workshop.end', null, 'You do not have access to this.', now);
  await requireRole(db, actor, c.org_id, ['facilitator'], 'workshop.end', { now });
  await db
    .prepare('UPDATE loop_workshops SET ended_at=? WHERE cohort_id=? AND ended_at IS NULL')
    .bind(iso(now), cohortId)
    .run();
  await audit(db, actor.userId, 'workshop.end', { org: c.org_id, target: cohortId, now });
}
