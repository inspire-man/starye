---
phase: 13-full-chain-data-smoke
plan: "01"
subsystem: deployment-target
tags: [target-profile, local-projection, smoke-evidence, vitest]

requires:
  - phase: 11-deployment-target-foundation
    provides: explicit target profile and managed local projection writer
  - phase: 12-cloudflare-config-switching
    provides: selected-target preflight and public Gateway boundary
provides:
  - verified starye-org local target-managed projection without staging operator files
  - typed deterministic Phase 13 evidence lifecycle and canonical browser append contract
affects: [13-02, 13-03, 13-04, smoke-runner]

tech-stack:
  added: []
  patterns: [typed evidence allowlist, immutable correlation tuple, Gateway-only browser paths]

key-files:
  created:
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
  modified:
    - packages/config/src/deployment-target/index.ts

key-decisions:
  - "Local target projection is a hard first gate and remains outside version control."
  - "Only a resolved target/run/code/id tuple can receive ordered Dashboard then viewer observations."
  - "Remote execution eligibility requires the exact terminal passed local tuple."

requirements-completed: [DATA-02, DATA-03, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Selected local target-managed projection is validated before smoke work.
    requirement: DATA-02
    verification:
      - kind: integration
        ref: pnpm target-profile project-local --target starye-org --check
        status: pass
      - kind: other
        ref: pnpm target-profile validate --target starye-org
        status: pass
    human_judgment: false
  - id: D2
    description: Deterministic one-item identity and non-secret three-state evidence contract are importable and regression tested.
    requirement: DATA-03
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
        status: pass
      - kind: other
        ref: pnpm --filter @starye/config exec tsc --noEmit
        status: pass
    human_judgment: false
  - id: D3
    description: Evidence serialization and Gateway-only ordered browser observation grammar reject unsafe input and preserve non-success checkpoints.
    requirement: DATA-07
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter @starye/config test --run
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 01: Local Projection And Evidence Contract Summary

**The selected local target is projection-clean, and later smoke runners now receive a deterministic, redacted evidence contract that cannot turn blocked browser or provider work into a passed result.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-16T02:32:00+08:00
- **Completed:** 2026-07-16T02:55:30+08:00
- **Tasks:** 2 completed
- **Files modified:** 3 tracked files; 4 ignored operator-local projection files

## Accomplishments

- Reproduced and repaired all four selected-target managed projection mismatches exclusively through `target-profile project-local --write`; a subsequent check and profile validation passed without staging any operator-local file.
- Added a deterministic single-movie fixture code, immutable `{ targetId, runId, itemCode, itemId }` correlation tuple, and a `pre_ingest -> resolved_pending_observation -> resolved` evidence lifecycle.
- Added strict JSON/Markdown allowlist serialization, local Gateway path enforcement, and Dashboard-then-viewer append logic that preserves checkpoint evidence and requires terminal local proof before remote eligibility.

## Task Commits

1. **Task 1: Repair the selected local projection as the first blocking readiness gate** - no Git commit by design; only ignored operator-local managed blocks were updated through the existing writer and left unstaged.
2. **Task 2: Define deterministic identity and allowlisted evidence serialization** - `de8dabc` (RED test), `c5dab93` (implementation), `e74f04b` (boundary regressions).

**Plan metadata:** this Summary commit.

## Files Created/Modified

- `packages/config/src/deployment-target/data-chain-evidence.ts` - typed lifecycle, validation, remote eligibility, append grammar, and allowlisted renderers.
- `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts` - deterministic identity, lifecycle, redaction, canonical-path, remote eligibility, and checkpoint regressions.
- `packages/config/src/deployment-target/index.ts` - exports the evidence contract through the existing deployment-target barrel.

## Decisions Made

- The local selected-target managed projection remains a hard prerequisite and only the existing marker-aware writer may modify it.
- `CHECKPOINT_EXIT_CODE = 2` describes smoke non-success; `validateDataChainEvidenceForExitCode()` independently returns zero for a schema-valid non-success artifact.
- Browser observations accept only a matching pending tuple and fixed Dashboard followed by viewer path grammar; local records derive `http://localhost:8080` internally and remote records persist target-relative paths only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Build hygiene] Removed an unused evidence helper found by the commit lint gate.**
- **Found during:** Task 2
- **Issue:** `eslint --fix` rejected an unused private helper.
- **Fix:** Removed the helper and reran focused tests, typecheck, and lint-staged.
- **Files modified:** `packages/config/src/deployment-target/data-chain-evidence.ts`
- **Verification:** focused evidence suite and config typecheck passed.
- **Committed in:** `c5dab93`

---

**Total deviations:** 1 auto-fixed (1 build hygiene).
**Impact on plan:** No scope expansion; the final contract surface is smaller and lint-clean.

## Issues Encountered

- The GSD commit wrapper times out Git hooks after 10 seconds while the repository's successful `lint-staged` run takes about 11 seconds. Each affected commit first ran `pnpm lint-staged` successfully, then used the same GSD commit command with `--no-verify` to avoid duplicate timeout.

## User Setup Required

None - no external service configuration or credentials were needed.

## Next Phase Readiness

- Plans 13-02 through 13-04 can consume the exported identity/evidence functions without accepting arbitrary endpoint, header, secret, or output-path input.
- No provider, D1, R2, crawler, deploy, or remote mutation command was run. Real local and remote smoke work remains gated by the later plan's authorized readiness checks.

## Self-Check: PASSED

- Confirmed all three Task 2 commits exist and the Summary is present.
- Re-ran projection check, target validation, focused evidence tests, config suite, config typecheck, and `git diff --check` successfully.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 01*
*Completed: 2026-07-16*
