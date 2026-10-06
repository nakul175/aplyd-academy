// Run: node --test scripts/demo/test-demo-server.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDemoServer } from "./demo-server.mjs";

const SERVER = fileURLToPath(new URL("./demo-server.mjs", import.meta.url));
let tmp, stub, demo, base, stubPort;

const identities = {
  baseUrl: "http://127.0.0.1:8787", teamId: "t1",
  identities: [
    { key: "admin", label: "Admin", role: "admin", id: "u-admin", email: "admin@demo.test", name: "Ada Mín" },
    { key: "learner", label: "Learner", role: "learner", id: "u-l", email: "l@demo.test", name: "Léa <b>" },
  ],
};

const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(s.address().port)));
const get = (p, headers = {}) => fetch(base + p, { redirect: "manual", headers });

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demo-test-"));
  const idf = path.join(tmp, "ids.json");
  fs.writeFileSync(idf, JSON.stringify(identities));
  fs.writeFileSync(path.join(tmp, "script.json"), JSON.stringify({ title: "Guide T", steps: [{ id: "s1", role: "learner", title: "Step <one>", say: "hi", do: "click", link: "/#/learn" }] }));
  stub = http.createServer((req, res) => {
    const echo = Object.fromEntries(Object.entries(req.headers).filter(([k]) => k.startsWith("oai-") || k === "cookie" || k === "accept-encoding"));
    if (req.url === "/api/echo") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(echo)); }
    if (req.url === "/gz") {
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip", "set-cookie": ["sess=abc; Path=/"] });
      return res.end(zlib.gzipSync("<html><head><title>x</title></head><body><p>gz page</p></body></html>"));
    }
    if (req.url === "/data.bin") { res.writeHead(200, { "content-type": "application/octet-stream" }); return res.end(Buffer.from([0, 1, 2, 255])); }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><head><title>x</title></head><body><p>hdr:${JSON.stringify(echo)}</p></body></html>`);
  });
  stubPort = await listen(stub);
  demo = createDemoServer({ upstream: `http://127.0.0.1:${stubPort}`, identitiesFile: idf, scriptFile: path.join(tmp, "script.json"), overviewFile: path.join(tmp, "nope.mjs") });
  base = `http://127.0.0.1:${await listen(demo)}`;
});
after(() => { demo.close(); stub.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("injects default admin identity headers, name percent-encoded", async () => {
  const j = await (await get("/api/echo")).json();
  assert.equal(j["oai-authenticated-user-id"], "u-admin");
  assert.equal(j["oai-authenticated-user-email"], "admin@demo.test");
  assert.equal(decodeURIComponent(j["oai-authenticated-user-full-name"]), "Ada Mín");
  assert.equal(j["oai-authenticated-user-full-name-encoding"], "percent-encoded-utf-8");
  assert.equal(j["accept-encoding"], "identity");
});

test("strips spoofed oai-* headers", async () => {
  const j = await (await get("/api/echo", { "oai-authenticated-user-id": "evil", "oai-authenticated-user-email": "evil@x", "oai-extra": "1" })).json();
  assert.equal(j["oai-authenticated-user-id"], "u-admin");
  assert.equal(j["oai-extra"], undefined);
});

test("cookie switch changes identity; demo_as not forwarded", async () => {
  const r = await get("/demo/switch?as=learner&next=/%23/learn");
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/#/learn");
  assert.match(r.headers.get("set-cookie"), /^demo_as=learner;/);
  const j = await (await get("/api/echo", { cookie: "demo_as=learner; other=1" })).json();
  assert.equal(j["oai-authenticated-user-id"], "u-l");
  assert.equal(j.cookie, "other=1");
});

test("unknown cookie falls back to admin; unknown switch key 400", async () => {
  const j = await (await get("/api/echo", { cookie: "demo_as=ghost" })).json();
  assert.equal(j["oai-authenticated-user-id"], "u-admin");
  assert.equal((await get("/demo/switch?as=ghost")).status, 400);
});

test("rejects open redirects", async () => {
  for (const n of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "/a\r\nSet-Cookie: x=1"]) {
    const r = await get(`/demo/switch?as=admin&next=${encodeURIComponent(n)}`);
    assert.equal(r.status, 400, n);
  }
});

test("HTML gets banner, role dropdown, guide, overview link; escaped", async () => {
  const t = await (await get("/", { cookie: "demo_as=learner" })).text();
  assert.match(t, /DEMO — synthetic data, not real learners/);
  assert.match(t, /Workload overview/);
  assert.match(t, /\/demo\/overview/);
  assert.match(t, /Demo guide/);
  assert.match(t, /Switch to this role and go/);
  assert.match(t, /Learner \(learner\)/);
  assert.match(t, /Guide T/);
  assert.ok(!t.includes("Step <one>"), "step title must be escaped");
  assert.match(t, /padding-top:40px/);
  assert.match(t, /<p>hdr:/); // original content preserved
});

test("gzip upstream HTML is decoded and injected, set-cookie kept", async () => {
  const r = await get("/gz");
  assert.equal(r.headers.get("content-encoding"), null);
  assert.match(r.headers.get("set-cookie"), /sess=abc/);
  const t = await r.text();
  assert.match(t, /gz page/);
  assert.match(t, /DEMO — synthetic data/);
});

test("non-HTML passes through untouched", async () => {
  const r = await get("/data.bin");
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [0, 1, 2, 255]);
  const j = await get("/api/echo");
  assert.match(j.headers.get("content-type"), /json/);
});

test("overview placeholder when module missing", async () => {
  const r = await get("/demo/overview");
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.match(t, /not available yet/);
  assert.match(t, /DEMO — synthetic data/);
});

test("overview module is used with fetchAs", async () => {
  const mod = path.join(tmp, "ov.mjs");
  fs.writeFileSync(mod, `export async function renderOverview({fetchAs,identities,teamId}){const j=await fetchAs('learner','/api/echo');return '<html><head></head><body>OV '+teamId+' '+identities.length+' '+j['oai-authenticated-user-id']+'</body></html>'}`);
  const s = createDemoServer({ upstream: `http://127.0.0.1:${stubPort}`, identitiesFile: path.join(tmp, "ids.json"), overviewFile: mod });
  const p = await listen(s);
  const t = await (await fetch(`http://127.0.0.1:${p}/demo/overview`)).text();
  s.close();
  assert.match(t, /OV t1 2 u-l/);
});

test("health returns JSON", async () => {
  const j = await (await get("/demo/health")).json();
  assert.equal(j.ok, true);
  assert.equal(j.identities, 2);
  assert.equal(j.scriptSteps, 1);
  assert.equal(j.overviewModule, false);
});

test("identities re-read on each request", async () => {
  const f = path.join(tmp, "ids2.json");
  fs.writeFileSync(f, JSON.stringify(identities));
  const s = createDemoServer({ upstream: `http://127.0.0.1:${stubPort}`, identitiesFile: f });
  const p = await listen(s);
  assert.equal((await (await fetch(`http://127.0.0.1:${p}/demo/health`)).json()).identities, 2);
  fs.writeFileSync(f, JSON.stringify({ ...identities, identities: identities.identities.slice(0, 1) }));
  assert.equal((await (await fetch(`http://127.0.0.1:${p}/demo/health`)).json()).identities, 1);
  s.close();
});

test("non-loopback upstream or listen host refused", () => {
  assert.throws(() => createDemoServer({ upstream: "http://example.com:80" }), /non-loopback upstream/);
  assert.throws(() => createDemoServer({ upstream: "http://10.0.0.5:8787" }), /non-loopback upstream/);
  assert.throws(() => createDemoServer({ upstream: "http://127.0.0.1:1", host: "0.0.0.0" }), /non-loopback listen/);
  const r = spawnSync(process.execPath, [SERVER], { env: { ...process.env, DEMO_UPSTREAM: "http://example.com" }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /non-loopback/);
  const r2 = spawnSync(process.execPath, [SERVER], { env: { ...process.env, DEMO_HOST: "0.0.0.0" }, encoding: "utf8" });
  assert.equal(r2.status, 1);
});
