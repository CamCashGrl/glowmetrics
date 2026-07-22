# Chrome extension regression tests

Three harnesses, each loading the REAL, unmodified extension source (not a
copy or a rewrite) against mocked `chrome.*` APIs and a mocked network layer:

- `popup-harness.mjs` — loads the real `popup.html` + `popup.js` in a real
  Chromium page (via Playwright) and drives button clicks / asserts on DOM
  state. Covers Start/Pause/Resume/Stop button wiring, the pending-action
  failsafe (background never replies), rapid double-click guarding, and
  coaching Performed/Skip wiring.
- `background-harness.mjs` — loads the real `background.js` service-worker
  source into a Node `vm` context with a mocked `chrome.*`/`fetch`. Covers
  boot/restore, tip events, network-failure resilience, the full
  start/pause/resume/stop lifecycle, heartbeat gating, coaching-response
  routing, and a 30-tip rapid-fire burst.
- `content-harness.mjs` — loads the real `content.js` in a real Chromium page
  with a chat container in the DOM, and simulates chat lines arriving as DOM
  mutations exactly like Chaturbate/BongaCams/MyFreeCams render them. Covers
  tip-pattern parsing per platform, room-entry detection, exact-duplicate
  dedup, distinct-tip non-dedup, zero-token rejection, and a 20-tip rapid
  burst.

## Running

```
cd chrome-extension/tests
npm install
npm test
```

Requires a Chromium binary Playwright can launch. If
`PLAYWRIGHT_BROWSERS_PATH` isn't already pointed at one, run
`npx playwright install chromium` first.

These do not require a live Supabase project, a running Next.js dev server,
or loading the extension into a real browser profile — they test the actual
extension logic in isolation.
