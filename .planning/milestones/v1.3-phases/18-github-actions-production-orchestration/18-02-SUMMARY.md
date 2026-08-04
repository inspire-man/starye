---
phase: 18-github-actions-production-orchestration
plan: 02
subsystem: api
tags: [github-app, github-actions, web-crypto, jwt, worker, vitest]
requires:
  - phase: 18-01
    provides: Immutable GitHub Actions provider snapshots and optional Worker bindings.
provides:
  - Request-scoped Web Crypto RS256 GitHub App JWT signing.
  - Repository-scoped installation token exchange with redacted failures.
  - Closed Actions dispatch, cancel, and workflow-run status client.
affects: [18-03, 18-04, production-orchestration, crawler-tasks]
tech-stack:
  added: []
  patterns: [request-scoped provider credentials, immutable snapshot Actions client, bounded retry reasons]
key-files:
  created:
    - apps/api/src/lib/github-app/jwt.ts
    - apps/api/src/lib/github-app/installation-token.ts
    - apps/api/src/lib/github-app/github-actions-client.ts
    - apps/api/src/lib/github-app/__tests__/jwt.test.ts
    - apps/api/src/lib/github-app/__tests__/installation-token.test.ts
    - apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts
  modified:
    - .planning/phases/18-github-actions-production-orchestration/COVERAGE.md
key-decisions:
  - "App JWT uses a 60-second backdate, a 9-minute default lifetime, and a 10-minute hard maximum."
  - "An installation token is confined to an in-request callback and never appears in return DTOs."
  - "Actions dispatch receives only run_id, attempt, template, and target; snapshot identity determines every provider control."
patterns-established:
  - "Provider transport failures expose only reason code, retryability, and optional HTTP status."
  - "Dispatch and cancel acknowledgement are process facts, not crawler success receipts."
requirements-completed: [PROD-01, PROD-03]
coverage:
  - id: D1
    description: Web Crypto App JWT and request-scoped installation-token exchange.
    requirement: PROD-01
    verification:
      - kind: unit
        ref: apps/api/src/lib/github-app/__tests__/jwt.test.ts
        status: pass
      - kind: unit
        ref: apps/api/src/lib/github-app/__tests__/installation-token.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Closed GitHub Actions dispatch, cancellation, polling, and bounded provider failure classification.
    requirement: PROD-01
    verification:
      - kind: unit
        ref: apps/api/src/lib/github-app/__tests__/github-actions-client.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: API capability coverage decision matrix for production orchestration.
    requirement: PROD-03
    verification:
      - kind: other
        ref: node C:/Users/11407/.codex/gsd-core/bin/gsd-tools.cjs query check api-coverage.verify-pre .planning/phases/18-github-actions-production-orchestration
        status: pass
    human_judgment: false
duration: 22 min
completed: 2026-08-01
status: complete
---

# Phase 18 Plan 02: GitHub App Web Crypto and Actions Client Summary

**Worker-native RS256 GitHub App authentication now mints one scoped installation token per provider operation and exposes only fixed Actions dispatch, cancellation, and polling methods.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-01T01:23:26+08:00
- **Completed:** 2026-07-31T17:46:17Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Added Web Crypto PKCS#8 RS256 signing with bounded `iat`/`exp`, App ID issuer, and redacted failure codes.
- Added a request-confined installation-token exchange restricted to `actions:write` and the fixed repository.
- Added an immutable-snapshot GitHub Actions client with closed inputs, retryable/terminal classification, and safe provider run projection.
- Normalized the API coverage matrix to stable English capability IDs; credentialed remote proof remains an explicit Phase 19 opt-out.

## Task Commits

1. **Task 1: Web Crypto App JWT and installation token**
   - `0d40d01` test RED: GitHub App JWT contract
   - `e3096d3` feat: Web Crypto GitHub App JWT
   - `d3120af` test RED: installation-token exchange coverage
   - `172ff12` feat: scoped installation-token exchange
2. **Task 2: Closed GitHub Actions REST client**
   - `c779762` test RED: Actions client coverage
   - `dae6d3e` feat: closed Actions REST client
3. **Task 3: API coverage decision matrix**
   - `d34b3c0` docs: stable GitHub API coverage matrix

## Files Created/Modified

- `apps/api/src/lib/github-app/jwt.ts` — Web Crypto App JWT signer with safe key/claim validation.
- `apps/api/src/lib/github-app/installation-token.ts` — in-memory scoped token exchange and provider failure classifier.
- `apps/api/src/lib/github-app/github-actions-client.ts` — fixed snapshot dispatch/cancel/poll surface.
- `apps/api/src/lib/github-app/__tests__/*.test.ts` — stubbed crypto and provider transport coverage.
- `.planning/phases/18-github-actions-production-orchestration/COVERAGE.md` — stable API capability decisions.

## Decisions Made

- The App JWT defaults to nine minutes, is backdated by sixty seconds, and rejects any expiry above ten minutes.
- The installation token can only be consumed by a callback in the same provider operation; it never appears in the result projection.
- `dispatch_accepted` and `cancel_accepted` remain external-provider process facts. A provider status alone remains insufficient for a crawler success receipt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Error classification] PKCS#8 import failures initially shared the signing-failure path.**

- **Found during:** Task 1
- **Fix:** Split key import from signing so malformed or non-RSA PKCS#8 material returns `github_app_jwt_private_key_invalid`.
- **Files modified:** `apps/api/src/lib/github-app/jwt.ts`
- **Verification:** JWT unit tests pass.
- **Committed in:** `e3096d3`

**2. [Rule 1 - Validation robustness] The initial PEM parser was rejected for super-linear regex backtracking.**

- **Found during:** Task 1
- **Fix:** Replaced the ambiguous PEM regex with bounded header/footer slicing and strict base64 validation.
- **Files modified:** `apps/api/src/lib/github-app/jwt.ts`
- **Verification:** API lint and JWT unit tests pass.
- **Committed in:** `e3096d3`

---

**Total deviations:** 2 auto-fixed (2 correctness/validation). **Impact:** Necessary bounded error handling only; no scope expansion.

## Issues Encountered

None.

## User Setup Required

None — credentialed GitHub App metadata and Environment secrets remain intentionally deferred to the target environment and Phase 19 sign-off.

## Next Phase Readiness

- 18-03 can compose this request-scoped client with the D1 provider-association lifecycle and reconciliation flow.
- No live GitHub provider run was attempted; the plan's tests use only stubbed fetch and generated test keys.

## Self-Check: PASSED

- All three task artifacts exist and task commits are present.
- `pnpm --filter api exec vitest run src/lib/github-app/__tests__` passed: 3 files, 13 tests.
- `pnpm --filter api type-check` passed.
- API coverage gate passed: 13 capabilities, 12 `INTEGRATE`, 1 reasoned `OPT-OUT`.

---
*Phase: 18-github-actions-production-orchestration*
*Completed: 2026-08-01*
