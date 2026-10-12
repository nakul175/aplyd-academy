# Trackers, analytics and data flows in student sessions (ACA-TT-11.3.2)

**Check:** the browser journey (`tests/loop/browser-r1-journey.mjs`) signs in a synthetic school student, joins, and opens home, help and settings while recording every network request the browser makes. It asserts that every request goes to the Academy's own origin and that no known tracker or analytics script (Google Tag Manager, Google Analytics, Facebook, Hotjar, Segment, Microsoft Clarity) appears in the pages.

**Result (13 October 2026, local server, synthetic data):** pass. The Academy has no analytics, advertising or third-party scripts. Server-side data flows for a student: the database and file store on the Academy server; the AI provider only for coach questions (hints only, R3 rule) when AI is on; no WhatsApp, SMS or email to students (reminders go through the school).

**Re-run:** on every change in CI (the journey runs there). A new third-party script or request in a student session fails the build.
