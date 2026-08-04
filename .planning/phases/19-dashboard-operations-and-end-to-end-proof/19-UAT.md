---
status: complete
phase: 19-dashboard-operations-and-end-to-end-proof
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md, 19-05-SUMMARY.md, 19-06-SUMMARY.md]
started: 2026-08-02T23:34:27+08:00
updated: 2026-08-04T17:46:38+08:00
---

## Current Test

[completed]

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
result: pass
recorded: 2026-08-04T17:46:38+08:00
source: production
evidence: "Fresh task 4af1519d-f12b-4418-8bba-1c2536ee3e2b, D1 run 9ef31b31-f66a-4e11-927e-c890edbdf209 attempt 1, provider run 30890327381 attempt 1 at SHA d57c0ed3bf4b9337a14fcb58c49465b9effa8ba6; seven accepted signed runner events, validated receipt primaryContentId 1cf4d537-324d-45f5-be96-9fe9bcf430a7 with createdCount 6 and updatedCount 0, and reversible SUN-064 Dashboard/API/remote-D1 CRUD readback."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
