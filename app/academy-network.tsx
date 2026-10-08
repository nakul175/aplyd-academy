'use client';
import { useState, useEffect } from 'react';
import { Users, CalendarDays, ShieldCheck, Plus, Clock, Check, UserRound, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { NETWORK_FOCUS } from '@/lib/academy-network';
import { useAcademy, useOperationsNavigation, focusOperationItem } from './academy-context';
import { Head, Empty, Tag, Field, Pick, FormError } from './academy-ui';

const when = (s: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));
export function TeamNetworkView() {
  const { team, state, cmd, busy, saving, loading, load } = useAcademy(),
    n = team.network ?? { directory: [], sessions: [], myProfile: null },
    cohorts = team.cohorts.filter((c: any) => c.boardAccess),
    hosts = cohorts.filter((c: any) => c.canHost && c.status !== 'paused');
  const [tab, setTab] = useState('sessions'),
    [profileOpen, setProfileOpen] = useState(false),
    [enabled, setEnabled] = useState(false),
    [bio, setBio] = useState(''),
    [focus, setFocus] = useState(NETWORK_FOCUS[0]),
    [shared, setShared] = useState<string[]>([]),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState({
      cohortId: '',
      title: '',
      description: '',
      startsAt: '',
      endsAt: '',
      capacity: '10',
      instructions: '',
    }),
    [cancel, setCancel] = useState<any>(null),
    [reason, setReason] = useState(''),
    [attendance, setAttendance] = useState<any>(null),
    [attendanceStatus, setAttendanceStatus] = useState('attended');
  useOperationsNavigation('network', (target) => {
    setTab('sessions');
    focusOperationItem('data-session-id', target.id, target.navigation);
  });
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const update = () => setClock(Date.now()),
      timer = setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const cancelSource = n.sessions.find(
    (s: any) =>
      s.id === cancel?.id && s.canCancel && s.status === 'scheduled' && clock < Date.parse(s.endsAt),
  );
  const attendanceSession = n.sessions.find(
    (s: any) =>
      s.id === attendance?.sessionId &&
      s.isHost &&
      s.status === 'scheduled' &&
      clock >= Date.parse(s.startsAt) &&
      clock <= Date.parse(s.endsAt) + 7 * 86400000,
  );
  const attendanceRow = attendanceSession?.registrations?.find(
    (r: any) => r.id === attendance?.registrationId,
  );
  const attendanceSource =
    attendanceSession && attendanceRow ? { s: attendanceSession, r: attendanceRow } : null;
  useEffect(() => {
    if (cancel && !cancelSource) setCancel(null);
    if (attendance && !attendanceSource) setAttendance(null);
  }, [cancel, attendance, cancelSource, attendanceSource]);
  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const edit = () => {
    setEnabled(!!n.myProfile?.enabled);
    setBio(n.myProfile?.bio ?? '');
    setFocus(n.myProfile?.focus ?? NETWORK_FOCUS[0]);
    setShared(n.myProfile?.cohortIds ?? []);
    setProfileOpen(true);
  };
  const submitSession = async () => {
    const start = new Date(form.startsAt),
      end = new Date(form.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return;
    if (
      await cmd(
        {
          type: 'session-create',
          ...form,
          capacity: Number(form.capacity),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        },
        'Practice session scheduled',
      )
    ) {
      setCreating(false);
      setForm({
        cohortId: '',
        title: '',
        description: '',
        startsAt: '',
        endsAt: '',
        capacity: '10',
        instructions: '',
      });
    }
  };
  return (
    <>
      <Head
        eyebrow="COHORT CONNECTIONS"
        title="Practise together. Learn from each other."
        body="Meet people in your cohorts and join practical learning sessions."
      >
        <Button variant="outline" disabled={busy} onClick={edit}>
          <UserRound size={17} />
          My directory profile
        </Button>
        {hosts.length > 0 && (
          <Button
            disabled={busy}
            onClick={() => {
              update('cohortId', hosts[0].id);
              setCreating(true);
            }}
          >
            <Plus size={17} />
            Schedule a session
          </Button>
        )}
      </Head>
      <div className="notice">
        <ShieldCheck />
        <p>
          Directory profiles are optional and visible only within the cohorts you choose. Sessions share
          joining instructions with confirmed participants. Attendance records participation; it does not
          establish competence.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sessions">Practice sessions</TabsTrigger>
          <TabsTrigger value="people">Cohort directory</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions">
          <Button className="mt" variant="outline" disabled={saving || loading} onClick={() => load()}>
            Refresh sessions
          </Button>
          <p className="form-hint mt">
            Dates use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Places are
            confirmed when saved.
          </p>
          {n.sessions.length === 0 ? (
            <Empty
              icon={CalendarDays}
              title="Make space for practice"
              body={
                hosts.length
                  ? 'Schedule a small session for fictional tasks, checked drafts, and useful questions.'
                  : 'Scheduled sessions will appear here after your facilitator creates one. Join a cohort to see its sessions.'
              }
            />
          ) : (
            <div className="two-grid mt">
              {[...n.sessions]
                .sort((a: any, b: any) => a.startsAt.localeCompare(b.startsAt))
                .map((s: any) => {
                  const started = Date.parse(s.startsAt) <= clock,
                    ended = Date.parse(s.endsAt) < clock;
                  return (
                    <section className="panel" key={s.id} data-session-id={s.id}>
                      <div className="discussion-meta">
                        <Tag>{cohorts.find((c: any) => c.id === s.cohortId)?.title ?? 'Cohort session'}</Tag>
                        <Tag>
                          {s.status === 'cancelled'
                            ? 'Cancelled'
                            : cohorts.find((c: any) => c.id === s.cohortId)?.status === 'paused'
                              ? 'Cohort paused'
                              : !s.hostAvailable
                                ? 'Host unavailable'
                                : ended
                                  ? 'Ended'
                                  : started
                                    ? 'In progress'
                                    : 'Scheduled'}
                        </Tag>
                      </div>
                      <h2>{s.title}</h2>
                      <p className="mt pre-wrap">{s.description}</p>
                      <p className="line-item mt">
                        <CalendarDays size={17} />
                        {when(s.startsAt)}
                      </p>
                      <p className="line-item">
                        <Clock size={17} />
                        Until {when(s.endsAt)}
                      </p>
                      <p className="muted mt">
                        Hosted by {s.hostName} · {s.occupied} of {s.capacity} places filled
                      </p>
                      {s.cancellation && (
                        <div className="notice mt">
                          <p>Cancelled: {s.cancellation.reason}</p>
                        </div>
                      )}
                      {s.myAttendance && (
                        <p className="mt">
                          <strong>Your attendance: {s.myAttendance.status}</strong>
                          <br />
                          {s.myAttendance.reason}
                        </p>
                      )}
                      {!s.hostAvailable && s.status === 'scheduled' && (
                        <p className="form-hint">
                          The host no longer has permission. A workspace owner can cancel this session and
                          arrange a replacement.
                        </p>
                      )}
                      {s.instructions && (
                        <div className="session-instructions mt">
                          <h3>
                            <MapPin size={17} />
                            Joining instructions
                          </h3>
                          <p className="pre-wrap mt">{s.instructions}</p>
                        </div>
                      )}
                      <div className="actions mt">
                        {s.status === 'scheduled' && s.myRsvp === 'going' ? (
                          <>
                            <Tag>
                              <Check size={15} />
                              Your place is confirmed
                            </Tag>
                            {!started && (
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  cmd(
                                    { type: 'session-rsvp', sessionId: s.id, going: false },
                                    'Session place cancelled',
                                  )
                                }
                              >
                                Cancel my place
                              </Button>
                            )}
                          </>
                        ) : (
                          s.status === 'scheduled' &&
                          !started && (
                            <Button
                              disabled={
                                busy ||
                                !s.hostAvailable ||
                                s.occupied >= s.capacity ||
                                cohorts.find((c: any) => c.id === s.cohortId)?.status === 'paused'
                              }
                              onClick={() =>
                                cmd(
                                  { type: 'session-rsvp', sessionId: s.id, going: true },
                                  'Your session place is confirmed',
                                )
                              }
                            >
                              {s.occupied >= s.capacity ? 'Session full' : 'Reserve a place'}
                            </Button>
                          )
                        )}
                        {s.canCancel && s.status === 'scheduled' && !ended && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              setCancel({ id: s.id });
                              setReason('');
                            }}
                          >
                            Cancel session
                          </Button>
                        )}
                      </div>
                      {s.isHost && (
                        <div className="session-roster mt">
                          <h3>Confirmed participants</h3>
                          {!s.registrations.length ? (
                            <p className="muted mt">No confirmed places yet.</p>
                          ) : (
                            s.registrations.map((r: any) => (
                              <div className="assignment-row" key={r.id}>
                                <div>
                                  <strong>{r.name}</strong>
                                  <p className="muted">{r.attendance?.status ?? 'Attendance not recorded'}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  disabled={
                                    busy ||
                                    !started ||
                                    s.status !== 'scheduled' ||
                                    clock > Date.parse(s.endsAt) + 7 * 86400000
                                  }
                                  onClick={() => {
                                    setAttendance({ sessionId: s.id, registrationId: r.id });
                                    setAttendanceStatus(r.attendance?.status ?? 'attended');
                                    setReason('');
                                  }}
                                >
                                  {r.attendance ? 'Correct attendance' : 'Record attendance'}
                                </Button>
                              </div>
                            ))
                          )}
                          <p className="form-hint mt">
                            The host records observed attendance with a reason. Corrections retain history.
                          </p>
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="people">
          <div className="section-title">
            <h2>People who chose to share</h2>
            <Tag>
              {n.directory.length} profile{n.directory.length === 1 ? '' : 's'}
            </Tag>
          </div>
          {!n.directory.length ? (
            <Empty
              icon={Users}
              title="A directory built on choice"
              body="Choose whether to share a short introduction with your cohorts. You can learn and join sessions without a directory profile."
            />
          ) : (
            <div className="two-grid">
              {n.directory.map((p: any) => (
                <section className="panel" key={p.id}>
                  <div className="discussion-meta">
                    <Tag>{p.focus}</Tag>
                    {p.isMe && <Tag>Your profile</Tag>}
                  </div>
                  <h2>{p.name}</h2>
                  <p className="mt pre-wrap">{p.bio}</p>
                  <p className="muted mt">
                    Shared in{' '}
                    {p.cohortIds
                      .map((id: string) => cohorts.find((c: any) => c.id === id)?.title)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </section>
              ))}
            </div>
          )}
          <p className="form-hint mt">
            Introductions are member contributions. Contact details and submitted learning evidence are
            excluded from directory cards.
          </p>
        </TabsContent>
      </Tabs>
      {(n.history ?? []).length > 0 && (
        <section className="panel mt">
          <h2>Your session history</h2>
          <p className="mt">
            Your own reservations and attendance corrections remain available after cohort access ends. No
            other participant details are included.
          </p>
          {n.history.map((h: any) => (
            <details className="source-packet" key={h.id}>
              <summary>
                {h.title} · {when(h.startsAt)}
              </summary>
              <p>
                {h.cohortTitle} · Session {h.status} · Your reservation {h.myRsvp}
              </p>
              {h.cancellationReason && <p className="mt">{h.cancellationReason}</p>}
              {h.attendance.length === 0 ? (
                <p className="mt">No attendance recorded.</p>
              ) : (
                h.attendance.map((a: any) => (
                  <p className="mt" key={a.id}>
                    <strong>
                      {a.status} · {when(a.createdAt)}
                    </strong>
                    <br />
                    {a.reason} · Recorded by {a.actorName}
                  </p>
                ))
              )}
            </details>
          ))}
        </section>
      )}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <FormError />
          <DialogHeader>
            <DialogTitle>Your cohort directory profile</DialogTitle>
            <DialogDescription>
              Share a short introduction using fictional examples. Keep phone numbers, emails and private work
              records out of your profile. You can remove your listing at any time.
            </DialogDescription>
          </DialogHeader>
          <p className="mt">
            Your listing will display: <strong>{state.profile.name}</strong>
          </p>
          <label className="check-line">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
              aria-label="Share my profile with selected cohorts"
            />
            Share my profile with selected cohorts
          </label>
          {enabled && (
            <>
              {!cohorts.length && (
                <p className="form-hint">
                  Join a cohort before sharing a directory profile. Session participation does not require a
                  profile.
                </p>
              )}
              <Pick
                label="Learning focus"
                value={focus}
                onChange={setFocus}
                options={NETWORK_FOCUS.map((f) => ({ value: f, label: f }))}
              />
              <Field
                id="network-bio"
                maxLength={300}
                label="Introduction · up to 300 characters"
                value={bio}
                onChange={setBio}
              />
              <fieldset className="field">
                <legend>Cohorts that may see this profile · choose up to five</legend>
                {cohorts.map((c: any) => (
                  <label className="check-line" key={c.id}>
                    <Checkbox
                      checked={shared.includes(c.id)}
                      onCheckedChange={(v) =>
                        setShared((x) => (v === true ? [...x, c.id] : x.filter((id) => id !== c.id)))
                      }
                    />
                    {c.title}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <Button
            disabled={
              busy ||
              (enabled && (bio.trim().length < 10 || bio.length > 300 || !shared.length || shared.length > 5))
            }
            onClick={async () => {
              if (
                await cmd(
                  { type: 'network-profile', enabled, bio, focus, cohortIds: shared },
                  enabled ? 'Directory profile shared' : 'Directory listing removed',
                )
              )
                setProfileOpen(false);
            }}
          >
            Save directory choice
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="wide-dialog">
          <FormError />
          <DialogHeader>
            <DialogTitle>Schedule a practice session</DialogTitle>
            <DialogDescription>
              Use a small, focused session with fictional tasks. Dates below use your device timezone. Joining
              instructions are restricted to confirmed participants and the current host.
            </DialogDescription>
          </DialogHeader>
          <Pick
            label="Session cohort"
            value={form.cohortId}
            onChange={(v: string) => update('cohortId', v)}
            options={hosts.map((c: any) => ({ value: c.id, label: c.title }))}
          />
          <div className="field">
            <label htmlFor="session-title">Session title</label>
            <input
              id="session-title"
              maxLength={120}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>
          <Field
            id="session-purpose"
            maxLength={1000}
            label="What will people practise?"
            value={form.description}
            onChange={(v: string) => update('description', v)}
          />
          <div className="two-grid">
            <div className="field">
              <label htmlFor="session-start">Start date and time</label>
              <input
                id="session-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => update('startsAt', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="session-end">End date and time</label>
              <input
                id="session-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => update('endsAt', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="session-capacity">Available places</label>
            <input
              id="session-capacity"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) => update('capacity', e.target.value)}
            />
          </div>
          <Field
            id="session-instructions"
            maxLength={2000}
            label="Where and how to join"
            value={form.instructions}
            onChange={(v: string) => update('instructions', v)}
          />
          <Button
            disabled={
              busy ||
              form.title.trim().length < 5 ||
              form.description.trim().length < 20 ||
              form.instructions.trim().length < 10 ||
              !form.startsAt ||
              !form.endsAt
            }
            onClick={submitSession}
          >
            Schedule session
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!cancelSource || !!attendanceSource}
        onOpenChange={(v) => {
          if (!v) {
            setCancel(null);
            setAttendance(null);
          }
        }}
      >
        <DialogContent>
          <FormError />
          <DialogHeader>
            <DialogTitle>
              {cancelSource
                ? 'Cancel this session'
                : `Attendance for ${attendanceSource?.r.name ?? 'participant'}`}
            </DialogTitle>
            <DialogDescription>
              {cancelSource
                ? 'Confirmed participants will see the cancellation when they open this workspace.'
                : 'Record what you observed. This does not complete a lesson or issue a practice record.'}
            </DialogDescription>
          </DialogHeader>
          {attendanceSource && (
            <Pick
              label="Attendance"
              value={attendanceStatus}
              onChange={setAttendanceStatus}
              options={[
                { value: 'attended', label: 'Attended' },
                { value: 'absent', label: 'Absent' },
              ]}
            />
          )}
          <Field
            id="session-reason"
            maxLength={cancelSource ? 1000 : 500}
            label={cancelSource ? 'Cancellation reason' : 'What supports this attendance record?'}
            value={reason}
            onChange={setReason}
          />
          <Button
            disabled={busy || (!cancelSource && !attendanceSource) || reason.trim().length < 10}
            onClick={async () => {
              let command;
              if (cancelSource) command = { type: 'session-cancel', sessionId: cancelSource.id, reason };
              else if (attendanceSource)
                command = {
                  type: 'session-attendance',
                  sessionId: attendanceSource.s.id,
                  registrationId: attendanceSource.r.id,
                  status: attendanceStatus,
                  reason,
                };
              else return;
              const success = await cmd(command, cancelSource ? 'Session cancelled' : 'Attendance recorded');
              if (success) {
                setCancel(null);
                setAttendance(null);
              }
            }}
          >
            {cancelSource ? 'Confirm cancellation' : 'Save attendance'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
