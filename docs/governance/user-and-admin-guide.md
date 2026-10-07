# User guide and admin guide (item 18)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when screens, roles or the sign-in process change.

There is no single end-user manual. Existing as-built notes describe behaviour for builders; this page is the entry point and lists what is covered and what is not. Content below is a summary of those files, not new behaviour.

## Learner (farmer, MSME owner, public servant)

| Task | Read |
|---|---|
| First run, registration, onboarding | [onboarding-and-registration.md](../onboarding-and-registration.md) |
| Personal practice lab: lessons, quizzes, practical drafts, sample review, appeals, nonaccredited records | README "What works"; [as-built-v0.15.1](../as-built-v0.15.1/functional-design.md) |
| Learning plan, weekly review, recap download | [plans-and-pinned-content.md](../plans-and-pinned-content.md); as-built-v0.14 |
| Join a shared workspace by invitation | [shared-workspaces.md](../shared-workspaces.md) (invitations are recipient-email bound, expire after seven days, links are copied manually) |
| Discussion, practice sessions, RSVP | [networking-and-history.md](../networking-and-history.md) |
| Help requests | [support-and-refresh.md](../support-and-refresh.md) |
| Offline drafts, language and assistance preferences | README; docs/as-built-v0.12 to v0.14 |
| Library | README "Searchable reference library" (20 unchanged originals; downloads do not change learning records) |
| Export or delete your data | in-app data requests and lab-data deletion (privacy-retention-dsr.md) |

Learner-facing reminders: the practice content is fictional and nonaccredited; records are labelled "draft learning content, nonaccredited".

## Workspace owner and staff

| Task | Read |
|---|---|
| Create workspace, invite, assign roles and cohort scopes, set cohort capacity and state | [shared-workspaces.md](../shared-workspaces.md) |
| Authoring and publishing private content, independent owner review | [private-content-studio.md](../private-content-studio.md) |
| Operations view (queues, review dates, session observations) | [workspace-operations.md](../workspace-operations.md) |
| Assess, review appeals, moderate, handle support | access-control-model.md; shared-workspaces.md; support-and-refresh.md |
| Exact course versions and content pins | [plans-and-pinned-content.md](../plans-and-pinned-content.md) |

## Platform administrator (droplet)

Operations are in [runbooks.md](runbooks.md): add or reset a person's sign-in with `aplyd-academy-add-user <email>`, deploy status, restart, rollback, restore. Hosting access is a separate gate from Academy membership: arrange it before a real participant can accept an invitation (README "Access").

## Gaps

- No task-oriented, screenshot-led learner manual and no Hindi guide. TBD (owner: Nakul Jain).
- No admin guide for the v0.17.0 candidate screens (recovery, credentials, accommodations); see docs/CLAUDE-HANDOFF.md.
