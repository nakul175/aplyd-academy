/**
 * Server-side glue for the DUMMY partner (loopback only). Stores everything inside existing JSON
 * aggregates: the learner's own academy_workspaces row (key `partnerDummy`) and one reserved
 * system row (owner `partner-dummy:index`) holding pending claims, a member-code index and nonces.
 * No new tables, no migrations. No network except the loopback URL given by the caller.
 */
import {
  DEMO_SHARED_SECRET, LIMITS, PartnerDummyError, activeScopes, addClaim, assertLoopbackUrl, authorisedView, blockUnsent, buildPayload, createLink, deliveryKey,
  grantConsent, isMemberCode, parseEnrolRequest, planDelivery, readState, recordAttempt, recordNonce, signRequest, startDelivery, unlink, verifyRequest, withdrawConsent,
  type Claim, type Facts, type NonceRecord, type PartnerDummyState, type PartnerLink,
} from './academy-partner-dummy';
import {resolvePinnedProgram} from './academy-curriculum';
import {ensurePersonalSizing, PersonalSizingError} from './academy-personal-storage';

export const INDEX_OWNER = 'partner-dummy:index';
export type Index = { claims: Claim[]; owners: Record<string, string>; nonces: NonceRecord[] };
type DB = { prepare(sql: string): any; batch(stmts: any[]): Promise<any[]> };
type Row = { data: string; revision: number };
const clean = (): Index => ({ claims: [], owners: {}, nonces: [] });
const uuid = () => crypto.randomUUID();
const nonceOf = () => uuid().replace(/-/g, '');

async function loadRow(db: DB, owner: string): Promise<Row | null> { return await db.prepare('SELECT data,revision FROM academy_workspaces WHERE owner=?').bind(owner).first() ?? null; }
async function readIndex(db: DB): Promise<{ index: Index; revision: number; exists: boolean }> {
  const row = await loadRow(db, INDEX_OWNER);
  if (!row) return { index: clean(), revision: 0, exists: false };
  const v = JSON.parse(row.data);
  return { index: { claims: Array.isArray(v.claims) ? v.claims : [], owners: v.owners && typeof v.owners === 'object' ? v.owners : {}, nonces: Array.isArray(v.nonces) ? v.nonces : [] }, revision: row.revision, exists: true };
}
async function writeIndex(db: DB, index: Index, prior: { revision: number; exists: boolean }, now: string): Promise<boolean> {
  const data = JSON.stringify(index);
  const stmt = prior.exists
    ? db.prepare('UPDATE academy_workspaces SET data=?,revision=?,updated_at=? WHERE owner=? AND revision=?').bind(data, prior.revision + 1, now, INDEX_OWNER, prior.revision)
    : db.prepare('INSERT OR IGNORE INTO academy_workspaces(owner,data,revision,updated_at) VALUES(?,?,?,?)').bind(INDEX_OWNER, data, 1, now);
  const [r] = await db.batch([stmt]); return r.meta.changes === 1;
}
async function mutateIndex<T>(db: DB, now: string, fn: (i: Index) => { index: Index; result: T }): Promise<T> {
  for (let n = 0; n < 4; n++) { const cur = await readIndex(db), out = fn(cur.index); if (await writeIndex(db, out.index, cur, now)) return out.result; }
  throw new PartnerDummyError('The partner index was busy. Retry.', 409);
}

/** Read-modify-write the learner's own row with revision compare-and-swap plus an audit row, like the main API. */
async function mutateOwner<T>(db: DB, owner: string, action: string, now: string, fn: (ws: any, partner: PartnerDummyState) => { partner: PartnerDummyState; result: T }): Promise<T> {
  for (let n = 0; n < 4; n++) {
    const row = await loadRow(db, owner); if (!row) throw new PartnerDummyError('Open your learning space first.', 404);
    const ws = JSON.parse(row.data), out = fn(ws, readState(ws.partnerDummy)), next = { ...ws, partnerDummy: out.partner };
    try { ensurePersonalSizing(next); } catch (e) { if (e instanceof PersonalSizingError) throw new PartnerDummyError(e.message, e.status); throw e; }
    const revision = row.revision + 1, data = JSON.stringify(next);
    const update = db.prepare('UPDATE academy_workspaces SET data=?,revision=?,updated_at=? WHERE owner=? AND revision=?').bind(data, revision, now, owner, row.revision);
    const audit = db.prepare('INSERT INTO academy_audit(owner,revision,event_id,action,created_at,request_hash) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(owner, revision, 'partner-' + uuid(), action, now, null);
    const res = await db.batch([update, audit]); if (res[0].meta.changes === 1) return out.result;
  }
  throw new PartnerDummyError('Your learning space changed. Refresh and retry.', 409);
}

export function factsFor(ws: any, link: PartnerLink): Facts {
  const e = (ws.enrollments ?? []).find((x: any) => x.id === link.enrollmentId);
  if (!e) throw new PartnerDummyError('The linked learning is no longer in your space.', 409);
  const startedAt = new Date(e.startedAt).toISOString();
  if (e.withdrawn) return { status: 'withdrawn', startedAt, completedAt: null };
  // Completion is the existing issued practice record, never a score. Nothing else is read from the record.
  const done = e.record?.status === 'active' && typeof e.record.issuedAt === 'string';
  let total = 0; try { total = resolvePinnedProgram(e).lessons.length; } catch { /* unavailable pinned content: stay conservative */ }
  const status = done ? 'completed' : (e.completed?.length ?? 0) > 0 && total > 0 ? 'in-progress' : 'enrolled';
  // Credential issuer is not present in this build; the view reports 'unavailable' honestly.
  return { status, startedAt, completedAt: done ? new Date(e.record.issuedAt).toISOString() : null };
}

/* ---------- learner commands ---------- */
export async function lookupMember(partnerUrl: string | undefined, code: string, fetchImpl: typeof fetch = fetch) {
  const base = assertLoopbackUrl(partnerUrl);
  try { const r = await fetchImpl(new URL('/registry/member/' + encodeURIComponent(code), base), { redirect: 'manual', signal: AbortSignal.timeout(4000) }); if (r.status === 404) return null; if (!r.ok) throw 0; return await r.json() as any; } // acceptance fix: workerd rejects the error redirect mode (Invalid redirect value), which made every partner call fail with 503; 'manual' makes a 3xx a non-ok response
  catch { throw new PartnerDummyError('The dummy partner is not running or did not answer on loopback.', 503); }
}
export async function viewFor(db: DB, owner: string, now: string, partnerConfigured: boolean) {
  const row = await loadRow(db, owner), ws = row ? JSON.parse(row.data) : {}, st = readState(ws.partnerDummy);
  const claims = (await readIndex(db)).index.claims.filter(c => st.links.some(l => l.unlinkedAt === null && l.memberCode === c.memberCode) && Date.parse(c.expiresAt) > Date.parse(now));
  return { label: 'DUMMY partner, loopback only, no real organisation contacted', partnerConfigured, now, links: st.links.map(l => ({ ...l, activeScopes: activeScopes(l, now) })), deliveries: st.deliveries, pendingClaims: claims.map(c => ({ id: c.id, memberCode: c.memberCode, pathwayId: c.pathwayId, expiresAt: c.expiresAt })) };
}
export async function applyLearnerCommand(db: DB, owner: string, cmd: any, now: string, opts: { partnerUrl?: string; fetchImpl?: typeof fetch }) {
  if (!cmd || typeof cmd.type !== 'string') throw new PartnerDummyError('Choose a valid action.', 400);
  if (cmd.type === 'link') {
    const { type, ...input } = cmd; if (!isMemberCode(input.memberCode)) throw new PartnerDummyError('Enter a DEMO partner member code such as DEMO-AAA001.');
    const member = await lookupMember(opts.partnerUrl, input.memberCode, opts.fetchImpl); if (!member?.found || member.status !== 'active') throw new PartnerDummyError('This member code was not found as an active DEMO member.', 404);
    const idx = await readIndex(db), holder = idx.index.owners[input.memberCode];
    if (holder && holder !== owner) { const hrow = await loadRow(db, holder); let still = false; try { still = !!hrow && readState(JSON.parse(hrow.data).partnerDummy).links.some(l => l.unlinkedAt === null && l.memberCode === input.memberCode); } catch { still = true; } if (still) throw new PartnerDummyError('This member code is already linked to another account.', 409); }
    // Reserve the code first. An orphaned reservation is harmless: verification cross-checks the owner's own link.
    await mutateIndex(db, now, i => ({ index: { ...i, owners: { ...i.owners, [input.memberCode]: owner } }, result: 0 }));
    return mutateOwner(db, owner, 'partner-dummy-link', now, (ws, st) => { const e = (ws.enrollments ?? []).find((x: any) => x.id === input.enrollmentId); if (!e) throw new PartnerDummyError('Choose your own saved learning.', 404); return { partner: createLink(st, input, { id: e.id, programId: e.programId, version: e.version, withdrawn: !!e.withdrawn }, now, uuid()), result: { ok: true } }; });
  }
  const run = (fn: (s: PartnerDummyState) => PartnerDummyState) => mutateOwner(db, owner, 'partner-dummy-' + cmd.type, now, (_ws, st) => ({ partner: fn(st), result: { ok: true } }));
  const { type, ...rest } = cmd;
  if (type === 'grant') return run(s => grantConsent(s, rest, now, uuid()));
  if (type === 'withdraw') return run(s => withdrawConsent(s, rest, now));
  if (type === 'unlink') {
    let code: string | null = null;
    const r = await mutateOwner(db, owner, 'partner-dummy-unlink', now, (_ws, st) => { code = st.links.find(l => l.id === rest.linkId)?.memberCode ?? null; return { partner: unlink(st, rest.linkId, now), result: { ok: true } }; });
    // Release the reservation so the code can be linked again. A failure here is harmless: link-time checks the holder's own link.
    if (code) await mutateIndex(db, now, i => { const owners = { ...i.owners }; if (owners[code!] === owner) delete owners[code!]; return { index: { ...i, owners }, result: 0 }; }).catch(() => 0);
    return r;
  }
  throw new PartnerDummyError('Unsupported action.', 400);
}

/* ---------- explicit delivery (button only; no background retries) ---------- */
export async function deliverProgress(db: DB, owner: string, linkId: string, now: string, opts: { partnerUrl?: string; fetchImpl?: typeof fetch; secret?: string }) {
  let base: URL;
  try { base = assertLoopbackUrl(opts.partnerUrl); } catch (e) { if (e instanceof PartnerDummyError && e.status === 503) throw new PartnerDummyError('Dummy partner not running.', 503); throw e; }
  const secret = opts.secret ?? DEMO_SHARED_SECRET, doFetch = opts.fetchImpl ?? fetch;
  // 1. Decide and persist a pending entry (idempotent by content key). Consent is checked against fresh state.
  const prep = await mutateOwner(db, owner, 'partner-dummy-send', now, (ws, st) => {
    const link = st.links.find(l => l.id === linkId); if (!link) throw new PartnerDummyError('Partner link not found in your learning space.', 404);
    const blocked = blockUnsent(st, link.id, now), payload = buildPayload(link, factsFor(ws, link), now, 'evt-' + uuid());
    return { partner: blocked, result: { link, payload, st: blocked } };
  }).catch(e => { throw e; });
  const key = await deliveryKey(prep.payload);
  const plan = planDelivery(prep.st, linkId, key, now);
  if (plan.action === 'already-delivered') return { status: 'already-delivered', deliveryId: plan.delivery.id, note: 'This exact update was already delivered. Nothing was sent again.' };
  if (plan.action === 'wait') return { status: 'wait', deliveryId: plan.delivery.id, until: plan.until, note: 'A retry is not due yet.' };
  if (plan.action === 'exhausted') return { status: 'exhausted', deliveryId: plan.delivery.id, note: 'Attempts are used up for this update.' };
  const payload = plan.delivery ? { ...prep.payload, event_id: plan.delivery.id } : prep.payload;
  // 2. Persist pending with fresh consent re-check (inside the same CAS), then send.
  const queued = await mutateOwner(db, owner, 'partner-dummy-queue', now, (_ws, st) => {
    const link = st.links.find(l => l.id === linkId)!; const scopes = activeScopes(link, now);
    if (!payload.scopes.every(s => scopes.includes(s))) throw new PartnerDummyError('Consent changed. Nothing was sent.', 409);
    return { partner: startDelivery(st, link, payload, key, now), result: true };
  });
  void queued;
  const body = JSON.stringify(payload); let outcome: 'delivered' | 'rejected' | 'unreachable' = 'unreachable';
  try {
    const headers = { 'content-type': 'application/json', ...await signRequest(secret, body, Date.now(), nonceOf()) };
    const r = await doFetch(new URL('/callbacks/progress', base), { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(4000) });
    outcome = r.ok ? 'delivered' : 'rejected';
  } catch { outcome = 'unreachable'; }
  const done = await mutateOwner(db, owner, 'partner-dummy-attempt', now, (_ws, st) => ({ partner: recordAttempt(st, payload.event_id, outcome, now), result: st.deliveries.length }));
  void done;
  return { status: outcome, deliveryId: payload.event_id, note: outcome === 'delivered' ? 'Delivered to the DUMMY partner on loopback.' : 'Not delivered. Retry later; waits grow after each failed attempt.' };
}

/* ---------- partner-authenticated routes ---------- */
async function authenticate(db: DB, raw: string, headers: Headers, secret: string, nowMs: number) {
  const v = await verifyRequest(secret, raw, headers, nowMs);
  if (!v.ok) throw new PartnerDummyError(v.reason === 'stale' ? 'Signature timestamp is outside the allowed window.' : 'Signature rejected.', 401);
  const nowIso = new Date(nowMs).toISOString();
  await mutateIndex(db, nowIso, i => ({ index: { ...i, nonces: recordNonce(i.nonces, v.nonce, nowMs) }, result: 0 }));
}
export async function handleInboundEnrol(db: DB, raw: string, headers: Headers, nowMs: number, secret = DEMO_SHARED_SECRET) {
  await authenticate(db, raw, headers, secret, nowMs);
  const req = parseEnrolRequest(raw), nowIso = new Date(nowMs).toISOString();
  const out = await mutateIndex(db, nowIso, i => { const r = addClaim(i.claims, req, nowIso, 'clm-' + uuid()); return { index: { ...i, claims: r.claims }, result: r }; });
  return { status: out.created ? 201 : 200, body: { claim: { id: out.claim.id, status: out.claim.status, expiresAt: out.claim.expiresAt }, note: out.claim.note } };
}
/** Permissioned verification: returns only what the learner currently grants. Unknown and ungranted look identical. */
export async function handleVerify(db: DB, memberCode: string, headers: Headers, nowMs: number, secret = DEMO_SHARED_SECRET) {
  await authenticate(db, 'verify:' + memberCode, headers, secret, nowMs);
  const none = { status: 404, body: { error: 'No information is available for this member code.' } };
  if (!isMemberCode(memberCode)) return none;
  const owner = (await readIndex(db)).index.owners[memberCode]; if (!owner) return none;
  const row = await loadRow(db, owner); if (!row) return none;
  const ws = JSON.parse(row.data), link = readState(ws.partnerDummy).links.find(l => l.unlinkedAt === null && l.memberCode === memberCode); if (!link) return none;
  const view = authorisedView(link, factsFor(ws, link), new Date(nowMs).toISOString()); if (!view) return none;
  return { status: 200, body: view };
}
export { LIMITS };
