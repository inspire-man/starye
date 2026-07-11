---
status: complete
phase: 05-migration
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
  - 05-04-SUMMARY.md
  - 05-HUMAN-UAT.md
started: 2026-05-13
updated: 2026-07-11T11:55:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Worker deploy can be triggered manually
expected: Running `deploy-api.yml` or `deploy-gateway.yml` through `workflow_dispatch` succeeds, and the API health route plus primary site routes remain reachable after deploy.
result: pass
source: human

### 2. Pages deploy can be triggered manually
expected: Running any Pages deploy workflow for auth, blog, dashboard, movie, or comic succeeds, and the corresponding production entry loads without blank screen or 404. The auth production entry is `https://starye.org/auth/login`.
result: pass
source: human

### 3. Worker rollback works through workflow_dispatch
expected: Supplying `app=api|gateway` plus a valid `version_id` to `rollback.yml` succeeds and restores the selected Worker to the target version within the operational rollback window.
result: pass
source: human

### 4. Pages rollback fails closed
expected: Supplying a Pages app such as movie, comic, blog, auth, or dashboard to `rollback.yml` does not attempt a fake automated rollback; it fails with instructions to follow `RUNBOOK.md` for manual Pages rollback.
result: pass
source: human

### 5. D1 migration backs up before apply
expected: Running `deploy-migrations.yml` exports the remote D1 database before applying migrations, uploads the backup to R2 under `ops/d1-backups/starye-db-<run_id>-<run_attempt>.sql`, and keeps a downloadable GitHub artifact copy.
result: pass
source: human
note: 2026-05-14 validation addendum confirmed the R2 upload requirement was added after the first UAT pass.

### 6. Destructive migration reviewer ack gate blocks unsafe changes
expected: A migration diff containing `DROP COLUMN`, `DROP TABLE`, or `ALTER TABLE ... DROP` is not silently allowed through CI; it requires the `production-migration-review` reviewer acknowledgement path before production migration execution.
result: pass
source: human

### 7. Worker Sentry event path works
expected: A triggered API 5xx or gateway proxy failure sends a Worker event to Sentry, while `AbortError`, `NetworkError`, timeout, and fetch-failure noise are filtered enough to avoid flooding the project.
result: pass
source: human

### 8. Video failure message telemetry works
expected: Creating an invalid or timed-out video source at the movie player keeps the existing player error card visible and sends a non-crash Sentry message shaped like `video failure: <kind> - <message>` with source context and user-agent fields.
result: pass
source: human

### 9. Frontend Sentry event path works
expected: A deliberate frontend exception from movie, comic, dashboard, blog, or auth reaches the shared Sentry project without cookie, session, or other sensitive payload fields.
result: pass
source: human

### 10. Crawler failure alert path is documented and usable
expected: Any `daily-*-crawl.yml` failure uses GitHub Actions default email notification as the v1 alert path, without requiring a new Slack or Discord integration.
result: pass
source: human

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

