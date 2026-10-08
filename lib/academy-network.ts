import { RuleError } from './academy-engine';
import type { Team } from './academy-teams';

export const NETWORK_FOCUS = [
  'Checking AI drafts',
  'Work records',
  'Customer operations',
  'Source-based briefs',
  'Careful information handling',
];
type Access = (t: Team, m: any, cohortId: string) => boolean;
const text = (v: any, label: string, min: number, max: number) => {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max)
    throw new RuleError(`${label} needs ${min}–${max} characters.`);
  return v.trim();
};
const exact = (c: any, keys: string[]) => {
  if (Object.keys(c).some((k) => !['type', ...keys].includes(k)))
    throw new RuleError('This request includes unsupported fields.', 400);
};
const network = (t: Team) => t.network ?? { profiles: [], sessions: [] };
const canHost = (m: any, cid: string) =>
  m.active && (m.roles.includes('admin') || (m.roles.includes('facilitator') && m.scopes.includes(cid)));
const eligible = (t: Team, id: string, cid: string, access: Access) => {
  const m = t.members.find((x) => x.userId === id);
  return !!m && access(t, m, cid);
};
const currentSeats = (t: Team, s: any, access: Access) =>
  s.registrations.filter((r: any) => r.status === 'going' && eligible(t, r.userId, s.cohortId, access));
export function reconcileNetworkAccess(t: Team, now: string, access: Access) {
  if (!t.network) return;
  for (const p of t.network.profiles) {
    const remaining = p.cohortIds.filter((id: string) => eligible(t, p.userId, id, access));
    if (remaining.length !== p.cohortIds.length) {
      p.cohortIds = remaining;
      p.updatedAt = now;
      if (!remaining.length) {
        p.enabled = false;
        p.accessRevokedAt = now;
      }
    }
  }
  for (const session of t.network.sessions)
    if (Date.parse(session.startsAt) > Date.parse(now))
      for (const r of session.registrations)
        if (r.status === 'going' && !eligible(t, r.userId, session.cohortId, access))
          Object.assign(r, {
            status: 'cancelled',
            cancelledAt: now,
            updatedAt: now,
            cancellationReason: 'Cohort access ended. Reserve again after access returns.',
          });
}
function session(t: Team, m: any, id: any, access: Access) {
  const s = network(t).sessions.find((s: any) => s.id === id);
  if (!s || !access(t, m, s.cohortId)) throw new RuleError('Session not found for your cohort.', 404);
  return s;
}
function hosted(s: any, m: any) {
  if (s.hostId !== m.userId || !canHost(m, s.cohortId))
    throw new RuleError('Only the current scoped session host can do this.', 403);
}
function time(v: any, label: string) {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString() !== v.replace(/:([0-9]{2})Z$/, ':$1.000Z')
  )
    throw new RuleError(`${label} needs a valid UTC date and time.`);
  return Date.parse(v);
}

// These commands run inside the team's existing revision fence. No directory
// visibility, seat count or host authority is inferred from a client projection.
export function applyNetworkCommand(t: Team, m: any, c: any, now: string, access: Access) {
  t.network ??= { profiles: [], sessions: [] };
  const n = t.network;
  switch (c.type) {
    case 'network-profile': {
      exact(c, ['enabled', 'bio', 'focus', 'cohortIds']);
      if (typeof c.enabled !== 'boolean') throw new RuleError('Choose a directory sharing setting.');
      let p = n.profiles.find((p: any) => p.userId === m.userId);
      if (!c.enabled) {
        if (p) {
          p.enabled = false;
          p.updatedAt = now;
        }
        break;
      }
      if (
        !Array.isArray(c.cohortIds) ||
        !c.cohortIds.length ||
        c.cohortIds.length > 5 ||
        new Set(c.cohortIds).size !== c.cohortIds.length ||
        c.cohortIds.some((id: any) => !t.cohorts.some((x) => x.id === id) || !access(t, m, id))
      )
        throw new RuleError('Choose up to five cohorts you can currently access.', 403);
      if (!NETWORK_FOCUS.includes(c.focus)) throw new RuleError('Choose a learning focus.');
      const bio = text(c.bio, 'Profile introduction', 10, 300);
      if (!p) {
        p = { id: crypto.randomUUID(), userId: m.userId };
        n.profiles.push(p);
      }
      Object.assign(p, {
        enabled: true,
        bio,
        focus: c.focus,
        cohortIds: c.cohortIds,
        consentVersion: 'cohort-directory-1',
        consentedAt: now,
        updatedAt: now,
      });
      break;
    }
    case 'session-create': {
      exact(c, ['cohortId', 'title', 'description', 'startsAt', 'endsAt', 'capacity', 'instructions']);
      const co = t.cohorts.find((x) => x.id === c.cohortId);
      if (!co || !access(t, m, co.id)) throw new RuleError('Cohort not found.', 404);
      if (!canHost(m, co.id))
        throw new RuleError('A workspace owner or scoped facilitator must host sessions.', 403);
      if (co.status === 'paused') throw new RuleError('This cohort is paused.', 409);
      if (n.sessions.length >= 100)
        throw new RuleError('This pilot supports 100 sessions per workspace.', 409);
      const start = time(c.startsAt, 'Start'),
        end = time(c.endsAt, 'End'),
        clock = Date.parse(now);
      if (start <= clock || start > clock + 180 * 86400000 || end <= start || end - start > 180 * 60000)
        throw new RuleError('Schedule a future session within 180 days, lasting up to three hours.');
      if (!Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 100)
        throw new RuleError('Set a session capacity between 1 and 100.');
      n.sessions.push({
        id: crypto.randomUUID(),
        cohortId: co.id,
        hostId: m.userId,
        title: text(c.title, 'Session title', 5, 120),
        description: text(c.description, 'Session purpose', 20, 1000),
        instructions: text(c.instructions, 'Joining instructions', 10, 2000),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        capacity: c.capacity,
        status: 'scheduled',
        createdAt: now,
        registrations: [],
        attendance: [],
      });
      break;
    }
    case 'session-rsvp': {
      exact(c, ['sessionId', 'going']);
      if (typeof c.going !== 'boolean') throw new RuleError('Choose an attendance preference.');
      const s = session(t, m, c.sessionId, access);
      let r = s.registrations.find((r: any) => r.userId === m.userId);
      if (!c.going) {
        if (r && r.status === 'going') {
          r.status = 'cancelled';
          r.cancelledAt = now;
          r.updatedAt = now;
        }
        break;
      }
      if (s.status !== 'scheduled' || Date.parse(s.startsAt) <= Date.parse(now))
        throw new RuleError('This session is no longer accepting places.', 409);
      if (t.cohorts.find((x) => x.id === s.cohortId)?.status === 'paused')
        throw new RuleError('This cohort is paused.', 409);
      if (
        !eligible(t, s.hostId, s.cohortId, access) ||
        !canHost(
          t.members.find((x) => x.userId === s.hostId),
          s.cohortId,
        )
      )
        throw new RuleError(
          'The host no longer has access. Ask the workspace owner to arrange another session.',
          409,
        );
      if (r?.status === 'going') break;
      if (currentSeats(t, s, access).length >= s.capacity)
        throw new RuleError(
          'This session is full. Choose another session or check again after a cancellation.',
          409,
        );
      if (!r) {
        r = { id: crypto.randomUUID(), userId: m.userId, createdAt: now };
        s.registrations.push(r);
      }
      Object.assign(r, { status: 'going', confirmedAt: now, cancelledAt: null, updatedAt: now });
      break;
    }
    case 'session-cancel': {
      exact(c, ['sessionId', 'reason']);
      const s = session(t, m, c.sessionId, access);
      if (!(m.roles.includes('admin') && m.active)) hosted(s, m);
      if (s.status === 'cancelled' || Date.parse(s.endsAt) <= Date.parse(now))
        throw new RuleError('This session is cancelled or has ended.', 409);
      s.status = 'cancelled';
      s.cancellation = {
        reason: text(c.reason, 'Cancellation reason', 10, 1000),
        actor: m.userId,
        actorName: m.name,
        createdAt: now,
      };
      break;
    }
    case 'session-attendance': {
      exact(c, ['sessionId', 'registrationId', 'status', 'reason']);
      const s = session(t, m, c.sessionId, access);
      hosted(s, m);
      if (s.status !== 'scheduled') throw new RuleError('Cancelled sessions cannot record attendance.', 409);
      const clock = Date.parse(now);
      if (clock < Date.parse(s.startsAt) || clock > Date.parse(s.endsAt) + 7 * 86400000)
        throw new RuleError('Record attendance from the start until seven days after the session.');
      const r = s.registrations.find(
        (r: any) =>
          r.id === c.registrationId &&
          Date.parse(r.confirmedAt ?? r.createdAt) <= Date.parse(s.startsAt) &&
          (!r.cancelledAt || Date.parse(r.cancelledAt) > Date.parse(s.startsAt)),
      );
      if (!r || !eligible(t, r.userId, s.cohortId, access))
        throw new RuleError('Eligible registration at the session start not found.', 404);
      if (!['attended', 'absent'].includes(c.status)) throw new RuleError('Choose attended or absent.');
      if (s.attendance.length >= 300)
        throw new RuleError('This session reached its attendance history limit.', 409);
      s.attendance.push({
        id: crypto.randomUUID(),
        registrationId: r.id,
        status: c.status,
        reason: text(c.reason, 'Attendance basis', 10, 500),
        actor: m.userId,
        actorName: m.name,
        createdAt: now,
      });
      break;
    }
    default:
      return false;
  }
  return true;
}

export function projectNetwork(t: Team, m: any, access: Access) {
  const n = network(t),
    self = n.profiles.find((p: any) => p.userId === m.userId),
    myProfile = self
      ? {
          enabled: self.enabled,
          bio: self.bio,
          focus: self.focus,
          cohortIds: self.cohortIds ?? [],
          consentedAt: self.consentedAt,
        }
      : null;
  const history = n.sessions.flatMap((session: any) => {
    const r = session.registrations.find((x: any) => x.userId === m.userId);
    return r
      ? [
          {
            id: session.id,
            title: session.title,
            cohortTitle: t.cohorts.find((x) => x.id === session.cohortId)?.title,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            status: session.status,
            myRsvp: r.status,
            cancellationReason: session.cancellation?.reason ?? r.cancellationReason ?? null,
            attendance: session.attendance
              .filter((a: any) => a.registrationId === r.id)
              .map((a: any) => ({
                id: a.id,
                status: a.status,
                reason: a.reason,
                actorName: a.actorName,
                createdAt: a.createdAt,
              })),
          },
        ]
      : [];
  });
  if (!m.active) return { myProfile, history, directory: [], sessions: [] };
  const directory = n.profiles
    .filter(
      (p: any) =>
        p.enabled && p.cohortIds.some((id: string) => access(t, m, id) && eligible(t, p.userId, id, access)),
    )
    .map((p: any) => ({
      id: p.id,
      name: t.members.find((x) => x.userId === p.userId)?.name,
      bio: p.bio,
      focus: p.focus,
      cohortIds: p.cohortIds.filter((id: string) => access(t, m, id) && eligible(t, p.userId, id, access)),
      isMe: p.userId === m.userId,
    }));
  const sessions = n.sessions
    .filter((s: any) => access(t, m, s.cohortId))
    .map((s: any) => {
      const own = s.registrations.find((r: any) => r.userId === m.userId),
        host = s.hostId === m.userId && canHost(m, s.cohortId),
        seats = currentSeats(t, s, access),
        roster = s.registrations.filter(
          (r: any) =>
            eligible(t, r.userId, s.cohortId, access) &&
            (r.status === 'going' ||
              (r.cancelledAt &&
                Date.parse(r.cancelledAt) > Date.parse(s.startsAt) &&
                Date.parse(r.confirmedAt ?? r.createdAt) <= Date.parse(s.startsAt))),
        ),
        validHost =
          eligible(t, s.hostId, s.cohortId, access) &&
          canHost(
            t.members.find((x) => x.userId === s.hostId),
            s.cohortId,
          );
      const current = (rid: string) => {
        const a = s.attendance.filter((a: any) => a.registrationId === rid).at(-1);
        if (!a) return null;
        const { actor, ...safe } = a;
        return safe;
      };
      return {
        id: s.id,
        cohortId: s.cohortId,
        title: s.title,
        description: s.description,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        capacity: s.capacity,
        occupied: seats.length,
        status: s.status,
        hostName: t.members.find((x) => x.userId === s.hostId)?.name,
        hostAvailable: validHost,
        isHost: host,
        canCancel: host || m.roles.includes('admin'),
        myRsvp: own?.status ?? 'none',
        myAttendance: own ? current(own.id) : null,
        ...(s.cancellation
          ? { cancellation: { reason: s.cancellation.reason, createdAt: s.cancellation.createdAt } }
          : {}),
        ...(s.status === 'scheduled' && validHost && (host || own?.status === 'going')
          ? { instructions: s.instructions }
          : {}),
        ...(host
          ? {
              registrations: roster.map((r: any) => ({
                id: r.id,
                name: t.members.find((x) => x.userId === r.userId)?.name,
                attendance: current(r.id) ?? null,
              })),
              attendanceHistory: s.attendance.map(({ actor, ...a }: any) => a),
            }
          : {}),
      };
    });
  return { myProfile, history, directory, sessions };
}
