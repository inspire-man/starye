---
phase: 13-full-chain-data-smoke
plan: "08"
subsystem: data-chain-smoke
tags: [execution, gateway, oauth, checkpoint-evidence, provenance, fail-closed]

requires:
  - phase: 13-07
    provides: tuple-bound runner, provider, and browser provenance receipts plus artifact-only verification
provides:
  - two fresh, independent local code-2 checkpoint pairs at target projection and Dashboard auth/session boundaries
  - redacted Codex built-in browser diagnosis of the unresolved local GitHub OAuth token exchange
  - explicit prohibition on remote smoke without a terminal receipt-backed local pair from the same fresh run
affects: [13-verification, phase-14, selected-target-smoke]

tech-stack:
  added: []
  patterns: [fresh-run checkpoint retention, exact artifact-wrapper verification, local-before-remote gating]

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.md
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.json
    - .planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.md
  modified:
    - .planning/phases/13-full-chain-data-smoke/13-08-SUMMARY.md

key-decisions:
  - "Keep Attempt A and Attempt B as separate immutable checkpoint runs; never promote or rewrite either pair."
  - "Treat Attempt B dashboard_auth_unavailable as the honest gateway auth/session boundary after the one-item local runner reached pending observation."
  - "Do not start Task 2 or issue any remote command because neither local pair is terminal resolved/passed."
  - "Keep generated evidence untracked and record only allowlisted paths, tuple metadata, and outcomes."

patterns-established:
  - "A fresh execution checkpoint is an auditable non-success result, not Phase 13 completion evidence."
  - "OAuth diagnosis uses the Codex built-in browser; the repository observer captures only the current unavailable session state."

requirements-completed: []
requirements-pending: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Two fresh local invocations retained schema-valid redacted code-2 checkpoints at distinct external boundaries.
    requirement: DATA-07
    verification:
      - kind: other
        ref: pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-0b30d5c722be483d67f65305 --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: pass
      - kind: other
        ref: pnpm smoke:data-chain:verify -- --mode local --target starye-org --run-id p13-08-50bd5b54f177491fa01e46c7908cd1bd --evidence-dir .planning/phases/13-full-chain-data-smoke/evidence
        status: pass
    human_judgment: true
    rationale: Both wrappers prove valid non-success checkpoint evidence only; neither proves the complete local external chain.
  - id: D2
    description: The selected-target remote chain remains blocked until a new exact local pair is terminal and receipt-backed.
    requirement: DATA-07
    verification: []
    human_judgment: true
    rationale: No provider, remote D1, canonical API, Dashboard, viewer, or remote mutation operation was permitted after the local checkpoints.

duration: 12min
completed: 2026-07-18
status: checkpoint
---

# Phase 13 Plan 08: Authorized Smoke Execution Checkpoint Summary

**Two independent fresh local runs now preserve distinct fail-closed boundaries: Attempt A stopped at target projection, while Attempt B reached a one-item pending tuple and stopped at unavailable Dashboard auth/session; remote smoke remains forbidden.**

## Performance

- **Cumulative active duration:** 12 min
- **Attempt A:** 2026-07-18T05:30:10Z to 2026-07-18T05:35:08Z
- **Attempt B:** 2026-07-18T06:27:03Z to 2026-07-18T06:33:35Z
- **Tasks:** Task 1 checkpoint retained across two fresh runs; Task 2 blocked
- **Files modified:** 1 tracked summary; 4 untracked evidence files

## Accomplishments

- Preserved Attempt A unchanged as a fresh `local_projection/target_projection_unmet` checkpoint.
- Ran Attempt B with `CLOUDFLARE_API_TOKEN` removed only from the smoke child process; the exact runner passed local projection, local D1 readiness, service readiness, Gateway auth route readiness, one-row D1 snapshot, and canonical Gateway API observation.
- Used only the repository observer with its existing persistent `userDataDir`; it captured `dashboard/dashboard_auth_unavailable`, wrote the redacted code-2 checkpoint, closed, and did not attempt GitHub login.
- Exactly verified Attempt B as `outcome: checkpoint` and `provesExternalChain: false`, then stopped before viewer observation or every remote/provider command.

## Task Commits

No source task commit was created. Attempt A closeout is `a0cf93c`; this continuation updates only the tracked checkpoint summary. Both evidence pairs remain intentionally untracked.

## Evidence

| Attempt | Run ID | Lifecycle | Checkpoint category | JSON | Markdown |
| --- | --- | --- | --- | --- | --- |
| A | `p13-08-0b30d5c722be483d67f65305` | `pre_ingest/checkpoint` | `local_projection/target_projection_unmet` | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.json` | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-0b30d5c722be483d67f65305/local.md` |
| B | `p13-08-50bd5b54f177491fa01e46c7908cd1bd` | `resolved_pending_observation/checkpoint` | `dashboard/dashboard_auth_unavailable` | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.json` | `.planning/phases/13-full-chain-data-smoke/evidence/starye-org/p13-08-50bd5b54f177491fa01e46c7908cd1bd/local.md` |

Attempt B retained one non-empty item tuple. Its observations are:

| Surface | Result | Detail |
| --- | --- | --- |
| `local_projection` | passed | Explicit `starye-org` local projection/preflight |
| `local_d1_readiness` | passed | Local D1 ready |
| `service_readiness` | passed | Canonical local stack ready |
| `gateway_auth` | passed | Gateway `/auth/` route probe; this is not an authenticated browser session claim |
| `d1` | passed | Exact snapshot count `1` |
| `api` | passed | Exact item through `http://localhost:8080/api/public/movies/<item-code>` |
| `dashboard` | checkpoint | `dashboard_auth_unavailable` at `http://localhost:8080/dashboard/movies` |

No viewer receipt was attempted after the Dashboard checkpoint. Neither run has a remote evidence file.

## Authentication Diagnosis

- The canonical local stack was cleanly restarted and `http://localhost:8080/api/health` returned `200`; the auth route was ready.
- The Codex built-in browser used its persistent GitHub session and initiated OAuth through `http://localhost:8080/auth/login?next=/dashboard/movies` three times. Each GitHub round trip returned to `/api/auth/error?error=invalid_code`.
- Redacted API logs place the failure in Better Auth `github.validateAuthorizationCode`: the token exchange took about 21 seconds and ended as an internal error.
- GitHub OAuth App `Starye Local` uses callback `http://localhost:8080/api/auth/callback/github`. The configured client identity, current secret identity, process environment, start redirect client id, and redirect URI were checked for consistency without recording their values.
- A safe fake-code probe against the GitHub token endpoint returned `bad_verification_code`, showing that the configured client credentials and token endpoint are accepted for that negative probe.
- Direct navigation to `/dashboard/movies` still redirected to login, so no valid local Dashboard session exists. This is the unresolved external `gateway_auth/session unavailable` boundary.

The repository observer was not used for any login attempt. It only captured the current unavailable Dashboard session into Attempt B and closed immediately.

## Verification

- `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/data-chain-evidence.test.ts src/deployment-target/__tests__/data-chain-smoke-local.test.ts src/deployment-target/__tests__/data-chain-smoke-remote.test.ts src/deployment-target/__tests__/verify-data-chain-smoke.test.ts` - passed, 4 files / 49 tests.
- `GET http://localhost:8080/api/health` - `200`.
- Attempt B runner - underlying exit `2`; persisted `resolved_pending_observation/pending` before browser observation.
- Attempt B repository observer - underlying exit `2`; persisted `dashboard_auth_unavailable` and did not start viewer observation.
- Attempt B exact verifier - underlying exit `2`; `outcome: checkpoint`, `provesExternalChain: false`.
- Allowlisted inspection - exact mode/target/run/code/id correlation, D1 count one, seven observations, no secret-like keys, no direct app port, and no remote pair.
- Attempt A SHA-256 values matched before and after Attempt B; its files were not changed.

The root pnpm wrapper reports exit `1` when the hardened runner, observer, or verifier intentionally returns checkpoint exit `2`.

## Decisions Made

- Preserve both newly written pairs exactly as emitted. The plan forbids retrying or editing a checkpointed run into success.
- Do not modify code, OAuth App settings, local secrets, or GitHub settings in response to the external token-exchange failure.
- Do not run Task 2. Remote eligibility requires a fresh run's exact local pair to be terminal `resolved/passed` with all runner and browser receipts.

## Deviations from Plan

None - the plan explicitly accepts honest external-boundary checkpoints and requires immediate remote blocking when local proof is non-terminal.

## Issues Encountered

- Attempt A exposed process-level provider token shadowing and stopped at `target_projection_unmet`.
- Attempt B removed that key only from its process and reached the real browser boundary, where GitHub OAuth token exchange still failed and no authorized Dashboard session could be established.
- The first parallel focused-test launch hit a Windows tool-layer `UV_HANDLE_CLOSING` assertion before producing a repository test result. The exact suite was rerun serially and passed 49/49; no repository artifact was changed by the tool-layer failure.

## Authentication Gates

Task 1 remains at a genuine external authentication gate. No secret is requested. Continuation requires the existing Gateway GitHub OAuth exchange to complete successfully and leave an authorized Dashboard session that can access `http://localhost:8080/dashboard/movies`.

## Known Stubs

None. Attempt A's `itemId: null` is the required pre-ingest checkpoint shape; Attempt B contains a real one-item tuple and an explicit session checkpoint.

## User Setup Required

Resolve the external local OAuth token-exchange/session condition without changing either evidence pair. After an authorized Gateway Dashboard session exists, generate another fresh run id and rerun the exact local runner, repository observer, and verifier. Do not reuse Attempt A or Attempt B.

## Next Phase Readiness

- Phase 13 remains incomplete and must not be marked passed or complete.
- Task 2 remains forbidden; no remote command, provider check, D1 mutation, deploy, or browser observation was attempted.
- Remote execution becomes eligible only after a fresh exact local pair is terminal, count-one, and receipt-backed through both Dashboard and viewer.

## Self-Check: PASSED

- The tracked checkpoint summary and both fresh local JSON/Markdown pairs exist.
- Attempt A closeout commit `a0cf93c` exists, and Attempt A hashes match before and after Attempt B.
- Attempt B exact verification returns checkpoint/non-success, and no Attempt B remote artifact exists.
- Summary frontmatter remains `status: checkpoint` with every Phase 13 requirement pending.
- No source symbol or execution flow was edited; generated evidence remains untracked.

---
*Phase: 13-full-chain-data-smoke*
*Plan: 08*
*Checkpoint updated: 2026-07-18*
