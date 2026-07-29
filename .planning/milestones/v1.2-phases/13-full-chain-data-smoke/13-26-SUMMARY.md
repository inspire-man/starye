---
phase: 13-full-chain-data-smoke
plan: "26"
subsystem: root-local-dev-loader
tags: [windows, pnpm, tsx, static-regression]
status: complete
repair_status: passed
next_required_plan: 13-27
requires: [13-25]
provides: [direct-root-tsx-loader, bounded-root-importer-regression]
affects: [future-cold-start-retry]
key_files:
  modified:
    - package.json
    - pnpm-lock.yaml
    - packages/config/src/deployment-target/__tests__/local-dev.test.ts
decisions:
  - "Plan 13-26 proves command shape and resolver availability statically; it does not certify a process lifecycle."
  - "A later retry must establish fresh task ownership instead of reusing Plan 13-25 artifacts."
metrics:
  completed_date: 2026-07-20
  focused_tests: 5
---

# Phase 13 Plan 26: Static Root Loader Repair Summary

The root `dev` command now uses the direct, root-resolvable `tsx` import hook for `scripts/local-dev-entry.ts`, with static regressions proving its declaration, loader resolution, and exact current-workspace supervisor target.

## Completed Static Gates

- Resumed from committed RED evidence `1e13a62` after confirming it is an ancestor of `HEAD` and changes only `packages/config/src/deployment-target/__tests__/local-dev.test.ts`.
- Confirmed the approved configured-registry candidate without using credentials, a registry request, or a dependency-resolution command in this plan.
- Revalidated before and after static checks that the package candidate is limited to root `tsx: "4.21.0"`, the direct `dev` command `node --import tsx scripts/local-dev-entry.ts`, the root importer declaration, two named Vitest peer-token substitutions, and two named optional snapshot flags.
- Confirmed both existing `tsx@4.21.0` package/snapshot blocks and integrity `sha512-5C1sg4USs1lfG0GFb2RLXsdpXqBSEhAaA/0kPL01wxzpMqLILNxIxIOKiILz+cdg/pLnOUxFYOR5yhHU666wbw==` are byte-identical to `HEAD`.
- Updated the root-loader regression to bound its lock assertion to the top-level `importers:` section and then the `.` root importer. The test retains the absolute, normalized equality check for `scripts/local-dev.ts`.
- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/local-dev.test.ts` passed: 1 file, 5 tests.
- `node --import tsx --input-type=module --eval "await import('./scripts/local-dev-entry.ts')"` passed without entering the entry module CLI main path.
- `pnpm --filter @starye/config type-check` passed.
- `pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-local-dev.json` passed.
- `git diff --check` passed for the three task files.

## GitNexus Review

`buildLocalDevSupervisorInvocation` upstream impact is LOW: one direct caller (`main`), one affected module, and no affected execution flow. Pre-commit `npx gitnexus detect-changes --repo starye` also reported LOW risk and zero affected flows. Its two reported document symbols belong to pre-existing user changes in `AGENTS.md` and `CLAUDE.md`; they are outside this task and excluded from the commit. The task diff contains no changed production symbol or unexpected execution flow.

## Isolation And Handoff

This repair was executed only with `$gsd-execute-phase 13 --gaps-only --wave 28`. It does not execute Plans 13-17 through 13-20 and does not make a runtime claim.

Plan 13-27 must be planned after this result. It must begin from a new observation that all seven fixed ports are free, launch exactly one newly task-owned root `pnpm.cmd dev` tree, attribute its current absolute `scripts/local-dev.ts` supervisor and listener ancestry, clean only that revalidated tree, and publish the three designated release fields only after all fixed ports are free again.

Plan 13-25 PIDs, Summary, evidence, and blocked status remain historical input only. Plan 13-27 must not reuse, stop, reinterpret, or overwrite them. Plans 13-17 through 13-20 remain blocked until the later fresh retry releases eligibility.

## Deviations From Plan

None. The root direct command and the dependency candidate were already present as the approved task-owned uncommitted input; execution preserved those candidate lines and corrected only the bounded lockfile assertion in the existing regression.

## Self-Check: PASSED

- Summary contains `repair_status: passed` and `next_required_plan: 13-27`.
- Summary contains no release fields reserved for the later lifecycle retry.
- No service, PID, port, smoke, API, browser, provider, or remote command was run.
