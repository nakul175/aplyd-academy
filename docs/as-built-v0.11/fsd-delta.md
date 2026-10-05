# FSD delta — actual sprint source

Read against [README](README.md) and [evidence-register.json](evidence-register.json). This is an additive account of a private practice pilot; it does not upgrade private practice records into recognized certifications.

## Fresh private snapshot and inspection

From personal Preferences & privacy, a signed-in learner can export a fresh copy of their currently saved personal lab. `/api/academy/export` reads the authenticated owner's canonical row, revision and update time. An absent row is labeled unsaved revision0 with a fresh default; arbitrary query-owner values cannot select another account.

The unencrypted JSON wrapper contains original JSON bytes and a carried SHA256. The local file inspector reports format, checksum, own-account comparison, readable-object status, size and enrollment count. Inspection does not upload a file, issue permission, import, restore or alter data. An edited file with a recomputed checksum may still match integrity; that does not authenticate its issuer or content. Legacy exports are identified without invented owner/checksum assurance.

Existing proof: ten root pure tests reported; four actual local API checks and six mobile-browser checks recorded, with no inspection POST. Final combined sprint regression remains separate.

## Language, reading and captured response

Learners can save preferred language, read-aloud reminder and requested help in their own personal or shared-workspace learning state. These requests do not assign a helper, reveal evidence, translate the interface, switch a pinned course or grant roles. Current interface/course seed remains English.

Saved-content language is derived from the exact pinned publication. Unavailable requests show that limit and retain progress. Read aloud starts only on user action, uses matching browser-reported local voice metadata and exact lesson text, and stops across account/workspace/enrollment/lesson changes. Unsupported/late/no matching voice leaves text usable. Browser localService metadata is not an independent device privacy audit.

If help is declared for a practical response, learner reviews exact words, chooses reading or transcription, and confirms consent, read-back and own reasoning. Any edit requires confirmation again. Server validates the declared language/pin and stores bounded learner-declared metadata with submission. This is not formal oral-assessment/accommodation approval, helper authentication or proof that help occurred. Existing lesson/retry/appeal/critical assessment rules remain authoritative.

Existing proof: root reports31 integrated pure checks; candidate logic proof is separately registered. Human listening, reviewed translated editions and final browser race/accessibility proof are not inferred.

## Unsent and offline practice

Screen lesson/practical text uses account/workspace/enrollment/pin-scoped session memory. Comparing saved online text can replace screen text only after an explicit learner choice; it does not save or submit, and quiz choices are retained.

Offline practice is personal-lab-only and currently supports the unchanged global English seed. A recent accepted canonical read is needed to prepare a reference packet or draft. The downloaded static packet includes fictional source material and exact source hash but no answer key, learner evidence, access grant or completion action. A downloaded copy cannot be recalled remotely.

Unsent local drafts hold permitted text fields only, with a fixed24-hour use window. Lesson eligibility/prerequisites, pending practical attempts/appeals, attempt exhaustion, withdrawn/paused records and completed pathways are checked before preparation and again when reconnecting.

Optional sealed copies use a learner passphrase and browser WebCrypto; persistent device storage contains ciphertext, not plaintext evidence or the passphrase. Imported/unlocked text stays local. Forgotten passphrases are not recoverable. Device/browser storage failure must be shown rather than a false saved message.

Reconnecting compares online baseline with local text. Conflicting fields require explicit review/merge. Save as online draft is a deliberate normal draft command after a new verified read; it never completes a lesson, submits evidence or issues a record. Local text clears only after an accepted scoped receipt proves the exact sent generation/fields. Newer local edits, failed/conflicting/unverified responses retain unsent text.

Root adopted offline source and controls during this workstream. Earlier44-test candidate proof excludes subsequent root eligibility changes. Integrated build/browser/online-offline regression is Not run at this observation.

## Workspace directory and write receipt

Directory discoverability remains based on trusted user and current canonical retained membership. Inactive retained memberships appear history-only with no active roles. A projected pair does not grant access. Legacy never-written teams retain the canonical fallback; no hidden GET/backfill writes are introduced.

Successful shared mutation is recognized by exactly one returned aggregate row whose id and revision match. Trigger-increased D1 meta.changes is not used as a false success/failure oracle. The corrected isolated local D1 probe covers23 checks; hosted migration and load behavior remain unproved.

## Not adopted/live

Private record-check UI and ecosystem-readiness UI are candidate-only at observation. No live AI, new public credential verification, live partner transport, recognized external issuer or reviewed translation is established by these changes.
