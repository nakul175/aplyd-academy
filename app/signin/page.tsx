import {redirect} from 'next/navigation';
import {getChatGPTUser} from '../chatgpt-auth';
import {SignInForm} from './signin-form';
export const dynamic = 'force-dynamic';

// Only same-site relative paths are allowed as the destination after sign-in.
function safeReturn(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/signin') || value.startsWith('/signout')) return '/';
  return value.slice(0, 500);
}

export default async function SignIn({searchParams}: {searchParams: Promise<{return_to?: string}>}) {
  const returnTo = safeReturn((await searchParams).return_to);
  if (await getChatGPTUser()) redirect(returnTo);
  return <main className="workspace" style={{maxWidth: 520}}><SignInForm returnTo={returnTo} /></main>;
}
