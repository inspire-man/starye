---
phase: 13-full-chain-data-smoke
plan: "54"
subsystem: production-ui-proof
tags: [remote, checkpoint, preflight, verification]
requires:
  - phase: 13-53
    provides: human-gated remote attempt path
  - phase: 13-55
    provides: local terminal carrier run p13-55
provides:
  - honest blocked closeout after p13-55 remote preflight checkpoint
  - refreshed 13-VERIFICATION.md from live 13-55 remote truths
affects: [phase-13-closeout]
tech-stack:
  added: []
  patterns:
    - remote.attempt reservation is permanent ownership; preflight unmet freezes the run without runner
    - local green preflight does not override nested handoff preflight failure
key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-54-SUMMARY.md
  modified:
    - .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md
    - scripts/target-profile.ts
    - scripts/data-chain-handoff.ts
key-decisions:
  - "Authorized remote handoff for p13-55-7de1edf355a408c3e9394f66b7d97520 executed exactly once."
  - "Nested handoff preflight returned unmet after wrangler live-check hang under stripped runtime env; permanent remote checkpoint written; runnerInvocations 0."
  - "13-54 production Dashboard/viewer skipped under blocked_on_remote_checkpoint."
  - "Durable fix: expand pickRuntimeEnvironment Windows allowlist + spawnSync timeouts for live checks/handoff preflight."
requirements-completed: []
coverage:
  - id: D1
    description: Record live remote handoff outcome for authorized p13-55 run
    verification:
      - kind: command
        ref: pnpm smoke:data-chain:handoff -- --mode remote --target starye-org --run-id p13-55-7de1edf355a408c3e9394f66b7d97520
        status: fail
      - kind: command
        ref: pnpm smoke:data-chain:verify -- --mode remote --target starye-org --run-id p13-55-7de1edf355a408c3e9394f66b7d97520
        status: fail
    human_judgment: false
  - id: D2
    description: Refresh 13-VERIFICATION from live truths without inventing production pass
    verification:
      - kind: other
        ref: .planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md
        status: pass
    human_judgment: false
duration: 25m
completed: 2026-07-26
status: complete
execution_outcome: blocked_on_remote_checkpoint
remote_outcome: checkpoint
checkpoint: target_preflight_unmet
run_id: p13-55-7de1edf355a408c3e9394f66b7d97520
item_code: p13-smoke-starye-org-df024c75
remote_item_id: null
runnerInvocations: 0
provesExternalChain: false
authorization_phrase: "授权 remote handoff p13-55-7de1edf355a408c3e9394f66b7d97520"
---

# Phase 13 Plan 54: Production Surfaces Blocked by Remote Preflight Checkpoint

Authorized selected-production remote handoff for the p13-55 local terminal carrier completed as an **immutable remote preflight checkpoint**, not a pending pair. Production Dashboard/viewer observation was not attempted.

## Authorization and Scope

| Field | Value |
| --- | --- |
| Operator phrase | `授权 remote handoff p13-55-7de1edf355a408c3e9394f66b7d97520` |
| Local carrier | 13-55 `terminal_passed` / `provesExternalChain: true` |
| Credential precheck | `wrangler whoami` exit 0; standalone `target-profile preflight ... --live` exit 0 after token rotate + versions-list fix |
| Handoff invocations | exactly one |

## Remote Handoff Result

```text
pnpm smoke:data-chain:handoff -- --mode remote --target starye-org --run-id p13-55-7de1edf355a408c3e9394f66b7d97520
```

| Field | Value |
| --- | --- |
| handoff exit | 1 |
| outcome | `handoff_not_ready` |
| preflightStatus | `unmet` |
| runnerInvocations | 0 |
| itemId | null |
| remote exact verify | exit 2 / `checkpoint` / `target_preflight_unmet` / `provesExternalChain: false` |

### Evidence (untracked)

Root: `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-55-7de1edf355a408c3e9394f66b7d97520/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `remote.attempt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `remote.json` | 438 | `685c4771ff22400cd96dae85d957cb9cc211a04c71c4dccc2b526c2464a57c59` |
| `remote.md` | 531 | `a30e0b1b9929062ccd278777c44c3617e68d97caec60876eba01f1d723972da5` |

## Diagnosis (non-secret)

Standalone remote live preflight was green under the operator shell. Nested handoff-owned preflight (stripped `pickRuntimeEnvironment` + multi-layer `pnpm exec wrangler`) hung on `r2 bucket info` for ~5 minutes, then returned unmet and wrote the permanent checkpoint pair. No remote runner mutation occurred.

Durable hardening applied in the same closeout:

- Expand Windows runtime allowlist for nested live checks
- Add `spawnSync` timeouts for wrangler live checks (60s) and handoff preflight (180s)

## What was NOT done

- No production Dashboard/viewer observation
- No remote fixture runner / D1 provider mutation (`runnerInvocations: 0`)
- No reopen of historical remotes (p13-17/p13-41/p13-42)
- No claim of Phase 13 completion

## Next

p13-55 remote is frozen at `target_preflight_unmet` and must not be reopened. After the nested-preflight reliability fix is committed, allocate a **new** local terminal run, prove standalone + nested preflight green, then request a new explicit authorization phrase for that new run_id before any remote handoff.