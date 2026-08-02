---
status: resolved
trigger: Deploy Dashboard run 30760086008 fails while building shared API types after Phase 16-19 history is pushed to main.
created: 2026-08-03
updated: 2026-08-03T02:05:00+08:00
---

# Debug: Dashboard Pages Build Types

## Symptoms

- Expected behavior: `pnpm target-profile run-pages-build --surface dashboard` builds shared API types and the Dashboard.
- Actual behavior: `tsc -b` stops in `production-workflow.integration.test.ts` before the Dashboard build.
- Error message: Missing `afterEach` plus tuple-index errors for `execute.mock.calls[0]`.
- Timeline: First production build of the Phase 16-19 local history at commit `6051cb5`.
- Reproduction: Run `pnpm --filter @starye/api-types build` from the repository root.

## Current Focus

- hypothesis: The integration test omitted the Vitest lifecycle import and declared a zero-argument mock even though the production dependency contract passes three arguments.
- test: Add the missing import and annotate the mock with the same three-argument signature used by the adjacent mutation-entry test, then rerun the exact failing build and focused test.
- expecting: The seven TypeScript diagnostics disappear without changing runtime symbols.
- next_action: Complete.

## Evidence

- timestamp: 2026-08-03T02:05:00+08:00
  observation: Local `pnpm --filter @starye/api-types build` reproduces all seven diagnostics from GitHub run 30760086008.
- timestamp: 2026-08-03T02:05:00+08:00
  observation: GitNexus does not index the test-local mock; query shows `runPreparedTargetMutation` as the runtime symbol under test, and this repair does not modify it.
- timestamp: 2026-08-03T02:05:12+08:00
  observation: `pnpm --filter @starye/api-types build` passes after the repair, and the focused Vitest file passes 3 of 3 tests.

## Eliminated

- hypothesis: The Dashboard Vue implementation itself fails TypeScript compilation.
  evidence: Compilation stops while building the referenced config project, before Dashboard source compilation.

## Resolution

- root_cause: The test omitted the imported `afterEach` binding and inferred `vi.fn` as a zero-argument mock, so TypeScript rejected both the lifecycle call and indexed access to the three runtime call arguments.
- fix: Import `afterEach` from Vitest and give the mock the production dependency's three-argument signature.
- verification: `pnpm --filter @starye/api-types build` passes; focused production workflow integration tests pass 3 of 3.
- files_changed: [packages/config/src/deployment-target/__tests__/production-workflow.integration.test.ts, .planning/debug/dashboard-pages-build-types.md]
