---
phase: 12-cloudflare-config-switching
plan: "04"
subsystem: direct-remote-entry-boundary
tags: [deployment-target, d1, crawler, typescript-compiler-api, vitest]
requires:
  - phase: 12-01
    provides: selected-target preparation, run-scoped context, and initial closed remote entry seam.
  - phase: 12-03
    provides: workflow target resolution and prepared-context-only CI mutation calls.
provides:
  - A closed D1/crawler entry registry with fixed child modules, operations, options, and secret-key names.
  - Explicit-target package aliases and fail-closed direct DB/crawler executable paths.
  - TypeScript Program/TypeChecker regression checks for DB scripts and all crawler direct CLI candidates.
affects: [13-full-chain-data-smoke, 14-test-and-operations-hardening]
key-files:
  created:
    - packages/db/scripts/target-d1-mutation.ts
    - packages/crawler/scripts/target-crawl-mutation.ts
    - packages/config/src/deployment-target/__tests__/db-source-entry-contract.test.ts
    - packages/config/src/deployment-target/__tests__/crawler-source-entry-contract.test.ts
  modified:
    - packages/config/src/deployment-target/mutation-entry.ts
    - packages/db/package.json
    - packages/crawler/package.json
requirements-completed: [DEPL-04, DEPL-05, TEST-04]
metrics:
  tasks_completed: 2
  files_modified: 43
  completed: 2026-07-15
status: complete
---

# Phase 12 Plan 04: Direct Entry Closure Summary

**DB and crawler package/source entry points now require an explicit selected-target handoff or fail before loading ambient database, crawler, API, R2, or dotenv identity. No remote operation ran.**

## Accomplishments

- Replaced the remote-entry string list with a closed definition registry. Every entry fixes its child module, operation, execution mode, bounded options, and secret-key names.
- Added D1 and crawler prepared children. They accept only registry-owned context/environment values; crawler diagnostics emit key names plus boolean presence state, never values or endpoints.
- Replaced raw remote package aliases with `target-remote-entry` wrappers. Legacy direct DB/crawler CLIs are blocked until a prepared or proven local/external path is registered.
- Added `ts.Program`/`TypeChecker` contract suites. The crawler suite compiles the full source tree, discovers every direct `process.argv` dispatch, and fails for an unclassified new executable or an aliased `ImageProcessor` sink.

## Task Commits

1. **Task 1: Close direct D1 package mutations behind fixed prepared operations** - `19436ff` (`feat(12-04): close DB mutation entry paths`)
2. **Task 2: Register crawler diagnostics and close every direct crawler source path** - `e7cd388` (`feat(12-04): close crawler source entry paths`)

## Verification

- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/mutation-entry.test.ts src/deployment-target/__tests__/package-entrypoint-contract.test.ts src/deployment-target/__tests__/db-source-entry-contract.test.ts src/deployment-target/__tests__/crawler-source-entry-contract.test.ts` - 4 files, 8 tests passed.
- `pnpm --filter @starye/db type-check` - passed.
- `pnpm --filter @starye/crawler type-check && pnpm --filter @starye/crawler test --run` - passed, 14 files / 74 tests.
- `pnpm target-profile validate --target starye-org` - passed without remote execution.
- GitNexus `detect-changes` was LOW with no affected execution flows before each task commit.

## Deviations From Plan

1. The plan's Vitest paths omitted the repository's `__tests__` directory. The corrected paths above executed the intended tests; the original paths would have produced Vitest's misleading zero-test exit code.
2. Three previously unlisted direct crawler CLIs were discovered by the source-wide scan. They were added as explicit `blocked-import-only` entries rather than left as unclassified bypasses.

## User Setup Required

No setup was required for this static closure. Phase 13 remains the owner of authorized Cloudflare/D1/R2/crawler execution and end-to-end smoke evidence.

## Self-Check: PASSED

- Both task commits exist in Git history.
- Registry, package, source-audit, DB, and crawler verification passed locally.
- No target run artifact or remote command was created.
- Only the protected user changes in `.planning/config.json`, `AGENTS.md`, and `CLAUDE.md` remain dirty.

---
*Phase: 12-cloudflare-config-switching*
*Completed: 2026-07-15*
