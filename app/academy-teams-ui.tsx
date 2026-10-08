'use client';
import { LearningAccessPreferences } from './academy-inclusive-learning';
import { readLearningPlan } from '@/lib/academy-plan';
import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  ShieldCheck,
  BookOpen,
  ClipboardCheck,
  Copy,
  LockKeyhole,
  FileCheck2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  useAcademy,
  useWorkspaceDraft,
  useOperationsNavigation,
  focusOperationItem,
  cancelOperationNavigation,
} from './academy-context';
import { Field, Head, Empty, Tag, Pick, date, FormError } from './academy-ui';
import dynamic from 'next/dynamic';
import { AcademyViewLoading } from './academy-view-loading';
import { ContextSelect } from './academy-context-select';
import curriculum from '@/lib/academy-curriculum';
import { ArchivedHistory } from './academy-history';
import { AccommodationDecisions } from './academy-accommodations';
const ContentStudio = dynamic(() => import('./academy-authoring').then((m) => m.ContentStudio), {
  loading: AcademyViewLoading,
});
const Review = dynamic(() => import('./academy-studio').then((m) => m.Review), {
  loading: AcademyViewLoading,
});
const Moderation = dynamic(() => import('./academy-studio').then((m) => m.Moderation), {
  loading: AcademyViewLoading,
});
const roleNames: any = {
  admin: 'Workspace owner',
  learner: 'Learner',
  facilitator: 'Facilitator',
  assessor: 'Assessor',
  reviewer: 'Appeal reviewer',
  moderator: 'Moderator',
};
const roleDescriptions: any = {
  admin: 'Manage members, cohorts and assignments; no automatic access to evidence.',
  learner: 'Enroll, practise, submit your own evidence and join cohort discussions.',
  facilitator: 'See progress summaries for selected cohorts; no private evidence.',
  assessor: 'Review only explicitly assigned submissions in selected cohorts.',
  reviewer: 'Resolve only assigned appeals; must be independent of the learner and assessor.',
  moderator: 'Read reports and publish or hide discussion in selected cohorts.',
};
function download(name: string, data: any) {
  const a = document.createElement('a'),
    url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Roles({ value, onChange }: any) {
  return (
    <fieldset className="role-options">
      <legend>Account permissions</legend>
      {Object.entries(roleNames).map(([id, name]: any) => (
        <label className="check-line" key={id}>
          <Checkbox
            checked={value.includes(id)}
            onCheckedChange={(v) => onChange(v ? [...value, id] : value.filter((r: string) => r !== id))}
          />
          <span>
            <strong>{name}</strong>
            <small>{roleDescriptions[id]}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
function Scopes({ value, onChange }: any) {
  const { team } = useAcademy();
  return (
    <fieldset className="role-options">
      <legend>Staff access to cohorts</legend>
      <p className="form-hint">
        Staff roles apply only to these cohorts. Learners enroll separately; invitations reserve no seats.
      </p>
      {team.cohorts.map((c: any) => (
        <label className="check-line" key={c.id}>
          <Checkbox
            checked={value.includes(c.id)}
            onCheckedChange={(v) =>
              onChange(v ? [...value, c.id] : value.filter((id: string) => id !== c.id))
            }
          />
          <span>{c.title}</span>
        </label>
      ))}
      {!team.cohorts.length && <p>Create a cohort before assigning staff access.</p>}
    </fieldset>
  );
}
export function TeamsView() {
  const { team, workspaces, selectWorkspace, invitationToken, cohortOffer, setOperationTarget } =
      useAcademy(),
    [create, setCreate] = useState(false),
    [tab, setTab] = useState('cohorts');
  useEffect(() => {
    if (cohortOffer?.workspaceId === team?.id) setTab('cohorts');
  }, [cohortOffer, team?.id]);
  useOperationsNavigation('teams', (target) => {
    const section = target.section ?? 'cohorts';
    if (!team?.active) return;
    if (['members', 'invites', 'assignments', 'content'].includes(section) && !team.roles.includes('admin'))
      return;
    if (section === 'progress' && !team.roles.some((r: string) => ['admin', 'facilitator'].includes(r)))
      return;
    setTab(section);
    if (section === 'content') return false;
    focusOperationItem(
      section === 'assignments' ? 'data-assignment-id' : 'data-cohort-id',
      target.id,
      target.navigation,
    );
  });
  const admin = team?.roles.includes('admin');
  return (
    <>
      <Head
        eyebrow="LEARNING TOGETHER"
        title={team ? team.name : 'Give learning a place to grow.'}
        body={
          team
            ? team.purpose
            : 'Create a shared workspace, invite the right people, and offer practical learning with accountable review.'
        }
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          New workspace
        </Button>
      </Head>
      {invitationToken && <Invitation />}
      <div className="notice">
        <LockKeyhole />
        <div>
          <strong>Personal practice stays personal.</strong>
          <p>
            A shared workspace starts fresh. Your lab drafts, sample reviews and discussions are never copied
            into it. Site access and Academy membership are separate: an invitation does not open the
            privately hosted site to its recipient.
          </p>
        </div>
      </div>
      {!team ? (
        <>
          <div className="two-grid">
            {workspaces.map((w: any) => (
              <button key={w.id} className="panel workspace-card" onClick={() => selectWorkspace(w.id)}>
                <div className="course-icon">
                  <Building2 />
                </div>
                <h2>{w.name}</h2>
                <p>
                  {w.active
                    ? w.roles.map((r: string) => roleNames[r]).join(' · ')
                    : 'Access removed · own learning history only'}
                </p>
                <span className="text-button">Open workspace →</span>
              </button>
            ))}
          </div>
          {!workspaces.length && (
            <Empty
              icon={Users}
              title="Your first shared workspace"
              body="Start with a small adult pilot. Create a cohort, then invite learners and separate staff using their sign-in account email."
              action="Create a workspace"
              onAction={() => setCreate(true)}
            />
          )}
          <div className="three-grid mt">
            <section className="panel">
              <BookOpen />
              <h3>Learning with a work goal</h3>
              <p className="mt">
                Offer a pinned draft pathway for farmers, business owners or public servants.
              </p>
            </section>
            <section className="panel">
              <ClipboardCheck />
              <h3>Someone accountable for review</h3>
              <p className="mt">
                An assigned assessor reviews evidence. A different account handles appeals.
              </p>
            </section>
            <section className="panel">
              <ShieldCheck />
              <h3>A protected learning circle</h3>
              <p className="mt">Discussion stays within its cohort and appears after moderation.</p>
            </section>
          </div>
        </>
      ) : !team.active ? (
        <Empty
          icon={LockKeyhole}
          title="Your membership is no longer active"
          body="You can read and export your own saved learning and records. Ask a workspace owner to restore access before continuing."
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(next) => {
            cancelOperationNavigation();
            setOperationTarget(null);
            setTab(next);
          }}
        >
          <TabsList>
            <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            {admin && (
              <>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invites">Invitations</TabsTrigger>
                <TabsTrigger value="assignments">Review assignments</TabsTrigger>
                <TabsTrigger value="content">Content studio</TabsTrigger>
              </>
            )}
            {(admin || team.roles.includes('facilitator')) && (
              <TabsTrigger value="progress">Progress</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="cohorts">
            <Cohorts />
          </TabsContent>
          {admin && (
            <>
              <TabsContent value="members">
                <Members />
              </TabsContent>
              <TabsContent value="invites">
                <Invites />
              </TabsContent>
              <TabsContent value="assignments">
                <Assignments />
              </TabsContent>
              <TabsContent value="content">{tab === 'content' && <ContentStudio />}</TabsContent>
            </>
          )}
          <TabsContent value="progress">
            <ProgressSummary />
          </TabsContent>
        </Tabs>
      )}
      <CreateWorkspace open={create} onOpenChange={setCreate} />
    </>
  );
}
function CreateWorkspace({ open, onOpenChange }: any) {
  const { teamCmd, busy, go } = useAcademy(),
    [name, setName] = useState(''),
    [purpose, setPurpose] = useState(''),
    [context, setContext] = useState('msme');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <FormError />
        <DialogHeader>
          <DialogTitle>Create a shared Academy workspace</DialogTitle>
          <DialogDescription>
            You become its owner and a learner. New learning starts separately from your personal practice
            lab.
          </DialogDescription>
        </DialogHeader>
        <div className="field">
          <label htmlFor="workspace-name">Workspace name</label>
          <input
            id="workspace-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MSME customer-work pilot"
          />
        </div>
        <Field
          id="workspace-purpose"
          label="What should this group be able to do better?"
          rows={3}
          value={purpose}
          onChange={setPurpose}
        />
        <ContextSelect value={context} onChange={setContext} />
        <p className="form-hint">
          Adult learning pilot · English draft content · Up to 100 members. Work context changes relevance; it
          does not grant staff permissions.
        </p>
        <Button
          disabled={busy || name.trim().length < 3 || purpose.trim().length < 10}
          onClick={async () => {
            if (await teamCmd({ type: 'create', name, purpose, context }, 'Shared workspace created')) {
              onOpenChange(false);
              setName('');
              setPurpose('');
              go('teams');
            }
          }}
        >
          Create workspace
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function Invitation() {
  const { invitationToken, teamCmd, busy, setInvitationToken } = useAcademy(),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/teams?invite=' + encodeURIComponent(invitationToken), { cache: 'no-store' })
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (alive) {
          setPreview(d);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [invitationToken]);
  return (
    <section className="panel invitation-preview">
      <p className="eyebrow">INVITATION TO LEARN TOGETHER</p>
      {loading ? (
        <p>Checking this invitation for your signed-in account…</p>
      ) : error ? (
        <>
          <h2>Invitation unavailable</h2>
          <p role="alert">{error}</p>
          <p className="mt">
            Use the account email the owner invited. An invitation also requires permission to access this
            private site.
          </p>
          <Button
            variant="outline"
            className="mt"
            onClick={() => {
              setInvitationToken('');
              history.replaceState(null, '', '/#teams');
            }}
          >
            Dismiss invitation
          </Button>
        </>
      ) : (
        <>
          <h2>{preview.invitation.workspaceName}</h2>
          <p>{preview.invitation.purpose}</p>
          <p className="mt">
            Invited account: <strong>{preview.invitation.recipientEmail}</strong>
          </p>
          <p>Permissions: {preview.invitation.roles.map((r: string) => roleNames[r]).join(' · ')}</p>
          <p>Staff scope: {preview.invitation.scopes.join(' · ') || 'No staff cohort access'}</p>
          <p>
            Expires {date(preview.invitation.expiresAt)}. Joining creates membership; it does not enroll you
            or reserve a seat.
          </p>
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() =>
                teamCmd({ type: 'accept', token: invitationToken }, 'Workspace membership accepted', {
                  teamId: preview.invitation.workspaceId,
                  revision: preview.revision,
                })
              }
            >
              {preview.invitation.status === 'accepted' ? 'Open my workspace' : 'Accept membership'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInvitationToken('');
                history.replaceState(null, '', '/#teams');
              }}
            >
              Dismiss invitation
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
function Cohorts() {
  const { team, state, cmd, busy, go, resolvePinned, contentVersions, cohortOffer, setCohortOffer } =
      useAcademy(),
    [open, setOpen] = useWorkspaceDraft('cohort-open', false),
    [title, setTitle] = useWorkspaceDraft('cohort-title', ''),
    [programId, setProgramId] = useWorkspaceDraft('cohort-program', curriculum.pathways[1].id),
    [capacity, setCapacity] = useWorkspaceDraft('cohort-capacity', '12');
  useEffect(() => {
    if (cohortOffer?.workspaceId === team.id) {
      setProgramId(cohortOffer.ref.versionId);
      setOpen(true);
      setCohortOffer(null);
    }
  }, [cohortOffer, team.id]);
  const admin = team.roles.includes('admin'),
    publications = (team.content?.publications ?? []).filter(
      (p: any) => p.availability === 'available' && Date.parse(p.reviewDueAt) > Date.now(),
    ),
    chosenPublication = publications.find((p: any) => p.id === programId);
  return (
    <>
      {admin && (
        <div className="section-title">
          <h2>Open a practical learning cohort</h2>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Create cohort
          </Button>
        </div>
      )}
      <div className="two-grid">
        {team.cohorts.map((c: any) => {
          const resolved = resolvePinned(c),
            p = resolved.available ? resolved.snapshot.program : null,
            e = state.enrollments.find((e: any) => e.cohortId === c.id && !e.withdrawn),
            other = state.enrollments.find((e: any) => e.programId === c.programId && !e.withdrawn);
          return (
            <section className="panel cohort-card" key={c.id} data-cohort-id={c.id}>
              <div className="section-title no-top">
                <Tag tone={c.status === 'open' ? 'success' : 'warning'}>
                  {c.status === 'open' && c.occupied >= c.capacity ? 'Full' : c.status}
                </Tag>
                <span>
                  {c.occupied}/{c.capacity} places
                </span>
              </div>
              <h2>{c.title}</h2>
              <p className="mt">
                <strong>{p?.title ?? 'Pinned content unavailable'}</strong>
              </p>
              <p className="mt">
                {p?.promise ?? 'Saved cohort history is retained. Ask for support before new learning.'}
              </p>
              <p className="form-hint">{c.contentNotice}</p>
              <p className="form-hint">
                Version {c.version} · English adult draft · About {p?.estimatedMinutes ?? 'unknown'} minutes
              </p>
              <details className="source-packet">
                <summary>Outcome, evidence and review policy</summary>
                {p ? (
                  <ul>
                    {p.outcomes.map((o: string) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{!resolved.available && resolved.message}</p>
                )}
                <p className="mt">
                  Three guided lessons and a practical submission. Evidence is private to its learner and
                  assigned assessor. An independent account handles appeals within 14 days. Up to three
                  attempts; no timed learning test.
                </p>
                <p className="mt">
                  Nonaccredited practice record. A real reviewer and draft content do not establish
                  professional qualification.
                </p>
                <p className="mt">
                  Enrollment remains until withdrawal; completed learners count toward capacity. A closed
                  cohort accepts no new learners; current members can continue. Pausing retains work and stops
                  learning/review actions.
                </p>
              </details>
              <div className="actions">
                {team.roles.includes('learner') && (
                  <Button
                    disabled={
                      busy ||
                      (!e &&
                        (!p ||
                          c.contentOpen === false ||
                          c.status !== 'open' ||
                          c.occupied >= c.capacity ||
                          !!other))
                    }
                    onClick={async () => {
                      if (
                        e ||
                        (await cmd(
                          { type: 'enroll', programId: c.programId, cohortId: c.id },
                          'Cohort enrollment saved',
                        ))
                      )
                        go('learn', c.programId);
                    }}
                  >
                    {e
                      ? 'Continue my pathway'
                      : other
                        ? 'Already learning this pathway'
                        : 'Enroll in this cohort'}
                  </Button>
                )}
                {c.boardAccess && (
                  <Button variant="outline" onClick={() => go('community', c.id)}>
                    Cohort discussion
                  </Button>
                )}
              </div>
              {admin && (
                <div className="field mt">
                  <label>Cohort availability</label>
                  <Pick
                    label={`Availability for ${c.title}`}
                    value={c.status}
                    onChange={(status: string) =>
                      cmd({ type: 'cohort-status', cohortId: c.id, status }, 'Cohort availability updated')
                    }
                    disabled={busy}
                    options={[
                      { value: 'open', label: 'Open for enrollment' },
                      { value: 'closed', label: 'Closed to new enrollment' },
                      { value: 'paused', label: 'Paused for content review' },
                    ]}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!team.cohorts.length && (
        <Empty
          icon={BookOpen}
          title="No cohorts yet"
          body={
            admin
              ? 'Offer a draft pathway, set a capacity, then invite learners and scoped staff.'
              : 'A workspace owner will publish your cohort here.'
          }
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <FormError />
          <DialogHeader>
            <DialogTitle>Create a learning cohort</DialogTitle>
            <DialogDescription>
              This pins the current draft content and opens enrollment. Separate staff membership and
              assignment are required for review.
            </DialogDescription>
          </DialogHeader>
          <div className="field">
            <label htmlFor="cohort-title">Cohort name</label>
            <input
              id="cohort-title"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Pick
            label="Draft pathway"
            value={programId}
            onChange={setProgramId}
            options={[
              ...curriculum.pathways.map((p) => ({ value: p.id, label: p.title })),
              ...publications.map((p: any) => ({
                value: p.id,
                label: p.title + ' · private ' + p.ref.versionId.slice(0, 11),
              })),
            ]}
          />
          <div className="field">
            <label htmlFor="cohort-capacity">Maximum learners (1–100)</label>
            <input
              id="cohort-capacity"
              type="number"
              min="1"
              max="100"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <Button
            disabled={
              busy ||
              title.trim().length < 3 ||
              !Number.isInteger(Number(capacity)) ||
              Number(capacity) < 1 ||
              Number(capacity) > 100
            }
            onClick={async () => {
              if (
                await cmd(
                  {
                    type: 'cohort-create',
                    title,
                    programId: chosenPublication?.ref.programId ?? programId,
                    ...(chosenPublication ? { contentRef: chosenPublication.ref } : {}),
                    capacity: Number(capacity),
                  },
                  'Cohort opened',
                )
              ) {
                setOpen(false);
                setTitle('');
              }
            }}
          >
            Open cohort
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Members() {
  const { team, cmd, busy } = useAcademy(),
    [chosen, setChosen] = useState<any>(null),
    [roles, setRoles] = useState<string[]>([]),
    [scopes, setScopes] = useState<string[]>([]),
    [active, setActive] = useState(true);
  return (
    <>
      <div className="section-title">
        <h2>Accountable membership</h2>
        <span>{team.members.filter((m: any) => m.active).length} active members</span>
      </div>
      <p className="form-hint">
        Only the platform sign-in identity grants access. Learner display names and work context cannot grant
        a staff role.
      </p>
      <div className="panel table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Cohort scope</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((m: any) => (
              <TableRow key={m.userId}>
                <TableCell>
                  <strong>{m.name}</strong>
                  <p>{m.email}</p>
                </TableCell>
                <TableCell>{m.roles.map((r: string) => roleNames[r]).join(', ')}</TableCell>
                <TableCell>
                  {m.scopes
                    .map((id: string) => team.cohorts.find((c: any) => c.id === id)?.title)
                    .join(', ') || 'No staff scope'}
                </TableCell>
                <TableCell>
                  <Tag tone={m.active ? 'success' : 'warning'}>{m.active ? 'Active' : 'Removed'}</Tag>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setChosen(m);
                      setRoles([...m.roles]);
                      setScopes([...m.scopes]);
                      setActive(m.active);
                    }}
                  >
                    Edit access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog
        open={!!chosen}
        onOpenChange={(v) => {
          if (!v) setChosen(null);
        }}
      >
        <DialogContent className="membership-dialog">
          <FormError />
          <DialogHeader>
            <DialogTitle>Membership: {chosen?.name}</DialogTitle>
            <DialogDescription>
              Changes take effect on the next protected request. Removing staff access releases pending
              assignments. The last active owner must remain.
            </DialogDescription>
          </DialogHeader>
          <Roles value={roles} onChange={setRoles} />
          <Scopes value={scopes} onChange={setScopes} />
          <div className="toggle-line">
            <div>
              <strong>Account may access this workspace</strong>
              <p>Removed members retain read-only access to their own learning history.</p>
            </div>
            <Switch aria-label="Member access active" checked={active} onCheckedChange={setActive} />
          </div>
          <Button
            disabled={busy || !roles.length}
            onClick={async () => {
              if (
                await cmd(
                  { type: 'member', userId: chosen.userId, roles, scopes, active },
                  'Membership updated',
                )
              )
                setChosen(null);
            }}
          >
            Save membership permissions
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Invites() {
  const { team, cmd, busy } = useAcademy(),
    [email, setEmail] = useWorkspaceDraft('invite-email', ''),
    [roles, setRoles] = useWorkspaceDraft<string[]>('invite-roles', ['learner']),
    [scopes, setScopes] = useWorkspaceDraft<string[]>('invite-scopes', []),
    [link, setLink] = useWorkspaceDraft('invite-link', ''),
    [copied, setCopied] = useWorkspaceDraft('invite-copied', false);
  async function create() {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (await cmd({ type: 'invite', email, roles, scopes, token }, 'Invitation created. Nothing sent.')) {
      setLink(location.origin + '/join?token=' + token);
      setCopied(false);
      setEmail('');
    }
  }
  return (
    <>
      <div className="two-grid">
        <section className="panel spacious">
          <h2>Invite a specific account</h2>
          <p className="mt">
            Links last seven days and work only for the invited platform account email. They create
            membership; learners enroll separately.
          </p>
          <div className="field">
            <label htmlFor="invite-email">Sign-in account email</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Roles value={roles} onChange={setRoles} />
          <Scopes value={scopes} onChange={setScopes} />
          <Button disabled={busy || !roles.length || !email.trim()} onClick={create}>
            Create invitation link
          </Button>
        </section>
        <section className="panel spacious">
          <ShieldCheck />
          <h2 className="mt">Access has two gates</h2>
          <p className="mt">
            This site is privately hosted. A recipient needs permission to access the site as well as Academy
            membership. This screen cannot change the hosting audience.
          </p>
          <p className="mt">
            The Academy does not send email or messages. Copy the link and share it through your chosen
            channel after site access is arranged.
          </p>
          {link && (
            <div className="field">
              <label htmlFor="invitation-link">New invitation link</label>
              <input id="invitation-link" readOnly value={link} onFocus={(e) => e.target.select()} />
              <Button
                className="mt"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    document.getElementById('invitation-link')?.focus();
                  }
                }}
              >
                <Copy size={16} />
                {copied ? 'Link copied—nothing sent' : 'Copy invitation link'}
              </Button>
              <p className="form-hint">
                Keep this link until it is accepted. Stored invitations retain only its hash; regenerate by
                revoking and creating a new link if it is lost.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="section-title">
        <h2>Invitation history</h2>
      </div>
      <div className="panel table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.invites.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell>{i.email}</TableCell>
                <TableCell>{i.roles.map((r: string) => roleNames[r]).join(', ')}</TableCell>
                <TableCell>
                  <Tag>
                    {i.status === 'active' && Date.parse(i.expiresAt) <= Date.now() ? 'expired' : i.status}
                  </Tag>
                </TableCell>
                <TableCell>{date(i.expiresAt)}</TableCell>
                <TableCell>
                  {i.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => cmd({ type: 'revoke-invite', inviteId: i.id }, 'Invitation revoked')}
                    >
                      Revoke link
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
function Assignments() {
  const { team, cmd, busy } = useAcademy();
  return (
    <>
      <div className="notice">
        <ShieldCheck />
        <p>
          Assign an independent, scoped staff account. Workspace ownership alone gives no right to read
          submitted evidence. A missing independent reviewer keeps the appeal waiting.
        </p>
      </div>
      {team.pending.map((q: any) => (
        <Assignment key={q.targetId} q={q} />
      ))}
      {!team.pending.length && (
        <Empty
          icon={ClipboardCheck}
          title="No reviews waiting"
          body="Submitted attempts and open appeals appear here with status only. Their evidence is available to assigned staff."
        />
      )}
    </>
  );
}
function Assignment({ q }: any) {
  const { team, cmd, busy } = useAcademy(),
    [staffId, setStaffId] = useState(q.assignedTo || '');
  return (
    <section className="panel assignment-card" data-assignment-id={q.targetId}>
      <div>
        <Tag>{q.kind === 'appeal' ? 'Independent appeal' : 'Assessment'}</Tag>
        <h3>{q.learnerName}</h3>
        <p>
          {team.cohorts.find((c: any) => c.id === q.cohortId)?.title} · {date(q.createdAt)}
        </p>
        <p className="form-hint">
          {q.assignedTo
            ? 'Assigned to ' + team.members.find((m: any) => m.userId === q.assignedTo)?.name
            : q.kind === 'appeal'
              ? 'Waiting for an independent reviewer'
              : 'Waiting for an assessor'}
        </p>
      </div>
      <div>
        {q.eligibleStaff.length ? (
          <>
            <Pick
              label={`Assign ${q.kind} for ${q.learnerName}`}
              value={staffId}
              onChange={setStaffId}
              options={q.eligibleStaff.map((m: any) => ({ value: m.userId, label: m.name }))}
            />
            <Button
              className="mt"
              disabled={busy || !staffId}
              onClick={() =>
                cmd(
                  { type: 'assign', kind: q.kind, targetId: q.targetId, staffId },
                  'Independent staff assignment saved',
                )
              }
            >
              Save assignment
            </Button>
          </>
        ) : (
          <p>
            No eligible staff account. Invite or grant{' '}
            {q.kind === 'appeal' ? 'an appeal reviewer' : 'an assessor'} permission for this cohort.
          </p>
        )}
      </div>
    </section>
  );
}
function ProgressSummary() {
  const { team } = useAcademy();
  return (
    <>
      <div className="notice">
        <LockKeyhole />
        <p>
          Operational progress only. Private drafts, submitted fields, rubric scores and feedback are
          excluded. These counts do not establish job impact.
        </p>
      </div>
      <div className="panel table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Cohort</TableHead>
              <TableHead>Lessons</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.summaries.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell>{r.learnerName}</TableCell>
                <TableCell>{team.cohorts.find((c: any) => c.id === r.cohortId)?.title}</TableCell>
                <TableCell>{r.completedLessons} saved lessons</TableCell>
                <TableCell>
                  {r.status}
                  {r.hasOpenAppeal && r.status !== 'Appeal pending' && (
                    <>
                      <br />
                      <Tag>Appeal pending</Tag>
                    </>
                  )}
                  {r.hasPendingAssessment && r.status !== 'Review pending' && (
                    <>
                      <br />
                      <Tag>Review pending</Tag>
                    </>
                  )}
                  {r.practiceRecordStatus === 'suspended' && (
                    <>
                      <br />
                      <Tag tone="warning">Record suspended</Tag>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!team.summaries.length && (
        <Empty
          icon={Users}
          title="No learning progress yet"
          body="Enrolled learners will appear after they join a cohort."
        />
      )}
    </>
  );
}
export function TeamStudio() {
  const { team } = useAcademy(),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState('assigned'),
    accN = team.accommodationQueue?.length ?? 0;
  const chosen = team.assigned.find((q: any) => q.targetId === selected);
  useOperationsNavigation('studio', (target) => {
    setSelected(team.assigned.some((q: any) => q.targetId === target.id) ? target.id : '');
  });
  return (
    <>
      <Head
        eyebrow="ASSIGNED STAFF WORK"
        title="Give feedback you can stand behind."
        body="Your signed-in membership and current assignment control every evidence read and decision."
      />
      <div className="notice">
        <ShieldCheck />
        <p>
          Separate accounts handle assessment and appeals. Reviews preserve the submitted snapshot and
          original decision. All records remain nonaccredited practice records for draft learning content.
        </p>
      </div>
      <Tabs value={tab === 'accommodations' && !accN ? 'assigned' : tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="assigned">My assigned reviews ({team.assigned.length})</TabsTrigger>
          {team.roles.includes('moderator') && (
            <TabsTrigger value="moderation">Cohort moderation</TabsTrigger>
          )}
          {(team.accommodationQueue?.length ?? 0) > 0 && (
            <TabsTrigger value="accommodations">
              Accommodation requests ({team.accommodationQueue.length})
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="assigned">
          {team.assigned.length ? (
            <div className="review-layout">
              <section className="panel review-queue">
                <p className="eyebrow">ASSIGNED TO YOUR ACCOUNT</p>
                {team.assigned.map((q: any) => (
                  <button
                    key={q.targetId}
                    className={selected === q.targetId ? 'active' : ''}
                    onClick={() => setSelected(q.targetId)}
                  >
                    <strong>{q.learnerName}</strong>
                    <span>{q.kind === 'appeal' ? 'Independent appeal' : 'Practical assessment'}</span>
                    <small>{team.cohorts.find((c: any) => c.id === q.cohortId)?.title}</small>
                  </button>
                ))}
              </section>
              {chosen ? (
                <Review key={chosen.targetId} item={chosen} onDone={() => setSelected('')} />
              ) : (
                <Empty
                  icon={ClipboardCheck}
                  title="Choose an assigned review"
                  body="Only submitted evidence for this assignment is available. Learner drafts remain private."
                />
              )}
            </div>
          ) : (
            <Empty
              icon={FileCheck2}
              title="No reviews assigned to you"
              body="A workspace owner must assign an eligible staff account. Being a staff member alone does not expose evidence."
            />
          )}
        </TabsContent>
        <TabsContent value="moderation">
          <Moderation />
        </TabsContent>
        <TabsContent value="accommodations">
          {/* acceptance fix: the shared-workspace Studio never mounted the staff accommodation decision panel */}
          <section className="panel spacious">
            <p className="eyebrow">ACCOMMODATION REQUESTS</p>
            <p className="form-hint">
              Decide with a written reason. Approval never changes the rubric or pass mark. You cannot decide
              your own request.
            </p>
            <AccommodationDecisions entries={team.accommodationQueue ?? []} />
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
export function TeamPreferences() {
  const { team, state, cmd, busy, go } = useAcademy(),
    [name, setName] = useState(state.profile.name),
    [reading, setReading] = useState(state.profile.reading);
  return (
    <>
      <Head
        eyebrow="YOUR SHARED-WORKSPACE PROFILE"
        title="Keep your learning under your control."
        body="Your personal lab remains separate. Shared-workspace learning and discussion have different visibility."
      />
      <div className="two-grid">
        <section className="panel spacious">
          <h2>Reading & display</h2>
          <div className="field">
            <label htmlFor="shared-name">Learner display name</label>
            <input id="shared-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="toggle-line">
            <span>Comfortable reading mode</span>
            <Switch aria-label="Comfortable reading mode" checked={reading} onCheckedChange={setReading} />
          </div>
          <Button
            disabled={busy || !name.trim()}
            onClick={() =>
              cmd(
                { type: 'profile', ...state.profile, name, reading },
                'Your learning preferences were saved',
              )
            }
          >
            Save my preferences
          </Button>
          <p className="form-hint">
            A display name cannot change sign-in identity, permissions or review attribution.
          </p>
        </section>
        <section className="panel spacious">
          <LockKeyhole />
          <h2 className="mt">Evidence has a narrow audience</h2>
          <p className="mt">
            Drafts belong to you. Submitted evidence is available to its explicitly assigned assessor; an
            assigned appeal reviewer sees the relevant submission, original decision and appeal reason. Owners
            and facilitators receive progress summaries.
          </p>
          <p className="mt">
            Discussions are shared with eligible members of their cohort after moderation. Report details are
            restricted to scoped moderators.
          </p>
          <Button
            className="mt"
            variant="outline"
            onClick={() =>
              download('aplyd-my-shared-learning.json', {
                exportedAt: new Date().toISOString(),
                workspace: team.name,
                profile: state.profile,
                enrollments: state.enrollments,
                followups: state.followups,
                interests: state.interests,
                learningPlan: readLearningPlan(state),
                learningAccess: state.learningAccess ?? null,
                supportRequests: team.support?.mine ?? [],
                sessionHistory: team.network?.history ?? [],
                directoryChoice: team.network?.myProfile ?? null,
              })
            }
          >
            Export my learning & records
          </Button>
          <p className="form-hint">
            Finalized decisions and access history are retained for accountability. This pilot does not yet
            have a shared-record erasure or formal retention workflow.
          </p>
        </section>
      </div>
      <LearningAccessPreferences />
      <ArchivedHistory />
      <section className="panel mt">
        <h2>Access and support</h2>
        <p className="mt">
          Open a private in-app request about invitations, review assignments or cohort access. No staffed
          response time is promised. English draft content, browser read-aloud and untimed practice are
          available. Language preferences and learner-confirmed reading or capture help are available.
          Reviewed translated editions and formal oral accommodations still need approval.
        </p>
        <Button className="mt" variant="outline" onClick={() => go('support')}>
          Open my support requests
        </Button>
        <a className="text-button mt" href="/signout-with-chatgpt?return_to=/" target="_top">
          Sign out of Academy
        </a>
      </section>
    </>
  );
}
