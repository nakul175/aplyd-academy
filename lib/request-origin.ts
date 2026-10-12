// The origin a same-site request must come from (ADR-0001, Node runtime).
// On Workers, request.url carried the public origin. Behind Next's Node server and a TLS proxy it does not
// (it may read http://localhost:3000), so state-changing routes compare the browser's Origin header with:
//   1. ACADEMY_PUBLIC_ORIGIN, which production must set (for example https://academy.aplyd.org); else
//   2. the host the browser sent (x-forwarded-host, else Host), with the forwarded protocol; else
//   3. request.url, as before (tests that build Request objects directly).
export function expectedOrigin(request: Request): string {
  const configured = process.env.ACADEMY_PUBLIC_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  const url = new URL(request.url);
  // Next's Node server rewrites Host to its own listen address and keeps the browser's host in x-forwarded-host.
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host');
  if (!host) return url.origin;
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}
