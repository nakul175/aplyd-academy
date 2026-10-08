import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import curriculum from '../lib/curriculum.json' with { type: 'json' };
const base = 'http://127.0.0.1:8787',
  nonce = crypto.randomUUID(),
  p = curriculum.pathways[1],
  errors = [],
  name = 'UI practice pilot ' + nonce.slice(0, 6);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
async function person(role) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: {
        'oai-authenticated-user-id': 'ui-' + role + '-' + nonce,
        'oai-authenticated-user-email': role + '-' + nonce + '@academy.test',
        'oai-authenticated-user-full-name': encodeURIComponent('Fixture ' + role),
        'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
      },
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, email: role + '-' + nonce + '@academy.test' };
}
const owner = await person('owner'),
  learner = await person('learner'),
  staff = await person('assessor');
const a = owner.page,
  l = learner.page,
  s = staff.page;
await a.goto(base + '/');
await a.locator('[data-save-state="loaded"]').waitFor();
await a.getByRole('button', { name: 'Workspaces & cohorts', exact: true }).click();
await a.getByRole('button', { name: 'New workspace', exact: true }).click();
await a.getByLabel('Workspace name', { exact: true }).fill(name);
await a
  .getByLabel('What should this group be able to do better?', { exact: true })
  .fill('A synthetic adult cohort practising checked customer-work drafts and careful AI use.');
await a.getByRole('button', { name: 'Create workspace', exact: true }).click();
await a.getByRole('heading', { name, exact: true }).waitFor();
await a.locator('[data-save-state="loaded"]').waitFor();
const workspaceUrl = a.url().split('#')[0];
await a.getByRole('button', { name: 'Create cohort', exact: true }).click();
await a.getByLabel('Cohort name', { exact: true }).fill('Customer-work circle');
await a.getByLabel('Maximum learners (1–100)', { exact: true }).fill('5');
await a.getByRole('button', { name: 'Open cohort', exact: true }).click();
await a.getByRole('heading', { name: 'Customer-work circle', exact: true }).waitFor();
await a.getByRole('tab', { name: 'Invitations', exact: true }).click();
await a.getByLabel('Sign-in account email', { exact: true }).fill(learner.email);
await a.getByRole('button', { name: 'Create invitation link', exact: true }).click();
await a.getByLabel('New invitation link', { exact: true }).waitFor();
const learnerLink = await a.getByLabel('New invitation link', { exact: true }).inputValue();
await l.goto(learnerLink);
await l.getByRole('button', { name: 'Accept membership', exact: true }).click();
await l.locator('[data-save-state="loaded"]').waitFor();
await l.getByRole('heading', { name, exact: true }).waitFor();
await a.getByLabel('Sign-in account email', { exact: true }).fill(staff.email);
await a.getByRole('checkbox', { name: /^Assessor / }).check();
await a.getByRole('checkbox', { name: /^Moderator / }).check();
await a.getByRole('checkbox', { name: 'Customer-work circle', exact: true }).check();
await a.getByRole('button', { name: 'Create invitation link', exact: true }).click();
await a
  .getByText('This workspace changed. Refresh and retry; your input is still here.', { exact: true })
  .first()
  .waitFor();
if ((await a.getByLabel('Sign-in account email', { exact: true }).inputValue()) !== staff.email)
  throw new Error('Invitation input lost on conflict');
await a.getByRole('button', { name: 'Create invitation link', exact: true }).click();
await a.waitForFunction(
  (previous) => document.getElementById('invitation-link')?.value !== previous,
  learnerLink,
);
const staffLink = await a.getByLabel('New invitation link', { exact: true }).inputValue();
if (staffLink === learnerLink) throw new Error('Staff invitation link did not update');
await s.goto(staffLink);
await s.getByRole('button', { name: 'Accept membership', exact: true }).click();
await s.locator('[data-save-state="loaded"]').waitFor();
await a.reload();
await a.locator('[data-save-state="loaded"]').waitFor();
await a.getByRole('tab', { name: 'Members', exact: true }).click();
const ownerRow = a.getByRole('row').filter({ hasText: owner.email });
await ownerRow.getByRole('button', { name: 'Edit access', exact: true }).click();
await a
  .getByRole('dialog')
  .getByRole('checkbox', { name: /^Appeal reviewer / })
  .check();
await a.getByRole('dialog').getByRole('checkbox', { name: 'Customer-work circle', exact: true }).check();
await a.getByRole('button', { name: 'Save membership permissions', exact: true }).click();
await a.getByText('Membership updated', { exact: true }).waitFor();
await l.reload();
await l.locator('[data-save-state="loaded"]').waitFor();
await l.getByRole('button', { name: 'Enroll in this cohort', exact: true }).click();
await l.getByRole('button', { name: 'Open practical assessment', exact: true }).waitFor();
for (let i = 0; i < 3; i++) {
  const lesson = p.lessons[i];
  await l.getByRole('heading', { name: lesson.title, exact: true }).waitFor();
  await l
    .getByLabel('Your corrected work and reasoning', { exact: true })
    .fill(
      'I checked the fictional packet, removed unsupported promises and retained the human approval route.',
    );
  for (const q of lesson.quiz)
    await l
      .getByRole('radiogroup', { name: q.question, exact: true })
      .getByRole('radio', { name: q.options[q.correctOptionIndex], exact: true })
      .click();
  await l.getByRole('button', { name: 'Check my answers', exact: true }).click();
  await l.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await l.getByRole('button', { name: 'Next step', exact: true }).click();
}
for (const f of p.practicalAssessment.submissionPrompts)
  await l.getByLabel(f.label, { exact: true }).fill(p.practicalAssessment.samplePassingEvidence);
await l.getByRole('button', { name: 'Save draft', exact: true }).click();
await l.getByText('Assessment draft saved', { exact: true }).waitFor();
await l.reload();
await l.locator('[data-save-state="loaded"]').waitFor();
await l.getByRole('tab', { name: 'Demonstrate skill', exact: true }).click();
if (
  (await l.getByLabel(p.practicalAssessment.submissionPrompts[0].label, { exact: true }).inputValue()) !==
  p.practicalAssessment.samplePassingEvidence
)
  throw new Error('Shared assessment draft or workspace selection lost on reload');
await l
  .getByRole('checkbox', {
    name: 'I used fictional or permitted information and checked this response.',
    exact: true,
  })
  .check();
await l.getByRole('button', { name: 'Submit evidence', exact: true }).click();
await l.getByText('Awaiting assigned assessor', { exact: true }).waitFor();
await a.reload();
await a.getByRole('tab', { name: 'Review assignments', exact: true }).click();
await a.getByRole('combobox', { name: 'Assign assessment for Fixture learner', exact: true }).click();
await a.getByRole('option', { name: 'Fixture assessor', exact: true }).click();
await a.getByRole('button', { name: 'Save assignment', exact: true }).click();
await a.getByText('Independent staff assignment saved', { exact: true }).waitFor();
await s.reload();
await s.getByRole('button', { name: 'Review studio', exact: true }).click();
await s.locator('.review-queue button').click();
async function review(page, appeal = false, adverse = false) {
  for (let i = 0; i < 4; i++) {
    const r = p.practicalAssessment.rubric[i];
    await page.getByRole('combobox', { name: r.dimension + ' score', exact: true }).click();
    await page.getByRole('option', { name: '4/4 · ' + r.anchors['4'], exact: true }).click();
    await page
      .getByLabel('Evidence reference and reason', { exact: true })
      .nth(i)
      .fill('Checked the submitted source mapping and verification field against the published anchor.');
  }
  for (let i = adverse ? 1 : 0; i < 3; i++)
    await page.locator('label.gate').getByRole('checkbox').nth(i).check();
  await page
    .getByLabel(appeal ? 'Independent review explanation' : 'Actionable feedback to the learner', {
      exact: true,
    })
    .fill(
      adverse
        ? 'The original decision remains preserved. A verification gate needs stronger evidence before this record can stay active.'
        : 'The fictional task uses verified source mapping, protects information and identifies the human approval route.',
    );
  await page
    .getByRole('button', {
      name: appeal ? 'Save independent review' : 'Save assessment decision',
      exact: true,
    })
    .click();
  await page
    .getByText(appeal ? 'Independent review saved' : 'Assessment decision saved', { exact: true })
    .waitFor();
}
await review(s);
await l.reload();
await l.getByRole('tab', { name: 'Feedback & appeals', exact: true }).click();
await l.getByText('Standard met', { exact: true }).waitFor();
await l.getByRole('button', { name: 'Request independent review', exact: true }).click();
await l
  .getByLabel('Reason for review', { exact: true })
  .fill('Please independently recheck the source mapping and whether this safety gate was actually met.');
await l.getByRole('button', { name: 'Submit appeal', exact: true }).click();
await l.getByText('Appeal saved for independent staff assignment', { exact: true }).waitFor();
await a.reload();
await a.getByRole('tab', { name: 'Review assignments', exact: true }).click();
await a.getByRole('combobox', { name: 'Assign appeal for Fixture learner', exact: true }).click();
await a.getByRole('option', { name: 'Fixture owner', exact: true }).click();
await a.getByRole('button', { name: 'Save assignment', exact: true }).click();
await a.getByText('Independent staff assignment saved', { exact: true }).waitFor();
await a.getByRole('button', { name: 'Review studio', exact: true }).click();
await a.locator('.review-queue button').click();
await review(a, true, true);
await l.reload();
await l.getByRole('button', { name: 'My achievements', exact: true }).click();
await l.getByText('suspended', { exact: true }).waitFor();
await l.getByRole('button', { name: 'Download my record', exact: true }).waitFor();
await l.getByRole('button', { name: 'Community', exact: true }).click();
await l.getByRole('button', { name: 'Start a discussion', exact: true }).click();
await l.getByLabel('Discussion title', { exact: true }).fill('A checked fictional draft');
await l.getByRole('combobox', { name: 'Cohort for discussion', exact: true }).click();
await l.getByRole('option', { name: 'Customer-work circle', exact: true }).click();
await l
  .getByLabel('What would you like to learn?', { exact: true })
  .fill('Which source check helped you spot the unsupported promise in this fictional customer-work draft?');
await l.getByRole('button', { name: 'Submit for moderation', exact: true }).click();
await l.getByText('Awaiting cohort moderation', { exact: true }).waitFor();
await s.reload();
await s.getByRole('tab', { name: 'Cohort moderation', exact: true }).click();
await s
  .getByLabel('Moderation reason', { exact: true })
  .fill('A bounded fictional question appropriate for this learning circle.');
await s.getByRole('button', { name: 'Publish discussion', exact: true }).click();
await s.getByText('Discussion published to this cohort', { exact: true }).waitFor();
await l.reload();
await l.getByRole('heading', { name: 'A checked fictional draft', exact: true }).waitFor();
await a.goto(workspaceUrl + '#teams');
await a.locator('[data-save-state="loaded"]').waitFor();
await a.screenshot({ path: '.sites-runtime/shared-desktop.png', fullPage: true });
const layout = [];
for (const width of [1440, 768, 390])
  for (const enlarged of [false, true]) {
    await a.setViewportSize({ width, height: 1000 });
    await a.evaluate((v) => (document.documentElement.style.fontSize = v ? '200%' : ''), enlarged);
    for (const route of ['teams', 'studio', 'settings', 'community', 'home']) {
      await a.evaluate((v) => (location.hash = v), route);
      await a.waitForTimeout(100);
      layout.push({
        width,
        enlarged,
        route,
        overflow: await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
      if (route === 'teams') {
        for (const tab of ['Cohorts', 'Members', 'Invitations', 'Review assignments', 'Progress']) {
          await a.getByRole('tab', { name: tab, exact: true }).click();
          layout.push({
            width,
            enlarged,
            route: 'teams:' + tab,
            overflow: await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          });
        }
      }
    }
  }
await a.evaluate(() => (document.documentElement.style.fontSize = ''));
await a.evaluate(() => (location.hash = 'teams'));
await a.screenshot({ path: '.sites-runtime/shared-mobile.png', fullPage: true });
const result = {
  passed: !errors.length && !layout.some((r) => r.overflow),
  workspaceCreation: true,
  staleInvitationInputRecovery: true,
  cohortCreation: true,
  emailBoundInvitationAcceptance: true,
  separateStaffAssignment: true,
  lessons: 3,
  quizChecks: 9,
  sharedDraftReload: true,
  assessmentWithSeparateTestIdentities: true,
  independentAdverseAppeal: true,
  suspendedPracticeRecord: true,
  moderatedCohortDiscussion: true,
  responsiveChecks: layout.length,
  overflows: layout.filter((r) => r.overflow),
  pageErrors: errors,
  limits: ['Synthetic local identity headers; actual hosted recipient access not tested'],
};
writeFileSync('.sites-runtime/teams-browser.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
if (!result.passed) process.exitCode = 1;
