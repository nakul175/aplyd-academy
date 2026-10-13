import { redirect } from 'next/navigation';
import Academy from './academy';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
// The product is the practice loop (/loop). The earlier workspace tool stays reachable at /classic and through
// team-workspace links (/?workspace=tw-...), which open it directly.
export default async function Home({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const selected =
    typeof workspace === 'string' && /^tw-[a-z0-9-]{20,80}$/i.test(workspace) ? workspace : undefined;
  if (!selected) redirect('/loop');
  await requireChatGPTUser('/?workspace=' + encodeURIComponent(selected));
  return <Academy initialWorkspace={selected} />;
}
