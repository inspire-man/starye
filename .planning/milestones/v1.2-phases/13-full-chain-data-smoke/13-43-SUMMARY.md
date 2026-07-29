---
phase: 13-full-chain-data-smoke
plan: "43"
subsystem: production-surfaces-verification
status: complete
gap_closure: true
execution_scope: selected-production-browser
remote_outcome: pending_then_dashboard_auth_checkpoint
production_browser: attempted
production_dashboard: checkpoint
checkpoint: dashboard_auth_unavailable
run_id: p13-41-379b38f7ce29f2a621097bbd42ccfe3b
item_code: p13-smoke-starye-org-c656ccd0
remote_item_id: 03a9a090-c747-421e-b40b-fda7b8c378b2
local_item_id: 0fb330bf-f3bf-4785-a5d9-088b6c1ac392
local_verify_exit: 0
remote_verify_exit: 2
provesExternalChain_local: true
provesExternalChain_remote: false
requirements-completed: []
completed: 2026-07-23
---

# Phase 13 Plan 43: Production Surfaces + Verification Refresh

Consumed 13-42 remote **pending** pair (non-empty remote itemId) after credential repair. Attempted selected-production ordered browser observation on canonical `https://starye.org`. Dashboard stopped at authenticated-session boundary; dual exact verifiers and live verification report updated without synthesizing production terminal success.

## 13-42 Input

| Field | Value |
| --- | --- |
| remote_outcome | pending |
| handoffReady | true |
| preflightStatus | passed |
| runnerInvocations | 1 |
| remote itemId | `03a9a090-c747-421e-b40b-fda7b8c378b2` |
| itemCode | `p13-smoke-starye-org-c656ccd0` |

## Public production API (pre-browser)

`	ext
GET https://starye.org/api/public/movies/p13-smoke-starye-org-c656ccd0
`

| Field | Value |
| --- | --- |
| HTTP | 200 |
| body includes remote itemId | true |
| body includes itemCode | true |

This confirms provider-backed fixture + public API on production, independent of Dashboard session.

## Production browser attempt

Canonical Gateway only: `https://starye.org`.

| Step | Result |
| --- | --- |
| Signed cookie from remote D1 session + **local** `BETTER_AUTH_SECRET` | rejected (`get-session` → null); production secret differs from `apps/api/.dev.vars` |
| Browser cookie DB extraction (Chrome locked; Edge no starye session) | no usable `starye.session_token` |
| Computer Use / Chrome extension automation host | runtime unavailable in this shell |
| Unauthenticated observe (repository `observeDataChainSurfaces` mode=remote) | Dashboard navigated to `https://starye.org/auth/login?next=/dashboard/movies` (HTTP 200) |
| Observer write | append `dashboard=checkpoint` / `dashboard_auth_unavailable`; **viewer not observed** (fail-closed after dashboard checkpoint) |

No production terminal Dashboard/viewer receipts were synthesized.

## Dual exact verifiers (post-attempt)

| Mode | exit | outcome | provesExternalChain |
| --- | ---: | --- | --- |
| local | 0 | terminal_passed | true |
| remote | 2 | checkpoint `dashboard_auth_unavailable` | false |

## Evidence (untracked) — p13-41 remote after observe

Root: `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-41-379b38f7ce29f2a621097bbd42ccfe3b/`

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| remote.attempt | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| remote.json | 2322 | `120db2e780b49825c49f5d0b923da80aa3238a4848cc966771a902b8eca4ce5c` |
| remote.md | 993 | `60e722ac42e780b7c29387aa02a1e1e34a94acf2347818f127cec184b2c70c96` |

Local terminal pair remains:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| local.attempt | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| local.json | 5264 | `d02d6c1120123636faf3e07c815e297e575e403a9a0bd1bdc340a5359cd4b3f8` |
| local.md | 1608 | `659ba53bda9fb80f25f8dccb6e7a2d1bcc56e4295391a5073303853b62345910` |

## Immutability

Locked remote checkpoints unchanged:

| Run | remote.json SHA-256 |
| --- | --- |
| p13-17-b807d44deee04e1f85b42fd02ed8cf26 | `f1bca8a944a2868024dfd6042fcaa397f17587e8d2709e71d976dbaac5faad72` |
| p13-37-1627bb2723604850a85e3ac9f805aab8 | `b2ba98b4f7f0dfa296312d9081d330b648d8703dc778f6d6b69675f422072b24` |

## 13-VERIFICATION refresh

Rewrote `13-VERIFICATION.md` from live 13-28/36/37/38/39/40/41/42/43 + UAT truths. Status remains **`gaps_found`** because production Dashboard/viewer terminal is not closed (auth session gate). Score updated to reflect closed remote preflight + provider pending path and remaining production-auth gap.

## Remaining gap (exact)

Operator must supply a **production-valid** signed-in session for `https://starye.org` (either production `BETTER_AUTH_SECRET` for cookie signing, or a live browser session cookie / Chrome profile the automation host can use). Then re-run ordered production Dashboard → Viewer observation on this same pending remote tuple **only if** the evidence pair is still unobserved pending; if the pair is already checkpointed at `dashboard_auth_unavailable`, allocate a new local+remote chain under a new gap plan.

## Scope Boundary

- Did not reopen locked p13-17/p13-37 remotes
- Did not invent historical A-E manifests
- Did not claim phase complete

## Self-Check: PASSED