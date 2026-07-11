# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 - 部署可用、日常使用态

**Shipped:** 2026-07-11
**Phases:** 5 | **Plans:** 24

### What Was Built

- Cross-app auth/session continuity and gateway cache safety.
- Dashboard/admin access control, public exposure hardening, R18 filtering, and login gates.
- Movie playback failure recovery with visible error cards, retry behavior, offline button feedback, and telemetry.
- Unified movie/comic progress persistence and restore semantics.
- Deploy, rollback, migration backup/review, Sentry, and RUNBOOK operations baseline.

### What Worked

- Verification artifacts became the strongest source of truth once older roadmap and traceability metadata drifted.
- UAT files were useful for preserving human operational evidence that cannot be reproduced locally.
- Keeping Phase 5 ops work tied to concrete deploy/rollback/migration/Sentry paths avoided turning it into a broad platform rewrite.

### What Was Inefficient

- Some older SUMMARY frontmatter did not anchor all completed requirements, which made milestone audit noisier than the runtime evidence warranted.
- Phase 1 lacked a retroactive security artifact, leaving a small archival inconsistency even though downstream phases exercised the boundary.
- Local dependency state drift blocked some verification reruns until pnpm build approvals and links were repaired.

### Patterns Established

- Use `*-VERIFICATION.md`, `*-UAT.md`, `*-SECURITY.md`, and `*-VALIDATION.md` as the closure contract for each phase.
- For production-adjacent checks, record both the static source assertion and the human/operator evidence.
- Treat suspicious or missing verification artifacts as closure blockers until canonical reports exist on disk.

### Key Lessons

1. Summary frontmatter needs to stay synchronized with verification coverage; otherwise milestone audit will classify real work as partial.
2. Ops features need UAT that names the exact workflow, input, artifact, and expected failure mode.
3. Dependency/tooling health is part of verification readiness, especially with pnpm build-script approvals.

### Cost Observations

- Model mix: not tracked.
- Sessions: multiple GSD workflow sessions.
- Notable: late-stage audit and verification cleanup cost more than expected because early phase metadata drift accumulated quietly.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multiple | 5 | Moved from implementation evidence to verifier-backed milestone closure |

### Cumulative Quality

| Milestone | Tests | Coverage | Notes |
|-----------|-------|----------|-------|
| v1.0 | Phase-specific unit, typecheck, UAT, security, validation checks | 5/5 phases verified | Remaining debt is metadata/security-artifact cleanup, not unsatisfied runtime requirements |

### Top Lessons

1. Keep audit evidence structured from the start.
2. Archive only after all hard blockers are converted into either verified closure or explicit accepted debt.

