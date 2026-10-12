import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const base = resolve(fileURLToPath(new URL('../', import.meta.url))),
  out = resolve(process.env.ACADEMY_OFFLINE_QA_OUT ?? resolve(base, '.sites-runtime/offline-qa')),
  M = await import(pathToFileURL(resolve(out, 'offline-core.mjs')).href);
const NOW = '2026-10-05T19:30:00.000Z',
  LATER = '2026-10-05T19:31:00.000Z',
  OWNER = 'acct:one',
  PHRASE = 'A private fictional practice phrase';
const P = M.programs[0],
  ctx = {
    verified: true,
    currentUserId: OWNER,
    workspaceId: 'lab',
    revision: 3,
    readAt: NOW,
    active: true,
    canLearn: true,
    pausedProgramIds: [],
    enrollments: [
      {
        id: 'e-own',
        programId: P.id,
        version: M.currentRef(P.id).versionId,
        contentRef: M.currentRef(P.id),
        withdrawn: false,
        completed: P.lessons.map((l) => l.id),
        attempts: [],
        appeals: [],
        record: null,
        draft: {},
      },
    ],
  };
const draft = M.updateOfflineDraft(
    M.createOfflineDraft(ctx, 'e-own', { kind: 'practical' }, NOW, true, 'sealed-local-1'),
    { task: 'PRIVATE_UNSENT_FICTIONAL_CANARY' },
    LATER,
  ),
  file = await M.sealDraftQueue([draft], OWNER, PHRASE, LATER);
const rejection = (fn) => assert.rejects(fn, (e) => e instanceof M.OfflineDraftError);
const store = () => {
  const map = new Map();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
test('real WebCrypto seals exact own draft and reveals no plaintext account/text/passphrase in saved bytes', async () => {
  const serialized = JSON.stringify(file);
  for (const secret of [OWNER, PHRASE, draft.fields.task, 'enrollmentId', 'e-own'])
    assert.ok(!serialized.includes(secret));
  assert.deepEqual(await M.unlockDraftQueue(JSON.parse(serialized), OWNER, PHRASE, LATER), [draft]);
  assert.equal(file.iterations, 310000);
  assert.equal(file.algorithm, 'PBKDF2-SHA256/AES-256-GCM');
});
test('each encryption uses fresh salt and IV even for identical text', async () => {
  const second = await M.sealDraftQueue([draft], OWNER, PHRASE, LATER);
  assert.notEqual(second.salt, file.salt);
  assert.notEqual(second.iv, file.iv);
  assert.notEqual(second.ciphertext, file.ciphertext);
});
test('wrong passphrase and wrong account cannot unlock or return a partial queue', async () => {
  await rejection(() => M.unlockDraftQueue(file, OWNER, 'wrong private fictional phrase', LATER));
  await rejection(() => M.unlockDraftQueue(file, 'acct:two', PHRASE, LATER));
});
test('AEAD corruption and authenticated metadata tampering refuse plaintext', async () => {
  const cipher = file.ciphertext,
    changed = (cipher[0] === 'A' ? 'B' : 'A') + cipher.slice(1);
  for (const edit of [
    { ciphertext: changed },
    { salt: (file.salt[0] === 'A' ? 'B' : 'A') + file.salt.slice(1) },
    { iv: (file.iv[0] === 'A' ? 'B' : 'A') + file.iv.slice(1) },
    { createdAt: NOW },
    { expiresAt: '2026-10-06T18:30:00.000Z' },
  ])
    await rejection(() => M.unlockDraftQueue({ ...file, ...edit }, OWNER, PHRASE, LATER));
});
test('shape/algorithm/KDF/base64/size/time bounds reject unsupported files before expensive unlock', () => {
  for (const edit of [
    { schema: 2 },
    { algorithm: 'AES-CBC' },
    { iterations: 1e9 },
    { scopeHash: 'other' },
    { salt: 'AA==' },
    { iv: 'not base64' },
    { ciphertext: 'x'.repeat(700001) },
    { expiresAt: NOW },
    { createdAt: '2026-10-05' },
    { actor: 'staff' },
  ])
    assert.throws(() => M.readSealedDraftFile({ ...file, ...edit }, LATER), M.OfflineDraftError);
});
test('24-hour expiry blocks unlock but retains a metadata-only delete path', async () => {
  await rejection(() => M.unlockDraftQueue(file, OWNER, PHRASE, file.expiresAt));
  assert.equal(M.readSealedDraftFile(file, file.expiresAt, true).expiresAt, file.expiresAt);
  const storage = store();
  M.storeSealedDraft(storage, file, LATER);
  assert.equal(M.loadSealedDraft(storage, file.scopeHash, file.expiresAt).ciphertext, file.ciphertext);
  M.deleteSealedDraft(storage, file.scopeHash);
  assert.equal(storage.length, 0);
});
test('short/overlong passphrases and empty/mixed-owner queues cannot be sealed', async () => {
  for (const p of ['short', 'x'.repeat(257)])
    await rejection(() => M.sealDraftQueue([draft], OWNER, p, LATER));
  await rejection(() => M.sealDraftQueue([], OWNER, PHRASE, LATER));
  await rejection(() =>
    M.sealDraftQueue([draft, { ...draft, entryId: 'other', ownerId: 'acct:two' }], OWNER, PHRASE, LATER),
  );
});
test('storage adapter writes ciphertext only and does not decrypt when loading', () => {
  const storage = store();
  M.storeSealedDraft(storage, file, LATER);
  assert.equal(storage.length, 1);
  const saved = [...storage.map.values()][0];
  assert.ok(!saved.includes(draft.fields.task));
  assert.ok(!saved.includes(OWNER));
  assert.deepEqual(M.loadSealedDraft(storage, file.scopeHash, LATER), file);
});
test('delete-all touches only the fixed sealed-draft namespace', () => {
  const storage = store();
  M.storeSealedDraft(storage, file, LATER);
  storage.setItem('unrelated-app-data', 'leave');
  storage.setItem('aplyd-profile', 'leave');
  assert.equal(M.deleteAllSealedDrafts(storage), 1);
  assert.equal(storage.length, 2);
  assert.equal(storage.getItem('unrelated-app-data'), 'leave');
});
test('storage quota/denial/invalid JSON failures produce plain recovery errors without secrets', () => {
  const unavailable = {
    get length() {
      throw Error('INTERNAL_SECRET');
    },
    key() {
      throw Error('INTERNAL_SECRET');
    },
    getItem() {
      throw Error('INTERNAL_SECRET');
    },
    setItem() {
      throw Error('INTERNAL_SECRET');
    },
    removeItem() {
      throw Error('INTERNAL_SECRET');
    },
  };
  for (const fn of [
    () => M.storeSealedDraft(unavailable, file, LATER),
    () => M.loadSealedDraft(unavailable, file.scopeHash, LATER),
    () => M.deleteSealedDraft(unavailable, file.scopeHash),
    () => M.deleteAllSealedDrafts(unavailable),
    () => M.parseSealedDraftFile('<html>INTERNAL_SECRET</html>', LATER),
  ])
    assert.throws(fn, (e) => e instanceof M.OfflineDraftError && !e.message.includes('INTERNAL_SECRET'));
});
