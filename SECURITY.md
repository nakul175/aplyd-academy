# Security policy

**Reporting a problem.** Learners and staff report security or privacy problems from any screen: Help → Report a problem → "Security or privacy issue". The report goes only to the product owner, Nakul Jain (the email recorded as the owner decision `help.security_contact` is notified, without the report text). Anyone else can contact APLYD and ask for the product owner.

**What happens next.** The owner acknowledges within 2 working days [TO CONFIRM by the owner], decides the severity, and records the finding in `docs/security/findings.md` with an owner and a status. High and critical findings are fixed before the next release; remaining risks are accepted or rejected only by the owner and recorded with the date.

**Supported versions.** Only the version deployed at academy.aplyd.org.

**Do not** test against the hosted Academy with real people's data. Use the local setup in `docs/testing/test-strategy.md`.

See also: `docs/security/threat-model.md`, `docs/security/access-model.md`, `docs/security/secrets-register.md`.
