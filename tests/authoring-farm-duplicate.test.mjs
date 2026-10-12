import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const dir = dirname(fileURLToPath(import.meta.url)),
  app = resolve(process.env.ACADEMY_APP_PATH ?? resolve(dir, '..'));
const archivePath = resolve(app, 'lib/curriculum-versions/0.1-review-draft.json'),
  bytes = readFileSync(archivePath),
  seed = JSON.parse(bytes),
  farm = seed.pathways[0];
const sourcePath = resolve(app, 'lib/academy-authoring.ts'),
  sourceBefore = readFileSync(sourcePath),
  require = createRequire(import.meta.url),
  esbuild = require(resolve(app, 'node_modules/esbuild/lib/main.js'));
mkdirSync(resolve(app, '.sites-runtime/farm-duplicate'), { recursive: true });
await esbuild.build({
  entryPoints: [sourcePath],
  outfile: resolve(app, '.sites-runtime/farm-duplicate/actual-authoring-duplicate.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
});
assert.deepEqual(
  readFileSync(sourcePath),
  sourceBefore,
  'Root edited authoring during this build; rerun against a stable source snapshot.',
);
const {
  applyWorkspaceContentCommand: act,
  previewDraft,
  AuthoringError,
} = await import(pathToFileURL(resolve(app, '.sites-runtime/farm-duplicate/actual-authoring-duplicate.mjs')));
writeFileSync(
  resolve(app, '.sites-runtime/farm-duplicate/source-evidence.json'),
  JSON.stringify(
    {
      sourcePath,
      sourceSha256: createHash('sha256').update(sourceBefore).digest('hex'),
      archiveSha256: createHash('sha256').update(bytes).digest('hex'),
      actualRootPureModule: true,
      apiOrD1Integration: false,
    },
    null,
    2,
  ),
);
const author = { userId: 'duplicate-author' },
  reviewer = { userId: 'duplicate-reviewer' },
  now = '2026-10-05T09:00:00.000Z',
  due = '2027-01-05T09:00:00.000Z';
const sourceRef = { scope: 'global', programId: farm.id, versionId: '0.1-review-draft' };
const host = () => ({
  id: 'tw-55555555-5555-5555-5555-555555555555',
  members: [
    { userId: author.userId, name: 'Synthetic author', active: true, roles: ['admin'] },
    { userId: reviewer.userId, name: 'Synthetic reviewer', active: true, roles: ['admin'] },
  ],
});
async function copied() {
  return act(host(), author, { type: 'content-copy', sourceRef }, now);
}
const last = (t) => t.content.drafts.at(-1),
  rows = (d) => d.document.lessons[0].exercise.sourcePacket;
async function saved(change) {
  let t = await copied(),
    d = last(t),
    document = structuredClone(d.document);
  change(document);
  t = await act(t, author, { type: 'content-save', draftId: d.id, revision: d.revision, document }, now);
  return t;
}
async function rejectedReview(t) {
  const d = last(t);
  assert.ok(previewDraft(t, author, d.id).issues.length > 0);
  await assert.rejects(
    act(
      t,
      author,
      {
        type: 'content-submit',
        draftId: d.id,
        revision: d.revision,
        reviewerId: reviewer.userId,
        reviewDueAt: due,
      },
      now,
    ),
    (e) => e instanceof AuthoringError && e.status === 422,
  );
}
test('global farm archive still contains the unmodified intentional T02 copy', () => {
  assert.equal(
    createHash('sha256').update(readFileSync(archivePath)).digest('hex'),
    '9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4',
  );
  assert.equal(farm.lessons[0].exercise.sourcePacket[3].sourceId, 'T02');
  assert.ok(!Object.hasOwn(farm.lessons[0].exercise.sourcePacket[3], 'duplicateOf'));
});
test('private annotation preserves all four rows, facts, source note and correct totals', async () => {
  const d = last(await copied()),
    original = farm.lessons[0].exercise.sourcePacket;
  assert.equal(rows(d).length, 4);
  assert.deepEqual(rows(d).slice(0, 3), original.slice(0, 3));
  assert.deepEqual(rows(d)[3], { ...original[3], duplicateOf: 'T02' });
  assert.equal(
    rows(d).reduce((sum, r) => sum + r.amount, 0),
    1550,
  );
  assert.equal(
    [...new Map(rows(d).map((r) => [r.sourceId, r])).values()].reduce((sum, r) => sum + r.amount, 0),
    1400,
  );
});
test('every lesson quiz, numeric answer, expected evidence and practical anchor remain accurate', async () => {
  const d = last(await copied());
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(d.document.lessons[i].quiz, farm.lessons[i].quiz);
    assert.deepEqual(
      d.document.lessons[i].exercise.expectedEvidence,
      farm.lessons[i].exercise.expectedEvidence,
    );
    assert.equal(d.document.lessons[i].lessonText, farm.lessons[i].lessonText);
  }
  assert.deepEqual(d.document.practicalAssessment, farm.practicalAssessment);
  assert.equal(
    d.document.lessons[0].quiz[0].options[d.document.lessons[0].quiz[0].correctOptionIndex],
    'INR 1,400',
  );
});
test('private time floor and source wrapping leave global minutes/text unchanged', async () => {
  const d = last(await copied());
  assert.equal(
    d.document.estimatedMinutes,
    Math.max(
      farm.estimatedMinutes,
      farm.lessons.reduce((n, l) => n + l.estimatedMinutes, 0),
    ),
  );
  for (let i = 1; i < 3; i++)
    for (let j = 0; j < farm.lessons[i].exercise.sourcePacket.length; j++)
      assert.equal(
        d.document.lessons[i].exercise.sourcePacket[j].content,
        farm.lessons[i].exercise.sourcePacket[j],
      );
  assert.deepEqual(readFileSync(archivePath), bytes);
});
test('complete copied farming document can request independent review', async () => {
  const t = await copied(),
    d = last(t);
  assert.equal(previewDraft(t, author, d.id).issues.length, 0);
  assert.equal(
    last(
      await act(
        t,
        author,
        {
          type: 'content-submit',
          draftId: d.id,
          revision: d.revision,
          reviewerId: reviewer.userId,
          reviewDueAt: due,
        },
        now,
      ),
    ).state,
    'in_review',
  );
});
test('unmarked duplicate draft stays unmarked and cannot request review', async () => {
  const t = await saved((doc) => delete doc.lessons[0].exercise.sourcePacket[3].duplicateOf);
  assert.ok(!Object.hasOwn(rows(last(t))[3], 'duplicateOf'));
  await rejectedReview(t);
});
test('duplicate marker must identify the original matching transaction', async () => {
  await rejectedReview(await saved((doc) => (doc.lessons[0].exercise.sourcePacket[3].duplicateOf = 'T01')));
});
test('a marker without a prior original cannot create its own evidence', async () => {
  await rejectedReview(await saved((doc) => (doc.lessons[0].exercise.sourcePacket[1].sourceId = 'T99')));
});
test('a first unique row cannot label itself as an established duplicate', async () => {
  await rejectedReview(
    await saved((doc) => {
      const r = doc.lessons[0].exercise.sourcePacket[0];
      r.duplicateOf = 'T01';
      r.sourceNote = 'This row is incorrectly labeled as its own earlier original.';
    }),
  );
});
test('duplicate confirmation needs a preserved explanatory source note', async () => {
  await rejectedReview(await saved((doc) => (doc.lessons[0].exercise.sourcePacket[3].sourceNote = 'copy')));
  await rejectedReview(await saved((doc) => delete doc.lessons[0].exercise.sourcePacket[3].sourceNote));
});
test('trimmed duplicate source IDs still require the canonical matching explicit marker', async () => {
  const t = await saved((doc) => {
    const r = doc.lessons[0].exercise.sourcePacket[3];
    r.sourceId = ' T02 ';
    r.duplicateOf = 'T02';
  });
  assert.equal(previewDraft(t, author, last(t).id).issues.length, 0);
  await rejectedReview(
    await saved((doc) => {
      const r = doc.lessons[0].exercise.sourcePacket[3];
      r.sourceId = ' T02 ';
      delete r.duplicateOf;
    }),
  );
});
test('duplicate metadata and note alone cannot replace fictional source facts', async () => {
  await rejectedReview(
    await saved(
      (doc) =>
        (doc.lessons[0].exercise.sourcePacket[3] = {
          sourceId: 'T02',
          duplicateOf: 'T02',
          sourceNote: 'A confirmed copied transaction is asserted but its actual facts are absent.',
        }),
    ),
  );
});
