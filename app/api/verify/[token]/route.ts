import { findPublicCredential } from '@/app/verify/lookup';
import { NOT_FOUND_BODY, PUBLIC_HEADERS } from '@/lib/academy-credential-public';
export const dynamic = 'force-dynamic';
/** Public, read-only, no auth. Unknown, malformed and not-shared tokens all return the same 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params,
    r = await findPublicCredential(token);
  if (r.state === 'found') return Response.json(r.credential, { status: 200, headers: PUBLIC_HEADERS });
  if (r.state === 'unavailable')
    return Response.json(
      { error: 'Verification is temporarily unavailable.' },
      { status: 503, headers: PUBLIC_HEADERS },
    );
  return Response.json(NOT_FOUND_BODY, { status: 404, headers: PUBLIC_HEADERS });
}
