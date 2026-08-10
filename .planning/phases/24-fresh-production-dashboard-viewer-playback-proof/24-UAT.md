---
status: partial
phase: 24-fresh-production-dashboard-viewer-playback-proof
source:
  - 24-01-SUMMARY.md
  - 24-02-SUMMARY.md
  - 24-03-SUMMARY.md
  - 24-04-SUMMARY.md
  - 24-05-SUMMARY.md
started: 2026-08-10T12:14:14+08:00
updated: 2026-08-10T18:29:18+08:00
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused - 2 items outstanding]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service, clear ephemeral state, start the application from scratch, and confirm it boots without errors with a live primary query.
result: pass
source: automated
observed: "Strict controlled restart of local-dev/Wrangler/Vite stack; ports 8080, 8787, 5173, 3001 became ready in 1 second, Gateway health returned 200, and clean startup stderr contained only the expected local cron warning."

### 2. Closed tuple-bound playback evidence contract
expected: Closed tuple-bound playback evidence DTO and bounded Valibot request/response schemas are covered by the contract tests.
result: pass
source: automated
coverage_id: D1

### 3. Redacted evidence pair
expected: Redacted canonical evidence object, deterministic JSON/Markdown pair, and checkpoint failures are covered by the contract tests.
result: pass
source: automated
coverage_id: D2

### 4. Conservative playback projection
expected: The playback_verified projection is gated by tuple, source revision, media events, and one-second progress.
result: pass
source: automated
coverage_id: D3

### 5. D1 playback evidence persistence
expected: D1 playback summary and bounded rejection history schema, migration, tuple indexes, and CAS indexes pass integration verification.
result: pass
source: automated
coverage_id: D1

### 6. Replay-safe evidence repository
expected: The repository preserves the first valid playback fact and records duplicate, conflict, stale, and late history without changing the current projection incorrectly.
result: pass
source: automated
coverage_id: D2

### 7. Authenticated evidence endpoint and task projection
expected: Authenticated crawler-task evidence submission and redacted current/history task-detail projection enforce route reachability, ownership, tuple binding, sensitive-field rejection, and stable outcomes.
result: pass
source: automated
coverage_id: D3

### 8. Dashboard typed evidence contract
expected: Dashboard has typed tuple identity, current attempt, provider/repair/source/playback facts, artifact reference, and bounded history fields.
result: pass
source: automated
coverage_id: DASH-01

### 9. Dashboard current-attempt evidence trace
expected: Through the canonical authenticated Gateway browser path, Dashboard focuses the current attempt, promotes polling results, keeps provider, repair/receipt, source, and actual playback as independent blocks, preserves bounded history, and shows same-movie navigation with loading, partial, error, and redaction behavior.
result: pass
source: automated
observed: "Post-restart Gateway browser probe rendered 24 task cards, current-attempt focal content for each card, and SUN-064 repair detail with same-movie identity and source revision."

### 10. MovieDetail source selection and Viewer route
expected: MovieDetail uses direct-first eligible source selection, controlled fallback, and a same-movie Player route carrying content ID, source revision, source type, and bounded tuple context.
result: pass
source: automated
coverage_id: VIEW-01

### 11. Bounded retry and fallback behavior
expected: Player retry/fallback and ordinary-playback redaction boundaries remain bounded and do not submit playback telemetry.
result: pass
source: automated
coverage_id: PLAY-02

### 12. Visible Play and playback progress gate
expected: Through the authenticated canonical Gateway path, Player exposes a visible keyboard-focusable Play control, records allowlisted media events, and reaches playback verification only after one-second currentTime progress with no terminal error.
result: blocked
blocked_by: third-party
reason: "The visible enabled BUTTON was clicked, but SUN-064's direct source is the local fixture URL https://fixture.invalid/phase-21/direct; the Player observed waiting=true and stalled=true, with no canplay/playing and pending currentTime progress."

### 13. Artifact-first evidence pair
expected: Artifact-first JSON/Markdown output is redacted, deterministic, tuple-bound, immutable, and preserves failed/checkpoint write outcomes.
result: pass
source: automated
coverage_id: PROOF-01

### 14. Canonical Gateway fresh production proof
expected: With the selected production target, authenticated Dashboard session, repairable movie, and explicit evidence root, the canonical Gateway verifier exercises fresh Dashboard repair allocation, the same-movie Viewer path, visible Play, the event timeline, progress gate, artifact write, D1 submission, and Dashboard equality.
result: blocked
blocked_by: prior-phase
reason: "Fresh verifier checkpoint after cold restart: target and evidence root passed, but FCVR-081 was not visible in Dashboard task history, so no fresh task/run/attempt tuple was allocated and no production evidence was written."

### 15. Independent production fact matrix
expected: The production matrix review keeps provider, receipt, repair, source, and playback facts independent and does not claim a production pass from local fixtures; the selected target and authenticated session are required for the production decision.
result: pass
source: automated
observed: "Latest matrix remained outcome=checkpoint with all dependent layers pending; it preserved independent checks and did not claim a production pass from local fixtures."

## Summary

total: 15
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

[none yet]
