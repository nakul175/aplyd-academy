# Architecture: practice loop

Decisions: ADR-0001 (Node 22 + SQLite on a DigitalOcean droplet in BLR1), ADR-0002 (practice loop as a separate module).

```
Phone browser ──HTTPS──> Caddy ──> Next.js standalone (Node 22, 127.0.0.1:3000)
                                     ├─ app/loop/*            server-rendered screens (React Server Components)
                                     ├─ app/loop/client.tsx   forms, uploader, coach (client components)
                                     ├─ app/api/loop          one JSON action endpoint → lib/loop/api.ts
                                     ├─ app/api/loop/files    resumable upload (PUT) and owner download (GET)
                                     ├─ app/api/loop/jobs     reminders and retention (systemd timer, shared secret)
                                     └─ lib/loop/*            domain rules and every permission check
                                          ├─ SQLite (WAL) via lib/sqlite-d1.ts ── Litestream ──> Spaces BLR1
                                          ├─ file store ACADEMY_FILES_PATH (owner-only files)
                                          ├─ lib/ai/provider.ts ──> AI provider (off until AIA-ACADEMY-01 approved)
                                          └─ lib/auth/mail.ts ──> Resend (email); WhatsApp/SMS adapter not chosen
```

## Modules (`lib/loop`)

| Module | Stories | Responsibility |
| --- | --- | --- |
| core | all | errors, audit, operator and member checks, owner-decision registry |
| enrolment | 2.1, 2.2, 2.4, 2.5, 9.1, 21.1 (cap) | organisations, staff invites, cohorts, list enrolment, join with consent, start groups |
| levels | 2.3, 2.6 | placement, level reviews, grouping by level, access period |
| packs | 3.1, 3.2, 3.3, 9.2 | drafting, expert review, immutable versions, flags |
| ai | 7.2, 7.3, 4.2 | hint-first prompt, evaluation set and runs, availability gate, incidents |
| files | 4.1, 18.2 | resumable upload, owner-only access, confidential-file guard |
| practice | 4.1–4.6 | weekly tasks, coach, attempts, submissions, checks, catch-the-AI, workshop |
| reminders | 5.1–5.4, 14.3 | channel choice by consent, cadences, reminder job, STOP, follow-up |
| metrics | 6.1–6.3, 9.3, 10.2, 10.4, 14.2, 15.1 | S-01 to S-04, suppression, reports with owner approval |
| retention | 6.4, 6.5 | export, erasure, scheduled deletion, deletion log re-applied after restore |
| help | 12.5 | problem reports and queues |
| community | 8.1, 8.2 | live sessions by level, threads, moderation |
| evidence | 10.1, 10.3, 10.5, 14.1 | confirmations, interviews, change list, fix proposals |
| students | 11.1–11.7 | agreement and legal-review gate, guardian consent, school digest, class view, end of pilot, harm review |
| briefs | 13.1–13.3 | monthly briefs per role and level, try-it task |
| billing | 15.2, 21.1–21.3 | renewals and S-05, invoices and caps, sponsors, renewal offers, payment confirmation |
| language | 19.1 | interface strings and pack translations with bilingual review |
| voice | 19.2 | in-memory transcription; recording discarded |
| annotations | 20.1, 20.2 | notes on published items, AI refinements with expert approval |

Later-release features check `requireEpic()`: they stay closed until the owner records `scope.release` with that epic (a new strategy version or his confirmation).

## Rules that cut across modules

- **Owner values are data, not code.** `loop_decisions` holds them; `requireDecision` refuses with 409 until the owner records one.
- **Refusals are audited.** `refuse()` writes the attempt and answers 403 without revealing whether the target exists.
- **Content flows one way.** AI or agent drafts are `unchecked`; only the named reviewer approves; learners and the AI see only published versions.
- **Week arithmetic.** A learner's start date is their start group's date, else the cohort's workshop date. Week 0 is the workshop week; week n starts n×7 days later. A-01 uses weeks 2 to 6.
- **Time is a parameter.** Every library function takes `now`, so tests use a fixed clock.
