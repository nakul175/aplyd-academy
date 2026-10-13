# Access model: practice loop (ACA-US-12.2, ACA-US-12.4)

Roles are per organisation (`loop_members.role`) except operator and owner (`loop_operators`, granted only from the server shell) and pack reviewers (`loop_pack_reviewers`, named by an operator). Every check is in `lib/loop`; refusals return 403 and are written to `loop_audit` with outcome `refused`.

| Action | Learner (own records) | Facilitator (own org) | Admin (own org) | Expert/reviewer (named pack) | Operator | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Create organisation, invite its admin | – | – | – | – | yes | yes |
| Invite facilitators/experts | – | – | yes | – | yes | yes |
| Create cohort, enrol list, resend invite, start groups, cadences | – | – | yes | – | cohort/groups only | cohort/groups only |
| See roster (names, status) | – | yes | yes | – | – | – |
| See aggregate dashboard | – | – | yes (suppressed) | – | via reports | via reports |
| Placement, tasks, coach, upload, submit, history, export | yes | – | – | – | – | – |
| Read a learner's file or answers | owner only | never | never | never | never | never |
| Level review, follow-up list, workshop session view, schedule checks | – | yes | – | – | – | – |
| Live sessions, end session, hide posts | – | yes | – | – | – | – |
| Post or report in a cohort thread | own cohort | yes | – | – | – | – |
| Draft pack items (AI or import) | – | – | – | yes | yes | yes |
| Approve, correct, reject, revise, publish, resolve flags | – | – | – | yes | – | – |
| Flag an item | own cohort's published pack | – | – | – | – | – |
| Evaluation cases and runs, incidents | – | incidents | – | – | yes | yes |
| Record owner decisions, approve reports, A-01 and review decisions, record sharing | – | – | – | – | – | yes |
| Read security reports | – | – | – | – | – | yes |
| Confirm a changed task | the invited confirmer via single-use link | – | – | – | – | – |
