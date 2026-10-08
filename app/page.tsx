import Academy from './academy';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const selected =
    typeof workspace === 'string' && /^tw-[a-z0-9-]{20,80}$/i.test(workspace) ? workspace : undefined;
  await requireChatGPTUser(selected ? '/?workspace=' + encodeURIComponent(selected) : '/');
  return <Academy initialWorkspace={selected} />;
}
