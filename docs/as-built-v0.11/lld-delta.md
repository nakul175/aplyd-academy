# LLD delta — concrete source behavior

Exact source paths/hashes are in [source-manifest.json](source-manifest.json); current wire/data shapes are in [api-and-commands.json](api-and-commands.json) and [data-dictionary.tsv](data-dictionary.tsv). Application source is a moving checkout during this documentation candidate.

## 1. Canonical writes and response acceptance

Personal POST validates same-origin when Origin is present, JSON content type,100000-character envelope, actionId20–80 allowed characters, current revision, domain commands and bounded personal aggregate sizing. Account comes from server identity. A same owner/actionId with changed command hash conflicts; matching replay reloads current state rather than replaying a historical body. Personal row plus audit are persisted through the existing batch/CAS path.

Shared POST validates equivalent envelope, current membership and command authority, conditional invitation/history/audit chains, aggregate budget and CAS. Migration0005 triggers can increase D1 `meta.changes`; aggregate success is exactly one `RETURNING id,revision` row matching expected saved values. `changes()` remains inside conditional batch inserts, with the corrected isolated local D1 probe proving its tested chain. Do not generalize that proof to arbitrary future trigger changes.

Client `acceptAcademyPayload` validates actor, safe revision, expected workspace, known roles, renderable state and exact scoped private content. Write expectation captures account/workspace/action and source revision. Create expects `tw-<actionId>`. Directory accepts only the expected authenticated subject and unique valid workspace entries; inactive entries have no role authority. Only auxiliary render arrays receive harmless defaults. Raw accepted server state remains separate from view defaults.

Caller sequence fences before applying acceptance and invalidates canonical personal offline read before writes, read denial, reset or context change. Accepted own lab reads populate a detached canonical context; optimistic view state cannot become that context. An unverified receipt preserves text and requires refresh rather than displaying reliable save/completion. Later root changes must be reconciled by hash before claiming this exact version tested.

## 2. Snapshot export/inspection

GET `/api/academy/export` authenticates, reads only owner `data,revision,updated_at`, and builds a version1 wrapper containing exact raw stored JSON and SHA256 over UTF8. Fresh absent row is explicitly unsaved revision0 with null sourceUpdatedAt. It never parses/rewrites stored evidence or mutates revision. Responses are no-store/nosniff/no-referrer attachment.

Inspector rejects outer files over8000000bytes, exact unsupported wrapper fields/versions and malformed metadata. It labels legacy exports, computes checksum comparison, compares optional currently open account and diagnoses inner readable object/enrollment count.1000000-byte inner pilot size is a separate diagnostic; no truncation occurs. Matching recomputed checksum proves byte consistency only. Inspector emits labels/counts, not evidence rendering or permissions.

Client generation guards account/file/export races. A fresh export must match current account and checksum before download. Chosen local file is read in-browser and produces no API request. There is no import/restore command.

## 3. Preferences and learner-declared read-back

`learning-access-preferences` accepts exact type/language/reminder/assistance keys. Language tags are bounded and canonicalized through `Intl.getCanonicalLocales`; valid preference does not imply available content. `languageAvailability` resolves only saved pin/allowed scope, never catalog/latest substitution.

Assistance confirmation requires exact practical prompt fields, existing30–10000-character field limits, matching pin, permitted help method and exact current content response language. Consent, read-back and no-answer-coaching are all true. Any field/pin change invalidates the in-memory confirmation. Submission server reconstructs validation and persists `{mode:'learner-declared read-back', declaration, contentRef, confirmedAt}`; it does not trust a copied confirmation object as permission.

This bounded declaration does not model formal accommodation approval or helper authentication. Current code builds a declaration policy for the saved standard; separately approved oral-assessment policy remains a gap. Read-aloud is user-started and cancels on scope change, with detached stale event handlers and generation checks. It uses browser-reported matching local voices only, never a language substitution or recorded learner audio.

## 4. Offline protocol

Bounds: packet180000bytes; individual draft250000bytes; queue500000bytes/12entries;10000characters per text field; canonical read fresh≤120000ms; draft lifetime86400000ms. Only personal lab and unchanged global English seed are permitted.

```text
prepare:
  require accepted own personal read, active eligibility, correct exact seed pin
  require unwithdrawn/unpaused enrollment and target-specific prerequisite/retry gates
  snapshot current online text into baseline; assign entryId/generation1/fixed expiry
edit locally:
  validate allowed text fields; increment generation; keep original expiry
reconnect:
  accept fresh canonical own read; compare each locally changed field against baseline
  conflict if online differs from baseline AND differs from local
  explicit merge rebases baseline/revision and increments generation; does not extend expiry
save:
  explicit confirmation; prepare existing lesson-draft/draft command only
  preserve fresh saved quiz answers; send through normal own server CAS
acknowledge:
  require accepted matching owner/workspace/enrollment/pin/target
  require receipt revision beyond sent baseline and exact fields saved
  clear only same entryId/generation; retain newer edits or any unverified outcome
```

Opening practical draft checks completed lessons, no pending attempt/open appeal, fewer than three attempts and no active completed record. Lesson drafts check prerequisite and uncompleted target. Reading reference material grants none of these states. Save drafting does not complete lesson, submit attempt or issue record.

Static reference HTML escapes text and contains no script/form/remote asset; packet provenance is exact source/hash. Downloaded material cannot be remotely erased.

## 5. Sealed local copy

Optional ciphertext uses PBKDF2-SHA256310000iterations, random16-byte salt, AES256-GCM random12-byte IV and128-bit tag. Authenticated metadata binds schema/kind/algorithm/iterations/account+lab scope hash/create/expiry. Passphrase12–256characters is held for local operation, never persisted with copy or sent to API. Wrapper bound700000bytes; earliest queue expiry governs sealed expiry and cannot exceed draft lifetime.

Unlock checks exact format/bounds/time, account scope hash, authenticated decryption, UTF8/JSON and all draft queue invariants. Wrong passphrase, tampering, different account or expired draft fails closed. Persistent key prefix is `aplyd-sealed-drafts-v1:` plus scope hash; metadata is pseudonymous, not anonymous. localStorage contains ciphertext. Storage quota/denial/removal failure has explicit feedback. Reset/device deletion cannot claim erasure of previously downloaded independent copies.

This application feature is not a device-security assessment. Browser WebCrypto/support and actual storage/race behavior require integrated browser tests.

## 6. Additive directory migration

`0005_tearful_angel.sql` creates `academy_team_directory(user_id,team_id)` composite PK/reverse index, adds `directory_projected DEFAULT0` and a partial legacy index. Insert/data-change/delete triggers project only future supported aggregate writes. Data-change trigger rebuilds on initial marker0 or changed membership JSON, marks1 without recursive data-trigger updates, and removes team pairs on deletion.

Existing rows are not rewritten/backfilled in migration. Migrations0000–0004 remain byte-identical to baseline HEAD in the observation manifest. Directory candidate set is UNION of indexed pairs and canonical membership search over marker0 teams. Final result joins canonical members again, derives current metadata/roles, keeps inactive retained membership discoverable and orders updated_at descending/id ascending. Server binds trusted userId; projection never holds grants.

Failed CAS or later batch constraint fault must roll back canonical write, projection/marker, token/history and audit together. Corrected synthetic D1 probe has23 checks; an earlier failed meta.changes assumption remains separately registered as superseded. Root additionally reports migration0005 applied successfully to the isolated/local app DB (seven commands); no production migration/publication result is implied. Initial legacy scan cost persists until supported writes project teams. No hidden GET repair, production SQL backfill or throughput estimate is proposed.

## 7. Required release checks

Current-root build/typecheck; actual API replay/CAS/directory behavior after migration; offline/seal/unlock/reconnect/merge/receipt races; account/workspace scope transitions; assistance read-back invalidation and privacy projection; speech late callbacks; mobile/dialog keyboard focus; archive and original library hashes; no provider/outbound calls while unconfigured; final source/build evidence and owner-private publication.

Candidates are not adoption. Record check and ecosystem readiness remain outside root checkout at this observation. All new integrated acceptance vectors in [test-matrix.tsv](test-matrix.tsv) are Not run until root records real evidence.
