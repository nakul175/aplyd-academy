# ADR-P03: Exact immutable curriculum pins; no fallback to latest

Owner: Nakul Jain · Date recorded: 2026-10-08 (retrospective) · Status: Accepted (as built)

## Context
Learner evidence, rubrics and records must keep their meaning when content changes. The design adopts the same idea as ADR-04 (decisions-and-roadmap.md).

## Decision
New enrolments and cohorts hold full scope, program and version references into an immutable archived registry (global 0.1 archive SHA-256 `9fc83c8d...b7e4`, per docs/CLAUDE-HANDOFF.md). An unavailable exact source stays unavailable: no silent upgrade, no global fallback, no replacement of a saved enrolment's rubric.

## Consequences
Old records stay stable and auditable. Content fixes require new editions and deliberate re-pointing. CLAUDE.md forbids changing pins. Edition 0.2 and the Hindi draft exist but are not reachable by real enrolments yet (handoff owner decision 3).

## Alternatives considered
Always use latest content: rejected because it would change what past assessments meant.
