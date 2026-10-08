import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as cur from '../../.sites-runtime/content-qa/curriculum.mjs';
import { applyCommand, freshWorkspace } from '../../.sites-runtime/content-qa/engine.mjs';
import { validateDocument } from '../../.sites-runtime/content-qa/authoring.mjs';
import { applyAccessPreferences, languageAvailability } from '../../.sites-runtime/content-qa/inclusive.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = (f) => readFileSync(resolve(root, 'lib/curriculum-versions', f));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const EN = '0.2-review-draft',
  HI = '0.2-review-draft-hi',
  OLD = '0.1-review-draft';
const en = JSON.parse(bytes(EN + '.json').toString('utf8')),
  hi = JSON.parse(bytes(HI + '.json').toString('utf8'));
const ref = (programId, versionId) => ({ scope: 'global', programId, versionId });
const farm = 'farmer-work-records';
const HINDI_LABEL = 'Hindi draft — machine-assisted, needs native review';
const ctx = { registry: cur.curriculumRegistry, allowedScopes: ['global'] };

test('archive pins: 0.1 bytes unchanged, 0.2 and Hindi archives match their recorded SHA256 and length', () => {
  const old = bytes(OLD + '.json');
  assert.equal(sha(old), '9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4');
  assert.equal(sha(old), cur.LEGACY_SOURCE_SHA256);
  assert.equal(old.length, 65054);
  assert.deepEqual(old, readFileSync(resolve(root, 'lib/curriculum.json')));
  for (const v of [OLD, EN, HI]) {
    const pin = cur.EDITION_PINS[v],
      b = bytes(pin.file);
    assert.equal(sha(b), pin.sha256, v + ' hash');
    assert.equal(b.length, pin.byteLength, v + ' length');
  }
  assert.notEqual(cur.EDITION_PINS[EN].sha256, cur.EDITION_PINS[OLD].sha256);
});

test('global default is unchanged: new enrollment and discovery still use 0.1', () => {
  assert.equal(cur.CONTENT_VERSION, OLD);
  assert.equal(cur.curriculum.contentVersion, OLD);
  assert.equal(cur.programs.length, 3);
  assert.equal(cur.currentRef(farm).versionId, OLD);
  assert.equal(cur.resolveCurrentProgram(farm).lessons.length, 3);
  assert.equal(cur.resolveCurrentProgram(farm).lessons[0].transcript, undefined);
});

test('new edition validates with the existing authoring validator (no shape, locked, limit or required issues)', () => {
  assert.equal(en.contentVersion, EN);
  assert.equal(en.pathways.length, 3);
  assert.match(en.status, /Review draft: not approved sector training/);
  for (const p of en.pathways) {
    const size = Buffer.byteLength(JSON.stringify(p));
    assert.ok(size <= 65536, p.id + ' fits the 64 KiB authoring document limit: ' + size);
    assert.deepEqual(validateDocument(structuredClone(p), structuredClone(p)), [], p.id);
    const keys = Object.keys(p.lessons[0]).sort().join();
    for (const l of p.lessons) assert.equal(Object.keys(l).sort().join(), keys, l.id);
  }
  assert.ok(
    !en.pathways.some((p) => /health|clinical/i.test(p.id + p.ecosystem)),
    'no Health pathway authored',
  );
});

test('registry resolves 0.2 only by explicit reference; every pathway keeps its 0.1 pin resolvable', () => {
  for (const p of en.pathways) {
    assert.equal(cur.curriculumRegistry.resolve(ref(p.id, EN)).program.id, p.id);
    assert.equal(cur.curriculumRegistry.resolve(ref(p.id, OLD)).program.lessons.length, 3);
  }
  assert.throws(
    () => cur.curriculumRegistry.resolve(ref('msme-customer-operations', HI)),
    (e) => e instanceof cur.ContentResolutionError,
  );
  assert.throws(
    () => cur.curriculumRegistry.resolve(ref(farm, '0.3-unknown')),
    (e) => e instanceof cur.ContentResolutionError,
  );
  assert.ok(Object.isFrozen(cur.curriculumRegistry.resolve(ref(farm, EN)).program.lessons[0]));
});

test('every pathway includes the shared Responsible AI foundation module with checks', () => {
  const topics = ['Accuracy', 'Privacy', 'Limits', 'Human judgment'];
  const reference = JSON.stringify(
    en.pathways[0].lessons.filter((l) => l.module === 'responsible-ai-foundation'),
  );
  for (const p of en.pathways) {
    const f = p.lessons.filter((l) => l.module === 'responsible-ai-foundation');
    assert.ok(f.length >= 2 && f.length <= 3, p.id);
    assert.deepEqual(
      p.foundation.lessonIds,
      f.map((l) => l.id),
    );
    assert.deepEqual(p.foundation.topics, topics);
    assert.equal(JSON.stringify(f), reference, 'identical shared module in ' + p.id);
    for (const l of f) {
      assert.equal(l.quiz.length, 3);
      assert.ok(l.estimatedMinutes <= 20);
    }
  }
  assert.equal(new Set(en.pathways.map((p) => p.foundation.lessonIds.join())).size, 1);
});

test('suitable-vs-unsuitable scenarios: at least six per pathway, one correct option and an explanation each', () => {
  const positions = new Set();
  for (const p of en.pathways) {
    const items = p.lessons.filter((l) => l.module === 'suitable-unsuitable-use').flatMap((l) => l.quiz);
    assert.ok(items.length >= 6, p.id + ' scenarios: ' + items.length);
    const kinds = { suitable: 0, unsuitable: 0 };
    for (const q of items) {
      assert.match(q.question, /^Classify this task: /);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(
        Number.isInteger(q.correctOptionIndex) && q.correctOptionIndex >= 0 && q.correctOptionIndex < 4,
      );
      assert.ok(q.explanation.trim().length >= 20);
      const right = q.options[q.correctOptionIndex];
      assert.equal(q.options.filter((o) => o === right).length, 1);
      assert.doesNotMatch(right, /no checking/, 'the unchecked-AI option is never correct');
      kinds[right.startsWith('Suitable') ? 'suitable' : 'unsuitable']++;
      positions.add(q.correctOptionIndex);
    }
    assert.ok(
      kinds.suitable >= 2 && kinds.unsuitable >= 2,
      p.id + ' mixes suitable and unsuitable: ' + JSON.stringify(kinds),
    );
    for (const l of p.lessons.filter((l) => l.module === 'suitable-unsuitable-use'))
      assert.equal(l.exercise.sourcePacket.length, l.quiz.length);
  }
  assert.ok(positions.size >= 3, 'correct answer positions vary');
});

test('every lesson has a transcript, a plain-language summary and a labelled audio placeholder with no media file', () => {
  for (const edition of [en, hi])
    for (const p of edition.pathways)
      for (const l of p.lessons) {
        assert.ok(l.transcript.includes(l.lessonText), l.id + ' transcript includes the full lesson text');
        assert.ok(l.transcript.length > l.lessonText.length, l.id);
        assert.ok(l.summary.length >= 40 && l.summary.length < l.lessonText.length, l.id + ' summary');
        assert.equal(l.audio.status, 'not-recorded');
        assert.equal(l.audio.label, 'Audio not recorded yet');
        assert.ok(l.audio.note.length > 20);
        assert.ok(!Object.keys(l.audio).some((k) => /url|src|file|href/i.test(k)));
      }
  assert.doesNotMatch(JSON.stringify([en, hi]), /\.(mp3|wav|ogg|m4a)\b/i);
  assert.equal(cur.lessonFormats(en.pathways[0].lessons[0]).audio.label, 'Audio not recorded yet');
  assert.deepEqual(cur.lessonFormats(cur.resolveCurrentProgram(farm).lessons[0]), {
    transcript: undefined,
    summary: undefined,
    audio: undefined,
  });
});

test('Hindi draft: one pathway only, clearly labelled, same structure and answers as English', () => {
  assert.equal(hi.language, 'hi');
  assert.equal(hi.pathways.length, 1);
  assert.equal(hi.pathways[0].id, farm);
  assert.ok(hi.status.startsWith(HINDI_LABEL));
  assert.ok(hi.editionNotes.some((n) => n.includes(HINDI_LABEL)));
  assert.ok(hi.pathways[0].translationNotice.includes(HINDI_LABEL));
  const src = en.pathways.find((p) => p.id === farm);
  assert.deepEqual(
    hi.pathways[0].lessons.map((l) => l.id),
    src.lessons.map((l) => l.id),
  );
  hi.pathways[0].lessons.forEach((l, i) => {
    const s = src.lessons[i];
    assert.equal(l.quiz.length, s.quiz.length);
    l.quiz.forEach((q, j) => {
      assert.equal(q.correctOptionIndex, s.quiz[j].correctOptionIndex, l.id + ' q' + j);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.match(q.question + q.explanation, /[ऀ-ॿ]/);
    });
    assert.match(l.lessonText, /[ऀ-ॿ]/);
    assert.match(l.summary, /[ऀ-ॿ]/);
  });
  // Only the 64 KiB private-copy size limit differs: the Hindi draft is not offered for authoring copies.
  const issues = validateDocument(structuredClone(hi.pathways[0]), structuredClone(hi.pathways[0]));
  assert.deepEqual(
    issues.filter((x) => !(x.path === 'program' && x.kind === 'limit')),
    [],
  );
  const snap = cur.curriculumRegistry.resolve(ref(farm, HI));
  assert.equal(snap.language, 'hi');
  assert.ok(snap.classification.startsWith(HINDI_LABEL));
  assert.ok(
    !cur.curriculum.pathways.some((p) => p.lessons.some((l) => /[ऀ-ॿ]/.test(l.lessonText))),
    '0.1 has no Hindi',
  );
});

test('language selection surfaces Hindi only where it exists and falls back to English with a visible note', () => {
  const a = cur.editionLanguageNotice(farm, 'hi', 'en');
  assert.equal(a.kind, 'translation-available-not-pinned');
  assert.deepEqual(a.availableRef, ref(farm, HI));
  assert.ok(a.message.includes(HINDI_LABEL));
  assert.match(a.message, /saved edition has not changed/);
  for (const id of ['msme-customer-operations', 'public-servant-source-briefs']) {
    const b = cur.editionLanguageNotice(id, 'hi', 'en');
    assert.equal(b.kind, 'fallback-english');
    assert.equal(b.availableRef, null);
    assert.match(b.message, /No hi edition/);
    assert.match(b.message, /English/);
  }
  assert.equal(cur.editionLanguageNotice(farm, 'mr-IN', 'en').kind, 'fallback-english');
  assert.equal(cur.editionLanguageNotice(farm, 'en', 'en').kind, 'none');
  assert.equal(cur.editionLanguageNotice(farm, 'hi-IN', 'hi').kind, 'viewing-draft-translation');
  const pref = applyAccessPreferences(
    {},
    {
      type: 'learning-access-preferences',
      preferredLanguage: 'hi',
      readAloudMode: 'off',
      assistancePreference: 'none',
    },
  ).learningAccess;
  const avail = languageAvailability({ programId: farm, version: OLD }, ctx, pref);
  assert.equal(avail.status, 'requested-language-unavailable');
  assert.equal(avail.contentRef.versionId, OLD);
  const hiRecord = { programId: farm, version: HI, contentRef: ref(farm, HI) };
  assert.equal(languageAvailability(hiRecord, ctx, pref).status, 'matches-pinned-content');
});

test('no pinned enrollment changes edition once 0.2 exists, and nothing is silently replaced', () => {
  let s = applyCommand(freshWorkspace(), { type: 'enroll', programId: farm }, '2026-10-06T10:00:00.000Z');
  const e0 = s.enrollments[0];
  assert.equal(e0.version, OLD);
  assert.deepEqual(e0.contentRef, ref(farm, OLD));
  const before = structuredClone(s);
  for (const v of [EN, HI]) {
    const t = applyCommand(
      s,
      { type: 'enroll', programId: farm },
      '2026-10-06T11:00:00.000Z',
      undefined,
      ref(farm, v),
      undefined,
    );
    assert.deepEqual(t.enrollments, before.enrollments);
  }
  const lesson = cur.resolvePinnedProgram(e0).lessons[0];
  assert.equal(lesson.id, 'farm-01');
  s = applyCommand(
    s,
    {
      type: 'lesson',
      enrollmentId: e0.id,
      lessonId: 'farm-01',
      practice: 'I checked the record and removed the copied T02 line.',
      answers: lesson.quiz.map((q) => q.correctOptionIndex),
    },
    '2026-10-06T12:00:00.000Z',
  );
  assert.equal(s.enrollments[0].version, OLD);
  assert.deepEqual(s.enrollments[0].contentRef, ref(farm, OLD));
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: 'lesson',
          enrollmentId: e0.id,
          lessonId: 'rai-01',
          practice: 'x'.repeat(40),
          answers: [1, 0, 2],
        },
        '2026-10-06T12:30:00.000Z',
      ),
    /Lesson not found/,
  );
  assert.equal(cur.resolvePinnedProgram(s.enrollments[0]).lessons.length, 3);
  const gone = { ...s.enrollments[0], version: '0.1-withdrawn', contentRef: ref(farm, '0.1-withdrawn') };
  assert.equal(cur.tryResolvePinnedContent(gone).available, false);
  assert.throws(
    () =>
      applyCommand(
        { ...s, enrollments: [gone] },
        {
          type: 'lesson-draft',
          enrollmentId: e0.id,
          lessonId: 'farm-02',
          practice: '',
          answers: [null, null, null],
        },
        '2026-10-06T13:00:00.000Z',
      ),
    /unavailable/i,
  );
});

test('explicit opt-in enrollments pin to the edition they were created on, including 0.2 lessons and Hindi', () => {
  const now = '2026-10-06T10:00:00.000Z';
  let s = applyCommand(
    freshWorkspace(),
    { type: 'enroll', programId: farm },
    now,
    undefined,
    ref(farm, EN),
    undefined,
  );
  assert.equal(s.enrollments[0].version, EN);
  const p = cur.resolvePinnedProgram(s.enrollments[0]);
  assert.equal(p.lessons[0].id, 'rai-01');
  const l = p.lessons[0];
  s = applyCommand(
    s,
    {
      type: 'lesson',
      enrollmentId: s.enrollments[0].id,
      lessonId: l.id,
      practice: 'I marked the rain claim unsupported and kept the price total.',
      answers: l.quiz.map((q) => q.correctOptionIndex),
    },
    now,
  );
  assert.deepEqual(s.enrollments[0].completed, ['rai-01']);
  assert.equal(s.enrollments[0].version, EN);
  const h = applyCommand(
    freshWorkspace(),
    { type: 'enroll', programId: farm },
    now,
    undefined,
    ref(farm, HI),
    undefined,
  );
  assert.equal(h.enrollments[0].version, HI);
  assert.equal(cur.resolvePinnedContent(h.enrollments[0]).language, 'hi');
  assert.throws(() =>
    applyCommand(
      freshWorkspace(),
      { type: 'enroll', programId: 'msme-customer-operations' },
      now,
      undefined,
      ref('msme-customer-operations', HI),
      undefined,
    ),
  );
});
