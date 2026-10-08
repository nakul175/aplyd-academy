import Academy from '../academy';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
/** Partner route. A malformed token is still handed to the page so the learner sees a plain "link is not valid" state (the API rejects it with 400) rather than a silent redirect to the overview. */
export default async function Join({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
  await requireChatGPTUser(valid ? '/join?token=' + token : '/join');
  return (
    <Academy
      initialInvitation={valid ? token : typeof token === 'string' && token ? token.slice(0, 200) : undefined}
    />
  );
}
