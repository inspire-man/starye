---
phase: 13-full-chain-data-smoke
plan: "08"
subsystem: data-chain-smoke
tags: [execution, gateway, checkpoint-evidence, provenance, fail-closed]

requires:
  - phase: 13-07
    provides: tuple-bound runner, provider, and browser provenance receipts plus artifact-only verification
provides:
  - fresh local code-2 checkpoint evidence for the first unavailable execution boundary
  - explicit prohibition on remote smoke without a terminal receipt-backed local pair from the same run
affects: [13-verification, phase-14, selected-target-smoke]

tech-stack:
  added: []
  patterns: [fresh-run checkpoint retention, exact artifact-wrapper verification, local-before-remote gating]

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-08-SUMMARY.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.md
  modified: []

key-decisions:
  - "Retain the first fresh local code-2 checkpoint and stop; do not retry that run into a success claim."
  - "Do not start remote smoke because the exact local pair is pre_ingest/checkpoint with itemId null."
  - "Keep generated evidence untracked and record only allowlisted paths and outcomes."

patterns-established:
  - "A fresh execution checkpoint is an auditable non-success result, not Phase 13 completion evidence."

requirements-completed: []
requirements-pending: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05]

coverage:
  - id: D1
    description: A fresh local runner invocation retained a schema-valid, redacted code-2 checkpoint pair at the first unavailable boundary.
    requirement: DATA-07
    verification:
      - kind: other
        ref: pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-0b30d5c722be483d67f65305 --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: pass
    human_judgment: true
    rationale: The wrapper proves only that the checkpoint pair is valid non-success evidence; it does not prove the local external chain.
  - id: D2
    description: The selected-target remote chain remains blocked until a new exact local pair is terminal and receipt-backed.
    requirement: DATA-07
    verification: []
    human_judgment: true
    rationale: No provider, remote D1, canonical API, Dashboard, or viewer operation was permitted after the local checkpoint.

duration: 5min
completed: 2026-07-18
status: checkpoint
---

# Phase 13 Plan 08: Authorized Smoke Execution Checkpoint Summary

**A fresh local run produced a redacted pre-ingest checkpoint before any D1, fixture, browser, or provider operation, truthfully blocking the matching remote run.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-18T05:30:10Z
- **Completed:** 2026-07-18T05:35:08Z
- **Tasks:** Task 1 checkpoint retained; Task 2 blocked
- **Files modified:** 1 tracked summary; 2 untracked evidence files

## Accomplishments

- Re-ran the complete 13-07 focused regression before the checkpoint: 4 files and 49 tests passed.
- Generated fresh opaque run id `p13-08-0b30d5c722be483d67f65305` and invoked only the canonical local smoke runner for explicit target `starye-org`.
- Retained and exactly verified the resulting JSON/Markdown pair as `pre_ingest/checkpoint`, `provesExternalChain: false`, with no secret-like evidence keys.
- Stopped before local D1, fixture, service, browser observation, or any remote/provider command because the local pair is not terminal.

## Task Commits

No task code commit was created. This execution-only plan produced an untracked checkpoint pair; only this checkpoint closeout summary is eligible for the metadata commit.

## Evidence

| Field | Value |
| --- | --- |
| Target | `starye-org` |
| Run ID | `p13-08-0b30d5c722be483d67f65305` |
| Item code | `p13-smoke-starye-org-79c3447d` |
| Item ID | `null` |
| Lifecycle | `pre_ingest` / `checkpoint` |
| Observation | `local_projection` / `target_projection_unmet` |
| JSON | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.json` |
| Markdown | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.md` |

The root pnpm wrapper reports exit `1` because the underlying hardened runner and verifier intentionally return checkpoint exit `2`. The verifier classified the pair as `outcome: checkpoint` and `provesExternalChain: false`.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts src/deployment-target/__tests__/verify-data-chain-smoke.test.ts` - passed, 4 files / 49 tests.
- `pnpm smoke:data-chain -- --mode local --target starye-org --run-id p13-08-0b30d5c722be483d67f65305` - underlying checkpoint exit `2`; persisted `pre_ingest/checkpoint` pair.
- `pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-0b30d5c722be483d67f65305 --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence` - underlying checkpoint exit `2`; exact pair validated as non-success.
- `pnpm target-profile project-local --target starye-org --check` - passed; target-managed projection is not drifting.
- `pnpm target-profile preflight --target starye-org --scope local --command validate --wrangler-profile starye-org` - passed in its local-only filtered environment.
- Allowlisted evidence inspection - matching mode/target/run/code, `itemId: null`, one checkpoint observation, and zero secret-like keys.

## Decisions Made

- Preserve the newly written pair exactly as emitted. The plan forbids retrying a checkpointed run into success.
- Treat the current process-level `CLOUDFLARE_API_TOKEN` presence as a local Wrangler-profile shadowing boundary; no secret value was read or printed.
- Do not run Task 2. Remote eligibility requires this exact run's local pair to be terminal `resolved/passed` with all runner and browser receipts.

## Deviations from Plan

None - the plan explicitly requires a fresh redacted checkpoint and immediate stop when the first local prerequisite is unavailable.

## Issues Encountered

- The exact local runner checkpointed at `local_projection/target_projection_unmet`. Target-managed projection and the filtered local preflight both pass, while the current agent process exposes the provider-only `CLOUDFLARE_API_TOKEN` key that the local profile intentionally rejects. The runner stopped before inspecting later prerequisites.
- Process-only presence checks also found no ambient `CRAWLER_SECRET`, `BETTER_AUTH_SECRET`, or `ADMIN_GITHUB_ID`; their user-managed stores were not read, and the runner did not reach those gates.

## Authentication Gates

No login flow was attempted. The local pre-ingest gate stopped before the controlled browser observer, so Dashboard session and role remain unverified external prerequisites.

## Known Stubs

None. `itemId: null` is the required pre-ingest checkpoint shape, not an implementation stub.

## User Setup Required

Resume only from a fresh local-only execution context where `CLOUDFLARE_API_TOKEN` is not exported to the smoke process, the existing user-managed local secret stores and stack are available, and the operator has an authorized Dashboard session through `http://localhost:8080/auth/`. The continuation must generate another fresh run id; it must not edit or promote this pair.

## Next Phase Readiness

- Phase 13 remains unverified and must not be marked passed.
- A continuation may retry Task 1 only with a new run id after the local-only process boundary is confirmed.
- Task 2 remains forbidden until that new local pair is terminal, exact, count-one, and receipt-backed.

## Self-Check: PASSED

- Both fresh evidence files exist and remain untracked.
- The exact wrapper validates the pair as checkpoint/non-success.
- No remote evidence file exists for this run.
- No source symbol was edited; `AGENTS.md` and `CLAUDE.md` remain untouched and unstaged by this plan.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 08*
*Checkpoint recorded: 2026-07-18*
