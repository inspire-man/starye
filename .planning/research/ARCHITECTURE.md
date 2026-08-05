# Architecture Patterns

**Domain:** Starye v1.4 播放可用性与生产自愈闭环
**Researched:** 2026-08-05
**Overall confidence:** MEDIUM

## 研究结论

v1.3 已经形成了可复用的执行控制平面：`apps/api` 通过 D1 保存 `crawler_task`、`crawler_run`、attempt、lease、结构化日志、runner event 和 GitHub Actions provider association；管理员路由负责创建、查询、取消和 retry，内部路由负责签名 callback、序列校验、幂等和 provider reconciliation。`packages/crawler` 的 local runner、Actions event client、`target-crawl-mutation.ts` 和两个 production workflow 是现有执行边界。v1.4 应在这个控制平面上增量接入 source readiness 与 repair operation，生产 Puppeteer 继续由 GitHub Actions 执行。

当前最大的边界缺口是“执行成功”与“可播放成功”被不同层级表达。`receipt-validation.ts` 只重新查询 movie/comic 内容行，`ValidatedCrawlerRunReceipt` 目前只有 `primaryContentId`、`templateKey`、`createdCount`、`updatedCount`。`syncMovieData()` 先写 metadata，再在独立的 try/catch 中写 `players`；空 `players` 会让 metadata 计数成功，播放源写入异常也不会改变该计数。因此 SUN-064 的 `players=0` 可以穿过现有 success receipt，而 Dashboard 和 Viewer 还没有一个能解释“无源、修复中、source failed、已确认播放”的共同状态。

推荐把事实分成三层：`crawler_run.status` 只表示执行生命周期，content source state 表示内容是否有候选源及是否可修复，`playing` 只表示一次 Viewer 播放证据。receipt 负责把 runner 声称的内容 ID、source disposition 与 API 重新读取的 D1 事实绑定；它不承担浏览器播放证明。repair 是同一控制平面下的 child run，拥有自己的 attempt、lease、provider association、日志和 receipt，父 run 与旧 source observation 保留不变。

交付顺序应是 source contract 与 D1/API 事实先行，然后以 local runner 完成 repair 纵向切片，再接 GitHub Actions 的受控 repair adapter，最后接 Dashboard、MovieDetail/Player 和 fresh production proof。这样每一步都能在 Gateway `http://localhost:8080` 上观察真实链路；生产验收使用 v1.4 新建的 `taskId + runId + attempt` tuple，不复用冻结的 Phase 13 carrier。

## Current Baseline And Gaps

| Area | Current repository fact | v1.4 architectural implication |
|---|---|---|
| D1 control plane | `crawler_run` 有 `queued`、`dispatching`、`running`、`cancel_requested` 和 terminal statuses；repository 处理 state version、event sequence、lease、attempt、provider association。 | 复用现有 state machine。新增 source state 和 repair operation，不把 source health 塞进 run status。 |
| Runner callback | `/api/internal/crawler-runs/:runId/events` 使用 callback key、HMAC、timestamp、`event_id`、`nonce`、`sequence`；`succeeded` 需要 provider 绑定和 D1 receipt validation。 | 扩展事件/receipt 契约时保持相同鉴权、幂等、CAS 和 provider binding。 |
| Receipt | `ValidatedCrawlerRunReceipt` 只从内容表派生 ID 与 counts。`ActionsEventClient.succeeded()` 和 `RunnerClient.succeeded()` 只提交 `contentIds` 与 counts。 | 增加有上限的 source summary 和 observation binding；API 派生最终字段，runner 输入保持不可信。 |
| Movie sync | `syncMovieData()` 的 metadata、actor、publisher、player 写入分开处理；`players` 非空时才删除并重建 player rows。 | 新内容必须显式提交 `source disposition`；player 写入结果必须产生可查询 source observation，避免 silent metadata success。 |
| Movie API | `getMovieByIdentifier()` 返回 player 的 `isActive`；公开详情也会查询 player rows。`isActive` 当前还承担用户上报后的 moderation 语义。 | source health 使用独立字段/表，将 `isActive` 保留为 moderation/eligibility 语义。返回 aggregate source state、revision 和候选源。 |
| MovieDetail / Player | MovieDetail 只在 `sortedPlayers.length > 0` 时展示播放源区块；Player 默认使用 `movie.players[0]`，已有 `waiting` 超时、error、当前源 retry 和 Aria2 fallback。 | 增加显式 no-source/repairing/source-failed 分支；用 source resolver 选择 eligible candidate，并记录 `canplay`、`playing` 和 fallback 结果。 |
| Dashboard | `Crawlers.vue` 只展示 validated receipt 的主内容 ID和 counts，并链接到电影/漫画管理页。 | 展示 source summary、repair child run、父子 run 关系和 fresh Viewer 跳转。repair command 只接收内容 ID，模板、workflow、target 和 secrets 由服务端拥有。 |
| Target execution | `target-crawl-mutation.ts` 当前支持 registry-owned `manga-production`、`movie-production` 和 smoke operation；`crawler-enrich-players` scripts 目前只有 direct invocation guard，没有可执行 repair adapter。 | 新增明确的 `repair_players` operation 和 adapter；先锁定 target snapshot 与 test，再连到 Actions workflow。 |
| Cache / Gateway | Gateway `/dashboard` 不缓存，`/api` 默认 no-store，公开 movie list 才写 KV `movies` group；API movie detail 仍挂有 180 秒 Cache API `detailCache()`。`sync.handler.ts` 当前只清理 Gateway `movies` KV group。 | source mutation 后必须保证 detail fresh。优先移除 source-bearing detail 的旧 detail cache，或让 cache key 带 `sourceRevision` 并提供明确 fresh read。 |

## Recommended Architecture

```text
Dashboard / Admin Movie Management
        | session + resource permission
        v
Gateway: http://localhost:8080 or production Gateway origin
        |
        +--> /api/admin/crawler-tasks -----------------------------+
        |       create/list/detail/logs/cancel/retry                |
        |                                                           |
        |       D1 control plane                                   |
        |       crawler_task / crawler_run / attempt / lease       |
        |       transition / runner_event / provider_association   |
        |                                                           |
        +--> repair-players command                                |
                immutable movie target + source revision           |
                                                                    |
               fixed template/operation registry                   |
                         |                                          |
                 GitHub workflow dispatch                           |
                         |                                          |
                 target profile + prepared context                 |
                         |                                          |
             Node/Puppeteer runner on GitHub Actions                |
             full crawl adapter or movie repair adapter             |
                         |                                          |
       CRAWLER_SECRET | sync movie metadata + players              |
       callback HMAC  | signed lifecycle events                     |
                         v                                          |
                    API source boundary                            |
              D1 movie / player / source observation                |
              source state + source revision + receipt              |
                         |
          signed /api/internal/crawler-runs/:runId/events          |
                         v                                          |
                 D1 run state and provider facts                   |
                         |
                         +--> Dashboard task/read model
                         |
                         +--> Movie API detail
                                  |
                         MovieDetail source state
                                  |
                         Player candidate resolver
                                  |
                   canplay -> playing -> timeupdate evidence
```

### Component Boundaries

| Component | Responsibility | Communicates with | v1.4 boundary |
|---|---|---|---|
| `@starye/db` D1 schema and migrations | Own task/run/lease/log/provider tables and new source observation/state tables. | API repository, sync service, query services | A source observation is a D1 fact; Vue state and raw Actions logs are projections. |
| Crawler task repository | Create active run, retry as a new attempt, apply CAS transitions, append redacted logs, validate receipts, persist provider observations. | D1, admin routes, internal callback routes | Add `operation`, `parentRunId`, repair target snapshot and source-summary persistence without changing terminal run semantics. |
| Template/operation registry | Closed mapping from user-visible template and server-owned operation to entrypoint, workflow, target profile, version and permission resource. | admin commands, Actions client, local/Actions adapters | `templateKey: 'movie'` plus `operation: 'repair_players'`; caller selects the movie ID only. `workflow`, URL, CLI args and secret names remain server-owned. |
| Admin command routes | Session authentication, resource permission, idempotent command creation and read models. | Dashboard, repository, GitHub Actions client | Existing `/api/admin/crawler-tasks` remains for full crawl. Add a dedicated repair command such as `POST /api/admin/crawler-tasks/repair-players` with `{ movieId }`. |
| Internal runner-event routes | Verify HMAC/key rotation/timestamp, validate schema and run/attempt/provider binding, then pass events to repository. | Local runner, GitHub Actions runner, D1 | Preserve `/api/internal/crawler-runs/:runId/events`; source summary is accepted only on terminal success and is revalidated against D1. |
| Movie sync service | Upsert metadata and player candidates through the crawler service boundary. | `CRAWLER_SECRET` sync route, D1, source observation writer | Return metadata outcome and source outcome separately. For repair, verify post-write player count before terminal success. |
| Local runner | Poll and claim one run, select the server-owned adapter, checkpoint cancellation, emit signed lifecycle events. | `RunnerClient`, crawler adapters, API | Complete the repair slice locally before provider rollout; local and Actions must use the same operation snapshot and receipt contract. |
| GitHub Actions runner | Prepare fixed target context, bind `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_SHA`, execute Node/Puppeteer and send callback events. | workflow, `target-crawl-mutation.ts`, API | A dedicated repair job is preferred for one-content repair because it bounds crawl scope and Actions minutes. It remains the only production Puppeteer executor. |
| Source observation writer | Record `ready`, `no_source`, `repairing` or `source_failed` and link it to content, run, attempt and source revision. | sync service, repair orchestrator, Movie API | Do not store a raw page dump in D1 logs. Store bounded reason codes and source fingerprints; the player table remains the candidate inventory. |
| Dashboard crawler workspace | Poll task/run read models, display logs/receipt/source state, issue cancel/retry/repair, link to management and Viewer. | Gateway, admin API | It never reads GitHub files or builds an Actions command. Repair status is a child run projection, not a local boolean. |
| MovieDetail | Present metadata, candidate sources, source state and repair affordance. | Gateway movie detail API, Player route | Show explicit no-source/repairing/source-failed states even when `players` is empty. Keep inactive sources visible for moderation but exclude them from default playback selection. |
| Player | Resolve a candidate, initialize xgplayer, handle waiting/error/retry/fallback and produce browser proof markers. | Gateway movie detail API, TorrServer/Aria2 where applicable | It does not change `crawler_run.status` and does not dispatch an arbitrary crawler. A repeated client error can create a bounded report/repair intent through a dedicated product route. |
| Gateway | Canonical routing, auth front door for Dashboard, cache policy and evidence origin. | API, Dashboard Pages, Movie Pages, KV | Use Gateway URLs in acceptance evidence. Dynamic task/detail/source responses remain fresh; only public list caching is eligible for KV. |

## State And Data Model

### Separate Three Authorities

| Authority | Example states | Meaning | Source of truth |
|---|---|---|---|
| Execution | `queued`, `dispatching`, `running`, `cancel_requested`, `succeeded`, `failed`, `cancelled` | Whether a task attempt is executing and whether the control plane accepted its terminal event. | `crawler_run` plus transition/event/provider tables. |
| Content source | `metadata_ingested`, `ready`, `no_source`, `repairing`, `source_failed` | Whether the content has source candidates, a known repair recipe or a latest source failure. | Latest source observation plus a small current projection keyed by `movie_id`. |
| Browser playback | `loading`, `waiting`, `error`, `canplay`, `playing`, `timeupdate`, `fallback` | What happened in one Viewer session for one selected player. | Browser evidence manifest; a client event does not rewrite crawler execution history. |

The word `playing` is deliberately outside the durable crawler source state. `ready` means that the API has a valid candidate inventory and source-specific validation has passed. It does not claim that an external magnet, stream or TorrServer path played in a browser. The fresh production acceptance must therefore prove `playing` separately.

### Existing Control-Plane Tables

| Table or projection | Role | v1.4 use |
|---|---|---|
| `crawler_task` | Immutable request identity, template and latest-run projection. | Extend the server-owned snapshot with `operation` and, for repair, a target content snapshot. Preserve the original full-crawl task. |
| `crawler_run` | Attempt lifecycle, state version, event sequence, lease, terminal time, failure code and receipt summary. | A repair is a new run with a new `attempt` and `parentRunId`; old run facts remain queryable. |
| `crawler_run_log` | Redacted, sequence-ordered, bounded logs with retention. | Add source/repair reason codes and counts; keep raw HTML, secrets and unbounded URLs out. |
| `crawler_runner_event` | Idempotency record for `event_id`, `nonce`, body hash, sequence and outcome. | Replayed Actions events return the prior outcome; a conflicting event is a conflict, not a second state mutation. |
| `crawler_run_transition` | Audit of state decisions, including provider success pending receipt and provider loss. | Link source disposition and repair dispatch decisions without overwriting the execution transition history. |
| `crawler_run_provider_association` | Immutable GitHub workflow, repository, ref, target, environment, provider run ID/attempt, SHA and reconciliation facts. | Bind the fresh production receipt to the exact Actions execution. `GITHUB_RUN_ID` alone is insufficient without application `runId` and `attempt`. |
| `movie` / `player` | Metadata and source candidate inventory. `player.isActive` is currently a moderation flag affected by user reports. | Keep `totalPlayers` consistent with actual rows after every source mutation; introduce separate source health/readiness semantics. |

### Proposed Source Facts

Use an append-only `crawler_content_source_observation` table plus a current `movie_source_state` projection. This is a small D1 addition with a clear read path and a durable history for repair/evidence. The projection can be folded into `movie` later if measured query cost justifies denormalization.

Recommended bounded fields:

| Field | Purpose |
|---|---|
| `observation_id`, `movie_id`, `task_id`, `run_id`, `attempt` | Bind source facts to the exact content and execution attempt. |
| `state` | `ready`, `no_source`, `repairing` or `source_failed`; `metadata_ingested` is the initial state before source extraction completes. |
| `player_count`, `eligible_player_count` | Reconciled counts from D1 after the write, not runner-declared counts. |
| `repair_key`, `repairable`, `repair_attempt_count` | Select a fixed adapter and apply cooldown/exhaustion rules. Example key: `movie-player-enrich-v1`. |
| `reason_code` | Bounded codes such as `no_candidates`, `player_write_failed`, `all_candidates_inactive`, `source_parse_failed`, `playback_timeout`. |
| `source_revision` | Monotonic content/source revision used to reject stale repair results and make detail reads fresh. |
| `player_fingerprints_json` | Bounded player IDs and deterministic URL fingerprints/hosts for evidence, rather than duplicating raw secret-bearing input in logs. |
| `observed_at`, `created_at` | Ordering and audit. |

`movie_source_state` should expose `state`, `readyPlayerCount`, `repairable`, `activeRepairRunId`, `lastObservationId` and `sourceRevision` to the movie API. `player.isActive` remains a moderation/eligibility input. A future per-player health table is a separate scale decision; v1.4 can keep browser failure evidence per acceptance run and aggregate source failure at movie level.

### State Transitions

```text
metadata_ingested
       |
       +-- source candidates written and reconciled --> ready
       |
       +-- extraction completed with zero candidates
             +-- fixed repair recipe --> no_source
                                      |
                                      +-- idempotent child run --> repairing
                                                                    |
                               repair writes eligible source --> ready
                                                                    |
                               repair/extraction/write failure --> source_failed
                                                                    |
                               bounded retry/cooldown ----------> repairing

ready -- Viewer error/timeout observation --> source_failed
source_failed -- operator or bounded trigger -------------------> repairing

ready -- fresh Viewer canplay + playing + timeupdate --> playback evidence
```

The Viewer error path should require a bounded server-side observation or an operator action before it changes durable aggregate state. A single arbitrary browser request should not create an unbounded Actions loop. Existing player reporting can remain the moderation path; a repair intent is created only on a defined threshold or explicit admin command.

## API And Data Flow

### 1. Full Crawl From Dashboard

1. Dashboard calls `POST /api/admin/crawler-tasks` through the Gateway with only the closed template key. Session authentication and `canAccessCrawler` enforce the movie/comic resource boundary.
2. The API repository creates or returns the active `crawler_task` and first run. It persists the immutable template snapshot, run attempt, lease and audit fact before provider dispatch.
3. The API resolves the server-owned `ProviderSnapshot` and calls the fixed GitHub workflow dispatch client. The envelope contains the API-created `runId`, `attempt`, `template` and fixed `target`; it excludes caller-provided workflow paths, arbitrary URLs, secrets and CLI options.
4. The Action resolves the target profile and calls the fixed `target-crawl-mutation.ts` entry. The runner sends `provider_started`, heartbeat, progress/log and terminal events through the signed internal route. `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_SHA`, workflow, ref, repository, environment and target are checked against the D1 provider association.
5. The crawler calls the existing service-authenticated movie sync endpoint. The API writes metadata and source candidates, then records a source observation. A movie with zero candidates carries explicit `no_source` plus a fixed repair key; a missing source disposition is treated as an incomplete source result.
6. The runner submits a bounded candidate receipt. The API re-queries the content row, actual player count, source state and observation ID, then commits validated receipt summary and terminal transition. Provider success without a matching signed, validated receipt remains pending and is reconciled later.
7. Dashboard reads `/api/admin/crawler-tasks/:taskId`, `/runs/:runId/logs` and child-run details. It shows content/source state and uses the receipt primary content ID for a controlled link into content management.

### 2. Automatic Or Explicit Repair

Repair has one owner: the crawler task control plane. It is triggered by one of the following bounded causes:

- ingestion completed with `no_source` and `repairable=true`;
- player source persistence or source extraction produced `source_failed` with a known `repair_key`;
- an administrator invokes `POST /api/admin/crawler-tasks/repair-players` with `{ movieId }`;
- a defined player-report threshold requests repair after moderation marks all usable candidates unavailable.

The repair command performs these steps:

1. Read the canonical movie row and source revision from D1. The caller contributes `movieId`, never an upstream URL, workflow name, target profile or command.
2. Use an idempotency key such as `repair-players:<movieId>:<sourceRevision>` and the existing one-active-run lease to deduplicate automatic and manual requests.
3. Create a child task/run with `templateKey: 'movie'`, server-owned `operation: 'repair_players'`, `parentRunId`, fixed `repair_key` and an immutable target snapshot containing movie ID, code, approved upstream provider and source revision.
4. Dispatch the dedicated repair workflow or fixed repair job through the existing GitHub Actions client. The job receives the control-plane run binding; the target movie snapshot is resolved from the server-owned context and revalidated before Puppeteer starts.
5. The repair adapter fetches only the target movie, extracts candidates using the fixed source strategy, calls the sync API, and verifies the post-write D1 count/eligibility through the API response. A zero result becomes `source_failed` or a bounded terminal `no_source`, not a generic crawler success.
6. The API stores a new source observation and receipt linked to the child run, increments `sourceRevision`, invalidates source-bearing detail reads, and updates the parent task read model. Prior runs and observations remain immutable.
7. If dispatch, provider association or repair execution fails, the child run is `failed` with a specific code and the source projection keeps the next retry time/reason. Cooldown and attempt limits prevent repeated free quota consumption; the Dashboard exposes a deliberate retry action.

The current `packages/crawler/src/scripts/enrich-players.ts` and `enrich-players-javbus.ts` guards show that a direct script path is intentionally not the adapter. Phase implementation must add a registry-owned adapter and tests for its target binding before the workflow is enabled.

### 3. Dashboard, MovieDetail, Player And Gateway

1. Dashboard task pages are operational views over D1. They use the Gateway `/dashboard` origin, poll bounded read models, and show `ready`, `no_source`, `repairing`, `source_failed`, provider state, receipt and child attempts.
2. MovieDetail calls the movie detail API through Gateway. The response includes metadata, `sourceState`, `sourceRevision`, `repair` summary and the existing player rows. It renders a source block for `ready`, an explicit repairable state for `no_source`, progress for `repairing`, and actionable error/retry guidance for `source_failed`.
3. Player chooses a source through a shared resolver: an explicitly requested player must be eligible, otherwise choose the first eligible candidate with an approved source scheme. `isActive=false` candidates remain visible for moderation but are excluded from default selection. If no candidate is eligible, the page returns to the source-state branch instead of dereferencing `players[0]`.
4. Player handles same-source retry, next-candidate fallback, `waiting` timeout, `error`, Aria2/TorrServer fallback where the source type allows it, and terminal error copy. It emits local proof markers with `movieId`, `playerId`, source fingerprint, source revision and timestamps. It does not call the internal crawler callback route.
5. Gateway keeps Dashboard, admin API and dynamic detail/source responses fresh. The existing public movie list KV group can remain. For movie detail, choose one explicit policy: remove the API `detailCache()` from source-bearing detail, or make its key include `sourceRevision` and provide a `fresh` read. The first choice is simpler for v1.4 and avoids a stale playback acceptance.
6. Fresh production evidence uses the Gateway origin for Dashboard and Viewer URLs. The verifier records cache policy/headers, D1 task/run/provider facts, the validated receipt, source observation and browser `playing` evidence as one tuple.

## Receipt And Evidence Contract

### Receipt Responsibilities

Keep receipt validation in the API boundary. Runner-submitted values are candidates only; the API derives the content ID, counts and source summary from D1. A v1.4 receipt should be versioned and bounded, for example:

```typescript
type SourceReceiptSummary = {
  attempted: number
  ready: number
  noSourceRepairable: number
  failed: number
  primary: {
    contentId: string
    observationId: string
    playerCount: number
    sourceState: 'ready' | 'no_source'
    repairKey?: string
  }
}

type ValidatedCrawlerRunReceiptV2 = {
  receiptVersion: 2
  templateKey: 'movie' | 'manga'
  primaryContentId: string
  createdCount: number
  updatedCount: number
  source: SourceReceiptSummary
}
```

Validation rules:

- `contentIds` must match the task template and resolve to actual D1 rows.
- `source.primary.contentId` must resolve to that row, and `observationId` must belong to the same `runId` and `attempt`.
- `ready` requires a post-write eligible player count greater than zero and a valid source disposition. A metadata row alone is not a ready receipt.
- `no_source` is accepted only when extraction was attempted, the source-specific `repairKey` is server-owned, and the source observation is `repairable=true`. A missing `players` field or swallowed player write exception has no valid disposition.
- A repair receipt must include the child run binding and a newer `sourceRevision`. The API must reject a stale repair result after a newer manual edit or another repair.
- `playing` is not a terminal runner receipt field. It is a Viewer observation tied to the validated receipt and source observation.

This preserves v1.3 receipt compatibility for historical runs while requiring receipt version 2/source summary for the fresh v1.4 production tuple. The existing `receipt_summary_json` remains a projection; an observation ID and normalized receipt hash make evidence lookup deterministic.

### Fresh Production Playback Evidence

The evidence manifest should bind all of the following, with no historical Phase 13 carrier:

```json
{
  "schema": "starye.v1.4.playback-proof/v1",
  "fresh": true,
  "taskId": "<fresh-task-id>",
  "runId": "<fresh-run-id>",
  "attempt": 1,
  "provider": {
    "provider": "github-actions",
    "providerRunId": "<GITHUB_RUN_ID>",
    "providerRunAttempt": 1,
    "workflow": ".github/workflows/<fixed-workflow>",
    "sha": "<GITHUB_SHA>"
  },
  "primaryContentId": "<d1-movie-id>",
  "sourceObservationId": "<observation-id>",
  "sourceRevision": 2,
  "gatewayOrigin": "<production-gateway-origin>",
  "dashboardUrl": "<production-gateway-origin>/dashboard/crawlers?...",
  "viewerUrl": "<production-gateway-origin>/movie/<movie-code>?player=<player-id>",
  "playback": {
    "selectedPlayerId": "<player-id>",
    "canplay": true,
    "playing": true,
    "timeupdate": true,
    "fallbackUsed": false,
    "observedAt": "<iso-8601>"
  },
  "result": "passed"
}
```

The browser assertion should require the same movie identity and source revision loaded by MovieDetail, then observe `canplay`, `playing` and a subsequent `timeupdate` for the selected player. A screenshot or a rendered player container alone is insufficient evidence. If retry/fallback is used, record every attempted player and the final successful player in the manifest.

## Patterns To Follow

### Pattern 1: Three-Layer State Separation

**What:** Keep execution lifecycle, content source readiness and Viewer playback evidence as separate state machines.

**When:** A crawler run succeeds while a movie has no source, a repair is active, or a Viewer source fails after ingestion.

**Why:** It lets the control plane preserve honest run history while the content UI communicates a repairable no-source state. It also prevents `playing` browser evidence from being treated as an API crawler receipt.

**Example:**

```typescript
type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
type SourceState = 'metadata_ingested' | 'ready' | 'no_source' | 'repairing' | 'source_failed'
type PlaybackProof = 'loading' | 'error' | 'canplay' | 'playing' | 'timeupdate'
```

### Pattern 2: Server-Owned Closed Operation Registry

**What:** Map each allowed operation to a fixed template, entrypoint, workflow, target profile, permission resource and version.

**When:** Full crawl, repair, retry, local runner and GitHub Actions dispatch.

**Why:** A Dashboard command should express intent, not supply shell details. The existing registry and target-profile guard can validate a `repair_players` operation without turning workflow inputs into arbitrary CLI execution.

**Recommended repair snapshot:**

```typescript
{
  templateKey: 'movie',
  operation: 'repair_players',
  operationVersion: 1,
  entrypoint: 'crawler-enrich-players',
  permissionResource: 'movie',
  targetContent: { movieId, code, sourceRevision, provider: 'javbus' }
}
```

The snapshot is immutable for the attempt. The runner revalidates it against the API before the source mutation.

### Pattern 3: Idempotent Child Repair Run

**What:** Every repair request creates or returns one active child run keyed by content and source revision. Retry creates a new attempt and preserves the previous attempt.

**When:** Automatic no-source trigger races with an operator command, Actions retries a callback, or a repair fails halfway through player persistence.

**Why:** D1 leases and `event_id`/`nonce` idempotency already provide the required control-plane primitives. Reusing the original run would erase the reason for SUN-064 and make fresh evidence ambiguous.

### Pattern 4: Source Observation Commit With Receipt Revalidation

**What:** After sync, the API reconciles actual player rows, source state and observation, then writes the validated receipt and terminal transition in one repository-owned short D1 transaction/batch.

**When:** `succeeded` event processing and repair completion.

**Why:** Cloudflare D1 `batch()` executes statements in order as one transaction boundary. A short batch makes the source observation, current projection, receipt summary and lease release move together while keeping Puppeteer outside the Worker.

**Operational rule:** The batch contains bounded metadata/source facts and counters. HTML, screenshots, secrets and high-frequency crawler output stay outside the D1 transaction.

### Pattern 5: Candidate Resolver With Explicit Fallback

**What:** Resolve `route.query.player` only when it points to an eligible candidate; otherwise choose the first active, syntactically valid source. Retry the same source, then move through a deterministic fallback list.

**When:** A player row is inactive, a source URL is malformed, xgplayer emits `error`, or `waiting` exceeds the timeout.

**Why:** `movie.players[0]` is an inventory order, not a health decision. The resolver makes no-source and invalid-source behavior testable and keeps Aria2/TorrServer fallback limited to supported source schemes.

### Pattern 6: Cache Freshness Is Part Of the Source Contract

**What:** Every source mutation increments `sourceRevision`; detail reads either bypass source-bearing cache or include that revision in their cache key. Gateway admin/detail routes remain `no-store` or explicitly fresh.

**When:** Repair finishes immediately before Dashboard -> Viewer acceptance, or a player is manually edited/deleted.

**Why:** A stale API Cache response can show `players=0` after D1 is already fixed. Cache headers and the revision are part of the evidence, not incidental transport details.

## Anti-Patterns To Avoid

### Anti-Pattern 1: `crawler_run.succeeded` Means `playing`

**What goes wrong:** A provider run and content row exist, so the system reports playback readiness without a source candidate or browser event.

**Instead:** Validate source disposition in the API receipt, then prove `playing` with a fresh Viewer manifest.

### Anti-Pattern 2: Swallow Player Write Failure

**What goes wrong:** The current independent player try/catch leaves metadata success and may leave `totalPlayers` inconsistent with actual player rows. SUN-064 remains invisible to the control plane.

**Instead:** Return a structured source outcome, reconcile `COUNT(player)` after writing, and create `source_failed` or explicit repairable `no_source` observation.

### Anti-Pattern 3: Reuse `player.isActive` As Health

**What goes wrong:** User moderation reports, source parse failures and playback timeouts acquire one overloaded boolean. A repair can accidentally reactivate a moderated source or hide a valid candidate.

**Instead:** Keep `isActive` as eligibility/moderation and add aggregate source state plus observation reason codes.

### Anti-Pattern 4: Run the Full Daily Crawl For One Missing Source

**What goes wrong:** A repair repeats unrelated metadata work, consumes Actions minutes, changes more rows and makes the receipt's target ambiguous.

**Instead:** Use the fixed `repair_players` adapter with one content snapshot, one source revision and a bounded workflow job.

### Anti-Pattern 5: Pass Workflow, URL Or CLI Through Dashboard

**What goes wrong:** Task authorization becomes a shell/remote-fetch interface and the resulting run has no stable template or target identity.

**Instead:** Accept only a template or `movieId`; resolve all execution inputs through the registry and D1 snapshot.

### Anti-Pattern 6: Run Puppeteer Or Repair Loops In a Worker Request

**What goes wrong:** A short API request owns browser lifetime, cancellation and external network time, while Cloudflare request limits and retries complicate cleanup.

**Instead:** Worker persists and dispatches bounded work. Node/Puppeteer runs in local runner or GitHub Actions, with callback heartbeats and lease expiry.

### Anti-Pattern 7: Accept Stale Detail As Fresh Playback Evidence

**What goes wrong:** Gateway is canonical, but API Cache API returns the pre-repair detail; the verifier sees `players=0` or an old source and the evidence tuple becomes contradictory.

**Instead:** Make detail cache source-aware or bypass it for the fresh proof, record `sourceRevision`, and assert the response cache policy.

### Anti-Pattern 8: Reuse the Frozen Phase 13 Carrier

**What goes wrong:** Historical task/run/provider facts are mixed with v1.4 code, source observations or Viewer events, so a passed artifact does not establish a fresh repair-to-play path.

**Instead:** Allocate a fresh v1.4 task/run/provider tuple after deployment and bind every Dashboard, receipt, source observation and Viewer assertion to it.

## Scalability Considerations

| Concern | At 100 runs | At 10K runs | At 1M runs |
|---|---|---|---|
| D1 run/source queries | Index `task_id`, `status`, `created_at`, `movie_id`, `source_revision` and `(run_id, sequence)`; poll Dashboard every 5-10 seconds. | Cursor-paginate task/log views, query latest source projection, and keep repair dedupe keys unique. | Move high-volume event history and source health analytics to a dedicated observation pipeline; D1 remains the control-plane index. |
| Repair dispatch | One active repair per movie/source revision; trigger only on no-source, explicit admin action or threshold. | Add per-provider cooldown, retry budget and scheduled reconciliation for stale intents. | Use a queue/worker pool and provider-specific budgets; do not scale through browser polling. |
| Runner events | Existing sequence/idempotency, 4 KB safe log message, 500 normal logs and retention policy are sufficient. | Coalesce progress events and retain only bounded source summaries; keep terminal events lossless. | Use streamed/archived logs and a separate metrics store. |
| Source state | Latest observation plus current projection is cheap and immediately queryable. | Add indexes and avoid JSON scans for list pages; retain raw source URL only in the player inventory. | Partition/expire observation history and keep only evidence-referenced records in the hot store. |
| Cache freshness | Source-bearing detail uses no-store or revision key; public movie lists use the existing KV group. | Explicitly invalidate list group and monitor cache headers/revision mismatch. | Introduce a versioned cache namespace and async invalidation only after traffic justifies it. |
| Evidence | One JSON manifest per fresh production run, with no credential material. | Store manifests in a bounded artifact location and index by tuple. | Move durable playback telemetry to a separate observability system; it is outside v1.4. |

## Delivery Order And Dependencies

1. **Reconcile current facts and freeze the proof contract**
   - Confirm SUN-064 from current D1/content facts and archive evidence; treat the 2026-05-10 `CONCERNS.md` as a lead, not a source of truth.
   - Define `SourceState`, `sourceRevision`, receipt version 2 and the fresh evidence manifest.
   - Record that the Phase 13 carrier remains frozen and allocate no new proof run during contract design.

2. **Source contract, D1 observation and API receipt boundary**
   - Add source observation/current projection migration, server-owned repair snapshot and idempotency key.
   - Change sync result handling so `players=0`, player write failure and eligible player count are explicit outcomes. Fix `totalPlayers` reconciliation in the same boundary.
   - Extend `CrawlerRunReceiptCandidate`, `ValidatedCrawlerRunReceipt`, runner clients and route schemas with bounded source summary. Add repository tests for stale observation, wrong run/attempt, missing disposition and duplicate terminal events.
   - Decide source-bearing detail cache policy and test post-repair fresh reads through Gateway.

3. **Local repair vertical slice**
   - Implement the registry-owned `repair_players` adapter, target snapshot validation, one-content source extraction and post-sync player-count assertion.
   - Run it through `LocalTaskRunner` using the existing signed poll/claim/events, with child run, cancellation, retry, source failure and successful receipt tests.
   - Verify locally through `http://localhost:8080`: admin repair command -> D1 run/log -> source state -> MovieDetail -> Player state.

4. **GitHub Actions production adapter**
   - Add a fixed repair workflow/job and extend `ProviderSnapshot`/`target-crawl-mutation.ts` with `repair_players`; keep `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, target profile and callback secrets registry-bound.
   - Exercise dispatch, provider start, heartbeat, cancel, provider reconciliation and signed terminal receipt against a non-production fixture or approved staging path first.
   - Keep the existing daily full-crawl workflows and historical Phase 13 carrier unchanged.

5. **Dashboard and Viewer state surfaces**
   - Dashboard renders source summary, parent/child runs, repair cooldown and receipt links.
   - MovieDetail renders no-source/repairing/source-failed branches and only offers repair through the bounded API command.
   - Player uses a shared candidate resolver, covers invalid/retry/fallback/error states, and exposes stable browser proof markers for `canplay`, `playing` and `timeupdate`.

6. **Fresh production proof and closeout**
   - Create a new production task/run/attempt and capture the provider tuple, receipt, source observation, Gateway cache policy, Dashboard read, Viewer detail read and actual playback events.
   - Repeat one controlled failure/repair path so the self-healing transition is evidenced, then retain the fresh successful tuple as the v1.4 production proof.

**Ordering rationale:** Source state and receipt contracts are shared by local runner, Actions, Dashboard and Viewer, so they precede adapters and UI. Local execution removes provider uncertainty while validating the D1 state machine. GitHub Actions then verifies provider binding and production Puppeteer under the same contract. Cache freshness and browser proof come after the source revision exists, and the fresh production run is last so it cannot accidentally rely on stale or historical evidence.

## Architecture Research Flags

- **Repair extraction semantics:** `crawler-enrich-players` is a guarded script path today. The implementation phase needs deeper research into the source-specific AJAX/parser contract, URL normalization, rate limits and what constitutes a repairable `no_source` result.
- **Receipt migration:** Existing v1.3 runs have metadata-only receipts. The migration must read them as historical facts and require v2/source summary for new v1.4 runs without rewriting old tuples.
- **Provider permissions:** The GitHub App installation permissions and workflow dispatch/cancel ownership need confirmation from the live repository secrets owner before the first production repair dispatch. Use the minimum workflow/run permissions supported by the current integration.
- **Browser source behavior:** Magnet, direct HTTP and TorrServer paths have different `canplay`/`playing` behavior. The phase should select one deterministic production content/source fixture and define the exact event sequence for acceptance.
- **Cache invalidation:** API Cache API detail invalidation is separate from Gateway KV `movies` group invalidation. The implementation phase must choose the source-revision/no-store policy and verify it through the canonical Gateway URL.

## Sources

### Repository Evidence

| Source | Finding used | Confidence |
|---|---|---|
| `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/milestones/v1.3-REQUIREMENTS.md`, `.planning/milestones/v1.3-ROADMAP.md` | v1.3 completed control-plane scope, production executor boundary, frozen Phase 13 carrier and v1.4 research scope. | HIGH |
| `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md` | Existing package/runtime boundaries, Gateway verification entry and test expectations. | HIGH |
| `apps/api/src/domain/crawler-tasks/{types.ts,state-machine.ts,repository.ts,receipt-validation.ts,reconciliation.ts}` | D1 run states, lease/attempt/idempotency, provider reconciliation and metadata-only validated receipt behavior. | HIGH |
| `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/routes/internal/crawler-runs/index.ts` | Admin command/read routes, signed runner events, receipt binding and provider-success-pending-receipt behavior. | HIGH |
| `packages/crawler/src/task-runner/{local-runner.ts,runner-client.ts,actions-event-client.ts,template-adapters.ts}`, `packages/crawler/scripts/target-crawl-mutation.ts` | Local/Actions callback contract, provider identity binding, current production operations and missing repair adapter. | HIGH |
| `.github/workflows/daily-movie-crawl.yml`, `.github/workflows/daily-manga-crawl.yml` | Fixed workflow inputs, target-profile preparation, GitHub Environment and production Node/Puppeteer execution. | HIGH |
| `apps/api/src/routes/movies/services/sync.service.ts`, `apps/api/src/routes/movies/handlers/sync.handler.ts` | Independent player write handling, `players=0` behavior and current Gateway movie-list invalidation. | HIGH |
| `apps/api/src/routes/movies/services/movie.service.ts`, `apps/api/src/routes/public/movies/index.ts`, `apps/movie-app/src/views/MovieDetail.vue`, `apps/movie-app/src/views/Player.vue` | Player inventory/API shape, `isActive`, first-player selection and current retry/fallback/error UI. | HIGH |
| `apps/gateway/src/index.ts`, `apps/gateway/src/cache-middleware.ts`, `apps/api/src/middleware/cache.ts` | Canonical Gateway routing, `/api` and Dashboard cache policy, public movie-list KV policy and API detail cache. | HIGH |

### Official Documentation

| Source | Finding used | Confidence |
|---|---|---|
| [Cloudflare D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | `D1Database.batch()` runs statements in order within a transaction boundary, supporting short state/observation/receipt commits. | MEDIUM, verified through the research documentation provider |
| [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | Worker request execution is a short-lived request boundary; long-running browser execution belongs in the existing external runner. | MEDIUM, verified through the research documentation provider |
| [GitHub workflow dispatch REST API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) | API-owned workflow dispatch can carry a bounded run binding and fixed inputs. | MEDIUM, verified through official documentation lookup |
| [GitHub workflow run cancellation API](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run) | Cancellation is an asynchronous provider action; the control plane waits for a provider/runner terminal fact. | MEDIUM, verified through official documentation lookup |
| [GitHub Actions default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables) | `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT` and `GITHUB_SHA` provide provider identity fields for association and evidence. | MEDIUM, verified through official documentation lookup |

## Summary Recommendation

Use the existing D1 crawler control plane as the sole execution authority and add a bounded source lifecycle beside it. Make `source observation + source revision + validated receipt` the API contract between crawler and content, make `repair_players` a server-owned child operation executed by GitHub Actions, and make `MovieDetail/Player` consume source state through Gateway with a deterministic candidate resolver. Keep browser `playing` proof outside the crawler receipt and bind it to the same fresh production tuple. This architecture fixes the `players=0` blind spot, supports repair without a full recrawl, preserves free-tier-friendly infrastructure, and gives roadmap phases a testable dependency chain.
