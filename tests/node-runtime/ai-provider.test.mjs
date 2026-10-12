// Provider-neutral AI access: the same request works against an Anthropic-format and an OpenAI-format server,
// switching is configuration only, "off" is a kill switch, one retry on 5xx, and learner text is not logged.
// Local fakes only; no real provider is called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..'),
  out = join(root, '.sites-runtime/ai-provider');
mkdirSync(out, { recursive: true });
await build({
  entryPoints: [join(root, 'lib/ai/provider.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(out, 'model.mjs'),
  logLevel: 'warning',
});
const M = await import(join(out, 'model.mjs'));
const req = {
  purpose: 'hint',
  system: 'Give a hint, not the answer.',
  messages: [{ role: 'user', content: 'PRIVATE-LEARNER-TEXT invoice for Mehta Textiles' }],
  maxTokens: 200,
};

async function server(handler) {
  const seen = [];
  let calls = 0;
  const s = createServer(async (q, r) => {
    let b = '';
    for await (const c of q) b += c;
    calls++;
    seen.push({ url: q.url, headers: q.headers, body: JSON.parse(b) });
    const [status, body] = handler(calls);
    r.writeHead(status, { 'content-type': 'application/json' });
    r.end(JSON.stringify(body));
  });
  await new Promise((x) => s.listen(0, '127.0.0.1', x));
  return { seen, url: `http://127.0.0.1:${s.address().port}`, close: () => s.close() };
}
function configure(vars) {
  for (const k of [
    'ACADEMY_AI_PROVIDER',
    'ACADEMY_AI_MODEL',
    'ACADEMY_AI_BASE_URL',
    'ACADEMY_AI_API_KEY',
    'ANTHROPIC_API_KEY',
    'ACADEMY_ENVIRONMENT',
  ])
    delete process.env[k];
  Object.assign(process.env, vars);
}
function captureLogs() {
  const lines = [];
  const o = console.info;
  console.info = (...a) => lines.push(a.join(' '));
  return {
    lines,
    restore: () => {
      console.info = o;
    },
  };
}

test('Anthropic format: model, system, messages and key are sent; text comes back', async () => {
  const s = await server(() => [200, { content: [{ type: 'text', text: 'Check the GST line first.' }] }]);
  configure({
    ACADEMY_AI_PROVIDER: 'anthropic',
    ACADEMY_AI_MODEL: 'model-under-test',
    ANTHROPIC_API_KEY: 'k1',
    ACADEMY_AI_BASE_URL: s.url,
  });
  const log = captureLogs();
  try {
    const r = await M.generate(req);
    assert.equal(r.text, 'Check the GST line first.');
    assert.equal(r.provider, 'anthropic');
    assert.equal(r.model, 'model-under-test');
    assert.equal(s.seen[0].url, '/v1/messages');
    assert.equal(s.seen[0].headers['x-api-key'], 'k1');
    assert.equal(s.seen[0].body.system, req.system);
    assert.deepEqual(s.seen[0].body.messages, req.messages);
    assert.equal(s.seen[0].body.model, 'model-under-test');
    assert.ok(
      log.lines.every((l) => !l.includes('PRIVATE-LEARNER-TEXT')),
      'learner text not logged',
    );
  } finally {
    log.restore();
    s.close();
  }
});

test('switching to an OpenAI-compatible server needs only configuration', async () => {
  const s = await server(() => [200, { choices: [{ message: { content: 'Look at the totals.' } }] }]);
  configure({
    ACADEMY_AI_PROVIDER: 'openai-compatible',
    ACADEMY_AI_MODEL: 'other-model',
    ACADEMY_AI_API_KEY: 'k2',
    ACADEMY_AI_BASE_URL: s.url + '/v1',
  });
  try {
    const r = await M.generate(req);
    assert.equal(r.text, 'Look at the totals.');
    assert.equal(s.seen[0].url, '/v1/chat/completions');
    assert.equal(s.seen[0].headers.authorization, 'Bearer k2');
    assert.deepEqual(s.seen[0].body.messages[0], { role: 'system', content: req.system });
  } finally {
    s.close();
  }
});

test('one retry on a 5xx, then success', async () => {
  const s = await server((n) => (n === 1 ? [503, {}] : [200, { content: [{ type: 'text', text: 'ok' }] }]));
  configure({
    ACADEMY_AI_PROVIDER: 'anthropic',
    ACADEMY_AI_MODEL: 'm',
    ANTHROPIC_API_KEY: 'k',
    ACADEMY_AI_BASE_URL: s.url,
  });
  try {
    assert.equal((await M.generate(req)).text, 'ok');
    assert.equal(s.seen.length, 2);
  } finally {
    s.close();
  }
});

test('a 4xx is not retried and becomes AiUnavailable', async () => {
  const s = await server(() => [400, {}]);
  configure({
    ACADEMY_AI_PROVIDER: 'anthropic',
    ACADEMY_AI_MODEL: 'm',
    ANTHROPIC_API_KEY: 'k',
    ACADEMY_AI_BASE_URL: s.url,
  });
  try {
    await assert.rejects(M.generate(req), (e) => e.name === 'AiUnavailable');
    assert.equal(s.seen.length, 1);
  } finally {
    s.close();
  }
});

test('kill switch and missing configuration stop every call', async () => {
  configure({ ACADEMY_AI_PROVIDER: 'off', ACADEMY_AI_MODEL: 'm' });
  assert.equal(M.aiEnabled(), false);
  await assert.rejects(M.generate(req), (e) => e.name === 'AiUnavailable' && /switched off/.test(e.message));
  configure({ ACADEMY_AI_PROVIDER: 'anthropic' });
  assert.equal(M.aiEnabled(), false); // no model: never guessed
  await assert.rejects(M.generate(req), (e) => e.name === 'AiUnavailable');
  configure({ ACADEMY_AI_PROVIDER: 'fake', ACADEMY_AI_MODEL: 'f', ACADEMY_ENVIRONMENT: 'production' });
  await assert.rejects(M.generate(req), (e) => e.name === 'AiUnavailable'); // fake never runs in production
});
