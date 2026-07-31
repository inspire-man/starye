---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: 后台爬虫任务与内容运维
current_phase: 18
current_phase_name: GitHub Actions Production Orchestration
status: planning
stopped_at: Phase 17 complete; --no-transition retained Phase 18 at planning
last_updated: "2026-07-31T10:48:18.923Z"
last_activity: 2026-07-31
last_activity_desc: Phase 17 complete; Phase 18 left at planning under --no-transition
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
  percent: 50
---

# Project State: Starye — 个人内容中台

**Last updated:** 2026-07-31
**Mode:** yolo
**Granularity:** standard

## Project Reference

**Core Value:** 部署在公网、能稳定日常使用的个人内容中台 —— "能用、不崩" 优先于 "功能全"。

**Current Milestone:** v1.3 后台爬虫任务与内容运维。以 D1 控制面连接本地 runner 与 GitHub Actions，验证视频/漫画 crawler 从后台任务到内容 CRUD 的完整链路。

**Project Docs:**

- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/ROADMAP.md` — v1.3 Phases 16-19 and requirement coverage
- `.planning/REQUIREMENTS.md` — v1.3 scoped and mapped requirements
- `.planning/MILESTONES.md` — shipped milestone summaries and archive links
- `.planning/research/SUMMARY.md` — v1.3 crawler control-plane research
- `.planning/codebase/ARCHITECTURE.md` — Brownfield system overview

## Current Position

Phase: 18 — GitHub Actions Production Orchestration
Plan: Not started
Status: Ready to plan
Last activity: 2026-07-31 — Phase 17 complete; Phase 18 left at planning under --no-transition

## Performance Metrics

**Phases completed:** 2 / 4
**Plans completed:** 7 / 7
**Plans in flight:** 0
**Phase repair invocations used:** 2 / per-phase budget 2

**Scoped human escalation:** The root user explicitly directed execution through Phase 13/MVP completion, authorized recommended choices/local control, and confirmed direct local actions need no further approval. Plan 13-23 remains the one-time evidence-backed snapshot-generator repair after the configured budget was exhausted. Plan 13-24 is immutable `blocked_after_launch` history. Plan 13-25 is a no-code current-source all-free retry that may operate only its newly started tree; it does not raise `workflow.node_repair_budget`, reopen historic evidence, or authorize any later code repair.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 14 P01 | 11m 8s | 2 tasks | 6 files |
| Phase 14 P06 | 13m 45s | 2 tasks | 2 files |
| Phase 14 P02 | 23m 9s | 3 tasks | 13 files |
| Phase 14 P03 | 9m | 3 tasks | 6 files |
| Phase 14 P04 | 22m | 3 tasks | 9 files |
| Phase 14 P05 | 16m 25s | 3 tasks | 15 files |
| Phase 14 P07 | 25m 51s | 3 tasks | 5 files |
| Phase 13 P63 | 4 min | 1 tasks | 1 files |
| Phase 15 P01 | 20 min | 3 tasks | 6 files |
| Phase 16-task-domain-foundation P03 | 29min | 3 tasks | 12 files |
| Phase 16 P04 | 16min | 2 tasks | 4 files |
| Phase 17-local-runner-vertical-slice P01 | 44m | 2 tasks | 22 files |
| Phase 17 P2 | resumed-after-capacity-failure | 2 tasks | 13 files |

## Accumulated Context

### Key Decisions (so far)

| Decision | Context | Made At |
|----------|---------|---------|
| 5-phase structure accepted as proposed by research | Dependency chain (P1 session → P2 gating → P4 progress) + risk ordering (top pitfalls knocked out early) | 2026-05-11 roadmap creation |
| v1 total count corrected 41 → 45 | Actual sum across categories is 45, REQUIREMENTS.md header had arithmetic typo | 2026-05-11 roadmap creation |
| Phase 6 (crawler reliability) deferred to v2 | Not blocking "能用" — 现有内容库短期不新抓也能看 | 2026-05-11 roadmap creation |
| v1.1 keeps comic chapter body images as source URLs | Cloudflare free-tier cost control matters more than owning every chapter image; R2 is reserved for necessary assets | 2026-07-11 milestone creation |
| v1.1 forbids default Worker/Pages Function image proxying | Proxying chapter images shifts cost from R2 storage to Workers requests/CPU | 2026-07-11 milestone creation |
| Phase 06 P01 | 6 min | 2 tasks | 2 files |
| Phase 06 P02 | 4 min | 2 tasks | 2 files |
| Phase 06 P03 | 15 min | 3 tasks | 7 files |
| Phase 11 P01 | 42min | 3 tasks | 11 files |
| Phase 11 P02 | 20min | 2 tasks | 5 files |
| Phase 12 P02 | 11h 16m | 3 tasks | 57 files |
| Phase 13 P05 | 22min | 2 tasks | 8 files |
| Phase 13 P06 | 27min | 2 tasks | 7 files |
| Phase 13 P07 | 1h 30m | 3 tasks | 8 files |
| Phase 13 P11 | 20min | 3 tasks | 8 files |
| Phase 13 P13 | 49min | 2 tasks | 7 files |
| Phase 13 P14 | 1h 27m | 2 tasks | 6 files |
| Phase 13 P15 | 2h 40m | 3 tasks | 6 files |

### Open Todos (carried across phases)

- [ ] P1 kick-off: audit `apps/gateway/src/cache-middleware.ts` 现状（`/api/auth/*` bypass / `Set-Cookie` bypass / private scope cache key 构造）
- [x] P3 kick-off: 确认 `xgplayer` error 事件结构，并据此选择保守的同源重试实现路径
- [x] P4 kick-off: 定下视频进度粒度（统一按 int seconds / int page 持久化；movie 完成阈值 90%，小于 30s 不记）
- [ ] P2 decision: 成人内容 `is_adult` ingest-time（爬虫自动）vs 手动（dashboard UI） —— 本轮需求已锁定爬虫自动（ACCESS-06），待 P2 实际落地时核验源站标签覆盖率
- [x] P8 kick-off: 已拆成 08-01 / 08-02 / 08-03 plans，锁定 API upload、crawler purpose guard、audit/runbook 三条执行线
- [x] P9 kick-off: 已拆成 09-01 / 09-02 / 09-03 plans，锁定 root entry docs、archive split、RUNBOOK owner 三条执行线
- [x] P9 closeout: root docs 收缩、`docs/archive/` 建立、RUNBOOK/STRUCTURE owner 边界与 verification 已全部落盘

### Deferred Verification

- [ ] Provider-backed D1/API/admin proof for one exact selected-production tuple is deferred to MVP review or archival work.
- [ ] Selected-production Dashboard/viewer receipts and terminal remote verification are deferred to MVP review or archival work.

### Recent Context (Brownfield注释)

- Git log 显示近期进展：`fdd6a4e` gateway cache invalidation + monitoring、`0121cc9` dashboard SillyTavern 入口、`4cefbe6` movie-app advance search / recommendation / new release
- `.planning/codebase/CONCERNS.md` 标注的问题区将在对应 phase 被收口：SQL injection 风险点（P2/P4 涉及写入路径时审）、deprecated serviceAuth（P2 审）、缓存复杂度（P1 审）、localStorage 凭据（P1 审）、migration 测试缺失（P5 处理）
- Phase 3 已完成文档收敛、Player 统一错误卡片 / waiting 超时 / 同源重试、MovieDetail 离线按钮反馈、5/5 人工播放 UAT，以及安全审查；本轮补上了 `streamUrl` 直达播放的授权/来源校验，`pnpm --filter @starye/movie-app exec vue-tsc --noEmit` 与 `pnpm --filter @starye/movie-app test --run` 已通过
- Phase 4 已完成代码实现、12/12 human UAT 与 `04-SECURITY.md`，本轮已把 ROADMAP 状态同步为 complete
- Phase 5 已完成实现落盘，并通过 `05-UAT.md` / `05-HUMAN-UAT.md`（10/10 pass）、`05-SECURITY.md`（`threats_open: 0`）与 `05-VERIFICATION.md`（`status: passed`）收口
- Phase 8 已完成 manual upload purpose contract、crawler purpose/namespace guard、`audit-r2-storage` hard-failure/cleanup-blocked contract 和 RUNBOOK R2 成本护栏章节；targeted API/dashboard/crawler/audit checks 全部通过
- Phase 9 已完成 root docs 收缩、`docs/documentation-ownership.md`、`docs/archive/`、`09-01..03-SUMMARY.md` 与 `09-VERIFICATION.md`，文档 owner 和 evidence/archive 边界已收口
- Phase 10 已完成 shared storage helper 收口、upload/crawler/admin adoption、legacy script policy-aware 文案修正，以及 `10-VERIFICATION.md` 记录的全部 targeted regressions / typechecks
- Phase 11 Plan 02 已完成四个既有 local env consumer 的显式 target projection、marker-aware managed block 更新和 preservation tests；未直接写入任何 local env 文件或 runtime consumer
- Phase 11 Plan 03 已完成 fail-closed target preflight、local Wrangler/CI identity boundary、argv-only D1/R2/KV read checks 与 import-safe `target-profile` CLI；未改 Worker/Pages/GitHub workflow consumer，也未执行带凭据的远程命令

### Roadmap Evolution

- Phase 15 added: Reconcile v1.2 evidence matrix with Phase 13 closeout
- Phase 16-19 added: v1.3 crawler task control plane, local runner, GitHub Actions orchestration, and end-to-end operations proof

## Deferred Items

Items acknowledged and deferred at v1.2 milestone close on 2026-07-29:

| Category | Item | Status |
|----------|------|--------|
| debug | deploy-api-remote-resource-check | diagnosed |
| debug | knowledge-base | unknown |
| debug | phase13-gateway-auth-readiness | awaiting_human_verify |
| debug | phase13-gateway-auth-timeout | diagnosed |
| debug | phase13-legacy-parent-missing | investigating |
| debug | phase13-orphaned-listener-owners | investigating |
| debug | phase13-runtime-ownership | diagnosed |
| debug | phase13-supervisor-not-found | investigating |
| verification_gap | Phase 13 13-VERIFICATION.md | gaps_found |

## Session Continuity

**Last session:** 2026-07-31T10:48:18.923Z
**Stopped at:** Phase 17 complete; --no-transition retained Phase 18 at planning
**Resume file:** None

**Next recommended action:** Start Phase 18 planning when requested; Phase 17 local evidence and Gateway CRUD proof are complete.

**If interrupted, resume by:**

1. Read Phase 17 `17-VERIFICATION.md` and `.target-runs/phase17-local-e2e/evidence.json` for the completed local proof.
2. Use `$gsd-discuss-phase 18` or `$gsd-plan-phase 18` to begin the next phase when requested.

**Worktree:** `D:\my-workspace\starye`
**Branch:** `main`

---
*State updated: 2026-07-30 after Phase 16 planning completion*

## Operator Next Steps

- Run `$gsd-discuss-phase 16` or `$gsd-plan-phase 16`

## Decisions

- [Phase 06]: R2 policy is frozen into standard allowed, restricted allowed, short-term allowed, historical risk, and forbidden classes. — Locked by 06-01 storage policy
- [Phase 06]: system/ and ops/d1-backups/ remain discovered unlisted prefixes until a later operations classification phase. — Locked by 06-01 storage policy
- [Phase 06]: sourceImageUrl or externalImageUrl identify source URLs, while r2Key plus r2Url identify R2-backed assets; historical image_url and images: string[] names remain but their semantics are locked. — Locked by 06-01 storage policy
- [Phase 06]: runtime inventory evidence and historical-doc baselines stay in separate artifacts so later cleanup phases do not treat stale docs as live storage truth. — Locked by 06-02 evidence split
- [Phase 06]: audit tooling for this milestone remains read-only; any future delete/lifecycle action still requires a fresh credentialed dry-run plus separate verification. — Locked by 06-03 verification work order
- [Phase 06]: Audit script stays read-only and uses AWS S3-compatible list operations for inventory. — Locked by 06-03 storage audit implementation
- [Phase 06]: Dry-run report artifacts ship as contract templates until a credentialed live run overwrites counts and timestamps. — Locked by 06-03 report contract delivery
- [Phase 06]: comics/<slug> and comics/<slug>/<chapter> remain separate audit rows to protect cover assets from chapter-body cleanup decisions. — Locked by 06-03 prefix separation requirement
- [Phase 07]: Comic chapter body images remain source/external URLs end-to-end; they never enter `ImageProcessor.process()` or default R2 upload paths. — Locked by 07-01 crawler boundary
- [Phase 07]: Comic covers keep a separate explicit opt-in upload path via `UPLOAD_COMIC_COVERS_TO_R2`; default behavior preserves source cover URLs. — Locked by 07-01 cover gate
- [Phase 07]: Public chapter API returns `pages.imageUrl` in page order without host rewrite, while `/check` stays cheap/local and `/:id/integrity` is the explicit read-only probe. — Locked by 07-02 API contract split
- [Phase 07]: Reader may only persist `completed=true` when at least one page loaded successfully and the reader reached the final page. — Locked by 07-03 progress safety rule
- [Phase 08]: Manual uploads use a small purpose vocabulary (`cover`, `avatar`, `logo`, `blog_inline`, `manual_asset`, `fallback`, `temp`) and internal prefixes remain non-uploadable. — Locked by 08-01 plan contract
- [Phase 08]: Crawler and legacy scripts must declare `cover` / `avatar` / `logo` explicitly, and chapter-page targets are rejected at the upload boundary. — Locked by 08-02 plan contract
- [Phase 08]: Cost audit hard-fails on forbidden/growth prefixes or incomplete DB reference evidence, and Budget Alerts stay `$1/$3` notify-only. — Locked by 08-03 operations contract
- [Phase 09]: Root doc ownership is fixed as `README.md` for human entry, `AGENTS.md` for agent rules, `RUNBOOK.md` for operations, `.planning/*` for active execution truth, `docs/` for stable topic docs, and `openspec/` for spec history. — Locked by Phase 9 planning
- [Phase 09]: `AGENTS.md` remains the only canonical agent doc, while `CLAUDE.md` must shrink to a thin compatibility adapter. — Locked by 09-02 plan
- [Phase 09]: Historical or superseded live docs move to `docs/archive/`, while v1.0 evidence remains under `.planning/milestones/...`. — Locked by 09-02 / 09-03 plans
- [Phase 09]: Long-term storage policy, cleanup, rollback, and accidental-upload ownership belongs to `RUNBOOK.md`; Phase 6/8 docs remain historical snapshots or verification evidence. — Locked by 09-03 plan
- [Phase 11]: Target profiles are complete non-secret identities; starye-org maps local Wrangler and CI identity explicitly.
- [Phase 11]: Selected target IDs are explicit-only: whitespace is normalized, while defaults and legacy aliases fail closed.
- [Phase 11]: Local env projection covers exactly API, gateway, root, and crawler final consumer files; browser public API URLs use the Gateway canonical local entry.
- [Phase 11]: Marker-aware updates own only named target-managed keys; user-managed secret values are never projected or removed.
- [Phase 11]: Local preflight requires the explicit starye-org Wrangler profile and rejects CLOUDFLARE_API_TOKEN shadowing; CI/remote preflight requires the mapped starye-org environment.
- [Phase 11]: Remote high-risk commands require credential key names plus injected argv-only D1/R2/KV read checks; the Phase 11 CLI never owns deploy or workflow mutation.
- [Phase 12]: Public browser values are a typed allowlist; Pages, Worker, account, and resource identity remain deploy-only projections.
- [Phase 12]: CI/remote preparation is explicit-target only and does not read local operator files; local deployment has its own Wrangler-profile/read-only gate.
- [Phase 12]: Direct remote mutation uses a closed registry, fresh child environment, and run-scoped prepared context rather than ambient target identity or caller argv.
- [Phase 12]: Browser runtime values use a closed typed allowlist; Vite reads only generated selected-target dotenv through audited entry adapters.
- [Phase 12]: GitHub mutation workflows resolve an explicit target to its mapped Environment, then use one CI preparation gate and closed generated outputs rather than inline remote identity. — Locked by 12-03 workflow contract
- [Phase 13]: Phase 13 accepts exactly one target/run-derived primary code and one successful D1 row; no sibling or batch compatibility remains. — Restores the canonical 13-02 contract and closes verified G-01 drift.
- [Phase 13]: The shared ApiClient.syncMovie transport remains unchanged; the bounded adapter supplies one validated fixture through it. — GitNexus reported HIGH impact on the general crawler transport, so scope remains at the smoke adapter.
- [Phase 13]: Prepared smoke child output is valid only when its code equals the target/run-derived primary code and its count is one. — 13-06 one-item prepared observation contract
- [Phase 13]: Read-only D1 snapshots query one prepared code and accept exactly one non-R18 movie with one active player. — 13-06 fixed snapshot parser
- [Phase 13]: Local and remote smoke runners turn count, code, or id mismatches into non-success checkpoint evidence before API or browser proof. — 13-06 orchestration gate
- [Phase 13]: Terminal evidence rows require source-specific allowlisted receipts bound to the exact mode/target/run/code/id/surface tuple. — Prevents self-attested or mismatched evidence from becoming terminal proof.
- [Phase 13]: The controlled observer derives pending tuples, waits for SPA settlement, and persists browser or target-base failures as checkpoints. — Keeps browser evidence independently observed and fail-closed.
- [Phase 13]: Smoke artifact verification is execution-free by default; runner exit consistency applies only when a run dependency is explicitly injected. — Prevents verification from overwriting the artifact under inspection.
- [Phase 13]: CLI and local smoke reuse pickRuntimeEnvironment for caller-side sanitation while direct raw-token preflight remains fail closed. — 13-11 local caller parity contract
- [Phase 13]: Local preflight checkpoints persist only projection-mismatch or local-api-token-shadowing; every other issue stays target_projection_unmet. — 13-11 closed diagnostic vocabulary
- [Phase 13]: Canonical readiness is fixed Gateway HTTP, not listener diagnostics or direct ports. — D-03 and D-06 require a closed canonical readiness contract.
- [Phase 13]: Gateway auth authorizes downstream work only with a closed accepted probe result. — The default transport must remain bounded and non-secret.
- [Phase 13]: Handoff resolves a tracked target before lazy path/evidence loading, and root scripts preserve run/verify 0/1/2 while handoff is binary. — Locked by 13-14 handoff contract.
- [Phase 13]: Gateway auth failures persist as four closed non-secret checkpoint codes while gateway_auth_unavailable remains valid. — Task 2 preserves historical evidence while making new observations diagnosable without transport detail.
- [Phase 13]: Timeout process proof keeps evidence peers in memory and asserts raw child exit 2 before the outer deadline. — Task 3 isolates lifecycle proof from services, evidence roots, and remote providers.
- [Phase 14]: Pages direct origins and canonical Gateway destinations now resolve only from TargetProfile metadata.
- [Phase 14]: Pages redirect templates are closed by surface and reject caller-supplied hosts before rendering.
- [Phase ?]: Phase 14: RUNBOOK uses explicit target selection and metadata-only secret guidance; only passed completes smoke while failed/checkpoint preserve evidence and require a new run.
- [Phase ?]: Pages redirect inputs are profile-validated, exact run-scoped files; callers cannot supply origins.
- [Phase ?]: Prepared Pages output carries only a fixed redirect-input path and no secret values.
- [Phase ?]: Local Pages builds write closed dist redirects atomically only after both builds succeed and clear stale output on failure.
- [Phase ?]: All Pages workflows pass pages_redirect_input_path from one prepare step and clean it with always semantics.
- [Phase ?]: Workflow inventory rejects redirect input outside Pages while preserving existing target and public-env boundaries.
- [Phase ?]: Phase 14 P04: 旧域名审计采用精确路径加片段加理由的允许项，拒绝目录、glob、正则和基线。
- [Phase ?]: Phase 14 P04: check:legacy-domain 无参数、只读且只枚举 Git 跟踪的活动输入。
- [Phase ?]: Phase 14 P04: 活动示例和 E2E fixture 改用 fixture.invalid 与 .test，不保留默认 target 域名。
- [Phase ?]: Phase 14 P05: Ordinary default-target test URLs resolve from explicit starye-org fixtures; raw literals remain only for named schema metadata and fail-closed aliases.
- [Phase ?]: Phase 14 P07: Canonical JSON evidence matrix preserves Phase 13 blocked and partial truth; derived Markdown and fixed local CLI are deterministic and read-only.
- [Phase 13]: 13-63 在分配前冻结：IAB observeSurface 不可用且未配置 cookie-backed observer。 — 计划禁止默认观察器和无适配器的 run-id 分配。
- [Phase ?]: Phase 15 maps canonical Phase 13 SATISFIED, PARTIAL, and FAILED/CHECKPOINT labels to verified, partial, and blocked while preserving raw source wording.
- [Phase ?]: Phase 15 completes one local reconciliation round; a second round is manual, at most once, and requires a new run-bound terminal Phase 13 artifact.
- [Phase ?]: Runner callbacks use separate HMAC bindings and never reuse CRAWLER_SECRET.
- [Phase ?]: Identical event replay returns a stored outcome; changed event ID or nonce bindings conflict before lifecycle mutation.
- [Phase ?]: Daily log retention delegates only to repository detailed-log expiry cleanup.
- [Phase ?]: Runner poll is read-only and signed claims replay only actual post-CAS outcomes.
- [Phase ?]: Local runner allows one active run and observes cancellation only at heartbeat checkpoints.

### Blockers

- Phase 13 Plan 13-63: blocked_without_observation_adapter; no p13-63 run id was created.
