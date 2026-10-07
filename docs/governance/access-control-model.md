# Access-control model (item 21)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a role, scope or gate changes. Agent-drafted from the repository; not reviewed by a person.

Canonical detail: [permission matrix (33 rows)](../implementation-review-v0.13/permission-matrix.tsv) and [shared-workspaces.md](../shared-workspaces.md). This page is the summary and the layering.

## Layers (outermost first)

1. **Network and site gate.** Droplet: Caddy basic auth, one line per email in `/etc/saha/aplyd-academy.users`. Hosted copy: owner-private platform policy (one owner, no groups). Site access and Academy membership are separate; an Academy invitation cannot admit anyone to the site (README "Access").
2. **Identity.** Subject and email come only from trusted headers (`app/chatgpt-auth.ts`); on the droplet `oai-authenticated-user-id` is `droplet:<email>`. Request fields cannot impersonate a recipient.
3. **Account scope.** Personal lab: row keyed by owner id; never becomes a shared workspace.
4. **Workspace membership and role.** Current, active membership required for shared commands. Removed members keep read-only own history and lose discussion and protected commands.
5. **Role plus cohort scope plus assignment.** Server decides; client projections grant nothing.
6. **Independence rules.** Self-assessment and original-assessor appeal review are forbidden; support requester cannot handle own request; content author cannot approve own draft.

## Roles (shared workspace)

| Role | Can | Cannot |
|---|---|---|
| Owner (admin) | members, invitations, cohorts, content studio, admin history, operational summaries | read learner evidence without being assigned |
| Learner | own drafts, attempts, feedback, appeals, records, enrolled boards | see others' evidence |
| Facilitator | scoped roster/progress, board | submitted fields, scores, feedback |
| Assessor | explicitly assigned submissions in scope | be the learner |
| Appeal reviewer | assigned appeal and original decision | be the learner or original assessor |
| Moderator | scoped posts, reports, moderation history | grade; owner role alone does not moderate |

Staff roles are scoped to named cohorts; restoring a role does not restore an assignment. Support: requester and eligible assigned handler see bodies; owners see queue metadata only.

## Operator access (droplet)

Root on the droplet can read the database file and all content. Who holds root: TBD (owner: Nakul Jain). `saha` runs the service with no login shell. Caddy reads the users file (group `caddy`, mode 0640).

## Evidence and limits

Rules are enforced in `lib/academy-teams.ts`, `lib/academy-support.ts`, `lib/academy-authoring.ts` and routes, tested by the suites in the as-built evidence. Hosted header integrity and multi-user hosted access were not exercised in those tests (docs/implementation-review-v0.13). Access reviews (periodic recertification) are not defined: TBD (owner: Nakul Jain).
