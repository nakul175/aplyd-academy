// ACA-US-6.4: delete my account and personal data. Needs the signed-in session and the typed confirmation.
import { env } from '@/lib/platform-env';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { eraseAccount } from '@/lib/auth/erasure';
import { SignInError } from '@/lib/auth/email-otp';
import { json, readJson, failure, clearedCookie } from '@/lib/auth/http';
export const dynamic = 'force-dynamic';
const CONFIRMATION = 'DELETE MY DATA';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const user = await getChatGPTUser();
    if (!user) throw new SignInError('Sign in to delete your data.', 401);
    if (!env.DB) throw new SignInError('Deletion is temporarily unavailable.', 503);
    if (body.confirm !== CONFIRMATION) throw new SignInError(`Type ${CONFIRMATION} to confirm.`, 400);
    const result = await eraseAccount(env.DB, user.userId);
    if (!result.erased)
      return json(
        {
          erased: false,
          error: `You belong to ${result.teams} shared workspace(s). Ask the workspace admin to remove you first, or file a data request there; then delete your account here.`,
        },
        409,
      );
    return json({ erased: true }, 200, { 'Set-Cookie': clearedCookie });
  } catch (e) {
    return failure(e);
  }
}
