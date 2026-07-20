---
status: resolved
trigger: "Phase 13: diagnose and fix why a fresh root pnpm dev launcher exits before scripts/local-dev.ts supervisor attribution in Plan 13-24"
created: 2026-07-20T04:20:00Z
updated: 2026-07-20T05:45:00Z
---

# Debug: Phase 13 Launcher Early Exit

## Current Focus

hypothesis: Resolved. The root launcher now delegates through a fixed entry module that passes an absolute current-workspace `scripts/local-dev.ts` path to Node.
test: Assert the entry invocation's final script argument is absolute and run the focused local-dev test plus Phase 13 TypeScript checks.
expecting: The strict current-workspace supervisor matcher can identify the next task-owned supervisor without accepting arbitrary relative paths.
next_action: Create a new Phase 13 gap plan for the bounded post-fix cold-start eligibility retry.
reasoning_checkpoint:
  hypothesis: "A relative `../../scripts/local-dev.ts` command line causes `matchesCurrentWorkspaceSupervisor()` to return false because it searches only for the resolved absolute workspace path."
  confirming_evidence:
    - "Runtime capture observed supervisor PID 55896 with `node --import tsx ../../scripts/local-dev.ts` and a parent chain to the fresh root launcher PID 58172."
    - "The observed command line lacked `D:/my-workspace/starye/scripts/local-dev.ts`, while source requires that exact normalized substring."
    - "The root package script deliberately passes the relative argument and existing tests cover only absolute command lines."
  falsification_test: "The new launcher's unit test would show a non-absolute final child argument, or a direct command construction inspection would show it does not invoke `scripts/local-dev.ts`."
  fix_rationale: "Resolving the child script before spawning preserves the strict absolute-path authorization boundary and removes the false-negative attribution condition without broadly accepting unrelated relative-path processes."
  blind_spots: "This bounded investigation cannot run a second root dev tree; Windows signal forwarding and full seven-service readiness remain outside this diagnostic authorization."
tdd_checkpoint: null

## Symptoms

expected: A root `pnpm dev` process started from the repository root remains alive long enough to attribute exactly one current-workspace `scripts/local-dev.ts` supervisor and then bind all seven fixed local service ports.
actual: Plan 13-24 confirmed all seven ports were free, started one hidden root `pnpm.cmd dev` launcher (PID 58744), then observed that launcher exit before a supervisor could be attributed. No PID was stopped, and all downstream readiness, smoke, browser, provider, and evidence steps were skipped.
errors: The Plan 13-24 Summary records `runtime_eligibility: blocked`, `terminal_branch: blocked_after_launch`, and `cleanup_ownership_unproven`; it does not persist raw launcher stderr.
started: 2026-07-20 during Phase 13 Plan 13-24 fresh all-free cold-start recovery.
reproduction: From a freshly all-free seven-port state, launch one task-owned root `pnpm.cmd dev` from the repository root and capture only the bounded process exit and non-secret startup classification. Do not stop external PIDs, modify historical evidence, allocate a smoke run, or invoke browser/provider workflows.

## Evidence

- timestamp: 2026-07-20T04:16:41Z
  finding: `13-24-SUMMARY.md` records the all-free pre-start gate, launcher PID 58744, early launcher exit before supervisor attribution, and the closed no-stop result.
  implication: Plans 13-17 through 13-20 remain blocked until a new released-and-cleaned runtime eligibility result exists.

- timestamp: 2026-07-20T04:32:00Z
  finding: The root `dev` script is `pnpm --filter @starye/crawler exec node --import tsx ../../scripts/local-dev.ts`; `runLocalDevSupervisor()` calls `materializeLocalInputs()` before creating any of the seven child services.
  implication: The observed launcher exit can be isolated into pre-script invocation/module loading, configuration materialization, or the first service-child failure without invoking downstream smoke workflows.

- timestamp: 2026-07-20T04:30:56Z
  finding: One permitted all-free, task-owned 12-second launcher observation wrote logs and left all fixed ports free afterwards. The logs show `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` for `local-dev.ts` and child commands, plus `ENOENT` for the materialized `pages-build-env.local-dev-50568-blog.blog.env` and `...auth.auth.env` files.
  implication: The package-manager and pre-spawn materialization hypotheses are contradicted for this redirected reproduction; it cannot prove the original Plan 13-24 failure because its redirection was not part of the plan's `Start-Process -PassThru` contract.

- timestamp: 2026-07-20T04:47:00Z
  finding: Three Vite services reached ready state before the redirected launcher later reported `read EPIPE`, then `auth` and `blog` could not read their build-env files. `materializeTargetDeployConfig().cleanup()` deletes those exact files, so the ENOENT records are downstream of a supervisor stop.
  implication: The missing env files are not a pre-materialization cause. The EPIPE chain requires a separate non-redirected test before it could be attributed to product startup.

- timestamp: 2026-07-20T04:50:00Z
  finding: The root `dev` script passes `../../scripts/local-dev.ts` to Node. `scripts/local-dev-authorization.ts` recognizes a supervisor only when the normalized command line contains the absolute resolved `${workspaceRoot}/scripts/local-dev.ts` string; its focused tests cover only that absolute form. Plan 13-24 requires attribution but records neither its concrete matcher nor raw launcher output.
  implication: Absolute-versus-relative command-line matching is a specific, falsifiable candidate for the recorded missing-supervisor result, but the available historical evidence cannot establish that Plan 13-24 used this evaluator or an equivalent predicate.

- timestamp: 2026-07-20T05:20:00Z
  finding: Direct source and Plan review confirm the root `dev` script invokes `node --import tsx ../../scripts/local-dev.ts`; `matchesCurrentWorkspaceSupervisor()` accepts only a command line containing normalized `${workspaceRoot}/scripts/local-dev.ts`; and 13-24 Task 1 independently requires the resolved absolute script path. The focused authorization tests construct only absolute-path supervisors.
  implication: A command-line path mismatch is now the leading simple Environment/Config hypothesis. One task-owned non-redirected capture can prove or refute it without any data-chain work.

- timestamp: 2026-07-20T05:23:00Z
  finding: The single permitted `Start-Process -PassThru` launch was issued after the all-free preflight, but the task capture stopped during candidate ancestry evaluation because PowerShell forbids a function parameter named `$Pid` (case-insensitively colliding with automatic `$PID`). No product source changed and no second launch is permitted.
  implication: The test process may still be live. The next action is restricted to a read-only recovery snapshot and, only if its exact current ancestry proves task ownership, cleanup of that one descendant tree.

- timestamp: 2026-07-20T05:27:00Z
  finding: Read-only recovery found direct supervisor PID 55896 with command line `node --import tsx ../../scripts/local-dev.ts`. Its ancestors were PID 42044 (pnpm exec), 13780 (cmd), 6452 (pnpm dev), 59708 (cmd), 58756 (pnpm), and fresh root launcher PID 58172 (`pnpm.cmd dev`), all created during this capture. The direct supervisor command line does not contain the normalized absolute workspace script path.
  implication: The path-mismatch hypothesis is confirmed by runtime observation and the running tree is proven task-owned for cleanup.

- timestamp: 2026-07-20T05:34:00Z
  finding: Re-snapshotted cleanup proved every stopped PID descended from launcher 58172 and supervisor 55896. The child-before-parent stop list exited completely; no external or historical PID was targeted. GitNexus upstream impact for `matchesCurrentWorkspaceSupervisor` is LOW (one direct caller, three impacted symbols, one process family).
  implication: The diagnostic launch is closed safely. A source fix can preserve strict authorization by changing the root launch form to create an absolute supervisor command line rather than weakening the matcher.

- timestamp: 2026-07-20T05:38:00Z
  finding: No source or package file was edited after the capture. The first capture helper's `$Pid` parameter collision was confined to the diagnostic PowerShell script; recovery snapshot and cleanup completed before the interruption, with no surviving recorded task PID.
  implication: The diagnosis is evidence-backed, but this session has no applied source fix or end-to-end post-fix verification.

## Eliminated

- hypothesis: H1 - `pnpm dev` fails before loading `scripts/local-dev.ts`.
  evidence: The same launch log reports nested child-command failures and the `local-dev.ts` exec failure only after those child commands run.
  timestamp: 2026-07-20T04:30:56Z

- hypothesis: H2 - `materializeLocalInputs()` throws before any service spawn.
  evidence: The log names each child command and reports missing page build-env files consumed by `auth` and `blog`, which are created by successful materialization.
  timestamp: 2026-07-20T04:30:56Z

- hypothesis: H3a - the two ENOENT messages prove a normal-launch cleanup race is the original Plan 13-24 root cause.
  evidence: The experiment used output redirection absent from Plan 13-24 and recorded `read EPIPE`; this introduced an uncontrolled launcher I/O variable, so the observation is confounded.
  timestamp: 2026-07-20T04:47:00Z

- hypothesis: H4 - the relative `../../scripts/local-dev.ts` command line definitely caused the historical Plan 13-24 attribution failure.
  evidence: The authorization evaluator has an absolute-path-only matcher, but the Plan did not persist the actual polling implementation or its observed process command lines. It is unknown whether the task used that evaluator or a relative-path-aware predicate.
  timestamp: 2026-07-20T05:00:00Z

## Resolution

root_cause: Root `pnpm dev` invoked `scripts/local-dev.ts` with a relative `../../scripts/local-dev.ts` argument, but the authorization matcher intentionally identifies only the resolved absolute current-workspace script path. A live task-owned supervisor was therefore misclassified as missing.
fix: Added `scripts/local-dev-entry.ts`, a fixed root launcher that resolves and passes the absolute `scripts/local-dev.ts` path to Node, updated the root `dev` script to use it, and added an invocation-contract test. The authorization matcher remains strict.
verification: The focused `local-dev.test.ts` suite passed 4/4; `pnpm exec tsc --noEmit -p scripts/tsconfig.phase13-local-dev.json` and `pnpm --filter @starye/config type-check` passed. The post-fix cold-start eligibility remains untested and must run only through a new Phase 13 gap plan.
files_changed: [package.json, scripts/local-dev-entry.ts, scripts/tsconfig.phase13-local-dev.json, packages/config/src/deployment-target/__tests__/local-dev.test.ts]
