# Aplyd Academy Product and Engineering Documentation

This pack translates the Academy BRD into functional behavior, architecture, implementation contracts, wireframes and planned testing. It is a version 0.1 design baseline for product and engineering review, dated 5 October 2026. The user-established vision is broad learning, practical work capability, responsible AI use and tailored ecosystem integration. Technical choices, pilot scope and service targets are proposed.

Start with the [browsable index](index.html). Documents have readable HTML editions and editable Markdown sources. CSV registers can be used in a spreadsheet or imported into a test-management tool. The [wireframes](wireframes.html) are an offline interactive simulation with fictional data; they do not create real accounts, assessments, credentials or partner connections.

## Recommended reading order

1. [Business reference and glossary](business-reference.md) and [requirement register](requirements-register.csv).
2. [Functional specification](FSD.md) and [UX specification](UX.md), with the [14 screen wireframe](wireframes.html).
3. [High level design](HLD.md) and [architecture diagram](architecture.svg).
4. [Low level design](LLD.md), [data model guide](data-dictionary.md), [field dictionary](data-dictionary.csv), [SQL reference](schema.sql) and [API contract](openapi.json).
5. [Test strategy](test-strategy.md), [scenario register](test-scenarios.csv), [case register](test-cases.csv), [suites](test-suites.md), [traceability](traceability.csv) and [UAT](UAT.md).
6. [Security and privacy](security-and-privacy.md), [partner integration](integration-contract.md), [operations and content governance](operations.md), [example programs](program-blueprints.md), and [decisions and roadmap](decisions-and-roadmap.md).

## Review responsibilities

Product and program teams review learner promises, behavior, supported access and credential claims. Architecture and engineering teams review trust boundaries, schema, APIs, transactions and deployment. Quality teams review case coverage, fixtures, suite selection and evidence. Partner teams review identity linkage, permitted exchange and failure handling. Representative learners review the workflows through wireframes and later UAT.

## Release distinction

R1 is a complete adult pilot journey with core learning, practical assessment, appeals, private-by-default credentials, moderated cohorts, reporting and one integration. R2 includes diagnostics, continuing recommendations, networking, mentoring, live scheduling, selected offline resources and commercial controls. R3 may add an embedded AI assistant after a separate review. Detailed cases for future capabilities are labeled by release.

## Validation and limits

All planned product test cases have execution status **Not run**. There is no implemented Academy backend in this pack. Local documentation checks and wireframe interaction checks validate the artifacts only. They do not establish production security, API runtime behavior, database migrations, accessibility conformance or product readiness.

The PostgreSQL schema is a reference draft and needs execution and migration testing in the selected database. OpenAPI is a typed contract draft, not a running service. The first partner, languages, identity provider, stack, hosting, data retention, credential issuer, recognition, commercial model and staffing remain open decisions.

The [documentation validation report](documentation-validation.md) records checks performed on this pack and their boundaries. The [technical references](technical-references.md) identify the official protocol and schema sources consulted.

## Change control

Keep BR, functional, wireframe, scenario and test IDs stable. Review any changed rule across FSD, HLD, LLD, API, dictionary, wireframes and tests. Retain the source documents and registers when sharing HTML editions so the next team can revise the pack. Do not treat an illustrative score, scenario or capacity hypothesis as an approved policy.
