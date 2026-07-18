---
phase: 13-full-chain-data-smoke
plan: "07"
subsystem: data-chain-smoke
tags: [provenance, puppeteer, smoke-evidence, vitest, fail-closed]

requires:
  - phase: 13-06
    provides: one-item runner and D1 snapshot observations bound to the exact target/run tuple
provides:
  - Tuple-bound allowlisted execution receipts for every terminal evidence surface
  - Runner/provider receipt capture and a controlled Dashboard/viewer browser observer
  - Artifact-only provenance verifier with optional injected runner exit consistency checks
affects: [13-08, data-chain-smoke, selected-target, phase-verification]

tech-stack:
  added: []
  patterns:
    - Exact tuple-bound execution receipts with allowlisted integrity inputs
    - Browser observation after bounded SPA tuple settlement
    - Artifact verification separated from smoke execution

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-07-SUMMARY.md
    - .planning/phases/13-full-chain-data-smoke/deferred-items.md
  modified:
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
    - scripts/data-chain-smoke.ts
    - scripts/data-chain-surface-observation.ts
    - scripts/verify-data-chain-smoke.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
    - packages/config/src/deployment-target/__tests__/verify-data-chain-smoke.test.ts

key-decisions:
  - "Terminal passed rows require a source-specific receipt bound to the enclosing mode, target, run, code, id, surface, and canonical path."
  - "The controlled observer derives its tuple from pending evidence, waits for the SPA to expose that tuple, and persists checkpoint evidence for browser or target-base failures."
  - "The verifier reads existing JSON/Markdown artifacts without rerunning the smoke runner; runner exit consistency is checked only when a caller explicitly injects a run."

patterns-established:
  - "Reduce runner/provider/browser facts to typed non-secret receipts before evidence can advance."
  - "Turn external observer failures into durable code-2 checkpoints rather than uncaptured exceptions."

requirements-completed: [DATA-01, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Terminal local and remote evidence accepts only complete allowlisted provenance receipts for the exact one-item tuple.
    requirement: DATA-07
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter @starye/config test --run
        status: pass
    human_judgment: false
  - id: D2
    description: Local and remote runners capture execution provenance while the controlled browser observer verifies Dashboard then viewer after SPA tuple settlement.
    requirement: DATA-05
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts
        status: pass
      - kind: other
        ref: pnpm --filter @starye/crawler type-check
        status: pass
    human_judgment: false
  - id: D3
    description: The verifier validates persisted provenance-aware artifacts without overwriting them by rerunning the smoke workflow.
    requirement: TEST-05
    verification:
      - kind: unit
        ref: pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/verify-data-chain-smoke.test.ts
        status: pass
      - kind: other
        ref: pnpm smoke:data-chain:verify -- --help (expected safe exit 1)
        status: pass
    human_judgment: false

duration: 1h 30m
completed: 2026-07-18
status: complete
---

# Phase 13 Plan 07: Provenance-Aware Smoke Evidence Summary

**Tuple-bound runner, provider, and browser receipts now make terminal smoke evidence independently auditable without exposing secrets or allowing operator-supplied pass claims.**

## Performance

- **Duration:** 1h 30m
- **Started:** 2026-07-18T03:46:39Z
- **Completed:** 2026-07-18T05:16:50Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Added allowlisted execution receipts whose source, capture type, tuple, surface, canonical path, timestamp, result, and integrity must match each terminal evidence row.
- Bound local and remote runner receipts to actual injected execution results, and replaced caller status claims with one controlled Dashboard-then-viewer browser observer.
- Made the verifier consume existing provenance-aware artifacts without rerunning or overwriting the smoke runner output, while retaining explicit runner exit-code consistency checks for tests and callers that inject one.

## Task Commits

1. **Task 1: Extend evidence with allowlisted execution and browser provenance receipts** - `71c5a61` (RED), `e1756f4` (GREEN)
2. **Task 2: Capture actual runner and browser observations before evidence can pass** - `91ee0e1` (RED), `99aad8f` (GREEN)
3. **Task 3: Make the evidence verifier require provenance-aware terminal artifacts** - `7092e63` (RED), `7d47956` (GREEN)
4. **Plan verification corrections** - `a0bd95f` (fix)

## Files Created/Modified

- `packages/config/src/deployment-target/data-chain-evidence.ts` - defines receipt types, integrity binding, allowlist validation, and terminal coverage rules.
- `scripts/data-chain-smoke.ts` - derives local runner and remote provider receipts from actual dependency results.
- `scripts/data-chain-surface-observation.ts` - controls canonical browser navigation, tuple settlement, ordered observations, and durable checkpoints.
- `scripts/verify-data-chain-smoke.ts` - validates persisted JSON/Markdown pairs and provenance without default runner execution.
- `packages/config/src/deployment-target/__tests__/` - covers anti-fabrication, runner, browser, target-base, artifact-only, and exit-consistency regressions.

## Decisions Made

- Receipt integrity is derived only from allowlisted non-sensitive fields; raw bodies, origins, commands, cookies, headers, tokens, and prepared context remain forbidden.
- Browser proof is owned by one fixed CLI and repository browser adapter; operators select only mode, target, and run id, never a surface status or item tuple.
- A target/canonical-base or browser failure is still useful evidence, so it is persisted as an enumerated code-2 checkpoint instead of escaping as an unrecorded error.
- Artifact verification and smoke execution are separate operations; callers may explicitly inject a runner only when they need an additional exit-code consistency assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented the verifier from overwriting terminal observer evidence**
- **Found during:** Plan-level code review after Task 3
- **Issue:** Default verification reran the smoke runner before loading the pair, replacing the terminal Dashboard/viewer artifact it was supposed to inspect.
- **Fix:** Removed the default runner import and execution; explicit injected runners still receive strict exit-code consistency validation.
- **Files modified:** `scripts/verify-data-chain-smoke.ts`, `packages/config/src/deployment-target/__tests__/verify-data-chain-smoke.test.ts`
- **Verification:** Focused verifier tests, Config full suite, Config/Crawler typechecks, ESLint
- **Committed in:** `a0bd95f`

**2. [Rule 1 - Bug] Waited for SPA tuple rendering before browser success**
- **Found during:** Plan-level code review after Task 3
- **Issue:** The default Puppeteer path evaluated content immediately after `domcontentloaded`, before Vue data could render.
- **Fix:** Added a 30-second mutation-polled `waitForFunction` for the exact code/id tuple, then rechecked the settled canonical URL and tuple.
- **Files modified:** `scripts/data-chain-surface-observation.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts`
- **Verification:** Fake browser/page default-path regression, focused runner tests, Crawler typecheck, ESLint
- **Committed in:** `a0bd95f`

**3. [Rule 1 - Bug] Persisted target-base failures as checkpoint evidence**
- **Found during:** Plan-level code review after Task 3
- **Issue:** Target resolution or canonical-base policy failures exited with code 1 after a valid pending pair had already been loaded, leaving no durable checkpoint.
- **Fix:** Converted resolution failures into a `dashboard_auth_unavailable` observation, wrote deterministic JSON/Markdown, skipped browser launch, and returned code 2.
- **Files modified:** `scripts/data-chain-surface-observation.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-remote.test.ts`
- **Verification:** Invalid remote direct-port regression checks exit 2, pair parity, and zero observer calls
- **Committed in:** `a0bd95f`

**4. [Rule 1 - Bug] Allowed the canonical local Gateway port in the default observer**
- **Found during:** Browser default-path regression for deviation 2
- **Issue:** A blanket endpoint-port rejection also rejected the repository's required `http://localhost:8080` Gateway, making local default observation permanently unavailable.
- **Fix:** Required the endpoint to retain the already-approved base origin and path; remote target resolution continues to forbid direct ports.
- **Files modified:** `scripts/data-chain-surface-observation.ts`, `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts`
- **Verification:** Default observer regression passes through `http://localhost:8080/dashboard/movies`; remote direct-port regression remains fail-closed
- **Committed in:** `a0bd95f`

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs).
**Impact on plan:** All corrections were required for the planned verifier/observer behavior and stayed within the listed files and threat model.

## Issues Encountered

- The repository has a pre-existing missing Git object (`20e2714bb69ba9055ab73b261b275777394dac48`, historical path `apps/dashboard/src/views/PostEditor.vue`). It did not affect plan files or verification; history repair remains explicitly out of scope and is recorded in `deferred-items.md`.

## User Setup Required

None - this plan performed contract implementation and injected verification only; it did not use local secrets, a Dashboard session, or Cloudflare/provider credentials.

## Next Phase Readiness

- 13-08 can now attempt the authorized local and selected-target runs using exact one-item, receipt-backed runner/provider/browser evidence.
- Phase 13 is not complete yet: unavailable local secrets, Dashboard session, browser, or provider access must remain honest persisted checkpoints during 13-08 rather than being inferred from these contract tests.

## Self-Check: PASSED

- Summary, deferred-item record, and all eight implementation/test files exist.
- All seven Task 1-3 and plan-verification commits are present in git history.

---
*Phase: 13-full-chain-data-smoke*
*Completed: 2026-07-18*
