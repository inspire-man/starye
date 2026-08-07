---
status: complete
phase: 22-dashboard-moviedetail-and-player-state-closure
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md
started: 2026-08-07T08:02:14Z
updated: 2026-08-07T08:12:28Z
---

## Current Test

[testing complete]

## Tests

### 1. Shared source policy
expected: Source policy classifies direct, magnet and TorrServer rows, gates eligibility, groups by type and preserves server order.
result: pass
source: automated

### 2. Player source guard and bounded retry
expected: Player uses eligible direct sources, routes magnet to MovieDetail, preserves trusted TorrServer mode, and bounds retries with waiting/error deduplication.
result: pass
source: automated

### 3. Canonical MovieDetail and Player local UI
expected: Gateway MovieDetail and Player surfaces show the source projection, direct error/retry surface and controlled return path.
result: pass
source: automated

### 4. Repair detail bounded identity
expected: Repair POST/GET detail returns the same bounded movie identity and preserves historical runs/receipts while filtering runner fields.
result: pass
source: automated

### 5. Dashboard visible polling and latest task focus
expected: Crawlers polls only while visible, clears timers on unmount, and focuses the latest repair task/run after confirmation.
result: pass
source: automated

### 6. Dashboard terminal history projection
expected: Terminal repair states expose the server-owned same-movie link, bounded reason/next action, source revision and safe history projection.
result: pass
source: automated

### 7. Authenticated Dashboard repair readback and same-movie return
expected: After authentication, the fixed repair intent focuses the returned repair_players task/run, visible polling and cleanup behave correctly, prior history remains selectable, and the terminal link returns to /movie/SUN-064.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None yet.
