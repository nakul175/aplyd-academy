# Aplyd Academy v0.12 functional design — release candidate

This extends the v0.11 as-built specifications. Release status and exact accepted evidence must be filled after integration. Global English0.1 sources, original questions and answer keys remain unchanged.

## Learner journeys

Overview lets a learner browse a featured work context separately from their saved preferences and private learning plan. Cards use the actual published task title. Catalog has one labelled context filter; it changes visible results, alongside search and Clear filters. The next-step card uses saved learning and the existing plan priority, with exact enrollment and pinned lesson references. First shared-workspace learners find an open cohort; browsing never enrolls automatically.

Pending assessment, independent appeal, paused learning, unavailable content, inactive membership, exhausted attempts and suspended records retain their existing action gates. History never substitutes a newer course. Personal English global0.1 lesson/practical states can navigate to Offline practice, which independently checks fresh access; this navigation does not download or save.

The shell reports Saved learning loaded after accepting saved state. Lesson and practical notices compare current explicit inputs with the last accepted draft. They distinguish no draft, changed inputs, a matching draft, saving and unavailable comparison. A draft save does not complete a lesson or submit evidence. A lost response cannot announce success; an accepted save followed by a directory read failure retains the acknowledged draft.

## Private record checks

A learner deliberately checks one exact own practice record from Achievements. Removed membership allows their retained own history check. Current assigned independent reviewers may check only the original assessment already present in an open assigned appeal. Owner status, a previous assignment, or knowledge of an identifier grants no additional check.

The read-only POST keeps private references out of query strings. It binds server identity, exact workspace, source revision and target. A second saved revision read after hashing detects concurrent changes. Unknown or inconsistent historical content returns unavailable; it never maps to a replacement. Retired or review-due content remains readable for historical checks and retains its original fingerprint.

The returned snapshot contains classification, exact source, status and bounded review provenance. It excludes raw evidence, drafts, scores, feedback, contact information, support bodies and private preferences. A SHA256 checksum detects snapshot inconsistency; it does not prove recognized issuer authority, accreditation or later status. There is no public bearer URL. The client fences account/workspace/authority/read/write changes and compares the result with the captured permitted source before display or local download.

## Owner job-practice templates

Four English starting points cover farmer expert briefs, MSME customer commitments, public-service source briefs and frontline spotting/reporting of concerns. They contain fictional exercise records and static supplied drafts; no provider call runs. Each creates one private editable draft atomically. Template provenance identifies source guidance without claiming institutional approval.

Only a current workspace owner can create a draft. Exact command fields are type and templateId. The ordinary retained and active draft limits and aggregate byte reserve apply. Locked classification, role/ecosystem boundaries, assessment structure and original seed identities remain protected. Creating a draft neither approves nor publishes it and changes no existing cohort or learning pin. Another current independent owner must review; publication and cohort offering retain their exact hash, future-date and capacity checks.
