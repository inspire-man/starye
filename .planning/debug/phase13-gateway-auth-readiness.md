---
status: awaiting_human_verify
trigger: "Gateway readiness rejects the expected local /auth/ to /auth/login redirect before Phase 13 local proof run-id allocation."
created: 2026-07-25
updated: 2026-07-25
---

# Phase 13 Gateway Auth Readiness

## Symptoms

- Expected: `pnpm check:services` accepts the canonical local Gateway auth surface when unauthenticated `/auth/` redirects internally to `/auth/login`.
- Actual: `http://localhost:8080/auth/` returns `302 /auth/login` and `gateway-readiness` reports `http_status_unaccepted`.
- Error: `pnpm check:services` exits 1 with listeners healthy and Gateway HTTP unhealthy.
- Timeline: observed on the current-source `pnpm dev` tree during Phase 13 Plan 48 before any `p13-48` run-id or evidence allocation.
- Reproduction: start the local root development tree, then run `pnpm check:services`.

## Current Focus

- hypothesis: No deterministic readiness-code defect exists in the current source; the original failure was a transient or stale runtime observation.
- test: complete; source contract, regression coverage, raw Gateway headers, and three independent `pnpm check:services` executions agree.
- expecting: a user-side repeat of the same local check remains healthy unless an external runtime condition changes.
- next_action: await parent/user confirmation that the original Phase 13 local workflow can resume from the healthy service gate.

## Evidence

- timestamp: 2026-07-25
  observation: `robots.txt` returned 200, `/auth` returned accepted 301 to `/auth/`, and `/auth/` returned 302 to `/auth/login` but was classified `http_status_unaccepted`.
- timestamp: 2026-07-25
  observation: Current source accepts `/auth/` 3xx redirects whose resolved URL has origin `http://localhost:8080` and a pathname starting `/auth/`; the existing regression test explicitly expects `302 Location: /auth/login` to make all three Gateway probes healthy.
  implication: The initial theory is contradicted by static source and must be tested against live execution before any code change.
- timestamp: 2026-07-25
  observation: With root development PID 14392 kept alive, `pnpm check:services` exited 0. All seven listeners were healthy and Gateway emitted schema `starye-gateway-readiness-1` with `robots`, `auth`, and `authSlash` all `accepted`.
  implication: The reported failure does not reproduce on the current live process; no source change is justified yet.
- timestamp: 2026-07-25
  observation: Two further `pnpm check:services` runs exited 0 with the same all-accepted readiness JSON. A manual non-following request to `http://localhost:8080/auth/` returned `HTTP/1.1 302 Found` and `Location: /auth/login`.
  implication: The exact reported route behavior and acceptance decision are stable across three consecutive checks on the unchanged services.
- timestamp: 2026-07-25
  observation: `git diff` found no local modification to `scripts/gateway-readiness.ts`, `scripts/check-services.ps1`, or the matching readiness test. `git blame` attributes the relevant same-origin `/auth/*` acceptance branch to `dda41ea1` on 2026-07-19; GitNexus was refreshed to the current repository head without changing application source.
  implication: No source revision during this session explains the earlier contradictory result, so a source fix would be speculative.

## Eliminated

- hypothesis: Phase 13 data-chain handoff failed after run allocation.
  reason: no `p13-48` run id, attempt marker, or evidence tree was created before the Gateway readiness gate stopped execution.
- hypothesis: `scripts/gateway-readiness.ts` deterministically rejects a same-origin `/auth/ -> /auth/login` redirect.
  reason: Current source has an explicit acceptance branch for same-origin `/auth/*` locations, its existing regression test passes that exact redirect, and the authorized live reproduction returned all three probe outcomes as `accepted`.

## Resolution

- root_cause: No current code defect is reproducible. The earlier `http_status_unaccepted` report contradicts both the committed acceptance branch and the observed `302 Location: /auth/login`; it was a transient or stale runtime observation outside the present source contract.
- fix: No production code change. Kept the existing root dev process alive and re-ran the canonical local readiness gate after services were stable.
- verification: `pnpm check:services` passed three consecutive times with all seven listeners healthy and all three Gateway probes accepted; manual non-following `GET /auth/` returned `302 Location: /auth/login`; the existing regression suite already covers this acceptance case.
- files_changed: [`.planning/debug/phase13-gateway-auth-readiness.md`]
