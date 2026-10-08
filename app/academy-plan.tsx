'use client';
import { useState, useEffect } from 'react';
import { CalendarDays, Target, BookOpen, LockKeyhole, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  learningPlanSummary,
  learnerNextAction,
  enrollmentNextAction,
  readLearningPlan,
  type PlanTaskKind,
} from '@/lib/academy-plan';
import { NextUsefulStep } from './academy-learner-guidance';
import { OwnWeeklyReview } from './academy-weekly-review';
import { LEGACY_CONTENT_VERSION } from '@/lib/academy-curriculum';
import { planOptions } from '@/lib/academy-engine';

import { useAcademy } from './academy-context';
import { Field, Head, Empty, Tag, Pick, FormError } from './academy-ui';

export function usePlanOptions() {
  const { team, contentContext } = useAcademy();
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const refresh = () => setNow(new Date().toISOString());
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return planOptions(
    now,
    team
      ? { memberActive: team.active, canLearn: team.roles.includes('learner'), cohorts: team.cohorts }
      : {},
    contentContext,
  );
}
export function NextActionCard({ location = 'overview' }: { location?: 'overview' | 'plan' }) {
  const { state, team, go, resolvePinned } = useAcademy(),
    options = usePlanOptions();
  let next;
  try {
    next = learnerNextAction(state, options);
  } catch {
    return (
      <section className="panel">
        <h2>Your plan needs a check</h2>
        <p className="mt">Your course work is retained. Ask for help with your learning plan.</p>
        <Button className="mt" variant="outline" onClick={() => go('support')}>
          Open Support & help
        </Button>
      </section>
    );
  }
  const enrollment = next.enrollmentId
    ? state.enrollments.find((e: any) => e.id === next.enrollmentId)
    : null;
  const pinned = enrollment ? resolvePinned(enrollment) : null;
  return (
    <NextUsefulStep
      next={next}
      location={location}
      context={{
        mode: team ? 'shared' : 'personal',
        contentAvailable: enrollment ? pinned?.available : undefined,
        canLearn: options.canLearn,
        offlineSeed:
          !!pinned?.available &&
          pinned.snapshot.ref.scope === 'global' &&
          pinned.snapshot.ref.versionId === LEGACY_CONTENT_VERSION &&
          pinned.snapshot.language === 'en',
      }}
    />
  );
}
export function PlanView() {
  const { state, team, cmd, busy, go } = useAcademy(),
    options = usePlanOptions();
  let summary;
  try {
    summary = learningPlanSummary(state, options);
  } catch {
    return (
      <Empty
        icon={LockKeyhole}
        title="Your plan needs a format review"
        body="Your saved learning remains available. Export your own workspace and ask for support."
        action="Open Support & help"
        onAction={() => go('support')}
      />
    );
  }
  return <PlanPage summary={summary} options={options} />;
}
function PlanPage({ summary, options }: any) {
  const { state, team, cmd, busy, go } = useAcademy(),
    saved = summary.plan,
    [goal, setGoal] = useState(saved.goal),
    [personalGoal, setPersonalGoal] = useState(saved.personalGoal),
    [weeklyMinutes, setWeeklyMinutes] = useState(String(saved.weeklyMinutes)),
    [timeZone, setTimeZone] = useState(saved.timeZone),
    [reminders, setReminders] = useState(saved.remindersEnabled),
    [editing, setEditing] = useState<any>(undefined),
    [kind, setKind] = useState<PlanTaskKind>('practice');
  const enrolments = state.enrollments.filter((e: any) => !e.withdrawn);
  return (
    <>
      <Head
        eyebrow="SMALL STEPS. USEFUL HABITS."
        title="My learning plan"
        body="Choose a work goal and make room for practice. This plan is private to you."
      />
      <div className="plan-intro">
        <div>
          <Target />
          <strong>A plan you control</strong>
          <p>Set your own pace. Planned minutes describe your intention, not verified time spent.</p>
        </div>
        <div>
          <LockKeyhole />
          <strong>Your goals stay private</strong>
          <p>Owners, facilitators, peers and assigned assessors do not receive your planning notes.</p>
        </div>
      </div>
      {team && !team.active && (
        <div className="notice">
          <p>
            Workspace access was removed. Your own plan and learning history remain readable and exportable.
          </p>
        </div>
      )}
      {summary.reminders.length > 0 && (
        <div className="notice plan-reminder" role="status">
          <CalendarDays />
          <div>
            <strong>
              {summary.reminders.length} planned{' '}
              {summary.reminders.length === 1 ? 'activity needs' : 'activities need'} a look
            </strong>
            <p>
              Due today or on an earlier date in {saved.timeZone}. This notice appears when Academy is open.
            </p>
          </div>
        </div>
      )}
      <OwnWeeklyReview summary={summary} observedAt={options.now} />
      <div className="two-grid mt">
        <section className="panel spacious">
          <h2>My work goal</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await cmd(
                {
                  type: 'learning-plan',
                  goal,
                  personalGoal,
                  weeklyMinutes: Number(weeklyMinutes),
                  timeZone,
                  remindersEnabled: reminders,
                },
                'Your private learning plan was saved',
              );
            }}
          >
            <div className="field">
              <label>Goal theme</label>
              <Pick
                label="Goal theme"
                value={goal}
                onChange={setGoal}
                options={[
                  { value: 'explore', label: 'Explore a useful skill' },
                  { value: 'records', label: 'Keep better work records' },
                  { value: 'check-draft', label: 'Check an AI draft carefully' },
                  { value: 'clear-response', label: 'Write a clearer response' },
                  { value: 'expert-questions', label: 'Prepare questions for an expert' },
                ]}
              />
            </div>
            <Field
              id="plan-goal"
              label="My personal work goal"
              help="Optional. Use a general work goal without real private records."
              value={personalGoal}
              onChange={setPersonalGoal}
              maxLength={200}
              rows={2}
            />
            <div className="two-grid">
              <div className="field">
                <label htmlFor="plan-minutes">Weekly learning minutes</label>
                <input
                  id="plan-minutes"
                  type="number"
                  min="10"
                  max="600"
                  step="1"
                  required
                  value={weeklyMinutes}
                  onChange={(e) => setWeeklyMinutes(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="plan-zone">Plan timezone</label>
                <input
                  id="plan-zone"
                  required
                  maxLength={80}
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  aria-describedby="plan-zone-help"
                />
                <p id="plan-zone-help">For example: Asia/Kolkata or UTC.</p>
              </div>
            </div>
            <div className="toggle-line">
              <div>
                <strong>Optional reminders in Academy</strong>
                <p>
                  Show due notices here when you open Academy. No email, phone or push reminders are sent.
                </p>
              </div>
              <Switch
                aria-label="Show in-app learning reminders"
                checked={reminders}
                disabled={busy}
                onCheckedChange={setReminders}
              />
            </div>
            <p className="form-hint" role="status">
              {goal !== saved.goal ||
              personalGoal !== saved.personalGoal ||
              Number(weeklyMinutes) !== saved.weeklyMinutes ||
              timeZone !== saved.timeZone ||
              reminders !== saved.remindersEnabled
                ? 'Changes not saved. Save your plan to use these preferences.'
                : 'Your plan preferences are saved.'}
            </p>
            <Button type="submit" disabled={busy}>
              Save learning plan
            </Button>
          </form>
        </section>
        <NextActionCard location="plan" />
      </div>
      <div className="section-title">
        <div>
          <h2>My planned activities</h2>
          <p>Course progress comes from saved course actions. Private practice is self-reported.</p>
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            setKind('practice');
            setEditing(null);
          }}
        >
          <CalendarDays size={17} />
          Add practice activity
        </Button>
      </div>
      {!summary.tasks.length ? (
        <Empty
          icon={CalendarDays}
          title="Start with one useful activity"
          body="Plan private practice, a lesson, a practical submission or a work reflection. You can leave the date open."
        />
      ) : (
        <div className="plan-task-grid">
          {summary.tasks.map((task: any) => (
            <section key={task.id} data-plan-task-id={task.id} className="panel plan-task">
              <div className="section-title no-top">
                <Tag tone={task.status === 'done' ? 'success' : task.blocked ? 'warning' : ''}>
                  {task.label}
                </Tag>
                <span>{task.plannedMinutes} planned minutes</span>
              </div>
              <h3>{task.title}</h3>
              <p className="mt">
                {task.dueDate
                  ? `${task.dueDate} · ${task.due === 'earlier' ? 'Earlier planned date' : task.due === 'today' ? 'Today' : 'Upcoming'}`
                  : 'Unscheduled'}{' '}
                · {saved.timeZone}
              </p>
              {task.note && (
                <p className="pre-wrap mt">
                  <strong>My private note: </strong>
                  {task.note}
                </p>
              )}
              {task.blockedReason && <p className="form-hint">{task.blockedReason}</p>}
              {task.completedAt && (
                <p className="form-hint">
                  Saved completion:{' '}
                  {new Date(task.completedAt).toLocaleString('en-IN', { timeZone: saved.timeZone })}
                </p>
              )}
              <div className="actions">
                {task.kind === 'practice' && task.status === 'planned' && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      cmd(
                        { type: 'plan-task-status', taskId: task.id, status: 'done' },
                        'Private practice marked complete · self-reported',
                      )
                    }
                  >
                    Mark practice complete
                  </Button>
                )}
                {task.kind !== 'practice' && task.status === 'planned' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const e = state.enrollments.find((e: any) => e.id === task.enrollmentId);
                      if (!e) {
                        go('settings');
                        return;
                      }
                      const a = enrollmentNextAction(state, e, options);
                      go(task.kind === 'reflection' ? 'credentials' : a.view, a.programId ?? '', {
                        tab: task.kind === 'practical' && !task.blocked ? 'assessment' : a.tab,
                        lessonId: task.kind === 'lesson' && !task.blocked ? task.lessonId : a.lessonId,
                      });
                    }}
                  >
                    {task.blocked ? 'View saved learning' : 'Open planned learning'}
                  </Button>
                )}
                {task.status === 'planned' && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      cmd(
                        { type: 'plan-task-status', taskId: task.id, status: 'skipped' },
                        'Activity skipped · course evidence retained',
                      )
                    }
                  >
                    Skip activity
                  </Button>
                )}
                {(task.status === 'skipped' || (task.kind === 'practice' && task.status === 'done')) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      cmd(
                        { type: 'plan-task-status', taskId: task.id, status: 'planned' },
                        'Activity returned to your plan',
                      )
                    }
                  >
                    Plan again
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setKind(task.kind);
                    setEditing(task);
                  }}
                >
                  Edit planned activity
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    cmd(
                      { type: 'plan-task-remove', taskId: task.id },
                      'Planning item removed · course evidence retained',
                    )
                  }
                >
                  Remove planning item
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <ActivityDialog
          key={editing?.id ?? 'new'}
          open={editing !== undefined}
          editing={editing}
          kind={kind}
          setKind={setKind}
          onClose={() => setEditing(undefined)}
          enrolments={enrolments}
        />
      )}
    </>
  );
}
function ActivityDialog({ open, editing, kind, setKind, onClose, enrolments }: any) {
  const { state, cmd, busy, resolvePinned } = useAcademy(),
    [title, setTitle] = useState(editing?.kind === 'practice' ? editing.title : ''),
    [enrollmentId, setEnrollmentId] = useState(editing?.enrollmentId ?? ''),
    [lessonId, setLessonId] = useState(editing?.lessonId ?? ''),
    [dueDate, setDueDate] = useState(editing?.dueDate ?? ''),
    [minutes, setMinutes] = useState(String(editing?.plannedMinutes ?? 15)),
    [note, setNote] = useState(editing?.note ?? '');
  const e = enrolments.find((e: any) => e.id === enrollmentId),
    resolved = e ? resolvePinned(e) : null,
    p = resolved?.available ? resolved.snapshot.program : undefined;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <FormError />
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit planned activity' : 'Add a planned activity'}</DialogTitle>
          <DialogDescription>
            Use only general or fictional information. Your note is private. Removing a planning item keeps
            course evidence.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const c: any = {
              type: 'plan-task',
              dueDate: dueDate || null,
              plannedMinutes: Number(minutes),
              note,
            };
            if (editing) {
              c.taskId = editing.id;
              if (kind === 'practice') c.title = title;
            } else {
              c.kind = kind;
              if (kind === 'practice') c.title = title;
              else {
                c.enrollmentId = enrollmentId;
                if (kind === 'lesson') c.lessonId = lessonId;
              }
            }
            if (await cmd(c, 'Planned activity saved')) onClose();
          }}
        >
          {!editing && (
            <div className="field">
              <label>Activity type</label>
              <Pick
                label="Activity type"
                value={kind}
                onChange={(v: any) => {
                  setKind(v);
                  setEnrollmentId('');
                  setLessonId('');
                  setMinutes(v === 'practical' ? '35' : '15');
                }}
                options={[
                  { value: 'practice', label: 'Private practice' },
                  { value: 'lesson', label: 'Lesson' },
                  { value: 'practical', label: 'Practical submission' },
                  { value: 'reflection', label: 'Work reflection' },
                ]}
              />
            </div>
          )}
          {kind === 'practice' ? (
            <div className="field">
              <label htmlFor="plan-title">Practice activity title</label>
              <input
                id="plan-title"
                required
                minLength={3}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          ) : editing ? (
            <p className="mt">
              <strong>{editing.title}</strong>
              <br />
              This activity keeps its original enrollment and lesson link.
            </p>
          ) : (
            <>
              <div className="field">
                <label>Enrollment for activity</label>
                <Pick
                  label="Enrollment for activity"
                  value={enrollmentId}
                  onChange={(v: string) => {
                    setEnrollmentId(v);
                    setLessonId('');
                  }}
                  options={enrolments.map((e: any) => {
                    const r = resolvePinned(e);
                    return {
                      value: e.id,
                      label: r.available ? r.snapshot.program.title : 'Saved content unavailable',
                    };
                  })}
                />
              </div>
              {kind === 'lesson' && (
                <div className="field">
                  <label>Lesson for activity</label>
                  <Pick
                    label="Lesson for activity"
                    value={lessonId}
                    onChange={(id: string) => {
                      setLessonId(id);
                      setMinutes(String(p?.lessons.find((l: any) => l.id === id)?.estimatedMinutes ?? 25));
                    }}
                    options={(p?.lessons ?? [])
                      .filter((l: any) => !e?.completed.includes(l.id))
                      .map((l: any) => ({ value: l.id, label: l.title }))}
                  />
                </div>
              )}
              {resolved && !resolved.available && <p className="form-hint">{resolved.message}</p>}
            </>
          )}
          <div className="two-grid">
            <div className="field">
              <label htmlFor="plan-date">Planned date (optional)</label>
              <input
                id="plan-date"
                type="date"
                min="1900-01-01"
                max="2200-12-31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="task-minutes">Planned minutes</label>
              <input
                id="task-minutes"
                type="number"
                min="5"
                max="240"
                step="1"
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <Field
            id="plan-note"
            label="Private planning note"
            value={note}
            onChange={setNote}
            maxLength={500}
            rows={3}
          />
          <div className="actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                (!editing && kind !== 'practice' && (!enrollmentId || (kind === 'lesson' && !lessonId)))
              }
            >
              Save planned activity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
