// ACA-US-2.5 operator sets up an organisation and its admin; ACA-US-2.1 admin enrols a cohort from a list;
// ACA-US-2.2 learner joins with informed consent (adults only in R1); ACA-US-2.4 staggered start groups.
import {type Db, type Actor, type Member, LoopError, audit, refuse, requireOperator, requireRole, iso, DAY, newId, newToken, sha256, isToken, text, oneOf, isoDate, requireDecision, scopedDecision, decision, requireSelf, requireEpic, memberById, LEARNER_ROLES} from './core';
import {enrolStudents, openHarmSignal, type LegalReview} from './students';
import {deleteMemberRows} from './retention';

export type Send = (to: string, subject: string, body: string) => Promise<void>;
export const INVITE_DAYS = 14; // engineering default for link expiry, not an owner value: a stale link can be re-sent
const ORG_KINDS = ['association', 'school', 'university', 'institute'] as const;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

async function issueInvite(db: Db, memberId: string, now: number) {
  const token = newToken();
  await db.prepare('UPDATE loop_invites SET used_at=? WHERE member_id=? AND used_at IS NULL').bind(iso(now), memberId).run(); // one live link per person
  await db.prepare('INSERT INTO loop_invites(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)').bind(sha256(token), memberId, iso(now), iso(now + INVITE_DAYS * DAY)).run();
  return token;
}
const inviteMail = (origin: string, token: string, orgName: string, role: string) => ({
  subject: `You are invited to Aplyd Academy (${orgName})`,
  body: `You have been invited to join ${orgName} on Aplyd Academy as ${role === 'admin' ? 'its admin' : 'a ' + role}.\n\nOpen this link to read how your data is used and to join (it works once, for ${INVITE_DAYS} days):\n${origin}/loop/join/${token}\n\nIf you did not expect this, ignore this email.`,
});

// ---- ACA-US-2.5 ----
export async function createOrg(db: Db, actor: Actor, input: {kind?: unknown; name?: unknown; sector?: unknown; agreementRef?: unknown}, now = Date.now()) {
  await requireOperator(db, actor, 'org.create', now);
  const kind = oneOf(input.kind, ORG_KINDS, 'Organisation type');
  const name = text(input.name, 'Organisation name', 120), sector = text(input.sector, 'Sector', 60).toLowerCase();
  const agreementRef = text(input.agreementRef, 'Signed agreement reference', 300, {optional: true}) || null;
  // Schools, universities and institutes join only once signed (ACA-US-9.1-AC2, ACA-US-16.2, ACA-US-18.1).
  if (kind !== 'association' && !agreementRef) return refuse(db, actor.userId, 'org.create', null, `A ${kind} can be set up only after it has signed; record the signed agreement reference.`, now);
  if (kind === 'university') await requireEpic(db, 'ACA-E16');
  if (kind === 'institute') await requireEpic(db, 'ACA-E18');
  if (kind === 'school') { const open = await openHarmSignal(db); if (open) return refuse(db, actor.userId, 'org.create', null, `A student-pilot harm signal (review ${open}) has no recorded decision yet; no new school until it does (ACA-US-11.7).`, now); }
  const id = newId('org');
  await db.prepare('INSERT INTO loop_orgs(id,kind,name,sector,agreement_ref,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id, kind, name, sector, agreementRef, actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'org.create', {org: id, target: id, now});
  return {id};
}

export async function inviteStaff(db: Db, actor: Actor, orgId: string, input: {email?: unknown; name?: unknown; role?: unknown}, send: Send, origin: string, now = Date.now()) {
  const role = oneOf(input.role ?? 'admin', ['admin', 'facilitator', 'expert', 'reviewer'] as const, 'Role');
  // Granting the admin role is an operator action (AC2). An org admin may invite facilitators and experts for their own organisation.
  if (role === 'admin') await requireOperator(db, actor, 'org.invite_admin', now);
  else await requireRole(db, actor, orgId, ['admin'], 'org.invite_staff', {allowOperator: true, now});
  const org = await db.prepare('SELECT id, name FROM loop_orgs WHERE id=?').bind(orgId).first<{id: string; name: string}>();
  if (!org) throw new LoopError('Organisation not found.', 404);
  const email = text(input.email, 'Email', 254).toLowerCase(); if (!EMAIL.test(email)) throw new LoopError('Enter a valid email address.');
  const name = text(input.name, 'Name', 120);
  let member = await db.prepare('SELECT * FROM loop_members WHERE org_id=? AND email=? AND role=?').bind(orgId, email, role).first<Member>();
  if (member?.status === 'joined') throw new LoopError('This person has already joined with that role.', 409);
  if (!member) {
    const id = newId('mem');
    await db.prepare(`INSERT INTO loop_members(id,org_id,role,email,name,status,invited_at) VALUES(?,?,?,?,?,'invited',?)`).bind(id, orgId, role, email, name, iso(now)).run();
    member = (await memberById(db, id))!;
  }
  const token = await issueInvite(db, member.id, now);
  const mail = inviteMail(origin, token, org.name, role);
  await send(email, mail.subject, mail.body);
  await audit(db, actor.userId, `org.invite_${role}`, {org: orgId, target: member.id, now});
  return {memberId: member.id};
}

// ---- Cohorts ----
export async function createCohort(db: Db, actor: Actor, orgId: string, input: {name?: unknown; workshopDate?: unknown}, now = Date.now()) {
  await requireRole(db, actor, orgId, ['admin'], 'cohort.create', {allowOperator: true, now});
  const org = await db.prepare('SELECT sector FROM loop_orgs WHERE id=?').bind(orgId).first<{sector: string}>();
  if (!org) throw new LoopError('Organisation not found.', 404);
  // S4 rule (ACA-US-10.5-AC2, ACA-US-14.2-AC1): after a redesign decision no new cohort until the redesigned loop is accepted.
  const latest = await db.prepare(`SELECT d.value FROM loop_decisions d JOIN loop_cohorts c ON c.id=d.scope WHERE d.key='a01.decision' AND c.org_id=? ORDER BY d.id DESC LIMIT 1`).bind(orgId).first<{value: string}>();
  let loopVersion = 'loop-1';
  if (latest && JSON.parse(latest.value).decision === 'redesign') {
    const accepted = await scopedDecision<{loopVersion: string}>(db, 'a01.redesign_accepted', orgId);
    if (!accepted || accepted.decided_at < (await db.prepare(`SELECT max(d.decided_at) t FROM loop_decisions d JOIN loop_cohorts c ON c.id=d.scope WHERE d.key='a01.decision' AND c.org_id=?`).bind(orgId).first<{t: string}>())!.t)
      return refuse(db, actor.userId, 'cohort.create', orgId, 'A new cohort cannot start until the redesigned loop is accepted (week-6 rule S4).', now);
    loopVersion = accepted.value.loopVersion;
  }
  const name = text(input.name, 'Cohort name', 120);
  const workshopDate = input.workshopDate ? isoDate(input.workshopDate, 'Workshop date') : null;
  const id = newId('coh');
  const pack = await db.prepare(`SELECT id FROM loop_packs WHERE sector=? AND audience='learner' ORDER BY created_at LIMIT 1`).bind(org.sector).first<{id: string}>().catch(() => null);
  await db.prepare('INSERT INTO loop_cohorts(id,org_id,name,sector,workshop_date,pack_id,loop_version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id, orgId, name, org.sector, workshopDate, pack?.id ?? null, loopVersion, actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'cohort.create', {org: orgId, target: id, now});
  return {id, loopVersion};
}

export async function cohortOf(db: Db, cohortId: string) {
  return db.prepare('SELECT c.*, o.kind AS org_kind, o.name AS org_name FROM loop_cohorts c JOIN loop_orgs o ON o.id=c.org_id WHERE c.id=?').bind(cohortId).first<{id: string; org_id: string; name: string; sector: string; workshop_date: string | null; access_months: number; access_extended_until: string | null; pack_id: string | null; loop_version: string; participant_cap: number | null; org_kind: string; org_name: string}>();
}

// ---- ACA-US-2.1: list upload, validation and invites ----
export type RowProblem = {line: number; text: string; reason: string};
export function parseMemberList(raw: unknown, fourth: 'phone' | 'email' = 'phone') {
  const body = text(raw, 'Member list', 200_000);
  const ok: {line: number; name: string; email: string; jobRole: string; phone: string | null}[] = [], problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  body.split(/\r?\n/).forEach((lineText, i) => {
    const line = i + 1, t = lineText.trim();
    if (!t || (i === 0 && /^name\s*,\s*email/i.test(t))) return; // blank lines and a header row are skipped
    const [name = '', email = '', jobRole = '', phone = ''] = t.split(',').map(c => c.trim());
    const e = email.toLowerCase();
    const reason = !name ? 'Name is missing' : name.length > 120 ? 'Name is too long'
      : !EMAIL.test(e) ? 'Email is missing or not valid' : !jobRole ? 'Role is missing' : jobRole.length > 60 ? 'Role is too long'
      : phone && fourth === 'phone' && !/^\+?[0-9 ]{8,16}$/.test(phone) ? 'Phone number is not valid'
      : phone && fourth === 'email' && !EMAIL.test(phone.toLowerCase()) ? 'Guardian email is not valid' : seen.has(e) ? `Duplicate of line ${seen.get(e)}` : '';
    if (reason) problems.push({line, text: t.slice(0, 200), reason}); else { seen.set(e, line); ok.push({line, name, email: e, jobRole: jobRole.toLowerCase(), phone: phone ? (fourth === 'phone' ? phone.replace(/ /g, '') : phone.toLowerCase()) : null}); }
  });
  return {ok, problems};
}

export async function enrolCohort(db: Db, actor: Actor, cohortId: string, input: {list?: unknown; role?: unknown}, send: Send, origin: string, now = Date.now()) {
  const cohort = await cohortOf(db, cohortId);
  if (!cohort) return refuse(db, actor.userId, 'cohort.enrol', null, 'You do not have access to this.', now);
  await requireRole(db, actor, cohort.org_id, ['admin'], 'cohort.enrol', {now});
  const role = oneOf(input.role ?? (cohort.org_kind === 'school' ? 'teacher' : cohort.org_kind === 'institute' ? 'officer' : 'learner'), LEARNER_ROLES, 'Learner type');
  if (role === 'student') {
    if (cohort.org_kind === 'school') return enrolStudents(db, actor, cohortId, input.list, send, origin, now); // ACA-E11 gates inside
    if (cohort.org_kind !== 'university') return refuse(db, actor.userId, 'cohort.enrol_student', cohort.org_id, 'Students can be enrolled only by a school (R3 rules) or a university.', now);
    await requireEpic(db, 'ACA-E16'); // adult university students (ACA-US-16.2) follow the normal adult join
  }
  if (role === 'faculty' && cohort.org_kind !== 'university') return refuse(db, actor.userId, 'cohort.enrol_faculty', cohort.org_id, 'Faculty belong to a university workspace.', now);
  if (role === 'teacher') { // ACA-US-9.1 and the B3 rule: teacher mode only when the owner's go/no-go decision allows it
    const go = await decision<{decision: string}>(db, 'golive.decision');
    if (go?.value.decision !== 'go') return refuse(db, actor.userId, 'cohort.enrol_teacher', cohort.org_id, 'Teacher mode starts only after the product owner’s go decision includes it (go/no-go review, rule B3).', now);
  }
  const {ok, problems} = parseMemberList(input.list);
  const invited: string[] = [];
  for (const row of ok) {
    const existing = await db.prepare('SELECT id, cohort_id, status FROM loop_members WHERE org_id=? AND email=? AND role=?').bind(cohort.org_id, row.email, role).first<{id: string; cohort_id: string | null; status: string}>();
    if (existing && existing.status !== 'removed') { problems.push({line: row.line, text: `${row.name}, ${row.email}`, reason: existing.cohort_id === cohortId ? 'Already in this cohort' : 'Already enrolled in another cohort of your organisation'}); continue; }
    // ACA-US-21.1-AC3: a cohort at its participant cap takes no more learners unless an operator raises the cap.
    if (cohort.participant_cap !== null) {
      const n = await db.prepare(`SELECT count(*) n FROM loop_members WHERE cohort_id=? AND status IN ('invited','joined')`).bind(cohortId).first<{n: number}>();
      if ((n?.n ?? 0) >= cohort.participant_cap) { problems.push({line: row.line, text: `${row.name}, ${row.email}`, reason: `The cohort is at its cap of ${cohort.participant_cap} participants; ask an APLYD operator to raise it`}); continue; }
    }
    const id = existing?.id ?? newId('mem');
    if (existing) await db.prepare(`UPDATE loop_members SET cohort_id=?, name=?, job_role=?, phone=?, status='invited', invited_at=?, user_id=NULL, joined_at=NULL WHERE id=?`).bind(cohortId, row.name, row.jobRole, row.phone, iso(now), id).run();
    else await db.prepare(`INSERT INTO loop_members(id,org_id,cohort_id,role,email,name,job_role,phone,status,invited_at) VALUES(?,?,?,?,?,?,?,?,'invited',?)`).bind(id, cohort.org_id, cohortId, role, row.email, row.name, row.jobRole, row.phone, iso(now)).run();
    const token = await issueInvite(db, id, now);
    const mail = inviteMail(origin, token, cohort.org_name, role);
    try { await send(row.email, mail.subject, mail.body); invited.push(id); }
    catch { problems.push({line: row.line, text: `${row.name}, ${row.email}`, reason: 'Added, but the invite email could not be sent. Use “Resend invite” in a few minutes'}); }
  }
  await audit(db, actor.userId, 'cohort.enrol', {org: cohort.org_id, target: `${cohortId}:${invited.length}`, now});
  return {invited: invited.length, problems: problems.sort((a, b) => a.line - b.line)};
}

export async function resendInvite(db: Db, actor: Actor, memberId: string, send: Send, origin: string, now = Date.now()) {
  const m = await memberById(db, memberId);
  if (!m) return refuse(db, actor.userId, 'cohort.resend', null, 'You do not have access to this.', now);
  await requireRole(db, actor, m.org_id, ['admin'], 'cohort.resend', {allowOperator: m.role === 'admin', now});
  if (m.status !== 'invited') throw new LoopError('Only people who have not joined yet can get a new link.', 409);
  const org = await db.prepare('SELECT name FROM loop_orgs WHERE id=?').bind(m.org_id).first<{name: string}>();
  const token = await issueInvite(db, m.id, now); const mail = inviteMail(origin, token, org!.name, m.role);
  await send(m.email, mail.subject, mail.body);
  await audit(db, actor.userId, 'cohort.resend', {org: m.org_id, target: m.id, now});
}

export async function cohortRoster(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const cohort = await cohortOf(db, cohortId);
  if (!cohort) return refuse(db, actor.userId, 'cohort.view', null, 'You do not have access to this.', now);
  await requireRole(db, actor, cohort.org_id, ['admin', 'facilitator'], 'cohort.view', {now});
  // Names and join status only: no levels, answers or files (ACA-US-6.2).
  const members = (await db.prepare(`SELECT id, name, email, job_role, status, start_group, invited_at, joined_at FROM loop_members WHERE cohort_id=? AND status!='removed' ORDER BY name`).bind(cohortId).all()).results;
  return {cohort, members};
}

// ---- ACA-US-2.2: join with informed consent ----
export const PURPOSES = ['core', 'reminder_whatsapp', 'reminder_sms', 'reminder_email'] as const;
export const OPTIONAL_PURPOSES = ['reminder_whatsapp', 'reminder_sms', 'reminder_email', 'share_examples', 'research_interview'] as const;

async function liveInvite(db: Db, token: unknown, now: number) {
  if (!isToken(token)) throw new LoopError('This invite link is not valid.', 404);
  const inv = await db.prepare('SELECT i.*, m.status FROM loop_invites i JOIN loop_members m ON m.id=i.member_id WHERE i.token_hash=?').bind(sha256(token)).first<{member_id: string; expires_at: string; used_at: string | null; status: string}>();
  if (!inv || inv.used_at || inv.status !== 'invited') throw new LoopError('This invite link has already been used or was replaced by a newer one. Ask your admin for a new link.', 410);
  if (Date.parse(inv.expires_at) <= now) throw new LoopError('This invite link has expired. Ask your admin for a new link.', 410);
  return (await memberById(db, inv.member_id))!;
}

export async function approvedNotice(db: Db, orgId = 'global') {
  const d = await requireDecision<{version: string}>(db, 'notice.approved', orgId);
  const n = await db.prepare('SELECT version, body FROM loop_notices WHERE version=?').bind(d.version).first<{version: string; body: string}>();
  if (!n) throw new LoopError('The approved privacy notice is missing on this server.', 503);
  return n;
}

/** What the invite page shows before sign-in: the organisation, the role and (for learners) the approved notice. */
export async function openInvite(db: Db, token: unknown, now = Date.now()) {
  const m = await liveInvite(db, token, now);
  const org = await db.prepare('SELECT name, kind FROM loop_orgs WHERE id=?').bind(m.org_id).first<{name: string; kind: string}>();
  const learner = (LEARNER_ROLES as readonly string[]).includes(m.role);
  const schoolStudent = m.role === 'student' && org!.kind === 'school';
  return {orgName: org!.name, orgKind: org!.kind, role: m.role, email: m.email, firstName: m.name.split(' ')[0], learner, schoolStudent, notice: learner ? await approvedNotice(db, m.org_id) : null, hasPhone: !!m.phone && !schoolStudent};
}

/** ACA-US-2.2-AC4: someone who states they are under 18 cannot join in R1; their invite and list entry are deleted and no account is made. */
export async function declineUnder18(db: Db, token: unknown, now = Date.now()) {
  const m = await liveInvite(db, token, now);
  await deleteMemberRows(db, m.id, now, {log: true}); // logged by internal id so a restore re-deletes it
  await audit(db, 'invitee', 'join.refused_under_18', {org: m.org_id, outcome: 'refused', now}); // no name, email or id is kept
  return {refused: true};
}

export async function acceptInvite(db: Db, actor: Actor & {email: string}, token: unknown, input: {adult?: unknown; consents?: Record<string, unknown>}, now = Date.now()) {
  const m = await liveInvite(db, token, now);
  if (actor.email.toLowerCase() !== m.email) throw new LoopError(`This invite is for ${m.email.replace(/^(.).*(@.*)$/, '$1…$2')}. Sign in with that email to join.`, 403);
  const learner = (LEARNER_ROLES as readonly string[]).includes(m.role);
  let noticeVersion = 'staff';
  const orgKind = (await db.prepare('SELECT kind FROM loop_orgs WHERE id=?').bind(m.org_id).first<{kind: string}>())!.kind;
  const schoolStudent = m.role === 'student' && orgKind === 'school';
  if (learner) {
    if (schoolStudent) { // R3 rules (ACA-E11): the school's agreement, the legal review and, where required, a guardian's consent
      const review = await decision<LegalReview>(db, 'student.legal_review', m.org_id);
      const agreement = await decision(db, 'student.agreement', m.org_id);
      if (!review || !agreement) throw new LoopError('Your school has not finished setting up Aplyd Academy yet.', 403);
      if (review.value.parentalConsentRequired && !(await db.prepare(`SELECT 1 FROM loop_guardian_consents WHERE member_id=? AND status='granted'`).bind(m.id).first())) throw new LoopError('A parent or guardian needs to give consent first.', 403);
    } else if (input.adult !== true) { await declineUnder18(db, token, now); throw new LoopError('Aplyd Academy is for adults (18 and over) at this stage, so you cannot join. Nothing about you has been kept.', 403); }
    noticeVersion = (await approvedNotice(db, m.org_id)).version;
    if (input.consents?.core !== true) throw new LoopError('To join, agree to the use of your practice data described in the notice. You can leave and delete your data at any time.');
  }
  const startGroup = learner && m.cohort_id ? await startGroupFor(db, m.cohort_id, m.id) : null;
  const statements = [
    db.prepare('UPDATE loop_invites SET used_at=? WHERE member_id=? AND used_at IS NULL').bind(iso(now), m.id),
    db.prepare(`UPDATE loop_members SET user_id=?, status='joined', joined_at=?, start_group=? WHERE id=? AND status='invited'`).bind(actor.userId, iso(now), startGroup, m.id),
  ];
  if (learner) {
    for (const p of ['core', ...(schoolStudent ? [] : OPTIONAL_PURPOSES)]) statements.push(db.prepare('INSERT INTO loop_consents(member_id,purpose,granted,notice_version,at) VALUES(?,?,?,?,?)').bind(m.id, p, input.consents?.[p] === true ? 1 : 0, noticeVersion, iso(now)));
    // Minimum data: a phone number is kept only for someone who chose WhatsApp or SMS reminders.
    if (schoolStudent || (input.consents?.reminder_whatsapp !== true && input.consents?.reminder_sms !== true)) statements.push(db.prepare('UPDATE loop_members SET phone=NULL WHERE id=?').bind(m.id));
  }
  await db.batch(statements);
  await audit(db, actor.userId, 'join.accept', {org: m.org_id, target: m.id, now});
  return {memberId: m.id, role: m.role, orgId: m.org_id};
}

export async function currentConsents(db: Db, memberId: string) {
  const rows = (await db.prepare(`SELECT purpose, granted, notice_version, at FROM loop_consents c WHERE member_id=? AND id=(SELECT max(id) FROM loop_consents WHERE member_id=c.member_id AND purpose=c.purpose)`).bind(memberId).all<{purpose: string; granted: number; notice_version: string; at: string}>()).results;
  return Object.fromEntries(rows.map(r => [r.purpose, {granted: r.granted === 1, noticeVersion: r.notice_version, at: r.at}])) as Record<string, {granted: boolean; noticeVersion: string; at: string}>;
}
export async function hasConsent(db: Db, memberId: string, purpose: string) { return (await currentConsents(db, memberId))[purpose]?.granted === true; }

/** ACA-US-2.2-AC3: give or withdraw an optional consent; processing that relied on it stops from the next run. */
export async function setConsent(db: Db, actor: Actor, memberId: string, purpose: unknown, granted: unknown, input: {phone?: unknown} = {}, now = Date.now()) {
  const m = await requireSelf(db, actor, memberId, 'consent.change', now);
  const p = oneOf(purpose, OPTIONAL_PURPOSES, 'Choice');
  const g = granted === true;
  const notice = await db.prepare(`SELECT notice_version FROM loop_consents WHERE member_id=? AND purpose='core' ORDER BY id DESC LIMIT 1`).bind(m.id).first<{notice_version: string}>();
  const statements = [db.prepare('INSERT INTO loop_consents(member_id,purpose,granted,notice_version,at) VALUES(?,?,?,?,?)').bind(m.id, p, g ? 1 : 0, notice?.notice_version ?? 'unknown', iso(now))];
  if (g && (p === 'reminder_whatsapp' || p === 'reminder_sms')) {
    const phone = typeof input.phone === 'string' ? input.phone.replace(/ /g, '') : m.phone;
    if (!phone || !/^\+?[0-9]{8,16}$/.test(phone)) throw new LoopError('Add a mobile number for WhatsApp or SMS reminders.');
    statements.push(db.prepare('UPDATE loop_members SET phone=? WHERE id=?').bind(phone, m.id));
  }
  await db.batch(statements);
  const c = await currentConsents(db, m.id);
  if (!c.reminder_whatsapp?.granted && !c.reminder_sms?.granted) await db.prepare('UPDATE loop_members SET phone=NULL WHERE id=?').bind(m.id).run();
  await audit(db, actor.userId, g ? 'consent.give' : 'consent.withdraw', {org: m.org_id, target: `${m.id}:${p}`, now});
  return c;
}

// ---- ACA-US-2.4: staggered start, only with a recorded agreement ----
async function startGroupFor(db: Db, cohortId: string, memberId: string) {
  const groups = (await db.prepare('SELECT label FROM loop_start_groups WHERE cohort_id=? ORDER BY start_date, label').bind(cohortId).all<{label: string}>()).results;
  if (groups.length === 0) return null;
  // Deterministic, balanced-by-hash assignment so the split is not chosen by anyone: reproducible from the member id.
  const h = parseInt(sha256(cohortId + '|' + memberId).slice(0, 8), 16);
  return groups[h % groups.length].label;
}

export async function setupStartGroups(db: Db, actor: Actor, cohortId: string, now = Date.now()) {
  const cohort = await cohortOf(db, cohortId);
  if (!cohort) return refuse(db, actor.userId, 'cohort.start_groups', null, 'You do not have access to this.', now);
  await requireRole(db, actor, cohort.org_id, ['admin'], 'cohort.start_groups', {allowOperator: true, now});
  const agreement = await decision<{groups: {label: string; start: string}[]; agreementRef: string}>(db, 'staggered.agreement', cohortId);
  if (!agreement) { // AC2: no agreement → everyone starts together, no comparison group
    await db.prepare('DELETE FROM loop_start_groups WHERE cohort_id=?').bind(cohortId).run();
    await db.prepare('UPDATE loop_members SET start_group=NULL WHERE cohort_id=?').bind(cohortId).run();
    await audit(db, actor.userId, 'cohort.start_groups', {org: cohort.org_id, target: `${cohortId}:together`, now});
    return {staggered: false, groups: []};
  }
  const groups = agreement.value.groups.map(g => ({label: text(g.label, 'Group label', 20), start: isoDate(g.start, 'Group start date')}));
  if (groups.length < 2) throw new LoopError('A staggered start needs at least two groups.');
  await db.batch([db.prepare('DELETE FROM loop_start_groups WHERE cohort_id=?').bind(cohortId), ...groups.map(g => db.prepare('INSERT INTO loop_start_groups(cohort_id,label,start_date) VALUES(?,?,?)').bind(cohortId, g.label, g.start))]);
  const members = (await db.prepare(`SELECT id FROM loop_members WHERE cohort_id=? AND status IN ('invited','joined')`).bind(cohortId).all<{id: string}>()).results;
  for (const m of members) await db.prepare('UPDATE loop_members SET start_group=? WHERE id=?').bind(await startGroupFor(db, cohortId, m.id), m.id).run();
  await audit(db, actor.userId, 'cohort.start_groups', {org: cohort.org_id, target: `${cohortId}:${groups.length}`, now});
  return {staggered: true, groups};
}

/** The date a learner's practice starts: their group's date, else the workshop date, else when they joined. */
export async function startDateOf(db: Db, m: Member) {
  if (m.cohort_id && m.start_group) {
    const g = await db.prepare('SELECT start_date FROM loop_start_groups WHERE cohort_id=? AND label=?').bind(m.cohort_id, m.start_group).first<{start_date: string}>();
    if (g) return g.start_date;
  }
  const c = m.cohort_id ? await cohortOf(db, m.cohort_id) : null;
  return c?.workshop_date ?? (m.joined_at ?? iso(Date.now())).slice(0, 10);
}
