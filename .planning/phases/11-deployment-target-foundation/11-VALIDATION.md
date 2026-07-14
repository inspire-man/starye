---
phase: 11
slug: deployment-target-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 11 - Validation Strategy

Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `packages/config/vitest.config.ts` (created by 11-01) |
| **Quick run command** | `pnpm --filter @starye/config test --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~60 seconds for package tests, full suite depends on workspace state |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted `vitest` or `tsc` command.
- **After every plan wave:** Run `pnpm --filter @starye/config test --run`.
- **Before `$gsd-verify-work`:** Run `pnpm --filter @starye/config test --run`, relevant `tsx scripts/target-profile.ts ...` CLI checks, and `npx gitnexus detect-changes --repo starye --scope all`.
- **Max feedback latency:** 120 seconds for Phase 11 targeted checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | TEST-02 | T-11-01 / T-11-02 | Test harness exists before target profile logic is trusted. | typecheck | `pnpm --filter @starye/config exec tsc --noEmit` | no, W0 | pending |
| 11-01-02 | 01 | 1 | PROF-01, PROF-03, TEST-02 | T-11-01 / T-11-03 | Profile schema rejects secret values, missing resource identity, and invalid URL/resource metadata. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/target-profile.schema.test.ts -x` | no, W0 | pending |
| 11-01-03 | 01 | 1 | PROF-02, PROF-03, TEST-02 | T-11-02 | Resolver requires explicit `--target` and rejects aliases/default fallback. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/target-resolver.test.ts -x` | no, W0 | pending |
| 11-02-01 | 02 | 2 | ENV-01, ENV-02, TEST-02 | T-11-04 | Projection plan only emits target-managed public/resource keys for the four locked local env files. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/projection-plan.test.ts -x` | no, W0 | pending |
| 11-02-02 | 02 | 2 | ENV-01, ENV-02, TEST-02 | T-11-05 | Env block updater preserves user-managed secrets and removes stale target-managed residue. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/env-file-block.test.ts -x` | no, W0 | pending |
| 11-03-01 | 03 | 3 | PROF-02, PROF-03, PROF-04, ENV-02, TEST-02 | T-11-02 / T-11-03 | Preflight enforces selected target, projection consistency, local Wrangler profile boundary, and CI secret-bundle metadata. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/preflight.test.ts src/deployment-target/__tests__/identity-boundary.test.ts -x` | no, W0 | pending |
| 11-03-02 | 03 | 3 | PROF-02, PROF-03, TEST-02 | T-11-06 | Live checks are read-only and fail closed when remote credentials are unavailable. | unit | `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/live-checks.test.ts -x` | no, W0 | pending |
| 11-03-03 | 03 | 3 | PROF-02, PROF-03, PROF-04, ENV-02, TEST-02 | T-11-02 / T-11-03 / T-11-04 | CLI validation proves the `starye-org` fixture is explicit and local/CI identity guidance is visible without mutating Phase 12 workflows. | CLI smoke | `pnpm exec tsx scripts/target-profile.ts validate --target starye-org` | no, W0 | pending |

---

## Wave 0 Requirements

- [ ] `packages/config/vitest.config.ts` - package-local Vitest config.
- [ ] `packages/config/package.json` - `test` script and `./deployment-target` export.
- [ ] `packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts` - profile shape and non-secret contract.
- [ ] `packages/config/src/deployment-target/__tests__/target-resolver.test.ts` - explicit target resolver and legacy alias blocking.
- [ ] `packages/config/src/deployment-target/__tests__/projection-plan.test.ts` - local env projection plan.
- [ ] `packages/config/src/deployment-target/__tests__/env-file-block.test.ts` - marker-aware env block preservation.
- [ ] `packages/config/src/deployment-target/__tests__/preflight.test.ts` - static/projection/command-input fail-closed preflight.
- [ ] `packages/config/src/deployment-target/__tests__/identity-boundary.test.ts` - Wrangler local profile vs CI secret bundle boundary.
- [ ] `packages/config/src/deployment-target/__tests__/live-checks.test.ts` - read-only live check orchestration and missing-credential failure.
- [ ] CLI fixture-root checks for `project-local --check --env-root <fixture>`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Credentialed live Cloudflare resource existence check | PROF-02, PROF-03 | Real account credentials are not available in repo automation and must not be stored in plans. | Run the CLI with an operator-provided Wrangler profile/token after Phase 12 wiring is ready; Phase 11 must fail closed when credentials are absent. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing test/config references.
- [ ] No watch-mode flags.
- [ ] Feedback latency under 120 seconds for targeted checks.
- [ ] Set `nyquist_compliant: true` only after execution evidence shows the map is complete and green.

**Approval:** pending
