// ACA-US-12.5: help from any screen: a short FAQ in simple English and a way to report a problem.
import {Shell, pageContext} from '../shell';
import {ActionForm} from '../client';
import s from '../loop.module.css';
export const dynamic = 'force-dynamic';

const FAQ: [string, string][] = [
  ['What do I do each week?', 'Open your task, use your own real work, ask the coach for hints if you want, and submit a short note on what changed. It takes about 20 minutes.'],
  ['Who can see my files?', 'Only you. Your association admin and facilitators see numbers for the whole group, never your files or answers.'],
  ['Why does the coach not give me the answer?', 'The coach gives hints first so you build the skill. After you send your own attempt, you can see a worked answer.'],
  ['The AI help is paused. What now?', 'Your task and the checked guidance still work. Do the task without AI and submit as usual.'],
  ['How do I stop reminders?', 'Go to Settings and turn reminders off, or reply STOP to a WhatsApp or SMS reminder.'],
  ['How do I get or delete my data?', 'Go to Settings. You can download your data at any time or delete your account and all your data.'],
];

export default async function Help({searchParams}: {searchParams: Promise<{screen?: string}>}) {
  const screen = ((await searchParams).screen ?? 'unknown').slice(0, 60);
  const {db, user} = await pageContext(`/loop/help?screen=${encodeURIComponent(screen)}`);
  const mine = (await db.prepare(`SELECT m.id, o.name FROM loop_members m JOIN loop_orgs o ON o.id=m.org_id WHERE m.user_id=? AND m.status='joined' ORDER BY o.name`).bind(user.userId).all<{id: string; name: string}>()).results;
  const orgs = [...new Map(mine.map(x => [x.name, x])).values()];
  return (
    <Shell title="Help" screen="help">
      <section className={s.card} aria-labelledby="faq-h"><h2 id="faq-h">Common questions</h2>
        {FAQ.map(([q, a]) => <details key={q}><summary><strong>{q}</strong></summary><p>{a}</p></details>)}
      </section>
      <section className={s.card} aria-labelledby="rep-h"><h2 id="rep-h">Report a problem</h2>
        <p className={s.muted}>A facilitator will get back to you. Do not include other people’s private details.</p>
        <ActionForm action="help.report" params={{screen}} fields={[
          ...(orgs.length > 1 ? [{name: 'memberId', label: 'Which organisation is this about?', type: 'select' as const, options: orgs.map(o => [o.id, o.name] as [string, string])}] : []),
          {name: 'body', label: 'What went wrong?', type: 'textarea', required: true, rows: 4},
          {name: 'kind', label: 'Type of problem', type: 'select', options: [['problem', 'Something does not work'], ['content', 'Content is wrong'], ['security', 'Security or privacy issue']]},
        ]} submit="Send report" done="stay" success="Thank you. We have your report and will reply." />
      </section>
    </Shell>
  );
}
