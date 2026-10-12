// ACA-E2 enrolment and placement: ACA-US-2.5, 2.1, 2.2, 2.3, 2.4, 2.6. Synthetic people and decisions only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  L,
  T0,
  DAY,
  ORIGIN,
  world,
  textileWorld,
  joinLearners,
  refused,
  recordStandardDecisions,
  OWNER_SOURCE,
} from './harness.mjs';

test('2.5 AC1+AC3: an operator creates an organisation and invites its admin with a single-use link; both actions are audited', async () => {
  const w = await textileWorld();
  const org = await w.one('SELECT * FROM loop_orgs WHERE id=?', w.orgId);
  assert.equal(org.kind, 'association');
  const adminInvite = w.mails.find((m) => m.to === 'admin@example.test');
  assert.match(adminInvite.body, /\/loop\/join\//);
  await refused(L.acceptInvite(w.db, w.admin, w.tokenFor('admin@example.test'), {}, T0), 410); // single use
  const log = await w.raw(
    'SELECT actor, action, outcome FROM loop_audit WHERE action IN (?,?)',
    'org.create',
    'org.invite_admin',
  );
  assert.deepEqual(
    log.map((r) => [r.actor, r.action, r.outcome]),
    [
      [w.op.userId, 'org.create', 'ok'],
      [w.op.userId, 'org.invite_admin', 'ok'],
    ],
  );
  const cols = Object.keys(await w.one('SELECT * FROM loop_audit LIMIT 1'));
  assert.deepEqual(
    cols,
    ['id', 'at', 'actor', 'org_id', 'action', 'target', 'outcome'],
    'audit holds who, what, when and outcome only',
  );
});

test('2.5 AC2: a non-operator cannot create an organisation or grant the admin role; the attempt is audited', async () => {
  const w = await textileWorld();
  await refused(L.createOrg(w.db, w.admin, { kind: 'association', name: 'X', sector: 'textile' }, T0));
  await refused(
    L.inviteStaff(
      w.db,
      w.admin,
      w.orgId,
      { email: 'x@example.test', name: 'X', role: 'admin' },
      w.send,
      ORIGIN,
      T0,
    ),
  );
  const refusals = await w.raw(
    `SELECT action FROM loop_audit WHERE outcome='refused' AND actor=?`,
    w.admin.userId,
  );
  assert.deepEqual(refusals.map((r) => r.action).sort(), ['org.create', 'org.invite_admin']);
});

test('2.5: schools, universities and institutes need a signed agreement reference', async () => {
  const w = await textileWorld();
  await refused(L.createOrg(w.db, w.op, { kind: 'school', name: 'S', sector: 'education' }, T0));
  const ok = await L.createOrg(
    w.db,
    w.op,
    { kind: 'school', name: 'S', sector: 'education', agreementRef: 'Signed MoU (synthetic)' },
    T0,
  );
  assert.ok(ok.id);
});

test('2.1 AC1+AC2: a list is validated; valid members are invited, bad rows are shown with reasons and not invited', async () => {
  const w = await textileWorld();
  const list =
    'name,email,role,phone\nAsha Rao,asha@example.test,accountant\nBad Email,not-an-email,owner\n,missing@example.test,owner\nRavi K,ravi@example.test,merchandiser,+91 98765 43210\nDup,ASHA@example.test,owner\nNo Role,norole@example.test,';
  const r = await L.enrolCohort(w.db, w.admin, w.cohortId, { list }, w.send, ORIGIN, T0);
  assert.equal(r.invited, 2);
  assert.deepEqual(
    r.problems.map((p) => [p.line, p.reason]),
    [
      [3, 'Email is missing or not valid'],
      [4, 'Name is missing'],
      [6, 'Duplicate of line 2'],
      [7, 'Role is missing'],
    ],
  );
  const roster = await L.cohortRoster(w.db, w.admin, w.cohortId, T0);
  assert.deepEqual(
    roster.members.map((m) => [m.email, m.status]),
    [
      ['asha@example.test', 'invited'],
      ['ravi@example.test', 'invited'],
    ],
  );
  assert.equal(w.mails.filter((m) => m.to === 'norole@example.test').length, 0);
  const again = await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    { list: 'Asha Rao,asha@example.test,accountant' },
    w.send,
    ORIGIN,
    T0,
  );
  assert.deepEqual(
    again.problems.map((p) => p.reason),
    ['Already in this cohort'],
  );
});

test('2.1 AC3: an admin of association A cannot view or enrol into association B; refused and logged', async () => {
  const w = await textileWorld();
  const { id: orgB } = await L.createOrg(
    w.db,
    w.op,
    { kind: 'association', name: 'Other', sector: 'textile' },
    T0,
  );
  await L.inviteStaff(
    w.db,
    w.op,
    orgB,
    { email: 'adminb@example.test', name: 'B admin', role: 'admin' },
    w.send,
    ORIGIN,
    T0,
  );
  const adminB = await w.user('adminb@example.test');
  await L.acceptInvite(w.db, adminB, w.tokenFor('adminb@example.test'), {}, T0);
  await refused(L.cohortRoster(w.db, adminB, w.cohortId, T0));
  await refused(
    L.enrolCohort(w.db, adminB, w.cohortId, { list: 'X,x@example.test,owner' }, w.send, ORIGIN, T0),
  );
  const log = await w.raw(
    `SELECT action, org_id FROM loop_audit WHERE outcome='refused' AND actor=?`,
    adminB.userId,
  );
  assert.deepEqual(
    log.map((r) => r.action),
    ['cohort.view', 'cohort.enrol'],
  );
  assert.equal(w.mails.filter((m) => m.to === 'x@example.test').length, 0);
});

test('2.2 AC1: the invite shows the approved notice; choices are stored with notice version and time', async () => {
  const w = await textileWorld();
  await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    { list: 'Asha Rao,asha@example.test,accountant,+919876543210' },
    w.send,
    ORIGIN,
    T0,
  );
  const token = w.tokenFor('asha@example.test');
  const view = await L.openInvite(w.db, token, T0);
  assert.equal(view.notice.version, 'synthetic-notice-1');
  assert.equal(view.learner, true);
  const asha = await w.user('asha@example.test');
  const { memberId } = await L.acceptInvite(
    w.db,
    asha,
    token,
    { adult: true, consents: { core: true, reminder_whatsapp: true } },
    T0 + 1000,
  );
  const c = await L.currentConsents(w.db, memberId);
  assert.equal(c.core.granted, true);
  assert.equal(c.reminder_whatsapp.granted, true);
  assert.equal(c.reminder_sms.granted, false);
  assert.equal(c.core.noticeVersion, 'synthetic-notice-1');
  assert.equal(c.core.at, new Date(T0 + 1000).toISOString());
});

test('2.2: joining waits for the owner-approved notice; core consent is required; the invite email must match', async () => {
  const w2 = world(); // a world with no decisions at all
  const owner = await w2.user('o@example.test');
  await w2.db.prepare(`INSERT INTO loop_operators VALUES(?, 'owner','t','t')`).bind(owner.userId).run();
  const { id: org } = await L.createOrg(
    w2.db,
    owner,
    { kind: 'association', name: 'A', sector: 'textile' },
    T0,
  );
  await L.inviteStaff(
    w2.db,
    owner,
    org,
    { email: 'ad@example.test', name: 'Ad', role: 'admin' },
    w2.send,
    ORIGIN,
    T0,
  );
  const ad = await w2.user('ad@example.test');
  await L.acceptInvite(w2.db, ad, w2.tokenFor('ad@example.test'), {}, T0);
  const { id: coh } = await L.createCohort(w2.db, ad, org, { name: 'C' }, T0);
  await L.enrolCohort(w2.db, ad, coh, { list: 'L One,l1@example.test,owner' }, w2.send, ORIGIN, T0);
  await refused(L.openInvite(w2.db, w2.tokenFor('l1@example.test'), T0), 409); // no approved notice yet: waiting for the owner
  const w3 = await textileWorld();
  await L.enrolCohort(
    w3.db,
    w3.admin,
    w3.cohortId,
    { list: 'L One,l1@example.test,owner' },
    w3.send,
    ORIGIN,
    T0,
  );
  const t = w3.tokenFor('l1@example.test');
  await refused(
    L.acceptInvite(
      w3.db,
      await w3.user('someone@example.test'),
      t,
      { adult: true, consents: { core: true } },
      T0,
    ),
  );
  await refused(
    L.acceptInvite(w3.db, await w3.user('l1@example.test'), t, { adult: true, consents: {} }, T0),
    400,
  );
  const ok = await L.acceptInvite(
    w3.db,
    await w3.user('l1@example.test'),
    t,
    { adult: true, consents: { core: true } },
    T0,
  );
  assert.ok(ok.memberId);
});

test('2.2 AC2+AC3: withdrawing WhatsApp is recorded and removes the phone number when no phone channel remains', async () => {
  const w = await textileWorld();
  await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    {
      list: 'Asha Rao,asha@example.test,accountant,+919876543210\nRavi,ravi@example.test,owner,+919812345678',
    },
    w.send,
    ORIGIN,
    T0,
  );
  const asha = await w.user('asha@example.test'),
    ravi = await w.user('ravi@example.test');
  const a = await L.acceptInvite(
    w.db,
    asha,
    w.tokenFor('asha@example.test'),
    { adult: true, consents: { core: true, reminder_whatsapp: true } },
    T0,
  );
  const r = await L.acceptInvite(
    w.db,
    ravi,
    w.tokenFor('ravi@example.test'),
    { adult: true, consents: { core: true, reminder_email: true } },
    T0,
  );
  assert.equal(
    (await w.one('SELECT phone FROM loop_members WHERE id=?', r.memberId)).phone,
    null,
    'no phone kept without a phone channel',
  );
  assert.equal((await w.one('SELECT phone FROM loop_members WHERE id=?', a.memberId)).phone, '+919876543210');
  await L.setConsent(w.db, asha, a.memberId, 'reminder_whatsapp', false, {}, T0 + DAY);
  assert.equal(await L.hasConsent(w.db, a.memberId, 'reminder_whatsapp'), false);
  assert.equal((await w.one('SELECT phone FROM loop_members WHERE id=?', a.memberId)).phone, null);
  const hist = await w.raw(
    `SELECT granted FROM loop_consents WHERE member_id=? AND purpose='reminder_whatsapp' ORDER BY id`,
    a.memberId,
  );
  assert.deepEqual(
    hist.map((h) => h.granted),
    [1, 0],
    'withdrawal recorded, history kept',
  );
  await refused(L.setConsent(w.db, ravi, a.memberId, 'reminder_email', true, {}, T0)); // only your own
});

test('2.2 AC4: someone under 18 cannot join; nothing about them is kept and no account is created', async () => {
  const w = await textileWorld();
  await L.enrolCohort(
    w.db,
    w.admin,
    w.cohortId,
    { list: 'Young,young@example.test,helper,+919800000000' },
    w.send,
    ORIGIN,
    T0,
  );
  const users = (await w.one('SELECT count(*) n FROM academy_users')).n;
  await L.declineUnder18(w.db, w.tokenFor('young@example.test'), T0);
  assert.equal((await w.one(`SELECT count(*) n FROM loop_members WHERE email='young@example.test'`)).n, 0);
  assert.equal(
    (await w.one('SELECT count(*) n FROM loop_invites WHERE member_id NOT IN (SELECT id FROM loop_members)'))
      .n,
    0,
  );
  assert.equal((await w.one('SELECT count(*) n FROM academy_users')).n, users, 'no account');
  const log = await w.raw(`SELECT actor, target FROM loop_audit WHERE action='join.refused_under_18'`);
  assert.deepEqual(log, [{ actor: 'invitee', target: null }]);
  assert.ok(!JSON.stringify(await w.raw('SELECT * FROM loop_audit')).includes('young'));
});

test('2.3: placement on the owner-defined instrument gives a band; a facilitator can change it on request, logged; grouping uses level not job title', async () => {
  const w = await textileWorld();
  const [a, b] = await joinLearners(w, 2, {
    placeAnswers: (i) => (i === 1 ? { q1: 'a', q2: 'a' } : { q1: 'c', q2: 'b' }),
  });
  assert.equal((await L.currentLevel(w.db, a.memberId)).level, 'L1');
  assert.equal((await L.currentLevel(w.db, b.memberId)).level, 'L3');
  const qs = await L.placementQuestions(w.db, a, a.memberId, T0);
  assert.ok(!JSON.stringify(qs).includes('score'), 'scores never reach the learner');
  await L.requestLevelChange(w.db, a, a.memberId, 'I use AI daily for invoices', T0);
  const open = await L.openLevelRequests(w.db, w.facilitator, w.orgId, T0);
  assert.equal(open.length, 1);
  await refused(L.resolveLevelRequest(w.db, a, open[0].id, { level: 'L3', reason: 'x' }, T0));
  const r = await L.resolveLevelRequest(
    w.db,
    w.facilitator,
    open[0].id,
    { level: 'L2', reason: 'Reviewed placement answers with learner' },
    T0,
  );
  assert.deepEqual(r, { level: 'L2', changed: true });
  assert.equal((await L.currentLevel(w.db, a.memberId)).level, 'L2');
  assert.equal(await L.startingLevel(w.db, a.memberId), 'L1', 'starting level stays the placement result');
  const groups = await L.learnersByLevel(w.db, w.cohortId);
  assert.deepEqual([...groups.keys()].sort(), ['L2', 'L3']);
  assert.ok(
    (await w.raw(`SELECT * FROM loop_audit WHERE action='level.resolve' AND outcome='ok'`)).length === 1,
  );
});

test('2.3: without the owner-approved instrument, placement waits (409) instead of using made-up bands', async () => {
  const w = await textileWorld();
  const [a] = await joinLearners(w, 1, { placeAnswers: null });
  await w.db.prepare(`DELETE FROM loop_decisions WHERE key='placement.instrument'`).run();
  await refused(L.placementQuestions(w.db, a, a.memberId, T0), 409);
});

test('2.4: without a recorded agreement everyone starts together; with one, groups get dates and the same access', async () => {
  const w = await textileWorld();
  const people = await joinLearners(w, 6);
  let r = await L.setupStartGroups(w.db, w.admin, w.cohortId, T0);
  assert.deepEqual(r, { staggered: false, groups: [] });
  assert.equal(
    (
      await w.one(
        `SELECT count(*) n FROM loop_members WHERE cohort_id=? AND start_group IS NOT NULL`,
        w.cohortId,
      )
    ).n,
    0,
  );
  await refused(L.recordDecision(w.db, w.admin, 'staggered.agreement', w.cohortId, {}, 'x', T0)); // only the owner records agreements
  await L.recordDecision(
    w.db,
    w.owner,
    'staggered.agreement',
    w.cohortId,
    {
      agreementRef: 'synthetic',
      groups: [
        { label: 'A', start: '2026-11-02' },
        { label: 'B', start: '2026-11-30' },
      ],
    },
    OWNER_SOURCE,
    T0,
  );
  r = await L.setupStartGroups(w.db, w.admin, w.cohortId, T0);
  assert.equal(r.staggered, true);
  const groups = await w.raw(
    `SELECT start_group g, count(*) n FROM loop_members WHERE cohort_id=? AND role='learner' GROUP BY start_group`,
    w.cohortId,
  );
  assert.equal(
    groups.reduce((s, g) => s + g.n, 0),
    6,
  );
  assert.ok(groups.every((g) => ['A', 'B'].includes(g.g)));
  const m = await L.memberById(w.db, people[0].memberId);
  assert.ok(['2026-11-02', '2026-11-30'].includes(await L.startDateOf(w.db, m)));
});

test('2.6: access ends one year after the workshop, a notice is due inside the owner window, and ended access refuses new cycles', async () => {
  const w = await textileWorld({ workshopDate: '2026-11-02' });
  const [a] = await joinLearners(w, 1);
  const m = await L.memberById(w.db, a.memberId);
  const s = await L.accessStatus(w.db, m, T0);
  assert.equal(s.ends, '2027-11-02');
  assert.equal(s.active, true);
  assert.equal(s.endingSoon, false);
  const soon = await L.accessStatus(w.db, m, Date.parse('2027-10-10T00:00:00Z'));
  assert.equal(soon.endingSoon, true);
  assert.equal(soon.daysLeft, 23);
  await refused(L.requireActiveAccess(w.db, m, Date.parse('2027-11-02T06:00:00Z')));
});
