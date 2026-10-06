import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderOverview} from './overview.mjs';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();
const HOSTILE = '<img src=x onerror=alert(1)>';

const identities = [
  {key: 'admin', label: 'Owner', role: 'admin', id: 'u-admin', email: 'admin@demo.invalid', name: 'Asha Owner'},
  {key: 'facilitator-1', label: 'Facilitator', role: 'facilitator', id: 'u-fac', email: 'fac@demo.invalid', name: 'Farid Facilitator'},
  {key: 'assessor-1', label: 'Assessor', role: 'assessor', id: 'u-ass', email: 'ass@demo.invalid', name: 'Ana Assessor'},
  {key: 'reviewer', label: 'Reviewer', role: 'reviewer', id: 'u-rev', email: 'rev@demo.invalid', name: 'Rhea Reviewer'},
  {key: 'moderator', label: 'Moderator', role: 'moderator', id: 'u-mod', email: 'secret-mod@demo.invalid', name: 'Mo Moderator'},
  {key: 'learner-1', label: 'Learner 1', role: 'learner', id: 'u-l1', email: 'l1@demo.invalid', name: HOSTILE},
  {key: 'learner-2', label: 'Learner 2', role: 'learner', id: 'u-l2', email: 'l2@demo.invalid', name: 'Lena Two'},
];

const cohorts = [
  {id: 'c1', title: 'Farm records, Autumn', programId: 'farmer-work-records', status: 'open', capacity: 6, occupied: 5, contentOpen: true, canHost: true},
  {id: 'c2', title: 'Public briefs, Winter', programId: 'public-servant-source-briefs', status: 'paused', capacity: 4, occupied: 4, contentOpen: false, contentNotice: 'Paused for content review.', canHost: true},
];
const summaries = [
  {learnerId: 'u-l1', cohortId: 'c1', programId: 'farmer-work-records', completedLessons: 0, practiceRecordStatus: null, hasOpenAppeal: false, hasPendingAssessment: false, status: 'Learning'},
  {learnerId: 'u-l2', cohortId: 'c1', programId: 'farmer-work-records', completedLessons: 3, practiceRecordStatus: null, hasOpenAppeal: false, hasPendingAssessment: false, status: 'Learning'},
  {learnerId: 'u-l3', cohortId: 'c1', programId: 'farmer-work-records', completedLessons: 5, practiceRecordStatus: null, hasOpenAppeal: false, hasPendingAssessment: true, status: 'Review pending'},
  {learnerId: 'u-l4', cohortId: 'c1', programId: 'farmer-work-records', completedLessons: 5, practiceRecordStatus: 'active', hasOpenAppeal: false, hasPendingAssessment: false, status: 'Practice completed'},
  {learnerId: 'u-l5', cohortId: 'c1', programId: 'farmer-work-records', completedLessons: 5, practiceRecordStatus: null, hasOpenAppeal: true, hasPendingAssessment: false, status: 'Appeal pending'},
  {learnerId: 'u-l6', cohortId: 'c2', programId: 'public-servant-source-briefs', completedLessons: 2, practiceRecordStatus: null, hasOpenAppeal: false, hasPendingAssessment: false, status: 'Withdrawn'},
];
const members = [
  {userId: 'u-admin', name: 'Asha Owner', email: 'admin@demo.invalid', roles: ['admin', 'learner'], scopes: [], active: true},
  {userId: 'u-fac', name: 'Farid Facilitator', email: 'fac@demo.invalid', roles: ['facilitator'], scopes: ['c1'], active: true},
  {userId: 'u-mod', name: 'Mo Moderator', email: 'secret-mod@demo.invalid', roles: ['moderator'], scopes: ['c1'], active: true},
  {userId: 'u-l1', name: HOSTILE, email: 'outsider@real-example.com', roles: ['learner'], scopes: [], active: true},
];
const pending = [
  {kind: 'assessment', targetId: 'a1', cohortId: 'c1', learnerId: 'u-l3', learnerName: 'Lena Three', createdAt: daysAgo(6), assignedTo: 'u-fac', eligibleStaff: [{userId: 'u-fac', name: 'Farid Facilitator'}]},
  {kind: 'appeal', targetId: 'p1', cohortId: 'c1', learnerId: 'u-l5', learnerName: HOSTILE, createdAt: daysAgo(2), assignedTo: null, eligibleStaff: []},
];
const adminResp = {
  revision: 7, state: {posts: [{id: 'p', status: 'visible', replies: []}], reports: []},
  team: {id: 'tw-demo', name: 'DEMO Workspace', cohorts, members, summaries, pending, invites: [{status: 'active'}, {status: 'accepted'}],
    activity: [{actorName: HOSTILE, action: 'cohort-create', createdAt: daysAgo(3)}],
    support: {queue: [{id: 's1', category: 'learning', status: 'open', cohortTitle: 'Farm records, Autumn', subject: 'Cannot open lesson', createdAt: daysAgo(4), handlerName: null}], mine: [], assigned: []},
    network: {sessions: [{id: 'n1', cohortId: 'c1', title: 'Office hours', startsAt: daysAgo(-2), endsAt: daysAgo(-2), capacity: 10, occupied: 7, status: 'scheduled', hostName: 'Farid Facilitator', hostAvailable: true}]}},
};
const facResp = {team: {...adminResp.team, summaries: summaries.filter(s => s.cohortId === 'c1'), network: {sessions: [{...adminResp.team.network.sessions[0], isHost: true, registrations: [{id: 'r1', name: 'x', attendance: {status: 'attended'}}, {id: 'r2', name: 'y', attendance: {status: 'absent'}}, {id: 'r3', name: 'z', attendance: null}]}]}}, state: {}};
const modResp = {team: {id: 'tw-demo', name: 'DEMO Workspace', cohorts, moderationHistory: [{id: 'm1'}, {id: 'm2'}]},
  state: {posts: [{id: 'p', status: 'visible', replies: [{status: 'visible'}, {status: 'pending'}]}, {id: 'q', status: 'pending', replies: []}, {id: 'h', status: 'hidden', replies: []}], reports: [{id: 'r', status: 'open'}, {id: 'r2', status: 'resolved'}, {id: 'r3', status: 'resolved'}]}};
const learnerResp = {team: {currentUserId: 'u-l1', cohorts: []}, state: {enrollments: [{cohortId: 'c1', programId: 'farmer-work-records', attempts: [{id: 'x', decision: {passed: false, score: 40}}], appeals: []}]}};

const stubFetch = async (key, path) => {
  assert.match(path, /^\/api\/teams\?id=tw-demo$/);
  if (key === 'admin') return adminResp;
  if (key === 'facilitator-1') return facResp;
  if (key === 'moderator') return modResp;
  if (key === 'learner-1') return {...learnerResp, team: {currentUserId: 'u-l1'}};
  if (key === 'learner-2') return {team: {currentUserId: 'u-l2'}, state: {enrollments: [{cohortId: 'c1', programId: 'farmer-work-records', attempts: [{id: 'y', decision: {passed: true}}], appeals: [{status: 'resolved'}]}]}};
  throw new Error('unexpected ' + key);
};
const render = (over = {}) => renderOverview({fetchAs: stubFetch, identities, teamId: 'tw-demo', baseUrl: 'http://127.0.0.1:8787/', now: NOW, ...over});
const text = html => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('renders a complete standalone page with the synthetic-data ribbon and no external references', async () => {
  const html = await render();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /DEMO — synthetic data/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /(src|href)="https?:\/\/(?!127\.0\.0\.1)/i);
  assert.doesNotMatch(html, /@import|url\(/);
});

test('shows key workload numbers', async () => {
  const t = text(await render());
  assert.match(t, /6 enrolments across 2 cohorts/);
  assert.match(t, /2 reviews are waiting, the oldest for 6 days/);
  assert.match(t, /1 appeal, 1 report and 1 support request are open/);
  assert.match(t, /5 of 6 seats/);
  assert.match(t, /4 of 4 seats/);
  assert.match(t, /Full/);
  assert.match(t, /7 of 10 going/);
  assert.match(t, /1 attended · 1 absent · 1 not recorded/);
  assert.match(t, /Posts: 1 visible, 1 pending, 1 hidden/);
  assert.match(t, /Invitations: 1 active, 1 accepted, 0 revoked/);
  assert.match(t, /Paused for content review/);
});

test('computes learner stages per cohort, including needs retry from the learner view', async () => {
  const html = await render();
  // c1: not started 0 (u-l1 failed attempt -> retry), lessons 1, awaiting 1, passed 1, retry 1, appealed 1, withdrawn 0
  assert.match(html, /Farm records, Autumn<\/th><td class="n">5<\/td><td class="n">0<\/td><td class="n">1<\/td><td class="n">1<\/td><td class="n">1<\/td><td class="n">1<\/td><td class="n">1<\/td><td class="n">0<\/td>/);
  assert.match(html, /Public briefs, Winter<\/th><td class="n">1<\/td>(<td class="n">0<\/td>){6}<td class="n">1<\/td>/);
});

test('review queue shows age, unassigned and no independent staff', async () => {
  const t = text(await render());
  assert.match(t, /6 days/);
  assert.match(t, /Not assigned/);
  assert.match(t, /none/);
});

test('maps panels to requirement IDs', async () => {
  const t = text(await render());
  for (const id of ['BR-26', 'BR-27', 'BR-33', 'BR-38', 'BR-39', 'BR-41']) assert.ok(t.includes(id), id);
  assert.match(t, /What this proves/);
});

test('escapes hostile strings and never prints emails', async () => {
  const html = await render();
  assert.ok(!html.includes(HOSTILE));
  assert.ok(!/<img/i.test(html));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('outsider@real-example.com'));
  assert.ok(!html.includes('secret-mod@demo.invalid'));
  assert.ok(!html.includes('@'.concat('demo.invalid')));
});

test('escapes hostile values in cohort titles, workspace name and base URL', async () => {
  const evil = {...adminResp, team: {...adminResp.team, name: '"><script>alert(1)</script>', cohorts: [{...cohorts[0], title: HOSTILE}]}};
  const html = await render({fetchAs: async k => (k === 'admin' ? evil : null), baseUrl: 'javascript:alert(1)'});
  assert.ok(!/<script/i.test(html) && !/<img/i.test(html));
  assert.doesNotMatch(html, /javascript:/);
  const quoted = await render({baseUrl: 'http://x.test/"onmouseover="alert(1)'});
  assert.doesNotMatch(quoted, /"onmouseover=/);
});

test('degrades gracefully with missing identities', async () => {
  const html = await renderOverview({fetchAs: stubFetch, identities: [identities[0]], teamId: 'tw-demo', baseUrl: 'http://127.0.0.1:8787', now: NOW});
  const t = text(html);
  assert.match(t, /DEMO — synthetic data/);
  assert.match(t, /Moderator view: no such demo identity/);
  assert.match(t, /Learner views: no learner identities/);
  assert.match(t, /moderator view missing/);
  assert.match(t, /Attendance shown to the host only/);
  assert.match(t, /2 reviews are waiting/);
});

test('degrades gracefully with no identities at all and with failing fetches', async () => {
  const none = await renderOverview({fetchAs: stubFetch, identities: [], teamId: 'tw-demo', now: NOW});
  assert.match(text(none), /Owner view: no such demo identity/);
  assert.match(text(none), /0 enrolments across 0 cohorts/);
  const failing = await renderOverview({fetchAs: async () => { throw new Error('boom ' + HOSTILE); }, identities, teamId: 'tw-demo', now: NOW});
  assert.match(text(failing), /request failed/);
  assert.ok(!failing.includes('boom'));
  const errored = await renderOverview({fetchAs: async () => ({error: HOSTILE}), identities, teamId: 'tw-demo', now: NOW});
  assert.ok(!errored.includes(HOSTILE));
  const nothing = await renderOverview();
  assert.match(nothing, /DEMO — synthetic data/);
});

test('handles an empty team', async () => {
  const empty = {revision: 1, state: {posts: [], reports: []}, team: {id: 'tw-demo', name: 'Empty', cohorts: [], members: [], summaries: [], pending: [], invites: [], activity: [], support: {queue: []}, network: {sessions: []}}};
  const t = text(await renderOverview({fetchAs: async () => empty, identities, teamId: 'tw-demo', now: NOW}));
  assert.match(t, /0 enrolments across 0 cohorts/);
  assert.match(t, /Nothing is waiting for review/);
  assert.match(t, /No sessions are scheduled/);
  assert.match(t, /No cohorts are visible/);
});

test('demo-script.json is well formed and uses real hash routes', () => {
  const script = JSON.parse(readFileSync(new URL('./demo-script.json', import.meta.url), 'utf8'));
  assert.ok(script.steps.length >= 8 && script.steps.length <= 10);
  const views = ['offline', 'library', 'operations', 'home', 'plan', 'support', 'programs', 'learn', 'community', 'network', 'credentials', 'connections', 'studio', 'settings', 'teams'];
  for (const s of script.steps) {
    for (const k of ['id', 'role', 'title', 'say', 'do', 'link']) assert.equal(typeof s[k], 'string', `${s.id}.${k}`);
    assert.match(s.link, /^\/#/);
    assert.ok(views.includes(s.link.slice(2).split('/')[0]), s.link);
  }
});
