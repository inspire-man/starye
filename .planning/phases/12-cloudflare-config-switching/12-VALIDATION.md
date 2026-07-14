---
phase: 12
slug: cloudflare-config-switching
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 across `@starye/config`, API, gateway and Vite apps |
| **Config file** | `packages/config/vitest.config.ts`, app-local Vitest configuration |
| **Quick run command** | `pnpm --filter @starye/config test --run src/deployment-target` |
| **Full suite command** | `pnpm --filter @starye/config test --run && pnpm --filter api test --run && pnpm --filter gateway test` |
| **Estimated runtime** | ~90 seconds without browser E2E |

## Sampling Rate

- **After every task commit:** Run the focused command for the touched deployment-target/runtime consumer.
- **After every plan wave:** Run the full targeted config/API/gateway suite plus affected frontend type/build checks.
- **Before `$gsd-verify-work`:** Run all Phase 12 requirement-focused tests and static workflow contract checks green.
- **Max feedback latency:** 90 seconds for unit/static checks; no remote credentialed command is part of Phase 12 automated feedback.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | ENV-03, ENV-04, ENV-05 | N/A | Public projection is typed/allowlisted and cannot serialize a secret or deployment origin. | unit | `pnpm --filter @starye/config test --run src/deployment-target` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | DEPL-01, DEPL-02, TEST-04 | N/A | Selected profile produces only matching Worker/Pages/CLI identity; missing worker/pages resource checks block. | unit | `pnpm --filter @starye/config test --run src/deployment-target` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | ENV-03, ENV-05, ENV-06, DEPL-02, TEST-03 | N/A | API/gateway/auth/browser consumers resolve selected canonical config; local browser traffic remains `http://localhost:8080/...`. | unit/type | `pnpm --filter api test --run && pnpm --filter gateway test` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | ENV-04, TEST-03 | N/A | Vite/Nuxt adapters reject secret-shaped and unregistered public values. | unit/build | `pnpm --filter dashboard test --run && pnpm --filter starye-auth build && pnpm --filter blog build` | ✅ / expand | ⬜ pending |
| 12-03-01 | 03 | 3 | DEPL-03, DEPL-04, DEPL-05, DEPL-06, TEST-04 | N/A | Workflow target -> Environment resolution, preflight/live-read order and resource argv are testable without credentials. | unit/static | `pnpm --filter @starye/config test --run src/deployment-target` | ✅ / expand | ⬜ pending |
| 12-03-02 | 03 | 3 | DEPL-01..DEPL-06, TEST-04 | N/A | YAML consumes validated non-secret output; no Pages project creation fallback, no target-suffixed secret lookup, no unqualified remote mutation. | static contract | `pnpm --filter @starye/config test --run src/deployment-target` | ❌ add fixture assertions | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

Existing `@starye/config` Vitest infrastructure and deployment-target fixture/mocked-executor patterns cover the initial test harness. No framework installation is needed.

- [ ] Add/extend fixture tests for Worker/Pages live resource checks, public allowlist and machine-readable CI/deploy projections.
- [ ] Add focused API/gateway/Nuxt/Vite adapter tests for canonical URL, CORS/auth and no-secret public config behavior.
- [ ] Add static workflow contract tests or fixture-backed helper tests for dispatch/push/schedule target resolution and mutation ordering.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real remote selected-target deploy/migration/crawler/rollback | DEPL-01..DEPL-06 | Requires Cloudflare/GitHub credentials and must not run from automated tests. | Phase 12 proves fail-closed command construction only; execute actual account operations and end-to-end smoke in Phase 13 under the RUNBOOK boundary. |

## Validation Sign-Off

- [x] All planned task groups have automated verification or Wave 0 dependencies.
- [x] Sampling continuity: no plan wave depends on an untested configuration change.
- [x] Wave 0 uses existing Vitest infrastructure and lists the missing focused assertions.
- [x] No watch-mode flags are accepted in verification commands.
- [x] Feedback latency stays below 90 seconds for the focused suite.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** draft 2026-07-15 — final plan checker must retain this mapping.
