---
phase: 13
slug: full-chain-data-smoke
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 13 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 across config, crawler, API and movie app workspaces |
| **Config file** | package-level `vitest.config.*` plus existing `__tests__/` conventions |
| **Quick run command** | `pnpm --filter @starye/config test --run` |
| **Full suite command** | `pnpm --filter @starye/config test --run && pnpm --filter @starye/crawler test --run && pnpm --filter api test --run && pnpm --filter @starye/movie-app test --run` |
| **Estimated runtime** | ~60 seconds for focused workspace suites |

---

## Sampling Rate

- **After every task commit:** Run the focused suite named in that task's `<verify>` plus `git diff --check`.
- **After every plan wave:** Run the full workspace suite above and relevant `type-check` commands.
- **Before `$gsd-verify-work`:** Full suite must be green; validate generated local evidence and remote success-or-checkpoint evidence against the same schema.
- **Max feedback latency:** 60 seconds for unit/contract suites; browser/provider gates are explicit bounded checkpoints.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | DATA-03, DATA-07, TEST-05 | T-13-01 | Deterministic one-item fixture and redacted evidence reject ambient target, direct ports and secret-shaped fields. | unit/contract | `pnpm --filter @starye/config test --run` | ❌ Wave 0 | pending |
| 13-01-02 | 01 | 1 | DATA-02, DATA-03 | T-13-02 | Registry-owned prepared operation cannot bypass selected-target preflight or mutate after a failed gate. | unit/contract | `pnpm --filter @starye/crawler test --run` | ❌ Wave 0 | pending |
| 13-02-01 | 02 | 2 | DATA-01, DATA-04, DATA-05, DATA-06 | T-13-03 | Local smoke observes the same item through Gateway, D1/API, Dashboard and public viewer, or records a truthful checkpoint. | integration | `pnpm --filter api test --run && pnpm --filter @starye/movie-app test --run` | ❌ Wave 0 | pending |
| 13-03-01 | 03 | 3 | DATA-04, DATA-07, TEST-05 | T-13-04 | Remote path runs only after explicit live preflight; missing credentials/provider access yields `checkpoint`, never `passed`. | unit/acceptance | `pnpm --filter @starye/config test --run && pnpm --filter @starye/crawler test --run` | ❌ Wave 0 | pending |

*Status: pending -> green / red / flaky / checkpoint.*

---

## Wave 0 Requirements

- [ ] Focused smoke-runner/evidence tests under the owning workspace — cover identity determinism, redaction, URL validation and checkpoint result semantics.
- [ ] Prepared crawler/target-entry tests — cover one-item cap and no mutation after failed target preflight.
- [ ] Local service smoke harness or documented checkpoint adapter — cover Gateway-only URL evidence and same-item correlation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Authorized Dashboard session manages or validates the smoke item through Gateway. | DATA-05 | Session and role exist outside repository fixtures; no fabricated cookie is valid evidence. | Use `http://localhost:8080/dashboard/` locally or selected canonical `/dashboard/` remotely after the runner records item identity; capture pass or auth checkpoint. |
| Selected production target renders the item on its canonical Gateway movie path. | DATA-06, DATA-07 | Requires authorized provider target and actual deployed browser route. | Run only after remote preflight passes; capture the selected canonical `/movie/<code>` result, or a fail-closed provider/auth checkpoint. |

---

## Validation Sign-Off

- [ ] All tasks have automated verification or an explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive implementation tasks without focused automated verification.
- [ ] Wave 0 covers every missing smoke/evidence reference.
- [ ] No watch-mode flags are used; use `vitest run` semantics only.
- [ ] Local and remote evidence validate the same non-secret schema.
- [ ] `nyquist_compliant: true` is set after plans and their verification commands are finalized.

**Approval:** pending plan generation
