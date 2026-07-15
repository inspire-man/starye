---
phase: 12-cloudflare-config-switching
plan: "03"
subsystem: deployment-workflows
tags: [github-actions, cloudflare, target-profile, rollback, crawler, vitest]
requires:
  - phase: 12-01
    provides: CI mutation preparation, selected-target resource checks, generated config paths, and closed prepared entries.
  - phase: 12-02
    provides: Typed generated Pages runtime configuration and fixed Pages build adapters.
provides:
  - Static proof that every Phase 12 remote mutation workflow uses the selected target resolver, mapped GitHub Environment, fixed secret names, and exactly one CI preparation gate.
  - Target-aware Worker, Pages, migration, crawler, cleanup, and rollback workflow orchestration without remote execution.
affects: [12-04-direct-entry-audit, 13-full-chain-data-smoke, 14-test-and-operations-hardening]
tech-stack:
  added: []
  patterns: [resolver-to-environment, prepared-context-only, fixed-pages-surface, static-workflow-contract]
key-files:
  created:
    - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
  modified:
    - .github/workflows/deploy-api.yml
    - .github/workflows/deploy-gateway.yml
    - .github/workflows/deploy-api-after-pr.yml
    - .github/workflows/deploy-dashboard.yml
    - .github/workflows/deploy-auth.yml
    - .github/workflows/deploy-blog.yml
    - .github/workflows/deploy-movie.yml
    - .github/workflows/deploy-comic.yml
    - .github/workflows/deploy-migrations.yml
    - .github/workflows/daily-manga-crawl.yml
    - .github/workflows/daily-movie-crawl.yml
    - .github/workflows/daily-actor-crawl.yml
    - .github/workflows/daily-publisher-crawl.yml
    - .github/workflows/rollback.yml
    - .github/workflows/monthly-cleanup.yml
key-decisions:
  - Every CI mutation resolves a tracked target first, binds only the resolver-mapped GitHub Environment, and injects a fixed secret-name bundle.
  - Worker operations receive only exact generated config outputs; Pages receives only a closed surface plus generated project/build-env outputs.
  - Migration, crawler, and cleanup YAML invokes only a closed prepared entry with the exact generated prepared context.
requirements-completed: [DEPL-03, DEPL-04, DEPL-05, DEPL-06, TEST-04]
coverage:
  - id: D1
    description: Complete remote-mutation inventory is statically checked for selected target, mapped Environment, fixed secrets, one CI prepare gate, cleanup, and forbidden bypasses.
    requirement: TEST-04
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Worker and Pages deployments consume only prepare outputs; Pages project creation remains forbidden and Pages rollback remains manual after typed-surface validation.
    requirement: DEPL-03
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Migration, crawler, and cleanup workflows invoke only fixed prepared entries after CI preflight/live checks through preparation.
    requirement: DEPL-04
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
        status: pass
    human_judgment: false
metrics:
  tasks_completed: 3
  files_modified: 16
  completed: 2026-07-15
status: complete
---

# Phase 12 Plan 03: Cloudflare Workflow Target Resolution Summary

**All listed GitHub mutation workflows now follow one static selected-target contract without invoking Cloudflare, D1, R2, crawler, migration, deploy, or rollback operations.**

## Accomplishments

- Added a fixture-backed Vitest suite covering the 15-workflow inventory, fixed secret names, no-local-file/no-second-materialization constraints, exact prepared outputs, Pages surface/build path handling, rollback guidance, and prepared-entry-only mutation routes.
- Routed API, gateway, API-after-PR, and all current Pages deploy workflows through a no-secret resolver job, resolver-mapped GitHub Environment, one CI `prepare-mutation` invocation, and `always()` cleanup.
- Replaced inline D1/R2/crawler/cleanup/rollback identity and commands with selected prepared-context entries; retained the independent migration reviewer Environment and fail-closed Pages rollback boundary.

## Task Commits

1. **Task 1: Establish fixture-backed static assertions for the common workflow target-resolution contract** - `c8cd1b5` (`test(12-03): add workflow target contract coverage`)
2. **Task 2: Adopt the common contract in Worker, API-after-PR, and all Pages deployment workflows** - `6f1bcef` (`ci(12-03): gate deploy workflows by selected target`)
3. **Task 3: Adopt target-aware mutation ordering for migration, crawlers, rollback, and monthly cleanup** - `1d4b961` (`ci(12-03): prepare remote mutation workflows`)

## Decisions Made

- Push/schedule triggers use the checked-in `starye-org` target while manual dispatch requires a target input; both enter the same resolver job.
- The resolver validates the selected target without deployment secrets and derives the GitHub Environment from the target-profile CLI output before any mutation job starts.
- Pages workflows never carry `VITE_*` or `NUXT_PUBLIC_*` YAML values, never create a Pages project, and deploy only with the resolver-produced project/build paths.
- D1 migration, crawler, and monthly cleanup workflows pass only the byte-identical `prepared_context_path` to their closed prepared entry; direct package/source-entry enforcement remains Plan 12-04 work.

## Verification

- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/workflow-contract.test.ts` - 5 passed.
- `pnpm --filter @starye/config test --run src/deployment-target/__tests__/target-deploy.test.ts src/deployment-target/__tests__/target-projections.test.ts src/deployment-target/__tests__/deploy-config.test.ts src/deployment-target/__tests__/preflight.test.ts src/deployment-target/__tests__/live-checks.test.ts src/deployment-target/__tests__/public-runtime-input.test.ts` - 42 passed.
- `pnpm target-profile validate --target starye-org` - passed without remote execution.
- `pnpm --filter @starye/db type-check` - passed.
- `pnpm --filter @starye/crawler type-check` - passed.
- Parsed every `.github/workflows/*.yml` using the existing workspace YAML parser; `git diff --check` passed.
- GitNexus `detect-changes` reported LOW risk and no affected execution flows. Its only indexed symbols were the preserved user changes in `AGENTS.md` and `CLAUDE.md`.

## Deviations from Plan

None - plan executed within its workflow/static-contract scope. The direct package and crawler source-entry closure remains deliberately reserved for Plan 12-04.

## User Setup Required

No setup was required for this static verification. Credentialed workflows will continue to fail closed unless the resolver-mapped GitHub Environment supplies the required fixed-name secret bundle and public build variables.

## Next Phase Readiness

- Plan 12-04 can close direct DB/crawler package and source entry points against the same prepared-entry registry.
- Phase 13 remains the owner of credentialed local-to-production data-chain smoke evidence.

## Self-Check: PASSED

- All three task commits exist in Git history.
- The 15-workflow static inventory and plan verification commands pass without remote commands.
- Only the protected user changes in `.planning/config.json`, `AGENTS.md`, and `CLAUDE.md` remain dirty.

---
*Phase: 12-cloudflare-config-switching*
*Completed: 2026-07-15*
