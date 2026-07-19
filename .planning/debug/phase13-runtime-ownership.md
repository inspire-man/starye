---
status: diagnosed
trigger: "Phase 13: diagnose the blocked fixed-port ownership state from Plan 13-16 before any local supervisor restart or new smoke evidence attempt"
created: 2026-07-19T10:00:00+08:00
updated: 2026-07-19T22:00:00+08:00
---

# Debug: Phase 13 Runtime Ownership

## Current Focus

hypothesis: Confirmed: the local supervisor has no bounded all-seven listener-readiness contract, so a Gateway launch that remains alive without binding 8080 is not converted into an atomic startup failure and leaves a partial fixed-port tree.
test: Compared the single listener/CIM snapshot with the complete `scripts/local-dev.ts` startup and child-lifecycle implementation and Gateway port configuration.
expecting: Confirmed by six sibling listeners under one live `local-dev.ts` tree while 8080 is absent, plus source that watches only `error` and `exit` rather than expected listener readiness.
next_action: Return diagnosis for a new source/operational gap plan; do not alter or restart the existing partial tree.
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms

expected: A safe Phase 13 runtime gate can establish one complete task-owned local service tree for ports 8080, 8787, 5173, 3002, 3003, 3000, and 3001 before canonical Gateway readiness and any fresh smoke attempt.
actual: Plan 13-16 classified the fixed-port listeners as a nonempty proper subset and recorded blocked_ownership/partial_fixed_ports before any process mutation.
errors: No process error is claimed. The authoritative execution result is the closed ownership blocker in 13-16-SUMMARY.md; canonical readiness, smoke, browser, and provider steps were intentionally not run.
started: Observed during Phase 13 Plan 13-16 after Gateway readiness and closed auth-checkpoint repairs completed.
reproduction: Use one bounded read-only PowerShell listener and CIM ancestry snapshot for the seven fixed ports. Do not stop/start any process, run clean:ports, allocate a run, or touch historical evidence.

## Evidence

- timestamp: 2026-07-19T10:00:00+08:00
  finding: Plan 13-16 committed `blocked_ownership`, `partial_fixed_ports`, and blocked Task 2 plus Plan 13-17 with no launch, PID, readiness, smoke, browser, provider, schema, or migration action.

- timestamp: 2026-07-19T21:55:04+08:00
  finding: The one permitted fixed-port/CIM snapshot found no 8080 listener and exactly one listener on each of 8787 (PID 58092), 5173 (48360), 3002 (3984), 3003 (39388), 3000 (57972), and 3001 (14532): six of seven fixed ports are active, so this is a nonempty proper subset.
  implication: The Plan 13-16 `partial_fixed_ports` classification remains correct and rules out both `cold_start` and a complete-listener supervisor replacement.

- timestamp: 2026-07-19T21:55:04+08:00
  finding: Every active fixed-port owner in that snapshot has a CIM parent chain reaching Node PID 21912, whose command line matches `scripts/local-dev.ts`; owner-side command lines mention the current repository root. No process environment or secret file was inspected.
  implication: The partial listener state is an incomplete current local-dev tree, not evidence that six unrelated processes may be cleaned up; investigate supervisor child-failure behavior.

- timestamp: 2026-07-19T21:58:00+08:00
  finding: Root `pnpm dev` launches `scripts/local-dev.ts`. That launcher starts Gateway with `pnpm --filter gateway exec wrangler dev --config <materialized-config>` alongside six sibling services, while Gateway configuration assigns port 8080. Its lifecycle handling calls `stop` only for a child-process `error` or `exit` event and parent SIGINT/SIGTERM; it has no bounded assertion that each started service owns its expected fixed listener before declaring startup.
  implication: A live-but-nonbinding Gateway launch is not a supervised failure condition. The observed six-listener/no-8080 tree is therefore possible by design and must remain a fail-closed ownership blocker until the supervisor gains atomic listener-readiness enforcement.

## Eliminated

- hypothesis: The active fixed-port listeners are not descendants of one `scripts/local-dev.ts` supervisor.
  evidence: All six active listener-owner ancestry chains converge on Node PID 21912, whose command line matches `scripts/local-dev.ts`.
  timestamp: 2026-07-19T21:55:04+08:00

## Resolution

root_cause: The local-dev supervisor treats only child `error`/`exit` as startup failure. It starts the Gateway expected to bind 8080 and six sibling services independently, but never bounds or verifies expected fixed-port ownership. In the observed tree, the `scripts/local-dev.ts` ancestor is live and owns six sibling listeners while the expected Gateway listener on 8080 is absent; a live Gateway wrapper that has not bound its port therefore leaves a nonempty proper subset. Plan 13-16 correctly blocks that state, but the supervisor lacks the atomic readiness contract needed to prevent it.
fix: New gap plan: make `scripts/local-dev.ts` launch ownership explicit per service (label, expected port, child PID/tree metadata), then after launch perform a bounded all-seven listener-readiness gate. If Gateway or any sibling fails to bind, terminate only the newly recorded task-owned tree, clean its materialized inputs, and exit nonzero; never use broad port cleanup. Preserve Plan 13-16's current rule for this pre-existing partial tree: do not auto-replace it. Require the original process owner to end it through an explicitly authorized operational step, then permit a fresh start only after all seven ports are proven free.
verification: In the new gap plan, add a deterministic supervisor test where the Gateway child stays live but never binds 8080; assert bounded startup failure, exact task-owned cleanup, and no surviving six-port subset. Add the successful-path test for exactly one listener per fixed port with every owner descending from the recorded new supervisor. After authorized cleanup of the existing legacy tree, perform one fresh cold start from all-free ports and require `pnpm check:services` to report one healthy `starye-local-services-1` record with accepted canonical `/robots.txt`, `/auth`, and `/auth/` outcomes before any Phase 13 smoke action.
files_changed: []
