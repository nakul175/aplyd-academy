import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)),
  app = resolve(process.env.ACADEMY_APP_PATH ?? resolve(here, '..')),
  client = resolve(app, 'dist/client'),
  evidencePath = resolve(
    process.env.ACADEMY_SIZE_QA_OUT ?? resolve(app, '.sites-runtime/client-size-evidence.json'),
  );
const ts = await import(pathToFileURL(resolve(app, 'node_modules/typescript/lib/typescript.js')).href),
  compiler = ts.default ?? ts;
const manifest = JSON.parse(readFileSync(resolve(client, 'vinext-client-entry-manifest.json'), 'utf8')),
  metadata = JSON.parse(
    readFileSync(resolve(app, 'dist/server/vinext-client-assets.js'), 'utf8')
      .trim()
      .replace(/^export default /, '')
      .replace(/;$/, ''),
  );
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  rows = [],
  byPath = new Map();
function walk(dir) {
  for (const file of readdirSync(dir)) {
    const path = resolve(dir, file);
    if (statSync(path).isDirectory()) walk(path);
    else if (file.endsWith('.js') || file.endsWith('.css')) {
      const bytes = readFileSync(path),
        relative = path.slice(client.length + 1),
        source = file.endsWith('.js')
          ? compiler.createSourceFile(
              file,
              bytes.toString('utf8'),
              compiler.ScriptTarget.Latest,
              true,
              compiler.ScriptKind.JS,
            )
          : null,
        imports = [];
      if (source)
        for (const node of source.statements)
          if (
            (compiler.isImportDeclaration(node) || compiler.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            compiler.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text.startsWith('.')
          )
            imports.push(resolve(dirname(path), node.moduleSpecifier.text).slice(client.length + 1));
      const row = {
        file: relative,
        rawBytes: bytes.length,
        gzipLevel9Bytes: gzipSync(bytes, { level: 9 }).length,
        sha256: sha(bytes),
        staticImports: imports,
      };
      rows.push(row);
      byPath.set(relative, row);
    }
  }
}
walk(client);
function closure(seeds) {
  const seen = new Set(),
    queue = [...seeds];
  while (queue.length) {
    const key = queue.shift()?.replace(/^\//, '');
    if (!key || seen.has(key) || !byPath.has(key)) continue;
    seen.add(key);
    queue.push(...byPath.get(key).staticImports);
  }
  return [...seen].sort();
}
const bootstrap = closure([manifest.appBrowserEntry, ...metadata.appBootstrapPreinitModules]),
  academyFiles = (metadata.dynamicPreloads['app/academy.tsx'] ?? []).map((f) => f.replace(/^\//, '')),
  academy = closure(academyFiles),
  union = closure([...bootstrap, ...academyFiles]);
const sum = (files) => ({
  files,
  rawBytes: files.reduce((n, f) => n + byPath.get(f).rawBytes, 0),
  gzipLevel9Bytes: files.reduce((n, f) => n + byPath.get(f).gzipLevel9Bytes, 0),
});
const evidence = {
  measuredAt: new Date().toISOString(),
  app,
  buildManifestSha256: sha(readFileSync(resolve(client, 'vinext-client-entry-manifest.json'))),
  clientAssetsMetadataSha256: sha(readFileSync(resolve(app, 'dist/server/vinext-client-assets.js'))),
  files: rows.sort((a, b) => b.rawBytes - a.rawBytes),
  bootstrapStaticClosure: sum(bootstrap),
  academyReferencedStaticClosure: sum(academy),
  unionStaticClosure: sum(union),
  limits: [
    'Exact existing emitted file sizes and computed static import closure only',
    'gzipLevel9Bytes is a local deterministic encoding calculation, not observed served transfer',
    'No request, transfer, cache behavior or timing is inferred from this emitted file inventory.',
  ],
};
mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
console.log(
  JSON.stringify({
    largest: rows[0],
    unionStaticClosure: evidence.unionStaticClosure,
    limits: evidence.limits,
  }),
);
