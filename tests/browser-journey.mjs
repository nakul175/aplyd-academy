import { chromium } from '/Users/athena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const p = JSON.parse(readFileSync('lib/curriculum.json', 'utf8')).pathways[1];
const qaBuilt = process.env.ACADEMY_QA_BUILT === '1',
  qaOrigin = qaBuilt ? 'http://127.0.0.1:8787' : 'http://127.0.0.1:5173',
  qaHeaders = qaBuilt
    ? {
        'oai-authenticated-user-id': 'lab-browser-' + crypto.randomUUID(),
        'oai-authenticated-user-email': 'synthetic@academy.test',
      }
    : {};
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: qaHeaders,
  }),
  page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(qaOrigin + '/');
await page.locator('[data-save-state="loaded"]').waitFor();
await page.evaluate((id) => (location.hash = 'learn/' + id), p.id);
await page.getByRole('heading', { name: p.title, exact: true }).waitFor();
if (await page.getByRole('button', { name: 'Start this pathway', exact: true }).count())
  await page.getByRole('button', { name: 'Start this pathway', exact: true }).click();
await page.getByRole('button', { name: 'Open practical assessment', exact: true }).waitFor();
for (let i = 0; i < 3; i++) {
  const l = p.lessons[i];
  await page.getByRole('heading', { name: l.title, exact: true }).waitFor();
  await page
    .getByLabel('Your corrected work and reasoning', { exact: true })
    .fill(
      'I checked the supplied fictional records, removed unsupported promises, and retained human review.',
    );
  for (const q of l.quiz)
    await page
      .getByRole('radiogroup', { name: q.question, exact: true })
      .getByRole('radio', { name: q.options[q.correctOptionIndex], exact: true })
      .click();
  await page.getByRole('button', { name: 'Check my answers', exact: true }).click();
  await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
}
await page.getByRole('heading', { name: p.practicalAssessment.title, exact: true }).waitFor();
for (const f of p.practicalAssessment.submissionPrompts)
  await page.getByLabel(f.label, { exact: true }).fill(p.practicalAssessment.samplePassingEvidence);
await page.getByRole('button', { name: 'Save draft', exact: true }).click();
await page.getByText('Assessment draft saved', { exact: true }).waitFor();
await page.reload();
await page.getByRole('tab', { name: 'Demonstrate skill', exact: true }).click();
await page
  .getByLabel(p.practicalAssessment.submissionPrompts[0].label, { exact: true })
  .filter({ hasText: '' })
  .waitFor();
if (
  (await page.getByLabel(p.practicalAssessment.submissionPrompts[0].label, { exact: true }).inputValue()) !==
  p.practicalAssessment.samplePassingEvidence
)
  throw new Error('Draft not retained');
await page
  .getByRole('checkbox', {
    name: 'I used fictional or permitted information and checked this response.',
    exact: true,
  })
  .check();
await page.getByRole('button', { name: 'Submit evidence', exact: true }).click();
await page.getByText('Awaiting sample assessor', { exact: true }).waitFor();
await page.evaluate(() => (location.hash = 'studio'));
await page.getByRole('button').filter({ hasText: p.practicalAssessment.title }).click();
for (let i = 0; i < 4; i++) {
  const r = p.practicalAssessment.rubric[i];
  await page.getByRole('combobox', { name: r.dimension + ' score', exact: true }).click();
  await page.getByRole('option', { name: '4/4 · ' + r.anchors['4'], exact: true }).click();
  await page
    .getByLabel('Evidence reference and reason', { exact: true })
    .nth(i)
    .fill('Source references in the submitted checks and final fields satisfy the published anchor.');
}
for (let i = 0; i < p.practicalAssessment.rubric.filter((r) => r.criticalGate).length; i++)
  await page.locator('label.gate').getByRole('checkbox').nth(i).check();
await page
  .getByLabel('Actionable feedback to the learner', { exact: true })
  .fill(
    'The synthetic work corrects unsupported customer commitments, explains source checks, protects private information and retains human approval.',
  );
await page.getByRole('button', { name: 'Save assessment decision', exact: true }).click();
await page.getByText('Assessment decision saved', { exact: true }).waitFor();
await page.evaluate(() => (location.hash = 'credentials'));
await page.getByRole('button', { name: 'Download my record', exact: true }).waitFor();
await page.screenshot({ path: '.sites-runtime/achievement.png', fullPage: true });
await page.evaluate(() => (location.hash = 'community'));
await page.getByRole('button', { name: 'Start a discussion', exact: true }).click();
await page.getByLabel('Discussion title', { exact: true }).fill('Checking a draft before using it');
await page
  .getByLabel('What would you like to learn?', { exact: true })
  .fill('Which source check helped you find an unsupported claim in the fictional customer draft?');
await page.getByRole('button', { name: 'Submit for moderation', exact: true }).click();
await page.getByText('Discussion submitted for moderation', { exact: true }).waitFor();
await page.evaluate(() => (location.hash = 'studio'));
await page.getByRole('tab', { name: 'Moderation', exact: true }).click();
await page.getByRole('button', { name: 'Publish discussion', exact: true }).click();
await page.getByText('Discussion published in this private workspace', { exact: true }).waitFor();
await page.evaluate(() => (location.hash = 'community'));
await page.getByRole('heading', { name: 'Checking a draft before using it', exact: true }).waitFor();
const result = {
  passed: errors.length === 0,
  lessons: 3,
  quizChecks: 9,
  practicalDraftReload: true,
  manualRubricReview: true,
  practiceRecord: true,
  moderatedDiscussion: true,
  pageErrors: errors,
};
writeFileSync('.sites-runtime/browser-journey.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
if (errors.length) process.exitCode = 1;
