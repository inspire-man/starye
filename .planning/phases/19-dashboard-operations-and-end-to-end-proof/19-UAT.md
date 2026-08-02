---
status: partial
phase: 19-dashboard-operations-and-end-to-end-proof
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md, 19-05-SUMMARY.md, 19-06-SUMMARY.md]
started: 2026-08-02T23:34:27+08:00
updated: 2026-08-03T02:12:00+08:00
---

## Current Test

[testing paused — 1 items outstanding]

## Tests

### 1. Cold Start Smoke Test
expected: Stop the local stack, clear only ephemeral runtime state, and start the application from scratch. The Gateway at http://localhost:8080 becomes ready without startup, seed, or migration errors, and an authenticated primary Dashboard/API query returns live data.
result: pass

### 2. Crawler Task History and Pagination
expected: The Dashboard crawler page groups movie and manga histories by permission, shows multiple tasks per template, and Load More appends the next stable page without duplicates or missing rows.
result: pass

### 3. Attempt Detail, Provider Summary, Receipt, and Logs
expected: Selecting a task preserves the selection, allows switching among all attempts, shows terminal failure or cancellation reasons, exposes only allowlisted provider facts and a derived GitHub run link, displays validated receipt data, and pages logs in descending sequence order.
result: pass

### 4. Polling, Cancel, and Retry Lifecycle
expected: Visible-page polling refreshes every five seconds, pauses while hidden, refreshes immediately when visible again, cancel remains cancel_requested until runner confirmation, and retry creates a new attempt while preserving prior history.
result: pass

### 5. Movie Receipt Handoff and Existing-Editor CRUD
expected: A valid movie receipt opens the existing movie editor by primaryContentId, preserves only controlled task/run/attempt return parameters, and supports a reversible mutation, readback, and restore through the existing admin API. Invalid or unauthorized receipt lookups show a bounded error and keep the return path.
result: pass

### 6. Manga Receipt Handoff and Existing-Editor CRUD
expected: A valid manga receipt opens the existing comic editor by primaryContentId, preserves only controlled task/run/attempt return parameters, and supports reversible metadata and chapter-owner operations through existing paths. Invalid or unauthorized receipt lookups show a bounded error and keep the return path.
result: pass

### 7. Local Movie and Manga Evidence
expected: Running both movie and manga through the local Gateway produces separate validated local_contract JSON/Markdown evidence pairs. The local observer accepts only http://localhost:8080, reports both tuples, and does not promote them to provider production proof.
result: pass

### 8. Credentialed Provider End-to-End Proof
expected: After metadata-only GitHub App and Environment preflight, exactly one new movie or manga workflow dispatch on inspire-man/starye@main produces a matching D1 task/run/attempt and provider run/attempt/SHA/derived URL, signed callbacks, a validated receipt, and reversible existing-editor CRUD evidence. The production evidence replaces checkpoint status only after the full observed tuple passes.
result: blocked
blocked_by: third-party
reason: "After the GitHub Environment callback and runner secrets were configured and API/Dashboard were redeployed from f4e2b40, the production Dashboard exposed the Phase 19 controls. Exactly one movie task was created (452e07b1-0c1f-4790-b64b-eeadb454b997) and reached 正在领取 / attempt 1 with provider github-actions. No GitHub Actions provider run, attempt, SHA, URL, callback, or receipt appeared because the dedicated GitHub App provider binding remains absent. The task was then cancelled and is now 已请求取消 · 等待 runner 确认. Production evidence remains mode=credentialed_provider, status=checkpoint."

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none yet]
