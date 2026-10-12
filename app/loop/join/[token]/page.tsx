// ACA-US-2.2: join from an invite. The notice and the age question come before sign-in, so no account is made for
// anyone under 18. Consent choices are recorded with the notice version and time.
import { env } from '@/lib/platform-env';
import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
import { openInvite } from '@/lib/loop/enrolment';
import { Shell, attempt, Refused } from '../../shell';
import { JoinForm } from '../../client';
import s from '../../loop.module.css';
export const dynamic = 'force-dynamic';

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!env.DB) throw new Error('The Academy database is unavailable.');
  const db = env.DB;
  const invite = await attempt(() => openInvite(db, token));
  if (!invite.ok)
    return (
      <Shell title="Join Aplyd Academy" screen="join">
        <Refused message={invite.message} />
      </Shell>
    );
  const v = invite.value,
    user = await getChatGPTUser();
  return (
    <Shell title={`Join ${v.orgName} on Aplyd Academy`} screen="join">
      <p>
        Hello {v.firstName}. You are invited as {v.role === 'admin' ? 'the admin' : `a ${v.role}`}.
      </p>
      {v.notice && (
        <section className={s.card} aria-labelledby="notice-h">
          <h2 id="notice-h">How your data is used</h2>
          <div className={s.prewrap}>{v.notice.body}</div>
          <p className={s.muted}>Notice version {v.notice.version}</p>
        </section>
      )}
      <JoinForm
        token={token}
        learner={v.learner}
        signedIn={!!user}
        emailMatches={!!user && user.email.toLowerCase() === v.email}
        hasPhone={v.hasPhone}
        schoolStudent={v.schoolStudent}
        signInHref={chatGPTSignInPath(`/loop/join/${token}`)}
      />
    </Shell>
  );
}
