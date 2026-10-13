// ACA-E11 student pilot, gated by Q5 (a signed partner school) and Q6 (the qualified legal review).
// 11.1 the school is data fiduciary and APLYD processor: no student account without both records.
// 11.2 parental consent where the legal review requires it: nothing beyond the invite until a guardian consents;
//      refusal or withdrawal deletes the student's data. 11.3 hints only, AI-free checks, no tracking (see ai.ts and
//      docs/privacy/student-tracker-check.md). 11.4 reminders only through the school. 11.5 end-of-pilot deletion or
//      return with evidence. 11.6 teacher class view for the teacher's own class only. 11.7 harm review and stop rule.
import {
  type Db,
  type Actor,
  type Member,
  LoopError,
  audit,
  refuse,
  requireRole,
  requireOperator,
  requireOwner,
  requireDecision,
  decision,
  recordDecision,
  iso,
  DAY,
  newId,
  newToken,
  sha256,
  isToken,
  text,
  oneOf,
  memberById,
} from './core';
import { cohortOf, parseMemberList, type Send } from './enrolment';
import { deleteMemberRows } from './retention';
import { eraseAccount } from '@/lib/auth/erasure';
import { startingLevel } from './levels';
import { saveReport, wilson } from './metrics';

export type LegalReview = {
  ref: string;
  parentalConsentRequired: boolean;
  verificationMethod?: string;
  teacherMaySee?: string[];
};

/** ACA-US-11.1-AC2: both the signed agreement and the legal review must be recorded for this school. */
export async function studentGate(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  const agreement = await decision(db, 'student.agreement', orgId),
    review = await decision<LegalReview>(db, 'student.legal_review', orgId);
  if (!agreement || !review)
    return refuse(
      db,
      actor.userId,
      'cohort.enrol_student',
      orgId,
      'Student accounts are not available until the school’s signed agreement (school as data fiduciary, APLYD as processor) and the qualified legal review are both recorded (ACA-US-11.1).',
      now,
    );
  return review.value;
}

/** Student list rows: name, email, class, guardian email. With parental consent required, only the guardian is contacted. */
export async function enrolStudents(
  db: Db,
  actor: Actor,
  cohortId: string,
  list: unknown,
  send: Send,
  origin: string,
  now = Date.now(),
) {
  const c = await cohortOf(db, cohortId);
  if (!c || c.org_kind !== 'school')
    throw new LoopError('Students can be enrolled only in a school cohort.', 400);
  await requireRole(db, actor, c.org_id, ['admin'], 'cohort.enrol_student', { now });
  const review = await studentGate(db, actor, c.org_id, now);
  const { ok, problems } = parseMemberList(list, 'email'); // 4th column is the guardian's email for students
  let invited = 0,
    guardians = 0;
  for (const r of ok) {
    const guardian = (r.phone ?? '').toLowerCase();
    if (review.parentalConsentRequired && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian)) {
      problems.push({
        line: r.line,
        text: `${r.name}, ${r.email}`,
        reason: 'A parent or guardian email is required',
      });
      continue;
    }
    if (
      await db
        .prepare('SELECT 1 FROM loop_members WHERE org_id=? AND email=? AND role=?')
        .bind(c.org_id, r.email, 'student')
        .first()
    ) {
      problems.push({ line: r.line, text: `${r.name}, ${r.email}`, reason: 'Already enrolled' });
      continue;
    }
    const id = newId('mem');
    // Minimum data before consent: name, email and class only; no phone is ever kept for a student.
    await db
      .prepare(
        `INSERT INTO loop_members(id,org_id,cohort_id,role,email,name,job_role,status,invited_at) VALUES(?,?,?,'student',?,?,?,'invited',?)`,
      )
      .bind(id, c.org_id, cohortId, r.email, r.name, r.jobRole, iso(now))
      .run();
    if (review.parentalConsentRequired) {
      const token = newToken();
      await db
        .prepare(
          'INSERT INTO loop_guardian_consents(id,member_id,guardian_email,token_hash,method,created_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          newId('gc'),
          id,
          guardian,
          sha256(token),
          review.verificationMethod ?? 'email link to the guardian address given by the school',
          iso(now),
        )
        .run();
      await send(
        guardian,
        `Consent request: ${c.org_name} and Aplyd Academy`,
        `${c.org_name} would like your child, ${r.name.split(' ')[0]}, to practise with Aplyd Academy, a learning tool the school uses. The school decides how your child's data is used; APLYD processes it on the school's instructions.\n\nPlease read the notice and give or refuse consent here:\n${origin}/loop/guardian/${token}\n\nNothing about your child is used until you consent, and you can withdraw at any time with the same link.`,
      );
      guardians++;
    } else {
      await sendStudentInvite(db, id, send, origin, now);
      invited++;
    }
  }
  await audit(db, actor.userId, 'cohort.enrol_student', {
    org: c.org_id,
    target: `${cohortId}:${invited + guardians}`,
    now,
  });
  return { invited, guardianRequests: guardians, problems: problems.sort((a, b) => a.line - b.line) };
}

async function sendStudentInvite(db: Db, memberId: string, send: Send, origin: string, now: number) {
  const m = (await memberById(db, memberId))!;
  const org = (await db
    .prepare('SELECT name FROM loop_orgs WHERE id=?')
    .bind(m.org_id)
    .first<{ name: string }>())!;
  const token = newToken();
  await db
    .prepare('UPDATE loop_invites SET used_at=? WHERE member_id=? AND used_at IS NULL')
    .bind(iso(now), m.id)
    .run();
  await db
    .prepare('INSERT INTO loop_invites(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)')
    .bind(sha256(token), m.id, iso(now), iso(now + 14 * DAY))
    .run();
  await send(
    m.email,
    `${org.name}: your Aplyd Academy practice`,
    `Your school has set up Aplyd Academy for you. Open this link to join (it works once):\n${origin}/loop/join/${token}`,
  );
}

async function guardianRow(db: Db, token: unknown) {
  if (!isToken(token)) throw new LoopError('This link is not valid.', 404);
  const g = await db
    .prepare(
      'SELECT g.*, m.name, m.org_id, m.status AS member_status, o.name AS org_name FROM loop_guardian_consents g LEFT JOIN loop_members m ON m.id=g.member_id LEFT JOIN loop_orgs o ON o.id=m.org_id WHERE g.token_hash=?',
    )
    .bind(sha256(token))
    .first<{
      id: string;
      member_id: string;
      status: string;
      name: string | null;
      org_id: string | null;
      org_name: string | null;
      method: string;
    }>();
  if (!g) throw new LoopError('This link is not valid.', 404);
  return g;
}
export async function openGuardianRequest(db: Db, token: unknown) {
  const g = await guardianRow(db, token);
  const notice = g.org_id
    ? await db
        .prepare(
          "SELECT body, version FROM loop_notices WHERE version=(SELECT json_extract(value, '$.version') FROM loop_decisions WHERE key='notice.approved' AND scope=? ORDER BY id DESC LIMIT 1)",
        )
        .bind(g.org_id)
        .first<{ body: string; version: string }>()
    : null;
  return { child: g.name?.split(' ')[0] ?? null, school: g.org_name, status: g.status, notice };
}

/** ACA-US-11.2: grant, refuse or later withdraw. Refusal or withdrawal deletes the student's data and account. */
export async function decideGuardian(
  db: Db,
  token: unknown,
  choice: unknown,
  send: Send,
  origin: string,
  now = Date.now(),
) {
  const g = await guardianRow(db, token);
  const c = oneOf(choice, ['granted', 'refused', 'withdrawn'] as const, 'Answer');
  if (c === 'withdrawn' && g.status !== 'granted')
    throw new LoopError('There is no consent to withdraw.', 409);
  if (c !== 'withdrawn' && g.status !== 'pending')
    throw new LoopError('You have already answered. You can still withdraw consent with this link.', 409);
  await db
    .prepare('UPDATE loop_guardian_consents SET status=?, decided_at=? WHERE id=?')
    .bind(c, iso(now), g.id)
    .run();
  if (c === 'granted') {
    await db
      .prepare(
        `INSERT INTO loop_consents(member_id,purpose,granted,notice_version,at) VALUES(?, 'guardian', 1, 'guardian', ?)`,
      )
      .bind(g.member_id, iso(now))
      .run();
    await sendStudentInvite(db, g.member_id, send, origin, now);
  } else {
    const m = await memberById(db, g.member_id);
    await db.prepare(`UPDATE loop_guardian_consents SET guardian_email='erased' WHERE id=?`).bind(g.id).run();
    if (m) await deleteStudent(db, m, now);
  }
  await audit(db, 'guardian', `guardian.${c}`, { org: g.org_id, target: g.id, now });
  return { status: c };
}

/** Delete everything about a student: the full account erasure if they joined, the list entry otherwise; logged for restores. */
async function deleteStudent(db: Db, m: Member, now: number) {
  if (m.user_id) await eraseAccount(db, m.user_id);
  if (await memberById(db, m.id)) await deleteMemberRows(db, m.id, now, { log: true });
}

/** ACA-US-11.4: what the school relays on its own channel this week. APLYD sends nothing to students. */
export async function schoolReminderDigest(
  db: Db,
  actor: Actor,
  cohortId: string,
  origin: string,
  now = Date.now(),
) {
  const c = await cohortOf(db, cohortId);
  if (!c) return refuse(db, actor.userId, 'school.digest', null, 'You do not have access to this.', now);
  const me = await requireRole(db, actor, c.org_id, ['admin', 'teacher'], 'school.digest', { now });
  await studentGate(db, actor, c.org_id, now);
  // A teacher sees only their own classes; the admin sees the whole cohort.
  const classes =
    me?.role === 'teacher'
      ? (
          await db
            .prepare('SELECT class_label FROM loop_class_teachers WHERE teacher_member_id=?')
            .bind(me.id)
            .all<{ class_label: string }>()
        ).results.map((r) => r.class_label)
      : null;
  if (classes && !classes.length)
    return refuse(db, actor.userId, 'school.digest', c.org_id, 'You can see only your own class.', now);
  const due = (
    await db
      .prepare(
        `SELECT m.name, m.job_role AS class FROM loop_members m WHERE m.cohort_id=? AND m.role='student' AND m.status='joined'
    AND (? IS NULL OR lower(m.job_role) IN (SELECT value FROM json_each(?)))
    AND NOT EXISTS (SELECT 1 FROM loop_submissions s WHERE s.member_id=m.id AND s.at>?) ORDER BY m.job_role, m.name`,
      )
      .bind(cohortId, classes ? 1 : null, JSON.stringify(classes ?? []), iso(now - 7 * DAY))
      .all<{ name: string; class: string }>()
  ).results;
  return {
    message: `Reminder for this week: open Aplyd Academy at ${origin}/loop and do your practice task.`,
    students: due,
  };
}

// ---- ACA-US-11.6 ----
export async function assignClassTeacher(
  db: Db,
  actor: Actor,
  orgId: string,
  classLabel: unknown,
  teacherMemberId: string,
  now = Date.now(),
) {
  await requireRole(db, actor, orgId, ['admin'], 'class.assign', { now });
  const t = await memberById(db, teacherMemberId);
  if (!t || t.org_id !== orgId || t.role !== 'teacher')
    throw new LoopError('Choose a teacher of this school.');
  await db
    .prepare(
      'INSERT OR IGNORE INTO loop_class_teachers(org_id,class_label,teacher_member_id,assigned_by,assigned_at) VALUES(?,?,?,?,?)',
    )
    .bind(orgId, text(classLabel, 'Class', 40).toLowerCase(), t.id, actor.userId, iso(now))
    .run();
  await audit(db, actor.userId, 'class.assign', { org: orgId, target: t.id, now });
}
export async function classView(db: Db, actor: Actor, orgId: string, classLabel: unknown, now = Date.now()) {
  const label = text(classLabel, 'Class', 40).toLowerCase();
  const teacher = await db
    .prepare(
      `SELECT m.id FROM loop_members m JOIN loop_class_teachers ct ON ct.teacher_member_id=m.id WHERE m.user_id=? AND m.org_id=? AND m.role='teacher' AND m.status='joined' AND ct.class_label=?`,
    )
    .bind(actor.userId, orgId, label)
    .first<{ id: string }>();
  if (!teacher) return refuse(db, actor.userId, 'class.view', orgId, 'You can see only your own class.', now);
  const review = await requireDecision<LegalReview>(db, 'student.legal_review', orgId);
  const may = new Set(review.teacherMaySee ?? []);
  if (!may.size)
    throw new LoopError('The legal review does not allow teachers to see student results yet.', 403);
  // Alphabetical by name, no ranking, no behavioural profile (ACA-US-11.6-AC3).
  const rows = (
    await db
      .prepare(
        `SELECT m.name, (SELECT count(*) FROM loop_submissions s WHERE s.member_id=m.id) AS cycles,
      (SELECT group_concat(score || '/' || max_score, ', ') FROM loop_check_results r WHERE r.member_id=m.id) AS checks
    FROM loop_members m WHERE m.org_id=? AND m.role='student' AND m.status='joined' AND lower(m.job_role)=? ORDER BY m.name`,
      )
      .bind(orgId, label)
      .all<{ name: string; cycles: number; checks: string | null }>()
  ).results;
  return rows.map((r) => ({
    name: r.name,
    ...(may.has('practice_counts') ? { practiceCycles: r.cycles } : {}),
    ...(may.has('check_results') ? { checkResults: r.checks ?? '' } : {}),
  }));
}

// ---- ACA-US-11.5 ----
export async function endOfPilot(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  await requireOperator(db, actor, 'school.end_of_pilot', now);
  const ins = await requireDecision<{ mode: 'delete' | 'return'; ref: string }>(
    db,
    'school.end_instruction',
    orgId,
  );
  const students = (
    await db.prepare(`SELECT * FROM loop_members WHERE org_id=? AND role='student'`).bind(orgId).all<Member>()
  ).results;
  let returned: unknown[] | null = null;
  if (ins.mode === 'return') {
    returned = [];
    for (const m of students)
      returned.push({
        student: { name: m.name, class: m.job_role },
        submissions: (
          await db.prepare('SELECT week, note, at FROM loop_submissions WHERE member_id=?').bind(m.id).all()
        ).results,
        checks: (
          await db
            .prepare('SELECT score, max_score, at FROM loop_check_results WHERE member_id=?')
            .bind(m.id)
            .all()
        ).results,
      });
  }
  let accounts = 0;
  for (const m of students) {
    if (m.user_id) accounts++;
    await deleteStudent(db, m, now);
  }
  const remaining = (await db
    .prepare(`SELECT count(*) n FROM loop_members WHERE org_id=? AND role='student'`)
    .bind(orgId)
    .first<{ n: number }>())!.n;
  const counts = { students: students.length, accounts, remaining, mode: ins.mode, instruction: ins.ref };
  await db
    .prepare('INSERT INTO loop_deletion_runs(at,trigger,counts) VALUES(?,?,?)')
    .bind(iso(now), 'end_of_pilot', JSON.stringify(counts))
    .run();
  const evidence = await saveReport(
    db,
    actor,
    'end_of_pilot',
    { orgId },
    {
      title: 'End-of-pilot deletion record',
      ...counts,
      at: iso(now),
      note: "Evidence of deletion under the school's instruction. Backups holding these records expire on the Litestream retention schedule.",
    },
    now,
  );
  await audit(db, actor.userId, 'school.end_of_pilot', { org: orgId, target: evidence.id, now });
  return { ...counts, evidenceReportId: evidence.id, returned };
}

// ---- ACA-US-11.7 ----
export async function prepareHarmReview(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  await requireOperator(db, actor, 'harm.prepare', now);
  const c = await cohortOf(db, cohortId);
  if (!c) throw new LoopError('Cohort not found.', 404);
  const baseline = await requireDecision<{ byLevel: Record<string, number> }>(
    db,
    'student.harm_baseline',
    cohortId,
  );
  const rows = (
    await db
      .prepare(
        `SELECT starting_level, sum(score) k, sum(max_score) n, count(DISTINCT member_id) learners FROM loop_check_results WHERE cohort_id=? GROUP BY starting_level ORDER BY starting_level`,
      )
      .bind(cohortId)
      .all<{ starting_level: string; k: number; n: number; learners: number }>()
  ).results;
  const byLevel = rows.map((r) => {
    const ci = wilson(r.k, r.n),
      base = baseline.byLevel[r.starting_level] ?? null;
    return {
      level: r.starting_level,
      learners: r.learners,
      correctShare: r.n ? r.k / r.n : null,
      low: ci.low,
      high: ci.high,
      baseline: base,
      harmSignal: base !== null && ci.high !== null && ci.high < base,
    };
  });
  const body = {
    title: `Student pilot harm review: ${c.name}`,
    byLevel,
    harmSignal: byLevel.some((l) => l.harmSignal),
    rule: 'A harm signal is raised for a starting level when the upper end of the 95% interval of its unaided-check results is below the baseline agreed with the school.',
    decision: null,
    note: 'Nakul Jain and the school decide continue, change or stop for each group; this pack records nothing by itself.',
  };
  return { ...(await saveReport(db, actor, 'harm_review', { cohortId, orgId: c.org_id }, body, now)), body };
}
export async function recordHarmDecision(
  db: Db,
  actor: Actor,
  reportId: string,
  input: { decision?: unknown; levels?: unknown; schoolRef?: unknown },
  now = Date.now(),
) {
  await requireOwner(db, actor, 'harm.decide', now);
  const r = await db
    .prepare(`SELECT cohort_id FROM loop_reports WHERE id=? AND kind='harm_review'`)
    .bind(reportId)
    .first<{ cohort_id: string }>();
  if (!r) throw new LoopError('Harm review not found.', 404);
  const d = oneOf(input.decision, ['continue', 'change', 'stop'] as const, 'Decision');
  const levels = Array.isArray(input.levels) ? input.levels.filter((x) => typeof x === 'string') : [];
  await recordDecision(
    db,
    actor,
    'student.harm_decision',
    reportId,
    {
      decision: d,
      levels,
      cohortId: r.cohort_id,
      schoolRef: text(input.schoolRef, "The school's agreement to this decision", 300),
    },
    `Harm review ${reportId}`,
    now,
  );
  return { decision: d };
}
/** Practice stops for a starting level the owner and the school stopped (ACA-US-11.7-AC2). */
export async function pausedByHarm(db: Db, m: Member) {
  if (m.role !== 'student' || !m.cohort_id) return false;
  const level = await startingLevel(db, m.id);
  const rows = (
    await db
      .prepare(
        `SELECT d.value FROM loop_decisions d JOIN loop_reports r ON r.id=d.scope WHERE d.key='student.harm_decision' AND r.cohort_id=? ORDER BY d.id DESC`,
      )
      .bind(m.cohort_id)
      .all<{ value: string }>()
  ).results;
  const latest = rows[0] ? (JSON.parse(rows[0].value) as { decision: string; levels: string[] }) : null;
  return (
    !!latest && latest.decision === 'stop' && (latest.levels.length === 0 || latest.levels.includes(level))
  );
}
/** No new school while a harm signal has no recorded decision (ACA-US-11.7, "expansion never proceeds"). */
export async function openHarmSignal(db: Db) {
  const reports = (
    await db
      .prepare(`SELECT id, body FROM loop_reports WHERE kind='harm_review'`)
      .all<{ id: string; body: string }>()
  ).results;
  for (const r of reports)
    if (JSON.parse(r.body).harmSignal && !(await decision(db, 'student.harm_decision', r.id))) return r.id;
  return null;
}
