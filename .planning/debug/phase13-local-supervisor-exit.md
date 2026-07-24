---
status: resolved
trigger: "Phase 13 Plan 13-45 local supervisor exits after listeners start and before Gateway readiness settles"
created: "2026-07-24"
updated: "2026-07-24"
---

# Phase 13 Local Supervisor Exit

## Symptoms

- Expected: `pnpm dev` keeps its task-owned local service tree alive until canonical Gateway readiness at `http://localhost:8080` completes, allowing `pnpm check:services` to finish.
- Actual: on Windows, service listeners appear, then the supervisor reports `Local movie service exited unexpectedly` and tears down the task-owned tree before Gateway `/auth/` readiness settles.
- Errors: two `pnpm check:services` attempts timed out at `authSlash`; all fixed ports were free after supervisor cleanup.
- Timeline: observed during fresh local lifecycle preflight for Phase 13 Plan 13-45 after `target-profile project-local --target starye-org --check` and local live preflight passed.
- Reproduction: start the local tree with `pnpm dev`, then run `pnpm check:services`; a Windows wrapper child can exit after listeners come up while the supervisor still considers readiness incomplete.

## Current Focus

- hypothesis: `watchChild` calls `stop(1)` for every child `exit` after seven TCP probes set `ready = true`; it never distinguishes a zero-code wrapper exit from a managed-service failure or verifies that the service port remains healthy.
- test: The focused suite passed 9/9 in three consecutive runs; it covers a zero-code exit with a live port, a zero-code exit with a closed port, and a nonzero exit.
- expecting: The real Windows local lifecycle now retains healthy managed services through wrapper completion, while a real managed-service exit still triggers task-owned cleanup.
- next_action: Resume Plan 13-45 from its still-unallocated local lifecycle task.
- reasoning_checkpoint:
  hypothesis: "A post-readiness zero-code wrapper exit causes premature cleanup because `watchChild` equates all exits with a managed-service failure and never observes the continued service listener."
  confirming_evidence:
    - "The current handler calls `stopAfterReadiness()` for `exit` without inspecting its code, signal, or port state."
    - "The added post-readiness `gateway.emit('exit', 0, null)` regression logs an unexpected exit and fails because no port recheck occurs."
    - "The original wrapper-exit test emits before `ready` and therefore does not exercise this branch."
  falsification_test: "After the change, an exit(0, null) with the same service port still listening must leave cleanup and all kill mocks untouched; an exit(1, null) must still invoke cleanup once."
  fix_rationale: "A zero-code exit paired with a live fixed service port identifies an intermediary wrapper that no longer owns the long-lived service. A closed port or failure exit remains a managed-service failure and keeps the atomic cleanup path."
  blind_spots: "A live integration lifecycle was not run under this scoped task; a distinct process claiming a service port immediately after a real exit would look healthy, though the task-owned preflight requires fixed ports to be free before startup."
- tdd_checkpoint:

## Evidence

- timestamp: 2026-07-24; source: Plan 13-45 checkpoint; fact: `authSlash` timed out twice and the supervisor subsequently reported `Local movie service exited unexpectedly`.
- timestamp: 2026-07-24; source: Plan 13-45 checkpoint; fact: no p13-45 run ID, evidence, handoff, browser action, or commit was created.
- timestamp: 2026-07-24; source: GitNexus impact; fact: `runLocalDevSupervisor` has one direct caller (`main`), zero indexed execution flows, and LOW upstream risk.
- timestamp: 2026-07-24; checked: `scripts/local-dev.ts`, `scripts/local-dev-entry.ts`, and `scripts/package-manager-command.ts`; found: `ready` becomes true after only seven TCP probes; `watchChild` calls `stop(1)` for every later `exit`, while Windows uses Node to invoke `pnpm.cjs` and can still expose an intermediary lifecycle exit; implication: a healthy service tree can be torn down between port binding and canonical Gateway HTTP readiness.
- timestamp: 2026-07-24; checked: `packages/config/src/deployment-target/__tests__/local-dev.test.ts`; found: its wrapper-exit test queues the zero-code event during child creation, before the first awaited port probe makes `ready` true; implication: the existing test passes while omitting the reported post-listener timing.
- timestamp: 2026-07-24; checked: focused Vitest and GitNexus query; found: `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/local-dev.test.ts` passes 6/6 and GitNexus identifies `watchChild`/`stopAfterReadiness` in `scripts/local-dev.ts`; implication: baseline is stable and the fault is isolated to lifecycle classification, not test setup.
- timestamp: 2026-07-24; checked: new post-readiness lifecycle regression; found: the expanded focused suite fails 1/8, logs `Local gateway service exited unexpectedly.`, and shows no follow-up `isPortListening(8080)` call after `exit(0, null)`; implication: the unconditional exit handler is the direct, reproducible cause of the premature teardown.
- timestamp: 2026-07-24; checked: zero-code closed-port control against the repaired handler; found: it logs the expected failure and invokes cleanup, but the test observed `setExitCode(1)` one microtask before the async cleanup continuation completed; implication: the failure branch is active and the test must await the full cleanup sequence before asserting the exit code.
- timestamp: 2026-07-24; checked: repaired focused suite, ESLint, and scoped diff; found: `local-dev.test.ts` passes 9/9, `pnpm exec eslint scripts/local-dev.ts packages/config/src/deployment-target/__tests__/local-dev.test.ts` exits 0, and `git diff --check` exits 0; implication: the repair and its focused lifecycle controls are syntactically and statically clean.
- timestamp: 2026-07-24; checked: stability run; found: three consecutive focused runs passed 9/9 with zero failures; implication: the asynchronous port-recheck classification is stable for the reproduced event sequences.
- timestamp: 2026-07-24; checked: scoped real local gate; found: after the seven fixed ports became ready, `pnpm check:services` passed on its second Gateway probe using `http://localhost:8080`; implication: the repaired supervisor keeps the healthy local tree alive through canonical Gateway readiness.
- timestamp: 2026-07-24; checked: task-owned cleanup; found: every fixed-port listener descended from the newly started launcher before child-first cleanup, and all seven fixed ports were free afterwards; implication: the real check left no local service tree running.

## Eliminated


## Resolution

- root_cause: "After TCP-only readiness, `watchChild` classifies every child `exit` as fatal. A normal zero-code Windows wrapper exit is therefore treated identically to a managed-service failure, so `stop(1)` kills the still-healthy local tree before canonical Gateway HTTP readiness can settle."
- fix: "For post-readiness exits only, `watchChild` now verifies the corresponding port after a zero-code, non-signalled exit. A still-listening port preserves the service tree as an expected wrapper lifecycle; a closed port, probe failure, nonzero exit, signal, or child error retains atomic cleanup."
- verification: "Focused lifecycle suite passed 9/9 in three consecutive runs; ESLint passed for the changed script and test; `git diff --check` passed. A new task-owned `pnpm dev` tree also passed `pnpm check:services` through the canonical Gateway after all fixed ports became ready, then cleaned up to all-free ports."
- files_changed:
  - scripts/local-dev.ts
  - packages/config/src/deployment-target/__tests__/local-dev.test.ts
