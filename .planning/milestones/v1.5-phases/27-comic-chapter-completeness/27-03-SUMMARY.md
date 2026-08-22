---
phase: 27-comic-chapter-completeness
plan: 27-03
subsystem: targeted-chapter-runner
tags: [idempotency, runner, signed-callback, local-proof]
status: complete
completed: 2026-08-22
---

# Plan 27-03 Summary

Added strict comic chapter and chapter page operation intents, revision/policy/finding binding, bounded chapter/page selections, idempotent task creation and manga runner dispatch. The existing task/run/attempt/lease/provider control plane remains the only scheduler boundary.

Chapter observations advance the runner event sequence through a CAS update, persist authoritative D1 projections, and allow terminal receipts only after same-revision current readback. Ordinary manga and movie operations retain their existing adapter paths.

## Verification

- API internal runner, task command and receipt validation tests pass.
- Crawler task-runner suite passed: 12 files / 63 tests.
- Fresh local tuple `task=360dc5ac-a035-4edc-829a-d2d5839a052c`, `run=b4f8f413-eaa2-45b3-b72d-65fb438e06cc`, `attempt=1`, `provider=local-proof` reached `succeeded` with event sequence 8.
