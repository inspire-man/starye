---
phase: 13-full-chain-data-smoke
plan: "42"
subsystem: remote-data-handoff
status: complete
gap_closure: true
execution_scope: selected-production-remote
human_authorization: approved
authorization_phrase: "approved remote handoff for starye-org p13-41-379b38f7ce29f2a621097bbd42ccfe3b"
remote_outcome: pending
handoffReady: true
preflightStatus: passed
runnerInvocations: 1
provesExternalChain: false
run_id: p13-41-379b38f7ce29f2a621097bbd42ccfe3b
item_code: p13-smoke-starye-org-c656ccd0
remote_item_id: 03a9a090-c747-421e-b40b-fda7b8c378b2
local_item_id: 0fb330bf-f3bf-4785-a5d9-088b6c1ac392
requirements-completed: []
completed: 2026-07-23
---

# Phase 13 Plan 42: Selected-Production Remote Handoff (Post-Credential Repair)

Human-authorized remote handoff for the 13-41 local terminal tuple completed with a **provider-backed pending pair** (not a preflight checkpoint). Production Dashboard/viewer is authorized for Wave 41 / Plan 13-43.

## Human Authorization

- Operator phrase: `approved remote handoff for starye-org p13-41-379b38f7ce29f2a621097bbd42ccfe3b`
- Credentials loaded only into process env from untracked `packages/crawler/.env` (token length 93, secret length 43; values not logged).
- Account id matched starye-org: `d6e57b25da320fae1bd0079fb3c316d4`.

## Prerequisites

| Check | Result |
| --- | --- |
| 13-40 remote live preflight (reconfirmed) | exit `0`, `Target preflight passed: starye-org` |
| 13-41 local exact verify | exit `0`, `terminal_passed`, `provesExternalChain: true` |
| Pre-handoff remote paths | `remote.json` / `remote.md` / `remote.attempt` all absent |

## One Remote Handoff

Invoked exactly once:

```text
pnpm smoke:data-chain:handoff -- --mode remote --target starye-org --run-id p13-41-379b38f7ce29f2a621097bbd42ccfe3b
```

| Field | Value |
| --- | --- |
| handoff CLI | exit `0` |
| outcome | `pending` |
| handoffReady | `true` |
| preflightStatus | `passed` |
| runnerInvocations | `1` |
| itemCode | `p13-smoke-starye-org-c656ccd0` |
| remote itemId | `03a9a090-c747-421e-b40b-fda7b8c378b2` |
| remote exact verify (pre-browser) | exit `2`, `state: resolved_pending_observation`, `aggregate: pending`, `outcome: pending`, `provesExternalChain: false` |

Remote surfaces recorded: `remote_preflight=passed`, `d1=passed` (itemCount 1), `api=passed` on `/api/public/movies/p13-smoke-starye-org-c656ccd0`.

## Evidence (untracked)

Root: `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-41-379b38f7ce29f2a621097bbd42ccfe3b/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `remote.attempt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `remote.json` | 2162 | `e413e5b2b3807493ce6e9df4cd0c7662002b4dc58d4e57bb8b3950479d2cf7ad` |
| `remote.md` | 893 | `b381805d72ba43e1ac055fc7e7a1bb37243812c68f625bdb83c55b0372742c34` |

## Immutability

Locked remote checkpoints byte-identical pre/post:

| Run | remote.json SHA-256 |
| --- | --- |
| p13-17-b807d44deee04e1f85b42fd02ed8cf26 | `f1bca8a944a2868024dfd6042fcaa397f17587e8d2709e71d976dbaac5faad72` |
| p13-37-1627bb2723604850a85e3ac9f805aab8 | `b2ba98b4f7f0dfa296312d9081d330b648d8703dc778f6d6b69675f422072b24` |

## Branch Decision for 13-43

| Input | Value |
| --- | --- |
| remote_outcome | **`pending`** |
| Production browser | **authorized** (ordered Dashboard → Viewer on canonical `https://starye.org`) |
| Dual exact verifiers after production observation | required exit `0` / `terminal_passed` / `provesExternalChain: true` |

## Scope Boundary

- Exactly one remote handoff; no production browser in this plan
- No rewrite of locked p13-17 / p13-37 remote trees
- No ad hoc deploy/migrate/SQL bypass of handoff

## Self-Check: PASSED