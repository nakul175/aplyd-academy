// Spike for ACA-US-1.1: run the unchanged v0.17 personal-workspace API (app/api/academy/route.ts) on plain Node
// with SQLite, behind a Node HTTP server, and check its core behaviours. Local only; synthetic identities.
// Usage (repository root): node spikes/do-runtime/run-spike.mjs
import { build } from 'esbuild';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { D1Node, migrate } from './d1-node.mjs';

const root = resolve(import.meta.dirname, '../..');
const out = join(root, '.sites-runtime/spike-do');
mkdirSync(out, { recursive: true });
const started = Date.now();

// 1. Bundle the route as is. Only three platform imports are swapped: the Workers env, Next's headers and redirect.
const shim = (contents) => ({ contents, loader: 'js', resolveDir: root });
await build({
  entryPoints: [join(root, 'app/api/academy/route.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(out, 'academy-route.mjs'),
  alias: { '@': root },
  logLevel: 'warning',
  plugins: [
    {
      name: 'platform-shims',
      setup(b) {
        b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, (a) => ({
          path: a.path,
          namespace: 'shim',
        }));
        b.onLoad(
          { filter: /.*/, namespace: 'shim' },
          (a) =>
            ({
              'cloudflare:workers': shim('export const env = globalThis.__spikeEnv;'),
              'next/headers': shim(
                'export async function headers(){return globalThis.__spikeHeaders.getStore();}',
              ),
              'next/navigation': shim('export function redirect(p){throw new Error("redirect "+p);}'),
            })[a.path],
        );
      },
    },
  ],
});

// 2. A fresh SQLite file with the repository's real migrations.
const dbFile = join(mkdtempSync(join(tmpdir(), 'aca-spike-')), 'academy.sqlite');
let db = new D1Node(dbFile);
migrate(
  db,
  readdirSync(join(root, 'drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(root, 'drizzle', f), 'utf8')),
);
globalThis.__spikeEnv = { DB: db };
globalThis.__spikeHeaders = new AsyncLocalStorage();
const route = await import(join(out, 'academy-route.mjs'));

// 3. Plain Node HTTP server that hands requests to the route handlers.
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const url = `http://127.0.0.1:${server.address().port}${req.url}`;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const handler = route[req.method];
  const response = await globalThis.__spikeHeaders.run(request.headers, () => handler(request));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/api/academy`;

// 4. Checks (synthetic identities, local server only).
let checks = 0;
const fail = [];
const eq = (name, a, b) => {
  checks++;
  if (JSON.stringify(a) !== JSON.stringify(b))
    fail.push(`${name}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
};
const owner = 'spike-owner-' + crypto.randomUUID(),
  other = 'spike-other-' + crypto.randomUUID();
const h = (u) => ({
  'content-type': 'application/json',
  'oai-authenticated-user-id': u,
  'oai-authenticated-user-email': 'synthetic@academy.test',
});
const get = async (u = owner) => {
  const r = await fetch(base, { headers: h(u) });
  return { status: r.status, ...(await r.json()) };
};
const post = async (command, revision, actionId = crypto.randomUUID(), u = owner, extra = {}) => {
  const r = await fetch(base, {
    method: 'POST',
    headers: { ...h(u), ...extra },
    body: JSON.stringify({ command, revision, actionId }),
  });
  return { status: r.status, ...(await r.json()) };
};
eq('anonymous refused', (await fetch(base)).status, 401);
let x = await get();
eq('first read', [x.status, x.revision], [200, 0]);
const programId = x.programs[0].id,
  actionId = crypto.randomUUID();
x = await post({ type: 'enroll', programId }, 0, actionId);
eq('enrol', [x.status, x.state.enrollments.length], [200, 1]);
let r = await post({ type: 'enroll', programId }, 0, actionId);
eq('idempotent replay', [r.status, r.replayed], [200, true]);
r = await post({ type: 'enroll', programId: x.programs?.[1]?.id ?? 'other' }, 1, actionId);
eq('same action id, other request', r.status, 409);
r = await post({ type: 'enroll', programId }, 0);
eq('stale revision', r.status, 409);
r = await get(other);
eq('second owner sees nothing', r.state.enrollments.length, 0);
r = await post({ type: 'enroll', programId }, 1, crypto.randomUUID(), owner, {
  origin: 'https://external.invalid',
});
eq('cross-origin refused', r.status, 403);
const race = await Promise.all([
  post({ type: 'interest', opportunityId: 'peer-circle', enabled: true }, 1),
  post({ type: 'interest', opportunityId: 'mentor-hour', enabled: true }, 1),
]);
eq('concurrent writes: one wins', race.map((v) => v.status).sort(), [200, 409]);
const audit = db.db.prepare('SELECT count(*) n FROM academy_audit WHERE owner=?').get(owner).n;
eq('one audit row per saved change', audit, 2);
// Restart: close and reopen the file, as after a server restart.
db.close();
db = new D1Node(dbFile);
globalThis.__spikeEnv.DB = db;
r = await get();
eq('durable after restart', [r.revision, r.state.enrollments.length, r.state.interests.length], [2, 1, 1]);
server.close();
db.close();

const result = {
  story: 'ACA-US-1.1',
  module: 'app/api/academy/route.ts (unchanged)',
  runtime: `Node ${process.version}, node:sqlite`,
  checks,
  failed: fail,
  passed: fail.length === 0,
  seconds: (Date.now() - started) / 1000,
  limits: [
    'Local only, synthetic identities',
    'ChatGPT Sites identity headers stand in for sign-in (replaced in ACA-US-1.4)',
    'One module of 13 API routes',
    'No load, backup or restore test',
  ],
};
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(fail.length ? 1 : 0);
