# Accessibility statement: Aplyd Academy practice loop (ACA-US-12.3, AC3)

Draft, 13 October 2026. Published with each release; updated when checks change.

**Standard.** We aim for WCAG 2.2 level AA on every practice-loop screen, on phones first.

**What meets it, as checked.** Automated checks with axe-core 4.11.4 (rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) ran on 17 screens at 390×844 during the end-to-end journey test (`tests/loop/browser-r1-journey.mjs`; results in `docs/accessibility/axe-results.json`): operations, organisation, cohort admin, pack review, join (notice and age, consent choices), learner home, placement, facilitator, practice task, history, help, settings, sessions, thread, community and the public confirmation page. **Result: no automated failures.** The checks run on every change in CI.

Built in: a skip link and the same Home and Help links on every screen; labels on every field; errors and results announced in live regions; 44-pixel touch targets; visible focus; text that reflows at 200% zoom; tables in focusable scroll regions; no information by colour alone.

**Known gaps.**
- Automated checks find about a third of problems. The manual screen-reader walkthrough on a phone (AC2) has **not been done yet**: it needs a person with a phone and TalkBack or VoiceOver. The protocol is in `docs/accessibility/screen-reader-check.md`; the result will be recorded there with the device and screen reader used.
- Screens not yet checked automatically: unaided check, catch-the-AI, report view, cohort evidence (ops). They use the same components; they are added to the journey as the journey grows.
- English only in R1. Local languages and voice are planned for R4.
- Uploaded documents are shown as files to download; their accessibility depends on the learner's own file.

**Report a problem.** Help → Report a problem, on any screen. A facilitator replies; accessibility problems are treated as defects.
