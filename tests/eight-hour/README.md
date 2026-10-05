# Integrated local Academy tests

Run from the Academy checkout after building and starting its local Worker. Use fictional loopback fixtures only. Tests refuse non-loopback destinations and require a confirmed stable Worker label. They create local synthetic accounts and may create a 200-event audit fixture.

Set `ACADEMY_APP_PATH` to this checkout and `ACADEMY_QA_WORKER` to the stable preview session label. Compile `build-current-acceptance.mjs` before `integrated-api.mjs`. `acceptance-browser.mjs`, `identity-browser-current.mjs` and `nonjson-read-current.mjs` exercise actual browser response, authority and unsent-input boundaries. Their default evidence stays under `.sites-runtime/eight-hour`; output environment variables can select another non-source evidence directory.

The v0.11 release evidence was generated from the original scripts at the recorded source hashes. The relocated API suite (628 assertions) and acceptance browser suite (14 scenarios) were also executed on the final rebuild. The other relocated scripts retain their original run evidence. No production sign-in, partner transport, human assistive-technology result or load assurance follows from these local fixtures.
