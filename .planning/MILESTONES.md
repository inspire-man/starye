# Project Milestones: Starye

## v1.3 后台爬虫任务与内容运维 (Shipped: 2026-08-04)

**Closeout:** `override_closeout`.

**Verification:** 18/18 requirements, 4/4 phases, 4/4 integration flows, and 4/4 end-to-end flows passed.

**Known verification overrides:** 8 historical artifact-audit items acknowledged and recorded in `STATE.md` under `## Deferred Items`.

**Known technical debt:** Production receipt-backed `SUN-064` currently has `players=0`; unrelated `@starye/config` CI lint baseline remains open. Both are non-causal to the Phase 19 metadata CRUD sign-off.

**Key accomplishments:**

- Delivered a D1-backed crawler task control plane with closed lifecycle transitions, leases, immutable retry history, and bounded audit-safe logs.
- Delivered signed API-owned polling/claim and a one-active-run local movie/manga runner with validated receipts and existing-editor handoff.
- Delivered server-owned GitHub Actions provider snapshots, scoped GitHub App authentication, signed callbacks, cancellation/retry, reconciliation, and fixed prepared entries.
- Delivered Dashboard task history/detail/log operations, confirmation-gated cancellation/retry, local/production evidence contracts, and canonical RUNBOOK operations.
- Completed one credentialed production tuple: task `4af1519d-f12b-4418-8bba-1c2536ee3e2b`, D1 run `9ef31b31-f66a-4e11-927e-c890edbdf209`, provider run `30890327381`, receipt-backed `SUN-064` metadata CRUD readback/restore.

**Archives:**

- [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)
- [v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md)
- [v1.3-phases/](milestones/v1.3-phases/)

---

## v1.2 Cloudflare account and domain switching with deferred Viewer proof (Shipped: 2026-07-29)

**Closeout:** `override_closeout`. The user accepted 9 known deferred items;
see `STATE.md` under `## Deferred Items`.

**Verification override:** The archive does not assert selected-production
Viewer success. DATA-05, DATA-07, and TEST-05 are partial; DATA-06 is blocked
at `canonical_viewer_unavailable`.

**Phases completed:** 5 phases, 97 plans, 71 tasks

**Key accomplishments:**

- A strict Valibot-backed `starye-org` deployment profile and explicit resolver now provide one non-secret target identity without defaults, aliases, or resource overlays.
- A resolved non-secret deployment target now projects deterministically into the four existing local env consumers, while marker-aware updates preserve every operator-managed secret and unrelated line.
- Explicit target preflight now blocks local/CI identity mixing and remote high-risk commands until the selected Cloudflare target, credential metadata, and read-only resource checks agree.
- Managed env updates now reject ambiguous marker text, preflight proves the complete selected local projection, and live-check errors identify only non-secret target resources.
- Selected TargetProfile now drives typed public/deploy/workflow projections, run-scoped Wrangler inputs, and fail-closed local, CI, and remote mutation gates without Cloudflare remote execution.
- Selected Cloudflare target projection now controls API/Gateway trust and every current Nuxt/Vite browser runtime consumer through a typed, credential-free public allowlist.
- All listed GitHub mutation workflows now follow one static selected-target contract without invoking Cloudflare, D1, R2, crawler, migration, deploy, or rollback operations.
- DB and crawler package/source entry points now require an explicit selected-target handoff or fail before loading ambient database, crawler, API, R2, or dotenv identity. No remote operation ran.
- The selected local target is projection-clean, and later smoke runners now receive a deterministic, redacted evidence contract that cannot turn blocked browser or provider work into a passed result.
- The selected-target prepared-entry seam now permits exactly one deterministic service-auth fixture upsert and one read-only D1 snapshot, with no free-form command, target, SQL, endpoint, output-path, or secret-bearing evidence channel.
- The local smoke commands and typed evidence contract are implemented and tested. The real local run stopped truthfully before any ingest because canonical local `validate` preflight found missing user-managed secret presence prerequisites.
- Remote smoke now fails closed on one explicit terminal local evidence pair, and the current exact run truthfully persists a pre-ingest checkpoint before any provider or data mutation path.
- 恢复以 target/run 为唯一来源的单条 non-R18 fixture、单次 service-auth upsert 与单行 D1 证据契约。
- Prepared fixture, read-only D1 snapshot, and local/remote runners now require one matching target/run code, one id, and count-one evidence before API observation.
- Tuple-bound runner, provider, and browser receipts now make terminal smoke evidence independently auditable without exposing secrets or allowing operator-supplied pass claims.
- Attempt D established terminal local proof. After Clash TUN restored Node/workerd reachability, Attempt E independently repeated that terminal local chain, but its matching selected-target run still stopped at `remote_preflight/target_preflight_unmet`; the official live preflight isolated failed read-only checks for R2 `starye-media` and Worker `starye-gateway`.
- The selected-target read-only preflight passed, but the one authorized fresh smoke invocation stopped at a local pre-ingest projection checkpoint; the run remains local-only and Phase 13 production-chain proof is still absent.
- The official local gates passed before run allocation, but the single authorized smoke attempt persisted a local-projection checkpoint, so browser and selected-production proof remain correctly blocked.
- CLI 与 smoke runner 现在共用同一 caller-side 环境清洗边界，并以封闭 checkpoint code 精确区分 projection drift 与本地 token shadowing。
- 全部修复门禁在分配 run 前通过，但唯一授权的 local attempt 永久停在 Gateway auth checkpoint，因此没有 pending tuple，也没有浏览器或 selected-production 证明。
- A ten-second fixed-origin Gateway readiness contract now rejects no-header listeners and prevents local smoke from trusting human listener text.
- A target-first, fixed-root handoff core now reserves each attempt atomically and gives root scripts explicit raw-versus-binary exit semantics.
- Gateway auth failure evidence now keeps four bounded non-secret causes through runner output, with a process-level proof that the timeout checkpoint persists entirely in memory and exits raw 2 well before the outer deadline.
- The fixed-port ownership gate stopped before runtime mutation because the required listener set was a nonempty proper subset, so no canonical Gateway readiness or downstream smoke eligibility was established.
- 1. [User-directed MVP scope] Reduced checkpoints and full test coverage
- 1. [User-directed lifecycle correction] Used 13-28 as the release source
- The atomic local-dev supervisor is tested, but the single read-only legacy-tree snapshot had an incomplete parent chain, so runtime eligibility is closed before any teardown or launch.
- A tested, import-safe evaluator preserved the no-mutation boundary because the live snapshot did not uniquely match a current-workspace `scripts/local-dev.ts` supervisor.
- The generator repair is covered by deterministic tests, but the sole permitted read-only snapshot did not identify a current-workspace supervisor, so no lifecycle action is authorized.
- One new task-owned launcher exited before a current-workspace local-dev supervisor could be attributed, so runtime eligibility is closed without targeting any process.
- A fresh all-free retry started one root launcher, but it exited before an absolute current-workspace `scripts/local-dev.ts` supervisor could be attributed; the task closed without targeting any PID.
- A root `pnpm.cmd dev` attempt left no recordable `local-dev-entry.ts` anchor, so the lifecycle closed without touching any external process.
- The root launcher regression and local target gates passed, but Gateway readiness rejected `/auth/`, so the plan stopped before allocating any p13-48 run or evidence.
- One new p13-49 local handoff reached a receipt-backed pending pair, but the sole repository-owned Dashboard observation checkpointed before Viewer observation, so this exact run is fixed without a terminal local claim.
- A fresh local Gateway data-chain run reached the repository-owned Dashboard observer, which persisted the terminal `dashboard_auth_unavailable` checkpoint for the exact p13-50 tuple.
- Repaired the shared Dashboard observation path so signed-session default observation and exact-tuple adapters are honest, without allocating any new smoke run.
- Fresh p13-52 local handoff reached a pending pair, but the sole repository-owned Dashboard observation checkpointed at `dashboard_auth_unavailable` because no signed local session cookie was available to the repaired default observer.
- Operator authorized the sole p13-55 remote handoff, but selected-production live preflight failed on Cloudflare authentication before any remote handoff was started. No remote pending pair was created.
- Fresh p13-55 local handoff reached an unobserved pending pair, then ordered Dashboard→Viewer observation through the already signed-in Codex in-app Browser produced local terminal_passed with provesExternalChain true.
- A fresh p13-60 local handoff produced one receipt-backed pending pair, then stopped before Dashboard observation because the signed Codex IAB adapter was unavailable in this execution environment.
- The new p13-63 carrier was intentionally never allocated because neither permitted signed local observation adapter was callable.
- One explicitly authorized p13-66 remote handoff passed nested selected-target preflight and created a verified pending tuple with a non-empty remote itemId.
- The root IAB proved the selected-production signed Movies surface and exact p13-66 Dashboard tuple, then froze the run when the first canonical Viewer observation returned `canonical_viewer_unavailable`.
- One qualified root-IAB local handoff reached its first immutable Dashboard checkpoint, with no Viewer or external follow-up.
- Dashboard and Viewer code markers now publish the same non-secret code/id tuple, and root-IAB receives fixed repository-owned names for reading it.
- Selected TargetProfile metadata now owns five direct Pages origins, and a strict pure renderer emits their canonical Gateway redirects without accepting caller-supplied hosts.
- Selected-target Pages redirects now move through validated run-scoped inputs and become a closed dist artifact only after successful local builds.
- All five Pages deployment workflows now build from and clean the selected-target redirect input produced by their single CI preparation step.
- A deterministic, tracked-file-only fixed-literal gate now rejects undocumented `starye.org` use while preserving only explicit target-profile, alias-deny-list, and named test-fixture records.
- Resolved `starye-org` profile fixtures now supply ordinary config and Gateway test URLs, leaving only 26 exact, explained legacy-domain audit allowances.
- RUNBOOK now selects an explicit TargetProfile before local projection, operator mutation, smoke, and bounded recovery, with a metadata-only secret matrix guarded by Vitest.
- Canonical 30-row v1.2 evidence JSON and its deterministic Markdown projection now validate locally without promoting Phase 13 blocked or partial outcomes.
- Typed reconciliation now derives the 30-row v1.2 matrix from Phase 13's current raw verifier labels while retaining the frozen Viewer checkpoint and a bounded local-only handoff.

---

## v1.1 存储成本控制与代码/文件整理 (Shipped: 2026-07-13)

**Delivered:** A free-tier-first storage cleanup milestone that locked the R2/storage policy boundary, moved comic chapter body images to external/source URLs, enforced upload-purpose guardrails, tightened documentation ownership, and consolidated storage semantics across API, crawler, admin, and legacy scripts.

**Phases completed:** 6-10 (15 plans total)

**Key accomplishments:**

- Established a read-only R2 audit toolkit with fixed Markdown/JSON/CSV report contracts, explicit no-delete verification gates, and runtime-vs-historical storage evidence separation.
- Removed comic chapter body images from the default R2 path while preserving public API readability, explicit admin integrity probes, and Reader failure-safe UX.
- Enforced upload-purpose and crawler namespace guardrails so chapter-page assets cannot silently slip back into managed R2 storage.
- Shrunk root docs into canonical entrypoints, formalized documentation ownership, and archived superseded storage docs without losing milestone evidence.
- Consolidated shared storage semantics so upload routes, crawler image processing, admin pending heuristics, and operator-facing scripts all agree on managed-vs-external asset rules.

**Stats:**

- 5 phases
- 15 plans
- 22 v1 requirements mapped
- 5/5 phases verified
- 0 unsatisfied requirements in final audit

**Audit result:**

- `status: passed` in [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

**Archives:**

- [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
- [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

**What's next:** Start the next milestone with `$gsd-new-milestone`.

---

## v1.0 部署可用、日常使用态 (Shipped: 2026-07-11)

**Delivered:** A production-ready personal content platform with unified auth, access hardening, stable playback recovery, unified progress tracking, and deploy/rollback/observability operations.

**Phases completed:** 1-5 (24 plans total)

**Key accomplishments:**

- Unified cross-app auth/session behavior across gateway, API, dashboard, movie, comic, blog, and auth surfaces.
- Hardened public exposure with dashboard/admin gates, R18 server-side filtering, robots/noindex controls, docs auth, WAF runbook coverage, and pages.dev redirects.
- Stabilized movie playback with visible error cards, same-source retry, offline Aria2/TorrServer feedback, and Sentry video failure telemetry.
- Added a unified `progress` model for movie watching and comic reading restore/save/completion semantics.
- Established deploy, rollback, migration backup, destructive migration review, Sentry, and RUNBOOK operations for day-to-day production use.

**Stats:**

- 5 phases
- 24 plans
- 41 v1 requirements mapped
- 5/5 phases verified
- 0 unsatisfied requirements in final audit

**Known tech debt accepted at closeout:**

- Phase 1 has no retroactive `01-SECURITY.md` artifact.
- Some older Phase 1/2 summary frontmatter and traceability rows lag behind verification evidence.
- The next real `deploy-migrations.yml` run should reconfirm the R2 backup object path recorded in Phase 5.

**Archives:**

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

**What's next:** Start the next milestone with `$gsd-new-milestone`.

---
