// Practice loop core: errors, ids, time, audit, operator and member checks, and the owner-decision registry.
// Rule from the plan (S4, S6): values that are the product owner's to set (thresholds, level bands, group sizes,
// retention periods, notice text, cadences) are never defaulted in code. A feature that needs one reads it from
// loop_decisions and refuses until Nakul Jain (role "owner") has recorded it.
import { createHash, randomBytes } from 'node:crypto';

export type Db = D1Database;
export type Actor = { userId: string };
export class LoopError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'LoopError';
  }
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const DAY = 86_400_000;
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const isToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

export function text(value: unknown, label: string, max = 200, { optional = false } = {}): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v && !optional) throw new LoopError(`${label} is required.`);
  if (v.length > max) throw new LoopError(`${label} is too long (at most ${max} characters).`);
  return v;
}
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new LoopError(`${label} must be one of: ${allowed.join(', ')}.`);
}
export function isoDate(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value + 'T00:00:00Z'))
  )
    throw new LoopError(`${label} must be a date (YYYY-MM-DD).`);
  return value;
}

// ---- Audit: who, what, when and the outcome. Never content, files or answers (ACA-US-2.5-AC3). ----
export async function audit(
  db: Db,
  actor: string,
  action: string,
  {
    org = null as string | null,
    target = null as string | null,
    outcome = 'ok' as 'ok' | 'refused',
    now = Date.now(),
  } = {},
) {
  await db
    .prepare('INSERT INTO loop_audit(at,actor,org_id,action,target,outcome) VALUES(?,?,?,?,?,?)')
    .bind(iso(now), actor, org, action, target, outcome)
    .run();
}
/** Refuse, record the attempt, and stop. Refusals are 403 so callers cannot tell other organisations' data exists. */
export async function refuse(
  db: Db,
  actor: string,
  action: string,
  org: string | null,
  message = 'You do not have access to this.',
  now = Date.now(),
): Promise<never> {
  await audit(db, actor, action, { org, outcome: 'refused', now });
  throw new LoopError(message, 403);
}

// ---- Operators (APLYD staff). The owner is the operator with role "owner"; granted on the server by scripts/loop-grant.mjs. ----
export async function operatorRole(db: Db, userId: string): Promise<'owner' | 'operator' | null> {
  const r = await db
    .prepare('SELECT role FROM loop_operators WHERE user_id=?')
    .bind(userId)
    .first<{ role: 'owner' | 'operator' }>();
  return r?.role ?? null;
}
export async function requireOperator(db: Db, actor: Actor, action: string, now = Date.now()) {
  const role = await operatorRole(db, actor.userId);
  if (!role) return refuse(db, actor.userId, action, null, 'Only APLYD operators can do this.', now);
  return role;
}
export async function requireOwner(db: Db, actor: Actor, action: string, now = Date.now()) {
  if ((await operatorRole(db, actor.userId)) !== 'owner')
    return refuse(db, actor.userId, action, null, 'Only the product owner can record this decision.', now);
}

// ---- Members ----
export type Member = {
  id: string;
  org_id: string;
  cohort_id: string | null;
  role: string;
  email: string;
  name: string;
  job_role: string | null;
  phone: string | null;
  user_id: string | null;
  status: string;
  start_group: string | null;
  joined_at: string | null;
};
export const STAFF_ROLES = ['admin', 'facilitator', 'expert', 'reviewer'] as const;
export const LEARNER_ROLES = ['learner', 'teacher', 'student', 'faculty', 'officer'] as const;

export async function myMemberships(db: Db, userId: string) {
  return (
    await db
      .prepare(
        `SELECT m.*, o.name AS org_name, o.kind AS org_kind, o.sector AS org_sector FROM loop_members m JOIN loop_orgs o ON o.id=m.org_id
    WHERE m.user_id=? AND m.status='joined' ORDER BY o.name, m.role`,
      )
      .bind(userId)
      .all<Member & { org_name: string; org_kind: string; org_sector: string }>()
  ).results;
}
/** The actor's joined membership in an organisation with one of the roles, or a logged refusal. Operators pass for staff actions only when allowOperator is set. */
export async function requireRole(
  db: Db,
  actor: Actor,
  orgId: string,
  roles: readonly string[],
  action: string,
  { allowOperator = false, now = Date.now() } = {},
): Promise<Member | null> {
  const rows = (
    await db
      .prepare(`SELECT * FROM loop_members WHERE org_id=? AND user_id=? AND status='joined'`)
      .bind(orgId, actor.userId)
      .all<Member>()
  ).results;
  const m = rows.find((r) => roles.includes(r.role));
  if (m) return m;
  if (allowOperator && (await operatorRole(db, actor.userId))) return null;
  return refuse(db, actor.userId, action, orgId, 'You do not have access to this.', now);
}
export async function memberById(db: Db, id: string) {
  return db.prepare('SELECT * FROM loop_members WHERE id=?').bind(id).first<Member>();
}
/** The actor's own learner record, checked to belong to them. */
export async function requireSelf(
  db: Db,
  actor: Actor,
  memberId: string,
  action: string,
  now = Date.now(),
): Promise<Member> {
  const m = await memberById(db, memberId);
  if (!m || m.user_id !== actor.userId || m.status !== 'joined')
    return refuse(db, actor.userId, action, m?.org_id ?? null, 'You do not have access to this.', now);
  return m;
}

// ---- Owner decisions ----
export const DECISIONS = {
  'notice.approved': {
    story: 'ACA-US-2.2',
    what: 'Approved privacy notice version shown when learners join',
    shape: '{"version":"<notice version>"}',
  },
  'placement.instrument': {
    story: 'ACA-US-2.3',
    what: 'Placement questions and the score range of each AI level band',
    shape: '{"questions":[...],"bands":[{"level":"L1","label":"...","min":0,"max":3}]}',
  },
  'access.notice_days': {
    story: 'ACA-US-2.6',
    what: 'Days before access ends that learners are told',
    shape: '{"days":30}',
  },
  'staggered.agreement': {
    story: 'ACA-US-2.4',
    what: 'Recorded agreement of the owner and the association to stagger starts (scope: cohort id)',
    shape: '{"groups":[{"label":"A","start":"2026-12-01"}],"agreementRef":"..."}',
  },
  'ai.enabled': {
    story: 'ACA-US-7.3',
    what: 'Owner switch for AI help (in addition to the server setting)',
    shape: '{"enabled":true}',
  },
  'ai.thresholds': {
    story: 'ACA-US-7.2',
    what: 'Pass thresholds for the AI evaluation set',
    shape: '{"overall":0.9,"perCategory":{"hint_first":1,"uncertainty":0.9,"refusal":1}}',
  },
  'ai.files_to_provider': {
    story: 'ACA-US-4.2',
    what: 'Whether AIA-ACADEMY-01 allows learner work files to be sent to the AI provider',
    shape: '{"allowed":false,"aiaVersion":"..."}',
  },
  'reminders.channel': {
    story: 'ACA-US-5.2',
    what: 'Reminder channel for a cohort (scope: cohort id or global)',
    shape: '{"channel":"whatsapp"|"sms"|"email"}',
  },
  'reminders.cadences': {
    story: 'ACA-US-5.3',
    what: 'Approved reminder cadences to compare (scope: cohort id)',
    shape: '{"cadences":[{"id":"weekly-mon","days":[1]},{"id":"twice-mon-thu","days":[1,4]}]}',
  },
  'reminders.default_cadence': {
    story: 'ACA-US-14.3',
    what: 'Default reminder cadence for new cohorts',
    shape: '{"cadence":{"id":"weekly-mon","days":[1]}}',
  },
  'followup.inactive_weeks': {
    story: 'ACA-US-5.4',
    what: 'Weeks without practice before a learner is on the follow-up list',
    shape: '{"weeks":2}',
  },
  'metrics.min_group_size': {
    story: 'ACA-US-6.2',
    what: 'Smallest group whose numbers are shown',
    shape: '{"size":5}',
  },
  'a01.decision': {
    story: 'ACA-US-6.3',
    what: 'Week-6 A-01 decision for a cohort (scope: cohort id)',
    shape: '{"decision":"continue"|"redesign","reportId":"..."}',
  },
  'a01.redesign_accepted': {
    story: 'ACA-US-10.5',
    what: 'Redesigned loop accepted after a redesign decision (scope: org id)',
    shape: '{"loopVersion":"loop-2"}',
  },
  'retention.periods': {
    story: 'ACA-US-6.5',
    what: 'Retention period in days per record type',
    shape: '{"days":{"sessions":30,"practice":730}}',
  },
  'help.security_contact': {
    story: 'ACA-US-12.5',
    what: 'Email that receives security and privacy reports',
    shape: '{"email":"..."}',
  },
  'pricing.renewal': {
    story: 'ACA-US-15.2',
    what: 'Renewal period and price (scope: org id or global)',
    shape: '{"months":12,"unitPaise":0,"noticeDays":30}',
  },
  'pricing.workshop': {
    story: 'ACA-US-21.1',
    what: 'Workshop pricing model, price and participant cap (scope: org id)',
    shape: '{"model":"per_participant"|"per_workshop","unitPaise":0,"cap":40}',
  },
  'scope.release': {
    story: 'ACA-E13, E16-E21',
    what: 'Epics brought into scope by a strategy version or owner confirmation',
    shape: '{"epics":["ACA-E13"],"strategyVersion":"..."}',
  },
  'student.agreement': {
    story: 'ACA-US-11.1',
    what: 'Signed agreement: the school is data fiduciary, APLYD processor (scope: org id)',
    shape: '{"ref":"...","signedOn":"YYYY-MM-DD"}',
  },
  'student.harm_baseline': {
    story: 'ACA-US-11.7',
    what: 'Unaided-check baseline agreed with the school, by starting level (scope: cohort id)',
    shape: '{"byLevel":{"L1":0.5,"L2":0.6}}',
  },
  'student.harm_decision': {
    story: 'ACA-US-11.7',
    what: 'Decision of the owner and the school after a harm review (scope: report id)',
    shape: '{"decision":"continue"|"change"|"stop","levels":["L1"],"schoolRef":"..."}',
  },
  'school.end_instruction': {
    story: 'ACA-US-11.5',
    what: "The school's written instruction at the end of the pilot (scope: org id)",
    shape: '{"mode":"delete"|"return","ref":"..."}',
  },
  'speech.provider': {
    story: 'ACA-US-19.2',
    what: 'Speech-to-text provider covered in AIA-ACADEMY-01',
    shape: '{"allowed":true,"aiaVersion":"..."}',
  },
  'brief.max_words': {
    story: 'ACA-US-13.1',
    what: 'Length limit of a monthly brief',
    shape: '{"words":250}',
  },
  'language.local': {
    story: 'ACA-US-19.1',
    what: 'The local language chosen for R4',
    shape: '{"code":"hi","name":"Hindi"}',
  },
  'golive.decision': {
    story: 'ACA-US-12.1',
    what: 'Go/no-go decision before the workshop',
    shape: '{"decision":"go"|"go_without_teacher_mode"|"no_go","packRef":"..."}',
  },
  'review.decision': {
    story: 'ACA-US-10.2',
    what: 'Day-30 or day-90 review decision (scope: report id)',
    shape: '{"decision":"continue"|"adjust"|"stop","linkedTo":"..."}',
  },
  'risk.acceptance': {
    story: 'ACA-US-12.2',
    what: 'Owner accepts or rejects a remaining security risk (scope: finding id)',
    shape: '{"decision":"accept"|"reject","note":"..."}',
  },
  'sessions.format': {
    story: 'ACA-US-8.1',
    what: 'Cadence and format of live sessions',
    shape: '{"cadence":"monthly","minutes":45,"platform":"..."}',
  },
  'student.legal_review': {
    story: 'ACA-US-11.1',
    what: 'Qualified legal review (Q6) of student data for a school (scope: org id)',
    shape: '{"ref":"...","parentalConsentRequired":true,"teacherMaySee":["practice_counts","check_results"]}',
  },
} as const;
export type DecisionKey = keyof typeof DECISIONS;

export async function decision<T = Record<string, unknown>>(
  db: Db,
  key: DecisionKey,
  scope = 'global',
): Promise<{ value: T; decided_at: string; source: string } | null> {
  const r = await db
    .prepare(
      'SELECT value, decided_at, source FROM loop_decisions WHERE key=? AND scope=? ORDER BY id DESC LIMIT 1',
    )
    .bind(key, scope)
    .first<{ value: string; decided_at: string; source: string }>();
  return r ? { value: JSON.parse(r.value) as T, decided_at: r.decided_at, source: r.source } : null;
}
/** A decision scoped to the cohort, else the global one. */
export async function scopedDecision<T = Record<string, unknown>>(db: Db, key: DecisionKey, scope: string) {
  return (await decision<T>(db, key, scope)) ?? decision<T>(db, key);
}
export async function requireDecision<T = Record<string, unknown>>(
  db: Db,
  key: DecisionKey,
  scope = 'global',
): Promise<T> {
  const d = await scopedDecision<T>(db, key, scope);
  if (!d) throw new LoopError(`Waiting for the product owner's decision: ${DECISIONS[key].what}.`, 409);
  return d.value;
}
export async function recordDecision(
  db: Db,
  actor: Actor,
  key: string,
  scope: string,
  value: unknown,
  source: string,
  now = Date.now(),
) {
  await requireOwner(db, actor, 'decision.record', now);
  if (!(key in DECISIONS)) throw new LoopError('Unknown decision.');
  const src = text(source, 'Source (where the decision was made)', 500);
  const json = JSON.stringify(value);
  if (json === undefined || json.length > 20_000)
    throw new LoopError('The decision value is missing or too large.');
  if (key === 'ai.thresholds') await guardThresholds(db, value);
  await db
    .prepare('INSERT INTO loop_decisions(key,scope,value,decided_by,decided_at,source) VALUES(?,?,?,?,?,?)')
    .bind(key, scope || 'global', json, actor.userId, iso(now), src)
    .run();
  await audit(db, actor.userId, 'decision.record', { target: `${key}@${scope || 'global'}`, now });
}
/** ACA-US-7.2-AC2: thresholds are never lowered to obtain a pass. Once a run has failed against the current
 * thresholds, a new set may raise values or add categories but not lower any. */
async function guardThresholds(db: Db, next: unknown) {
  // Once any evaluation run has failed, no value may go below the highest value ever recorded for it.
  const failed = await db.prepare('SELECT 1 FROM loop_eval_runs WHERE passed=0 LIMIT 1').first();
  if (!failed) return;
  const all = (
    await db.prepare(`SELECT value FROM loop_decisions WHERE key='ai.thresholds'`).all<{ value: string }>()
  ).results.map((r) => JSON.parse(r.value) as { overall?: number; perCategory?: Record<string, number> });
  const max = {
    overall: Math.max(0, ...all.map((t) => t.overall ?? 0)),
    perCategory: {} as Record<string, number>,
  };
  for (const t of all)
    for (const [k, v] of Object.entries(t.perCategory ?? {}))
      max.perCategory[k] = Math.max(max.perCategory[k] ?? 0, v);
  const n = (next ?? {}) as { overall?: number; perCategory?: Record<string, number> };
  const lower =
    (n.overall ?? 0) < max.overall ||
    Object.entries(max.perCategory).some(([k, v]) => (n.perCategory?.[k] ?? 0) < v);
  if (lower)
    throw new LoopError(
      'An evaluation run has failed, so no threshold can go below the highest value recorded before. Fix the AI configuration instead.',
      409,
    );
}

/** Features of later releases wait until the owner brings their epic into scope (a new strategy version). */
export async function requireEpic(db: Db, epic: string) {
  const d = await decision<{ epics: string[] }>(db, 'scope.release');
  if (!d?.value.epics?.includes(epic))
    throw new LoopError(
      `Waiting for the product owner: ${epic} is not in scope yet (it needs a new strategy version or the owner's confirmation).`,
      409,
    );
}

export async function pendingDecisions(db: Db) {
  const have = new Set(
    (await db.prepare('SELECT DISTINCT key FROM loop_decisions').all<{ key: string }>()).results.map(
      (r) => r.key,
    ),
  );
  return (Object.keys(DECISIONS) as DecisionKey[]).map((k) => ({
    key: k,
    ...DECISIONS[k],
    recorded: have.has(k),
  }));
}
