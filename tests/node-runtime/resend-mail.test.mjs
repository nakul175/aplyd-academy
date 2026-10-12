// ACA-US-1.4: the Resend transport sends the expected request, reports failures without leaking the code,
// and refuses to run unconfigured. A local fake stands in for api.resend.com; nothing leaves the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = join(root, '.sites-runtime/resend-mail');
mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents: "export {mailSender} from './lib/auth/mail';export {SignInError} from './lib/auth/email-otp';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(out, 'model.mjs'),
  logLevel: 'warning',
});
const M = await import(join(out, 'model.mjs'));

async function fake(status) {
  const seen = [];
  const server = createServer(async (req, res) => {
    let b = '';
    for await (const c of req) b += c;
    seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b) });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end('{"id":"fake"}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { seen, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
const env = (url) =>
  Object.assign(process.env, {
    ACADEMY_MAIL_TRANSPORT: 'resend',
    RESEND_API_KEY: 're_test_key',
    ACADEMY_MAIL_FROM: 'Aplyd Academy <no-reply@example.test>',
    ACADEMY_RESEND_API_URL: url,
  });

test('sends from, to, subject and text with the API key', async () => {
  const f = await fake(200);
  env(f.url);
  try {
    await M.mailSender({})(
      'learner@example.test',
      'Your Aplyd Academy sign-in code',
      'Your sign-in code is 123456.',
    );
    assert.equal(f.seen.length, 1);
    assert.equal(f.seen[0].url, '/emails');
    assert.equal(f.seen[0].auth, 'Bearer re_test_key');
    assert.deepEqual(f.seen[0].body, {
      from: 'Aplyd Academy <no-reply@example.test>',
      to: ['learner@example.test'],
      subject: 'Your Aplyd Academy sign-in code',
      text: 'Your sign-in code is 123456.',
    });
  } finally {
    f.close();
  }
});

test('a provider error becomes a retry message; the code is not logged', async () => {
  const f = await fake(500);
  env(f.url);
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    await assert.rejects(
      M.mailSender({})('learner@example.test', 's', 'Your sign-in code is 654321.'),
      (e) => e.status === 503 && /try again/.test(e.message),
    );
    assert.ok(logged.every((l) => !l.includes('654321') && !l.includes('learner@example.test')));
  } finally {
    console.error = orig;
    f.close();
  }
});

test('unconfigured Resend refuses to send', () => {
  env('http://127.0.0.1:1');
  delete process.env.RESEND_API_KEY;
  assert.throws(
    () => M.mailSender({}),
    (e) => e.status === 503,
  );
});
