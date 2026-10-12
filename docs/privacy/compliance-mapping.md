# Compliance mapping: DPDP Act 2023 and Rules 2025 (draft for the legal reviewer)

**Status: mapping by Claude of what the code does; not legal advice; the qualified legal review (Q6) is pending.** Each row says where the obligation is handled and what is still open.

| Obligation (summary) | Where handled | Open |
| --- | --- | --- |
| Notice before or at consent, in clear language, itemised | Join screen shows the approved notice version before sign-in; draft `docs/privacy/notice-draft-v0.1.md` | Notice text, legal entity, grievance contact |
| Consent free, specific, informed, unambiguous; record kept | Per-purpose checkboxes, required core consent, append-only `loop_consents` with notice version and time | Legal basis confirmation for adults |
| Withdrawal as easy as giving consent | Settings toggles; STOP for WhatsApp/SMS | – |
| Purpose limitation and data minimisation | Phone kept only with a phone channel; admin sees aggregates; audit holds no content | – |
| Children's data: verifiable parental consent, no tracking or targeted ads | R1 refuses under-18s and student accounts; R3 gates in ACA-E11 | Verifiable consent method (legal review) |
| Accuracy and erasure on request | Account deletion removes loop data and files; logged by id for restores | – |
| Retention limited to purpose | Owner periods per record type; scheduled deletion job; backups expire on the Litestream schedule | Periods to be decided |
| Reasonable security safeguards | `docs/security/*`, findings register | External test not decided |
| Breach notification | `docs/operations/incident-and-postmortem.md` | Timelines and wording (legal review) |
| Processors (AI provider, Resend, DigitalOcean) under contract | AIA-ACADEMY-01 draft lists the AI provider | Processor agreements; AI data location (owner: after the lawyer) |
| Grievance redressal | Help → report; owner queue for privacy reports | Named grievance officer and response time |
