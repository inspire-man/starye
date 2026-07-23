---
phase: 13-full-chain-data-smoke
plan: "41"
subsystem: local-data-chain
status: complete
gap_closure: true
execution_scope: mvp-minimal-local
run_id: p13-41-379b38f7ce29f2a621097bbd42ccfe3b
item_code: p13-smoke-starye-org-c656ccd0
item_id: 0fb330bf-f3bf-4785-a5d9-088b6c1ac392
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-05, DATA-06, TEST-05]
completed: 2026-07-23
---

# Phase 13 Plan 41: Fresh Local Terminal After Credential Repair

One new run_id completed local lifecycle gates, one local handoff pending pair, and ordered local Dashboard→Viewer terminal proof after 13-40 remote credential/preflight green. Remote handoff was not invoked.

## Prerequisites

| Check | Result |
| --- | --- |
| 13-40 remote live preflight | exit `0`, `Target preflight passed: starye-org` |
| Fixed ports 8080,8787,5173,3002,3003,3000,3001 | all listening under existing `pnpm dev` tree |
| `pnpm target-profile project-local --target starye-org --check` | exit `0` |
| local preflight with `--live --wrangler-profile starye-org` | exit `0` |
| `pnpm check:services` | exit `0`; Gateway robots/auth/authSlash accepted via `http://localhost:8080` |

## One Local Handoff

- Allocated once: `p13-41-379b38f7ce29f2a621097bbd42ccfe3b` → `13-41-RUN-ID.txt`
- Evidence directory absent before handoff
- Invoked exactly once:

```text
pnpm smoke:data-chain:handoff -- --mode local --target starye-org --run-id p13-41-379b38f7ce29f2a621097bbd42ccfe3b
```

| Field | Value |
| --- | --- |
| CLI exit | `0` |
| outcome | `pending` |
| handoffReady | `true` |
| runnerInvocations | `1` |
| itemCode | `p13-smoke-starye-org-c656ccd0` |
| itemId | `0fb330bf-f3bf-4785-a5d9-088b6c1ac392` |
| pre-browser exact verify | exit `2`, `resolved_pending_observation` / `pending`, `provesExternalChain: false` |

## Local Browser Observation

- Repository core `observeDataChainSurfaces()` with injected Puppeteer `observeSurface` and signed better-auth session cookie
- Canonical Gateway origin only: `http://localhost:8080`
- Order: Dashboard `/dashboard/movies` then Viewer `/movie/p13-smoke-starye-org-c656ccd0`
- Both surfaces HTTP 200 on exact final origin/path; item code + item id markers matched
- Observe exit `0`; surfaces include `dashboard=passed`, `viewer=passed`
- Post-browser exact verify: exit `0`, `outcome: terminal_passed`, `provesExternalChain: true`, state `resolved`, aggregate `passed`

## Evidence (untracked)

Root: `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-41-379b38f7ce29f2a621097bbd42ccfe3b/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `local.attempt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `local.json` | 5264 | `d02d6c1120123636faf3e07c815e297e575e403a9a0bd1bdc340a5359cd4b3f8` |
| `local.md` | 1608 | `659ba53bda9fb80f25f8dccb6e7a2d1bcc56e4295391a5073303853b62345910` |

Locked remote checkpoints unchanged:

| Run | remote.json SHA-256 |
| --- | --- |
| p13-17-b807d44deee04e1f85b42fd02ed8cf26 | `f1bca8a944a2868024dfd6042fcaa397f17587e8d2709e71d976dbaac5faad72` |
| p13-37-1627bb2723604850a85e3ac9f805aab8 | `b2ba98b4f7f0dfa296312d9081d330b648d8703dc778f6d6b69675f422072b24` |

## Scope Boundary

- No remote handoff, production browser, provider deploy, or migration
- No reuse of `p13-17-*` or `p13-37-*` as this plan's run
- Did not start a new `pnpm dev` tree (adopted healthy existing listeners); no task-owned listener cleanup required
- This Summary authorizes Wave 40 / Plan 13-42 remote handoff for **this** run_id only when the human grants:

```text
approved remote handoff for starye-org p13-41-379b38f7ce29f2a621097bbd42ccfe3b
```

## Self-Check: PASSED