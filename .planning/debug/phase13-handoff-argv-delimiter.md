---
status: resolved
trigger: "Phase 13 Plan 13-45 root handoff launcher forwards pnpm delimiter as an invalid CLI argument"
created: "2026-07-24"
updated: "2026-07-25"
---

# Phase 13 Handoff Argv Delimiter

## Symptoms

- Expected: the documented root command `pnpm smoke:data-chain:handoff -- --mode local --target starye-org --run-id <id>` forwards only the mode, target, and run arguments to the handoff CLI.
- Actual: the root process receives `handoff "--" "--mode" ...`, then emits `invalid_target`, `handoffReady:false`, and `runnerInvocations:0`.
- Error: the one allocated Plan 13-45 run returned outer exit 1 before evidence creation; its evidence directory, `local.attempt`, `local.json`, and `local.md` are absent.
- Timeline: observed after the new local supervisor gate, project-local check, local live preflight, and canonical Gateway service check were all green.
- Reproduction: invoke the documented root handoff command through pnpm; `packages/crawler/scripts/data-chain-cli.mjs` passes the leading delimiter unchanged to `runDataChainHandoffCli`.

## Current Focus

- hypothesis: The root `data-chain-cli.mjs` dispatcher must strip one leading `--` from forwarded argv before it calls any entry module.
- test: Add a root-process regression for all three documented launcher scripts with a pnpm-style leading delimiter, then verify that handoff receives the target arguments unchanged after normalization.
- expecting: The regression fails on current source because the entry parser receives `--` as its first option; a narrow dispatcher normalization makes it pass without changing runner or evidence behavior.
- next_action: resolved and committed after focused regression coverage
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-07-24; source: Plan 13-45 Task 1; fact: the root handoff command emitted only `invalid_target`, `handoffReady:false`, and `runnerInvocations:0`.
- timestamp: 2026-07-24; source: Plan 13-45 Task 1; fact: no run evidence directory or local attempt/pair exists for the allocated p13-45 run.
- timestamp: 2026-07-24; source: root launcher source; fact: `data-chain-cli.mjs` uses `[entry, ...argv] = process.argv.slice(2)` and forwards `argv` unchanged.
- timestamp: 2026-07-25; source: `data-chain-cli-process.test.ts`; fact: the new root-process regression was RED before the repair: all three launchers forwarded `["--", "--mode", ...]` rather than the documented option argv.
- timestamp: 2026-07-25; source: `pnpm exec vitest run packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts`; fact: 18/18 tests passed after the repair, including root process coverage for run, verify, and handoff, direct-dispatch argv preservation, and retention of a second delimiter.
- timestamp: 2026-07-25; source: `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-handoff.test.ts`; fact: 17/17 closed handoff argument and validation tests passed without changing parser behavior.
- timestamp: 2026-07-25; source: `pnpm --filter @starye/config type-check`; fact: `tsc --noEmit` passed.

## Eliminated


## Specialist Review

- specialist_hint: typescript
- result: No matching installed `typescript-expert` skill was available, so no specialist review was dispatched.

## Resolution

- root_cause: The root dispatcher forwarded pnpm's leading script delimiter as an entry argument, which the closed handoff parser correctly rejected before target validation or runner invocation.
- fix: Strip exactly one leading `--` in the root CLI before dispatching while leaving all other argv values and handoff validation unchanged.
- verification: The focused Vitest file was RED for all three root launchers before the repair and passed 18/18 after it; the closed handoff test passed 17/17 and config type-check passed. No real handoff, runner, verifier, service, remote, browser, or evidence command was run.
- files_changed: `packages/crawler/scripts/data-chain-cli.mjs`, `packages/config/src/deployment-target/__tests__/data-chain-cli-process.test.ts`, `.planning/debug/phase13-handoff-argv-delimiter.md`
