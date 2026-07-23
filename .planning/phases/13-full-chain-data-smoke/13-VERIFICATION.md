---
phase: 13-full-chain-data-smoke
verified: 2026-07-23T08:40:00Z
status: gaps_found
score: 11/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/13
  gaps_closed:
    - "13-40 rotated operator CLOUDFLARE_API_TOKEN; wrangler whoami exit 0; remote live preflight exit 0 for starye-org."
    - "13-41 fresh local terminal on p13-41-379b38f7ce29f2a621097bbd42ccfe3b (handoff pending + ordered Gateway Dashboard/viewer terminal_passed)."
    - "13-42 authorized remote handoff pending with non-empty remote itemId 03a9a090-c747-421e-b40b-fda7b8c378b2; public production API 200."
  gaps_remaining:
    - "Production Dashboard observation stopped at dashboard_auth_unavailable (no production-valid signed session). Viewer not observed. Remote exact verify is checkpoint, not terminal_passed."
  regressions: []
gaps:
  - truth: "The item is visibly usable through the selected production canonical Dashboard and viewer routes, with captured terminal evidence."
    status: failed
    reason: "Provider-backed remote pending exists and public API returns the tuple, but production Dashboard requires authenticated session. Unauthenticated observe redirected to /auth/login; local BETTER_AUTH_SECRET cannot sign production cookies; browser cookie extraction/automation host did not yield a production session. remote.json now carries dashboard=checkpoint dashboard_auth_unavailable."
    artifacts:
      - path: ".planning/phases/13-full-chain-data-smoke/13-43-SUMMARY.md"
        issue: "production_dashboard: checkpoint; remote_verify_exit: 2; provesExternalChain_remote: false."
      - path: ".planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-41-379b38f7ce29f2a621097bbd42ccfe3b/remote.json"
        issue: "aggregate checkpoint; dashboard surface dashboard_auth_unavailable; viewer absent."
    missing:
      - "Production-valid signed-in session for https://starye.org (production BETTER_AUTH_SECRET or live operator browser session usable by observer)."
      - "Ordered production Dashboard then /movie/p13-smoke-starye-org-c656ccd0 viewer receipts and remote exact verify terminal_passed on an unobserved pending remote pair."
behavior_unverified_items:
  - truth: "Attempts A-E and the Plan 13-09/13-10 evidence remain byte-for-byte immutable since their original creation."
    test: "Compare authoritative manifests captured immediately after each historical run was first written against the current evidence tree."
    expected: "Every historical artifact hash equals its original post-creation hash, and no failed run was reopened."
    why_human: "No original-creation manifests were supplied; only later bounded hashes are available."
prohibition_flags:
  - statement: "Judgment-tier prohibitions in the historical gap plans."
    status: unverified
    reason: "No authoritative original-creation baseline was supplied; human review remains recommended."
---

# Phase 13: Full Chain Data Smoke Verification Report

**Phase Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.

**Verified:** 2026-07-23T08:40:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure Waves 38–41 (13-40..13-43)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Local smoke regression contract exists for Gateway/API/auth/dashboard/content. | VERIFIED | Contract tests + live local path on p13-41. |
| 2 | Local D1 readiness and minimal-data contract exists before production work. | VERIFIED | p13-41 local pair includes passed local_d1_readiness + d1 count 1. |
| 3 | A one-item deterministic non-R18 fixture contract exists. | VERIFIED | itemCode `p13-smoke-starye-org-c656ccd0`. |
| 4 | The selected production tuple is proved in D1/API/admin state. | PARTIAL | Remote D1 + public API proved (itemId non-null); Dashboard admin UI not authenticated. |
| 5 | The selected production Dashboard and viewer visibly prove the tuple. | FAILED | Dashboard auth checkpoint; viewer not observed. |
| 6 | The current local path can create a fresh terminal local pair. | VERIFIED | 13-41 local terminal_passed / provesExternalChain true. |
| 7 | Evidence contracts enforce tuple, lifecycle, redaction, canonical path, and receipt ordering. | VERIFIED | Exact verifier honest terminal/checkpoint outcomes. |
| 8 | The only smoke write is one deterministic non-R18 fixture and count-one snapshot. | VERIFIED | Local and remote runnerInvocations 1 each on p13-41. |
| 9 | Remote work is explicit-target, official-preflight-first, registry-owned, and fail-closed. | VERIFIED | 13-40 green preflight; 13-42 one handoff; 13-43 auth fail-closed. |
| 10 | Failures persist honest non-success evidence and never synthesize success. | VERIFIED | dashboard_auth_unavailable checkpoint; no production terminal synthesis. |
| 11 | Local/remote correlation is target/run/code shared with mode-owned item IDs. | VERIFIED | Shared target/run/code; local `0fb330bf-...`; remote `03a9a090-...`. |
| 12 | Historical evidence is immutable from its original creation. | PRESENT_BEHAVIOR_UNVERIFIED | Locked p13-17/p13-37 remotes hash-stable; original A-E manifests still absent. |
| 13 | Phase 14 cleanup and final documentation remain deferred / non-blocking for this gap set. | VERIFIED | Phase 14 complete separately; does not replace Phase 13 production UI proof. |

**Score:** 11/13 truths verified (truth 4 partial counts toward remaining production admin UI gap with truth 5); 1 present-but-behavior-unverified; production UI still failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| 13-28-SUMMARY.md | Released/cleaned/all_free lifecycle | VERIFIED | Current local release source. |
| 13-36-SUMMARY.md | local-dev profile wiring | VERIFIED | Local Pages materialization fix. |
| 13-37/13-41 local terminal | Fresh local terminal proof | VERIFIED | p13-41 supersedes for post-credential chain; p13-37 historical. |
| 13-UAT.md | Human UAT complete | VERIFIED | 34 pass / 0 issues. |
| 13-40-SUMMARY.md | Credential/preflight green | VERIFIED | whoami 0 + remote live preflight 0. |
| 13-42-SUMMARY.md + remote pending | Provider-backed pending | VERIFIED | remote itemId non-null; public API 200. |
| 13-43 production browser | Ordered Dashboard/viewer terminal | FAILED/CHECKPOINT | dashboard_auth_unavailable. |
| 13-VERIFICATION.md | Live-aligned status | VERIFIED | This file. |

### Key Link Verification

| From | To | Status | Details |
| --- | --- | --- | --- |
| 13-40 preflight green | 13-41 local terminal | WIRED | Local terminal on new run. |
| 13-41 local terminal | 13-42 remote handoff | WIRED | Authorized pending remote pair. |
| 13-42 remote pending | 13-43 production browser | PARTIAL | API/D1 yes; Dashboard auth blocked. |
| UAT | phase completion | PARTIAL | UAT complete; production UI still open. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Remote live preflight | `pnpm target-profile preflight --target starye-org --scope remote --command smoke --live --ci-environment starye-org --wrangler-profile starye-org` | exit 0, Target preflight passed | PASS |
| Local exact verify (p13-41) | `pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-41-...` | exit 0, terminal_passed | PASS |
| Remote exact verify (p13-41 post-observe) | same remote mode | exit 2, checkpoint dashboard_auth_unavailable | PASS (honest) |
| Public production API | `GET https://starye.org/api/public/movies/p13-smoke-starye-org-c656ccd0` | 200 + remote id/code | PASS |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| DATA-01 | SATISFIED (local) | p13-41 local Gateway chain. |
| DATA-02 | SATISFIED (local) | local D1 readiness + count 1. |
| DATA-03 | SATISFIED | Local + remote one-item fixture written. |
| DATA-04 | PARTIAL | Remote D1/API yes; admin Dashboard UI auth blocked. |
| DATA-05 | PARTIAL | Local Dashboard passed; production Dashboard auth checkpoint. |
| DATA-06 | PARTIAL | Local viewer passed; production viewer not observed. |
| DATA-07 | PARTIAL | Honest remote pending then auth checkpoint; production terminal missing. |
| TEST-05 | PARTIAL | UAT + local terminal + remote pending API; production UI incomplete. |

## What Closed Since 13-39

1. Invalid API token root cause fixed (13-40).
2. New local terminal run after credential repair (13-41).
3. First provider-backed remote pending pair for selected-production after preflight green (13-42).
4. Production public API visibility of the fixture confirmed.

## What Still Blocks Phase Pass

Production authenticated Dashboard → Viewer terminal observation on a pending remote pair. Current p13-41 remote pair is already checkpointed at `dashboard_auth_unavailable`; a later gap plan must use a fresh unobserved pending remote pair once production session signing material is available.

## Self-Check

- No success synthesis for production UI
- Locked p13-17/p13-37 remotes untouched
- Historical A-E immutability remains human-needed