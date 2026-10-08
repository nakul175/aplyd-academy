'use client';
import { CurrentPrivateRecordStatus } from './academy-record-status';
import { useState } from 'react';
import { ClipboardCheck, ShieldCheck, FileCheck2, MessageSquare, BookOpen, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import curriculum from '@/lib/academy-curriculum';
import { useAcademy } from './academy-context';
import { AccommodationsForReview, MethodPicker, AccommodationDecisions } from './academy-accommodations';
import { Field, Head, Empty, Tag, Pick, date, FormError } from './academy-ui';
export function StudioView() {
  const { state } = useAcademy(),
    [selected, setSelected] = useState('');
  const reviews = state.enrollments.flatMap((e: any) =>
      e.attempts.filter((a: any) => !a.decision).map((a: any) => ({ e, a })),
    ),
    appeals = state.enrollments.flatMap((e: any) =>
      e.appeals
        .filter((ap: any) => ap.status === 'open')
        .map((ap: any) => ({ e, ap, a: e.attempts.find((a: any) => a.id === ap.attemptId) })),
    ),
    pending = state.posts.filter(
      (p: any) => p.status === 'pending' || p.replies.some((r: any) => r.status === 'pending'),
    ).length;
  const chosen = [...reviews, ...appeals].find((x: any) => (x.ap?.id ?? x.a.id) === selected);
  return (
    <>
      <Head
        eyebrow="STAFF WORKFLOWS"
        title="Feedback that makes learning credible."
        body="Inspect evidence, use the published rubric, and preserve the reasoning behind each decision."
      />
      <div className="notice">
        <ShieldCheck />
        <div>
          <strong>Private review studio · sample staff roles.</strong>
          <p>
            You operate Sample assessor A and Sample reviewer B to test the workflow. These are not separate
            verified staff accounts. Decisions create nonaccredited practice records only.
          </p>
        </div>
      </div>
      <div className="stats-grid">
        <div>
          <strong>{reviews.length}</strong>
          <span>Awaiting assessment</span>
        </div>
        <div>
          <strong>{appeals.length}</strong>
          <span>Independent appeals</span>
        </div>
        <div>
          <strong>{pending}</strong>
          <span>Discussion checks</span>
        </div>
        <div>
          <strong>{state.enrollments.filter((e: any) => e.record?.status === 'active').length}</strong>
          <span>Practice completions</span>
        </div>
      </div>
      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="appeals">Appeals</TabsTrigger>
          <TabsTrigger value="accommodations">Accommodations</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="content">Content & reports</TabsTrigger>
        </TabsList>
        <TabsContent value="assessments">
          {reviews.length ? (
            <div className="review-layout">
              <Queue entries={reviews} selected={selected} onSelect={setSelected} />
              {chosen && !chosen.ap ? (
                <Review key={selected} item={chosen} onDone={() => setSelected('')} />
              ) : (
                <Empty
                  icon={ClipboardCheck}
                  title="Choose a submission"
                  body="Read the evidence before scoring. Decisions are retained as immutable history."
                />
              )}
            </div>
          ) : (
            <Empty
              icon={FileCheck2}
              title="No submissions waiting"
              body="A learner must complete the lessons and submit a practical assessment before review."
            />
          )}
        </TabsContent>
        <TabsContent value="appeals">
          {appeals.length ? (
            <div className="review-layout">
              <Queue entries={appeals} selected={selected} onSelect={setSelected} />
              {chosen?.ap ? (
                <Review key={selected} item={chosen} onDone={() => setSelected('')} />
              ) : (
                <Empty
                  icon={ShieldCheck}
                  title="Choose an appeal"
                  body="Only Sample reviewer B may resolve an appeal to an assessment by Sample assessor A."
                />
              )}
            </div>
          ) : (
            <Empty
              icon={ShieldCheck}
              title="No open appeals"
              body="Learners may request independent review within 14 days of a decision."
            />
          )}
        </TabsContent>
        <TabsContent value="moderation">
          <Moderation />
        </TabsContent>
        <TabsContent value="accommodations">
          <AccommodationsTab />
        </TabsContent>
        <TabsContent value="content">
          <ContentReport />
        </TabsContent>
      </Tabs>
    </>
  );
}
function AccommodationsTab() {
  const { state, team } = useAcademy();
  const entries = team
    ? (team.accommodationQueue ?? [])
    : state.enrollments.filter((e: any) => !e.withdrawn).map((e: any) => ({ enrollment: e }));
  return (
    <section className="panel spacious">
      <p className="eyebrow">ACCOMMODATION REQUESTS</p>
      <p className="form-hint">
        Decide with a written reason. Approval never changes the rubric or pass mark.{' '}
        {team
          ? 'You cannot decide your own request.'
          : 'Sample assessor A decides in this private workspace.'}
      </p>
      <AccommodationDecisions entries={entries} />
    </section>
  );
}
function Queue({ entries, selected, onSelect }: any) {
  const { resolvePinned } = useAcademy();
  return (
    <section className="panel review-queue">
      <p className="eyebrow">SAVED EVIDENCE</p>
      {entries.map((x: any) => {
        const resolved = resolvePinned(x.e),
          p = resolved.available ? resolved.snapshot.program : null,
          id = x.ap?.id ?? x.a.id;
        return (
          <button key={id} className={selected === id ? 'active' : ''} onClick={() => onSelect(id)}>
            <strong>{p?.role ?? 'Saved content unavailable'}</strong>
            <span>{p?.practicalAssessment.title ?? 'Retained submission'}</span>
            <small>
              Attempt {x.a.number} · {date(x.ap?.createdAt ?? x.a.submittedAt)}
            </small>
          </button>
        );
      })}
    </section>
  );
}
export function Review(props: any) {
  const { go, resolvePinned } = useAcademy(),
    resolved = resolvePinned(props.item.e);
  if (!resolved.available)
    return (
      <Empty
        icon={BookOpen}
        title="Pinned review content unavailable"
        body={
          resolved.message + ' Submitted evidence and decisions are retained. No substitute rubric is used.'
        }
        action="Open support & preferences"
        onAction={() => go('settings')}
      />
    );
  return <ResolvedReview {...props} p={resolved.snapshot.program} />;
}
function ResolvedReview({ item: { e, a, ap }, onDone, p }: any) {
  const { cmd, busy, team } = useAcademy(),
    rubric = p.practicalAssessment.rubric,
    gated = rubric.filter((r: any) => r.criticalGate),
    [scores, setScores] = useState<any[]>(rubric.map(() => null)),
    [gates, setGates] = useState(gated.map(() => false)),
    [notes, setNotes] = useState(rubric.map(() => '')),
    [feedback, setFeedback] = useState(''),
    [method, setMethod] = useState<string>(ap ? (a.decision?.method ?? 'practical') : 'practical');
  const score = rubric.reduce((n: number, r: any, i: number) => n + (r.weight * (scores[i] ?? 0)) / 4, 0),
    passed = score >= 70 && gates.every(Boolean);
  return (
    <section className="panel spacious">
      <div className="section-title no-top">
        <h2>{ap ? 'Independent appeal review' : 'Review practical evidence'}</h2>
        <Tag>{team ? 'Assigned to your account' : ap ? 'Sample reviewer B' : 'Sample assessor A'}</Tag>
      </div>
      <p>
        Read every field. Score the demonstrated skill, including its limitations. Reading assistance is{' '}
        {a.assisted ? 'recorded' : 'not recorded'}.
      </p>
      <AccommodationsForReview enrollment={e} />
      <MethodPicker program={p} value={method} onChange={setMethod} />
      {ap && (
        <div className="notice">
          <div>
            <strong>Appeal reason</strong>
            <p className="pre-wrap">{ap.reason}</p>
            <strong>
              Original decision: {a.decision.score}/100 · {a.decision.passed ? 'passed' : 'revision needed'}
            </strong>
            <p>{a.decision.feedback}</p>
          </div>
        </div>
      )}
      {team &&
        ap &&
        team.assigned.some(
          (q: any) =>
            q.kind === 'appeal' &&
            q.ap?.status === 'open' &&
            q.ap.id === ap.id &&
            q.a?.decision?.id === a.decision?.id,
        ) && <CurrentPrivateRecordStatus target={{ decisionId: a.decision.id }} />}
      <details open className="source-packet">
        <summary>Submitted evidence · immutable snapshot</summary>
        {p.practicalAssessment.submissionPrompts.map((f: any) => (
          <div key={f.id}>
            <strong>{f.label}</strong>
            <p className="pre-wrap">{a.fields[f.id]}</p>
          </div>
        ))}
      </details>
      <details className="source-packet">
        <summary>Assessor reference · synthetic passing example</summary>
        <p>{p.practicalAssessment.samplePassingEvidence}</p>
        <p className="mt">
          <strong>Critical failure example: </strong>
          {p.practicalAssessment.sampleCriticalFailure}
        </p>
        <p className="mt">{p.practicalAssessment.assessorNote}</p>
      </details>
      <h3 className="mt">Score each criterion</h3>
      {rubric.map((r: any, i: number) => (
        <section className="review-criterion" key={r.id}>
          <div className="section-title no-top">
            <strong>
              {r.dimension} · {r.weight}%
            </strong>
            <Pick
              label={`${r.dimension} score`}
              value={scores[i] === null ? '' : String(scores[i])}
              onChange={(v: string) => setScores((s) => s.map((x, j) => (j === i ? Number(v) : x)))}
              options={Object.entries(r.anchors).map(([v, label]) => ({
                value: v,
                label: `${v}/4 · ${label}`,
              }))}
            />
          </div>
          {scores[i] !== null && <p>{(r.anchors as any)[String(scores[i])]}</p>}
          <Field
            id={`review-note-${r.id}`}
            rows={2}
            label="Evidence reference and reason"
            help="Name the submitted field and explain this score. At least 10 characters."
            value={notes[i]}
            onChange={(v: string) =>
              setNotes((s: string[]) => s.map((x: string, j: number) => (j === i ? v : x)))
            }
          />
        </section>
      ))}
      <h3 className="mt">Critical safety gates</h3>
      <p>
        Check a gate only when the evidence demonstrates it. An unchecked gate prevents a passing decision.
      </p>
      {gated.map((r: any, i: number) => (
        <label className="check-line gate" key={r.id}>
          <Checkbox
            checked={gates[i]}
            onCheckedChange={(v) =>
              setGates((s: boolean[]) => s.map((x: boolean, j: number) => (j === i ? v === true : x)))
            }
          />
          <span>
            <strong>{r.dimension}: gate met</strong>
            <small>{r.criticalGate}</small>
          </span>
        </label>
      ))}
      <Field
        id="review-feedback"
        label={ap ? 'Independent review explanation' : 'Actionable feedback to the learner'}
        value={feedback}
        onChange={setFeedback}
        help="Explain what was done well, what needs changing, and why. At least 30 characters."
      />
      <div className="decision-summary">
        <strong>{score}/100</strong>
        <Tag tone={passed ? 'success' : 'warning'}>
          {passed ? 'Will meet the practice standard' : 'Will need revision'}
        </Tag>
      </div>
      <Button
        disabled={
          busy ||
          scores.some((s) => s === null) ||
          notes.some((n: string) => n.trim().length < 10) ||
          feedback.trim().length < 30
        }
        onClick={async () => {
          const command: any = {
            type: ap ? 'resolve' : 'assess',
            enrollmentId: e.id,
            actor: ap ? 'reviewer-b' : 'assessor-a',
            scores,
            gates,
            notes,
            feedback,
            method,
          };
          if (team) {
            delete command.actor;
            command.learnerId = e.learnerId;
          }
          if (ap) command.appealId = ap.id;
          else command.attemptId = a.id;
          if (await cmd(command, ap ? 'Independent review saved' : 'Assessment decision saved')) onDone();
        }}
      >
        {ap ? 'Save independent review' : 'Save assessment decision'}
      </Button>
    </section>
  );
}
export function Moderation() {
  const { state, cmd, busy, team } = useAcademy(),
    [reasons, setReasons] = useState<Record<string, string>>({}),
    posts = team
      ? state.posts.filter((p: any) => team.cohorts.some((c: any) => c.id === p.cohortId && c.canModerate))
      : state.posts;
  return (
    <>
      {!posts.length ? (
        <Empty
          icon={MessageSquare}
          title="No discussions to moderate"
          body={
            team
              ? 'Discussion and reports appear only for your scoped moderator cohorts.'
              : 'New discussions and replies wait here before appearing in the private community.'
          }
        />
      ) : (
        posts.map((p: any) => (
          <section className="panel discussion" key={p.id}>
            <div className="section-title no-top">
              <h2>{p.title}</h2>
              <Tag>{p.status}</Tag>
            </div>
            <p className="pre-wrap">{p.body}</p>
            <p className="muted mt">
              {p.author} · {date(p.createdAt)}
            </p>
            {state.reports
              .filter((r: any) => r.postId === p.id)
              .map((r: any) => (
                <div className="notice" key={r.id}>
                  <strong>{r.status === 'open' ? 'Open report' : 'Resolved report'}</strong>
                  <p>{r.reason}</p>
                </div>
              ))}
            <>
              {team && (
                <Field
                  id={`moderation-${p.id}`}
                  rows={2}
                  label="Moderation reason"
                  help="Explain the publication or hiding decision. At least 10 characters; retained for scoped moderators."
                  value={reasons[p.id] || ''}
                  onChange={(v: string) => setReasons((s) => ({ ...s, [p.id]: v }))}
                />
              )}
              <div className="actions">
                <Button
                  disabled={
                    busy || (team && (reasons[p.id] || '').trim().length < 10) || p.status === 'visible'
                  }
                  onClick={() =>
                    cmd(
                      {
                        type: 'moderate',
                        postId: p.id,
                        status: 'visible',
                        ...(team ? { reason: reasons[p.id] } : {}),
                      },
                      team
                        ? 'Discussion published to this cohort'
                        : 'Discussion published in this private workspace',
                    )
                  }
                >
                  Publish discussion
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    busy || (team && (reasons[p.id] || '').trim().length < 10) || p.status === 'hidden'
                  }
                  onClick={() =>
                    cmd(
                      {
                        type: 'moderate',
                        postId: p.id,
                        status: 'hidden',
                        ...(team ? { reason: reasons[p.id] } : {}),
                      },
                      'Discussion hidden and reports closed',
                    )
                  }
                >
                  Hide discussion
                </Button>
              </div>
            </>
            {p.replies.map((r: any) => (
              <div className="reply" key={r.id}>
                <Tag>{r.status}</Tag>
                <p className="pre-wrap">{r.body}</p>
                <>
                  {team && (
                    <Field
                      id={`moderation-${r.id}`}
                      rows={2}
                      label="Reply moderation reason"
                      value={reasons[r.id] || ''}
                      onChange={(v: string) => setReasons((s) => ({ ...s, [r.id]: v }))}
                    />
                  )}
                  <div className="actions">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy || (team && (reasons[r.id] || '').trim().length < 10) || r.status === 'visible'
                      }
                      onClick={() =>
                        cmd({
                          type: 'moderate',
                          postId: p.id,
                          replyId: r.id,
                          status: 'visible',
                          ...(team ? { reason: reasons[r.id] } : {}),
                        })
                      }
                    >
                      Publish reply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy || (team && (reasons[r.id] || '').trim().length < 10) || r.status === 'hidden'
                      }
                      onClick={() =>
                        cmd({
                          type: 'moderate',
                          postId: p.id,
                          replyId: r.id,
                          status: 'hidden',
                          ...(team ? { reason: reasons[r.id] } : {}),
                        })
                      }
                    >
                      Hide reply
                    </Button>
                  </div>
                </>
              </div>
            ))}
            {team &&
              team.moderationHistory
                .filter((h: any) => h.postId === p.id)
                .map((h: any) => (
                  <details className="source-packet" key={h.id}>
                    <summary>
                      {h.actorName} · {h.previousStatus} → {h.status} · {date(h.createdAt)}
                    </summary>
                    <p>{h.reason}</p>
                  </details>
                ))}
          </section>
        ))
      )}
    </>
  );
}
function ContentReport() {
  const { state, cmd, busy } = useAcademy();
  return (
    <>
      <div className="notice">
        <BookOpen />
        <p>
          Curriculum is pinned to {curriculum.contentVersion}. Content updates require a new version. Pausing
          blocks new enrollment and learning actions while preserving saved work.
        </p>
      </div>
      <div className="table-wrap panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pathway</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Lessons completed</TableHead>
              <TableHead>Practice completions</TableHead>
              <TableHead>Content state</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {curriculum.pathways.map((p) => {
              const es = state.enrollments.filter((e: any) => e.programId === p.id && !e.withdrawn);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>{es.length}</TableCell>
                  <TableCell>{es.reduce((n: number, e: any) => n + e.completed.length, 0)}</TableCell>
                  <TableCell>{es.filter((e: any) => e.record?.status === 'active').length}</TableCell>
                  <TableCell>
                    <label className="check-line">
                      <Switch
                        aria-label={`Pause ${p.title}`}
                        checked={state.paused.includes(p.id)}
                        disabled={busy}
                        onCheckedChange={(paused) =>
                          cmd(
                            { type: 'pause', programId: p.id, paused },
                            paused ? 'Pathway paused' : 'Pathway resumed',
                          )
                        }
                      />
                      {state.paused.includes(p.id) ? 'Paused' : 'Available'}
                    </label>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="panel mt">
        <h3>What this report measures</h3>
        <p className="mt">
          These counts describe the current private workspace. They do not measure learning effectiveness or
          job improvement. Reflections are self-reported. Field validation, assessor calibration, and
          recognized issuer arrangements remain separate launch work.
        </p>
      </div>
    </>
  );
}
