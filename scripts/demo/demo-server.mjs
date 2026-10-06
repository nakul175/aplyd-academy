#!/usr/bin/env node
// Aplyd Academy LOCAL DEMO reverse proxy. NOT part of the app build; see README-demo.md.
// Zero dependencies. Loopback only (listen host and upstream).
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COOKIE = "demo_as";
const HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

export function isLoopbackHost(h) {
  if (!h) return false;
  const x = String(h).toLowerCase().replace(/^\[|\]$/g, "");
  return x === "localhost" || x === "::1" || /^127(\.\d{1,3}){3}$/.test(x);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  for (const part of String(h || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponentSafe(part.slice(i + 1).trim());
  }
  return out;
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function safeNext(n) {
  if (typeof n !== "string" || !n.startsWith("/")) return null;
  if (n.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(n)) return null;
  return n;
}

export function createDemoServer(opts = {}) {
  const upstream = new URL(opts.upstream || process.env.DEMO_UPSTREAM || "http://127.0.0.1:8787");
  const listenHost = opts.host || process.env.DEMO_HOST || "127.0.0.1";
  if (upstream.protocol !== "http:") throw new Error("Upstream must be http:// loopback");
  if (!isLoopbackHost(upstream.hostname)) throw new Error(`Refusing non-loopback upstream: ${upstream.hostname}`);
  if (!isLoopbackHost(listenHost)) throw new Error(`Refusing non-loopback listen host: ${listenHost}`);
  const identitiesFile = opts.identitiesFile || process.env.DEMO_IDENTITIES || path.join(HERE, "demo-identities.json");
  const scriptFile = opts.scriptFile || process.env.DEMO_SCRIPT || path.join(HERE, "demo-script.json");
  const overviewFile = opts.overviewFile || process.env.DEMO_OVERVIEW || path.join(HERE, "overview.mjs");

  const loadIdentities = () => {
    const j = readJson(identitiesFile);
    return j && Array.isArray(j.identities) ? j : null;
  };
  const loadScript = () => {
    const j = readJson(scriptFile);
    return j && Array.isArray(j.steps) ? j : null;
  };
  const activeOf = (req, data) => {
    if (!data || !data.identities.length) return null;
    const k = parseCookies(req.headers.cookie)[COOKIE];
    return data.identities.find((i) => i.key === k) || data.identities.find((i) => i.key === "admin") || data.identities[0];
  };
  const authHeaders = (id) => id ? {
    "oai-authenticated-user-id": String(id.id),
    "oai-authenticated-user-email": String(id.email),
    "oai-authenticated-user-full-name": encodeURIComponent(String(id.name ?? "")),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  } : {};

  function buildUpstreamHeaders(req, id) {
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (HOP.has(lk) || lk.startsWith("oai-") || lk === "accept-encoding") continue;
      if (lk === "cookie") {
        const c = String(v).split(";").map((s) => s.trim()).filter((s) => s && !s.startsWith(COOKIE + "=")).join("; ");
        if (c) h[k] = c;
        continue;
      }
      h[k] = v;
    }
    h["accept-encoding"] = "identity";
    return { ...h, ...authHeaders(id) };
  }

  function bar(data, script, active) {
    const ids = data?.identities || [];
    const options = ids.map((i) => `<option value="${esc(i.key)}"${active && i.key === active.key ? " selected" : ""}>${esc(i.label || i.name)} (${esc(i.role)})</option>`).join("");
    const byKey = Object.fromEntries(ids.map((i) => [i.key, i]));
    const steps = (script?.steps || []).map((s, n) => {
      const who = byKey[s.role];
      return `<li class="step"><div class="st">${n + 1}. ${esc(s.title)}</div>` +
        `<div class="role">Role: ${esc(who ? `${who.label || who.name} (${who.role})` : s.role)}</div>` +
        (s.say ? `<p><b>Say</b> ${esc(s.say)}</p>` : "") + (s.do ? `<p><b>Do</b> ${esc(s.do)}</p>` : "") +
        `<button type="button" data-role="${esc(s.role)}" data-link="${esc(s.link || "/")}">Switch to this role and go</button></li>`;
    }).join("");
    const panel = script
      ? `<h2>${esc(script.title || "Demo guide")}</h2><ol>${steps || "<li>No steps defined.</li>"}</ol>`
      : `<h2>Demo guide</h2><p>No demo-script.json found.</p>`;
    return `<style>
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.bar{position:fixed;top:0;left:0;right:0;height:40px;z-index:2147483647;background:#7a1f1f;color:#fff;display:flex;align-items:center;gap:12px;padding:0 12px;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.bar b{letter-spacing:.02em}.sp{flex:1}
select,button,a.btn{font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid #fff;background:#fff;color:#222;cursor:pointer;text-decoration:none}
.bar button.t{background:transparent;color:#fff}
.panel{position:fixed;top:40px;right:0;bottom:0;width:340px;max-width:92vw;z-index:2147483646;background:#fff;color:#222;border-left:1px solid #bbb;overflow:auto;padding:12px;display:none;font-size:13px;box-shadow:-2px 0 8px rgba(0,0,0,.2)}
.panel.open{display:block}.panel h2{font-size:15px;margin:0 0 8px}.panel ol{list-style:none;margin:0;padding:0}
.step{border:1px solid #ddd;border-radius:6px;padding:8px;margin-bottom:8px}.st{font-weight:600}.role{color:#666;font-size:12px}.step p{margin:6px 0}
.step button{background:#7a1f1f;color:#fff;border-color:#7a1f1f;margin-top:4px}
@media(max-width:640px){.msg{display:none}}
</style>
<div class="bar" role="region" aria-label="Demo controls"><b class="msg">DEMO — synthetic data, not real learners</b>
<span class="sp"></span><label>Role <select id="r">${options || "<option>(no identities)</option>"}</select></label>
<button class="t" id="g" type="button" aria-expanded="false">Demo guide</button><a class="btn" href="/demo/overview">Workload overview</a></div>
<aside class="panel" id="p">${panel}</aside>`;
  }

  // Everyone except the personal-lab learner lands inside the seeded DEMO workspace (the app reads ?workspace=).
  function landing(data, key, next) {
    if (key === "personal-learner" || !data || !data.teamId || !/^tw-[a-z0-9-]{20,80}$/i.test(data.teamId)) return next;
    const i = next.indexOf("#"), path = i < 0 ? next : next.slice(0, i), hash = i < 0 ? "" : next.slice(i);
    if (path !== "/") return next;
    return "/?workspace=" + encodeURIComponent(data.teamId) + hash;
  }

  function injection(data, script, active) {
    const html = JSON.stringify(bar(data, script, active)).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
    return `<style data-demo>html body{padding-top:40px !important}</style><script data-demo>(function(){var H=${html};
function sw(role){return fetch('/demo/switch?as='+encodeURIComponent(role)+'&next=/',{redirect:'manual',credentials:'same-origin'});}
function mount(){var h=document.createElement('div');h.id='demo-banner-host';
var s=h.attachShadow({mode:'open'});s.innerHTML=H;document.documentElement.appendChild(h);
var p=s.getElementById('p'),g=s.getElementById('g');
function open(v){p.classList.toggle('open',v);g.setAttribute('aria-expanded',String(v));try{localStorage.setItem('demo_guide_open',v?'1':'0')}catch(e){}}
try{if(localStorage.getItem('demo_guide_open')==='1')open(true)}catch(e){}
g.onclick=function(){open(!p.classList.contains('open'))};
s.getElementById('r').onchange=function(e){location.href='/demo/switch?as='+encodeURIComponent(e.target.value)+'&next='+encodeURIComponent('/'+location.hash)};
Array.prototype.forEach.call(s.querySelectorAll('.step button'),function(b){b.onclick=function(){location.href='/demo/switch?as='+encodeURIComponent(b.dataset.role)+'&next='+encodeURIComponent(b.dataset.link)}});}
function ensure(){if(!document.getElementById('demo-banner-host'))mount()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
new MutationObserver(ensure).observe(document.documentElement,{childList:true});})();</script>`;
  }

  function inject(html, req) {
    const data = loadIdentities();
    const inj = injection(data, loadScript(), activeOf(req, data));
    if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, (m) => inj + m);
    if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => m + inj);
    return inj + html;
  }

  function sendHtml(req, res, status, html) {
    const body = Buffer.from(inject(html, req));
    res.writeHead(status, { "content-type": "text/html; charset=utf-8", "content-length": body.length, "cache-control": "no-store" });
    res.end(body);
  }

  function fetchAsFactory(data) {
    return (key, p) => new Promise((resolve, reject) => {
      const id = data.identities.find((i) => i.key === key);
      if (!id) return reject(new Error(`Unknown identity: ${key}`));
      const pth = safeNext(p);
      if (!pth) return reject(new Error(`Bad path: ${p}`));
      const r = http.request({ host: upstream.hostname, port: upstream.port || 80, path: pth, method: "GET", headers: { accept: "application/json", "accept-encoding": "identity", ...authHeaders(id) } }, (u) => {
        const chunks = [];
        u.on("data", (c) => chunks.push(c));
        u.on("end", () => {
          const txt = Buffer.concat(chunks).toString("utf8");
          if (u.statusCode < 200 || u.statusCode >= 300) return reject(new Error(`GET ${pth} as ${key} -> ${u.statusCode}`));
          try { resolve(JSON.parse(txt)); } catch { reject(new Error(`GET ${pth} as ${key}: non-JSON response`)); }
        });
      });
      r.on("error", reject);
      r.end();
    });
  }

  async function overview(req, res) {
    const data = loadIdentities();
    if (!data) return sendHtml(req, res, 503, `<!doctype html><html><head><meta charset="utf-8"><title>Workload overview</title></head><body style="font-family:system-ui;padding:24px"><h1>Workload overview unavailable</h1><p>No demo identities file found (${esc(identitiesFile)}). Run the seed script first.</p></body></html>`);
    if (!fs.existsSync(overviewFile)) return sendHtml(req, res, 200, `<!doctype html><html><head><meta charset="utf-8"><title>Workload overview</title></head><body style="font-family:system-ui;padding:24px"><h1>Workload overview not available yet</h1><p><code>scripts/demo/overview.mjs</code> has not been created in this checkout. It must export <code>renderOverview({fetchAs, identities, teamId, baseUrl})</code>.</p></body></html>`);
    try {
      const mod = await import(pathToFileURL(overviewFile).href + "?t=" + fs.statSync(overviewFile).mtimeMs);
      const html = await mod.renderOverview({ fetchAs: fetchAsFactory(data), identities: data.identities, teamId: data.teamId, baseUrl: data.baseUrl });
      return sendHtml(req, res, 200, String(html));
    } catch (e) {
      return sendHtml(req, res, 500, `<!doctype html><html><head><meta charset="utf-8"><title>Workload overview error</title></head><body style="font-family:system-ui;padding:24px"><h1>Workload overview failed</h1><pre>${esc((e && e.stack) || e)}</pre></body></html>`);
    }
  }

  function decode(buf, enc) {
    enc = String(enc || "").toLowerCase();
    if (enc === "gzip" || enc === "x-gzip") return zlib.gunzipSync(buf);
    if (enc === "br") return zlib.brotliDecompressSync(buf);
    if (enc === "deflate") return zlib.inflateSync(buf);
    return buf;
  }

  function proxy(req, res) {
    const data = loadIdentities();
    const id = activeOf(req, data);
    const pr = http.request({ host: upstream.hostname, port: upstream.port || 80, method: req.method, path: req.url, headers: buildUpstreamHeaders(req, id) }, (u) => {
      const headers = {};
      for (const [k, v] of Object.entries(u.headers)) if (!HOP.has(k)) headers[k] = v;
      if (typeof headers.location === "string" && headers.location.startsWith(upstream.origin)) headers.location = headers.location.slice(upstream.origin.length) || "/";
      const ct = String(u.headers["content-type"] || "");
      if (!/^text\/html/i.test(ct)) {
        res.writeHead(u.statusCode, headers);
        u.pipe(res);
        return;
      }
      const chunks = [];
      u.on("data", (c) => chunks.push(c));
      u.on("end", () => {
        let html;
        try { html = decode(Buffer.concat(chunks), u.headers["content-encoding"]).toString("utf8"); }
        catch { res.writeHead(502, { "content-type": "text/plain" }); return res.end("Demo proxy: could not decode upstream HTML"); }
        const body = Buffer.from(inject(html, req));
        delete headers["content-encoding"]; delete headers.etag; delete headers["content-md5"];
        headers["content-length"] = body.length;
        headers["cache-control"] = "no-store";
        res.writeHead(u.statusCode, headers);
        res.end(body);
      });
      u.on("error", () => res.destroy());
    });
    pr.on("error", (e) => {
      if (res.headersSent) return res.destroy();
      sendHtml(req, res, 502, `<!doctype html><html><head><meta charset="utf-8"><title>Upstream unavailable</title></head><body style="font-family:system-ui;padding:24px"><h1>Upstream unavailable</h1><p>Could not reach ${esc(upstream.origin)}: ${esc(e.message)}</p></body></html>`);
    });
    req.pipe(pr);
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://demo.local");
    if (url.pathname === "/demo/health") {
      const data = loadIdentities(), script = loadScript(), a = activeOf(req, data);
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(JSON.stringify({ ok: true, demo: true, upstream: upstream.origin, identitiesLoaded: !!data, identities: data ? data.identities.length : 0, scriptSteps: script ? script.steps.length : 0, overviewModule: fs.existsSync(overviewFile), active: a ? a.key : null }));
    }
    if (url.pathname === "/demo/switch") {
      const data = loadIdentities();
      const key = url.searchParams.get("as");
      if (!data || !data.identities.some((i) => i.key === key)) { res.writeHead(400, { "content-type": "text/plain" }); return res.end("Unknown identity"); }
      const safe = safeNext(url.searchParams.get("next") ?? "/");
      if (!safe) { res.writeHead(400, { "content-type": "text/plain" }); return res.end("Invalid next"); }
      res.writeHead(302, { location: landing(data, key, safe), "set-cookie": `${COOKIE}=${encodeURIComponent(key)}; Path=/; SameSite=Lax; HttpOnly`, "cache-control": "no-store" });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/" && !url.searchParams.has("workspace")) {
      const data = loadIdentities(), a = data ? activeOf(req, data) : null;
      if (data && a) { const to = landing(data, a.key, "/"); if (to !== "/") { res.writeHead(302, { location: to, "cache-control": "no-store" }); return res.end(); } }
    }
    if (url.pathname === "/demo/overview") return overview(req, res);
    if (url.pathname.startsWith("/demo/")) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    proxy(req, res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.DEMO_HOST || "127.0.0.1";
  const port = Number(process.env.DEMO_PORT || 8788);
  let server;
  try { server = createDemoServer({ host }); } catch (e) { console.error(e.message); process.exit(1); }
  server.listen(port, host, () => console.log(`Aplyd Academy DEMO proxy on http://${host}:${port} -> ${process.env.DEMO_UPSTREAM || "http://127.0.0.1:8787"}`));
}
