/**
 * DUMMY PARTNER contract (BR-42 / BR-43). Pure: no I/O, no clock, no randomness of its own.
 * Everything here talks only to a fictional "DEMO Partner Registry" that runs on loopback.
 * No real organisation is contacted. Real partner transport remains "not built / external".
 */
export const DUMMY_CONTRACT = 'aplyd.dummy-partner/1' as const;
export const DUMMY_LABEL = 'DUMMY partner · loopback only · no real organisation contacted' as const;
/** Fixed DEMO secret. It protects nothing real; it only lets the dummy round trip be verified. */
export const DEMO_SHARED_SECRET = 'DEMO-ONLY-shared-secret-aplyd-dummy-partner-v1';
export const CONSENT_SCOPES = ['progress', 'completion', 'credential-status'] as const;
export type ConsentScope = typeof CONSENT_SCOPES[number];
export const LIMITS = { links: 5, consentsPerLink: 40, deliveries: 100, claims: 200, nonces: 500, maxConsentDays: 90, attempts: 5 } as const;
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
export const HEADER_TS = 'x-demo-timestamp', HEADER_NONCE = 'x-demo-nonce', HEADER_SIG = 'x-demo-signature';
const DAY = 86400000;

export class PartnerDummyError extends Error { constructor(message: string, public status = 422) { super(message); this.name = 'PartnerDummyError'; } }
const fail = (m: string, s = 422): never => { throw new PartnerDummyError(m, s); };

/* ---------- shape helpers ---------- */
const plain = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
export function exact(v: unknown, keys: readonly string[], label: string, optional: readonly string[] = []): asserts v is Record<string, any> {
  if (!plain(v) || Object.keys(v).some(k => !keys.includes(k) && !optional.includes(k)) || keys.some(k => !Object.hasOwn(v, k))) fail(label + ' contains missing or unsupported fields.', 400);
}
const MEMBER_RE = /^DEMO-[A-Z0-9]{4,12}$/, COHORT_RE = /^DEMO-COH-[A-Z0-9]{2,8}$/, ID_RE = /^[a-zA-Z0-9_-]{1,100}$/, VER_RE = /^[a-zA-Z0-9._-]{1,100}$/, NONCE_RE = /^[a-zA-Z0-9_-]{16,64}$/;
export const isMemberCode = (v: unknown): v is string => typeof v === 'string' && MEMBER_RE.test(v);
export const isCohortCode = (v: unknown): v is string => typeof v === 'string' && COHORT_RE.test(v);
const ident = (v: unknown, label: string) => typeof v === 'string' && ID_RE.test(v) ? v : fail(label + ' is invalid.');
const ver = (v: unknown) => typeof v === 'string' && VER_RE.test(v) ? v : fail('Edition is invalid.');
export function canonicalTime(v: unknown, label = 'Time'): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail(label + ' must be a canonical UTC timestamp.');
  return v as string;
}
const scopeList = (v: unknown): ConsentScope[] => {
  if (!Array.isArray(v) || v.length > CONSENT_SCOPES.length || v.some(s => !CONSENT_SCOPES.includes(s)) || new Set(v).size !== v.length) fail('Choose supported partner scopes once each.');
  return CONSENT_SCOPES.filter(s => (v as string[]).includes(s));
};

/* ---------- loopback-only ---------- */
/** Accepts only http://127.0.0.0/8 or http://[::1] with no credentials. "localhost" is refused (name resolution is not guaranteed loopback). */
export function assertLoopbackUrl(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim()) fail('The dummy partner is not running.', 503);
  let u: URL; try { u = new URL(value as string); } catch { return fail('The dummy partner address is not valid. Only a loopback address is allowed.', 400); }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const loop = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) && host.split('.').every(n => Number(n) <= 255) || host === '::1';
  if (u.protocol !== 'http:' || !loop || u.username || u.password) fail('Refused: only a loopback dummy partner (http://127.0.0.1) is allowed. No other address is ever contacted.', 400);
  return u;
}

/* ---------- crypto (WebCrypto: Worker and Node) ---------- */
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(n => n.toString(16).padStart(2, '0')).join('');
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}
export async function sha256Hex(message: string): Promise<string> { return hex(await crypto.subtle.digest('SHA-256', enc.encode(message))); }
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export const signingInput = (ts: string, nonce: string, rawBody: string) => `${DUMMY_CONTRACT}.${ts}.${nonce}.${rawBody}`;
export async function signRequest(secret: string, rawBody: string, nowMs: number, nonce: string) {
  if (!NONCE_RE.test(nonce)) fail('Nonce is invalid.');
  const ts = String(Math.trunc(nowMs));
  return { [HEADER_TS]: ts, [HEADER_NONCE]: nonce, [HEADER_SIG]: await hmacHex(secret, signingInput(ts, nonce, rawBody)) } as Record<string, string>;
}
export type VerifyResult = { ok: true; nonce: string; timestampMs: number } | { ok: false; reason: 'missing' | 'stale' | 'bad-signature' | 'bad-nonce' };
/** Signature + freshness only. Replay is checked separately against the retained nonce list. */
export async function verifyRequest(secret: string, rawBody: string, headers: { get(name: string): string | null }, nowMs: number): Promise<VerifyResult> {
  const ts = headers.get(HEADER_TS), nonce = headers.get(HEADER_NONCE), sig = headers.get(HEADER_SIG);
  if (!ts || !nonce || !sig) return { ok: false, reason: 'missing' };
  if (!/^\d{10,15}$/.test(ts)) return { ok: false, reason: 'stale' };
  if (!NONCE_RE.test(nonce)) return { ok: false, reason: 'bad-nonce' };
  if (Math.abs(nowMs - Number(ts)) > SIGNATURE_WINDOW_MS) return { ok: false, reason: 'stale' };
  if (!/^[0-9a-f]{64}$/.test(sig) || !safeEqual(sig, await hmacHex(secret, signingInput(ts, nonce, rawBody)))) return { ok: false, reason: 'bad-signature' };
  return { ok: true, nonce, timestampMs: Number(ts) };
}
export type NonceRecord = { nonce: string; at: number };
/** Replay protection: a verified nonce may be used once inside the window. Returns the pruned, extended list. */
export function recordNonce(nonces: readonly NonceRecord[], nonce: string, nowMs: number): NonceRecord[] {
  const live = nonces.filter(n => nowMs - n.at <= SIGNATURE_WINDOW_MS * 2);
  if (live.some(n => n.nonce === nonce)) fail('This signed request was already used.', 409);
  if (live.length >= LIMITS.nonces) fail('Too many recent signed requests. Try again shortly.', 429);
  return [...live, { nonce, at: nowMs }];
}

/* ---------- links and consents ---------- */
export type Consent = { id: string; scope: ConsentScope; grantedAt: string; expiresAt: string; withdrawnAt: string | null };
export type PartnerLink = { id: string; partner: 'demo-partner-registry'; memberCode: string; enrollmentId: string; pathwayId: string; edition: string; linkedAt: string; unlinkedAt: string | null; consents: Consent[] };
export type Attempt = { at: string; outcome: 'delivered' | 'rejected' | 'unreachable' | 'refused' };
export type Delivery = { id: string; linkId: string; key: string; scopes: ConsentScope[]; status: 'pending' | 'delivered' | 'failed' | 'blocked'; createdAt: string; attempts: Attempt[]; nextAttemptAt: string | null; payload: DummyPayload; note: string };
export type PartnerDummyState = { links: PartnerLink[]; deliveries: Delivery[] };
export const emptyState = (): PartnerDummyState => ({ links: [], deliveries: [] });
export type EnrollmentRef = { id: string; programId: string; version: string; withdrawn: boolean };

export function readState(value: unknown): PartnerDummyState {
  if (value === undefined) return emptyState();
  exact(value, ['links', 'deliveries'], 'Saved dummy-partner state');
  const { links, deliveries } = value as any;
  if (!Array.isArray(links) || links.length > LIMITS.links * 4 || !Array.isArray(deliveries) || deliveries.length > LIMITS.deliveries) fail('Saved dummy-partner state exceeds its limit.', 409);
  const seen = new Set<string>();
  for (const l of links) {
    exact(l, ['id', 'partner', 'memberCode', 'enrollmentId', 'pathwayId', 'edition', 'linkedAt', 'unlinkedAt', 'consents'], 'Saved partner link');
    ident(l.id, 'Link reference'); ident(l.enrollmentId, 'Enrollment reference'); ident(l.pathwayId, 'Pathway'); ver(l.edition); canonicalTime(l.linkedAt);
    if (l.partner !== 'demo-partner-registry' || !isMemberCode(l.memberCode) || seen.has(l.id)) fail('Saved partner link is invalid.', 409); seen.add(l.id);
    if (l.unlinkedAt !== null) canonicalTime(l.unlinkedAt);
    if (!Array.isArray(l.consents) || l.consents.length > LIMITS.consentsPerLink) fail('Saved consents exceed their limit.', 409);
    for (const c of l.consents) { exact(c, ['id', 'scope', 'grantedAt', 'expiresAt', 'withdrawnAt'], 'Saved consent'); if (!CONSENT_SCOPES.includes(c.scope)) fail('Saved consent scope is unsupported.', 409); canonicalTime(c.grantedAt); canonicalTime(c.expiresAt); if (c.withdrawnAt !== null) canonicalTime(c.withdrawnAt); }
  }
  for (const d of deliveries) { exact(d, ['id', 'linkId', 'key', 'scopes', 'status', 'createdAt', 'attempts', 'nextAttemptAt', 'payload', 'note'], 'Saved delivery'); validatePayload(d.payload); if (!['pending', 'delivered', 'failed', 'blocked'].includes(d.status) || !Array.isArray(d.attempts) || d.attempts.length > LIMITS.attempts) fail('Saved delivery is invalid.', 409); }
  return value as PartnerDummyState;
}

export function createLink(state: PartnerDummyState, input: unknown, e: EnrollmentRef, now: string, linkId: string): PartnerDummyState {
  exact(input, ['memberCode', 'enrollmentId'], 'Link request'); canonicalTime(now);
  if (!isMemberCode(input.memberCode)) fail('Enter a DEMO partner member code such as DEMO-AAA001.');
  if (input.enrollmentId !== e.id) fail('Choose your own saved learning.', 404);
  if (e.withdrawn) fail('Withdrawn learning cannot be linked.', 409);
  const live = state.links.filter(l => l.unlinkedAt === null);
  if (live.length >= LIMITS.links) fail('Unlink a partner member before adding another.', 409);
  if (state.links.length >= LIMITS.links * 4) fail('Retained link history is full.', 409);
  if (live.some(l => l.memberCode === input.memberCode || l.enrollmentId === e.id)) fail('This member code or learning is already linked. Unlink it first.', 409);
  const link: PartnerLink = { id: ident(linkId, 'Link reference'), partner: 'demo-partner-registry', memberCode: input.memberCode, enrollmentId: e.id, pathwayId: ident(e.programId, 'Pathway'), edition: ver(e.version), linkedAt: now, unlinkedAt: null, consents: [] };
  return { ...state, links: [...state.links, link] };
}
function findLink(state: PartnerDummyState, linkId: unknown): PartnerLink { const l = state.links.find(l => l.id === linkId); return l ?? fail('Partner link not found in your learning space.', 404); }
const mapLink = (state: PartnerDummyState, id: string, fn: (l: PartnerLink) => PartnerLink): PartnerDummyState => ({ ...state, links: state.links.map(l => l.id === id ? fn(l) : l) });
export function consentStatus(c: Consent, now: string): 'active' | 'withdrawn' | 'expired' {
  if (c.withdrawnAt !== null && Date.parse(c.withdrawnAt) <= Date.parse(now)) return 'withdrawn';
  return Date.parse(now) >= Date.parse(c.expiresAt) ? 'expired' : 'active';
}
/** Scopes the learner currently allows. A withdrawn or unlinked link allows nothing. */
export function activeScopes(link: PartnerLink, now: string): ConsentScope[] {
  if (link.unlinkedAt !== null) return [];
  return CONSENT_SCOPES.filter(s => link.consents.some(c => c.scope === s && consentStatus(c, now) === 'active'));
}
export function grantConsent(state: PartnerDummyState, input: unknown, now: string, consentId: string): PartnerDummyState {
  exact(input, ['linkId', 'scope', 'days'], 'Consent request'); canonicalTime(now);
  const link = findLink(state, input.linkId);
  if (link.unlinkedAt !== null) fail('This link was removed.', 409);
  if (!CONSENT_SCOPES.includes(input.scope as ConsentScope)) fail('Choose progress, completion or credential-status.');
  if (!Number.isInteger(input.days) || (input.days as number) < 1 || (input.days as number) > LIMITS.maxConsentDays) fail(`Choose 1 to ${LIMITS.maxConsentDays} days.`);
  if (link.consents.length >= LIMITS.consentsPerLink) fail('Consent history for this link is full. Unlink and link again.', 409);
  const next: Consent = { id: ident(consentId, 'Consent reference'), scope: input.scope as ConsentScope, grantedAt: now, expiresAt: new Date(Date.parse(now) + (input.days as number) * DAY).toISOString(), withdrawnAt: null };
  return mapLink(state, link.id, l => ({ ...l, consents: [...l.consents.map(c => c.scope === next.scope && c.withdrawnAt === null ? { ...c, withdrawnAt: now } : c), next] }));
}
/** Withdraw one scope (or every scope when scope is omitted). Also blocks any unsent delivery that needed it. */
export function withdrawConsent(state: PartnerDummyState, input: unknown, now: string): PartnerDummyState {
  exact(input, ['linkId'], 'Withdrawal request', ['scope']); canonicalTime(now);
  const link = findLink(state, input.linkId);
  if (input.scope !== undefined && !CONSENT_SCOPES.includes(input.scope as ConsentScope)) fail('Choose a supported scope.');
  const out = mapLink(state, link.id, l => ({ ...l, consents: l.consents.map(c => c.withdrawnAt === null && (input.scope === undefined || c.scope === input.scope) ? { ...c, withdrawnAt: now } : c) }));
  return blockUnsent(out, link.id, now);
}
export function unlink(state: PartnerDummyState, linkId: unknown, now: string): PartnerDummyState {
  canonicalTime(now); const link = findLink(state, linkId);
  const out = mapLink(state, link.id, l => ({ ...l, unlinkedAt: l.unlinkedAt ?? now, consents: l.consents.map(c => c.withdrawnAt === null ? { ...c, withdrawnAt: now } : c) }));
  return blockUnsent(out, link.id, now);
}
/** Any pending/failed delivery whose scopes are no longer all active is blocked and can never be retried. */
export function blockUnsent(state: PartnerDummyState, linkId: string, now: string): PartnerDummyState {
  const link = findLink(state, linkId), active = activeScopes(link, now);
  return { ...state, deliveries: state.deliveries.map(d => d.linkId === linkId && (d.status === 'pending' || d.status === 'failed') && d.scopes.some(s => !active.includes(s)) ? { ...d, status: 'blocked', nextAttemptAt: null, note: 'Blocked: consent was withdrawn or expired before this was sent. Nothing was sent.' } : d) };
}

/* ---------- minimal outbound payload ---------- */
export type Facts = { status: 'enrolled' | 'in-progress' | 'completed' | 'withdrawn'; startedAt: string; completedAt: string | null; credentialStatus?: 'not-issued' | 'active' | 'suspended' | 'revoked' | null };
export type DummyPayload = {
  contract: typeof DUMMY_CONTRACT; member_code: string; pathway_id: string; edition: string; event_id: string; occurred_at: string; scopes: ConsentScope[];
  progress?: { status: 'enrolled' | 'in-progress' | 'withdrawn'; started_at: string };
  completion?: { completed: boolean; completed_at: string | null };
  credential?: { status: 'not-issued' | 'active' | 'suspended' | 'revoked' | 'unavailable' };
};
const PROGRESS = ['enrolled', 'in-progress', 'withdrawn'], CRED = ['not-issued', 'active', 'suspended', 'revoked', 'unavailable'];
/**
 * Builds the payload by picking named fields only. The caller's Facts object may carry anything
 * (a hostile or careless caller can pass name, email, answers, scores); none of it can be copied.
 */
export function buildPayload(link: PartnerLink, facts: Facts, now: string, eventId: string): DummyPayload {
  const scopes = activeScopes(link, now);
  if (!scopes.length) fail('No active consent. Nothing will be sent.', 409);
  const p: DummyPayload = { contract: DUMMY_CONTRACT, member_code: link.memberCode, pathway_id: link.pathwayId, edition: link.edition, event_id: ident(eventId, 'Event reference'), occurred_at: canonicalTime(now), scopes };
  if (scopes.includes('progress')) p.progress = { status: facts.status === 'completed' ? 'in-progress' : facts.status as any, started_at: canonicalTime(facts.startedAt, 'Start time') };
  if (scopes.includes('completion')) p.completion = { completed: facts.status === 'completed', completed_at: facts.status === 'completed' ? canonicalTime(facts.completedAt, 'Completion time') : null };
  if (scopes.includes('credential-status')) p.credential = { status: facts.credentialStatus ?? 'unavailable' };
  validatePayload(p); return p;
}
export function validatePayload(input: unknown): asserts input is DummyPayload {
  exact(input, ['contract', 'member_code', 'pathway_id', 'edition', 'event_id', 'occurred_at', 'scopes'], 'Partner payload', ['progress', 'completion', 'credential']);
  if (input.contract !== DUMMY_CONTRACT || !isMemberCode(input.member_code)) fail('Partner payload is invalid.', 400);
  ident(input.pathway_id, 'Pathway'); ver(input.edition); ident(input.event_id, 'Event reference'); canonicalTime(input.occurred_at);
  const sc = scopeList(input.scopes); if (!sc.length) fail('Partner payload has no scope.', 400);
  for (const [scope, key] of [['progress', 'progress'], ['completion', 'completion'], ['credential-status', 'credential']] as const) if (Object.hasOwn(input, key) !== sc.includes(scope)) fail('Partner payload fields do not match its scopes.', 400);
  if (input.progress !== undefined) { exact(input.progress, ['status', 'started_at'], 'Progress'); if (!PROGRESS.includes(input.progress.status as string)) fail('Progress status is invalid.', 400); canonicalTime(input.progress.started_at); }
  if (input.completion !== undefined) { const c = input.completion; exact(c, ['completed', 'completed_at'], 'Completion'); if (typeof c.completed !== 'boolean') fail('Completion is invalid.', 400); if (c.completed) canonicalTime(c.completed_at); else if (c.completed_at !== null) fail('Completion is invalid.', 400); /* acceptance fix: a completed payload used to be rejected (truthy time string treated as failure) */ }
  if (input.credential !== undefined) { exact(input.credential, ['status'], 'Credential status'); if (!CRED.includes(input.credential.status as string)) fail('Credential status is invalid.', 400); }
}
/** Stable digest of what the partner would learn, ignoring event id and send time. Same content, same key. */
export async function deliveryKey(p: DummyPayload): Promise<string> { const { event_id, occurred_at, ...rest } = p; return sha256Hex(JSON.stringify(rest)); }

/* ---------- idempotent delivery log with backoff ---------- */
export const backoffMs = (attemptsMade: number) => Math.min(30_000 * 2 ** Math.max(0, attemptsMade - 1), 3_600_000);
export type Plan = { action: 'send'; delivery: Delivery | null } | { action: 'already-delivered'; delivery: Delivery } | { action: 'wait'; delivery: Delivery; until: string } | { action: 'exhausted'; delivery: Delivery };
export function planDelivery(state: PartnerDummyState, linkId: string, key: string, now: string): Plan {
  const d = state.deliveries.find(d => d.linkId === linkId && d.key === key && d.status !== 'blocked');
  if (!d) return { action: 'send', delivery: null };
  if (d.status === 'delivered') return { action: 'already-delivered', delivery: d };
  if (d.attempts.length >= LIMITS.attempts) return { action: 'exhausted', delivery: d };
  if (d.nextAttemptAt && Date.parse(d.nextAttemptAt) > Date.parse(now)) return { action: 'wait', delivery: d, until: d.nextAttemptAt };
  return { action: 'send', delivery: d };
}
export function startDelivery(state: PartnerDummyState, link: PartnerLink, payload: DummyPayload, key: string, now: string): PartnerDummyState {
  const existing = state.deliveries.find(d => d.linkId === link.id && d.key === key && d.status !== 'blocked');
  if (existing) return { ...state, deliveries: state.deliveries.map(d => d === existing ? { ...d, payload, status: 'pending', scopes: payload.scopes } : d) };
  const d: Delivery = { id: payload.event_id, linkId: link.id, key, scopes: payload.scopes, status: 'pending', createdAt: now, attempts: [], nextAttemptAt: null, payload, note: 'Queued for the DUMMY partner on loopback.' };
  return { ...state, deliveries: [d, ...state.deliveries].slice(0, LIMITS.deliveries) };
}
export function recordAttempt(state: PartnerDummyState, deliveryId: string, outcome: Attempt['outcome'], now: string): PartnerDummyState {
  return { ...state, deliveries: state.deliveries.map(d => {
    if (d.id !== deliveryId || d.status === 'delivered' || d.status === 'blocked') return d;
    const attempts = [...d.attempts, { at: now, outcome }].slice(0, LIMITS.attempts);
    if (outcome === 'delivered') return { ...d, attempts, status: 'delivered', nextAttemptAt: null, note: 'Accepted by the DUMMY partner on loopback. No real organisation received anything.' };
    const exhausted = attempts.length >= LIMITS.attempts || outcome === 'refused';
    return { ...d, attempts, status: 'failed', nextAttemptAt: exhausted ? null : new Date(Date.parse(now) + backoffMs(attempts.length)).toISOString(), note: exhausted ? 'Not delivered. No further attempts will be made automatically.' : 'Not delivered. You can retry after the wait shown.' };
  }) };
}

/* ---------- partner-side authorised view ---------- */
export type AuthorisedView = { contract: typeof DUMMY_CONTRACT; member_code: string; pathway_id: string; edition: string; as_of: string; granted_scopes: ConsentScope[]; progress?: DummyPayload['progress']; completion?: DummyPayload['completion']; credential?: DummyPayload['credential'] | { status: 'unavailable'; reason: string } };
/** The only thing a partner can read: fields behind scopes the learner currently grants. Returns null when nothing is granted. */
export function authorisedView(link: PartnerLink, facts: Facts, now: string): AuthorisedView | null {
  const scopes = activeScopes(link, now); if (!scopes.length) return null;
  const v: AuthorisedView = { contract: DUMMY_CONTRACT, member_code: link.memberCode, pathway_id: link.pathwayId, edition: link.edition, as_of: canonicalTime(now), granted_scopes: scopes };
  if (scopes.includes('progress')) v.progress = { status: facts.status === 'completed' ? 'in-progress' : facts.status as any, started_at: facts.startedAt };
  if (scopes.includes('completion')) v.completion = { completed: facts.status === 'completed', completed_at: facts.status === 'completed' ? facts.completedAt : null };
  if (scopes.includes('credential-status')) v.credential = facts.credentialStatus ? { status: facts.credentialStatus } : { status: 'unavailable', reason: 'The credential issuer is not connected in this build.' };
  return v;
}

/* ---------- inbound enrolment claim (no account, no enrolment) ---------- */
export type Claim = { id: string; memberCode: string; cohortCode: string; pathwayId: string; status: 'pending'; createdAt: string; expiresAt: string; note: string };
export function parseEnrolRequest(raw: string): { member_code: string; cohort_code: string; pathway_id: string } {
  let v: unknown; try { v = JSON.parse(raw); } catch { return fail('The enrolment request is not valid JSON.', 400); }
  exact(v, ['member_code', 'cohort_code', 'pathway_id'], 'Enrolment request');
  if (!isMemberCode(v.member_code) || !isCohortCode(v.cohort_code)) fail('Member or cohort code is not a DEMO code.', 400);
  return { member_code: v.member_code, cohort_code: v.cohort_code, pathway_id: ident(v.pathway_id, 'Pathway') };
}
/** Idempotent: a repeated request for the same member and pathway returns the same pending claim. */
export function addClaim(claims: readonly Claim[], req: { member_code: string; cohort_code: string; pathway_id: string }, now: string, claimId: string): { claims: Claim[]; claim: Claim; created: boolean } {
  const live = claims.filter(c => Date.parse(c.expiresAt) > Date.parse(now));
  const same = live.find(c => c.memberCode === req.member_code && c.pathwayId === req.pathway_id);
  if (same) return { claims: live, claim: same, created: false };
  if (live.length >= LIMITS.claims) fail('Too many pending claims. Try again later.', 429);
  const claim: Claim = { id: ident(claimId, 'Claim reference'), memberCode: req.member_code, cohortCode: req.cohort_code, pathwayId: req.pathway_id, status: 'pending', createdAt: canonicalTime(now), expiresAt: new Date(Date.parse(now) + 14 * DAY).toISOString(), note: 'Pending claim only. No account or enrolment was created; the learner must sign in and link this code.' };
  return { claims: [...live, claim], claim, created: true };
}
