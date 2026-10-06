# Aplyd Academy Business Reference and Requirements

The business reference is the BRD developed in this conversation on 5 October 2026. This companion preserves the product purpose, scope and requirement IDs so the specification pack can be reviewed independently. It summarizes the BRD rather than claiming to be a signed or verbatim replacement.

## Product purpose

Aplyd Academy helps people do their work well, improve everyday productivity and use AI with sound judgment. The learner can be a farmer, MSME owner, bureaucrat, healthcare participant, employee, entrepreneur or another adult professional. Tailored pathways connect practical learning with ecosystems such as Agri Saha, Health Saha and MSME.

The learning journey is discover, learn, practise, demonstrate, receive recognition, connect and continue improving. Work capability, AI productivity and responsible judgment are connected competency pillars.

## Required product capabilities

Training supports self-directed and facilitated learning. Practical exercises connect to everyday work. Assessment evaluates task quality and judgment, including what to verify, what information to protect and when to seek human expertise. Credentials distinguish participation, completion and demonstrated competence.

Communities provide peers, facilitators and continuing support. Networking and mentoring are opt-in. Continuous learning includes relevant updates, refreshers and next pathways. Partner integration places learning near the workflows where capabilities are needed.

The [requirement register](requirements-register.csv) preserves all 46 BR IDs with priorities and acceptance summaries. [Traceability](traceability.csv) maps them to functional modules, design locations, screens and planned test cases. Release assignments are proposed implementation sequencing and do not remove the BRD's longer-term scope.

## Business outcomes

- More effective task performance.
- Better productivity with quality maintained.
- Demonstrable responsible AI use.
- Inclusive participation and practical application.
- Credible achievement records.
- Useful continuing communities.
- Partner value and repeat participation.
- Sustainable delivery and commercial economics.

Business metrics include activation, completion, competency attainment, comparable learning gain, responsible-AI criteria, workplace application, task time plus quality, continuing learning, community usefulness, access gaps, partner value and cost per assessed achievement. Proposed pilot targets in the BRD require baseline validation; they are separate from engineering capacity hypotheses.

## Initial assumptions and open scope

The first planning release is an adult responsive-web pilot with selected languages and one complete partner journey. The audience remains broad across the product vision. The first learner segment, program, partner, credential issuer and commercial model are not selected. No professional accreditation, formal qualification or live AI assistant is implied.

The [decision register](decisions-and-roadmap.md) assigns the unresolved decisions needed before implementation. [Program blueprints](program-blueprints.md) illustrate concrete promises for several learner groups without selecting one as the approved pilot.

## Working glossary

| Term | Meaning |
|---|---|
| Account | Global identity used to authenticate a person |
| Tenant | Delivery workspace and security boundary |
| Ecosystem | Contextual configuration such as Agri Saha |
| Organization | Sponsoring body within a tenant |
| Role tag | Learner's work context for relevance; does not grant permission |
| Role assignment | Explicit authorization within a defined scope |
| Program version | Immutable published learning and assessment definition |
| Offering | Tenant's available instance of a program version |
| Cohort | Group receiving facilitated delivery |
| Enrollment | Learner participation pinned to a version and policy |
| Attempt | One draft or submitted assessment effort |
| Decision | Authorized immutable assessment result |
| Appeal | Review of a decision with recorded resolution |
| Credential | Claim issued on a stated achievement basis |
| Critical criterion | Condition that must individually be met to pass |
| Sharing grant | Purpose-specific authorization for optional disclosure |
| Outbox | Transactional record of events awaiting asynchronous handling |
| Idempotency | Repeated identical request has one effective outcome |
| Regression | Checks existing behavior after a change |
| Smoke | Small release-blocking set confirming essential workflows |
| UAT | Representative users validate the product's practical suitability |
