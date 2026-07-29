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

## Milestone: v1.1 - 存储成本控制与代码/文件整理

**Shipped:** 2026-07-13
**Phases:** 5 | **Plans:** 15

### What Was Built

- Read-only R2 audit tooling, storage policy docs, runtime inventory evidence, and no-delete report contracts.
- Comic chapter external-image flow from crawler through API and Reader, including failure-safe Reader UX.
- Upload purpose allowlist, crawler namespace guards, audit hard-failure rules, and RUNBOOK cost guardrails.
- Canonical documentation ownership, thinner root docs, and an archive boundary for superseded storage materials.
- Shared storage helper semantics across upload routes, crawler processing, admin pending heuristics, and legacy scripts.

### What Worked

- Splitting the milestone into policy, runtime behavior, cost guardrails, docs, and cleanup phases kept the free-tier-first goal concrete instead of turning it into a vague refactor.
- Phase-level `VERIFICATION.md` files plus one milestone-level audit made it easy to prove that external image semantics stayed intact through later cleanup.
- Keeping storage semantics in a pure shared helper let API, crawler, and admin logic converge without introducing a shared runtime service.

### What Was Inefficient

- The closeout needed extra manual work because the generated milestone archive entry undercounted accomplishments and did not fully compress the live roadmap back to archive form.
- Phase 6 verification initially needed canonical-body cleanup so milestone audit could cross-reference `STOR-*` requirements as cleanly as later phases.
- Some operator-facing follow-through, such as credentialed dry-run execution and Cloudflare Billing UI setup, remained necessarily outside terminal-only verification even after the code and runbook were ready.

### Patterns Established

- For storage-policy work, require both a policy doc and a machine-checkable audit/tooling contract before allowing any cleanup phase.
- Treat external/source URLs as a first-class valid terminal state, not as a temporary exception to a managed-storage default.
- Keep root doc ownership explicit; otherwise historical storage docs will drift back into pseudo-canonical guidance.

### Key Lessons

1. If a milestone depends on semantic boundaries, encode them once in shared helpers and then reuse them across API, crawler, admin, tests, and scripts.
2. Milestone closeout is cheaper when verification files already contain requirement-level tables in a consistent shape.
3. Generated archive helpers are useful scaffolding, but final closeout still needs a human pass to keep roadmap, milestones, state, and retrospective aligned.

### Cost Observations

- Model mix: not tracked.
- Sessions: multiple GSD workflow sessions across five execution phases plus audit/closeout.
- Notable: the cheapest stable path was to stop chapter-body images from entering Cloudflare-managed storage at all, then harden that decision with tooling and docs instead of compensating with more infrastructure.

---

## Milestone: v1.2 - Cloudflare Account and Domain Switching

**Shipped:** 2026-07-29 | **Phases:** 5 | **Plans:** 97
**Closeout:** Override closeout; the selected-production Viewer terminal proof is deferred.

### What Was Built

- Added explicit non-secret TargetProfile resolution, four-file local env projection, and fail-closed target preflight.
- Made deploy, runtime, Pages redirect, and workflow inputs selected-target aware without treating local operator state as CI input.
- Established tuple-bound local and selected-production data-chain evidence through Dashboard, then reconciled the 30-row matrix against the canonical Phase 13 verifier.

### What Worked

- The explicit target and tuple contracts prevented a checkpoint from being represented as passed evidence.
- Phase 15 corrected the derived matrix rather than rewriting frozen Phase 13 evidence.

### What Was Inefficient

- Repeated Phase 13 carrier recovery became disproportionately expensive once external Viewer observation remained unavailable.
- Eight historical debug sessions and the Viewer checkpoint reached milestone close as accepted debt.

### Key Lessons

1. Cap full validation/replanning loops, then make the evidence boundary explicit in the closeout.
2. Treat production browser proof as a separately authorized resource, not an automatic continuation of local success.
3. Keep requirement checkboxes and summary metadata distinct from the current verifier state.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multiple | 5 | Moved from implementation evidence to verifier-backed milestone closure |
| v1.1 | multiple | 5 | Turned storage/cost policy into code, audit tooling, doc ownership, and shared semantics instead of one-off cleanup rules |
| v1.2 | multiple | 5 | Added target-aware deployment contracts and accepted a bounded production-Viewer evidence deferral rather than restarting frozen carriers |

### Cumulative Quality

| Milestone | Tests | Coverage | Notes |
|-----------|-------|----------|-------|
| v1.0 | Phase-specific unit, typecheck, UAT, security, validation checks | 5/5 phases verified | Remaining debt is metadata/security-artifact cleanup, not unsatisfied runtime requirements |
| v1.1 | Phase-specific unit, typecheck, audit, doc-contract, and milestone regression checks | 5/5 phases verified, 22/22 requirements satisfied | Milestone audit passed with no unsatisfied requirements |
| v1.2 | Target-profile, deployment-contract, smoke, matrix, and audit checks | 26/30 requirements verified; override closeout | DATA-05/06/07 and TEST-05 remain deferred Viewer-proof evidence |

### Top Lessons

1. Keep audit evidence structured from the start.
2. Archive only after all hard blockers are converted into either verified closure or explicit accepted debt.
3. When a policy decision matters operationally, mirror it in code, tests, runbook text, and milestone audit language at the same time.
