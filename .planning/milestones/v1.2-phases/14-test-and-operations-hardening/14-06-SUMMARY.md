---
phase: 14-test-and-operations-hardening
plan: "06"
subsystem: operations-documentation
tags: [runbook, target-profile, vitest, smoke, recovery]
requires:
  - phase: 11-deployment-target-foundation
    provides: Explicit non-secret TargetProfile resolution and fail-closed preflight boundaries.
  - phase: 13-full-chain-data-smoke
    provides: Persisted passed, failed, and checkpoint smoke outcome semantics.
provides:
  - Target-first RUNBOOK procedure with explicit target, projection/preflight, operator mutation, smoke, and recovery ordering.
  - Metadata-only required-secret matrix and static documentation regression contract.
affects: [14-07-evidence-matrix, phase-14-verification, operations]
tech-stack:
  added: []
  patterns:
    - Stable operations prose derives target identity from TargetProfile rather than copied domain or resource values.
    - Only terminal passed completes a smoke run; failed and checkpoint preserve evidence and require a new run after recovery.
key-files:
  created:
    - packages/config/src/deployment-target/__tests__/runbook-contract.test.ts
  modified:
    - RUNBOOK.md
key-decisions:
  - "RUNBOOK uses explicit target placeholders and profile metadata instead of a default production target registry."
  - "Required-secret guidance mirrors only names, consumers, local files, CI environments, and preflight entry points."
  - "Failed and checkpoint smoke results stop mutation, retain evidence, and route through bounded recovery."
patterns-established:
  - "RUNBOOK contract tests read tracked documentation and TargetProfile metadata without provider or credential execution."
requirements-completed: [TEST-06]
coverage:
  - id: D1
    description: Target-first RUNBOOK procedure with metadata-bound secret guidance and terminal smoke recovery semantics.
    requirement: TEST-06
    verification:
      - kind: unit
        ref: "pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/runbook-contract.test.ts"
        status: pass
      - kind: other
        ref: "git diff --check"
        status: pass
    human_judgment: false
duration: 13m 45s
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 06: Target-First RUNBOOK Contract Summary

**RUNBOOK now selects an explicit TargetProfile before local projection, operator mutation, smoke, and bounded recovery, with a metadata-only secret matrix guarded by Vitest.**

## Performance

- **Duration:** 13m 45s
- **Started:** 2026-07-21T01:49:39Z
- **Completed:** 2026-07-21T02:03:24Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Added a RED-first static RUNBOOK contract that checks D-05 ordering, Gateway-first local browser URLs, metadata-only required-secret rows, and bounded terminal smoke behavior.
- Replaced the fixed production-surface and secret lists with an explicit target-first procedure and a matrix reconciled to tracked profile metadata without resource or secret values.
- Linked existing Worker, Pages, and D1 recovery sections instead of copying target identities or Phase 13 evidence history into the stable operations owner.

## Task Commits

1. **Task 1: Define the target-first RUNBOOK documentation contract**
   - `d1d887e` `test(14-06): add failing RUNBOOK contract`
2. **Task 2: Rewrite the canonical operations procedure and preserve owner boundaries**
   - `f612426` `docs(14-06): define target-first operations procedure`

## Files Created/Modified

- `packages/config/src/deployment-target/__tests__/runbook-contract.test.ts` - Reads the stable RUNBOOK and TargetProfile metadata to enforce ordering, secret boundaries, and terminal-state recovery semantics.
- `RUNBOOK.md` - Defines the target-first operational procedure and removes copied target identities from deploy, rollback, D1, troubleshooting, and WAF guidance.

## Decisions Made

- Target identity remains profile-derived at every operational stage; RUNBOOK commands use explicit placeholders rather than a default account, domain, resource, Worker, or Pages project.
- Required-secret documentation is limited to profile metadata fields required by operators and preflight; secret and resource values remain outside the document.
- A smoke `passed` result alone is complete. `failed` and `checkpoint` preserve evidence, stop the current run, classify recovery, and require a new tuple after recovery.

## TDD Evidence

- RED: `d1d887e` added the contract and verified it failed against the previous default-target RUNBOOK.
- GREEN: `f612426` rewrote the stable procedure; the contract now passes 4/4 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] Avoided a false copied-identity failure for allowed profile metadata.**
- **Found during:** Task 2
- **Issue:** The test treated `profile.account.name` as forbidden copied identity even when it equals the allowed profile ID and CI environment metadata rendered by the required-secret matrix.
- **Fix:** Continue rejecting account IDs, domains, URLs, resources, Worker names, and Pages values, while allowing the required profile/CI metadata cell.
- **Files modified:** `packages/config/src/deployment-target/__tests__/runbook-contract.test.ts`
- **Verification:** `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/runbook-contract.test.ts` passed 4/4.
- **Committed in:** `f612426`

**2. [Rule 1 - TypeScript type correction] Narrowed resource identity assertions by resource kind.**
- **Found during:** Wave 1 post-merge `pnpm build` gate.
- **Issue:** The RUNBOOK contract treated every resource variant as though both `name` and `id` existed. The `kv` and `r2` variants intentionally expose only one of those fields, so the full config TypeScript build failed even though Vitest executed the runtime assertion.
- **Fix:** Branch on the resource `kind` discriminant and collect only fields guaranteed by each variant: D1 `name`/`id`, R2 `name`, and KV `id`.
- **Files modified:** `packages/config/src/deployment-target/__tests__/runbook-contract.test.ts`
- **Verification:** Re-ran the focused Vitest contract and `pnpm --filter @starye/config build` after the correction.
- **Committed in:** Post-merge 14-06 scoped repair commit.

**Total deviations:** 2 auto-fixed (2 Rule 1 corrections).
**Impact on plan:** Both corrections preserve the original metadata-only RUNBOOK contract. The post-merge change restores type safety without omitting any resource identity value that exists in a tracked profile.

## Issues Encountered

- The first RED commit was rejected by the repository commit-message body line-length rule. Retrying with compliant body lines completed the same scoped commit without changing task content.

## User Setup Required

None - no provider, credential, deployment, migration, crawler, smoke, browser, or Cloudflare command was executed.

## Next Phase Readiness

- Plan 14-07 can reference this stable owner while keeping the 30-row requirement-to-evidence matrix and Phase 13 blocked/partial truth in Phase 14 artifacts.
- No remote outcome changed. Any Phase 13 gap closure remains on its canonical verifier-driven route.

---
*Phase: 14-test-and-operations-hardening*
*Completed: 2026-07-21*

## Self-Check: PASSED

- Found `RUNBOOK.md`, the RUNBOOK contract test, and this summary on disk.
- Found task commits `d1d887e` and `f612426` in Git history.
- Confirmed the post-merge resource-union correction with the focused contract test and the `@starye/config` build.
- No TODO/FIXME, placeholder, or empty-value stubs were found in Plan 14-06 files.
