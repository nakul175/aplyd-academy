# Compliance control mapping (item 27)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when controls, regulations in scope or evidence change.

**Agent-drafted 2026-10-08, not reviewed by a person or counsel; no certification or compliance claimed.** Frameworks are used as headings only. "Evidence" means a file in this repository; it is not an audit result. The pilot holds synthetic data only and is not approved for real learner data.

| Control area (framework heading) | Where the repository addresses it | Evidence | Status |
|---|---|---|---|
| Notice and purpose (DPDP Act 2023 notice/consent; GDPR Art. 5, 13) | Disclosed private pilot; no data collected beyond the app's need | README, privacy-ropa-dpia.md | Notice text for real users: not written |
| Lawful basis / consent (DPDP, GDPR Art. 6) | Per-feature opt-in: directory, credential sharing, partner choices | README, permission-matrix.tsv | Authorisation basis decision: TBD |
| Records of processing (GDPR Art. 30) | privacy-ropa-dpia.md | draft | Draft, unreviewed |
| Impact assessment (GDPR Art. 35) | privacy-ropa-dpia.md | draft | Draft, unreviewed |
| Data-subject rights (DPDP access/correction/erasure; GDPR Art. 15-17, 20) | In-app export, correction and erasure request workflow; lab-data deletion | app/academy-data-requests.tsx, tests/data-request-qa | Erasure outcome is "held, retention policy pending" (handoff). Not operational |
| Retention (DPDP, GDPR Art. 5(1)(e)) | privacy-retention-dsr.md | draft | No approved periods |
| Security safeguards (DPDP s.8; GDPR Art. 32) | Server-side authorisation, hashed tokens, TLS, firewall | threat-model.md, access-control-model.md | Partial; no pen test, no MFA |
| Breach handling (DPDP; GDPR Art. 33-34) | incident-process.md | draft | Notification duties: TBD |
| Processor and transfer management (GDPR Art. 28, 44) | third-party-inventory.md | list | DigitalOcean/Sites terms: TBD |
| Children's data (DPDP s.9) | Adult pilot (design: "adult pilot journey") | product-specifications/README.md | Age gating not implemented |
| Accountability, ownership | Owner on every governance doc; CODEOWNERS | this folder | Present |
| Access control (ISO 27001 A.5.15-18 style) | access-control-model.md | matrix | Recertification undefined |
| Backup and recovery (ISO 27001 A.8.13 style) | backup-dr.md | none | No tested restore |
| Logging and monitoring | slo-and-alerts.md | none | Not implemented |
| Secure development (ISO 27001 A.8.25-28 style) | secure-dev-evidence.md | partial | No CI |
| Supplier / licence management | third-party-inventory.md, SBOM | present | No scan |
| Accessibility (WCAG 2.2 AA) | accessibility-statement.md | partial | Not assessed |
| AI governance | ai-features.md | none needed | No AI enabled |

## Notes

Rows reference ISO 27001 only as a familiar control grouping; the project is not scoped to any ISMS. Which laws apply (Indian DPDP Act 2023, GDPR for any EU/EEA learner, sector rules for public servants) and counsel review: TBD (owner: Nakul Jain).
