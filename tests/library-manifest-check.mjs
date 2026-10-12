import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { app, compileLibraryFile, recordLibrary } from './library-test-compiler.mjs';
const model = await compileLibraryFile('lib/academy-library-view.ts'),
  source = await compileLibraryFile('lib/academy-library.ts'),
  index = model.module.libraryIndex(source.module.collections);
assert.ok(index, 'Exact reviewed manifest must be accepted without field repair or fallback.');
assert.deepEqual(
  index.map((c) => c.id),
  ['government', 'development', 'oversight', 'emerging-leaders', 'frontline'],
);
assert.equal(index.flatMap((c) => c.resources).length, 20);
const files = [];
for (const c of index)
  for (const r of c.resources) {
    const path = resolve(app, 'public', r.href.slice(1)),
      bytes = readFileSync(path);
    assert.equal(bytes.length, r.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), r.sha256);
    assert.equal(r.sourceFilename, r.filename);
    assert.ok(c.reviewNote);
    files.push({
      id: r.id,
      path,
      sourceFilename: r.sourceFilename,
      bytes: bytes.length,
      sha256: r.sha256,
      passed: true,
    });
  }
const result = {
  passed: true,
  executedAt: new Date().toISOString(),
  model: model.evidence,
  manifest: source.evidence,
  collections: index.length,
  files,
  limits: [
    'Local exact files/model validation only; no server/API/browser or document rendering',
    'No candidate fallback; missing checkout source or original fails',
  ],
};
recordLibrary('library-manifest-result.json', result);
console.log(
  JSON.stringify({
    passed: true,
    collections: index.length,
    exactFiles: files.length,
    manifestSha256: source.evidence.sha256,
  }),
);
