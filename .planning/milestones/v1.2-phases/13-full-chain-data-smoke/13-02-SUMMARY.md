---
phase: 13-full-chain-data-smoke
plan: "02"
subsystem: selected-target-data-mutation
tags: [prepared-entry, smoke-fixture, d1-snapshot, service-auth, vitest]

requires:
  - phase: 12-cloudflare-config-switching
    provides: explicit selected-target preparation, remote preflight, and closed prepared child entry boundary
  - phase: 13-full-chain-data-smoke
    plan: "01"
    provides: deterministic target/run item identity and redacted evidence lifecycle
provides:
  - exactly two fixed prepared smoke operations with declared-secret-only child environments
  - deterministic one-item non-R18 service-auth fixture and typed D1 snapshot observation
  - fake-executor regression coverage for preflight gates, secret redaction, fixed query ownership, and tuple correlation
affects: [13-03, 13-04, smoke:data-chain]

key-files:
  created:
    - packages/crawler/src/smoke/data-chain-fixture.ts
    - packages/crawler/src/smoke/__tests__/data-chain-fixture.test.ts
    - packages/db/scripts/__tests__/target-d1-mutation.test.ts
  modified:
    - packages/config/src/deployment-target/mutation-entry.ts
    - packages/crawler/scripts/target-crawl-mutation.ts
    - packages/db/scripts/target-d1-mutation.ts
    - scripts/target-remote-entry.ts
    - packages/crawler/package.json
    - packages/db/package.json

requirements-completed: [DATA-03, DATA-04, DATA-07, TEST-05]
completed: 2026-07-16
status: complete
---

# Phase 13 Plan 02: Bounded Fixture And Snapshot Summary

**The selected-target prepared-entry seam now permits exactly one deterministic service-auth fixture upsert and one read-only D1 snapshot, with no free-form command, target, SQL, endpoint, output-path, or secret-bearing evidence channel.**

## Accomplishments

- Added only `crawler-smoke-fixture` and `d1-smoke-snapshot` to the closed remote registry. Both map to literal child modules/operations, empty option lists, and the minimum declared secrets (`CRAWLER_SECRET` or `CLOUDFLARE_API_TOKEN`).
- Remote smoke preparation now runs the existing `smoke` preflight before context materialization, stores the non-secret deterministic item code in prepared context, forwards only definition-declared secret values to a fresh child environment, and rejects malformed context or non-allowlisted child JSON.
- Implemented a deterministic, non-R18, one-movie/one-player fixture that calls `ApiClient.syncMovie()` exactly once with the existing service-auth upsert transport. It deliberately omits actors and publishers.
- Implemented a fixed, selected-config D1 snapshot child that issues a read-only item-code query through an injected fake executor in tests and returns only operation/status/code/id observation fields. No provider command was executed in this plan.

## Task Commits

1. **Task 1: Add fixed smoke registry operations and preserve the prepared execution boundary** - `7770d6c` (`feat(13-02): add bounded smoke mutation registry`)
2. **Task 2: Implement the one-item service-auth fixture and deterministic D1 snapshot children** - `043d3ed` (`feat(13-02): implement deterministic data-chain fixture and snapshot`)

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/mutation-entry.test.ts` - passed, 7 tests.
- `pnpm --filter @starye/config exec tsc --noEmit` - passed.
- `pnpm --filter @starye/crawler exec vitest run src/smoke/__tests__/data-chain-fixture.test.ts src/utils/__tests__/api-client.test.ts` - passed, 13 tests.
- `pnpm --filter @starye/db exec vitest run scripts/__tests__/target-d1-mutation.test.ts` - passed, 2 tests.
- `pnpm --filter @starye/crawler type-check && pnpm --filter @starye/db type-check` - passed.
- `pnpm --filter @starye/config test --run` - passed, 18 files / 108 tests.
- `pnpm --filter @starye/crawler test --run` - passed, 15 files / 81 tests.
- `pnpm lint-staged` - passed before the Task 2 amend.
- `git diff --check` - passed.
- GitNexus impact analysis was LOW for `prepareTargetMutation`, `runPreparedTargetMutation`, `runTargetCrawlerMutation`, `runTargetD1Mutation`, `ApiClient.syncMovie`, and `runTargetRemoteEntry`. Final `detect_changes` marked the expected shared preparation flow as HIGH because `prepareTargetMutation` is step 1 of seven preflight helper traces; no unexpected execution flow was present.

## Deviations From Plan

### Auto-fixed Issues

**1. [Rule 1 - Build hygiene] Corrected new test factory typing and deterministic hash fixture.**
- **Found during:** Task 2 GREEN verification.
- **Issue:** the multiple-player test factory received target/run input rather than a fixture, and the initial D1 expected code did not match the Phase 13 deterministic hash.
- **Fix:** wrapped the test factory around the canonical fixture builder and corrected the expected target/run-derived code.
- **Files modified:** `packages/crawler/src/smoke/__tests__/data-chain-fixture.test.ts`, `packages/db/scripts/__tests__/target-d1-mutation.test.ts`.
- **Verification:** focused crawler and DB tests passed.
- **Committed in:** `043d3ed`.

### Necessary Scope Extensions

**2. [Rule 3 - Required integration] Carried the canonical smoke item code through prepared context and added closed package/wrapper integration.**
- **Found during:** Task 2 typecheck and package-entrypoint contract verification.
- **Issue:** DB composite typecheck cannot import the config source barrel without breaking project boundaries; the existing package-entrypoint contract also requires every closed remote registry entry to have a target-remote-entry alias. The existing remote wrapper discarded child stdout, so it could not return the required typed observation.
- **Fix:** `prepareTargetMutation()` writes the non-secret canonical `smokeItemCode` only for the two smoke entries; both children consume it, package aliases delegate only to `target-remote-entry`, and the wrapper returns/prints only the validated observation.
- **Files modified:** `packages/config/src/deployment-target/mutation-entry.ts`, `packages/crawler/package.json`, `packages/db/package.json`, `scripts/target-remote-entry.ts`.
- **Verification:** config 108/108, crawler 81/81, crawler/DB typechecks, and focused fake-executor tests passed.
- **Committed in:** `043d3ed`.

**Total deviations:** 1 auto-fixed build-hygiene correction and 1 required integration extension.
**Impact:** The scope remains bounded to the selected-target prepared-entry contract; no API route, local environment file, raw client, broad crawler, deployment, schema mutation, or provider operation was introduced.

## Issues Encountered

- The GSD commit wrapper reports `commit_failed` after approximately 10 seconds while the repository's successful `lint-staged` invocation takes about 11 seconds. Git evidence confirmed both task commits were created. For Task 2, the wrapper's post-hook formatting changes were verified with a full `pnpm lint-staged` run and amended into the same task commit using `--no-verify`.

## User Setup Required

None for this implementation and fake-executor verification. A later authorized remote smoke still requires the selected target credentials and real provider ownership checks; this plan deliberately did not invoke them.

## Next Phase Readiness

- Plan 13-03 can call only the fixed fixture/snapshot operations after its local projection, schema, service, and Gateway gates pass.
- Plan 13-04 can receive typed child observations through the selected-target wrapper; a remote credential or ownership failure remains a checkpoint before either child starts.
- No Cloudflare, D1, R2, crawler network, deploy, or data-writing command was executed.

## Self-Check: PASSED

- Both task commits exist in Git history and this Summary is present.
- All planned automated tests, full config/crawler suites, typechecks, lint-staged, and whitespace validation passed.
- Only the protected user changes in `.planning/config.json`, `AGENTS.md`, and `CLAUDE.md` remain dirty.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 02*
*Completed: 2026-07-16*
