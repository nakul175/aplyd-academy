# Accessibility statement (item 25)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when an accessibility audit is done or the UI changes materially. Agent-drafted; **no WCAG 2.2 conformance is claimed.**

## Position

Aplyd Academy is a private pilot for farmers, MSME owners and public servants with synthetic data. The target is WCAG 2.2 level AA. **Conformance has not been assessed.** docs/product-specifications/UX.md already says: "Automated layout checks alone do not constitute accessibility conformance. Screen-reader, keyboard-only, magnification and representative learner testing remain required."

## What the repository evidences (not conformance)

- Design intent in UX.md section 6: semantic landmarks, heading order, explicit labels, native inputs, associated errors, 44 px touch targets in the prototype.
- Implemented features (README): reading mode, browser read-aloud, keyboard and dialog focus recovery, learner-selected language and assistance preferences, passphrase-sealed offline draft capture, printable worksheets, personal English study packets.
- Test evidence: v0.15 browser acceptance reports seven navigation focus checks and six width/body-text layouts (docs/CLAUDE-HANDOFF.md); v0.15.1 screenshots at 390 px width and enlarged body text (as-built-v0.15.1/screenshots); v0.10 library keyboard acceptance (as-built-v0.10/library-keyboard-acceptance.json); v0.2 notes report 114 layout checks at three widths and 200% text.
- Local `axe-core` appears in the dependency tree (SBOM) but no axe run is recorded in the evidence I read.

## Known gaps

- No screen-reader testing (NVDA, JAWS, VoiceOver, TalkBack). No WCAG 2.2 criterion-by-criterion audit. No colour-contrast report.
- Hindi is a draft edition not reachable by real enrolments; reviewed translations, low-bandwidth, assisted and oral journeys are unvalidated (README "Remaining production work").
- Library originals (Word, PDF, PowerPoint) were supplied unchanged; their accessibility (tags, alt text, reading order) is not assessed.
- Browser read-aloud depends on the learner's browser.
- Basic-auth sign-in on the droplet uses the browser's native dialog; its accessibility is the browser's.

## Feedback

Accessibility problems: nakul.jain@aplyd.com. Response time: TBD (owner: Nakul Jain).
