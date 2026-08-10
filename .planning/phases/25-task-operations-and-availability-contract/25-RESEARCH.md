# Phase 25: Task Operations And Availability Contract - Research

**Researched:** 2026-08-10
**Domain:** Hono/D1/Drizzle crawler control plane, bounded availability observations, Dashboard task operations
**Confidence:** MEDIUM

## User Constraints

### Locked Decisions

- 继续复用 D1 crawler_task/run/attempt/lease/provider/receipt 控制面，不另建调度器。
- task lifecycle 与 run execution status 分离；request_snapshot_json 不可变；修改目标/策略用 supersede 新任务；删除是逻辑 archive，保留 runs/attempts/receipts/observations/audit。
- operation registry 由服务端拥有；客户端只提交受控 operation、target、policy/intent，workflow/URL/命令/secrets 不暴露。
- availability 是 append-only observation + bounded current projection；结果绑定 task/run/attempt、target、content/source revision、policy version，并用 CAS 防迟到结果覆盖新事实。
- evidence 只保存 bounded、redacted summary，不保存签名 URL、cookie、凭据、原始响应、媒体内容或无界结果。
- Phase 25 只建立共享契约和任务运管，不实现 Phase 26 视频、Phase 27 章节、Phase 28 图片探测器。

**来源：**以上锁定输入与 Phase 25 范围来自 `.planning/ROADMAP.md`、`.planning/STATE.md`、`.planning/REQUIREMENTS.md`；本节按要求保留原文。[VERIFIED: .planning/ROADMAP.md / .planning/STATE.md / .planning/REQUIREMENTS.md]

### Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TASK-01 | 用户可以通过受控 operation registry 创建爬虫、检查或修复任务；任务快照包含目标身份、操作类型、策略版本和目标意图，workflow、URL、命令与 secrets 仍由服务端管理。 | 现有 `template-registry.ts`、Valibot strict schema、provider snapshot 和 `request_snapshot_json` 是共享落点；需要补齐 operation/target/policy/intent contract。[VERIFIED: .planning/REQUIREMENTS.md; apps/api/src/domain/crawler-tasks/template-registry.ts] |
| TASK-02 | 用户可以分页查看任务列表和详情，并看到任务状态、目标内容、最新 run/attempt、provider、receipt、日志摘要与历史转换记录。 | 现有 `/api/admin/crawler-tasks` list/detail/log routes、cursor、`crawler_run_transition`、provider/receipt projection 可扩展。[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; apps/api/src/domain/crawler-tasks/repository.ts] |
| TASK-03 | 用户可以修改任务允许修改的描述和策略意图，并可以归档任务；归档或 supersede 不删除已有 run、attempt、receipt、observation 和审计事实，活动中的不可变快照保持可追溯。 | 当前 `crawler_task` 没有 lifecycle/archive/supersede 字段或 route；需要新增 task lifecycle projection，保持 snapshot 与 run 事实不变。[VERIFIED: packages/db/src/schema.ts:354-371; apps/api/src/routes/admin/crawler-tasks/index.ts:1099-1384] |
| TASK-04 | 用户可以取消 queued 或 running 任务，并能看到取消请求、provider 状态和最终结果；迟到的回调不能把已取消或更新后的任务写成成功。 | 现有 `state-machine.ts`、signed internal callback、`state_version`、`last_event_sequence` 和 cancel route 是基础；Phase 25 需把 task snapshot/lifecycle version 纳入 late callback 判定。[VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts; apps/api/src/routes/internal/crawler-runs/index.ts] |
| TASK-05 | 用户可以对失败或取消的任务执行有界重试；重复点击或事件重放保持幂等，新的 run/attempt 保留旧日志、receipt、source observation 和失败原因。 | 现有 `createManualRetryAttempt`、`retryRun`、`MAX_AUTOMATIC_RETRY_ATTEMPTS = 2`、runner event unique indexes 和 D1 batch 可复用。[VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts; apps/api/src/domain/crawler-tasks/repository.ts:642-692; packages/db/src/schema.ts:374-400,580-610] |
| TASK-06 | 用户可以从同一任务详情查看创建、更新、归档、取消、重试和修复操作的审计信息，包括目标、原因、时间、操作者和结果摘要。 | 通用 `audit_log` 与 `/api/admin/audit-logs` 已存在，但 crawler resource types、task-scoped projection、bounded writer 尚未完成。[VERIFIED: apps/api/src/middleware/audit-logger.ts; apps/api/src/routes/admin/audit-logs/index.ts; packages/db/src/schema.ts:617-633] |

### Deferred Ideas (OUT OF SCOPE)

- Phase 26 视频 metadata/direct source/magnet/TorrServer 检查与修复。
- Phase 27 漫画 source chapter snapshot、缺章/重复/顺序诊断与定向重抓。
- Phase 28 章节图片探测、定向修复和全链路 Gateway 证据验收。
- 任意 workflow、URL、命令、凭据或 secrets 编辑；第二套调度器；多用户配额/审核流。

**来源：**`.planning/REQUIREMENTS.md` Out of Scope 与 `.planning/ROADMAP.md` Phase 26-28。[VERIFIED: .planning/REQUIREMENTS.md / .planning/ROADMAP.md]

## Project Constraints (from AGENTS.md)

- 默认用中文沟通、分析、验证和交付。
- 当前 phase 的规划真相优先看 `.planning/PROJECT.md`、`.planning/ROADMAP.md`、`.planning/STATE.md`；本阶段不要把历史 phase 文档当作当前实现。
- 本地验收的 canonical origin 是 `http://localhost:8080/...`；Dashboard/Vite、API 或其他直连端口不能替代 Gateway 验收。
- 保留现有脏工作树与无关改动；本研究只写本文件，不触碰 `AGENTS.md`、`CLAUDE.md`、`apps/api/src/routes/admin/crawler-tasks/index.ts`、`scripts/phase24-production-proof.ts` 和 `.planning/tmp/` 的已有改动。
- 变更函数、类或方法前需要 GitNexus upstream impact analysis；提交前需要 `gitnexus_detect_changes()`。本次研究没有业务 symbol 编辑，也不提交 git。
- DB 改动遵循项目 skill：修改 `packages/db/src/schema.ts`，运行 `pnpm --filter @starye/db drizzle-kit generate`，本地 D1 apply，再运行 API types/API type-check。[VERIFIED: AGENTS.md; .agents/skills/starye-db-migration/SKILL.md]
- Hono endpoint 遵循项目 skill：schema、route、`apps/api/src/index.ts` mount、Dashboard API wrapper、API type-check 全链路。[VERIFIED: .agents/skills/starye-hono-rpc/SKILL.md]
- crawler 相关测试优先 fixture/interception，不以 live network 作为主测试。[VERIFIED: .agents/skills/starye-crawler-strategy/SKILL.md]

## Summary

Phase 25 应当作为现有 v1.3/v1.4 crawler control plane 的 contract expansion。真实控制面已经由 `crawler_task`, `crawler_run`, `crawler_run_transition`, `crawler_template_lease`, `crawler_run_provider_association`, `crawler_runner_event`, `crawler_run_log` 和 `crawler_run.receipt_*` 组成；`createCrawlerTaskRepository()`、`decideCrawlerRunTransition()`、`validateReceiptCandidate()`、`acceptRepairSourceObservation()` 与 `createPlaybackEvidenceRepository()` 已分别承担持久化、生命周期、receipt、source observation 和 bounded evidence 边界。[VERIFIED: packages/db/src/schema.ts:354-633; apps/api/src/domain/crawler-tasks/repository.ts; apps/api/src/domain/crawler-tasks/state-machine.ts; apps/api/src/domain/movies/source-reconciliation.ts; apps/api/src/domain/playback-evidence/repository.ts]

当前 task API 还不是通用运管面：普通创建只接收 `template`，repair 使用独立 `/repair-players` route；已有 list/detail/log/cancel/retry，却没有 task update/archive/supersede，也没有 task lifecycle 状态。当前 operation registry 是 `crawlerTaskTemplates` 加 `isCrawlerTaskOperation()` 的轻量 registry，普通 snapshot 只含 template/entrypoint/permission/version，repair snapshot 才包含 movieId、reason、sourceRevision、targetIntent。[VERIFIED: apps/api/src/schemas/crawler-tasks.ts:1-50; apps/api/src/domain/crawler-tasks/template-registry.ts:12-145; apps/api/src/routes/admin/crawler-tasks/index.ts:1099-1384]

推荐把 Phase 25 拆成四个相互依赖的边界：共享闭合 contract；task lifecycle 与 CRUD/idempotency/audit；通用 observation/current projection 的 D1 persistence；Dashboard task detail 与 Gateway 验收。movie-specific `movie_source_state`/`movie_source_observation` 保留为现有 source readback 兼容层，新的 shared availability contract 以 task/run/attempt/target/content/source revision/policy version 绑定，未来 Phase 26-28 只注册各自 operation 和 adapter。[ASSUMED]

**Primary recommendation:** 在现有 `apps/api/src/domain/crawler-tasks` 与 `packages/db/drizzle` 边界内扩展服务端 operation registry、task lifecycle projection、bounded audit writer 和 shared availability repository；保持 `crawler_run.status` 与 task lifecycle 独立，所有 observation 先 append，再以 revision/version 条件更新 current projection。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Operation registry、request validation、snapshot construction | API / Backend | Browser / Client | 服务端决定 operation、template、provider、policy schema；客户端只发送闭合受控输入。[VERIFIED: apps/api/src/domain/crawler-tasks/template-registry.ts; apps/api/src/schemas/crawler-tasks.ts] |
| Task lifecycle CRUD/archive/supersede/cancel/retry | API / Backend | Database / Storage | API 执行业务状态机和权限，D1 保存 task identity、immutable snapshot 与 lifecycle facts。[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; packages/db/src/schema.ts:354-400] |
| Run/attempt/lease/provider execution | Database / Storage | External Provider / API | D1 控制 run/lease/transition，GitHub Actions 或 local runner 仅执行 server-owned dispatch snapshot。[VERIFIED: apps/api/src/routes/internal/crawler-runs/index.ts; apps/api/src/domain/crawler-tasks/provider-association.ts] |
| Availability observation 与 current projection | API / Backend | Database / Storage | API 校验 bounded result、task binding、revision/policy，再由 D1 append 与 conditional projection write 固化事实。[VERIFIED: apps/api/src/domain/movies/source-reconciliation.ts:324-666; packages/db/drizzle/0030_source_health_repair.sql] |
| Audit history | Database / Storage | API / Backend | `audit_log` 是现有持久化 owner；API 负责 fixed allowlist、actor、reason、result summary 和 task-scoped query。[VERIFIED: packages/db/src/schema.ts:617-633; apps/api/src/routes/admin/audit-logs/index.ts] |
| Dashboard task list/detail/history | Browser / Client | API / Backend | `Crawlers.vue` 已有 polling、current attempt、runs、logs、provider/receipt/source/playback blocks；API 必须提供稳定 bounded DTO。[VERIFIED: apps/dashboard/src/views/Crawlers.vue:362-626; apps/dashboard/src/lib/api.ts:779-824] |
| Canonical local acceptance | CDN / Static Gateway | Browser / Client | Gateway 在 `8080` 代理 `/api` 与 `/dashboard`；浏览器和脚本必须通过该 origin 观察跨应用链路。[VERIFIED: apps/gateway/src/index.ts; scripts/gateway-readiness.ts; scripts/local-task-runner.e2e.ts:8,277-298] |

## Phase 20-24 Evidence

| Archive | Reusable finding | Planner consequence |
|---|---|---|
| Phase 20 | Receipt candidate 只能作为候选；API 按 canonical movie id readback source state，`metadata`、`source`、`playback` 分层。[VERIFIED: `.planning/milestones/v1.4-phases/20-source-contract-receipt-boundary-and-sun-064/20-RESEARCH.md`; `20-02-PLAN.md`] | Shared availability result 不能由 runner success 或 receipt success 推导；必须保留独立事实层。 |
| Phase 21 | `movie_source_observation` append-only identity、`movie_source_state` current projection、source revision、D1 native batch、authoritative readback 和 cache invalidation 已落地。[VERIFIED: `.planning/milestones/v1.4-phases/21-source-health-and-local-repair-players-vertical-slice/21-RESEARCH.md`; `apps/api/src/domain/movies/source-reconciliation.ts`] | 复用 `readObservationIdentity`、bounded readback、conditional `WHERE source_revision = currentRevision` 的实现形状。 |
| Phase 22 | Dashboard `Crawlers.vue` 已将 provider、repair/receipt、source、playback 独立呈现，5 秒 visible polling，隐藏页面停止 polling。[VERIFIED: `.planning/milestones/v1.4-phases/22-dashboard-moviedetail-and-player-state-closure/22-VERIFICATION.md`; `apps/dashboard/src/views/Crawlers.vue`] | Task lifecycle/history 应追加到现有 detail focal pattern，避免重新做另一套 task screen。 |
| Phase 23 | provider association、signed runner callback、lease/reconciliation 和 receipt reconciliation 都围绕同一 task/run/attempt tuple。[VERIFIED: `.planning/milestones/v1.4-phases/23-github-actions-production-repair-and-reconciliation/23-CONTEXT.md`; `23-02-PLAN.md`] | cancel/retry/supersede 必须保持 provider snapshot 与旧 attempt 的历史绑定。 |
| Phase 24 | playback evidence 使用 tuple/content/source revision、bounded summary、append-only rejection history 和 CAS；canonical browser proof 从 `http://localhost:8080/dashboard/crawlers` 开始。[VERIFIED: `.planning/milestones/v1.4-phases/24-fresh-production-dashboard-viewer-playback-proof/24-RESEARCH.md`; `24-02-PLAN.md`; `24-VERIFICATION.md`] | shared evidence/readback 的 redaction、duplicate/conflict/stale/late/ignored 词汇可直接复用，Phase 25 只扩展任务/可用性契约。 |

## Standard Stack

### Core

| Library / surface | Repository version | Registry/current check | Phase 25 use |
|---|---:|---:|---|
| `drizzle-orm` | `0.45.2` | npm current `0.45.2`, modified 2026-08-05 [VERIFIED: npm registry] | `packages/db/src/schema.ts`、typed queries、relations；D1-specific CAS remains native prepared SQL where needed. |
| Drizzle Kit | `0.31.10` | package lock version [VERIFIED: codebase] | Generate the next numbered migration; do not hand-name an alias or skip journal metadata. |
| Hono | `4.12.14` | npm current `4.13.1`, modified 2026-08-07 [VERIFIED: npm registry] | Existing API router/mount/auth boundary; keep repository version during Phase 25. |
| `hono-openapi` | `1.3.0` | npm current `1.3.1`, modified 2026-07-05 [VERIFIED: npm registry] | Existing route description/validation convention where already used. |
| `valibot` | `1.3.1` | npm current `1.4.2`, modified 2026-06-28 [VERIFIED: npm registry] | Closed request/response schemas, picklists/literals, bounded strings/numbers. |

### Supporting

| Library / surface | Repository version | Phase 25 use |
|---|---:|---|
| Vitest | `4.1.4` | API/domain/schema/migration contract tests; `vitest run` is the valid one-shot command in this workspace. [VERIFIED: apps/api/package.json; local command] |
| `@playwright/test` | `1.59.1` | Existing Dashboard E2E configuration and authenticated Gateway browser acceptance. Package is installed under `apps/dashboard/node_modules`, while root `playwright` CLI resolution is absent. [VERIFIED: apps/dashboard/package.json; local probe] |
| `wrangler` | package `^4.90.0`, local `4.90.1` | Local D1 migration apply and Worker/Gateway service orchestration. [VERIFIED: apps/api/package.json; local command] |
| Vue 3 + Dashboard API client | Vue `^3.5.32` | Consume server-owned task/detail DTO through `apps/dashboard/src/lib/api.ts`; no raw fetch in new task UI. [VERIFIED: apps/dashboard/package.json; apps/dashboard/src/lib/api.ts] |
| Cloudflare D1 binding | Worker binding `DB` | Durable task/observation/audit data; local D1 uses migration directory `packages/db/drizzle`. [VERIFIED: packages/db/src/index.ts; apps/api/.target-wrangler*.toml] |

**Installation:** No package installation is required for the research-derived plan. Use the lockfile and existing workspace dependencies; version drift is recorded above rather than upgraded in Phase 25. `[VERIFIED: package.json; pnpm-lock.yaml]`

### Alternatives Considered

| Instead of | Use | Tradeoff |
|---|---|---|
| A second availability scheduler | Existing `crawler_task/run/attempt/lease/provider` control plane | Preserves provider, callback, lease, receipt and audit trace; future phases add registry operations/adapters only. `[VERIFIED: .planning/STATE.md; packages/db/src/schema.ts]` |
| A generic in-memory task state store | D1 task lifecycle plus append-only transition/audit rows | Survives Worker instances and exposes historical facts; requires explicit migration/index work. `[VERIFIED: packages/db/drizzle/0027_crawler_task_domain_foundation.sql]` |
| Replacing movie source tables immediately | Shared availability contract plus adapter/read-through compatibility for `movie_source_state` and `movie_source_observation` | Avoids breaking Phase 21-24 movie readback while future content kinds converge on the shared contract. `[ASSUMED]` |
| Client-provided workflow/URL/command | Server-owned operation registry and provider snapshot | Keeps provider routing and secrets outside request DTOs; requires per-operation target/policy schemas. `[VERIFIED: apps/api/src/domain/crawler-tasks/provider-association.ts; apps/api/src/schemas/crawler-run-events.ts]` |

## Architecture Patterns

### System Architecture Diagram

```text
Dashboard / authenticated browser
  -> Gateway http://localhost:8080
  -> /api/admin/crawler-tasks (create/list/detail/update/archive/supersede/cancel/retry)
  -> Hono auth + resource guard + Valibot closed schema
  -> server-owned operation registry
  -> crawler task repository
     -> D1 crawler_task (immutable request snapshot + lifecycle)
     -> D1 crawler_run / transition / lease / provider / log
     -> existing provider dispatch or local runner
        -> signed /api/internal/crawler-runs callback
           -> state machine + receipt validation
           -> availability observation endpoint/repository
              -> append-only observation row
              -> conditional CAS current projection
              -> bounded redacted readback + cache invalidation
  -> task detail projection: current lifecycle + latest run + history + audit + availability
  -> Dashboard polling/history view

  mutation path -> fixed-field crawler audit writer -> D1 audit_log
  stale/duplicate/conflict/late callback -> retained bounded history, current projection unchanged
```

The diagram reflects existing routes and repository flow; `update/archive/supersede` and shared availability route/repository are Phase 25 additions, not current aliases. `[VERIFIED: codebase] [ASSUMED: proposed additions]`

### Pattern 1: Server-Owned Operation Registry

**What:** Extend `apps/api/src/domain/crawler-tasks/template-registry.ts` into a registry whose entry owns operation key, template key/version, permission resource, target schema/normalizer, policy/intent schema, provider dispatch adapter and bounded result projection. The route accepts only the registry key and its closed target/policy/intent payload; it resolves workflow, target profile, entrypoint and secrets server-side.

**When to use:** Every task creation, update intent, repair, check and future Phase 26-28 operation. Existing keys remain `movie`, `manga`, `repair_players`; Phase 25 registers no video/chapter/image detector.[VERIFIED: apps/api/src/domain/crawler-tasks/template-registry.ts:12-55; .planning/REQUIREMENTS.md]

**Recommended contract:**

```ts
// Proposed shape; exact names belong in the Phase 25 contract plan.
type TaskCommand = {
  operation: RegisteredOperation
  target: ClosedTarget
  policyVersion: string
  intent: ClosedIntent
}

type TaskSnapshot = TaskCommand & {
  templateKey: CrawlerTaskTemplateKey
  templateVersion: number
}
```

The snapshot is created once, stored as bounded JSON, and used to derive provider dispatch. Mutable labels/notes may live outside the snapshot; target/policy changes create a superseding task. `[ASSUMED]`

### Pattern 2: Separate Task Lifecycle From Run State

Keep `crawler_run.status` as execution state (`queued`, `dispatching`, `running`, `cancel_requested`, `succeeded`, `failed`, `cancelled`). Add a task lifecycle projection such as `active`, `archived`, `superseded` plus bounded `superseded_by_task_id`, `archived_at`, and mutable description/intent fields outside `request_snapshot_json`; exact column names are a planner decision. A supersede operation creates a new task and leaves old task/run/attempt/receipt/observation/audit rows queryable. `[VERIFIED: packages/db/src/schema.ts:354-400; apps/api/src/domain/crawler-tasks/state-machine.ts] [ASSUMED: new lifecycle columns]`

Use repository-owned mutation functions rather than route-local SQL:

- `createTaskFromOperation()` validates registry entry, canonicalizes target/policy/intent, computes request fingerprint, then atomically inserts task + first run + lease + transition.
- `updateTaskMetadata()` changes only allowlisted description/notes or intent metadata; it never rewrites the immutable snapshot.
- `archiveTask()` sets logical archive fields and writes one audit fact; it leaves all child facts intact and excludes the task from default active list queries.
- `supersedeTask()` validates the old task state, creates the new task from a new snapshot, links both tasks, and preserves the old task as historical/superseded.
- Existing `applyTransition()`, `cancelRun()` path and `retryRun()` remain the run state boundaries; new routes call them through access checks.[VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts; apps/api/src/routes/admin/crawler-tasks/index.ts:1331-1408] [ASSUMED: function names for new operations]

### Pattern 3: Idempotency At Command Acceptance

Use the existing `(requested_by_user_id, idempotency_key)` unique index as the first persistence guard, but make the accepted command include a canonical request fingerprint. Reusing a key with the same user and same command returns the original task/run; reusing it with a different operation/target/policy/intent returns a bounded conflict. The active-lease check remains a provider concurrency guard, not the only idempotency mechanism, because current `createOrGetActiveRun()` deduplicates by template lease before it examines a general operation identity. `[VERIFIED: packages/db/src/schema.ts:364-368; apps/api/src/domain/crawler-tasks/repository.ts:692-1056] [ASSUMED: fingerprint/conflict contract]`

Prefer a normalized lower-case `idempotency-key` request header or an explicitly validated body field, then test the exact chosen surface. Hono's official validator guide notes that header keys are read lower-case and JSON validation requires `Content-Type: application/json`; both details belong in route tests. `[CITED: https://hono.dev/docs/guides/validation]`

### Pattern 4: Append Observation, Then CAS Current Projection

The current movie implementation is the template: `readObservationIdentity()` detects replay, `readState()` reads current revision, D1 batch writes player/source facts and `movie_source_state`, and the conditional update checks current revision before promotion. `readRepairSourceReadback()` then reads committed rows and bounded fields rather than returning raw input. `[VERIFIED: apps/api/src/domain/movies/source-reconciliation.ts:257-338,400-666; packages/db/drizzle/0030_source_health_repair.sql]`

For the shared contract, use a new generic observation row and one current projection row per target/content identity. Recommended bounded fields are:

| Observation field | Rule |
|---|---|
| `task_id`, `run_id`, `attempt_number` | Required foreign-key tuple; verify run belongs to task. |
| `target_kind`, `target_id`, `content_id` | Server-normalized identity; no URL or executable target. |
| `source_revision`, `policy_version` | Nonnegative bounded revision and closed policy identifier. |
| `status`, `reason_code`, `next_action` | Closed picklists; execution success remains a separate run fact. |
| `observed_at`, `observation_identity` | Bounded timestamp plus deterministic replay key. |
| `summary_json` | Allowlisted counts/codes/labels only, with byte and row limits. |

The current projection should hold the latest accepted observation id, status/reason/next action, source revision, policy version, observedAt and a monotonic projection version. A write accepts only when the expected current revision/version still matches and incoming observedAt is not older; zero affected rows becomes `stale`/`late` history. The append and promotion must be one D1 batch/transaction boundary, with committed readback after write. `[ASSUMED: generic table names and exact columns] [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/; https://orm.drizzle.team/docs/transactions; https://orm.drizzle.team/docs/batch-api]`

Keep `movie_source_state` as the movie readiness compatibility projection for current Phase 21-24 consumers. The generic adapter should map accepted movie observations into the existing `ready/no_source/source_failed/repairing` DTO and preserve its cache invalidation hooks; removing or renaming the existing movie tables would expand Phase 25 beyond a shared contract. `[VERIFIED: apps/api/src/domain/movies/source-reconciliation.ts:362-666; apps/dashboard/src/lib/api.ts:229-287] [ASSUMED: compatibility adapter shape]`

### Pattern 5: Bounded Readback And Redaction

Build public/detail DTOs from persisted rows through allowlists, following `projectRepairReceipt()`, `projectRepairSourceRow()`, `boundedReadbackSource()`, `truncateUtf8()` and playback evidence redaction. Preserve task/run/attempt/provider/content/revision/policy identity, finite status/reason/action values, timestamps, counts, safe log codes and artifact references; omit signed URL/query, cookie, credential, Authorization, raw response, media, workflow, command and unbounded result payload. `[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:479-604; apps/api/src/domain/crawler-tasks/repository.ts:588-620; apps/api/src/domain/playback-evidence/redaction.ts; .planning/milestones/v1.4-phases/24-fresh-production-dashboard-viewer-playback-proof/24-02-PLAN.md]`

Valibot's official object guide says `strictObject` rejects unknown entries, making it suitable for operation commands and bounded evidence input. `[CITED: https://valibot.dev/guides/objects/]`

### Pattern 6: Existing Dashboard Focal Detail

Extend `Crawlers.vue` and `apps/dashboard/src/lib/api.ts`. Current list reads `limit/cursor`, detail loads each task, selects latest run, loads bounded logs, polls every five seconds while visible, and preserves last valid detail on refresh failure. Add lifecycle action controls and history/audit sections to this focal detail; keep provider, run, receipt, availability and audit as separate blocks. `[VERIFIED: apps/dashboard/src/views/Crawlers.vue:362-626; apps/dashboard/src/lib/api.ts:547-574,779-824]`

For browser acceptance, use the existing canonical Gateway flow and fresh task tuple. Playwright official guidance permits reusable authenticated storage state but warns that it contains sensitive cookies/headers; state files belong outside tracked evidence, and mutating shared server state needs worker/account isolation. `[CITED: https://playwright.dev/docs/auth]`

## Recommended Project Structure

```text
apps/api/src/domain/crawler-tasks/
├── template-registry.ts       # existing templates; extend to server-owned operation registry
├── types.ts                   # task snapshot/lifecycle/read models and bounded unions
├── state-machine.ts           # existing run transition rules; keep run status separate
├── repository.ts              # existing D1 task/run repository; add lifecycle/idempotency/audit calls
├── audit.ts                   # proposed fixed-field crawler audit writer
└── availability/              # proposed shared observation/projection contract and repository
    ├── types.ts
    ├── redaction.ts
    └── repository.ts
apps/api/src/schemas/
├── crawler-tasks.ts            # extend strict command/query schemas
└── crawler-availability.ts     # proposed closed observation/readback schemas
apps/api/src/routes/admin/crawler-tasks/index.ts  # existing route owner; add task lifecycle routes
apps/api/src/routes/internal/crawler-runs/index.ts # existing signed runner/callback owner
apps/dashboard/src/lib/api.ts                    # existing typed wrapper owner
apps/dashboard/src/views/Crawlers.vue             # existing task operations/detail UI owner
packages/db/src/schema.ts                         # existing Drizzle schema owner
packages/db/drizzle/0032_*.sql                    # next migration generated after schema edit
```

The `availability/` and migration names above are recommendations, not current paths. The only current availability implementation is movie-specific under `apps/api/src/domain/movies/`.[VERIFIED: current file inventory] [ASSUMED: recommended new paths]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Scheduling/dispatch | A new availability scheduler or queue | Existing `crawler_task/run/lease/provider` control plane and registry adapter | Avoids split leases, receipts, callbacks and audit truth. `[VERIFIED: packages/db/src/schema.ts; .planning/STATE.md]` |
| Runtime validation | Manual object checks scattered through handlers | Existing Hono validator + Valibot strict schemas | Centralizes unknown-field rejection and inferred input types. `[VERIFIED: apps/api/src/schemas/crawler-tasks.ts] [CITED: https://hono.dev/docs/guides/validation; https://valibot.dev/guides/objects/]` |
| CAS/replay logic | In-memory timestamp checks or last-write-wins JSON | D1 unique identities + conditional update/batch and bounded rejection/history facts | Worker instances are independent; persistence must decide stale/duplicate/conflict. `[VERIFIED: apps/api/src/domain/movies/source-reconciliation.ts; apps/api/src/domain/playback-evidence/repository.ts]` |
| Provider routing | Client-controlled workflow, URL, command or secret | `createProviderSnapshot()` and registry-owned dispatch input | Existing provider boundary already fixes target/workflow/repository/ref/environment. `[VERIFIED: apps/api/src/domain/crawler-tasks/provider-association.ts; apps/api/src/schemas/crawler-run-events.ts]` |
| Audit serialization | Reuse arbitrary `changes` payloads for runner/result blobs | Fixed crawler audit allowlist and bounded summary writer | Existing generic sanitizer only covers a small sensitive-key list and has no size bound. `[VERIFIED: apps/api/src/middleware/audit-logger.ts:20-83]` |
| Browser authentication | New credential/session capture in phase evidence | Existing session boundary plus local Gateway browser context | Keeps cookies/header state out of repository artifacts. `[VERIFIED: apps/api/src/lib/auth.ts; scripts/phase24-production-proof.ts] [CITED: https://playwright.dev/docs/auth]` |
| Migration application | Direct remote SQL or guessed migration aliases | `packages/db/src/schema.ts` -> `pnpm --filter @starye/db drizzle-kit generate` -> local `wrangler d1 migrations apply` -> readback | Matches project DB skill and existing numbered migrations. `[VERIFIED: .agents/skills/starye-db-migration/SKILL.md; packages/db/drizzle.config.ts]` |

## Current File, Symbol And Table Map

| Area | Existing file/symbol/table | Current behavior | Phase 25 action |
|---|---|---|---|
| Registry | `template-registry.ts`: `crawlerTaskTemplates`, `isCrawlerTaskOperation`, `createCrawlerTaskSnapshot`, `readCrawlerTaskSnapshot` | Registry supports movie/manga templates and repair snapshot validation. | Extend this owner; do not invent an API alias outside the admin crawler route. `[VERIFIED: codebase]` |
| Input | `schemas/crawler-tasks.ts`: `CreateCrawlerTaskSchema`, `CreateRepairPlayersTaskSchema`, `RetryCrawlerTaskSchema` | Ordinary create only has `template`; repair has movieId/reason/targetIntent; retry has `confirmed: true`. | Add closed operation/target/policy/intent/update/archive/supersede schemas. `[VERIFIED: codebase] [ASSUMED: additions]` |
| Admin routes | `adminCrawlerTasksRoutes` | Existing POST create, POST repair, GET list/detail/logs, POST cancel/retry. | Add task lifecycle routes only after repository contracts exist; preserve existing routes during compatibility rollout. `[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:1099-1408]` |
| Internal routes | `crawlerRunsRoutes` | Existing `/api/internal/crawler-runs/poll`, `/:runId/claim`, schedule-register, dispatch-validate, provider-started, source-observation, events. | Bind callback acceptance to immutable task snapshot/lifecycle revision and generic observation identity. `[VERIFIED: apps/api/src/routes/internal/crawler-runs/index.ts:266-591]` |
| Repository | `createCrawlerTaskRepository` | Existing D1 batch task/run/lease/transition creation, cursor/list/detail, logs, provider association, cancellation, retries and runner events. | Add lifecycle/idempotency/audit/availability methods; keep route handlers thin. `[VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts:692-2165]` |
| Run state | `decideCrawlerRunTransition`, `createManualRetryAttempt` | Closed run statuses, stale sequences, bounded automatic retry and receipt validation. | Preserve run execution contract; task archive/supersede must not overwrite it. `[VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts]` |
| Source | `movieSourceStates`, `movieSourceObservations`; `readRepairSourceReadback`, `acceptRepairSourceObservation` | Movie-specific source revision, append facts, CAS current state, bounded readback and cache invalidation. | Use as adapter/template; add task/policy binding for shared availability. `[VERIFIED: packages/db/src/schema.ts:187-205,483-521; apps/api/src/domain/movies/source-reconciliation.ts]` |
| Evidence | `playbackEvidenceSummaries`, `playbackEvidenceRejections`; `createPlaybackEvidenceRepository` | Tuple-bound accepted-once summary and bounded rejection history. | Reuse outcome/redaction conventions; keep playback outside Phase 25 implementation. `[VERIFIED: packages/db/src/schema.ts:406-481; apps/api/src/domain/playback-evidence/repository.ts]` |
| Audit | `auditLogs`, `createAuditLog`, `/api/admin/audit-logs` | Generic audit row/query exists; crawler resource type and bounded task detail projection are absent. | Add crawler resource/action support, index and fixed-field writer or a clearly bounded task audit adapter. `[VERIFIED: packages/db/src/schema.ts:617-633; apps/api/src/middleware/audit-logger.ts; apps/api/src/routes/admin/audit-logs/index.ts]` |
| Dashboard | `Crawlers.vue`, `api.admin.listCrawlerTasks/getCrawlerTask/cancelCrawlerRun/retryCrawlerRun` | Current task operations are template create, repair, cancel run, retry run; no task archive/update/supersede UI. | Extend current focal detail and polling; add audit/history/lifecycle actions. `[VERIFIED: apps/dashboard/src/views/Crawlers.vue; apps/dashboard/src/lib/api.ts:779-824]` |
| Gateway | `apps/gateway/src/index.ts`, `scripts/gateway-readiness.ts` | Local canonical origin and routing exist; port 8080 is currently listening. | Acceptance command must use `http://localhost:8080/dashboard/crawlers` and `/api/...`. `[VERIFIED: codebase; local probe]` |

## D1 Schema And Migration Recommendation

Current schema has no task lifecycle/archive fields. `crawler_task` has `id`, `template_key`, `operation`, `template_version`, `requested_by_user_id`, `request_snapshot_json`, `idempotency_key`, `latest_run_id`, `created_at`, `updated_at`; `crawler_run` owns execution status/version/sequence/lease/cancel/receipt fields. `[VERIFIED: packages/db/src/schema.ts:354-400]`

Recommended migration work, in dependency order:

1. Extend `crawler_task` with a closed lifecycle (`active`, `archived`, `superseded`), archive timestamp/reason, optional superseding task link, bounded mutable description/intent metadata, and a lifecycle version. Add a self-reference only if Drizzle relations can be updated in the same schema change. `[ASSUMED: exact columns]
2. Add indexes for default active list ordering, `(requested_by_user_id, idempotency_key)`, lifecycle, and task-scoped history. Existing idempotency unique index remains the conflict gate.[VERIFIED: packages/db/src/schema.ts:364-369]
3. Add the shared availability observation table with required task/run/attempt/target/content/source revision/policy version identity, closed status/reason/action, bounded summary, observedAt, and deterministic observation identity. Add foreign keys to task and run and a composite uniqueness constraint for replay.[ASSUMED: exact table/columns]
4. Add the bounded current projection keyed by target/content identity, with accepted observation id, source revision, policy version, observedAt and monotonic projection version. Add conditional update predicates for expected revision/version and incoming freshness.[ASSUMED: exact table/columns]
5. Extend audit support with crawler task/run resource types and an index for `(resource_type, resource_id, created_at)`, or add a dedicated crawler audit table only if the generic `audit_log.changes` contract cannot be bounded without weakening existing consumers. The planner should select one owner before implementation.[VERIFIED: current audit schema] [ASSUMED: migration choice]
6. Generate the next migration from schema, inspect SQL for foreign keys/indexes and destructive statements, apply local D1, query table/index metadata, then run focused repository migration tests. Existing migrations end at `0031_playback_evidence.sql`; do not assume a next filename until Drizzle generates it.[VERIFIED: packages/db/drizzle file inventory]

Use D1 native batch/prepared statements for append + projection + audit writes where atomicity is required. Official D1 documents `prepare()` and `batch()` as Worker database operations; existing `source-reconciliation.integration.test.ts` already exercises a D1-compatible batch wrapper and committed readback. `[CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] [VERIFIED: apps/api/src/domain/movies/__tests__/source-reconciliation.integration.test.ts:47-141]`

## Operation And Task API Recommendation

The current real paths are:

| Current path | Current purpose |
|---|---|
| `POST /api/admin/crawler-tasks` | Ordinary template create; body `{ template: 'movie' | 'manga' }`. |
| `POST /api/admin/crawler-tasks/repair-players` | Server-validated repair command; body movieId/reason/targetIntent. |
| `GET /api/admin/crawler-tasks?template=&cursor=&limit=` | Cursor-paged list. |
| `GET /api/admin/crawler-tasks/:taskId` | Task detail and runs. |
| `GET /api/admin/crawler-tasks/:taskId/runs/:runId/logs` | Bounded log page. |
| `POST /api/admin/crawler-tasks/:taskId/runs/:runId/cancel` | Run cancellation request. |
| `POST /api/admin/crawler-tasks/:taskId/runs/:runId/retry` | Confirmed run retry. |

These are verified current paths; the following are recommended additions and must not be treated as existing aliases: `PATCH /:taskId` for allowlisted metadata, `POST /:taskId/archive`, `POST /:taskId/supersede`, and a generic operation create route or body contract that remains compatible with existing ordinary/repair routes. `[VERIFIED: current route file] [ASSUMED: proposed additions]`

Recommended operation command flow:

1. Authenticate session, resolve `canAccessCrawler`/resource guard and validate the request with strict Valibot schema.
2. Resolve operation registry entry; reject unknown operation, target shape, policy version or intent before repository mutation.
3. Canonicalize target identity server-side and construct immutable snapshot. Resolve provider snapshot from registry; client data never becomes workflow, URL, command, ref, environment or secret.
4. Compute idempotency/fingerprint and atomically create task, initial run, lease and transition. A repeated equivalent command returns the same task/run; a changed command with the same key returns conflict.
5. Dispatch through existing `dispatchCreatedRun()`/provider association only after D1 acceptance. Provider result remains separate from receipt and availability.
6. For update/archive/supersede/cancel/retry, re-read task binding and latest lifecycle/run state in the same repository boundary, append one transition/audit fact, and return a bounded result.

## Audit Recommendation

The existing `auditMiddleware()` is a pass-through middleware; actual writes use `createAuditLog()`, whose `AuditResourceType` excludes crawler task/run and whose generic `changes` serializer has no explicit byte bound. `[VERIFIED: apps/api/src/middleware/audit-logger.ts:13-27,117-151,248-263]`

Use a crawler-specific writer that accepts only:

```ts
type CrawlerAuditFact = {
  action: 'create' | 'update' | 'archive' | 'supersede' | 'cancel' | 'retry' | 'repair'
  taskId: string
  runId?: string
  targetLabel?: string
  reasonCode?: string
  outcome: string
  actorId: string
  occurredAt: number
}
```

Persist bounded fields in `audit_log` after extending resource/action support, or use a dedicated table if existing generic JSON cannot be constrained. Task detail should query audit by task id in descending time order with a hard page/row limit; export remains the existing global audit route. `[ASSUMED: contract fields and owner choice]`

Audit facts should be written for create, metadata update, archive, supersede, cancel request, retry acceptance/conflict, repair command and stale/late rejection where it is a user-visible task operation. Provider raw payload, token, cookie, URL, workflow and exception text remain outside the fact. `[VERIFIED: locked evidence boundary; apps/api/src/domain/crawler-tasks/log-redaction.ts] [ASSUMED: exact action coverage]`

## Common Pitfalls

### 1. Treating current template lease as idempotency

**What goes wrong:** Current `createOrGetActiveRun()` checks an active template lease before using a general operation identity, so two distinct targets under one template can be conflated if the generalized command path reuses this check blindly. `[VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts:692-1056]`

**How to avoid:** Make idempotency key + canonical request fingerprint the command identity; use template lease only for provider concurrency.[ASSUMED: recommended rule]

### 2. Rewriting `request_snapshot_json` during update

**What goes wrong:** A late callback or retry can read a changed target/policy and attach old facts to new intent. `[VERIFIED: locked Phase 25 design; current snapshot read in repository/route]`

**How to avoid:** Keep snapshot immutable; update only allowlisted metadata or create a superseding task linked to the old task. `[VERIFIED: locked Phase 25 design]`

### 3. Merging task lifecycle and run execution status

**What goes wrong:** An archived task can appear successful because its latest run succeeded, or a cancelled run can make a superseded task look active. `[ASSUMED: failure mode from required separation]`

**How to avoid:** Return separate `task.lifecycle` and `run.status`; define list/detail projection rules for archived/superseded tasks.

### 4. Allowing late success after cancel or supersede

**What goes wrong:** Existing state machine recognizes `cancel_requested` and may classify a later success as `cancel_not_effective`; this is a valid provider race fact but it must not promote a newer task or availability projection. `[VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts:167-212]`

**How to avoid:** Bind callback to task id, run id, attempt, snapshot hash/lifecycle version and observation revision; preserve the late outcome in history and leave newer current projection unchanged. `[ASSUMED: additional binding fields]`

### 5. Treating a runner receipt as content availability

**What goes wrong:** Phase 20-24 established that metadata/receipt, source health and actual playback are independent facts. `[VERIFIED: Phase 20/24 archive evidence]`

**How to avoid:** Store availability status/reason/policy/observedAt/next action separately; never derive `ready` from exit code, HTTP 200, metadata success or magnet syntax. `[VERIFIED: .planning/REQUIREMENTS.md Out of Scope]`

### 6. Updating a current projection before append succeeds

**What goes wrong:** A current row can point to an observation that was never durably written, making readback and audit disagree. `[ASSUMED: failure mode]`

**How to avoid:** Use one repository-owned D1 batch/transaction boundary, then authoritative readback; zero conditional-update changes produce bounded stale/late history. `[VERIFIED: source-reconciliation implementation; cited D1 docs]`

### 7. Unbounded evidence through audit or summary JSON

**What goes wrong:** Existing generic audit `changes` and provider safe facts are easy to accidentally populate with raw runner/result objects. `[VERIFIED: apps/api/src/middleware/audit-logger.ts; packages/db/src/schema.ts:539-550]`

**How to avoid:** fixed allowlists, byte caps, finite row/count limits, redaction tests that scan keys and values, and bounded readback DTOs.

### 8. Paging archived rows or history without a bound

**What goes wrong:** `Crawlers.vue` already loads task detail and logs repeatedly; unbounded runs/audit/observation history increases D1 and browser payloads. `[VERIFIED: apps/dashboard/src/views/Crawlers.vue:392-462; apps/api/src/routes/admin/crawler-tasks/index.ts:1306-1330]`

**How to avoid:** cursor/limit every list, fixed history window in detail, explicit “load more” for logs/audit, and no raw observation expansion.

### 9. Copying historical `-x` Vitest commands

**What goes wrong:** Local Vitest 4.1.4 rejects `-x` with `Unknown option '-x'`. `[VERIFIED: local command on 2026-08-10]`

**How to avoid:** use `pnpm --filter api exec vitest run <file>` and package-scoped type-check; keep `-x` out of Phase 25 plan commands.

## Code Examples

### Existing closed route input

```ts
export const CreateCrawlerTaskSchema = v.strictObject({
  template: v.picklist(['movie', 'manga']),
})

adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const { template } = c.req.valid('json')
  // resolve session/resource, then call repository
})
```

This is the current pattern; Phase 25 should preserve strict input and replace the single template field with a registry-owned closed command contract.[VERIFIED: apps/api/src/schemas/crawler-tasks.ts:8-11; apps/api/src/routes/admin/crawler-tasks/index.ts:1101-1116] [CITED: https://hono.dev/docs/guides/validation]

### Existing task creation batch shape

```ts
await d1.batch([
  d1.prepare('INSERT INTO crawler_task (...) VALUES (...)').bind(...),
  d1.prepare('INSERT INTO crawler_run (...) VALUES (...)').bind(...),
  d1.prepare('INSERT INTO crawler_template_lease (...) VALUES (...)').bind(...),
  d1.prepare('INSERT INTO crawler_run_transition (...) VALUES (...)').bind(...),
])
```

The repository already uses this shape for task/run/lease/transition creation. Extend the same repository boundary for lifecycle/audit and availability writes; do not introduce route-local uncoordinated mutations.[VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts:1000-1056]

### Existing source CAS/readback shape

```sql
INSERT INTO movie_source_state (..., source_revision, ...)
VALUES (..., :nextRevision, ...)
ON CONFLICT(movie_id) DO UPDATE SET
  source_revision = excluded.source_revision,
  disposition = excluded.disposition
WHERE movie_source_state.source_revision = :currentRevision;
```

The current implementation also checks affected changes, retains append-only observation rows, and performs bounded authoritative readback. Use this as the Phase 25 generic projection pattern with an added policy/version/target tuple.[VERIFIED: apps/api/src/domain/movies/source-reconciliation.ts:447-506]

### Existing Dashboard API wrapper

```ts
listCrawlerTasks: (params) => apiFetch<CrawlerTaskListPage>(`/admin/crawler-tasks?...`),
getCrawlerTask: (taskId) => apiFetch<CrawlerTaskDetail>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`),
cancelCrawlerRun: (taskId, runId) => apiFetch(`/admin/crawler-tasks/${taskId}/runs/${runId}/cancel`, { method: 'POST' }),
```

Add wrappers for lifecycle commands and audit/availability projections here so `Crawlers.vue` continues to consume one typed client boundary.[VERIFIED: apps/dashboard/src/lib/api.ts:791-824]

## State of the Art

| Old/current approach | Phase 25 direction | Impact |
|---|---|---|
| Template-only create input | Closed server-owned operation + target/policy/intent command | Future checks/repairs can share one acceptance contract without exposing provider details. `[VERIFIED: current schema] [ASSUMED: direction]` |
| `movie_source_observation` only | Shared task-bound observation + current projection, with movie adapter retained | Phase 26-28 can bind facts consistently while Phase 21-24 readback remains stable. `[VERIFIED: current movie schema] [ASSUMED: direction]` |
| Run-centric detail | Separate task lifecycle, current run and immutable history/audit | Archive/supersede no longer destroys or rewrites execution evidence. `[VERIFIED: locked design]` |
| Generic audit changes JSON | Fixed crawler audit facts and task-scoped bounded readback | Reduces disclosure and payload growth while retaining operator history. `[VERIFIED: current audit implementation] [ASSUMED: direction]` |

**Deprecated/outdated for Phase 25 planning:** direct frontend port acceptance, client-provided provider routing fields, `players.length`/receipt success as availability, and `vitest run -x` in this workspace. `[VERIFIED: AGENTS.md; .planning/REQUIREMENTS.md; local Vitest probe]`

## Validation Commands And Test Map

`.planning/config.json` explicitly sets `workflow.nyquist_validation=false`, so the formal `Validation Architecture` section is omitted. The commands below are the concrete planner verification surface.[VERIFIED: .planning/config.json]

| Requirement | Focused test to add/extend | Command |
|---|---|---|
| TASK-01 | Strict operation registry/schema tests: accepted registered command, unknown operation, unknown fields, URL/workflow/command/secret rejection, immutable snapshot | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/operation-registry.test.ts` `[ASSUMED: new file]` |
| TASK-02 | Admin route list/detail projection tests for lifecycle, target, latest run/attempt, provider, receipt, logs, transition history | `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` `[VERIFIED: existing file]` |
| TASK-03 | Repository/migration tests for update allowlist, archive retention, supersede link, archived list filtering and child fact preservation | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/repository.test.ts packages/db/src/__tests__/crawler-task-migration.test.ts` `[ASSUMED: migration test path]` |
| TASK-04 | State/route tests for queued/running cancel, provider cancellation, late callback after cancel/supersede, snapshot/revision mismatch | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/state-machine.test.ts src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` `[VERIFIED: state-machine file; route test path should be checked]` |
| TASK-05 | Repository tests for same-key replay, key conflict, repeated cancel/retry, bounded retry and preserved old attempts/observations | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/reconciliation.test.ts` `[VERIFIED: existing files]` |
| TASK-06 | Audit writer/projection tests for fixed fields, actor/reason/outcome, task-scoped order/limit and redaction | `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/audit.test.ts apps/api/src/routes/admin/audit-logs/__tests__/audit-logs.route.test.ts` `[ASSUMED: new/checked paths]` |
| Availability contract | Observation duplicate/stale/late/conflict, CAS no-overwrite, bounded summary/readback, policy/source revision identity | `pnpm --filter api exec vitest run src/domain/movies/__tests__/source-reconciliation.test.ts src/domain/movies/__tests__/source-reconciliation.integration.test.ts src/domain/playback-evidence/__tests__/repository.test.ts` `[VERIFIED: existing files]` |
| Dashboard | Task lifecycle actions, current/history separation, polling preservation, no raw fields | `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` `[VERIFIED: existing file]` |

Before implementation, check every `[ASSUMED: new file/path]` above against the actual route/test layout; do not create aliases solely to match this research document. The current proven baseline commands are:

```powershell
pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/state-machine.test.ts
pnpm --filter api type-check
pnpm --filter @starye/db type-check
pnpm --filter dashboard exec vue-tsc --noEmit
pnpm check:services
```

The first command passed locally: 1 file, 6 tests. `[VERIFIED: local command 2026-08-10]`

Migration gate:

```powershell
pnpm --filter @starye/db drizzle-kit generate
Set-Location apps/api
pnpm exec wrangler d1 migrations apply starye-db --local
Set-Location ../..
pnpm --filter @starye/db type-check
pnpm --filter api type-check
```

Gateway acceptance gate:

```powershell
pnpm check:services
pnpm local:task-runner:e2e --target local --evidence-dir ABSOLUTE_EVIDENCE_DIR
```

Then authenticate a browser and inspect `http://localhost:8080/dashboard/crawlers`; API readback must use `http://localhost:8080/api/admin/crawler-tasks...`. Existing `apps/dashboard/playwright.config.ts` defaults to a direct Vite origin, so any Phase 25 canonical acceptance run must override `BASE_URL` or use the existing phase-proof browser context rather than accepting the default as evidence.[VERIFIED: scripts/check-services.ps1; scripts/local-task-runner.e2e.ts; apps/dashboard/playwright.config.ts; Phase 24 archive]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | Reuse Gateway dashboard guard, API session `requireSessionUser()` and existing auth middleware; do not accept bearer/service-token fallbacks for admin task operations. `[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:1047-1088; apps/gateway/src/dashboard-guard.ts]` |
| V3 Session Management | yes | Keep cookie/session state in the existing auth boundary; never put session, provider secret or signed callback material into task DTO, audit summary or evidence. `[VERIFIED: apps/api/src/lib/auth.ts; Phase 24 security]` |
| V4 Access Control | yes | Check task owner/resource/template before every detail, lifecycle, run, audit and observation read/write; reuse `requireTaskAccess`, `requireTaskRunAccess`, `canAccessCrawler`. `[VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts:1055-1088]` |
| V5 Input Validation | yes | Valibot strict objects, picklists/literals, bounded identifiers/counts/timestamps and server-owned registry. `[VERIFIED: apps/api/src/schemas/crawler-tasks.ts; apps/api/src/schemas/crawler-run-events.ts] [CITED: https://valibot.dev/guides/objects/]` |
| V6 Cryptography | yes | Reuse `verifyRunnerEventSignature`/existing HMAC boundary; use hashes only for deterministic identity/conflict checks; never implement callback signing or secret storage in Phase 25. `[VERIFIED: apps/api/src/domain/crawler-tasks/runner-event-auth.ts; .planning/milestones/v1.4-phases/23-github-actions-production-repair-and-reconciliation/23-02-PLAN.md]` |
| V7 Error Handling and Logging | yes | Return bounded reason/outcome codes, redact audit/log/evidence payloads, and avoid raw exception/provider response in D1 or Dashboard. `[VERIFIED: apps/api/src/domain/crawler-tasks/log-redaction.ts; apps/api/src/domain/playback-evidence/redaction.ts]` |

### Known Threat Patterns For This Stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Client supplies workflow/URL/command/secret | Tampering / Elevation | Strict operation registry and server-owned provider snapshot; reject unknown fields. |
| Replayed create/cancel/retry/callback | Tampering / Repudiation | Idempotency key + request fingerprint, unique event identity, transition sequence and bounded duplicate/conflict history. |
| Late result overwrites newer projection | Tampering | Task/run/attempt/content/source revision/policy binding plus D1 conditional CAS and committed readback. |
| Cross-template/task access | Elevation | Session resource guard plus task/run ownership joins before repository mutation/read. |
| Raw provider/evidence leakage | Information disclosure | Fixed allowlist, byte/count limits, redaction scan, no signed URLs/cookies/credentials/raw response/media. |
| Unbounded list/history/evidence | Denial of service | Cursor/limit, bounded logs/summary/history, indexes and hard readback caps. |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | API/D1/TypeScript/Vitest | yes | `v24.0.1` | — |
| pnpm | workspace scripts | yes | `10.33.0` | — |
| npm registry | version verification | yes | `11.3.0` | Use repository lockfile when registry version is newer. |
| Local Wrangler | D1 migration/service | yes via `pnpm exec` | `4.90.1` | Use package-local binary; global command is not required. |
| D1 local runtime | migration/readback tests | available through Wrangler config | `starye-db` binding | Existing mock/integration fixtures for unit tests. |
| Gateway | canonical browser/API acceptance | listening on `localhost:8080` at probe time | local | Start `pnpm dev`/project service entry if the listener is absent. |
| Docker | optional local service support | yes | `29.6.2` | Phase 25 has no Docker-specific dependency. |
| `@playwright/test` | Dashboard browser acceptance | installed in `apps/dashboard` | `1.59.1` | Use existing configured `pnpm --filter dashboard test:e2e`; do not rely on root `playwright` binary. |

Missing dependencies with no fallback: none for focused API/D1 planning. `[VERIFIED: local probes 2026-08-10]`

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | A generic shared availability table/projection should be added while movie-specific source tables remain as compatibility projections. | Summary / D1 schema | A migration or adapter plan could be larger than Phase 25 budget; planner must confirm ownership and table granularity. |
| A2 | Task lifecycle needs `active/archived/superseded` plus archive/supersede linkage and a lifecycle version. | Architecture Patterns / D1 schema | Different lifecycle vocabulary would affect routes, list filters, audit and UI labels. |
| A3 | Idempotency should use a canonical request fingerprint in addition to the existing user/key unique index. | Idempotency Pattern | Key replay conflict semantics and migration fields depend on this choice. |
| A4 | Crawler audit facts should reuse `audit_log` with new resource/index support unless boundedness requires a dedicated table. | Audit Recommendation | A dedicated table changes query/relations/migration scope. |
| A5 | Proposed operation lifecycle routes are `PATCH /:taskId`, `POST /:taskId/archive`, and `POST /:taskId/supersede`. | Operation API Recommendation | Route naming is not locked; planner must use the chosen aliases consistently across API client, AppType and tests. |
| A6 | Generic observation fields use `target_kind`, `target_id`, `content_id`, `source_revision`, `policy_version`, `summary_json`. | D1 schema | Future chapter/page target identity may require a different normalized key. |
| A7 | `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` and some proposed audit/migration test paths exist or should be created. | Test Map | The planner must verify exact paths before writing plan tasks; current inventory shows crawler-runs route tests under `apps/api/src/routes/internal/crawler-runs/__tests__` but does not show every proposed new file. |

## Open Questions

1. Which exact task lifecycle fields and action route shapes should be locked in CONTEXT before planning? Current code has no archive/supersede alias, so planner should choose one consistent API shape and record it as a decision.
2. Should generic availability current projection be a new table or a typed extension of `movie_source_state` plus future adapters? The shared future target kinds favor a new contract, while Phase 21 compatibility favors an adapter; resolve before migration tasks.
3. Does task “description/policy intent” need a separate mutable table/JSON column, or can bounded metadata columns cover the single-user Dashboard workflow? Keep it outside immutable `request_snapshot_json` either way.
4. Should task detail include all audit facts inline or a cursor-paged `/audit` child route? Existing logs already page separately; a separate bounded audit child route reduces detail payload growth.
5. What is the retention policy for availability observations and audit history? The locked boundary requires retaining historical facts, but a bounded retention/archival policy for old observations still needs a project decision before production migration.

## Sources

### Primary current-code sources

- `packages/db/src/schema.ts`, `packages/db/drizzle/0027_crawler_task_domain_foundation.sql` through `0031_playback_evidence.sql` — current tables, indexes, foreign keys and migration sequence. `[VERIFIED: codebase]`
- `apps/api/src/domain/crawler-tasks/{types.ts,template-registry.ts,state-machine.ts,repository.ts,receipt-validation.ts,log-redaction.ts}` — registry, snapshot, lifecycle, retry, receipt and bounded log seams. `[VERIFIED: codebase]`
- `apps/api/src/domain/movies/{source-contract.ts,source-reconciliation.ts}` — source revision, append observation, CAS current state, cache invalidation and readback. `[VERIFIED: codebase]`
- `apps/api/src/domain/playback-evidence/{types.ts,redaction.ts,repository.ts}` — tuple-bound bounded evidence and rejection history. `[VERIFIED: codebase]`
- `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/internal/crawler-runs/index.ts`, `apps/api/src/routes/admin/main/index.ts`, `apps/api/src/index.ts` — real route and mount points. `[VERIFIED: codebase]`
- `apps/dashboard/src/views/Crawlers.vue`, `apps/dashboard/src/lib/api.ts`, `apps/dashboard/playwright.config.ts` — Dashboard operations, DTO wrappers, polling and test baseline. `[VERIFIED: codebase]`
- `.planning/milestones/v1.4-phases/20-24/` relevant research/context/plan/summary/verification files — prior source, receipt, audit, Gateway and Dashboard patterns. `[VERIFIED: codebase]`

### Official documentation

- https://hono.dev/docs/guides/validation — validator targets, `c.req.valid`, content type and lower-case header validation. `[CITED: docs.hono.dev]
- https://valibot.dev/guides/objects/ — `object`/`looseObject`/`strictObject` behavior. `[CITED: valibot.dev]`
- https://developers.cloudflare.com/d1/worker-api/d1-database/ — D1 `prepare`, `batch`, `exec` Worker API surface. `[CITED: developers.cloudflare.com]`
- https://orm.drizzle.team/docs/transactions and https://orm.drizzle.team/docs/batch-api — Drizzle transaction/batch documentation. `[CITED: orm.drizzle.team]`
- https://vitest.dev/guide/ — current `vitest run` and test naming/configuration. `[CITED: vitest.dev]`
- https://playwright.dev/docs/auth — authenticated storage state sensitivity and shared-state test isolation guidance. `[CITED: playwright.dev]`

### Registry/environment evidence

- `npm view` checks on 2026-08-10 for `hono`, `hono-openapi`, `valibot`, `drizzle-orm`, `wrangler`, `vitest`, `@playwright/test`, `vue`; package legitimacy audit is not applicable because this phase installs no external package. `[VERIFIED: npm registry]`
- Local probes: `node --version`, `pnpm --version`, `pnpm exec wrangler --version`, `pnpm exec vitest --version`, Gateway port 8080 probe, and focused state-machine test. `[VERIFIED: local environment]`
- GitNexus `npx gitnexus analyze` completed on 2026-08-10; graphify CLI graph was absent before indexing, so no graphify semantic context was used. `[VERIFIED: tool output]`

## Metadata

**Confidence breakdown:**
- Current file/symbol/table map: HIGH — directly checked against current source, schema, routes, migration files and GitNexus index. `[VERIFIED: codebase]`
- Standard stack: MEDIUM — repository versions and npm registry versions were checked; no dependency upgrade is recommended. `[VERIFIED: npm registry]`
- Architecture and migration recommendation: MEDIUM — grounded in existing Phase 20-24 patterns and locked inputs, but generic availability table/lifecycle field names remain assumptions recorded above. `[VERIFIED: codebase] [ASSUMED: new contract details]`
- Security and pitfalls: MEDIUM — current redaction/auth/CAS implementations were inspected; new task lifecycle paths require implementation-time regression coverage. `[VERIFIED: codebase]`

**Research date:** 2026-08-10
**Valid until:** 2026-09-09 for repository architecture; recheck npm versions and Cloudflare/Drizzle docs before dependency or migration decisions.
