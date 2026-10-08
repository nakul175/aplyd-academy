// Workspace data requests (BR-44): export, correction and erasure/withdrawal-of-consent requests.
// Pure module. State lives inside the existing team JSON aggregate (t.dataRequests); no table or
// migration. Runs inside the team revision fence, so concurrency, idempotency by actionId and the
// outsider 404 stay with the route. Identity verification here is a SYNTHETIC two-of-three check
// recorded by a workspace admin; it is not a real identity-proofing service.
import { RuleError, contexts } from './academy-engine';

export const DATA_REQUEST_SLA_DAYS = 30; // configurable default; the due date is fixed when the request is filed
export const DATA_REQUEST_TYPES = ['export', 'correction', 'erasure'] as const;
export const VERIFICATION_CHECKS = [
  { id: 'account-email', label: 'Request came from the signed-in account email on the workspace roster' },
  { id: 'roster-details', label: 'Requester confirmed a roster detail (cohort and join month) to an admin' },
  { id: 'recent-activity', label: 'Requester confirmed one recent action in this workspace to an admin' },
] as const;
export const VERIFICATION_REQUIRED = 2;
export const ERASURE_HOLD_TEXT = 'Held — retention policy pending';
export const MAX_REQUESTS = 200,
  MAX_OPEN_PER_USER = 3,
  MAX_EXPORT_BYTES = 250_000;
const OPEN = ['received', 'verified', 'verification-failed'];
const STRIP = new Set(['actor', 'actorId', 'assignedBy', 'assignedTo', 'staffId', 'tokenHash']);
const commands = new Set([
  'data-request-open',
  'data-request-verify',
  'data-request-decide',
  'data-request-withdraw',
  'data-request-restriction',
]);
export type DataRequest = {
  id: string;
  clientRef: string | null;
  requesterId: string;
  requesterName: string;
  type: (typeof DATA_REQUEST_TYPES)[number];
  detail: string;
  proposed: any | null;
  status: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  verification: {
    status: 'pending' | 'verified' | 'failed';
    passed: string[];
    recordedById: string | null;
    recordedByName: string | null;
    recordedAt: string | null;
    note: string | null;
    synthetic: true;
  };
  decision: {
    outcome: 'approve' | 'decline';
    reason: string;
    actorId: string;
    actorName: string;
    decidedAt: string;
  } | null;
  hold: { label: string; since: string; restricted: boolean } | null;
  export: { generatedAt: string; manifest: any; sha256: string; json: string } | null;
  events: any[];
};
export type DataRequestState = {
  requests: DataRequest[];
  restricted: Array<{ userId: string; requestId: string; since: string }>;
};

// Synchronous SHA-256 (the team command path is synchronous; no WebCrypto or network needed).
const PR: number[] = [];
for (let n = 2; PR.length < 64; n++) if (PR.every((p) => n % p)) PR.push(n);
const frac = (x: number) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
const K = PR.map((p) => frac(Math.cbrt(p)));
export function sha256Hex(text: string) {
  const msg = Array.from(new TextEncoder().encode(text)),
    bits = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
  const h = PR.slice(0, 8).map((p) => frac(Math.sqrt(p))),
    rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < msg.length; o += 64) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++)
      w[i] =
        ((msg[o + i * 4] << 24) |
          (msg[o + i * 4 + 1] << 16) |
          (msg[o + i * 4 + 2] << 8) |
          msg[o + i * 4 + 3]) >>>
        0;
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3),
        s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0,
        t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = (h[i] + v) >>> 0;
    });
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}

const exact = (c: any, keys: string[]) => {
  if (Object.keys(c).some((k) => !['type', ...keys].includes(k)))
    throw new RuleError('This data request includes unsupported fields.', 400);
};
function txt(v: any, name: string, min: number, max: number) {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max)
    throw new RuleError(`${name} needs ${min}–${max} characters.`);
  return v.trim();
}
const isAdmin = (m: any) => !!m && m.active && m.roles.includes('admin');
const store = (t: any): DataRequestState => (t.dataRequests ??= { requests: [], restricted: [] });
const snap = (n: any) => String(n || 'Academy member').slice(0, 80);
function activeMember(t: any, id: string) {
  const m = t.members.find((x: any) => x.userId === id);
  if (!m) throw new RuleError('Workspace not found for your account.', 404);
  if (!m.active)
    throw new RuleError(
      'Your workspace access has been removed. Your own learning history remains readable.',
      403,
    );
  return m;
}
function addEvent(t: any, r: DataRequest, m: any, type: string, now: string, detail: any = {}) {
  r.events.push({
    id: crypto.randomUUID(),
    type,
    actorId: m.userId,
    actorName: snap(m.name),
    at: now,
    detail,
  });
  r.updatedAt = now;
  (t.activity ??= []).push({
    id: crypto.randomUUID(),
    actor: m.userId,
    actorName: snap(m.name),
    action: 'data-request-' + type,
    createdAt: now,
    detail: { requestId: r.id, requesterId: r.requesterId, ...detail },
  });
}
export const dueDate = (now: string, days = DATA_REQUEST_SLA_DAYS) =>
  new Date(Date.parse(now) + days * 86400000).toISOString();
export const isOverdue = (r: DataRequest, now: string) =>
  OPEN.includes(r.status) && Date.parse(now) > Date.parse(r.dueAt);
function find(t: any, m: any, c: any, forAdmin: boolean) {
  const r = store(t).requests.find((x) => x.id === c.requestId);
  if (!r || (!isAdmin(m) && r.requesterId !== m.userId))
    throw new RuleError('Data request not found for this account.', 404);
  if (forAdmin && !isAdmin(m)) throw new RuleError('Only a workspace owner can do this.', 403);
  return r;
}
function fresh(r: DataRequest, c: any) {
  if (!Number.isInteger(c.requestRev))
    throw new RuleError('Send the request revision you are acting on.', 400);
  if (c.requestRev !== r.rev)
    throw new RuleError('This request changed. Refresh and retry; your input is still here.', 409);
}

// ---- Own-data export. Learner-facing records only: no other learner's text, no staff-only data. ----
function scrub(v: any): any {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v)) if (!STRIP.has(k)) o[k] = scrub(v[k]);
    return o;
  }
  return v;
}
export function buildOwnWorkspaceExport(t: any, userId: string, requestId: string, now: string) {
  const l = t.learners.find((x: any) => x.userId === userId),
    s = l?.state,
    m = t.members.find((x: any) => x.userId === userId);
  const enrollments = (s?.enrollments ?? []).map((e: any) => ({
    ...scrub(e),
    cohortTitle: t.cohorts.find((c: any) => c.id === e.cohortId)?.title ?? null,
  }));
  const lessonPractice = (s?.enrollments ?? []).flatMap((e: any) =>
    Object.entries(e.practice ?? {}).map(([lessonId, p]: any) => ({
      enrollmentId: e.id,
      lessonId,
      ...scrub(p),
    })),
  );
  const submissions = (s?.enrollments ?? []).flatMap((e: any) =>
    (e.attempts ?? []).map((a: any) => {
      const { decision, ...rest } = a;
      return { enrollmentId: e.id, ...scrub(rest) };
    }),
  );
  const decisionsReceived = (s?.enrollments ?? []).flatMap((e: any) =>
    (e.attempts ?? [])
      .filter((a: any) => a.decision)
      .map((a: any) => ({ enrollmentId: e.id, attemptId: a.id, ...scrub(a.decision) })),
  );
  const postsAuthored = t.posts
    .filter((p: any) => p.authorId === userId)
    .map((p: any) => ({
      id: p.id,
      cohortId: p.cohortId,
      title: p.title,
      body: p.body,
      status: p.status,
      createdAt: p.createdAt,
      repliesByOthers: p.replies.length,
    }));
  const repliesAuthored = t.posts.flatMap((p: any) =>
    p.replies
      .filter((r: any) => r.authorId === userId)
      .map((r: any) => ({ id: r.id, postId: p.id, body: r.body, status: r.status, createdAt: r.createdAt })),
  );
  const directory = (t.network?.profiles ?? [])
    .filter((p: any) => p.userId === userId)
    .map((p: any) => ({
      enabled: p.enabled,
      bio: p.bio,
      focus: p.focus,
      cohortIds: p.cohortIds,
      consentedAt: p.consentedAt,
    }));
  const data = {
    profile: {
      ...scrub(s?.profile ?? {}),
      workspaceDisplayName: m?.name ?? null,
      joinedAt: m?.joinedAt ?? null,
      directoryProfile: directory[0] ?? null,
    },
    enrollments,
    lessonPractice,
    submissions,
    decisionsReceived,
    postsAuthored,
    repliesAuthored,
  };
  const body = JSON.stringify(data),
    counts = {
      enrollments: enrollments.length,
      lessonPractice: lessonPractice.length,
      submissions: submissions.length,
      decisionsReceived: decisionsReceived.length,
      postsAuthored: postsAuthored.length,
      repliesAuthored: repliesAuthored.length,
    };
  const manifest = {
    format: 'aplyd-academy-workspace-data-export',
    formatVersion: 1,
    workspaceId: t.id,
    workspaceName: t.name,
    requestId,
    subjectId: userId,
    generatedAt: now,
    counts,
    dataSha256: sha256Hex(body),
    checksumNote:
      'SHA-256 of the exact JSON text of "data" (compact JSON.stringify). It detects accidental change; it is not a signature and cannot restore a workspace.',
    excluded: [
      "other learners' work, posts and names",
      'text of replies others wrote on your posts',
      'staff-only notes, moderation records and reports',
      'support threads',
      'assignment, audit and membership records of other people',
      'staff account identifiers',
    ],
  };
  return { manifest, data, json: JSON.stringify({ manifest, data }, null, 2) };
}

function profileChange(v: any) {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !['name', 'context', 'reading', 'networking'].includes(k))
  )
    throw new RuleError('Choose profile fields to correct: name, context, reading or networking.', 400);
  const o: any = {};
  if ('name' in v) o.name = txt(v.name, 'Display name', 1, 80);
  if ('context' in v) {
    if (!Object.hasOwn(contexts, v.context)) throw new RuleError('Choose a valid work context.');
    o.context = v.context;
  }
  for (const k of ['reading', 'networking'])
    if (k in v) {
      if (typeof v[k] !== 'boolean') throw new RuleError('Choose a valid preference.');
      o[k] = v[k];
    }
  if (!Object.keys(o).length) throw new RuleError('Choose at least one profile field to correct.');
  return o;
}

// Returns true when the command was a data-request command (and was applied to t in place).
// Callers pass a working copy; a thrown error leaves the committed document untouched.
export function applyDataRequestCommand(t: any, m: any, c: any, now: string): boolean {
  if (!c || typeof c.type !== 'string' || !commands.has(c.type)) return false;
  const actor = activeMember(t, m.userId),
    s = store(t);
  switch (c.type) {
    case 'data-request-open': {
      exact(c, ['kind', 'detail', 'proposed', 'clientRef']);
      if (!DATA_REQUEST_TYPES.includes(c.kind)) throw new RuleError('Choose export, correction or erasure.');
      const ref = c.clientRef == null ? null : txt(c.clientRef, 'Request reference', 8, 80);
      if (ref) {
        const prior = s.requests.find((r) => r.requesterId === actor.userId && r.clientRef === ref);
        if (prior) {
          if (prior.type !== c.kind)
            throw new RuleError('This request reference was already used for another request.', 409);
          return true;
        }
      }
      if (s.requests.length >= MAX_REQUESTS)
        throw new RuleError(
          'This pilot workspace reached its data request limit. Ask the workspace owner.',
          409,
        );
      if (
        s.requests.filter((r) => r.requesterId === actor.userId && OPEN.includes(r.status)).length >=
        MAX_OPEN_PER_USER
      )
        throw new RuleError(
          'You already have three open data requests. Wait for a decision or withdraw one.',
          409,
        );
      if (
        s.requests.some((r) => r.requesterId === actor.userId && r.type === c.kind && OPEN.includes(r.status))
      )
        throw new RuleError('You already have an open request of this type.', 409);
      if (c.kind !== 'correction' && c.proposed != null)
        throw new RuleError('Only a correction request proposes profile changes.', 400);
      const proposed = c.kind === 'correction' ? profileChange(c.proposed) : null;
      const detail =
        c.kind === 'export'
          ? c.detail == null
            ? ''
            : txt(c.detail, 'Detail', 0, 1000)
          : txt(
              c.detail,
              c.kind === 'erasure' ? 'Reason for erasure or withdrawal of consent' : 'Reason for correction',
              10,
              1000,
            );
      const r: DataRequest = {
        id: crypto.randomUUID(),
        clientRef: ref,
        requesterId: actor.userId,
        requesterName: snap(actor.name),
        type: c.kind,
        detail,
        proposed,
        status: 'received',
        rev: 1,
        createdAt: now,
        updatedAt: now,
        dueAt: dueDate(now),
        verification: {
          status: 'pending',
          passed: [],
          recordedById: null,
          recordedByName: null,
          recordedAt: null,
          note: null,
          synthetic: true,
        },
        decision: null,
        hold: null,
        export: null,
        events: [],
      };
      s.requests.push(r);
      addEvent(t, r, actor, 'opened', now, { kind: c.kind, dueAt: r.dueAt });
      return true;
    }
    case 'data-request-verify': {
      exact(c, ['requestId', 'requestRev', 'passed', 'note']);
      const r = find(t, actor, c, true);
      if (r.requesterId === actor.userId)
        throw new RuleError(
          'You cannot verify your own request. Another workspace owner must record the checks.',
          403,
        );
      fresh(r, c);
      if (!['received', 'verification-failed'].includes(r.status))
        throw new RuleError('Verification is already recorded for this request.', 409);
      if (
        !Array.isArray(c.passed) ||
        new Set(c.passed).size !== c.passed.length ||
        c.passed.some((id: any) => !VERIFICATION_CHECKS.some((k) => k.id === id))
      )
        throw new RuleError('Choose from the listed verification checks.');
      const ok = c.passed.length >= VERIFICATION_REQUIRED,
        note = c.note == null ? null : txt(c.note, 'Verification note', 0, 500) || null;
      Object.assign(r.verification, {
        status: ok ? 'verified' : 'failed',
        passed: [...c.passed],
        recordedById: actor.userId,
        recordedByName: snap(actor.name),
        recordedAt: now,
        note,
      });
      r.status = ok ? 'verified' : 'verification-failed';
      r.rev += 1;
      addEvent(t, r, actor, 'verified', now, { passed: c.passed, result: r.verification.status });
      return true;
    }
    case 'data-request-decide': {
      exact(c, ['requestId', 'requestRev', 'outcome', 'reason']);
      const r = find(t, actor, c, true);
      if (r.requesterId === actor.userId)
        throw new RuleError(
          'You cannot decide your own request. Another workspace owner must review it.',
          403,
        );
      fresh(r, c);
      if (!OPEN.includes(r.status)) throw new RuleError('This request already has an outcome.', 409);
      if (!['approve', 'decline'].includes(c.outcome)) throw new RuleError('Choose approve or decline.');
      const reason = txt(c.reason, 'Decision reason', 10, 1000);
      const decision = {
        outcome: c.outcome,
        reason,
        actorId: actor.userId,
        actorName: snap(actor.name),
        decidedAt: now,
      };
      if (c.outcome === 'decline') {
        r.decision = decision;
        r.status = 'declined';
        r.rev += 1;
        addEvent(t, r, actor, 'declined', now, { reason });
        return true;
      }
      if (r.verification.status !== 'verified')
        throw new RuleError('Record a passing verification (two of three checks) before approving.', 409);
      const l = t.learners.find((x: any) => x.userId === r.requesterId);
      if (r.type === 'export') {
        const x = buildOwnWorkspaceExport(t, r.requesterId, r.id, now);
        if (new TextEncoder().encode(x.json).length > MAX_EXPORT_BYTES)
          throw new RuleError(
            'This export is larger than the pilot limit. Ask the platform team for a manual export.',
            413,
          );
        r.export = { generatedAt: now, manifest: x.manifest, sha256: x.manifest.dataSha256, json: x.json };
        r.status = 'completed';
        addEvent(t, r, actor, 'export-generated', now, {
          sha256: x.manifest.dataSha256,
          counts: x.manifest.counts,
        });
      } else if (r.type === 'correction') {
        if (!l) throw new RuleError('This learner has no workspace learning profile to correct yet.', 409);
        const before: any = {};
        for (const k of Object.keys(r.proposed)) before[k] = l.state.profile[k];
        Object.assign(l.state.profile, r.proposed);
        r.status = 'completed';
        addEvent(t, r, actor, 'correction-applied', now, { before, after: r.proposed });
      } else {
        // Erasure: record only. Nothing is deleted; retention policy is undecided (external-blocked).
        r.status = 'held';
        r.hold = { label: ERASURE_HOLD_TEXT, since: now, restricted: true };
        if (!s.restricted.some((x) => x.userId === r.requesterId))
          s.restricted.push({ userId: r.requesterId, requestId: r.id, since: now });
        addEvent(t, r, actor, 'erasure-held', now, {
          label: ERASURE_HOLD_TEXT,
          restrict: true,
          deleted: false,
        });
      }
      r.decision = decision;
      r.rev += 1;
      return true;
    }
    case 'data-request-withdraw': {
      exact(c, ['requestId', 'requestRev']);
      const r = find(t, actor, c, false);
      if (r.requesterId !== actor.userId)
        throw new RuleError('Only the requester can withdraw a request.', 403);
      fresh(r, c);
      if (!OPEN.includes(r.status)) throw new RuleError('Only open requests can be withdrawn.', 409);
      r.status = 'withdrawn';
      r.rev += 1;
      addEvent(t, r, actor, 'withdrawn', now);
      return true;
    }
    case 'data-request-restriction': {
      exact(c, ['requestId', 'requestRev', 'restricted', 'reason']);
      const r = find(t, actor, c, true);
      if (r.requesterId === actor.userId)
        throw new RuleError('You cannot change the restriction on your own request.', 403);
      fresh(r, c);
      if (r.type !== 'erasure' || !r.hold)
        throw new RuleError('Only a held erasure request carries a restriction.', 409);
      if (typeof c.restricted !== 'boolean') throw new RuleError('Choose restrict or lift.');
      const reason = txt(c.reason, 'Reason', 10, 1000);
      if (r.hold.restricted === c.restricted) return true;
      r.hold.restricted = c.restricted;
      if (c.restricted) {
        if (!s.restricted.some((x) => x.userId === r.requesterId))
          s.restricted.push({ userId: r.requesterId, requestId: r.id, since: now });
      } else s.restricted = s.restricted.filter((x) => x.userId !== r.requesterId);
      r.rev += 1;
      addEvent(t, r, actor, c.restricted ? 'restriction-applied' : 'restriction-lifted', now, { reason });
      return true;
    }
  }
  return false;
}

// ---- Projection ----
const view = (r: DataRequest, now: string, own: boolean) => ({
  id: r.id,
  type: r.type,
  requesterName: r.requesterName,
  detail: r.detail,
  proposed: r.proposed,
  status: r.status,
  rev: r.rev,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  dueAt: r.dueAt,
  overdue: isOverdue(r, now),
  verification: { ...r.verification, recordedById: undefined },
  decision: r.decision ? { ...r.decision, actorId: undefined } : null,
  hold: r.hold,
  export: r.export
    ? own
      ? {
          generatedAt: r.export.generatedAt,
          sha256: r.export.sha256,
          manifest: r.export.manifest,
          json: r.export.json,
        }
      : { generatedAt: r.export.generatedAt, sha256: r.export.sha256 }
    : null,
  events: r.events.map(({ actorId, ...e }: any) => e),
});
export function projectDataRequests(t: any, userId: string, now = new Date().toISOString()) {
  const m = t.members.find((x: any) => x.userId === userId),
    s = store(t),
    admin = isAdmin(m);
  return {
    slaDays: DATA_REQUEST_SLA_DAYS,
    checks: VERIFICATION_CHECKS,
    checksRequired: VERIFICATION_REQUIRED,
    mine: s.requests.filter((r) => r.requesterId === userId).map((r) => view(r, now, true)),
    queue: admin
      ? s.requests.map((r) => ({
          ...view(r, now, false),
          requesterId: r.requesterId,
          isOwn: r.requesterId === userId,
        }))
      : [],
    restrictedSelf: s.restricted.some((x) => x.userId === userId),
    erasureNotice:
      'Erasure is not available yet. Filing a request records it, holds it pending the retention policy, and hides your directory profile. Nothing is deleted.',
  };
}
// Hides restricted learners from the cohort directory in an already-built network projection. Reversible: data is untouched.
export function hideRestrictedFromDirectory(t: any, network: any) {
  const blocked = new Set((t.dataRequests?.restricted ?? []).map((x: any) => x.userId));
  if (!blocked.size || !network) return network;
  const profileIds = new Set(
    (t.network?.profiles ?? []).filter((p: any) => blocked.has(p.userId)).map((p: any) => p.id),
  );
  network.directory = (network.directory ?? []).filter((d: any) => !profileIds.has(d.id));
  return network;
}
// One call from projectTeam: attaches the data request projection and applies the directory restriction.
export function applyDataRequestProjection(t: any, userId: string, team: any) {
  team.dataRequests = projectDataRequests(t, userId);
  hideRestrictedFromDirectory(t, team.network);
  return team;
}
