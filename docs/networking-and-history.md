# Cohort networking and protected workspace history · v0.3

Shared workspaces have real scheduled practice sessions and an explicitly opted-in directory. The personal lab retains its proposed session formats and private interest choices. No meeting provider, message sender or mentor marketplace is connected.

## Directory

`network-profile` stores the authenticated member's choice, short introduction, controlled learning focus and up to five cohorts. Existing `profile.networking` preferences never create a listing. The consent dialog previews the current member name. Cards contain a random profile reference, display name, introduction, focus and only cohort intersections currently accessible to both viewer and subject. Email, account subject, staff roles, evidence and private goals are excluded. Member-authored introductions may contain their own text; the UI asks them to exclude private information.

Opt-out removes the listing immediately. Loss of cohort authority removes the affected consent scope; loss of all scopes disables the listing. Restoring membership or re-enrolling does not silently restore consent. Active members can learn and reserve sessions without a directory profile.

## Sessions

Only owners or facilitators scoped to the exact cohort can create a session; its host is the authenticated creator. Title, purpose, joining instructions, UTC start/end and capacity are validated server-side. Impossible dates reject. Start must be future and within 180 days; duration is at most three hours; capacity is 1–100; the pilot stores at most 100 sessions. Display uses the device timezone.

RSVP is self-only. It requires current cohort authority, a scheduled future session, a current eligible host, an unpaused cohort and an available place. The team's one-revision database CAS serializes competing reservations. Occupied places count current eligible confirmed registrations. Lost future-session access cancels the registration permanently; membership restoration and re-enrollment require a fresh capacity-checked reservation.

Joining instructions are returned only to the current host and currently authorized confirmed participants. Ordinary cohort members receive safe session summaries without participant rosters or other attendance. A current host receives the operational roster. Owners may cancel sessions with a retained reason; an authorized host may cancel their own. Ended sessions cannot be cancelled. When a host loses permission, bookings stop; an owner can cancel and arrange a replacement. Host reassignment, rescheduling, provider booking, recordings and direct messaging are deferred.

The UI refreshes its clock every 30 seconds and on visibility change. A manual refresh retrieves newly saved reservations and cancellations. No background notification delivery is implied.

## Attendance

The current eligible host records observed attendance from session start until seven days after its end. A registration must have been confirmed at the start; a later cancellation does not erase that historical interval. This pilot additionally requires current participant cohort eligibility before a new host attendance decision. Attendance corrections append history rather than overwrite marks. Capacity is not an attendance record; attendance does not complete lessons, prove competence or issue a practice record.

Each member's own reservation/attendance history remains readable and exportable after cohort or workspace access ends. This history contains session summary and their own attendance reasons; no joining instructions, account subjects or other participants. Current host rosters exclude people who no longer have cohort access.

## Protective storage and archival history

Ordinary shared-workspace growth is limited to 1,200,000 UTF-8 bytes. A 1,800,000-byte ceiling reserves capacity for access removal/reduction, invite revocation, cohort pause/close, content hiding, directory opt-out and session cancellations. Privilege grants, access restoration and new content cannot consume that reserve. Any size-decreasing write remains permitted. The higher protective limit accommodates workspaces accepted by the prior 1.5 MB rule.

Administrative and moderation histories keep their newest 200 entries in the working aggregate. Older entries are copied into `academy_team_history` in the same D1 transaction as the workspace revision update and durable action receipt. Any packet failure rolls back the entire mutation. Learner submissions, decisions and evidence are not removed by this helper. Applied migrations 0000–0003 remain unchanged; generated additive migration 0004 creates only the history table.

`GET /api/teams/history?teamId=...&before=...` returns up to five packets and an exclusive cursor. Membership and history come from one read batch. Owners receive administrative history; only currently scoped moderators receive the matching cohort moderation history. Removed accounts and unrelated roles cannot read packets. Directory listing now selects only workspace/member summaries from D1, while membership discovery still scans JSON in this bounded pilot.

See `test-evidence.json` for executed rule, database, browser and accessibility checks. Local identity fixtures do not verify hosted dispatcher authentication or real participant site access.
