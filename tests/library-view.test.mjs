import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLibraryFile, recordLibrary } from './library-test-compiler.mjs';
const { module: model, evidence } = await compileLibraryFile('lib/academy-library-view.ts');
recordLibrary('library-model-source.json', {
  executedAt: new Date().toISOString(),
  ...evidence,
  note: 'No candidate fallback. The25 tests below exercise this exact selected checkout source.',
});
const { libraryIndex, libraryResults, libraryFilename, resourceKind, librarySize } = model;
const resource = (id, audience, format) => ({
  id,
  title: id.replaceAll('-', ' '),
  audience,
  format,
  bytes: 2050000,
  href: '/library/government/' + id + '.' + format,
  sourceFilename: 'APLYD_' + id + '.' + format,
  sha256: 'a'.repeat(64),
});
const fixture = () => [
  {
    id: 'government',
    title: 'Government',
    summary: 'Deployment due diligence and governance',
    reviewNote: 'Validate source examples for current local procedures.',
    resources: [
      resource('participant-handbook', 'participant', 'docx'),
      resource('trainer-handbook', 'trainer', 'docx'),
      resource('printables', 'all', 'pdf'),
      resource('slide-deck', 'all', 'pptx'),
    ],
  },
];
test('exact source names, size, hash and authored review note retained without source bodies', () => {
  const x = fixture();
  x[0].privateEvidence = 'must never copy';
  const i = libraryIndex(x);
  assert.equal(i[0].resources[0].filename, 'APLYD_participant-handbook.docx');
  assert.equal(i[0].resources[0].sha256, 'a'.repeat(64));
  assert.equal(i[0].reviewNote, x[0].reviewNote);
  assert.ok(!JSON.stringify(i).includes('must never copy'));
  assert.deepEqual(Object.keys(i[0]).sort(), ['id', 'resources', 'reviewNote', 'summary', 'title']);
});
test('collection and all-term case-insensitive search use filename plus collection context', () => {
  const i = libraryIndex(fixture());
  assert.equal(
    libraryResults(i, '  GOVERNMENT  participant-handbook.docx ', 'government').flatMap((c) => c.resources)
      .length,
    1,
  );
  assert.equal(libraryResults(i, 'unmatched').length, 0);
  assert.equal(libraryResults(i, '', 'frontline').length, 0);
});
test('audience recommendation includes shared references and all is always recoverable', () => {
  const i = libraryIndex(fixture());
  assert.equal(libraryResults(i, '', 'all', 'participant')[0].resources.length, 3);
  assert.equal(libraryResults(i, '', 'all', 'trainer')[0].resources.length, 3);
  assert.equal(libraryResults(i)[0].resources.length, 4);
  assert.equal(i[0].resources.length, 4);
});
test('four distinct types and accurate decimal file size labels', () => {
  const rs = libraryIndex(fixture())[0].resources;
  assert.deepEqual(rs.map(resourceKind), [
    'Participant handbook',
    'Trainer handbook',
    'Printables',
    'Slide deck',
  ]);
  assert.equal(librarySize(18615), '19 KB');
  assert.equal(librarySize(2205586), '2.2 MB');
});
for (const href of [
  'https://example.test/file.pdf',
  '//example.test/file.pdf',
  '/library/../secret.pdf',
  '/library/%2e%2e/secret.pdf',
  '/library/%2Fsecret.pdf',
  '/library/file.pdf?redirect=other',
  '/library/file.pdf#fragment',
  '/library/file%0a.pdf',
  '/library/file%ZZ.pdf',
  '/api/academy',
  '/library/file.docx',
])
  test('fails closed for unsafe/mismatched href ' + href, () =>
    assert.equal(libraryFilename(href, 'pdf'), null),
  );
for (const [name, mutate] of [
  ['unknown collection', (x) => (x[0].id = 'foreign')],
  ['duplicate resource ID', (x) => (x[0].resources[1].id = x[0].resources[0].id)],
  ['duplicate href', (x) => (x[0].resources[1].href = x[0].resources[0].href)],
  ['missing exact source filename', (x) => delete x[0].resources[0].sourceFilename],
  ['source filename path', (x) => (x[0].resources[0].sourceFilename = '../file.docx')],
  ['unsafe count', (x) => x[0].resources.push(resource('fifth', 'all', 'pdf'))],
  ['invalid bytes', (x) => (x[0].resources[0].bytes = -1)],
  ['invalid hash', (x) => (x[0].resources[0].sha256 = 'pending')],
  ['unbounded note', (x) => (x[0].reviewNote = 'a'.repeat(1001))],
])
  test('rejects entire catalog on ' + name, () => {
    const x = fixture();
    mutate(x);
    assert.equal(libraryIndex(x), null);
  });
test('optional omitted/null review notes stay absent', () => {
  for (const value of [undefined, null]) {
    const x = fixture();
    x[0].reviewNote = value;
    assert.equal(libraryIndex(x)[0].reviewNote, null);
  }
});
