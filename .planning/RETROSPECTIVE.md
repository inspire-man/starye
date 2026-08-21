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

## Milestone: v1.3 - 后台爬虫任务与内容运维

**Shipped:** 2026-08-04 | **Phases:** 4 | **Plans:** 19
**Closeout:** Override closeout; eight historical artifact-audit items were acknowledged and two non-blocking technical-debt observations were retained.

### What Was Built

- D1-backed crawler task/run/attempt/log/lease control plane with closed lifecycle transitions, leases, immutable retries, and bounded audit logs.
- Signed API-owned poll/claim and local one-active-run movie/manga runner with validated receipts and existing content-editor handoff.
- Server-owned GitHub Actions provider snapshots, scoped GitHub App authentication, signed callbacks, provider reconciliation, cancellation/retry, and fixed prepared entries.
- Dashboard task history/detail/log operations, confirmation-gated cancellation/retry, local/production evidence contracts, canonical RUNBOOK operations, and one credentialed production tuple.

### What Worked

- Keeping D1 as the sole auditable task/run source let local runner and GitHub Actions share lifecycle, receipt, and retry semantics.
- Separating local contract evidence from credentialed provider evidence preserved the production sign-off boundary.
- Reusing the existing content editor made receipt-backed CRUD proof concrete without introducing a parallel management surface.

### What Was Inefficient

- The generated archive needed a manual pass to compress the live roadmap and normalize accomplishments, state, project context, and retrospective together.
- Historical debug sessions from the v1.2 close remained open in the artifact audit and required explicit deferred-item acknowledgement again at v1.3 close.
- The production tuple passed metadata CRUD while `SUN-064 players=0` required a separate player-availability follow-up observation.

### Patterns Established

- Production crawler success is a tuple-bound chain: D1 task/run/attempt, provider run, signed lifecycle, validated receipt, and existing-editor CRUD readback/restore.
- Dashboard cancellation remains a confirmed `cancel_requested` fact and retry creates a new attempt while preserving prior history.
- Evidence artifacts carry explicit mode separation and only expose redacted provider, receipt, callback, and credential metadata.

### Key Lessons

1. Treat provider dispatch acceptance as an intermediate fact; only signed terminal events plus a validated non-empty receipt can close a run.
2. Keep production player availability separate from metadata CRUD sign-off so one observation does not rewrite an otherwise valid tuple.
3. Run the artifact audit before closeout and record accepted historical items in STATE.md with a clear closeout type.

### Cost Observations

- Model mix: not tracked.
- Sessions: multiple GSD workflow sessions across four execution phases plus production proof and closeout.
- Notable: fixed templates, shared control-plane contracts, and evidence builders kept the production proof bounded while avoiding a second editor.

## Milestone: v1.4 - 播放可用性与生产自愈闭环

**Shipped:** 2026-08-10 | **Phases:** 5 | **Plans:** 23
**Closeout:** Override closeout; archive backfilled on 2026-08-21 after v1.5 kickoff. All 12 requirements and phase-level verification passed; global artifact-audit follow-ups remain outside v1.4 scope.

### What Was Built

- Source readiness and receipt boundaries that keep metadata persisted, source health, repair state, and actual playback independent, including an honest `SUN-064 players=0` disposition.
- A canonical Gateway local `repair_players` vertical slice with server-owned operation snapshots, signed observations, revision CAS, bounded receipts, and same-movie readback.
- Dashboard, MovieDetail, and Player state closure with eligibility-aware source routing, bounded retries/fallbacks, confirmation-gated repair, polling, and redacted task details.
- GitHub Actions production repair and reconciliation with fixed provider bindings, signed callbacks, lease/attempt history, retries, receipt validation, and current-attempt projections.
- Fresh tuple-bound Dashboard → Viewer → playback evidence with D1 persistence, redacted media events, visible Play, positive `currentTime` progress, and 15/15 UAT.

### What Worked

- Keeping metadata, transport/source health, repair execution, receipts, and playback as separate facts prevented provider or metadata success from becoming a playback claim.
- Reusing the v1.3 D1 task/run/attempt/lease/provider control plane allowed local and production repair to share idempotency, CAS, signed callbacks, and bounded history.
- Making the fresh production tuple explicit preserved the distinction between fixture contract coverage and real Dashboard/Viewer/playback acceptance.

### What Was Inefficient

- The milestone archive was not created before v1.5 kickoff, so the closeout required a history-aware backfill instead of the ordinary current-milestone command.
- The global artifact audit still contains historical and current debug sessions, which makes closeout reporting broader than the v1.4 runtime scope.
- Production playback proof required several separate evidence layers and careful fail-closed boundaries before the final fresh tuple could be accepted.

### Patterns Established

- Availability state is projection from bounded, revision-bound observations and authoritative readback; no runner, HTTP, fixture, or metadata shortcut promotes content availability.
- Repair commands are server-owned, idempotent, CAS-protected, and receipt-backed; late or stale callbacks remain history rather than overwriting the current projection.
- Actual playback proof requires visible user play, allowlisted media events, and positive progress for the active media instance.

### Key Lessons

1. Archive a completed milestone before starting the next one, or preserve the completed roadmap and requirements snapshot at kickoff.
2. Keep global debug debt explicitly separated from milestone requirement gaps so a closeout remains honest and actionable.
3. Treat Dashboard, D1, provider, content readback, Viewer, and playback as independent evidence layers and require tuple equality across them.

### Cost Observations

- Model mix: not tracked.
- Sessions: multiple GSD workflow sessions across five execution phases, production repair, playback proof, and archive backfill.
- Notable: shared control-plane contracts and artifact-first evidence kept the production proof bounded without creating a second scheduler or content editor.

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multiple | 5 | Moved from implementation evidence to verifier-backed milestone closure |
| v1.1 | multiple | 5 | Turned storage/cost policy into code, audit tooling, doc ownership, and shared semantics instead of one-off cleanup rules |
| v1.2 | multiple | 5 | Added target-aware deployment contracts and accepted a bounded production-Viewer evidence deferral rather than restarting frozen carriers |
| v1.4 | multiple | 5 | Split source readiness, repair, reconciliation, and actual playback into tuple-bound facts and completed a fresh production proof |

### Cumulative Quality

| Milestone | Tests | Coverage | Notes |
|-----------|-------|----------|-------|
| v1.0 | Phase-specific unit, typecheck, UAT, security, validation checks | 5/5 phases verified | Remaining debt is metadata/security-artifact cleanup, not unsatisfied runtime requirements |
| v1.1 | Phase-specific unit, typecheck, audit, doc-contract, and milestone regression checks | 5/5 phases verified, 22/22 requirements satisfied | Milestone audit passed with no unsatisfied requirements |
| v1.2 | Target-profile, deployment-contract, smoke, matrix, and audit checks | 26/30 requirements verified; override closeout | DATA-05/06/07 and TEST-05 remain deferred Viewer-proof evidence |
| v1.4 | Source contract, repair lifecycle, Dashboard/Player, Actions reconciliation, Gateway, and playback-evidence checks | 5/5 phases verified, 12/12 requirements satisfied | Global debug audit items and unrelated config lint remain deferred outside milestone requirements |

### Top Lessons

1. Keep audit evidence structured from the start.
2. Archive only after all hard blockers are converted into either verified closure or explicit accepted debt.
3. When a policy decision matters operationally, mirror it in code, tests, runbook text, and milestone audit language at the same time.
