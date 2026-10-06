// Demo overview page: the whole workload of the DEMO workspace on one screen.
// Pure read-only. Every number is derived from GET /api/teams?id=<teamId> as
// different fictional identities (the same projection each role sees in the app).
// No external fonts, scripts or network; every interpolated string is escaped.

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'};
const esc = (v, max = 200) => String(v ?? '').slice(0, max).replace(/[&<>"'`]/g, c => ESC[c]);
const num = v => (Number.isFinite(v) ? v : 0);
const arr = v => (Array.isArray(v) ? v : []);
const DAY = 86400000;
const ROLES = ['admin', 'facilitator', 'assessor', 'reviewer', 'moderator', 'learner'];

const STAGES = [
  ['notStarted', 'Not started', 'Enrolled, no lesson completed yet'],
  ['lessons', 'In lessons', 'At least one lesson completed, nothing submitted'],
  ['awaiting', 'Awaiting review', 'Practical submitted, no decision yet'],
  ['passed', 'Passed', 'Active nonaccredited practice record'],
  ['retry', 'Needs retry', 'Latest decision was not a pass'],
  ['appealed', 'Appealed', 'An appeal is open'],
  ['withdrawn', 'Withdrawn', 'Learner left the cohort'],
];
const zeroStages = () => Object.fromEntries(STAGES.map(s => [s[0], 0]));

// requirement id -> wording from docs/product-specifications/requirements-register.csv
const PROOFS = [
  ['Learners by stage', ['BR-41', 'BR-28'], 'Learner, programme and organisation reporting; participation and competence stay distinct.'],
  ['Cohort capacity', ['BR-38', 'BR-42'], 'Organisation administration; enrolment and progress against a seat limit.'],
  ['Review queue', ['BR-26', 'BR-39'], 'Human review of professional judgment; reviewers are scoped and independent of the learner and original assessor.'],
  ['Appeals', ['BR-27'], 'Retries, accommodations and appeals resolved by someone other than the original assessor.'],
  ['Reports and moderation', ['BR-33', 'BR-32'], 'Reporting, moderation and escalation inside programme discussion spaces.'],
  ['Support requests', ['BR-34'], 'Peer and facilitator support, with a handler who is independent of the requester.'],
  ['Sessions', ['BR-37'], 'Events and ongoing engagement with RSVP and recorded attendance.'],
  ['Role matrix', ['BR-38', 'BR-39'], 'Roles and cohort scopes administered per workspace; workspaces stay separated.'],
  ['Owner actions', ['BR-38', 'BR-40'], 'Owner actions are recorded in an activity log.'],
  ['Recovery and assisted onboarding', ['BR-04'], 'Approved recovery returns the learner to a valid account.'],
  ['Feedback and remedial learning', ['BR-15'], 'Gaps have actionable improvement routes.'],
  ['Assessment methods', ['BR-24'], 'Method matches the competency claim.'],
  ['Verifiable credentials and lifecycle', ['BR-29', 'BR-30'], 'Unique credential, controlled verification, and suspension or revocation recorded.'],
  ['Escalation', ['BR-33'], 'Operators can respond within a defined scope.'],
  ['Programme reporting', ['BR-41'], 'Defined metrics and permissioned data.'],
  ['Partner and permissioned sharing', ['BR-42', 'BR-43'], 'The partner gets only authorised information.'],
  ['Data requests', ['BR-44'], 'Requests follow a documented, verified process.'],
  ['Significant action audit', ['BR-46'], 'Content, permission, assessment and credential actions are traceable.'],
];

function safeUrl(u) {
  try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch { return ''; }
}
const ageDays = (iso, now) => { const t = Date.parse(iso); return Number.isFinite(t) && t <= now ? Math.floor((now - t) / DAY) : null; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
const fmtDate = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'date unknown'; };

async function safe(fetchAs, key, path, gaps, what) {
  if (!key) { gaps.push(`${what}: no such demo identity`); return null; }
  try {
    const r = await fetchAs(key, path);
    if (!r || typeof r !== 'object' || (r.error && !r.team)) { gaps.push(`${what}: ${String(r?.error || 'empty response').slice(0, 120)}`); return null; }
    return r;
  } catch { gaps.push(`${what}: request failed`); return null; }
}

function pickKeys(identities) {
  const ids = arr(identities).filter(i => i && typeof i.key === 'string');
  const by = (prefix, role) => {
    const named = ids.filter(i => i.key === prefix || i.key.startsWith(prefix + '-'));
    return (named.length ? named : ids.filter(i => i.role === role)).map(i => i.key);
  };
  return {admin: by('admin', 'admin')[0] || null, facilitators: by('facilitator', 'facilitator'), moderator: by('moderator', 'moderator')[0] || null, learners: by('learner', 'learner'), assessors: ids.filter(i => i.key.startsWith('assessor')).map(i => i.key), personal: ids.some(i => i.key === 'personal-learner') ? 'personal-learner' : null};
}

const ACC_LABEL = {'extra-time': 'Extra time', 'alternative-format': 'Alternative format', 'assistive-technology': 'Assistive technology', 'human-scribe': 'Human scribe', other: 'Other'};
const METHODS = [['practical', 'Practical evidence'], ['observed', 'Observed task'], ['oral', 'Oral explanation']];
const CRED_STATUS = ['active', 'suspended', 'revoked', 'expired'];
const DR_STATUS = [['received', 'Received'], ['verified', 'Verified'], ['verification-failed', 'Verification failed'], ['held', 'Held (erasure)'], ['completed', 'Completed'], ['declined', 'Declined'], ['withdrawn', 'Withdrawn']];
const SEVERITIES = ['safeguarding', 'high', 'medium', 'low'];
const verifyPath = tok => (typeof tok === 'string' && /^acv_[A-Za-z0-9_-]{32}$/.test(tok) ? `/verify/${tok}` : '');

// What is dummy, partial or external. Static on purpose: this strip must not depend on what a read returned.
const HONESTY = [
  ['Dummy, working end to end', 'Credential issuer (fixed public demo key, not a certifying body, DEMO / not accredited); identity checks for recovery and data requests (a synthetic two-of-three tick, no proofing service); the partner registry (fictional, loopback only, HMAC with a published demo secret); every person, email, cohort and post.'],
  ['Cannot be shown overdue', 'Data requests carry a 30-day target and escalations 4 to 168 hours, both stamped by the server clock when filed. Nothing in the API accepts a past timestamp, so the overdue states are not seeded; they are exercised by unit tests only. Counts here read 0 overdue.'],
  ['Recorded, not enforced', 'Erasure is only recorded and held pending a retention policy, nothing is deleted. Escalation targets are internal and promise nothing to reporters. Safeguarding stays inside the workspace; no report leaves it.'],
  ['Not built or external', 'Real credential issuer and public trust registry; real partner transport and identity; email, SMS or any message delivery (recovery, invitations, notices are in-app only); payments and sponsored access; the in-lesson AI assistant; a support desk with a staffed response time.'],
  ['Draft or not default', 'Content edition 0.2 and the Hindi draft exist as drafts and are not the default edition; catalogue facets, recommendations and the pre-enrolment view are computed in the app and need no seeded data. Draft content, nonaccredited practice records.'],
  ['Known gap', 'The audit viewer names only the original command types. Escalations, data requests, recovery, accommodations and credential lifecycle are logged with type “other”, so the audit panel above can count them only as a group.'],
];

export async function gather({fetchAs, identities, teamId, now = Date.now()}) {
  const gaps = [], keys = pickKeys(identities), path = `/api/teams?id=${encodeURIComponent(teamId ?? '')}`;
  const [admin, moderator, ...rest] = await Promise.all([
    safe(fetchAs, keys.admin, path, gaps, 'Owner view'),
    safe(fetchAs, keys.moderator, path, gaps, 'Moderator view'),
    ...keys.facilitators.map(k => safe(fetchAs, k, path, gaps, `Facilitator view (${k})`)),
    ...keys.learners.map(k => safe(fetchAs, k, path, gaps, `Learner view (${k})`)),
  ]);
  const facs = rest.slice(0, keys.facilitators.length).filter(Boolean), learnerViews = rest.slice(keys.facilitators.length).filter(Boolean);
  if (!keys.learners.length) gaps.push('Learner views: no learner identities, so failed attempts (needs retry) cannot be shown');

  const t = admin?.team ?? facs[0]?.team ?? moderator?.team ?? null;
  const workspaceName = t?.name || 'DEMO workspace';

  const cohortMap = new Map();
  for (const src of [admin, ...facs, moderator]) for (const c of arr(src?.team?.cohorts)) if (c && typeof c.id === 'string' && !cohortMap.has(c.id) && (src === admin || c.canHost || src === moderator)) cohortMap.set(c.id, c);
  const cohorts = [...cohortMap.values()];
  const cname = id => cohortMap.get(id)?.title || 'Unknown cohort';

  // enrolments: summaries (owner sees all, facilitator only scoped cohorts), de-duplicated
  const sums = new Map();
  for (const src of [admin, ...facs]) for (const s of arr(src?.team?.summaries)) if (s && s.learnerId) sums.set(s.learnerId + '|' + s.cohortId + '|' + s.programId, s);
  // learners' own histories add failed attempts and resolved appeals
  const own = new Map();
  for (const v of learnerViews) for (const e of arr(v.state?.enrollments)) own.set((v.team?.currentUserId || '') + '|' + e.cohortId + '|' + e.programId, e);
  const stageCounts = new Map(cohorts.map(c => [c.id, zeroStages()]));
  let retryUnknown = 0, resolvedAppeals = 0, totalAppealsSeen = 0;
  for (const [k, s] of sums) {
    if (!stageCounts.has(s.cohortId)) stageCounts.set(s.cohortId, zeroStages());
    const e = own.get(k), row = stageCounts.get(s.cohortId), last = arr(e?.attempts).at(-1);
    let stage;
    if (s.status === 'Withdrawn') stage = 'withdrawn';
    else if (s.hasOpenAppeal) stage = 'appealed';
    else if (s.hasPendingAssessment) stage = 'awaiting';
    else if (s.practiceRecordStatus === 'active' || s.status === 'Practice completed') stage = 'passed';
    else if (last?.decision && last.decision.passed === false) stage = 'retry';
    else if (num(s.completedLessons) > 0) stage = 'lessons';
    else stage = 'notStarted';
    if (!e && stage !== 'withdrawn' && stage !== 'passed') retryUnknown++;
    row[stage]++;
  }
  for (const e of own.values()) for (const a of arr(e.appeals)) { totalAppealsSeen++; if (a.status && a.status !== 'open') resolvedAppeals++; }

  // review queue: owner sees every pending item; staff see only what is assigned to them
  const memberName = new Map(arr(admin?.team?.members).map(m => [m.userId, m.name]));
  let queue = arr(admin?.team?.pending).map(q => ({kind: q.kind, cohortId: q.cohortId, learner: q.learnerName || 'Learner', createdAt: q.createdAt, assignedTo: q.assignedTo ? (memberName.get(q.assignedTo) || 'Staff member') : null, eligible: arr(q.eligibleStaff).length}));
  const queueScope = admin ? 'whole workspace' : 'only reviews assigned to the staff identities available';
  if (!admin) {
    const seen = new Set();
    for (const f of facs) for (const q of arr(f.team?.assigned)) { const id = q.kind + q.targetId; if (!seen.has(id)) { seen.add(id); queue.push({kind: q.kind, cohortId: q.cohortId, learner: q.learnerName || 'Learner', createdAt: q.createdAt, assignedTo: 'Assigned staff', eligible: null}); } }
  }
  queue = queue.map(q => ({...q, age: ageDays(q.createdAt, now)})).sort((a, b) => (b.age ?? -1) - (a.age ?? -1));

  const supportSrc = admin?.team?.support ?? facs[0]?.team?.support ?? null;
  const support = arr(supportSrc?.queue).filter(r => r.status === 'open').map(r => ({category: r.category, cohort: r.cohortTitle || 'Workspace', age: ageDays(r.createdAt, now), handler: r.handlerName, subject: r.subject}));

  // sessions: only the host's projection carries registrations and attendance
  const sessMap = new Map();
  for (const src of [admin, ...facs, moderator]) for (const s of arr(src?.team?.network?.sessions)) { const prev = sessMap.get(s.id); if (!prev || (!prev.registrations && s.registrations)) sessMap.set(s.id, s); }
  const sessions = [...sessMap.values()].map(s => {
    const reg = Array.isArray(s.registrations) ? s.registrations : null;
    return {title: s.title, cohort: cname(s.cohortId), startsAt: s.startsAt, status: s.status, capacity: num(s.capacity), going: num(s.occupied), host: s.hostName, hostOk: s.hostAvailable !== false,
      attended: reg ? reg.filter(r => r.attendance?.status === 'attended').length : null, absent: reg ? reg.filter(r => r.attendance?.status === 'absent').length : null, unrecorded: reg ? reg.filter(r => !r.attendance).length : null};
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  // community: a moderator sees every post and report in scope; the owner only visible posts
  const posts = arr((moderator ?? admin)?.state?.posts);
  const community = {posts: posts.length, byStatus: {visible: 0, pending: 0, hidden: 0}, replies: 0, repliesPending: 0, reportsOpen: 0, reportsResolved: 0, actions: arr(moderator?.team?.moderationHistory).length, full: !!moderator};
  for (const p of posts) { if (p.status in community.byStatus) community.byStatus[p.status]++; for (const r of arr(p.replies)) { community.replies++; if (r.status === 'pending') community.repliesPending++; } }
  for (const r of arr(moderator?.state?.reports)) r.status === 'open' ? community.reportsOpen++ : community.reportsResolved++;

  const members = arr(admin?.team?.members).map(m => ({name: m.name, roles: arr(m.roles), scopes: arr(m.scopes).map(cname), active: m.active !== false}));
  const activity = arr(admin?.team?.activity).slice(-8).reverse().map(a => ({actor: a.actorName, action: a.action, createdAt: a.createdAt}));
  const invites = {active: 0, accepted: 0, revoked: 0};
  for (const i of arr(admin?.team?.invites)) if (i.status in invites) invites[i.status]++;

  // ---- newer features. Each block degrades to "no data" when its view was not readable. ----
  const [assessorViews, personalView] = await Promise.all([
    Promise.all(keys.assessors.map(k => safe(fetchAs, k, path, gaps, `Assessor view (${k})`))),
    keys.personal ? safe(fetchAs, keys.personal, '/api/partner/links', gaps, 'Partner link view') : Promise.resolve(null),
  ]);
  const deciders = [...facs, ...assessorViews.filter(Boolean)];
  const idLabel = new Map(arr(identities).map(i => [i.id, i.key]));

  // BR-33 escalations (owner sees all; the moderator view is only a fallback)
  const escSrc = admin?.team?.escalations ?? moderator?.team?.escalations ?? null;
  const escalations = {seen: !!escSrc, owner: !!admin?.team?.escalations, items: arr(escSrc?.items).map(e => ({severity: e.severity, status: e.status, cohort: e.cohortTitle, post: e.postTitle, escalatedAt: e.escalatedAt, dueAt: e.dueAt, overdue: !!e.overdue, hoursOverdue: num(e.hoursOverdue), withinTarget: e.withinTarget, hid: !!e.resolution?.hidPost, slaHours: num(e.slaHours)}))};

  // BR-24 accommodations: pending from the deciders' queues, decided ones from the learners' own histories
  const pend = new Map();
  for (const v of deciders) for (const q of arr(v.team?.accommodationQueue)) for (const a of arr(q.enrollment?.accommodations)) pend.set(a.id || `${q.learnerId}|${a.type}`, {cohort: cname(q.cohortId), type: a.type, age: ageDays(a.requestedAt, now)});
  const accDecided = {approved: 0, declined: 0, requested: 0};
  const methods = {practical: 0, observed: 0, oral: 0, accommodated: 0};
  const credentials = [];
  for (const v of learnerViews) for (const e of arr(v.state?.enrollments)) {
    for (const a of arr(e.accommodations)) if (a.status in accDecided) accDecided[a.status]++;
    const decisions = [...arr(e.attempts).map(a => a.decision), ...arr(e.appeals).map(a => a.resolution)].filter(d => d && d.actor);
    for (const d of decisions) { const m = d.method in methods ? d.method : 'practical'; methods[m]++; if (arr(d.accommodationsConsidered).length) methods.accommodated++; }
    if (e.credential) credentials.push({who: idLabel.get(v.team?.currentUserId) || 'learner', label: e.credential.label, status: e.credential.status, shared: e.record ? e.record.share === true : e.credentialShare === true, path: verifyPath(e.credential.id), events: arr(e.credential.history).length, lastReason: arr(e.credential.history).at(-1)?.cause});
  }
  const shownToAssessor = new Set();
  for (const v of assessorViews.filter(Boolean)) for (const q of arr(v.team?.assigned)) if (arr(q.e?.accommodations).length) shownToAssessor.add(q.kind + q.targetId);
  const accommodations = {seen: deciders.length > 0 || learnerViews.length > 0, pending: [...pend.values()], decided: accDecided, shownToAssessor: shownToAssessor.size, methods};

  // BR-44 data requests and BR-04 recovery (owner only)
  const dq = arr(admin?.team?.dataRequests?.queue);
  const dataRequests = {seen: !!admin?.team?.dataRequests, slaDays: num(admin?.team?.dataRequests?.slaDays), byStatus: Object.fromEntries(DR_STATUS.map(s => [s[0], dq.filter(r => r.status === s[0]).length])), overdue: dq.filter(r => r.overdue).length, byType: {export: dq.filter(r => r.type === 'export').length, correction: dq.filter(r => r.type === 'correction').length, erasure: dq.filter(r => r.type === 'erasure').length}, total: dq.length};
  const rq = arr(admin?.team?.recovery?.queue);
  const recovery = {seen: !!admin?.team?.recovery, pending: rq.filter(r => r.status === 'pending').map(r => ({age: ageDays(r.createdAt, now), recoverable: r.candidate?.recoverable === true, matched: !!r.candidate, hasHints: !!(r.cohortHint || r.activityHint)})), approved: rq.filter(r => r.status === 'approved').length, declined: rq.filter(r => r.status === 'declined').length, withdrawn: rq.filter(r => r.status === 'withdrawn').length, required: num(admin?.team?.recovery?.required), assistedInvites: arr(admin?.team?.invites).filter(i => i.assisted).length, assistedActive: arr(admin?.team?.invites).filter(i => i.assisted && i.status === 'active').length};

  // BR-41 programme report rollup (owner view, small cells already suppressed by the app)
  const rollup = admin?.team?.reports ?? null;
  const reports = {seen: !!rollup, threshold: num(rollup?.suppression?.threshold) || 3, marker: String(rollup?.suppression?.marker || '<3'), rows: arr(rollup?.cohorts), total: rollup?.total ?? null};

  // BR-42/43 partner link on the personal-lab learner (reads that learner's own link view)
  const partner = {seen: !!personalView, configured: personalView?.partnerConfigured === true, links: arr(personalView?.links).filter(l => !l.unlinkedAt).map(l => ({scopes: arr(l.activeScopes), consents: arr(l.consents).length})), deliveries: arr(personalView?.deliveries).map(x => x.status)};

  // BR-46 audit counts by action type, newest 150 events at most (owner only)
  const audit = {seen: false, total: 0, byType: {}, more: false};
  if (keys.admin) {
    let before = null;
    for (let page = 0; page < 3; page++) {
      const r = await safe(fetchAs, keys.admin, `/api/teams/audit?teamId=${encodeURIComponent(teamId ?? '')}&limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`, gaps, 'Audit log');
      if (!r) break;
      audit.seen = true;
      for (const i of arr(r.items)) { audit.total++; const t = String(i.type || 'other'); audit.byType[t] = (audit.byType[t] || 0) + 1; }
      audit.more = r.nextBefore != null; if (!audit.more) break; before = r.nextBefore;
    }
  }
  audit.other = audit.byType.other || 0;

  return {workspaceName, cohorts, stageCounts, retryUnknown, resolvedAppeals, totalAppealsSeen, queue, queueScope, support, sessions, community, members, activity, invites, gaps, now, learnersTotal: sums.size, haveOwner: !!admin, escalations, accommodations, credentials, dataRequests, recovery, reports, partner, audit};
}

const cname2 = (d, id) => d.cohorts.find(c => c.id === id)?.title || 'Unknown cohort';

function stageBar(c, counts) {
  const total = STAGES.reduce((n, s) => n + counts[s[0]], 0);
  const label = STAGES.map(s => `${s[1]} ${counts[s[0]]}`).join(', ');
  const segs = STAGES.filter(s => counts[s[0]] > 0).map(s => `<span class="seg st-${s[0]}" style="flex:${counts[s[0]]}" title="${esc(s[1])}: ${counts[s[0]]}">${counts[s[0]]}</span>`).join('');
  return `<div class="bar" role="img" aria-label="${esc(c.title)}: ${esc(label)}">${total ? segs : '<span class="empty">No enrolled learners yet</span>'}</div>`;
}

function renderStages(d) {
  if (!d.cohorts.length) return '<p class="muted">No cohorts are visible to the demo identities.</p>';
  const legend = `<ul class="legend" aria-label="Stage colours">${STAGES.map(s => `<li><i class="sw st-${s[0]}"></i>${esc(s[1])}</li>`).join('')}</ul>`;
  const rows = d.cohorts.map(c => {
    const k = d.stageCounts.get(c.id) || zeroStages(), total = STAGES.reduce((n, s) => n + k[s[0]], 0);
    return `<tr><th scope="row">${esc(c.title, 100)}</th><td class="n">${total}</td>${STAGES.map(s => `<td class="n">${k[s[0]]}</td>`).join('')}</tr>`;
  }).join('');
  const bars = d.cohorts.map(c => `<div class="cohortbar"><div class="cname">${esc(c.title, 100)}</div>${stageBar(c, d.stageCounts.get(c.id) || zeroStages())}</div>`).join('');
  const note = d.retryUnknown ? `<p class="note">${d.retryUnknown} enrolment${d.retryUnknown === 1 ? '' : 's'} had no learner view available, so a failed attempt there would show as in lessons or not started.</p>` : '';
  return `${legend}${bars}<div class="scroll" role="region" aria-label="Learner counts by stage and cohort" tabindex="0"><table><thead><tr><th scope="col">Cohort</th><th scope="col" class="n">All</th>${STAGES.map(s => `<th scope="col" class="n" title="${esc(s[2])}">${esc(s[1])}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${note}`;
}

function renderCapacity(d) {
  if (!d.cohorts.length) return '<p class="muted">No cohorts to show.</p>';
  return d.cohorts.map(c => {
    const cap = num(c.capacity), occ = num(c.occupied), pct = cap ? Math.min(100, Math.round(occ / cap * 100)) : 0, full = cap > 0 && occ >= cap;
    const status = ['open', 'paused', 'closed'].includes(c.status) ? c.status : 'unknown';
    return `<div class="cap"><div class="caphead"><strong>${esc(c.title, 100)}</strong><span class="tag tag-${status}">${status}</span></div>
<svg class="gauge${full ? ' full' : ''}" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${occ} of ${cap} seats taken"><rect class="g-back" width="100" height="8"/><rect class="g-fill" width="${pct}" height="8"/></svg>
<div class="capnums"><span class="big">${occ}<small> of ${cap} seats</small></span><span>${full ? 'Full' : cap ? `${Math.max(0, cap - occ)} free` : 'No limit set'}</span></div>${c.contentOpen === false ? `<p class="note">New enrolment blocked: ${esc(c.contentNotice || 'content unavailable', 240)}</p>` : ''}</div>`;
  }).join('');
}

function renderQueue(d) {
  if (!d.queue.length) return `<p class="muted">Nothing is waiting for review${d.haveOwner ? '' : ' among the assignments visible to staff identities'}.</p>`;
  const max = Math.max(1, ...d.queue.map(q => q.age ?? 0));
  const rows = d.queue.slice(0, 12).map(q => {
    const w = Math.round(((q.age ?? 0) / max) * 100);
    const who = q.assignedTo ? esc(q.assignedTo, 80) : '<span class="warn">Not assigned</span>';
    const el = q.eligible === null ? 'n/a' : q.eligible === 0 ? '<span class="warn">none</span>' : q.eligible;
    return `<tr><td><span class="tag tag-${q.kind === 'appeal' ? 'appeal' : 'assess'}">${q.kind === 'appeal' ? 'Appeal' : 'Assessment'}</span></td><th scope="row">${esc(q.learner, 80)}<small>${esc(cname2(d, q.cohortId), 100)}</small></th><td class="agecell"><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect class="g-back" width="100" height="6"/><rect class="g-age" width="${Math.max(w, q.age === null ? 0 : 3)}" height="6"/></svg><span>${q.age === null ? 'age unknown' : plural(q.age, 'day')}</span></td><td>${who}</td><td class="n" title="Staff in scope who are not the learner and not the original assessor">${el}</td></tr>`;
  }).join('');
  const more = d.queue.length > 12 ? `<p class="note">${d.queue.length - 12} more not shown.</p>` : '';
  return `<div class="scroll" role="region" aria-label="Review queue" tabindex="0"><table><thead><tr><th scope="col">Type</th><th scope="col">Learner and cohort</th><th scope="col">Waiting</th><th scope="col">Assigned to</th><th scope="col" class="n">Independent staff</th></tr></thead><tbody>${rows}</tbody></table></div>${more}<p class="note">Scope: ${esc(d.queueScope)}. Only assigned staff who are not the learner (and, for appeals, not the original assessor) can decide.</p>`;
}

function renderOpen(d) {
  const appeals = d.queue.filter(q => q.kind === 'appeal'), oldest = appeals.reduce((m, q) => Math.max(m, q.age ?? 0), 0);
  const unhandled = d.support.filter(r => !r.handler).length;
  const stat = (n, label, sub) => `<div class="stat"><span class="big">${n}</span><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const rows = d.support.slice(0, 6).map(r => `<li><span class="tag tag-assess">${esc(r.category, 30)}</span> ${esc(r.subject || 'Support request', 120)}<small>${esc(r.cohort, 100)} · ${r.age === null ? 'age unknown' : plural(r.age, 'day') + ' open'} · ${r.handler ? 'handled by ' + esc(r.handler, 80) : '<b class="warn">no handler yet</b>'}</small></li>`).join('');
  return `<div class="stats">${stat(appeals.length, 'Open appeals', appeals.length ? `oldest ${plural(oldest, 'day')}` : d.totalAppealsSeen ? `${d.resolvedAppeals} resolved` : '')}${stat(d.community.full ? d.community.reportsOpen : 'n/a', 'Open reports', d.community.full ? `${d.community.reportsResolved} resolved` : 'moderator view missing')}${stat(d.support.length, 'Open support requests', unhandled ? `${unhandled} without a handler` : '')}</div>${rows ? `<ul class="list">${rows}</ul>` : '<p class="muted">No open support requests.</p>'}`;
}

function renderSessions(d) {
  if (!d.sessions.length) return '<p class="muted">No sessions are scheduled.</p>';
  return d.sessions.slice(0, 8).map(s => {
    const cap = s.capacity, pct = cap ? Math.min(100, Math.round(s.going / cap * 100)) : 0;
    const att = s.attended === null ? '<span class="muted">Attendance shown to the host only</span>' : `${s.attended} attended · ${s.absent} absent · ${s.unrecorded} not recorded`;
    return `<div class="sess"><div class="caphead"><strong>${esc(s.title, 120)}</strong><span class="tag tag-${s.status === 'cancelled' ? 'closed' : 'open'}">${esc(s.status || 'unknown', 20)}</span></div><small>${esc(s.cohort, 100)} · ${esc(fmtDate(s.startsAt))} · host ${esc(s.host || 'unknown', 80)}${s.hostOk ? '' : ' <b class="warn">(host no longer eligible)</b>'}</small>
<svg class="gauge" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${s.going} of ${cap} RSVPs"><rect class="g-back" width="100" height="8"/><rect class="g-fill" width="${pct}" height="8"/></svg><div class="capnums"><span><b>${s.going}</b> of ${cap} going</span><span>${att}</span></div></div>`;
  }).join('');
}

function renderMatrix(d) {
  if (!d.members.length) return '<p class="muted">The owner view is unavailable, so the role matrix cannot be built.</p>';
  // Many learner-only members would bury the staff rows: past six, fold them into one summary row.
  const plain = m => m.roles.length === 1 && m.roles[0] === 'learner' && !m.scopes.length;
  const fold = d.members.filter(plain), foldIt = fold.length > 6;
  const foldRow = foldIt ? `<tr><th scope="row">${fold.length} learners${fold.some(m => !m.active) ? ` (${fold.filter(m => !m.active).length} removed)` : ''}<small>learner role only, not scoped to any cohort</small></th>${ROLES.map(r => `<td class="c">${r === 'learner' ? '<span class="dot" aria-hidden="true"></span><span class="sr">Have the learner role</span>' : '<span class="sr">No</span>'}</td>`).join('')}<td><span class="muted">not scoped</span></td></tr>` : '';
  const rows = d.members.filter(m => !(foldIt && plain(m))).map(m => `<tr><th scope="row">${esc(m.name, 80)}${m.active ? '' : ' <span class="tag tag-closed">removed</span>'}</th>${ROLES.map(r => `<td class="c">${m.roles.includes(r) ? `<span class="dot" aria-hidden="true"></span><span class="sr">Has ${r} role</span>` : '<span class="sr">No</span>'}</td>`).join('')}<td>${m.scopes.length ? m.scopes.map(s => esc(s, 100)).join(', ') : m.roles.some(r => r !== 'learner' && r !== 'admin') ? '<span class="warn">no cohort scope</span>' : '<span class="muted">not scoped</span>'}</td></tr>`).join('');
  return `<div class="scroll" role="region" aria-label="Who holds which role" tabindex="0"><table class="matrix"><thead><tr><th scope="col">Member</th>${ROLES.map(r => `<th scope="col" class="c">${r}</th>`).join('')}<th scope="col">Cohort scope</th></tr></thead><tbody>${rows}${foldRow}</tbody></table></div><p class="note">Invitations: ${d.invites.active} active, ${d.invites.accepted} accepted, ${d.invites.revoked} revoked. Staff roles only apply inside the cohorts listed.</p>`;
}

function renderCommunity(d) {
  const c = d.community, s = (n, l) => `<div class="stat"><span class="big">${n}</span><span>${esc(l)}</span></div>`;
  return `<div class="stats">${s(c.posts, c.full ? 'Discussion posts' : 'Visible posts')}${s(c.replies, 'Replies')}${s(c.full ? c.byStatus.pending + c.repliesPending : 'n/a', 'Awaiting moderation')}${s(c.full ? c.actions : 'n/a', 'Moderation decisions')}</div><p class="note">${c.full ? `Posts: ${c.byStatus.visible} visible, ${c.byStatus.pending} pending, ${c.byStatus.hidden} hidden.` : 'Moderator view unavailable, so hidden and pending posts are not counted.'}</p>`;
}

function renderActivity(d) {
  if (!d.activity.length) return '<p class="muted">No owner actions recorded yet.</p>';
  return `<ol class="list">${d.activity.map(a => `<li><strong>${esc(a.actor || 'Owner', 80)}</strong> ${esc(String(a.action || '').replace(/-/g, ' '), 60)}<small>${esc(fmtDate(a.createdAt))}</small></li>`).join('')}</ol>`;
}

const stat = (n, label, sub, cls = '') => `<div class="stat${cls ? ' ' + cls : ''}"><span class="big">${esc(n, 12)}</span><span>${esc(label)}</span>${sub ? `<small>${esc(sub, 120)}</small>` : ''}</div>`;
const none = text => `<p class="muted">${esc(text)}</p>`;
const hrs = h => (h >= 48 ? `${Math.floor(h / 24)} days` : `${h} hours`);

function renderEscalations(d) {
  const e = d.escalations;
  if (!e.seen) return none('Escalations were not readable from the demo identities.');
  const open = e.items.filter(i => i.status === 'open'), overdue = open.filter(i => i.overdue), done = e.items.filter(i => i.status !== 'open');
  const sevOrder = s => { const n = SEVERITIES.indexOf(s); return n < 0 ? 9 : n; };
  const rows = [...open, ...done].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || sevOrder(a.severity) - sevOrder(b.severity)).slice(0, 8).map(i => {
    const state = i.status === 'open' ? (i.overdue ? `<b class="warn">Overdue by ${esc(hrs(i.hoursOverdue))}</b>` : `Due ${esc(fmtDate(i.dueAt))}`) : `${esc(i.status)}${i.hid ? ', post hidden' : ''}${i.withinTarget === true ? ', within target' : i.withinTarget === false ? ', after target' : ''}`;
    return `<tr><td><span class="tag tag-sev-${esc(i.severity, 14)}">${esc(i.severity, 14)}</span></td><th scope="row">${esc(i.post || 'Discussion post', 120)}<small>${esc(i.cohort, 100)}</small></th><td>${i.status === 'open' ? '<span class="tag tag-appeal">open</span>' : `<span class="tag tag-closed">${esc(i.status, 14)}</span>`}</td><td>${state}</td></tr>`;
  }).join('');
  return `<div class="stats">${stat(open.length, 'Open', open.length ? `${esc(open.map(i => i.severity).join(', '))}` : '', open.length ? 'hot' : '')}${stat(overdue.length, 'Overdue', 'past the internal target')}${stat(done.length, 'Decided', 'reporter told only “reviewed”')}</div>${rows ? `<div class="scroll" role="region" aria-label="Escalations" tabindex="0"><table><thead><tr><th scope="col">Severity</th><th scope="col">Post and cohort</th><th scope="col">Status</th><th scope="col">Target or outcome</th></tr></thead><tbody>${rows}</tbody></table></div>` : none('No escalations yet.')}<p class="note">Targets in hours: safeguarding 4, high 24, medium 72, low 168. Internal, not promises to reporters.${e.owner ? '' : ' Moderator view only: it lists just the escalations that moderator raised.'}</p>`;
}

function renderAccommodations(d) {
  const a = d.accommodations;
  if (!a.seen) return none('No decider or learner views were readable.');
  const rows = a.pending.slice(0, 6).map(p => `<li><span class="tag tag-assess">${esc(ACC_LABEL[p.type] || 'Accommodation', 40)}</span> ${esc(p.cohort, 100)}<small>${p.age === null ? 'age unknown' : plural(p.age, 'day') + ' waiting'} · decided by a facilitator or assessor who is not the requester</small></li>`).join('');
  const m = a.methods, mTotal = m.practical + m.observed + m.oral;
  return `<div class="stats">${stat(a.pending.length, 'Pending', 'one decider queue per cohort', a.pending.length ? 'hot' : '')}${stat(a.decided.approved, 'Approved', 'kept in the learner record')}${stat(a.decided.declined, 'Declined', 'reason retained')}${stat(a.shownToAssessor, 'Shown to assessor', 'on an assigned review')}</div>${rows ? `<ul class="list">${rows}</ul>` : none('No accommodation request is waiting.')}
<h3>Assessment methods recorded on human decisions</h3><div class="stats">${METHODS.map(x => stat(m[x[0]], x[1])).join('')}${stat(m.accommodated, 'With accommodation noted', mTotal ? `of ${mTotal} decisions` : '')}</div><p class="note">Methods change how work is shown, not the rubric, gates or pass mark. Counted from decisions the learners can read.</p>`;
}

function renderDataRequests(d) {
  const r = d.dataRequests;
  if (!r.seen) return none('Data requests are visible to the owner view only, and it was not readable.');
  const bars = DR_STATUS.filter(s => r.byStatus[s[0]] > 0).map(s => `<li><span>${esc(s[1])}</span><b>${r.byStatus[s[0]]}</b></li>`).join('');
  return `<div class="stats">${stat(r.total, 'Requests', `${r.byType.export} export · ${r.byType.correction} correction · ${r.byType.erasure} erasure`)}${stat(r.overdue, 'Overdue', `${r.slaDays || 30}-day target`, r.overdue ? 'hot' : '')}</div>${bars ? `<ul class="kv">${bars}</ul>` : none('No data requests yet.')}<p class="note">Identity checks are a synthetic two-of-three tick by an owner who is not the requester. An approved erasure is held, never deleted.</p>`;
}

function renderRecovery(d) {
  const r = d.recovery;
  if (!r.seen) return none('Recovery requests are visible to the owner view only, and it was not readable.');
  const rows = r.pending.map(p => `<li><span class="tag tag-appeal">pending</span> ${p.matched ? (p.recoverable ? 'Matches a recoverable learner account' : 'Matches an account that cannot be recovered') : 'No matching account'}<small>${p.age === null ? 'age unknown' : plural(p.age, 'day') + ' waiting'} · needs ${r.required || 2} of 3 checks to approve</small></li>`).join('');
  return `<div class="stats">${stat(r.pending.length, 'Pending', 'waiting for an owner', r.pending.length ? 'hot' : '')}${stat(r.approved, 'Approved')}${stat(r.declined, 'Declined')}${stat(r.assistedInvites, 'Assisted invitations', `${r.assistedActive} not yet accepted`)}</div>${rows ? `<ul class="list">${rows}</ul>` : none('No recovery request is waiting.')}<p class="note">Approval moves the earlier account’s learning to the new sign-in; staff and owner access is re-issued by invitation instead. No email is sent.</p>`;
}

function renderCredentials(d) {
  if (!d.credentials.length) return none('No credentials were readable from the learner views.');
  const counts = Object.fromEntries(CRED_STATUS.map(s => [s, d.credentials.filter(c => c.status === s).length]));
  const rows = d.credentials.slice(0, 10).map(c => `<tr><th scope="row"><code>${esc(c.who, 40)}</code></th><td><span class="tag tag-cred-${esc(c.status, 12)}">${esc(c.status, 12)}</span></td><td>${esc(c.label, 20)}</td><td>${c.shared ? (c.path ? `<a href="${esc(c.path)}">public page</a>` : 'on') : '<span class="muted">off</span>'}</td></tr>`).join('');
  return `<div class="stats">${CRED_STATUS.map(s => stat(counts[s], s[0].toUpperCase() + s.slice(1), '', s === 'active' ? '' : counts[s] ? 'hot' : '')).join('')}</div><div class="scroll" role="region" aria-label="Credentials" tabindex="0"><table><thead><tr><th scope="col">Learner</th><th scope="col">Status</th><th scope="col">Label</th><th scope="col">Learner shares</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">DUMMY issuer, DEMO / not accredited. A public page exists only while the learner’s share switch is on; with it off, the public link answers as if the credential did not exist. Names are demo identity keys.</p>`;
}

function renderReports(d) {
  const r = d.reports;
  if (!r.seen) return none('The programme rollup is visible to owners, facilitators and assessors, and it was not readable.');
  const cell = v => (typeof v === 'number' ? `<td class="n">${v}</td>` : v === null || v === undefined ? '<td class="n">-</td>' : `<td class="n sup" title="Fewer than ${r.threshold} people: not shown">${esc(v, 6)}</td>`);
  const rows = r.rows.map(c => `<tr><th scope="row">${esc(c.cohortTitle, 100)}</th>${['enrolled', 'active', 'submitted', 'passed', 'needsRetry', 'appeals', 'appealRate', 'medianDaysToReview'].map(k => cell(c[k])).join('')}</tr>`).join('');
  const tot = r.total ? `<tr class="tot"><th scope="row">Whole workspace</th>${['enrolled', 'active', 'submitted', 'passed', 'needsRetry', 'appeals', 'appealRate', 'medianDaysToReview'].map(k => cell(r.total[k])).join('')}</tr>` : '';
  return `<div class="scroll" role="region" aria-label="Programme report rollup" tabindex="0"><table><thead><tr><th scope="col">Cohort</th><th scope="col" class="n">Enrolled</th><th scope="col" class="n">Active</th><th scope="col" class="n">Submitted</th><th scope="col" class="n">Passed</th><th scope="col" class="n">Needs retry</th><th scope="col" class="n">Appeals</th><th scope="col" class="n">Appeal %</th><th scope="col" class="n">Median days</th></tr></thead><tbody>${rows}${tot}</tbody></table></div><p class="note">Aggregates only. Any count under ${r.threshold} is shown as “${esc(r.marker, 6)}”, in the page and in every export. Suppression is not complementary, so a total and its parts can still hint at a very small group.</p>`;
}

function renderPartner(d) {
  const p = d.partner;
  if (!p.seen) return none('The personal-lab learner view was not readable.');
  if (!p.links.length) return `${none(p.configured ? 'The dummy partner is configured, but no link was seeded.' : 'No partner link was seeded: the dummy partner address was not provided when the demo was seeded.')}<p class="note">Fictional partner registry, loopback only. Start it with scripts/demo/dummy-partner.mjs (see README-seed.md).</p>`;
  const rows = p.links.map(l => `<li><span class="tag tag-open">linked</span> granted: ${l.scopes.length ? l.scopes.map(s => esc(s, 30)).join(', ') : 'nothing right now'}<small>${l.consents} consent record${l.consents === 1 ? '' : 's'} · scopes not listed are never sent</small></li>`).join('');
  return `<ul class="list">${rows}</ul><p class="note">Deliveries: ${p.deliveries.length ? esc(p.deliveries.join(', ')) : 'none'}. Only the learner can link, grant or withdraw; the partner reads nothing beyond what is granted.</p>`;
}

function renderAudit(d) {
  const a = d.audit;
  if (!a.seen) return none('The audit log is owner-only and was not readable.');
  const entries = Object.entries(a.byType).sort((x, y) => y[1] - x[1]), max = Math.max(1, ...entries.map(e => e[1]));
  const rows = entries.slice(0, 12).map(([t, n]) => `<li class="bar2"><span>${esc(String(t).replace(/-/g, ' '), 30)}</span><svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect class="g-back" width="100" height="6"/><rect class="g-fill" width="${Math.max(2, Math.round(n / max * 100))}" height="6"/></svg><b>${n}</b></li>`).join('');
  return `<div class="stats">${stat(a.total, a.more ? 'Newest events counted' : 'Events', a.more ? 'older ones not counted' : 'whole log')}${stat(a.other, 'Logged as “other”', 'newer action types')}</div><ul class="kv2">${rows}</ul><p class="note">Actors appear only as pseudonyms in the audit viewer, never names or emails.</p>`;
}

function renderHonesty(d) {
  return `<ul class="honest">${HONESTY.filter(h => h[0] !== 'Known gap' || num(d.audit?.other) > 0).map(h => `<li><strong>${esc(h[0])}</strong>${esc(h[1], 700)}</li>`).join('')}</ul>`;
}

function hero(d) {
  const oldest = d.queue.reduce((m, q) => Math.max(m, q.age ?? 0), 0), appeals = d.queue.filter(q => q.kind === 'appeal').length, b = n => `<b>${n}</b>`;
  const reports = d.community.full ? d.community.reportsOpen : 'unknown';
  return `<p class="hero">${b(d.learnersTotal)} ${d.learnersTotal === 1 ? 'enrolment' : 'enrolments'} across ${b(d.cohorts.length)} ${d.cohorts.length === 1 ? 'cohort' : 'cohorts'}. ${b(d.queue.length)} ${d.queue.length === 1 ? 'review is' : 'reviews are'} waiting${d.queue.length ? `, the oldest for ${b(plural(oldest, 'day'))}` : ''}. ${b(appeals)} ${appeals === 1 ? 'appeal' : 'appeals'}, ${b(reports)} ${reports === 1 ? 'report' : 'reports'} and ${b(d.support.length)} support ${d.support.length === 1 ? 'request' : 'requests'} are open.</p>`;
}

function panel(id, title, ids, body, wide) {
  return `<section class="panel${wide ? ' wide' : ''}" aria-labelledby="h-${id}"><header><h2 id="h-${id}">${esc(title)}</h2><span class="ids" title="Requirement IDs this panel evidences">${ids.map(i => esc(i)).join(' ')}</span></header>${body}</section>`;
}

const CSS = `
:root{color-scheme:light dark;--bg:#e4e9ec;--paper:#f8fafb;--ink:#12202a;--mute:#4d5d69;--line:#b4c1c9;--accent:#0d4f6b;--warn:#a3360a;--ribbon:#12202a;--ribbonfg:#ffd23f;
--notStarted:#aab6bd;--lessons:#3566c9;--awaiting:#d9930a;--passed:#1b8a68;--retry:#c4410e;--appealed:#7b3fd1;--withdrawn:#76828b}
@media (prefers-color-scheme:dark){:root{--bg:#0d1419;--paper:#151f26;--ink:#e6eef2;--mute:#9fb0ba;--line:#2e3e48;--accent:#7cc7e6;--warn:#ff9a6b;--ribbon:#ffd23f;--ribbonfg:#12202a;
--notStarted:#5a6872;--lessons:#5b8df0;--awaiting:#e6a21c;--passed:#35b88f;--retry:#f07a45;--appealed:#a67af0;--withdrawn:#7f8c95}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ribbon{background:var(--ribbon);color:var(--ribbonfg);font-weight:700;letter-spacing:.02em;padding:.5rem 16px;text-align:center;border-bottom:4px solid var(--ribbonfg);font-size:.95rem}
.ribbon span{font-weight:400;display:inline-block;margin-left:.5rem}
.wrap{max-width:1240px;margin:0 auto;padding:20px 16px 48px}
header.top{display:flex;flex-wrap:wrap;gap:.5rem 2rem;justify-content:space-between;align-items:baseline;margin-bottom:.5rem}
h1{font:600 1.05rem/1.3 system-ui,sans-serif;margin:0;color:var(--mute)}h1 strong{color:var(--ink)}
.asof{font-size:.85rem;color:var(--mute)}
a{color:var(--accent)}a:focus-visible,.scroll:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.hero{font:400 clamp(1.45rem,4.2vw,2.5rem)/1.28 Georgia,"Iowan Old Style","Palatino Linotype",serif;max-width:34em;margin:.6rem 0 1.6rem;text-wrap:balance}
.hero b{font-variant-numeric:lining-nums tabular-nums;border-bottom:3px solid var(--accent);font-weight:700;padding:0 .08em}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr))}
.panel{background:var(--paper);border:1px solid var(--line);border-top:5px solid var(--ink);padding:14px 16px 16px;min-width:0}
.panel.wide{grid-column:1/-1}
.panel header{display:flex;justify-content:space-between;gap:.5rem;align-items:baseline;margin-bottom:.8rem;flex-wrap:wrap}
h2{font:700 1.2rem/1.2 Georgia,"Iowan Old Style",serif;margin:0}
.ids{font-size:.78rem;color:var(--mute);border:1px solid var(--line);padding:1px 6px;border-radius:2px}
.muted,.note,small{color:var(--mute)}.note{font-size:.85rem;margin:.6rem 0 0}small{display:block;font-size:.8rem;font-weight:400}
.warn{color:var(--warn);font-weight:600}
.scroll{overflow-x:auto;max-width:100%;position:relative}
table{border-collapse:collapse;width:100%;font-size:.9rem;font-variant-numeric:tabular-nums}
th,td{padding:.45rem .5rem;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
thead th{font-size:.78rem;color:var(--mute);font-weight:600;white-space:nowrap}
th[scope=row]{font-weight:600}.n{text-align:right}.c{text-align:center}
.matrix td.c{width:5.2rem}.dot{display:inline-block;width:.8rem;height:.8rem;border-radius:50%;background:var(--accent)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.legend{list-style:none;display:flex;flex-wrap:wrap;gap:.3rem 1rem;padding:0;margin:0 0 .8rem;font-size:.85rem}
.sw{display:inline-block;width:.85rem;height:.85rem;margin-right:.35rem;vertical-align:-.1em;border-radius:2px}
.cohortbar{margin:.5rem 0 .9rem}.cname{font-weight:600;font-size:.9rem;margin-bottom:.2rem}
.bar{display:flex;min-height:2rem;background:var(--line);overflow:hidden;border-radius:2px;gap:2px}
.seg{display:flex;align-items:center;justify-content:center;min-width:1.5rem;font-weight:700;font-size:.9rem;font-variant-numeric:tabular-nums}
.st-notStarted{background:var(--notStarted);color:#12202a}.st-lessons{background:var(--lessons);color:#fff}.st-awaiting{background:var(--awaiting);color:#12202a}.st-passed{background:var(--passed);color:#fff}.st-retry{background:var(--retry);color:#fff}.st-appealed{background:var(--appealed);color:#fff}.st-withdrawn{background:repeating-linear-gradient(135deg,var(--withdrawn) 0 4px,transparent 4px 7px);color:var(--ink)}
@media (prefers-color-scheme:dark){.st-passed,.st-appealed,.st-lessons,.st-retry{color:#0d1419}}
.empty{padding:.4rem .6rem;color:var(--mute);font-size:.85rem}
.cap,.sess{padding:.6rem 0;border-bottom:1px solid var(--line)}.cap:last-child,.sess:last-child{border-bottom:0}
.caphead{display:flex;justify-content:space-between;gap:.5rem;align-items:baseline;margin-bottom:.3rem}
.gauge{display:block;width:100%;height:.7rem;margin:.3rem 0}.g-back{fill:var(--line)}.g-fill{fill:var(--accent)}.gauge.full .g-fill{fill:var(--warn)}.g-age{fill:var(--awaiting)}
.capnums{display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;font-size:.88rem}
.big{font:700 2rem/1 Georgia,serif;font-variant-numeric:tabular-nums;display:block}.capnums .big{display:inline;font-size:1.5rem}.capnums small{display:inline;font-size:.85rem}
.tag{display:inline-block;font-size:.75rem;font-weight:600;padding:0 6px;border:1px solid currentColor;border-radius:2px;white-space:nowrap}
.tag-open{color:var(--passed)}.tag-paused{color:var(--awaiting)}.tag-closed,.tag-unknown{color:var(--mute)}.tag-appeal{color:var(--appealed)}.tag-assess{color:var(--accent)}
.agecell{min-width:7rem;font-size:.8rem}.agecell svg{display:block;width:100%;height:.4rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:12px;margin-bottom:.4rem}.stat{border-left:3px solid var(--ink);padding-left:.6rem;font-size:.85rem}
.list{list-style:none;margin:.6rem 0 0;padding:0}.list li{padding:.4rem 0;border-bottom:1px solid var(--line);font-size:.9rem}
.proves{margin-top:24px;background:var(--paper);border:1px solid var(--line);border-top:5px solid var(--accent);padding:14px 16px}
.proves ul{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))}
.proves li{font-size:.88rem}.proves strong{display:block}.proves .ids{display:inline-block;margin-bottom:.2rem;color:var(--ink)}
.gaps{margin-top:16px;border:1px dashed var(--warn);padding:10px 14px;font-size:.88rem}.gaps ul{margin:.3rem 0 0;padding-left:1.2rem}
footer{margin-top:20px;font-size:.82rem;color:var(--mute)}
h2.band{margin:28px 0 12px;font:700 1.35rem/1.2 Georgia,"Iowan Old Style",serif;border-bottom:2px solid var(--ink);padding-bottom:.3rem}
h3{font:700 .95rem/1.3 system-ui,sans-serif;margin:1rem 0 .4rem;color:var(--mute)}
.stat.hot{border-left-color:var(--warn)}.sup{color:var(--mute);font-style:italic}.tot th,.tot td{border-top:2px solid var(--ink);font-weight:700}
.tag-sev-safeguarding{color:#fff;background:var(--warn);border-color:var(--warn)}.tag-sev-high{color:var(--warn)}.tag-sev-medium{color:var(--awaiting)}.tag-sev-low{color:var(--mute)}
.tag-cred-active{color:var(--passed)}.tag-cred-suspended{color:var(--awaiting)}.tag-cred-revoked{color:var(--warn)}.tag-cred-expired{color:var(--mute)}
.panel code{font-size:.82rem}
.kv,.kv2{list-style:none;margin:.5rem 0 0;padding:0}.kv li{display:flex;justify-content:space-between;gap:1rem;padding:.3rem 0;border-bottom:1px solid var(--line);font-size:.9rem}
.bar2{display:grid;grid-template-columns:minmax(6rem,9rem) 1fr 2.2rem;gap:.6rem;align-items:center;font-size:.85rem;padding:.2rem 0}.bar2 svg{width:100%;height:.5rem}.bar2 b{text-align:right;font-variant-numeric:tabular-nums}
.honesty{margin-top:24px;background:var(--paper);border:1px solid var(--line);border-left:6px solid var(--warn);padding:14px 16px}.honest{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))}.honest li{font-size:.88rem}.honest strong{display:block;color:var(--warn)}
@media (max-width:480px){.panel{padding:12px}table{font-size:.85rem}.hero{margin-bottom:1.1rem}}
`;

export async function renderOverview({fetchAs, identities, teamId, baseUrl, now} = {}) {
  let d;
  try { d = await gather({fetchAs, identities, teamId, now: now ?? Date.now()}); }
  catch {
    d = {workspaceName: 'DEMO workspace', cohorts: [], stageCounts: new Map(), retryUnknown: 0, resolvedAppeals: 0, totalAppealsSeen: 0, queue: [], queueScope: 'none', support: [], sessions: [],
      community: {posts: 0, byStatus: {visible: 0, pending: 0, hidden: 0}, replies: 0, repliesPending: 0, reportsOpen: 0, reportsResolved: 0, actions: 0, full: false}, members: [], activity: [], invites: {active: 0, accepted: 0, revoked: 0}, gaps: ['Overview could not read the workspace'], now: Date.now(), learnersTotal: 0, haveOwner: false,
      escalations: {seen: false, owner: false, items: []}, accommodations: {seen: false, pending: [], decided: {approved: 0, declined: 0, requested: 0}, shownToAssessor: 0, methods: {practical: 0, observed: 0, oral: 0, accommodated: 0}}, credentials: [], dataRequests: {seen: false, slaDays: 30, byStatus: {}, overdue: 0, byType: {export: 0, correction: 0, erasure: 0}, total: 0}, recovery: {seen: false, pending: [], approved: 0, declined: 0, withdrawn: 0, required: 2, assistedInvites: 0, assistedActive: 0}, reports: {seen: false, threshold: 3, marker: '<3', rows: [], total: null}, partner: {seen: false, configured: false, links: [], deliveries: []}, audit: {seen: false, total: 0, byType: {}, more: false, other: 0}};
  }
  const app = safeUrl(baseUrl);
  const proofs = PROOFS.map(p => `<li><span class="ids">${p[1].map(esc).join(' ')}</span><strong>${esc(p[0])}</strong>${esc(p[2])}</li>`).join('');
  const gaps = d.gaps.length ? `<aside class="gaps" aria-label="What this page could not read"><strong>Not shown because a view was unavailable</strong><ul>${d.gaps.map(g => `<li>${esc(g, 200)}</li>`).join('')}</ul></aside>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Demo workload overview</title><style>${CSS}</style></head><body>
<div class="ribbon" role="note">DEMO — synthetic data <span>Fictional people and records, created for this local demonstration only.</span></div>
<main class="wrap">
<header class="top"><h1>Workload of <strong>${esc(d.workspaceName, 80)}</strong></h1><span class="asof">As of ${esc(fmtDate(new Date(d.now).toISOString()))}${app ? ` · <a href="${esc(app)}">Open the Academy</a>` : ''}</span></header>
${hero(d)}
<div class="grid">
${panel('stages', 'Learners by stage, per cohort', ['BR-41', 'BR-27', 'BR-28'], renderStages(d), true)}
${panel('capacity', 'Cohort capacity', ['BR-38', 'BR-42'], renderCapacity(d))}
${panel('open', 'Open appeals, reports and support', ['BR-27', 'BR-33', 'BR-34'], renderOpen(d))}
${panel('queue', 'Review queue', ['BR-26', 'BR-39'], renderQueue(d), true)}
${panel('sessions', 'Sessions: RSVP and attendance', ['BR-37'], renderSessions(d))}
${panel('community', 'Community activity', ['BR-32', 'BR-33'], renderCommunity(d))}
${panel('matrix', 'Who holds which role', ['BR-38', 'BR-39'], renderMatrix(d), true)}
${panel('activity', 'Recent owner actions', ['BR-38', 'BR-40'], renderActivity(d))}
</div>
<h2 class="band">Newer features</h2>
<div class="grid">
${panel('escalations', 'Escalations: open, overdue, resolved', ['BR-33'], renderEscalations(d), true)}
${panel('accommodations', 'Accommodations and assessment methods', ['BR-24', 'BR-27'], renderAccommodations(d))}
${panel('credentials', 'Credentials by status', ['BR-29', 'BR-30'], renderCredentials(d), true)}
${panel('requests', 'Data requests by status', ['BR-44'], renderDataRequests(d))}
${panel('recovery', 'Account recovery and assisted invitations', ['BR-04'], renderRecovery(d))}
${panel('reports', 'Programme report rollup', ['BR-41'], renderReports(d), true)}
${panel('partner', 'Partner link (dummy) and consent', ['BR-42', 'BR-43'], renderPartner(d))}
${panel('audit', 'Audit events by type', ['BR-46'], renderAudit(d))}
</div>
<section class="honesty" aria-labelledby="h-honesty"><h2 id="h-honesty">Dummy, partial or not built</h2><p class="note">Nothing below is hidden to make the demo look finished.</p>${renderHonesty(d)}</section>
<section class="proves" aria-labelledby="h-proves"><h2 id="h-proves">What this proves</h2><p class="note">Each panel is computed live from the same read API the app uses, as the people who hold those roles. IDs refer to docs/product-specifications/requirements-register.csv.</p><ul>${proofs}</ul></section>
${gaps}
<footer>Read-only view. Nothing on this page changes the workspace. Emails are never shown.</footer>
</main></body></html>`;
}
