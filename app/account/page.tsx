import {requireChatGPTUser} from '../chatgpt-auth';
import {DeleteAccount} from './delete-account';
export const dynamic = 'force-dynamic';

export default async function Account() {
  const user = await requireChatGPTUser('/account');
  return <main className="workspace" style={{maxWidth: 640}}><DeleteAccount email={user.email} /></main>;
}
