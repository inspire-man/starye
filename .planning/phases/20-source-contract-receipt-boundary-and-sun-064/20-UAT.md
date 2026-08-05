---
status: partial
phase: 20-source-contract-receipt-boundary-and-sun-064
source:
  - 20-01-SUMMARY.md
  - 20-02-SUMMARY.md
  - 20-03-SUMMARY.md
started: 2026-08-05T17:10:00+08:00
updated: 2026-08-05T20:05:07+08:00
---

## Current Test

number: 5
name: Dashboard crawler task readiness focal point (signed session)
expected: |
  With a real signed-in Dashboard session, open the controlled crawler task detail through the canonical Gateway and confirm the readiness sections, bounded receipt/source summary and controlled actions are visible without raw runner or signed-session material.
awaiting: a real signed-in Dashboard session; the current browser session remains on the local login page

## Tests

### 1. Source contract and readiness states
expected: Source eligibility, no_source/source_failed/repairing and independent playback proof are covered by the focused source-contract tests.
result: pass
source: automated
coverage_id: D1

### 2. D1 source projection and receipt boundary
expected: movie_source_state projection, versioned receipt/source identity columns and the 0029 migration boundary are type-checked and inspected without destructive statements.
result: pass
source: automated
coverage_id: D2

### 3. API and database contract alignment
expected: API and DB schema fields, enums and content identity remain aligned under the focused API tests and type-check.
result: pass
source: automated
coverage_id: D3

### 4. Controlled receipt readback and empty-source reconciliation
expected: Explicit empty players results remove stale source rows and produce no_source/repairable; omitted players preserve existing sources; bounded source_failed remains independent from metadata success and raw runner fields are excluded.
result: pass
source: canonical Gateway + in-app Browser
observed: |
  The same fixture identity returned HTTP 200 for the controlled sequence: ready/revision 7, explicit players=[] -> no_source/eligibleCount 0/repairable revision 8, ready revision 9, omitted players -> ready revision 9, and explicit players=[] -> no_source/eligibleCount 0/repairable revision 10. MovieDetail readback showed the same content identity and playback remained unverified. Source write/read failure branches remain covered by the focused API tests; no D1 fault was injected during this run.

### 5. Dashboard crawler task readiness focal point
expected: Task detail renders identity, Metadata persisted, Source readiness, Playback proof and bounded receipt/source summary in order, with controlled actions and no raw receipt, URL, command, workflow, token, secret or signed material.
result: pending
automated_result: pass
source: automated
coverage_id: D2

### 6. MovieDetail and Player no-source guard
expected: MovieDetail shows the server-owned readiness labels and repairable no_source state; Player skips view tracking and xgplayer construction until a ready disposition and eligible active source exist.
result: pass
source: canonical Gateway + in-app Browser
coverage_id: D3
observed: |
  MovieDetail showed Metadata persisted, no_source, eligible count 0, repairable, playback unverified and bounded actions. The standard /movie/P20-SUN064-20260805/play route showed 暂无可用播放源 and 返回影片详情; browser evaluation reported videoCount=0 and xgplayerCount=0. A one-source sync also showed ready/eligibleCount 1 and the 查看影片 action while playback stayed unverified.

## Summary

total: 6
passed: 5
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
