# Phase 21: Source Health And Local repair_players Vertical Slice - Research

**Researched:** 2026-08-06
**Domain:** Source-health projections, controlled crawler operations, local runner execution, and Gateway-backed repair readback
**Confidence:** HIGH for repository boundaries; MEDIUM for the new repair observation schema

<user_constraints>
## User Constraints (from CONTEXT.md)

以下内容逐字复制自 Phase 21 context，规划必须把这些决策视为锁定约束。[VERIFIED: 21-CONTEXT.md]

### Locked Decisions

#### Source health 展示粒度
- **D-01:** 每个源的健康投影使用有限稳定集：`sourceType` (`direct | magnet | TorrServer`)、`health` (`inactive | unverified | failed`)、`observedAt` 和 bounded reason。`ready` 继续由 Phase 20 的 source disposition 表达，browser playback proof 单独保留。
- **D-02:** `magnet` 是候选源类型，默认健康状态为 `unverified`，不会单独升级为 direct-ready。TorrServer、Aria2 等具体传输动作留在 Phase 22 的受控路径。
- **D-03:** `failed` 只呈现 bounded reason code 和对应中文文案。原始来源值、请求材料、页面内容、异常细节和签名材料留在服务端边界内。
- **D-04:** `inactive` 在 source health 列表中可见，用于解释数量差异；资格判断和默认播放候选只消费 eligible source。

#### Repair 入口和输入形状
- **D-05:** 实际修复 mutation 从 Dashboard 发起。MovieDetail 保留状态和引导入口，指向 Dashboard 的修复/任务状态；MovieDetail 本身只承担展示，不直接承担管理员 mutation。
- **D-06:** 使用专用后台接口 `POST /api/admin/crawler-tasks/repair-players`。请求只表达受控电影身份、当前 source disposition 对应的 `reason` 和固定 `targetIntent`；adapter、workflow、target、secret 由服务端 registry 和任务快照拥有。
- **D-07:** `reason` 只允许当前 source disposition 派生的 `no_source` 或 `source_failed`；`targetIntent` 固定为 `restore_playable_sources`，管理员不选择 direct、magnet 或 TorrServer 目标，也不填写自由文本原因。
- **D-08:** 发起 mutation 前使用二次确认。确认摘要只包含影片名称、当前受控原因和“恢复可播放源”意图，确认完成后才创建任务。
- **D-09:** 一个 `repair_players` 任务只绑定一部影片，便于保持 content identity、source revision 和 readback 的单一边界。

#### 本地 repair_players 执行契约
- **D-10:** 任务快照带独立 `operation: repair_players`，并由专用 adapter 注册表选择执行器。普通 movie crawler 与 repair adapter 保持显式分离，快照缺少匹配 operation 时进入受控失败。
- **D-11:** adapter 通过既有受控服务/API 边界提交 source observation；服务端负责持久化、派生 projection 和权威 readback。adapter 直接写数据层或以 runner 日志推断业务状态均不属于本阶段契约。
- **D-12:** 本地进程正常退出只是中间结果。任务进入 `succeeded` 前，服务端必须已经持久化本次 observation，且 runner 读回的同一影片 source health 与本次任务结果一致。
- **D-13:** 成功事件使用专用 repair receipt，至少绑定 `operation`、影片 ID、`sourceRevision`、`observedAt` 和有限 source summary；普通 movie receipt 的 `contentIds/templateKey` 形状单独保留，不能作为 repair 成功证明。

#### 失败、重试和旧事件保护
- **D-14:** 仅对明确归类的短暂执行、写入或 readback 故障自动新增一次 attempt。确定性输入/契约/源状态失败进入终态；人工重试创建新任务，并在创建前重新读取当前 source disposition。
- **D-15:** 事件处理绑定 `runId`、`attempt`、`sequence`、`eventId`，并校验任务关联的 source revision。完全相同的重复投递保持幂等；旧 attempt、乱序或内容冲突事件返回受控结果，当前 source health 只接受有效的新观察。
- **D-16:** 任务和 source health 的界面只显示有限状态、attempt/观察时间和受控失败原因，并给出当前允许的下一步动作；runner 原始输出不成为界面或外部证据的一部分。

### the agent's Discretion
- bounded reason code 的具体 allowlist、中文文案和 API schema 的字段命名细节，只要保持 D-01、D-03、D-07 的稳定边界。
- source observation 的存储表/DTO 拆分、CAS/readback 的具体实现、retryable code 的精确分类和本地 polling 时间，只要满足 D-12、D-14、D-15。
- Dashboard 与任务详情的间距、颜色、加载态和测试 fixture 组织；视觉实现沿用现有 dashboard 组件和状态投影模式。

### Deferred Ideas (OUT OF SCOPE)
- TorrServer、Aria2 和各 source type 的实际播放/切换动作 - Phase 22。
- GitHub Actions provider repair、生产 reconciliation 和迟到回调的完整闭环 - Phase 23。
- fresh production Dashboard -> Viewer -> actual playback proof - Phase 24。
- 更广泛内容类型的通用 repair 模板和高频全库自动重抓 - v2 requirements。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRC-02 | 用户可以查看每个受控播放源的 source 类型与有限健康信息；至少区分 direct、magnet、TorrServer、inactive、unverified 和 failed，并显示最近观察时间或受控失败原因。 | Extend the existing server-owned readiness projection with a bounded per-source observation read model; retain inactive rows for display while keeping eligibility separate. [VERIFIED: REQUIREMENTS.md + 21-CONTEXT.md] |
| REP-01 | 用户可以在 Dashboard 为已入库电影发起固定模板的 `repair_players` 任务；输入限定为受控电影身份、原因和目标意图，URL、命令、workflow 和 secrets 由服务端 registry 管理。 | Add the dedicated admin route, server-owned operation snapshot, operation-specific adapter, confirmation client, and authoritative observation/readback receipt. [VERIFIED: REQUIREMENTS.md + 21-CONTEXT.md] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 默认使用中文沟通、分析、验证和交付结论。[VERIFIED: AGENTS.md]
- 改仓库前先走 GSD 工作流；本次输出属于 Phase 21 research，后续实现应由 `$gsd-plan-phase` / `$gsd-execute-phase` 继续。[VERIFIED: AGENTS.md]
- 本地验证必须经 `http://localhost:8080/...` canonical Gateway，不把 API、Vite 或其他直连端口当作 canonical URL。[VERIFIED: AGENTS.md + apps/gateway/src/index.ts]
- 更新文档只改 canonical owner；本文件属于当前 phase 的 canonical planning artifact。[VERIFIED: AGENTS.md + docs/documentation-ownership.md]
- 保留工作树中的无关改动，不回滚、覆盖或顺手清理 `AGENTS.md`、`CLAUDE.md` 等现有改动。[VERIFIED: AGENTS.md + git status]
- 修改代码 symbol 前先做 GitNexus impact analysis；若为 HIGH/CRITICAL 必须先告警；提交前必须运行 GitNexus detect-changes。[VERIFIED: AGENTS.md + CLAUDE.md]
- `CLAUDE.md` 是兼容适配层，AGENTS.md 是 canonical agent 文档；冲突时以 AGENTS.md 为准。[VERIFIED: CLAUDE.md]

## Summary

Phase 20 已建立 server-owned movie readiness：`ready/no_source/source_failed/repairing`、bounded reason、source revision、validated receipt 和独立 playback proof。目前 `source-contract.ts` 仍是电影级 projection，`player` 表只有 URL/active/sort/评分等字段；因此 Phase 21 的核心增量是增加 per-source bounded health observation，同时保持 `ready` 与 browser playback proof 的独立语义。[VERIFIED: apps/api/src/domain/movies/source-contract.ts; packages/db/src/schema.ts; Phase 20 summary/verification]

现有 crawler control plane 已经具备 task/run/attempt、lease、CAS transition、runner event replay/conflict、manual retry 和安全 receipt projection。当前 registry、snapshot、runner client 和 local adapter 都按 `movie|manga` template 选择，admin 只有通用 `POST /api/admin/crawler-tasks`；因此 repair 需要 operation 级快照和显式 adapter 分支，不能把 repair 输入伪装成普通 movie crawl，也不能用进程退出码或普通 `contentIds/templateKey` receipt 证明业务成功。[VERIFIED: apps/api/src/domain/crawler-tasks/template-registry.ts; apps/api/src/domain/crawler-tasks/repository.ts; apps/api/src/routes/admin/crawler-tasks/index.ts; packages/crawler/src/task-runner/local-runner.ts; packages/crawler/src/task-runner/runner-client.ts]

**Primary recommendation:** 在现有 `movie_source_state` current projection 旁增加受控、不可变的 source observation/repair facts；以 `operation: repair_players + movieId + sourceRevision + runId/attempt` 作为单电影边界，专用 adapter 通过受控 API 写入并由服务端 authoritative readback 后才发出专用 repair receipt。[ASSUMED: new schema and operation contract are planning recommendations]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-source health projection | API / Backend | Database / Storage | The API must enforce bounded fields, eligibility semantics, and redaction; D1 stores immutable observation facts and the current movie projection. [VERIFIED: 21-CONTEXT.md; apps/api/src/domain/movies/source-contract.ts] |
| Repair command validation and task creation | API / Backend | Browser / Client | The Dashboard confirms and submits only constrained identity/reason/intent; the API re-reads current disposition and owns operation/template/target/workflow/secrets. [VERIFIED: 21-CONTEXT.md; apps/api/src/routes/admin/crawler-tasks/index.ts] |
| Local repair execution | API / Backend | Runner process | The API owns observation persistence/readback and terminal receipt validation; the runner invokes a dedicated adapter and reports signed lifecycle events. [VERIFIED: 21-CONTEXT.md; packages/crawler/src/task-runner/local-runner.ts; apps/api/src/routes/internal/crawler-runs/index.ts] |
| Task/run/attempt audit lifecycle | Database / Storage | API / Backend | Existing D1 tables and repository own leases, state versions, event sequences, receipts, logs, and retry attempts. [VERIFIED: packages/db/src/schema.ts; apps/api/src/domain/crawler-tasks/repository.ts] |
| Dashboard repair UX and status | Browser / Client | API / Backend | Dashboard owns confirmation and polling; API read models remain the source of truth for status and bounded failure text. [VERIFIED: 21-CONTEXT.md; apps/dashboard/src/views/Crawlers.vue] |
| MovieDetail guide/cache freshness | API / Backend | Browser / Client; CDN / Static | MovieDetail only displays status/guidance, while API/Gateway cache invalidation must make the same movie identity observe the new projection. [VERIFIED: 21-CONTEXT.md; apps/api/src/middleware/cache.ts; apps/api/src/lib/gateway-cache.ts; apps/gateway/src/cache-middleware.ts] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript workspace | 6.0.2 | Shared API, runner, schema and UI contracts | Repository packages are TypeScript-first and use shared typed DTOs. [VERIFIED: package.json; existing source files] |
| Hono | 4.12.14 | API and internal runner routes | Existing API route composition and Gateway proxy use Hono. [VERIFIED: apps/api/package.json; apps/api/src/routes/admin/crawler-tasks/index.ts] |
| Hono OpenAPI validator | 1.3.0 | Request schema validation | Existing crawler route uses `validator('json', ...)` and schema modules. [VERIFIED: apps/api/package.json; apps/api/src/routes/admin/crawler-tasks/index.ts] |
| Valibot | 1.3.1 | Allowlisted repair input and runner event schema | Existing API schemas and signed event parsing use the workspace validation stack. [VERIFIED: apps/api/package.json; apps/api/src/schemas/crawler-tasks.ts; apps/api/src/routes/internal/crawler-runs/index.ts] |
| Drizzle ORM + Cloudflare D1 | 0.45.2 | Schema, migration and D1-backed persistence | The current schema and source reconciliation use Drizzle, while crawler repository uses the D1 client for CAS-sensitive SQL. [VERIFIED: apps/api/package.json; packages/db/package.json; packages/db/src/schema.ts; apps/api/src/domain/movies/source-reconciliation.ts] |
| Vue | 3.5.32 | Dashboard confirmation/status UI | Existing Dashboard views are Vue SFCs with typed API clients and Vitest fixtures. [VERIFIED: apps/dashboard/package.json; apps/dashboard/src/views/Crawlers.vue] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.4 | API, repository, runner and Dashboard regression tests | Use focused tests at each wave; existing phase tests already cover source contract, receipts, routes, repository and local runner. [VERIFIED: package.json; existing test paths] |
| pnpm | 10.33.0 | Workspace scripts and focused package commands | Use the repository's existing package filters and scripts. [VERIFIED: package.json] |
| Wrangler | 4.90.1 installed | Local Worker/D1/Gateway development and checks | Use the existing local dev entry and Gateway, not a new server harness. [VERIFIED: command probe; package.json] |

**Installation:** No new external package is recommended; reuse the workspace dependencies and add no package-install task. [VERIFIED: package.json manifests + phase scope]

**Package Legitimacy Audit:** Not applicable because this phase has no planned external package installation. [VERIFIED: package.json manifests]

## Architecture Patterns

### System Architecture Diagram

The recommended vertical flow is: Dashboard confirmation -> dedicated admin route -> current movie/disposition read -> server-owned `repair_players` task snapshot -> D1 queued run -> local runner poll/claim -> dedicated repair adapter -> controlled source-observation API -> D1 observation + current projection -> authoritative readback -> repair receipt -> signed terminal event -> Dashboard task/readiness polling. [VERIFIED: 21-CONTEXT.md; existing route/repository/runner files] [ASSUMED: new observation endpoint and receipt branch]

```text
Dashboard
  -- movieId + reason + fixed targetIntent + confirmation -->
Admin repair route
  -- session/resource check + current disposition/CAS -->
Task snapshot { operation: repair_players, movieId, sourceRevision, server-owned target }
  --> crawler_task/run/attempt state machine
  --> LocalTaskRunner poll -> claim -> heartbeat
  --> repair_players adapter
  -- controlled API observation write -->
Server observation service
  --> append observation fact + update movie_source_state
  --> authoritative readback of movie/player/source observation
  --> validated repair receipt
  --> signed runner terminal event + safe Dashboard projection
```

### Recommended Project Structure

Existing files are the primary implementation seams; new filenames below are recommendations and require planner confirmation. [VERIFIED: existing paths] [ASSUMED: new filenames]

```text
packages/db/src/schema.ts                              # source observation + operation bindings
packages/db/drizzle/0030_source_health_repair.sql     # additive D1 migration
apps/api/src/domain/movies/source-contract.ts          # source type/health DTO and allowlists
apps/api/src/domain/movies/source-reconciliation.ts    # write/readback/projection integration
apps/api/src/domain/crawler-tasks/types.ts             # operation and repair receipt unions
apps/api/src/domain/crawler-tasks/template-registry.ts # server-owned operation snapshot registry
apps/api/src/domain/crawler-tasks/receipt-validation.ts# repair receipt validation/readback
apps/api/src/domain/crawler-tasks/repository.ts        # task creation, CAS, retry, event binding
apps/api/src/routes/admin/crawler-tasks/index.ts       # POST repair-players and safe read model
apps/api/src/routes/internal/crawler-runs/index.ts     # operation-aware runner callbacks
packages/crawler/src/task-runner/repair-adapter.ts     # dedicated local adapter
packages/crawler/src/task-runner/template-adapters.ts  # operation-aware registry selection
packages/crawler/src/task-runner/runner-client.ts      # repair receipt/event envelope
apps/dashboard/src/lib/api.ts                         # typed repair command/read models
apps/dashboard/src/views/Crawlers.vue                  # confirmation, status, source health
apps/dashboard/src/views/__test__/Crawlers.test.ts     # bounded UI and command tests
apps/movie-app/src/views/MovieDetail.vue               # informational status/guidance only
```

### Pattern 1: Append-only observation plus current projection

**What:** Persist one bounded observation fact per accepted source observation, then atomically update `movie_source_state` as the current projection. The read DTO exposes only `sourceType`, `health`, `observedAt`, bounded reason, source revision, and eligibility; raw origin values and execution materials remain server-side. [ASSUMED: recommended schema shape]

**When to use:** Use for repair success, source failure, retry, stale-event rejection, and UI history where the latest state must be readable without losing the accepted prior observation. [VERIFIED: D-11 through D-16 in 21-CONTEXT.md]

**Example:**

```typescript
type SourceHealth = 'inactive' | 'unverified' | 'failed'
type SourceType = 'direct' | 'magnet' | 'TorrServer'

interface BoundedSourceObservation {
  movieId: string
  operation: 'repair_players' | 'source_read'
  runId: string
  attempt: number
  sourceRevision: number
  sourceType: SourceType
  health: SourceHealth
  observedAt: number
  reasonCode: 'no_source' | 'source_failed' | 'source_unverified' | null
}
```

The exact table/DTO names are discretionary, but the server should accept the observation only when run/attempt/sourceRevision match the current task snapshot and should derive the UI projection from persisted facts rather than runner output. [VERIFIED: D-11, D-13, D-15] [ASSUMED: field names shown in example]

### Pattern 2: Operation-discriminated task snapshots

**What:** Preserve `templateKey: movie` for movie permission/read-model compatibility, and add an independent operation discriminator in the immutable task snapshot/registry. Select the repair adapter by operation plus snapshot validation; a missing or mismatched operation fails closed. [VERIFIED: D-10; existing template registry pattern] [ASSUMED: preserve-template/add-operation implementation]

**When to use:** Use for task creation, local runner selection, receipt validation, manual retry, and future provider dispatch. Do not let a `movie` template silently select the ordinary movie crawler adapter for a repair task. [VERIFIED: D-10; packages/crawler/src/task-runner/template-adapters.ts]

```typescript
interface RepairTaskSnapshot {
  operation: 'repair_players'
  templateKey: 'movie'
  templateVersion: 1
  movieId: string
  reason: 'no_source' | 'source_failed'
  targetIntent: 'restore_playable_sources'
  sourceRevision: number
}

function selectAdapter(snapshot: RunnerSnapshot): TaskRunnerAdapter {
  if (snapshot.operation !== 'repair_players')
    return movieCrawlerAdapter
  return repairPlayersAdapter
}
```

The actual registry must validate entrypoint/version and server-owned target fields before this selection; the code above is a planning shape, not a drop-in contract. [VERIFIED: existing registry fail-closed behavior] [ASSUMED: repair snapshot fields]

### Pattern 3: Authoritative readback before terminal success

**What:** The repair adapter reports controlled execution progress, but the API performs the observation write and reads back the same movie identity, source revision, observedAt and bounded source summary before accepting a `repair_succeeded` terminal event. [VERIFIED: D-11 through D-13; Phase 20 receipt-validation behavior]

**When to use:** Apply to success, retryable write/readback errors, and duplicate terminal events. A process exit of 0, a populated movie row, or an ordinary movie receipt is insufficient. [VERIFIED: D-12/D-13; Phase 20 verification]

```typescript
const observation = await sourceObservationService.accept(input)
const readback = await sourceObservationService.readback({
  movieId: input.movieId,
  sourceRevision: input.sourceRevision,
})

if (!readback.matches(observation))
  return { kind: 'failed', code: 'repair_readback_conflict' }

return { kind: 'succeeded', receipt: createRepairReceipt(observation, readback) }
```

The concrete comparison must be field-by-field and bounded; do not compare raw URLs, page bodies or exception text in the public receipt. [VERIFIED: D-03/D-13/D-16] [ASSUMED: service method names]

### Pattern 4: Existing event identity and CAS as the outer guard

**What:** Reuse the repository's `runId`, attempt number, sequence, event ID, nonce/body hash, state version and source revision checks. Exact replay returns the stored outcome; same event identity with different body, stale attempt, wrong sequence, or conflicting source revision becomes a safe duplicate/conflict/ignored result. [VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts; apps/api/src/routes/internal/crawler-runs/index.ts]

**When to use:** Apply before source mutation and before terminal receipt persistence, especially when a local runner retries HTTP delivery or a manual retry creates a new run. [VERIFIED: D-14/D-15]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task lifecycle, leases and retry attempts | A second queue or ad-hoc status table | Existing crawler repository/state machine and D1 run tables | Existing code already has state versions, leases, manual retry and terminal transitions. [VERIFIED: repository.ts; state-machine.ts] |
| Event replay/conflict handling | A boolean `processed` flag | Existing runner event identity/body-hash/sequence logic | It distinguishes exact duplicate from content conflict and preserves audit outcome. [VERIFIED: repository.ts; crawler_runner_event schema] |
| Source readiness | UI-side counting of player rows or URLs | `deriveSourceReadiness` plus server-owned `movie_source_state` | Phase 20 established active non-empty eligibility and bounded disposition. [VERIFIED: source-contract.ts; source-reconciliation.ts] |
| Repair success | Ordinary movie `contentIds/templateKey` receipt | A discriminated repair receipt validated against observation/readback | Repair must prove source observation for one movie, not merely metadata identity. [VERIFIED: D-13; receipt-validation.ts] |
| Input redaction | Filtering sensitive values after logging | Allowlisted request DTO and safe projection at the API boundary | Raw origin/request/page/exception/signature material must never enter UI evidence. [VERIFIED: D-03/D-16; Phase 20 verification] |
| Local Gateway verification | Directly calling 8787/5173 as canonical proof | `http://localhost:8080` plus existing local runner/E2E harness | AGENTS.md defines Gateway as the local canonical entry and existing E2E uses that origin. [VERIFIED: AGENTS.md; scripts/local-task-runner.e2e.ts] |

**Key insight:** The difficult part is not adding a `repair_players` button. It is preserving one movie identity and source revision across command, task snapshot, runner attempt, observation write, readback, receipt and UI projection; existing control-plane primitives should own those transitions. [VERIFIED: Phase 20 boundaries and existing crawler control plane] [ASSUMED: operation-binding design]

## Common Pitfalls

### Pitfall 1: Treating source type as playback proof

**What goes wrong:** A magnet or direct URL is shown as ready, or a source health row is treated as browser playback success. [VERIFIED: D-01/D-02; Phase 20 verification]

**How to avoid:** Keep `source.health` separate from movie `source.disposition` and `playback.status`; default magnet to `unverified`, and leave `canplay/playing/currentTime` proof to later phases. [VERIFIED: D-01/D-02; STATE.md]

### Pitfall 2: Letting inactive sources affect eligibility

**What goes wrong:** The UI explains inactive rows but the API or Player counts them as playable. [VERIFIED: D-04; source-contract.ts]

**How to avoid:** Preserve inactive observations for display and use one server-side eligible predicate for counts and actions. Add fixtures containing active, inactive and blank-source rows. [VERIFIED: D-04; Phase 20 tests] [ASSUMED: fixture extension]

### Pitfall 3: Allowing client-selected URL, target, workflow or secret

**What goes wrong:** A repair request becomes an arbitrary command or source injection surface. [VERIFIED: D-06/D-07; REQUIREMENTS.md out-of-scope table]

**How to avoid:** Validate only canonical movie identity, current disposition-derived reason and the literal `restore_playable_sources`; derive adapter, target, workflow and secrets from the server registry/snapshot. [VERIFIED: D-06/D-07]

### Pitfall 4: Using stale client disposition at mutation time

**What goes wrong:** A Dashboard opened on `no_source` creates a repair after another operation has changed the movie to ready, failed, or a newer source revision. [ASSUMED: concurrency scenario]

**How to avoid:** Re-read the canonical movie and current source projection inside task creation, reject mismatched reason/source revision, and only then create the task. Manual retry must repeat the re-read. [VERIFIED: D-07/D-14/D-15] [ASSUMED: route CAS implementation]

### Pitfall 5: Treating adapter completion as success

**What goes wrong:** A runner exits cleanly while observation persistence or readback failed. [VERIFIED: D-12]

**How to avoid:** Make server persistence/readback the prerequisite for the dedicated repair receipt; classify read/write/readback failures explicitly and auto-retry only the bounded transient set once. [VERIFIED: D-12/D-14] [ASSUMED: exact retry allowlist]

### Pitfall 6: Old or conflicting events overwrite current source state

**What goes wrong:** A late callback from an earlier attempt writes a stale source observation after a newer repair. [VERIFIED: D-15; repository event replay/conflict code]

**How to avoid:** Bind every observation and event to runId/attempt/sequence/eventId/sourceRevision, use CAS, and store ignored/conflict outcomes without applying the mutation. [VERIFIED: D-15; repository.ts]

### Pitfall 7: Cache serves the pre-repair MovieDetail

**What goes wrong:** D1 has the new source observation but API detail or Gateway KV still returns the old source state. [VERIFIED: apps/api/src/middleware/cache.ts; apps/api/src/lib/gateway-cache.ts; apps/gateway/src/cache-middleware.ts]

**How to avoid:** Include explicit invalidation/read-after-write verification for the movies cache group and detail cache path; verify through `http://localhost:8080` using the same movie identity. [VERIFIED: existing movie sync/admin cache handlers; AGENTS.md] [ASSUMED: exact repair invalidation placement]

### Pitfall 8: Leaking raw runner/source material through logs or receipts

**What goes wrong:** URLs, page content, exception details, cookies, tokens, signed materials or raw runner output appear in D1 JSON, task detail, Dashboard or evidence files. [VERIFIED: D-03/D-16; Phase 20 receipt projection]

**How to avoid:** Use allowlisted bounded reason/source summary fields, server-side redaction, and tests that assert sensitive sentinel values are absent from every public response and repair receipt. [VERIFIED: Phase 20 tests/patterns] [ASSUMED: new sentinel coverage]

### Pitfall 9: Mixing business retry, automatic attempt and manual retry

**What goes wrong:** The same movie repair is executed multiple times or an old success is attached to a new attempt. [VERIFIED: D-14/D-15; existing manual retry repository path]

**How to avoid:** Automatic retry is at most one new attempt for explicitly transient failures; manual retry creates a new task after current-state re-read; callback transport retry reuses event identity. [VERIFIED: D-14/D-15] [ASSUMED: exact state-machine extension]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Metadata/receipt existence implied playable content | Separate metadata, source readiness, receipt and playback proof projections | Phase 20 | Phase 21 must extend the source projection without collapsing layers. [VERIFIED: Phase 20 summary/verification] |
| Movie crawler template selected all movie execution | Operation-discriminated snapshot selects ordinary movie crawler or repair adapter | Phase 21 recommendation | Prevents repair inputs from selecting the wrong executor. [ASSUMED: new Phase 21 design] |
| Current movie source state only | Bounded source observation facts plus current projection | Phase 21 recommendation | Supports observedAt, inactive visibility, retry history and stale-event protection. [ASSUMED: new Phase 21 design] |
| Process/runner output represented success | Authoritative source observation/readback binds a repair receipt | Phase 21 locked contract | Makes repair success auditable at the source boundary. [VERIFIED: D-11 through D-13] |

**Deprecated/outdated:**

- Treating `players=0` or a normal movie receipt as proof of playback is rejected by Phase 20 and must stay out of Phase 21. [VERIFIED: Phase 20 verification]
- Sending arbitrary command/workflow/URL/secret fields from Dashboard is outside the v1.4 contract. [VERIFIED: REQUIREMENTS.md; D-06/D-07]
- Using direct API/Vite ports as the canonical local verification URL violates the repository Gateway rule. [VERIFIED: AGENTS.md]

## Focused Verification Targets

Validation Architecture is intentionally omitted because `.planning/config.json` explicitly sets `workflow.nyquist_validation` to `false`. [VERIFIED: .planning/config.json]

| Area | Existing test seam | Phase 21 additions to plan |
|------|--------------------|----------------------------|
| Source contract | `apps/api/src/domain/movies/__tests__/source-contract.test.ts` | Test source type classification, magnet default `unverified`, inactive visibility, bounded health reasons, and projection/readback identity. [VERIFIED: existing path; D-01/D-04] |
| Source persistence/migration | `apps/api/src/domain/movies/__tests__/source-reconciliation.test.ts`, DB migration tests | Test append/current projection, revision increment, readback, CAS rejection and migration schema. [VERIFIED: existing source reconciliation and DB patterns] [ASSUMED: new test names] |
| Repair receipt | `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` | Test repair receipt discriminator, required operation/movie/revision/observedAt/summary, ordinary receipt rejection, and sensitive-field redaction. [VERIFIED: existing path; D-13/D-16] |
| Task repository | `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts` | Test server-owned snapshot, one-movie binding, source revision, automatic one-attempt retry, manual new task, duplicate/conflict/stale event outcomes. [VERIFIED: existing path; D-14/D-15] |
| Admin route | `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | Test session/resource guard, exact `POST /api/admin/crawler-tasks/repair-players`, current disposition/reason, fixed intent, and rejection of URL/command/workflow/secrets. [VERIFIED: existing path; D-05 through D-08] |
| Internal runner route | `apps/api/src/routes/internal/crawler-runs/__tests__/crawler-runs.route.test.ts` | Test operation-aware candidate, signed event identity, source revision mismatch and exact replay/conflict behavior. [VERIFIED: existing path; D-15] |
| Local runner | `packages/crawler/src/task-runner/__tests__/local-runner.test.ts`, `template-adapters.test.ts` | Test dedicated repair adapter selection, missing operation fail-closed, controlled API call, receipt handoff and cancellation. [VERIFIED: existing paths; D-10 through D-12] |
| Dashboard | `apps/dashboard/src/views/__test__/Crawlers.test.ts` | Test second confirmation, bounded status/readback fields, no raw inputs, attempt/observedAt and task polling. [VERIFIED: existing path; D-08/D-16] |
| MovieDetail | `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts` | Keep guidance/status-only behavior; assert no direct admin mutation is introduced. [VERIFIED: Phase 20 summary; D-05] |
| Gateway vertical proof | `scripts/local-task-runner.e2e.ts`, Gateway cache tests | Add a local repair fixture that starts from SUN-064/no-source, posts through `http://localhost:8080`, reads the same movie identity, and proves fresh source observation/readback. [VERIFIED: existing E2E/Gateway patterns; D-12] [ASSUMED: new fixture extension]

## Execution Wave and Dependency Split

The following wave split is recommended so each later surface consumes a stable contract. It is a planning recommendation, not an implemented dependency graph. [ASSUMED]

| Wave | Scope | Dependencies | Exit evidence |
|------|-------|--------------|---------------|
| Wave 0 | Define source-health/repair types, bounded reason allowlists, receipt union, operation snapshot shape, additive D1 schema/migration | Phase 20 contracts and schema | Contract tests and migration tests establish fields, enums, identity and redaction rules. [VERIFIED: Phase 20 patterns] [ASSUMED: new contract] |
| Wave 1 | API observation service, repository task creation/CAS/readback, admin repair route, internal callback operation binding | Wave 0 | Route/repository tests show server-owned fields, current disposition check, one movie, fixed intent and authoritative readback. [VERIFIED: existing route/repository seams] [ASSUMED: new implementation] |
| Wave 2 | Local repair adapter, runner client receipt envelope, operation-aware registry, retry/stale/conflict handling | Wave 1 | Local runner and internal route tests show dedicated adapter, bounded retry, exact replay and stale source revision protection. [VERIFIED: existing runner seams] [ASSUMED: new operation branch] |
| Wave 3 | Dashboard confirmation and task/source-health read model; MovieDetail informational handoff; cache invalidation/readback display | Wave 1/2 | UI tests show no arbitrary fields, confirmation before mutation, bounded statuses and same movie identity. [VERIFIED: Phase 20 UI patterns] [ASSUMED: new UI behavior] |
| Wave 4 | Canonical Gateway local vertical slice and focused type/test checks | Waves 0-3 | Fresh local proof records command -> run/attempt -> repair receipt -> source observation -> same-movie readback through `http://localhost:8080`. [VERIFIED: AGENTS.md; existing local E2E] [ASSUMED: new evidence fixture] |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API, runner, scripts, tests | ✓ | 24.0.1 | — [VERIFIED: command probe] |
| pnpm | Workspace commands | ✓ | 10.33.0 | — [VERIFIED: command probe] |
| Wrangler | Worker/Gateway local tooling | ✓ | 4.90.1 | — [VERIFIED: command probe] |
| Vitest | Focused regression tests | ✓ | 4.1.4 | — [VERIFIED: command probe] |
| Docker | Optional local service support | ✓ | 29.6.1 | — [VERIFIED: command probe] |
| Local Gateway | Canonical vertical-slice entry | Expected at `http://localhost:8080` | Existing repository entry | Start with `pnpm dev:clean`; verify with a Gateway request before proof. [VERIFIED: AGENTS.md; package.json] |
| Local API/Vite services | Gateway proxy targets | Expected on existing local dev ports | Repository-configured | Do not use their direct URLs as proof; use Gateway. [VERIFIED: apps/gateway/src/index.ts; AGENTS.md] |

**Missing dependencies with no fallback:** None identified for local contract research. The local session cookie, runner config and callback secret remain required ignored files for the E2E command, and their values must stay out of chat/evidence. [VERIFIED: scripts/local-task-runner.e2e.ts; D-03/D-16]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set it to `false`; this phase must keep the existing authenticated admin and signed runner boundaries. [VERIFIED: .planning/config.json; AGENTS.md]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Reuse `requireSessionUser` and existing session auth; reject bearer/service-token substitution on the admin route. [VERIFIED: admin crawler route tests and implementation] |
| V3 Session Management | yes | Keep Dashboard mutation behind the existing authenticated session and do not put callback secrets in browser state. [VERIFIED: D-03/D-06; existing route auth] |
| V4 Access Control | yes | Reuse crawler template/resource permission checks and require movie access for the operation; route must verify the target movie identity. [VERIFIED: `requireTemplateAccess`, `canAccessCrawler`, existing route tests] |
| V5 Input Validation | yes | Use the existing Hono validator + Valibot schema; allow only canonical movie identity, `no_source|source_failed`, and literal `restore_playable_sources`; reject extra command/URL/workflow/secret-shaped fields. [VERIFIED: existing schemas/tests; D-06/D-07] |
| V6 Cryptography | yes | Reuse `runner-event-auth`/`event-signer` for callback authentication and body hashing; do not hand-roll signatures or persist signature material in receipts. [VERIFIED: existing runner auth/event-signer; D-03/D-15] |
| V8 Data Protection | yes | Keep raw source origin, request materials, page content, exception details and signed material on the server boundary; project only bounded fields to Dashboard/evidence. [VERIFIED: D-03/D-16; Phase 20 verification] |

### Known Threat Patterns for Hono + D1 + local runner

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client supplies command, URL, workflow or target | Tampering / Elevation | Allowlist schema plus server-owned operation snapshot and registry. [VERIFIED: D-06/D-07] |
| Stale repair overwrites newer source | Tampering | CAS on source revision and run/attempt identity before observation mutation. [VERIFIED: D-15] [ASSUMED: implementation extension] |
| Replay/conflicting signed callback | Tampering / Repudiation | Existing eventId/nonce/body hash/sequence repository rules, with safe duplicate/conflict result. [VERIFIED: repository.ts; internal crawler-runs route] |
| Raw source/runner material enters task detail | Information disclosure | Bounded DTO projection and sentinel redaction tests. [VERIFIED: D-03/D-16; Phase 20 tests] |
| Unauthorized movie repair | Elevation | Existing session + resource check, canonical movie lookup and disposition gate. [VERIFIED: admin route patterns] [ASSUMED: new movie lookup gate] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new observation should use an append-only fact plus current projection rather than replacing `movie_source_state` with a history table. | Architecture Patterns / Wave 0 | Planner may select a schema that cannot explain retries or stale-event outcomes. |
| A2 | `crawler_task.template_key` can remain `movie` for permissions while a new operation discriminator lives in the task snapshot/schema. | Architecture Patterns | A migration may instead require a new template enum or separate operation table, affecting every task read path. |
| A3 | The repair receipt needs a discriminator/version separate from the ordinary movie receipt. | Pattern 3 / receipt validation | Reusing receipt v2 could let ordinary content receipts masquerade as source repair success. |
| A4 | Repair success should invalidate both API detail/cache state and the Gateway movies cache group before the vertical proof. | Pitfall 7 / Wave 3 | A successful D1 mutation could remain invisible to the canonical Gateway read. |
| A5 | The exact retryable error allowlist can be bounded to one automatic additional attempt without expanding REP-02/Phase 23 scope. | Pitfall 5 / Wave 2 | Over-broad retries can duplicate source mutations or hide deterministic failures. |
| A6 | The proposed new file names and DTO field names are implementation conveniences, not locked decisions. | Project Structure / Code Examples | Planner should adjust names to existing exports without changing the locked semantics. |

## Open Questions

1. **Where should the operation discriminator be stored?** Existing `crawler_task` has `template_key` and `request_snapshot_json`, while D-10 requires an independent `operation`. [VERIFIED: packages/db/src/schema.ts; D-10]
   - What we know: The snapshot is already server-owned and `templateKey` currently drives permission/read-model logic. [VERIFIED: template-registry.ts; admin route]
   - What's unclear: Whether to add a normalized `operation` column, extend the snapshot only, or add an operation registry table. [ASSUMED: design choice]
   - Recommendation: Prefer a normalized operation discriminator plus snapshot copy if it keeps list/detail queries simple; otherwise keep it in the immutable snapshot with a single validated parser. [ASSUMED]

2. **What is the controlled observation API boundary?** [VERIFIED: D-11; existing `/api/movies/sync` controlled service boundary]
   - What we know: Existing source writes flow through `reconcileMovieSources`; runner callbacks already have signed internal endpoints. [VERIFIED: source-reconciliation.ts; internal crawler-runs route]
   - What's unclear: Whether repair adapter should call a new internal observation route or a service-layer method exposed through an existing sync route. [ASSUMED]
   - Recommendation: Add a dedicated operation-aware internal endpoint/service method so ordinary sync and repair observation cannot be confused, while reusing the same reconciliation/readback core. [ASSUMED]

3. **How are existing player URLs classified without exposing them?** [VERIFIED: players currently store `sourceUrl`; JavDB/JavBus extraction currently produces magnet-like sources per repository research]
   - What we know: D-01 requires direct/magnet/TorrServer and D-02 requires magnet default `unverified`; actual transfer/playback actions are deferred. [VERIFIED: D-01/D-02]
   - What's unclear: The exact server-side classifier and whether a future TorrServer marker is stored separately from URL data. [ASSUMED]
   - Recommendation: Use a server-side normalized source-type classifier with an explicit `unknown`/failure path kept out of the public enum, and persist only the bounded type/health projection. [ASSUMED]

4. **Which movie detail caches must be invalidated after repair?** [VERIFIED: API `detailCache`, Gateway movies cache group and existing movie sync invalidation]
   - What we know: The repository has separate API middleware and Gateway KV cache helpers. [VERIFIED: apps/api/src/middleware/cache.ts; apps/api/src/lib/gateway-cache.ts; apps/gateway/src/cache-middleware.ts]
   - What's unclear: Which cache keys are populated by the active local Gateway session and whether a repair endpoint should clear a group or targeted keys. [ASSUMED]
   - Recommendation: Start with the existing movies-group invalidation and prove a same-movie fresh read through Gateway; narrow later only with measured cache-key evidence. [ASSUMED]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-CONTEXT.md` - locked decisions D-01 through D-16, phase boundary, local Gateway and deferred scope. [VERIFIED: local file]
- `.planning/REQUIREMENTS.md` - SRC-02, REP-01, later-phase dependencies and out-of-scope constraints. [VERIFIED: local file]
- `.planning/STATE.md` - Phase 20 boundary, current phase position and production-proof separation. [VERIFIED: local file]
- `.planning/ROADMAP.md` - Phase 21 goal, success criteria and Phase 22-24 boundaries. [VERIFIED: local file]
- `apps/api/src/domain/movies/source-contract.ts` - current readiness, bounded reason and playback-proof contracts. [VERIFIED: codebase grep/read]
- `packages/db/src/schema.ts` and `packages/db/drizzle/0029_source_contract_receipt_boundary.sql` - current D1 projection, player and crawler task/run/event schema. [VERIFIED: codebase read]
- `apps/api/src/domain/crawler-tasks/repository.ts`, `template-registry.ts`, `receipt-validation.ts` - task, retry, replay/conflict and receipt patterns. [VERIFIED: codebase read]
- `apps/api/src/routes/admin/crawler-tasks/index.ts` and `apps/api/src/routes/internal/crawler-runs/index.ts` - authenticated admin and signed runner route boundaries. [VERIFIED: codebase read]
- `packages/crawler/src/task-runner/local-runner.ts`, `template-adapters.ts`, `runner-client.ts` - local poll/claim/heartbeat/adapter/event flow. [VERIFIED: codebase read]
- `apps/dashboard/src/views/Crawlers.vue`, `apps/dashboard/src/lib/api.ts`, `apps/movie-app/src/views/MovieDetail.vue` - existing UI projection and informational repair boundary. [VERIFIED: codebase read]
- `scripts/local-task-runner.e2e.ts`, `apps/gateway/src/index.ts`, `apps/api/src/lib/gateway-cache.ts` - canonical local Gateway verification and cache behavior. [VERIFIED: codebase read]
- `AGENTS.md`, `CLAUDE.md`, `.planning/config.json` - project constraints, GitNexus rules and validation toggle. [VERIFIED: local files]

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md` - v1.4 source/repair baseline and identified stale-event, cache, redaction and retry risks. [VERIFIED: local research files; confidence inherited from their evidence]
- Phase 20 `20-03-SUMMARY.md` and `20-VERIFICATION.md` - completed readiness/receipt boundary and known Phase 21 repair-intent stub. [VERIFIED: local phase artifacts]

### Tertiary (LOW confidence)

- None. External web research was not needed because the requested planning scope is covered by repository source, local phase artifacts and project constraints. [VERIFIED: research scope]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and package usage were read from workspace manifests and current source. [VERIFIED: package.json files]
- Architecture: HIGH for existing control-plane boundaries; MEDIUM for new observation/operation schema recommendations. [VERIFIED: codebase + context] [ASSUMED: new schema]
- Pitfalls: HIGH for redaction, readiness, replay and cache boundaries already present in repository evidence; MEDIUM for exact repair concurrency/retry implementation. [VERIFIED: phase artifacts and source] [ASSUMED: new implementation details]

**Research date:** 2026-08-06 [VERIFIED: environment current date]
**Valid until:** 2026-08-20 for repository-specific facts; refresh before implementation if Phase 21 code or Phase 20 contracts change. [ASSUMED: planning validity window]
