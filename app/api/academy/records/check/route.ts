import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { RuleError } from '@/lib/academy-engine';
import { RecordCheckError } from '@/lib/academy-record-check';
import {
  parseRecordCheckRequest,
  checkSavedPracticeRecord,
  assertRecordRevision,
  type SavedRecordRow,
} from '@/lib/academy-record-service';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const response = (value: unknown, status = 200) => Response.json(value, { status, headers });
/** A read-only POST keeps private references out of browser URLs and query logs. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new RecordCheckError('Use your Academy to check a private record.', 403);
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim() !== 'application/json')
      throw new RecordCheckError('Use a JSON record-check request.', 415);
    const raw = await request.text();
    if (raw.length > 2000 || new TextEncoder().encode(raw).byteLength > 4000)
      throw new RecordCheckError('This record-check request is too large.', 413);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new RecordCheckError('The record-check request is not valid JSON.', 400);
    }
    const input = parseRecordCheckRequest(value),
      user = await getChatGPTUser();
    if (!user) throw new RecordCheckError('Sign in to check your private learning record.', 401);
    const db = env.DB;
    if (!db) throw new RecordCheckError('Your private record check is temporarily unavailable.', 503);
    const load = () =>
      input.workspaceId === null
        ? db
            .prepare('SELECT data,revision FROM academy_workspaces WHERE owner=?')
            .bind(user.userId)
            .first<SavedRecordRow>()
        : db
            .prepare('SELECT data,revision FROM academy_teams WHERE id=?')
            .bind(input.workspaceId)
            .first<SavedRecordRow>();
    const row = await load();
    if (input.workspaceId !== null && !row)
      throw new RecordCheckError('This private learning space is unavailable for your account.', 404);
    const result = await checkSavedPracticeRecord({
      user,
      request: input,
      row,
      checkedAt: new Date().toISOString(),
    });
    // Hashing awaits WebCrypto. Do not publish a result if membership/assignment or
    // learning changed while that work ran. This is an as-of check, not a lock.
    const current =
      input.workspaceId === null
        ? await db
            .prepare('SELECT revision FROM academy_workspaces WHERE owner=?')
            .bind(user.userId)
            .first<{ revision: number }>()
        : await db
            .prepare('SELECT revision FROM academy_teams WHERE id=?')
            .bind(input.workspaceId)
            .first<{ revision: number }>();
    if (input.workspaceId !== null && !current)
      throw new RecordCheckError('Your learning space changed. Refresh before checking this record.', 409);
    assertRecordRevision(current?.revision ?? 0, input.sourceRevision);
    return response(result);
  } catch (error) {
    if (error instanceof RecordCheckError || error instanceof RuleError)
      return response({ error: error.message }, error.status);
    // Stored evidence, identifiers, request bodies and exception details stay out of logs.
    return response(
      { error: 'The private record check could not be completed. No learning data was changed.' },
      503,
    );
  }
}
