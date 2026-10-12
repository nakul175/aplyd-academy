# Privacy: retention schedule and data-subject request procedure (item 23, part 2)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when retention decisions are taken or the data-request feature changes.

**Agent-drafted 2026-10-08, not reviewed by a person or counsel; no certification or compliance claimed.** DPDP Act 2023 and GDPR are framework references only.

## Retention schedule

**No retention periods have been approved.** The handoff lists "retention policy for erasure" as an open owner decision, and the README lists "formal retention" under remaining production work. The table records what the software does today and the open decision; the "Proposed" column is a suggestion for the owner, not a commitment.

| Data class | What the code does today | Proposed (needs decision) |
|---|---|---|
| Personal lab | One row per account; lab-data deletion and learning export exist | Delete on request; otherwise TBD |
| Shared workspace state | Kept; older admin/moderation history archived after 200 entries, not deleted | TBD (owner: Nakul Jain) |
| Submitted attempts and decisions | Immutable by design (appeal history) | Keep while enrolled plus a fixed period; TBD |
| Invitation tokens | Hash kept; 7-day expiry; no purge | Purge expired hashes after 30 days |
| Audit rows | Kept; carry request hash and detail | TBD |
| Removed members | Keep read-only own history; no automatic deletion | TBD |
| Droplet logs and backups | Journald defaults; backups not proven | TBD |

Backups and archives contain deleted data until they age out; no deletion manifest exists, so a restore can resurrect erased data (backup-dr.md).

## Data-subject request procedure

What the app offers (app/academy-data-requests.tsx; tests/data-request-qa): a member can file a request of kind export, correction, or erasure/withdrawal of consent, with statuses received, verified, verification-failed, completed, declined, held ("retention policy pending") and withdrawn. Export and correction of own profile fields work; erasure ends in "held" until a policy exists. A learner can also download their own export and delete lab data.

Procedure (proposed):
1. **Receive**: in-app request or an email to nakul.jain@aplyd.com. Log date and a reference (no content copied into the log).
2. **Verify identity**: same signed-in account, or for a lost sign-in the workspace recovery path (the recovery view is admin-only today; a learner who lost sign-in cannot file; handoff owner decision 1).
3. **Scope**: list the data classes above that apply; separate own data from other learners' data.
4. **Decide**: export, correct, or erase. Assessment history is immutable; corrections are new linked records. Where retention applies, minimise and restrict, and tell the requester.
5. **Act** and record the outcome in the request status.
6. **Respond** within the period the owner sets: TBD (owner: Nakul Jain). DPDP and GDPR time limits to be confirmed by counsel.
7. **Backups**: note that copies age out on the backup schedule.

Gaps: no tested end-to-end procedure with a real request; no restore-time deletion replay; named responsible person TBD.
