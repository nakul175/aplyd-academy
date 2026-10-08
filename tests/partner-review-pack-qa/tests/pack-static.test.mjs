import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.env.ACADEMY_QA_APP ?? resolve(here, '../..');
const modulePath =
  process.env.ACADEMY_PARTNER_REVIEW_MODULE ?? resolve(app, 'lib/academy-partner-review-pack.mjs');
const { hasPartnerReviewPack, buildPartnerReviewPack, renderPartnerReviewPack, PARTNER_REVIEW_FORMAT } =
  await import(pathToFileURL(modulePath).href);
const snapshot = JSON.parse(readFileSync(resolve(here, 'source-snapshot.json'), 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const sources = [
  'lib/academy-ecosystems.ts',
  'lib/academy-library.ts',
  'lib/curriculum-versions/0.1-review-draft.json',
  'app/academy-partner-readiness.tsx',
];
const before = Object.fromEntries(sources.map((p) => [p, hash(resolve(app, p))]));
const cases = [];
const failures = [];
function run(name, fn) {
  try {
    fn();
    cases.push(name);
  } catch (e) {
    failures.push({ name, error: String(e) });
  }
}
const curriculum = JSON.parse(
  readFileSync(resolve(app, 'lib/curriculum-versions/0.1-review-draft.json'), 'utf8'),
);
const libraryRaw = readFileSync(resolve(app, 'lib/academy-library.ts'), 'utf8');
const library = JSON.parse(libraryRaw.slice(libraryRaw.indexOf('['), libraryRaw.lastIndexOf(']') + 1));
run('Source snapshot matches the current immutable curriculum, contract and Library catalog', () => {
  assert.equal(before['lib/curriculum-versions/0.1-review-draft.json'], snapshot.curriculumSha256);
  assert.equal(before['lib/academy-ecosystems.ts'], snapshot.ecosystemSourceSha256);
  assert.equal(before['lib/academy-library.ts'], snapshot.libraryCatalogSha256);
  assert.equal(snapshot.contentVersion, curriculum.contentVersion);
});
run('Only three exact partner keys accepted; health and prototype-like values rejected', () => {
  for (const p of ['agri', 'msme', 'public']) assert.equal(hasPartnerReviewPack(p), true);
  for (const p of ['health', 'AGRI', 'other', 'toString', '__proto__', null, undefined, 0, [], {}]) {
    assert.equal(hasPartnerReviewPack(p), false);
    assert.throws(() => buildPartnerReviewPack(p));
    assert.throws(() => renderPartnerReviewPack(p));
  }
});
run('A hostile object is rejected without reading, coercing or traversing it', () => {
  const p = new Proxy(
    {},
    {
      get() {
        throw new Error('Private traversal');
      },
    },
  );
  assert.equal(hasPartnerReviewPack(p), false);
  assert.throws(() => buildPartnerReviewPack(p), TypeError);
});
for (const partner of ['agri', 'msme', 'public']) {
  run(`${partner}: exact curriculum title, claim, exclusions and source limits retained`, () => {
    const p = buildPartnerReviewPack(partner),
      src = curriculum.pathways.find((x) => x.id === p.partner.pathwayId);
    assert.ok(src);
    assert.equal(p.partner.learningTitle, src.title);
    assert.equal(p.partner.credentialClaim, src.credentialClaim);
    assert.deepEqual(p.partner.credentialExclusions, src.credentialExclusions);
    assert.equal(p.partner.learningSourceNotice, src.sourceNotice);
    assert.equal(p.partner.contentScope, 'global');
    assert.equal(p.partner.contentVersion, curriculum.contentVersion);
  });
  run(`${partner}: pack contains only fixed authority denials and open decisions`, () => {
    const p = buildPartnerReviewPack(partner);
    assert.equal(p.format, PARTNER_REVIEW_FORMAT);
    assert.equal(p.mode, 'discussion-only');
    assert.ok(Object.values(p.authority).every((x) => x === false));
    assert.equal(p.decisions.length, 7);
    assert.ok(p.decisions.every((x) => x.status === 'open'));
    assert.deepEqual(
      Object.keys(p).sort(),
      [
        'format',
        'mode',
        'partner',
        'authority',
        'localContract',
        'excludedFields',
        'decisions',
        'boundaryChecks',
        'references',
        'note',
      ].sort(),
    );
    const forbidden = [
      'actor',
      'accountId',
      'enrollmentId',
      'grantId',
      'receiptId',
      'createdAt',
      'expiresAt',
      'revokedAt',
      'endpoint',
      'token',
      'recipient',
      'progress',
      'practice_record',
    ];
    for (const key of forbidden) assert.ok(!Object.hasOwn(p, key));
    assert.equal(p.localContract.transport, 'none');
    assert.equal(p.localContract.version, 'aplyd.learning-return/1.0-test');
  });
  run(`${partner}: printable file is entirely offline and contains no executable or write controls`, () => {
    const html = renderPartnerReviewPack(partner);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes("default-src 'none'"));
    assert.ok(html.includes("form-action 'none'"));
    assert.ok(!/<(?:script|iframe|form|input|button|img|link|object|embed)\b/i.test(html));
    assert.ok(!/\b(?:src|href|action|on\w+)\s*=/i.test(html));
    assert.ok(!/https?:\/\//i.test(html));
    assert.ok(html.includes('@media print'));
    assert.ok(html.includes('@media(max-width:560px)'));
    assert.equal((html.match(/OPEN — decision required/g) || []).length, 7);
    assert.ok(html.includes('scope="col"'));
    assert.ok(html.includes('lang="en"'));
    assert.ok(html.includes('Current local contract and field definitions'));
  });
  run(`${partner}: downloaded HTML and JSON equal a fresh detached render`, () => {
    assert.equal(
      readFileSync(resolve(here, `downloads/aplyd-${partner}-review-checklist.html`), 'utf8'),
      renderPartnerReviewPack(partner),
    );
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(here, `downloads/aplyd-${partner}-review-checklist.json`), 'utf8')),
      buildPartnerReviewPack(partner),
    );
  });
}
run('Mutating a returned pack cannot affect another download or permit a forged decision', () => {
  const before = renderPartnerReviewPack('agri'),
    p = buildPartnerReviewPack('agri');
  p.authority.authorizesDelivery = true;
  p.decisions[0].status = 'approved';
  p.partner.name = '<script>PRIVATE-SENTINEL</script>';
  p.localContract.fields[0].constraint = 'PRIVATE-SENTINEL';
  p.references[0].sha256 = 'forged';
  assert.equal(renderPartnerReviewPack('agri'), before);
  assert.equal(buildPartnerReviewPack('agri').decisions[0].status, 'open');
  assert.ok(!before.includes('PRIVATE-SENTINEL'));
});
run('Exact field allowlist and presence groups described without supplying learner values', () => {
  const c = buildPartnerReviewPack('public').localContract;
  assert.deepEqual(
    c.fields.map((x) => x.name),
    [
      'contract_version',
      'mode',
      'partner',
      'event_id',
      'occurred_at',
      'enrollment_ref',
      'pathway_id',
      'content_version',
      'purpose',
      'scopes',
      'learning.completed_lessons',
      'learning.total_lessons',
      'learning.status',
      'practice_record.status',
      'practice_record.claim_type',
      'practice_record.review_mode',
    ],
  );
  assert.equal(c.fields.filter((x) => x.requiredWhen === 'always').length, 10);
  assert.equal(c.fields.filter((x) => x.requiredWhen === 'learning.progress').length, 3);
  assert.equal(c.fields.filter((x) => x.requiredWhen === 'practice.record').length, 3);
  assert.deepEqual(c.choiceDurationDays, [1, 7, 30]);
  assert.equal(c.retainedChoiceLimit, 24);
  assert.equal(c.retainedReceiptLimit, 100);
  assert.deepEqual(
    c.scopeGroups.map((x) => x.id),
    ['learning.progress', 'practice.record'],
  );
  assert.ok(c.fields.every((x) => Object.keys(x).join(',') === 'name,type,requiredWhen,constraint'));
});
run('Library resource metadata is exact and original files have the listed checksum', () => {
  for (const r of buildPartnerReviewPack('msme').references) {
    const source = library.flatMap((c) => c.resources).find((x) => x.id === r.id);
    assert.ok(source);
    for (const k of ['id', 'title', 'sourceFilename', 'sha256', 'bytes']) assert.equal(r[k], source[k]);
    assert.equal(hash(resolve(app, 'public', source.href.slice(1))), r.sha256);
    assert.equal(readFileSync(resolve(app, 'public', source.href.slice(1))).length, r.bytes);
  }
});
run('UI adoption is one local HTML download and excludes health/shared without state input', () => {
  const candidate = readFileSync(
    process.env.ACADEMY_PARTNER_REVIEW_UI ?? resolve(app, 'app/academy-partner-readiness.tsx'),
    'utf8',
  );
  const body = candidate.slice(
    candidate.indexOf('function downloadReviewChecklist'),
    candidate.indexOf('/** Read-only component.'),
  );
  assert.ok(body.includes('hasPartnerReviewPack(partner)'));
  assert.ok(body.includes('renderPartnerReviewPack(partner)'));
  assert.ok(body.includes("type:'text/html;charset=utf-8'"));
  assert.ok(
    !/fetch|localStorage|sessionStorage|api\/|inspection|state|grant|receipt|enrollment/i.test(
      body.slice(body.indexOf('{')),
    ),
  );
  assert.ok(candidate.includes("if(m.scope==='shared')return null;"));
  assert.ok(candidate.includes('hasPartnerReviewPack(m.partner)&&<button'));
  assert.equal((candidate.match(/Download printable review checklist/g) || []).length, 1);
});
run('Boundary checklist covers rejection, exact expiry, stopping and retained history', () => {
  assert.deepEqual(
    buildPartnerReviewPack('agri').boundaryChecks.map((x) => x.id),
    [
      'extra-fields',
      'wrong-scope',
      'wrong-pin',
      'expiry',
      'withdraw',
      'independent-stop',
      'history-clock',
      'capacity',
    ],
  );
});
const after = Object.fromEntries(sources.map((p) => [p, hash(resolve(app, p))]));
run('All checked checkout source hashes remain unchanged', () => assert.deepEqual(after, before));
writeFileSync(
  resolve(here, 'static-test-evidence.json'),
  JSON.stringify(
    {
      passed: !failures.length,
      groups: cases.length,
      cases,
      failures,
      modulePath,
      moduleSha256: hash(modulePath),
      sourceHashes: before,
      rootUnchanged: JSON.stringify(before) === JSON.stringify(after),
      mode: process.env.ACADEMY_PARTNER_REVIEW_MODULE
        ? 'selected-adopted-module-fixed-data-and-offline-render'
        : 'candidate-fixed-data-and-offline-render',
      limits: [
        'No compiler, app build, server, browser, API or saved-state writes. Visual print/mobile layout not yet browser-verified. Root domain integration tests are staged separately.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(`${cases.length} static groups passed; ${failures.length} failures.`);
if (failures.length) {
  console.error(failures);
  process.exitCode = 1;
}
