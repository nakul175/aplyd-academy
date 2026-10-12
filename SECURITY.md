# Security policy

Owner: Nakul Jain. Last reviewed: 2026-10-08. Update when the hosting model, contact or supported versions change.

## Reporting a vulnerability

Email **nakul.jain@aplyd.com** with the subject "Aplyd Academy security". Include what you found, where, and how to reproduce it. Do not include real personal data, and do not test against any hosted or droplet instance beyond what is needed to show the issue.

- Acknowledgement and fix timelines: TBD (owner: Nakul Jain). No response time is promised by this file.
- There is no bug bounty.
- Please do not open public GitHub issues for vulnerabilities.

## Scope and status

This is a private pilot with synthetic data only (see README.md). It is not approved for production or real learner data. The hosted copy is owner-private; the DigitalOcean copy is behind Caddy basic auth (deploy/README.md).

## In-app reporting (practice loop, branch `aca/practice-loop`)

When the practice loop is deployed, learners and staff can also report a security or privacy problem from any screen: Help, then Report a problem, then "Security or privacy issue". The report goes only to the product owner; the address recorded as the owner decision `help.security_contact` is notified without the report text. Findings are recorded in `docs/security/findings.md` with an owner and a status. Risks are accepted or rejected only by the owner.

## Supported versions

Only the current `main` branch. No older release is maintained.

## Where the security design lives

- Threat model: docs/governance/threat-model.md
- Access control: docs/governance/access-control-model.md
- Secrets register: docs/governance/secrets-register.md
- Incident process: docs/governance/incident-process.md
- Original design-level controls: docs/product-specifications/security-and-privacy.md (a specification, not proof)
