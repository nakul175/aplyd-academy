'use client';
import { useEffect, useState, useCallback } from 'react';
import { Building2, LockKeyhole, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcademy } from './academy-context';
import { Head, Tag, date } from './academy-ui';

/** Organisation administration (BR-38). The overview is read only and holds counts only: it comes from
 * GET /api/teams/org, which answers 404 unless you actively own at least one workspace and never returns a
 * workspace you do not own. "Manage" opens one OWNED workspace through the existing GET /api/teams?id=
 * projection and sends the existing protected commands (invite, revoke-invite, member, cohort-status)
 * to POST /api/teams. The server re-checks active ownership of that workspace on every command, so nothing
 * on this screen confers authority. */
const ROLES = ['admin', 'learner', 'facilitator', 'assessor', 'reviewer', 'moderator'];
const STATUSES = ['open', 'paused', 'closed'];
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init }),
    d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error ?? 'This is unavailable.'), { status: r.status });
  return d;
}
const Count = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <div>
    <strong>{value}</strong>
    <small> {label}</small>
    {warn && value > 0 && (
      <>
        {' '}
        <Tag tone="warn">attention</Tag>
      </>
    )}
  </div>
);

export default function OrgAdminView() {
  const { load, activeWorkspace } = useAcademy(),
    [org, setOrg] = useState<any>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [manage, setManage] = useState<string>('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrg(await api('/api/teams/org'));
      setError('');
    } catch (e: any) {
      setOrg(null);
      setError(
        e.status === 404
          ? 'You do not own any workspace, so there is no organisation overview for your account.'
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <div className="org-admin-view">
      <Head
        eyebrow="WORKSPACE OWNER"
        title="Your organisation at a glance."
        body="Counts for the workspaces you own. No learner work, posts or support text appears here."
      />
      <div className="notice">
        <LockKeyhole />
        <p>
          This overview lists only workspaces where you are an active owner. Changes are made one workspace at
          a time and each change is checked again on the server.
        </p>
      </div>
      {loading && (
        <p className="mt">
          <Loader2 className="spin" size={16} /> Loading
        </p>
      )}
      {!loading && error && (
        <section className="panel mt">
          <h2>Not available</h2>
          <p className="mt">{error}</p>
        </section>
      )}
      {org && (
        <>
          <section className="panel mt">
            <div className="section-title no-top">
              <h2>
                <Building2 size={21} /> Totals
              </h2>
              <Tag>
                {org.totals.workspaces} workspace{org.totals.workspaces === 1 ? '' : 's'}
              </Tag>
            </div>
            <div className="two-grid">
              <Count label="active members" value={org.totals.activeMembers} />
              <Count label="pending invitations" value={org.totals.pendingInvites} />
              <Count label="open escalations" value={org.totals.openEscalations} />
              <Count label="overdue escalations" value={org.totals.overdueEscalations} warn />
              <Count label="overdue data requests" value={org.totals.overdueDataRequests} warn />
            </div>
          </section>
          {org.workspaces.map((w: any) => (
            <section className="panel mt" key={w.workspaceId} data-workspace-id={w.workspaceId}>
              <div className="section-title no-top">
                <h2>{w.name}</h2>
                <Tag>{w.context}</Tag>
              </div>
              <div className="two-grid">
                <Count
                  label={`active members (${
                    Object.entries(w.members.byRole)
                      .filter(([, n]: any) => n > 0)
                      .map(([r, n]) => `${n} ${r}`)
                      .join(', ') || 'none'
                  })`}
                  value={w.members.active}
                />
                <Count label="removed members" value={w.members.removed} />
                <Count
                  label={`cohorts (${w.cohorts.open} open, ${w.cohorts.paused} paused, ${w.cohorts.closed} closed) across ${w.cohorts.pathways} pathway${w.cohorts.pathways === 1 ? '' : 's'}`}
                  value={w.cohorts.total}
                />
                <Count label={`seats taken of ${w.seats.capacity}`} value={w.seats.occupied} />
                <Count
                  label={`pending invitations (${w.invites.expired} expired)`}
                  value={w.invites.pending}
                />
                <Count label="open escalations" value={w.escalations.open} />
                <Count label="overdue escalations" value={w.escalations.overdue} warn />
                <Count label="open data requests" value={w.dataRequests.open} />
                <Count label="overdue data requests" value={w.dataRequests.overdue} warn />
                <Count label="recovery requests waiting" value={w.recoveryPending} />
              </div>
              <div className="actions mt">
                <Button
                  variant="outline"
                  onClick={() => setManage(manage === w.workspaceId ? '' : w.workspaceId)}
                >
                  {manage === w.workspaceId ? 'Close management' : 'Manage members, invitations and cohorts'}
                </Button>
              </div>
              {manage === w.workspaceId && (
                <Manage
                  teamId={w.workspaceId}
                  onChanged={async () => {
                    await refresh();
                    if (w.workspaceId === activeWorkspace) await load?.(true);
                  }}
                />
              )}
            </section>
          ))}
          <p className="form-hint mt">Generated {date(org.generatedAt)}.</p>
        </>
      )}
    </div>
  );
}

function Manage({ teamId, onChanged }: { teamId: string; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<any>(null),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(''),
    [iRoles, setIRoles] = useState<string[]>(['learner']),
    [link, setLink] = useState(''),
    [edit, setEdit] = useState<Record<string, any>>({});
  const read = useCallback(async () => {
    try {
      setData(await api('/api/teams?id=' + encodeURIComponent(teamId)));
      setErr('');
    } catch (e: any) {
      setData(null);
      setErr(e.message);
    }
  }, [teamId]);
  useEffect(() => {
    void read();
  }, [read]);
  async function send(command: any) {
    if (busy || !data) return false;
    setBusy(true);
    setErr('');
    try {
      await api('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, revision: data.revision, actionId: crypto.randomUUID(), command }),
      });
      await read();
      await onChanged();
      return true;
    } catch (e: any) {
      setErr(e.message);
      await read();
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (err && !data)
    return (
      <p className="mt" role="alert">
        {err}
      </p>
    );
  if (!data)
    return (
      <p className="mt">
        <Loader2 className="spin" size={16} /> Loading
      </p>
    );
  const team = data.team,
    cohorts: any[] = team.cohorts ?? [],
    members: any[] = team.members ?? [],
    invites: any[] = (team.invites ?? []).filter((i: any) => i.status === 'active');
  if (!members.length && !team.roles?.includes('admin'))
    return <p className="mt">You are not an active owner of this workspace.</p>;
  const mem = (m: any) => edit[m.userId] ?? { roles: m.roles, scopes: m.scopes, active: m.active },
    toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="mt">
      {err && (
        <div role="alert" className="notice error-notice">
          <p>{err}</p>
        </div>
      )}
      <h3>Cohorts</h3>
      <ul className="operations-list">
        {cohorts.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong> · {c.occupied}/{c.capacity} seats · <Tag>{c.status}</Tag>{' '}
            {STATUSES.filter((s) => s !== c.status).map((s) => (
              <Button
                key={s}
                variant="outline"
                disabled={busy}
                onClick={() => send({ type: 'cohort-status', cohortId: c.id, status: s })}
              >
                {s === 'paused' ? 'Pause' : s === 'open' ? 'Open' : 'Close'}
              </Button>
            ))}
          </li>
        ))}
      </ul>
      <h3 className="mt">Invitations</h3>
      <ul className="operations-list">
        {invites.map((i) => (
          <li key={i.id}>
            {i.email} · {i.roles.join(', ')} · expires {date(i.expiresAt)}{' '}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => send({ type: 'revoke-invite', inviteId: i.id })}
            >
              Revoke
            </Button>
          </li>
        ))}
        {!invites.length && <li>No active invitations.</li>}
      </ul>
      <div className="field">
        <label htmlFor={'org-invite-' + teamId}>Invite a sign-in account email</label>
        <input
          id={'org-invite-' + teamId}
          type="email"
          value={email}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <fieldset className="mt">
        <legend>Roles for the invitation</legend>
        {ROLES.map((r) => (
          <label key={r}>
            <input
              type="checkbox"
              checked={iRoles.includes(r)}
              onChange={() => setIRoles(toggle(iRoles, r))}
            />{' '}
            {r}{' '}
          </label>
        ))}
      </fieldset>
      <Button
        className="mt"
        disabled={busy || !email.trim() || !iRoles.length}
        onClick={async () => {
          const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('');
          if (await send({ type: 'invite', email, roles: iRoles, scopes: [], token })) {
            setLink(location.origin + '/join?token=' + token);
            setEmail('');
          }
        }}
      >
        Create invitation link
      </Button>
      {link && (
        <p className="form-hint mt">
          Copy this link now; it is shown once. Staff cohort scopes can be set after the invitation is
          accepted. Nothing was sent. <code>{link}</code>
        </p>
      )}
      <h3 className="mt">Members, roles and cohort scope</h3>
      {members.map((m) => {
        const e = mem(m);
        return (
          <div className="panel mt" key={m.userId}>
            <p>
              <strong>{m.name}</strong> · {m.active ? 'active' : 'removed'}
            </p>
            <fieldset>
              <legend>Roles</legend>
              {ROLES.map((r) => (
                <label key={r}>
                  <input
                    type="checkbox"
                    checked={e.roles.includes(r)}
                    onChange={() => setEdit({ ...edit, [m.userId]: { ...e, roles: toggle(e.roles, r) } })}
                  />{' '}
                  {r}{' '}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Staff cohort scope</legend>
              {cohorts.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={e.scopes.includes(c.id)}
                    onChange={() =>
                      setEdit({ ...edit, [m.userId]: { ...e, scopes: toggle(e.scopes, c.id) } })
                    }
                  />{' '}
                  {c.title}{' '}
                </label>
              ))}
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={e.active}
                onChange={() => setEdit({ ...edit, [m.userId]: { ...e, active: !e.active } })}
              />{' '}
              Active member
            </label>
            <Button
              className="mt"
              disabled={busy || !edit[m.userId] || !e.roles.length}
              onClick={async () => {
                if (
                  await send({
                    type: 'member',
                    userId: m.userId,
                    roles: e.roles,
                    scopes: e.scopes,
                    active: e.active,
                  })
                ) {
                  const { [m.userId]: _, ...rest } = edit;
                  setEdit(rest);
                }
              }}
            >
              Save access
            </Button>
          </div>
        );
      })}
    </div>
  );
}
