# Aplyd Academy Documentation Validation

This report records checks of the specification pack and its offline wireframes. It does not report product testing: all 168 planned product cases remain Not run because no Academy backend has been implemented in this task.

Version 0.1 dated 5 October 2026.

## Coverage and structure

The pack preserves 46 BRD requirement IDs and maps every requirement to planned functional, screen, scenario and test references. It contains 21 scenarios and 168 cases: 149 for R1, 18 for R2 and one R3 assistant-design readiness review. Cases contain preconditions, synthetic inputs, steps, expected outcomes, priority, suites, owners and evidence requirements.

The reference data model contains 41 R1 tables and 432 field definitions. Local checks compare dictionary table/column pairs with SQL declarations, check uniqueness and require purpose, ownership, classification and retention categories for every field.

The OpenAPI compatibility draft contains 87 paths, 100 operations and 136 schemas. Local structural checks parse the JSON, resolve local references, check unique operation IDs and required path parameters, and confirm the baseline partner paths. These are structural checks, not a full OpenAPI conformance certification.

## Offline wireframe checks

The prototype has 14 screens. Local browser checks exercise onboarding, enrollment, practice, submission, human-review simulation, critical-criterion failure despite a high total, retry and pass, credential issuance, private and shared verification preview, sharing withdrawal, cross-context separation and community posting.

All screens were checked for page overflow at desktop, tablet and 360-pixel mobile widths. Browser checks recorded no JavaScript exceptions or external requests. Desktop and mobile captures were reviewed for readability. These checks cover the local simulation, which has no real authentication, authorization, assessment service or credential issuer.

## Documentation browsing

The HTML editions are generated from the editable source documents. Local checks verify document links, overview navigation, test-case and dictionary search/filter behavior, and representative desktop/mobile layouts. The downloadable pack retains the relative file structure required for local browsing after extraction.

## Verification limits and implementation gates

The final local run passed 18 structural checks, 57 offline wireframe checks and 256 documentation navigation, search and layout checks. These counts refer to artifact validation only and are separate from the 168 unexecuted product cases.

- PostgreSQL schema execution and migration tests remain pending; a database server was not available for this task.
- API contract runtime behavior, provider interoperability and complete formal conformance validation remain pending.
- Planned security, privacy, accessibility, performance, restore, integration and UAT cases have not executed against a product.
- Browser layout checks do not establish assistive-technology compatibility or accessibility conformance.
- The assistant readiness case does not evaluate a model; a separate runtime evaluation plan is required before that feature.
- Pilot policies, languages, devices, network conditions, credentials, hosting and named operational owners require agreement.

Engineering should execute the documented suites in the chosen implementation environment and record build, configuration, fixture version, observed results and evidence. The local artifact checks establish that the documentation is connected and reviewable; release acceptance requires implemented-system evidence.
