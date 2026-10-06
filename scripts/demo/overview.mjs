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
  return {admin: by('admin', 'admin')[0] || null, facilitators: by('facilitator', 'facilitator'), moderator: by('moderator', 'moderator')[0] || null, learners: by('learner', 'learner')};
}

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

  return {workspaceName, cohorts, stageCounts, retryUnknown, resolvedAppeals, totalAppealsSeen, queue, queueScope, support, sessions, community, members, activity, invites, gaps, now, learnersTotal: sums.size, haveOwner: !!admin};
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
  const rows = d.members.map(m => `<tr><th scope="row">${esc(m.name, 80)}${m.active ? '' : ' <span class="tag tag-closed">removed</span>'}</th>${ROLES.map(r => `<td class="c">${m.roles.includes(r) ? `<span class="dot" aria-hidden="true"></span><span class="sr">Has ${r} role</span>` : '<span class="sr">No</span>'}</td>`).join('')}<td>${m.scopes.length ? m.scopes.map(s => esc(s, 100)).join(', ') : m.roles.some(r => r !== 'learner' && r !== 'admin') ? '<span class="warn">no cohort scope</span>' : '<span class="muted">not scoped</span>'}</td></tr>`).join('');
  return `<div class="scroll" role="region" aria-label="Who holds which role" tabindex="0"><table class="matrix"><thead><tr><th scope="col">Member</th>${ROLES.map(r => `<th scope="col" class="c">${r}</th>`).join('')}<th scope="col">Cohort scope</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">Invitations: ${d.invites.active} active, ${d.invites.accepted} accepted, ${d.invites.revoked} revoked. Staff roles only apply inside the cohorts listed.</p>`;
}

function renderCommunity(d) {
  const c = d.community, s = (n, l) => `<div class="stat"><span class="big">${n}</span><span>${esc(l)}</span></div>`;
  return `<div class="stats">${s(c.posts, c.full ? 'Discussion posts' : 'Visible posts')}${s(c.replies, 'Replies')}${s(c.full ? c.byStatus.pending + c.repliesPending : 'n/a', 'Awaiting moderation')}${s(c.full ? c.actions : 'n/a', 'Moderation decisions')}</div><p class="note">${c.full ? `Posts: ${c.byStatus.visible} visible, ${c.byStatus.pending} pending, ${c.byStatus.hidden} hidden.` : 'Moderator view unavailable, so hidden and pending posts are not counted.'}</p>`;
}

function renderActivity(d) {
  if (!d.activity.length) return '<p class="muted">No owner actions recorded yet.</p>';
  return `<ol class="list">${d.activity.map(a => `<li><strong>${esc(a.actor || 'Owner', 80)}</strong> ${esc(String(a.action || '').replace(/-/g, ' '), 60)}<small>${esc(fmtDate(a.createdAt))}</small></li>`).join('')}</ol>`;
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
.scroll{overflow-x:auto;max-width:100%}
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
@media (max-width:480px){.panel{padding:12px}table{font-size:.85rem}.hero{margin-bottom:1.1rem}}
`;

export async function renderOverview({fetchAs, identities, teamId, baseUrl, now} = {}) {
  let d;
  try { d = await gather({fetchAs, identities, teamId, now: now ?? Date.now()}); }
  catch {
    d = {workspaceName: 'DEMO workspace', cohorts: [], stageCounts: new Map(), retryUnknown: 0, resolvedAppeals: 0, totalAppealsSeen: 0, queue: [], queueScope: 'none', support: [], sessions: [],
      community: {posts: 0, byStatus: {visible: 0, pending: 0, hidden: 0}, replies: 0, repliesPending: 0, reportsOpen: 0, reportsResolved: 0, actions: 0, full: false}, members: [], activity: [], invites: {active: 0, accepted: 0, revoked: 0}, gaps: ['Overview could not read the workspace'], now: Date.now(), learnersTotal: 0, haveOwner: false};
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
<section class="proves" aria-labelledby="h-proves"><h2 id="h-proves">What this proves</h2><p class="note">Each panel is computed live from the same read API the app uses, as the people who hold those roles. IDs refer to docs/product-specifications/requirements-register.csv.</p><ul>${proofs}</ul></section>
${gaps}
<footer>Read-only view. Nothing on this page changes the workspace. Emails are never shown.</footer>
</main></body></html>`;
}
