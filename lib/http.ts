/**
 * Shared HTTP helpers for route handlers: one set of private-response headers, one JSON responder and one
 * same-origin test, so a security header or the origin rule is changed in one place.
 */

/** Headers for every private (signed-in) response. */
export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
} as const;

/** JSON response with the private-response headers. */
export function noStoreJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

/** True when the request names an Origin that is not this server's own (a cross-site browser request). */
export function hasForeignOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin !== new URL(request.url).origin;
}
