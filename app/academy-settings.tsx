'use client';
import { CurrentPrivateRecordStatus } from './academy-record-status';
import { CredentialPanel } from './academy-credential-panel';
import { useState, useEffect } from 'react';
import {
  Award,
  Download,
  ShieldCheck,
  Plug,
  Sprout,
  Building2,
  Landmark,
  HeartPulse,
  Check,
  LockKeyhole,
  Trash2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import curriculum from '@/lib/academy-curriculum';
import { useAcademy } from './academy-context';
import { ContextSelect } from './academy-context-select';
import { Field, Head, Empty, Tag, Pick, date } from './academy-ui';
import { download } from './academy-download';
import { PersonalSnapshotControls } from './academy-snapshot';
import { LearningAccessPreferences } from './academy-inclusive-learning';
import { OnboardingFlow } from './academy-onboarding';
export { ScopedConnectionsView as ConnectionsView } from './academy-ecosystems';
export function AchievementsView() {
  const { state, cmd, busy, go, team, resolvePinned } = useAcademy(),
    [selected, setSelected] = useState(''),
    [reflection, setReflection] = useState(''),
    [before, setBefore] = useState(''),
    [after, setAfter] = useState('');
  const completed = state.enrollments.filter((e: any) => e.record);
  return (
    <>
      <Head
        eyebrow="EVIDENCE OF YOUR LEARNING"
        title="A skill you can explain and apply."
        body="Track your practice completions and reflect on what changes at work."
      />
      {!completed.length ? (
        <Empty
          icon={Award}
          title="Your first achievement starts with practice"
          body={
            team
              ? 'Finish a pathway and submit evidence to a separately assigned assessor.'
              : 'Finish a pathway, submit evidence, and complete the sample human-review workflow.'
          }
          action="Explore learning pathways"
          onAction={() => go('programs')}
        />
      ) : (
        completed.map((e: any) => {
          const resolved = resolvePinned(e),
            p = resolved.available ? resolved.snapshot.program : null,
            r = e.record,
            title = p?.title ?? r.title;
          return (
            <section className="achievement panel" key={e.id}>
              <div className="achievement-mark">
                <Award size={40} />
              </div>
              <div className="achievement-content">
                <p className="eyebrow">APLYD ACADEMY · PRACTICE COMPLETION</p>
                <h2>{title}</h2>
                <p className="mt">{r.claim}</p>
                <div className="actions">
                  <Tag tone={r.status === 'active' ? 'success' : 'warning'}>{r.status}</Tag>
                  <span>Recorded {date(r.issuedAt)}</span>
                </div>
                <p className="form-hint">
                  {r.kind}.{' '}
                  {team
                    ? `Reviewed by ${r.reviewedBy || 'assigned staff'} in ${team.name}.`
                    : 'Sample staff review in your private workspace.'}{' '}
                  This is not an accredited or professional qualification.
                </p>
                <details className="source-packet">
                  <summary>Record provenance & limits</summary>
                  <p>Issuer: {r.issuer}</p>
                  <p>Record reference: {r.id}</p>
                  <p>Learning version: {r.contentVersion}</p>
                  {p ? (
                    p.credentialExclusions.map((x: string) => <p key={x}>{x}</p>)
                  ) : (
                    <p>
                      The pinned course content is unavailable. Stored record claims are retained; newer
                      exclusions have not been substituted.
                    </p>
                  )}
                </details>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      download(`aplyd-practice-${r.id}.json`, {
                        learner: state.profile.name,
                        ...r,
                        exclusions: p?.credentialExclusions ?? null,
                        contentRef: e.contentRef ?? null,
                        contentAvailable: !!p,
                      })
                    }
                  >
                    <Download size={16} />
                    Download my record
                  </Button>
                  <Button variant="outline" onClick={() => go('learn', e.programId)}>
                    View evidence & feedback
                  </Button>
                </div>
                <div className="toggle-line mt">
                  <div>
                    <strong>
                      Share this record: my learning profile export and a demo verification link
                    </strong>
                    <p>
                      This choice is independent of local ecosystem preview preferences. It creates no public
                      page by itself; while it is on, anyone you give your demo verification link to can see
                      that credential's label, pathway, dates and status, but not your name or email.
                    </p>
                  </div>
                  <Switch
                    aria-label={`Include ${title} in learning profile export`}
                    checked={r.share}
                    disabled={busy}
                    onCheckedChange={(enabled) => cmd({ type: 'share', enrollmentId: e.id, enabled })}
                  />
                </div>
                <CredentialPanel e={e} />
                <CurrentPrivateRecordStatus target={{ recordId: r.id }} />
              </div>
            </section>
          );
        })
      )}
      {completed.some((e: any) => e.record.status === 'active') && (
        <section className="panel spacious">
          <p className="eyebrow">CONTINUOUS LEARNING</p>
          <h2>What changed when you put it to work?</h2>
          <p className="mt">
            Record a permitted task, your checks, and what improved or still needs work. Include verification
            time. Keep real private records out of this reflection.
          </p>
          <div className="mt">
            <Pick
              label="Pathway for reflection"
              value={selected}
              onChange={setSelected}
              options={completed
                .filter((e: any) => e.record.status === 'active')
                .map((e: any) => ({ value: e.id, label: e.record?.title ?? 'Saved practice record' }))}
            />
          </div>
          <Field
            id="work-reflection"
            label="My return-to-work reflection"
            value={reflection}
            onChange={setReflection}
          />
          <div className="two-grid">
            <div className="field">
              <label htmlFor="before-time">Time before, in minutes (optional)</label>
              <input
                id="before-time"
                type="number"
                min="0"
                max="10000"
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="after-time">Time with help and checks, in minutes (optional)</label>
              <input
                id="after-time"
                type="number"
                min="0"
                max="10000"
                value={after}
                onChange={(e) => setAfter(e.target.value)}
              />
            </div>
          </div>
          <Button
            disabled={busy || !selected || reflection.trim().length < 30}
            onClick={async () => {
              if (
                await cmd(
                  { type: 'followup', enrollmentId: selected, reflection, before, after },
                  'Work reflection saved',
                )
              ) {
                setReflection('');
                setBefore('');
                setAfter('');
              }
            }}
          >
            Save my reflection
          </Button>
          {state.followups.map((f: any) => (
            <div className="reflection-item" key={f.id}>
              <strong>{date(f.createdAt)}</strong>
              <p className="pre-wrap">{f.reflection}</p>
              {(f.minutesBefore != null || f.minutesAfter != null) && (
                <small>
                  {f.minutesBefore == null ? 'Time before not provided' : `${f.minutesBefore} minutes before`}{' '}
                  ·{' '}
                  {f.minutesAfter == null
                    ? 'Time with help not provided'
                    : `${f.minutesAfter} minutes with help and checks`}
                  . This is your reported example, not verified impact.
                </small>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function SettingsView() {
  const { state, cmd, busy, go, activeWorkspace } = useAcademy(),
    [setup, setSetup] = useState(false),
    [name, setName] = useState(state.profile.name),
    [context, setContext] = useState(state.profile.context),
    [reading, setReading] = useState(state.profile.reading),
    [networking, setNetworking] = useState(state.profile.networking),
    [confirm, setConfirm] = useState(''),
    savedProfile = JSON.stringify(state.profile);
  useEffect(() => {
    setName(state.profile.name);
    setContext(state.profile.context);
    setReading(state.profile.reading);
    setNetworking(state.profile.networking);
  }, [savedProfile]);
  return (
    <>
      <Head
        eyebrow="YOUR LEARNING SPACE"
        title="Make learning work for you."
        body="Choose your preferences and stay in control of your information."
      />
      {setup && <OnboardingFlow key="reopen" mode="reopen" onClose={() => setSetup(false)} />}
      <div className="two-grid">
        <section className="panel spacious">
          <h2>Learning preferences</h2>
          <div className="field">
            <label htmlFor="display-name">Display name</label>
            <input id="display-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Your main work context</label>
            <ContextSelect value={context} onChange={setContext} />
          </div>
          <div className="toggle-line">
            <div>
              <strong>Comfortable reading mode</strong>
              <p>Larger text and a narrower reading area.</p>
            </div>
            <Switch aria-label="Comfortable reading mode" checked={reading} onCheckedChange={setReading} />
          </div>
          <div className="toggle-line">
            <div>
              <strong>Future peer-learning interest</strong>
              <p>Stored privately until a real participation process is available.</p>
            </div>
            <Switch
              aria-label="Future peer-learning interest"
              checked={networking}
              onCheckedChange={setNetworking}
            />
          </div>
          <Button
            disabled={busy || !name.trim()}
            onClick={() =>
              cmd({ type: 'profile', name, context, reading, networking }, 'Learning preferences saved')
            }
          >
            Save preferences
          </Button>
          {activeWorkspace === 'lab' && (
            <div className="actions mt">
              <Button variant="outline" disabled={busy || setup} onClick={() => setSetup(true)}>
                Review guided setup
              </Button>
            </div>
          )}
          <p className="form-hint">
            Your saved editions are in English. Choose language and learning-help requests below.
          </p>
        </section>
        <section className="panel spacious">
          <LockKeyhole size={25} />
          <h2 className="mt">Your data, your choices.</h2>
          <p className="mt">
            This private workspace stores your profile, learning progress, drafts, submitted evidence, sample
            review history, discussions, interests, local preview preferences, scoped test choices and
            receipts, learning plans, and reflections.
          </p>
          <p className="mt">
            Raw evidence is excluded from ecosystem return tests. No external AI call is made by this
            application.
          </p>
          <div className="actions">
            <Button
              variant="outline"
              onClick={() =>
                download('aplyd-academy-my-data.json', { exportedAt: new Date().toISOString(), ...state })
              }
            >
              <Download size={16} />
              Export my workspace
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download('aplyd-learning-profile.json', {
                  name: state.profile.name,
                  records: state.enrollments
                    .filter((e: any) => e.record?.share && e.record.status === 'active')
                    .map((e: any) => e.record),
                })
              }
            >
              Export chosen learning profile
            </Button>
          </div>
          <PersonalSnapshotControls />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="mt" variant="destructive">
                <Trash2 size={16} />
                Delete personal practice lab data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your saved learning data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the current profile, progress, drafts, evidence, review history, discussions,
                  interests, local preview preferences, scoped test choices and receipts, plans, reflections,
                  and unsent personal-lab input. Your encrypted draft copy for this account is also removed
                  from this browser when available. Downloaded files remain on your devices. Minimal action
                  logs keep your account reference, action name, and time. This cannot restore your old
                  learning workspace.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="field">
                <label htmlFor="delete-confirm">Type DELETE to continue</label>
                <input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy || confirm !== 'DELETE'}
                  onClick={async () => {
                    if (await cmd({ type: 'reset' }, 'Your learning workspace was deleted')) {
                      setName('Learner');
                      setContext('msme');
                      setReading(false);
                      setNetworking(false);
                      setConfirm('');
                      go('home');
                    }
                  }}
                >
                  Delete learning data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
      <LearningAccessPreferences />
      <section className="panel mt">
        <h2>Support and accessibility</h2>
        <p className="mt">
          Lesson text can be read aloud when your browser supports it. Practice drafts can be saved, and there
          is no timed learning test. Record reading assistance on your practical submission.
        </p>
        <p className="mt">
          For this private preview, share feedback in the conversation where this Academy was created. No
          support desk or external message delivery is connected.
        </p>
        <form method="post" action="/signout">
          <button className="text-button mt" type="submit">
            Sign out of the private Academy
          </button>
        </form>
        <a className="text-button mt" href="/account">
          Delete my data
        </a>
      </section>
    </>
  );
}
