---
phase: 23-github-actions-production-repair-and-reconciliation
plan: 05
subsystem: admin-dashboard
tags: [crawler-tasks, dashboard, current-attempt, provider, reconciliation, readback]
requires:
  - phase: 23-03
    provides: bounded retry, lease/reconciliation state, receipt validation, and source CAS
  - phase: 23-04
    provides: signed callback outcomes, late/stale/duplicate/conflict facts, and repair readback
provides:
  - bounded repair task/run DTO with current attempt, collapsed history, provider, lease, reconciliation, receipt, source, and safe-log facts
  - server-enforced same-movie active duplicate lock and fresh disposition check before repair creation or retry
  - Dashboard current-attempt focal surface with allowlisted provider navigation, source rows, repair action, safe logs, and playback boundary
affects: [phase-23-closeout, phase-24-fresh-production-playback-proof]
requirements-completed: [REP-02, REP-03]

tech-stack:
  added: []
  patterns:
    - explicit server-side projection allowlists for provider, runner, receipt, and source facts
    - current attempt first with older attempts retained as bounded expandable history
    - authoritative source readback must match receipt identity, revision, time, counts, and row facts before repair validation

key-files:
  created:
    - .planning/phases/23-github-actions-production-repair-and-reconciliation/23-05-SUMMARY.md
  modified:
    - apps/api/src/routes/admin/crawler-tasks/index.ts
    - apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts

key-decisions:
  - "Keep provider, lease, reconciliation, repair result, receipt validation, source state, and playback proof as separate Dashboard fact layers."
  - "Rebuild the provider run URL only from the fixed provider repository and validated numeric run ID; raw runner/provider material stays out of the DTO."
  - "Treat missing or incomplete authoritative source readback as receipt failure instead of inferring repair success from a provider completion or receipt alone."
  - "Display 播放未验证 in Phase 23; fresh tuple, Viewer, playing, and currentTime proof remain Phase 24 evidence."

coverage:
  - id: D1
    description: "Current-attempt and bounded history API projection with independent provider, lease, reconciliation, receipt, source, and redaction facts."
    requirement: REP-02
    verification:
      - kind: unit
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Same-movie duplicate lock, fresh disposition reread, provider link allowlist, and incomplete readback failure behavior."
    requirement: REP-03
    verification:
      - kind: unit
        ref: "apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dashboard UI-SPEC coverage for current focus, history disclosure, loading/error/partial states, source rows, safe logs, repair action, and playback boundary."
    requirement: REP-02
    verification:
      - kind: unit
        ref: "apps/dashboard/src/views/__test__/Crawlers.test.ts"
        status: pass
    human_judgment: false

duration: unmeasured-continuation
completed: 2026-08-08
status: complete
---

# Phase 23 Plan 05 Summary

## Accomplishments

- Extended the repair admin read model with server-owned task identity, current application attempt, bounded older attempts, task-level retry, provider association, lease, reconciliation, repair result, receipt validation, source projection/readback, and safe-log cursor facts.
- Kept provider navigation allowlisted and reconstructed from the fixed repository plus validated provider run ID; raw URLs, commands, secrets, signatures, safe-facts JSON, and runner fields are excluded.
- Added same-movie active repair locking and current task focus. Manual repair creation and repair-run retry reread the current source disposition immediately before repository mutation.
- Built the Dashboard current-attempt focal surface with collapsed history, bounded source health rows, distinct provider/repair/receipt/source layers, controlled same-movie return, visible refresh state, and `播放未验证` for the Phase 24 playback boundary.
- Tightened receipt validation so provider success or a receipt alone does not imply repair success: authoritative readback must be present and match identity, revision, observedAt, source counts, eligible counts, and every bounded source row.

## Verification

- `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` - 1 file, 22 tests passed.
- `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` - 1 file, 17 tests passed.
- `pnpm --filter api type-check` passed.
- `pnpm --filter dashboard type-check` passed.
- `git diff --check` passed.
- GitNexus staged detect is required before the implementation commit and will be recorded during closeout.

## Known Boundary

Phase 23 proves the bounded production repair/reconciliation control surface and does not claim a fresh production tuple, Viewer navigation proof, `playing`, or `currentTime` playback evidence. Those remain Phase 24 requirements.

## Status

Complete.
