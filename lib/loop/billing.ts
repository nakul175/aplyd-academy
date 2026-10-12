// ACA-US-15.2 renewals and S-05; ACA-E21 billing (in scope only with scope.release including ACA-E21):
// 21.1 invoices per participant or per workshop with a participant cap, 21.2 sponsor-funded seats with aggregate-only
// usage, 21.3 renewal offer, invoice and payment confirmation from the provider. Prices are always the owner's
// decision; no card or bank details are ever stored (the provider holds them).
import {type Db, type Actor, LoopError, audit, refuse, requireOperator, requireOwner, requireRole, requireDecision, requireEpic, iso, DAY, newId, text, oneOf} from './core';
import {cohortOf} from './enrolment';
import {weeklyMetrics, suppress, share} from './metrics';

const addMonths = (date: string, months: number) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };

/** Extend every cohort of the organisation by the agreed months from its current end date. */
async function extendAccess(db: Db, orgId: string, months: number) {
  const cohorts = (await db.prepare('SELECT id, workshop_date, access_months, access_extended_until FROM loop_cohorts WHERE org_id=? AND workshop_date IS NOT NULL').bind(orgId).all<{id: string; workshop_date: string; access_months: number; access_extended_until: string | null}>()).results;
  for (const c of cohorts) {
    const base = addMonths(c.workshop_date, c.access_months), current = c.access_extended_until && c.access_extended_until > base ? c.access_extended_until : base;
    await db.prepare('UPDATE loop_cohorts SET access_extended_until=? WHERE id=?').bind(addMonths(current, months), c.id).run();
  }
  return cohorts.length;
}

// ---- ACA-US-15.2 ----
export async function recordRenewal(db: Db, actor: Actor, orgId: string, input: {decision?: unknown; decidedOn?: unknown; reason?: unknown; sourceRef?: unknown; months?: unknown}, now = Date.now()) {
  await requireOwner(db, actor, 'renewal.record', now);
  const d = oneOf(input.decision, ['renew', 'not_renew'] as const, 'Decision');
  const decidedOn = typeof input.decidedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.decidedOn) ? input.decidedOn : iso(now).slice(0, 10);
  const source = typeof input.sourceRef === 'string' && input.sourceRef.trim() ? input.sourceRef.trim().slice(0, 300) : null;
  const months = d === 'renew' ? (Number(input.months) || (await requireDecision<{months: number}>(db, 'pricing.renewal', orgId)).months) : null;
  const confirmed = source ? 1 : 0; // AC3: without a source document it is saved as unconfirmed and not counted
  await db.prepare('INSERT INTO loop_renewals(org_id,decision,decided_on,reason,source_ref,months,confirmed,recorded_by,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(orgId, d, decidedOn, text(input.reason, 'Reason', 500), source, months, confirmed, actor.userId, iso(now)).run();
  const extended = d === 'renew' && confirmed ? await extendAccess(db, orgId, months!) : 0;
  await audit(db, actor.userId, 'renewal.record', {org: orgId, target: `${d}:${confirmed ? 'confirmed' : 'unconfirmed'}`, now});
  return {confirmed: !!confirmed, extendedCohorts: extended};
}
/** S-05 = organisations that renewed (confirmed) ÷ organisations eligible (a cohort reached month 11 of its year). */
export async function s05(db: Db, now = Date.now()) {
  const eligible = (await db.prepare(`SELECT DISTINCT org_id FROM loop_cohorts WHERE workshop_date IS NOT NULL AND date(workshop_date, '+11 months') <= date(?)`).bind(iso(now)).all<{org_id: string}>()).results.map(r => r.org_id);
  const renewed = new Set((await db.prepare(`SELECT DISTINCT org_id FROM loop_renewals WHERE decision='renew' AND confirmed=1`).all<{org_id: string}>()).results.map(r => r.org_id));
  return {S05: share(eligible.filter(o => renewed.has(o)).length, eligible.length), unconfirmed: (await db.prepare(`SELECT count(*) n FROM loop_renewals WHERE confirmed=0`).first<{n: number}>())!.n};
}

// ---- ACA-US-21.1 ----
export async function setParticipantCap(db: Db, actor: Actor, cohortId: string, cap: unknown, now = Date.now()) {
  await requireOperator(db, actor, 'cohort.cap', now); // only an operator raises the cap (AC3)
  const n = Number(cap); if (!Number.isInteger(n) || n < 1) throw new LoopError('The cap must be a whole number of participants.');
  const c = await cohortOf(db, cohortId); if (!c) throw new LoopError('Cohort not found.', 404);
  await db.prepare('UPDATE loop_cohorts SET participant_cap=? WHERE id=?').bind(n, cohortId).run();
  await audit(db, actor.userId, 'cohort.cap', {org: c.org_id, target: `${cohortId}:${n}`, now});
}
export async function issueWorkshopInvoice(db: Db, actor: Actor, cohortId: string, input: {payer?: unknown}, now = Date.now()) {
  await requireEpic(db, 'ACA-E21');
  await requireOperator(db, actor, 'invoice.workshop', now);
  const c = await cohortOf(db, cohortId); if (!c) throw new LoopError('Cohort not found.', 404);
  const p = await requireDecision<{model: 'per_participant' | 'per_workshop'; unitPaise: number; cap: number}>(db, 'pricing.workshop', c.org_id);
  const enrolled = (await db.prepare(`SELECT count(*) n FROM loop_members WHERE cohort_id=? AND status IN ('invited','joined') AND role IN ('learner','teacher','officer','faculty','student')`).bind(cohortId).first<{n: number}>())!.n;
  const cap = c.participant_cap ?? p.cap;
  const quantity = p.model === 'per_participant' ? Math.min(enrolled, cap) : 1;
  const id = newId('inv');
  await db.prepare(`INSERT INTO loop_invoices(id,org_id,cohort_id,kind,model,unit_paise,quantity,cap,amount_paise,payer,status,created_by,created_at) VALUES(?,?,?,'workshop',?,?,?,?,?,?,'issued',?,?)`)
    .bind(id, c.org_id, cohortId, p.model, p.unitPaise, quantity, cap, p.unitPaise * quantity, text(input.payer, 'Payer', 200), actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'invoice.workshop', {org: c.org_id, target: id, now});
  return {id, model: p.model, quantity, cap, amountPaise: p.unitPaise * quantity};
}

// ---- ACA-US-21.2 ----
export async function createSponsor(db: Db, actor: Actor, input: {name?: unknown; kind?: unknown}, now = Date.now()) {
  await requireEpic(db, 'ACA-E21');
  await requireOperator(db, actor, 'sponsor.create', now);
  const id = newId('spn');
  await db.prepare('INSERT INTO loop_sponsors(id,name,kind,created_by,created_at) VALUES(?,?,?,?,?)').bind(id, text(input.name, 'Sponsor name', 200), oneOf(input.kind, ['philanthropy', 'association', 'csr'] as const, 'Kind'), actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'sponsor.create', {target: id, now});
  return {id};
}
export async function addSponsorViewer(db: Db, actor: Actor, sponsorId: string, email: unknown, now = Date.now()) {
  await requireOperator(db, actor, 'sponsor.viewer', now);
  const u = await db.prepare('SELECT id FROM academy_users WHERE email=?').bind(text(email, 'Email', 254).toLowerCase()).first<{id: string}>();
  if (!u) throw new LoopError('That person needs to sign in once first.', 404);
  await db.prepare('INSERT OR IGNORE INTO loop_sponsor_viewers(sponsor_id,user_id) VALUES(?,?)').bind(sponsorId, u.id).run();
  await audit(db, actor.userId, 'sponsor.viewer', {target: sponsorId, now});
}
export async function fundSeats(db: Db, actor: Actor, sponsorId: string, cohortId: string, seats: unknown, now = Date.now()) {
  await requireEpic(db, 'ACA-E21');
  await requireOperator(db, actor, 'sponsor.fund', now);
  const n = Number(seats); if (!Number.isInteger(n) || n < 1) throw new LoopError('Seats must be a whole number.');
  const c = await cohortOf(db, cohortId); if (!c) throw new LoopError('Cohort not found.', 404);
  const sp = await db.prepare('SELECT name FROM loop_sponsors WHERE id=?').bind(sponsorId).first<{name: string}>(); if (!sp) throw new LoopError('Sponsor not found.', 404);
  const p = await requireDecision<{unitPaise: number}>(db, 'pricing.workshop', c.org_id);
  const id = newId('inv');
  await db.batch([
    db.prepare(`INSERT INTO loop_invoices(id,org_id,cohort_id,kind,model,unit_paise,quantity,amount_paise,payer,sponsor_id,status,created_by,created_at) VALUES(?,?,?,'sponsored_seats','per_seat',?,?,?,?,?,'issued',?,?)`).bind(id, c.org_id, cohortId, p.unitPaise, n, p.unitPaise * n, sp.name, sponsorId, actor.userId, iso(now)),
    db.prepare('INSERT INTO loop_sponsored_seats(sponsor_id,cohort_id,seats,invoice_id,at) VALUES(?,?,?,?,?) ON CONFLICT(sponsor_id,cohort_id) DO UPDATE SET seats=seats+excluded.seats').bind(sponsorId, cohortId, n, id, iso(now)),
  ]);
  await audit(db, actor.userId, 'sponsor.fund', {org: c.org_id, target: `${sponsorId}:${cohortId}:${n}`, now});
  return {invoiceId: id, amountPaise: p.unitPaise * n};
}
/** AC2: the sponsor sees aggregates only, with small-group suppression. */
export async function sponsorUsage(db: Db, actor: Actor, sponsorId: string, now = Date.now()) {
  const v = await db.prepare('SELECT 1 FROM loop_sponsor_viewers WHERE sponsor_id=? AND user_id=?').bind(sponsorId, actor.userId).first();
  if (!v) return refuse(db, actor.userId, 'sponsor.usage', null, 'You do not have access to this.', now);
  const seats = (await db.prepare('SELECT s.cohort_id, s.seats, c.name FROM loop_sponsored_seats s JOIN loop_cohorts c ON c.id=s.cohort_id WHERE s.sponsor_id=?').bind(sponsorId).all<{cohort_id: string; seats: number; name: string}>()).results;
  const out = [];
  for (const s of seats) {
    const joined = (await db.prepare(`SELECT count(*) n FROM loop_members WHERE cohort_id=? AND status='joined'`).bind(s.cohort_id).first<{n: number}>())!.n;
    out.push({cohort: s.name, fundedSeats: s.seats, seatsInUse: share(Math.min(joined, s.seats), s.seats), practice: await weeklyMetrics(db, [s.cohort_id], [1, 2, 3, 4, 5, 6])});
  }
  return suppress(db, {cohorts: out});
}

// ---- ACA-US-21.3 ----
export async function renewalOffer(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  await requireEpic(db, 'ACA-E21');
  await requireRole(db, actor, orgId, ['admin'], 'renewal.offer', {now});
  const p = await requireDecision<{months: number; unitPaise: number; noticeDays?: number}>(db, 'pricing.renewal', orgId);
  const ends = (await db.prepare(`SELECT min(COALESCE(access_extended_until, date(workshop_date, '+' || access_months || ' months'))) e FROM loop_cohorts WHERE org_id=? AND workshop_date IS NOT NULL`).bind(orgId).first<{e: string | null}>())?.e;
  if (!ends) throw new LoopError('No cohort with a workshop date yet.', 409);
  const daysLeft = Math.ceil((Date.parse(ends + 'T00:00:00Z') - now) / DAY);
  if (daysLeft > (p.noticeDays ?? 30)) return {available: false, ends, opensInDays: daysLeft - (p.noticeDays ?? 30)};
  const learners = (await db.prepare(`SELECT count(*) n FROM loop_members WHERE org_id=? AND status='joined' AND role IN ('learner','teacher','officer','faculty','student')`).bind(orgId).first<{n: number}>())!.n;
  return {available: true, ends, months: p.months, learners, unitPaise: p.unitPaise, amountPaise: p.unitPaise * learners};
}
export async function acceptRenewal(db: Db, actor: Actor, orgId: string, now = Date.now()) {
  const offer = await renewalOffer(db, actor, orgId, now);
  if (!offer.available) throw new LoopError('The renewal offer opens closer to the end of your access year.', 409);
  const id = newId('inv');
  const org = (await db.prepare('SELECT name FROM loop_orgs WHERE id=?').bind(orgId).first<{name: string}>())!;
  await db.prepare(`INSERT INTO loop_invoices(id,org_id,kind,model,unit_paise,quantity,amount_paise,payer,months,status,created_by,created_at) VALUES(?,?,'renewal','per_seat',?,?,?,?,?,'issued',?,?)`)
    .bind(id, orgId, offer.unitPaise, offer.learners, offer.amountPaise, org.name, offer.months, actor.userId, iso(now)).run();
  await audit(db, actor.userId, 'renewal.accept', {org: orgId, target: id, now});
  return {invoiceId: id, amountPaise: offer.amountPaise};
}
/** Payment confirmation from the provider's webhook (provider not chosen yet). Extends access and counts for S-05. */
export async function confirmPayment(db: Db, invoiceId: string, providerRef: string, now = Date.now()) {
  const inv = await db.prepare('SELECT * FROM loop_invoices WHERE id=?').bind(invoiceId).first<{id: string; org_id: string; kind: string; status: string; months: number | null}>();
  if (!inv) throw new LoopError('Invoice not found.', 404);
  if (inv.status === 'paid') return {already: true};
  await db.prepare(`UPDATE loop_invoices SET status='paid', provider_ref=?, paid_at=? WHERE id=?`).bind(providerRef.slice(0, 200), iso(now), inv.id).run();
  if (inv.kind === 'renewal' && inv.months) {
    await db.prepare(`INSERT INTO loop_renewals(org_id,decision,decided_on,reason,source_ref,months,confirmed,recorded_by,at) VALUES(?, 'renew', ?, 'Paid renewal', ?, ?, 1, 'payment-provider', ?)`).bind(inv.org_id, iso(now).slice(0, 10), `payment ${providerRef.slice(0, 100)} for ${inv.id}`, inv.months, iso(now)).run();
    await extendAccess(db, inv.org_id, inv.months);
  }
  await audit(db, 'payment-provider', 'invoice.paid', {org: inv.org_id, target: inv.id, now});
  return {paid: true};
}
export async function invoices(db: Db, actor: Actor, now = Date.now()) {
  await requireOperator(db, actor, 'invoice.list', now);
  return (await db.prepare('SELECT * FROM loop_invoices ORDER BY created_at DESC LIMIT 200').all()).results;
}

