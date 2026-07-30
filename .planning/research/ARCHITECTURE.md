# Architecture Patterns

**Domain:** Starye v1.3 后台爬虫任务与内容运维
**Researched:** 2026-07-30
**Overall confidence:** MEDIUM

## Recommended Architecture

v1.3 应增加一个持久化的“爬虫控制平面”，而不是把 Node/Puppeteer 放进 Cloudflare Worker。`apps/api` 负责创建受控任务、保存运行状态和日志、分发 GitHub Actions、接受 runner 回调；`packages/crawler` 继续拥有浏览器、站点策略、限流、入库与资源清理。Dashboard 只发业务命令和展示 D1 的事实，不直接拼 shell、环境变量、来源 URL 或 GitHub workflow 名称。

现有 `daily-movie-crawl.yml`、`daily-manga-crawl.yml` 已经采用 target profile、GitHub environment 及 `CRAWLER_SECRET` 执行 crawler；`apps/api/src/routes/admin/crawlers/index.ts` 则仍是内容统计和“请手动执行”的文件日志提示。新架构应把二者接在同一个任务状态模型上，同时保留已有内容同步与 CRUD 路由。漫画正文图继续保存源站 URL，不能因任务日志或重试机制重新引入 R2 正文图写入。

```text
Dashboard (session + resource permission)
  -> Gateway /api
  -> Crawler command API
       -> D1 crawler_task / crawler_run / crawler_run_log
       -> audit_log
       -> fixed template dispatcher --------------------------+
                                                            |  |
local operator: controlled Node runner <--- run ID ----------+  +-> GitHub Actions
       |                                                            target profile + fixed entry
       |                                                            workflow input: appRunId
       +-> signed runner event API <-------------------------------+ GITHUB_RUN_ID + events
                    |                                              |
                    +-> D1 state + structured log                 |
                    +-> existing crawler sync endpoints ----------+
                               -> movies/comics/chapters/players
                               -> existing Dashboard content CRUD
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `@starye/db` migration/schema | `crawler_task`、`crawler_run`、`crawler_run_log` 的表、索引和关联；不修改现有内容表语义。 | API repositories / Drizzle |
| `@starye/api-types` | 任务模板、状态、计数、日志事件和 Dashboard DTO 的唯一类型 owner。 | API、Dashboard、crawler adapter |
| API command routes | 会话鉴权后创建、查询、取消、重试任务；在同一短事务写运行投影和审计。 | D1、GitHub dispatch client |
| API runner-event routes | 独立的签名校验、幂等写入、合法状态迁移和心跳；不走普通管理员 `serviceAuth`。 | local runner、Actions |
| Template registry | 服务端闭集 `movie`/`comic` 到 workflow、target-profile entry、参数上限和版本的映射。 | command route、Actions、local adapter |
| Local runner adapter | 接收已有 D1 run ID，执行既有 Node/Puppeteer crawler，在安全检查点上报事件并响应取消。浏览器无法由 Dashboard 远程启动。 | template registry、runner-event API、existing crawler |
| GitHub Actions adapter | 读取固定 workflow inputs，首个事件回传 `GITHUB_RUN_ID`，随后驱动既有 crawler 并始终发送终态事件。 | GitHub Actions、runner-event API |
| Dashboard crawler workspace | 任务创建、状态/日志查看、取消/重试和入库后跳转内容 CRUD；轮询 API，不读取本地或 Actions 文件。 | command/query API |
| Existing content sync/CRUD | crawler 完成实际 upsert，管理员继续编辑、删除、锁定元数据和查看内容。 | `movies`/`comics` routes、cache invalidation |

### Data Model And State Authority

使用任务与运行两层记录，避免“重试覆盖原日志”或把页面状态当作事实源。

| Table | Core fields | Rule |
|-------|-------------|------|
| `crawler_task` | `id`, `template_key`, `template_version`, `executor`, `request_snapshot`, `created_by`, `latest_run_id`, `cancel_requested_at`, timestamps | 一次受控请求的不可变快照；只记录允许的 `movie` 或 `comic` 模板。 |
| `crawler_run` | `id`, `task_id`, `attempt`, `status`, `executor`, `github_run_id`, `started_at`, `heartbeat_at`, `finished_at`, `summary`, `failure_code`, `parent_run_id` | 执行生命周期事实源；`(task_id, attempt)` 唯一，终态永不回退。 |
| `crawler_run_log` | `id`, `run_id`, `sequence`, `event_id`, `level`, `code`, `message`, `details`, `created_at` | 追加式结构化日志；`(run_id, sequence)` 和 `event_id` 唯一，详情必须脱敏且有大小上限。 |
| `audit_log` (existing) | 操作者、动作为 CREATE/CANCEL/RETRY、任务 ID、脱敏后的模板和原因 | 人工命令审计；不复制 runner 高频日志。 |

`crawler_run.status` 是执行状态的唯一权威；`crawler_task.latest_run_id` 只是列表投影。推荐状态机为：

```text
queued -> dispatching -> running -> succeeded
                              |          -> failed
queued/dispatching/running -> cancel_requested -> cancelled
failed/cancelled -> retry creates a new queued run
```

`dispatching` 解决 API 已持久化但 GitHub 尚未确认的窗口。没有收到 runner 心跳的非终态 run 由受控的超时巡检标为 `failed`（例如 `runner_lost`），不把旧的 `running` 误显示为成功。

## Data Flow

### Dashboard 发起生产任务

1. Dashboard 以现有 session 和 `canAccessCrawler` 对应资源权限请求 `POST /admin/crawler-tasks`。DTO 只接受模板键和运行位置；不接受命令、秘密、工作流文件、任意环境变量或任意来源地址。
2. API 从服务端 registry 解析模板版本、目标 profile 和固定参数，在 D1 中一次写入 task、`queued` run 与人工审计记录；D1 `batch()` 用于不可分的状态投影与日志写入。
3. API 以 Worker secret 中的最小权限 GitHub token 调用固定 workflow dispatch，并传入 `appRunId`、受解析 target 和模板版本。成功后将 run 更新为 `dispatching`；调用失败则写终态 `failed` 和结构化原因。
4. Action 的首步以 `appRunId` 发签名 `started` 事件，同时附上稳定的 `GITHUB_RUN_ID`。API 将其绑定到预创建 run，随后接受 `progress`、`log`、`succeeded`、`failed` 或 `cancelled` 事件。
5. runner 仍通过已有 `ApiClient` 和已有同步接口写 movie/comic 数据。成功事件携带已同步数量和可安全显示的摘要；Dashboard 随后跳转到现有内容 CRUD，内容修改仍由原有缓存失效及审计逻辑负责。

### 本地任务

Dashboard 本身不能启动用户机器上的 Puppeteer。选择 `local` 时，API 同样先创建 task/run，但 UI 展示受控的 run ID 与固定 runner 命令；本地命令只接受该 ID，并从 API 读取已冻结模板。它与 Actions 调用完全相同的 `started/progress/log/terminal` 事件 API 和取消检查。这样本地与生产共享状态、日志、重试和验收路径，而不需要浏览器触发远程 shell。

### 定时任务与兼容

保留现有日程，但将 schedule workflow 的第一步改为向 API 注册一个 `scheduled` task/run，再执行同一模板 adapter。新建的手动 Action 也必须带 API 生成的 run ID；不再允许以 Actions 页面中的自由输入绕开控制平面。这样每日任务、Dashboard 手动任务和本地任务都可见、可审计、可取消，并且仍使用现有 target-profile/environment 投影。

### Cancel And Retry

取消先在 D1 记录 `cancel_requested`，再在已知 `github_run_id` 时请求 GitHub 取消。GitHub 取消是异步的，API 不能在 REST 响应后直接标为 `cancelled`；终态必须由 runner 回调确认。runner 在开始、每个队列批次、内容同步前后检查取消意图，安全退出并关闭浏览器。本地 runner 用同一检查点而不是让 API 杀死任意进程。

重试保留旧 run 和所有日志，创建带相同冻结快照、递增 `attempt` 与 `parent_run_id` 的新 run。只允许失败或已取消的运行重试，并以条件更新或唯一约束阻止同一 task 同时存在两个活动 run。

## Patterns To Follow

### Pattern 1: Command/Event Split

**What:** 人工 API 是命令面，runner API 是事件面；二者鉴权、DTO、速率和副作用分离。

**When:** Dashboard 创建、取消、重试与 Actions/local runner 汇报执行状态时。

**Why:** 现有 `serviceAuth` 的 `CRAWLER_SECRET` 代表广泛服务权限，不能把它直接复用于可改变任意 run 的回调接口。新增 `CRAWLER_RUN_CALLBACK_SECRET`，采用 `timestamp + body` 的 HMAC、短时间窗、`event_id` 幂等键和 run ID 绑定；dispatch token 仅留在 API Worker，绝不返回 Dashboard。

**Example:**

```ts
type CrawlerRunEvent = {
  runId: string
  eventId: string
  sequence: number
  type: 'started' | 'progress' | 'log' | 'succeeded' | 'failed' | 'cancelled'
  githubRunId?: string
  summary?: { discovered: number, synced: number, skipped: number }
}

// Reject duplicate event_id and illegal state changes, then batch
// INSERT log + UPDATE heartbeat/status/summary in one D1 call.
```

### Pattern 2: Server-Owned Closed Template Registry

**What:** API code owns an exhaustive map from the two UI-visible templates to the exact crawler entry, workflow, target profile projection and bounded options.

**When:** 所有创建、分发、本地运行和重试。

**Why:** `packages/config/src/deployment-target/mutation-entry.ts` 当前 registry 包含更广的 crawler entries，且其中部分允许 `url`、`limit`、`dry-run`。v1.3 的 Dashboard DTO 不能透传这些选项。视频与漫画模板应各自固定默认参数，若以后需要受控范围，新增专门 schema 和上限，而不是开放 CLI 参数。

### Pattern 3: Event Idempotency And Conditional State Transition

**What:** 每个 runner event 都有唯一 `event_id` 与单调 `sequence`；状态更新使用允许前序状态的条件写入。

**When:** 网络重试、Actions 重跑、日志乱序或最终回调重复时。

**Why:** crawler 已对 API 请求重试，Action 也可 rerun。没有幂等性会重复计数、把成功重写为失败，或产生重复日志。`GITHUB_RUN_ID` 在 workflow 首个事件回传后用于外部执行关联，但业务 run ID 始终由 API 预先分配。

### Pattern 4: Existing Crawler As a Template Adapter

**What:** 新增薄 adapter，把 run context、事件 sink 与取消检查注入既有 movie/comic crawler；不重写站点策略、Puppeteer、`ApiClient` 或内容 sync。

**When:** 本地和 CI 两种执行器。

**Why:** 当前 `target-crawl-mutation.ts` 明确只允许 smoke operation，而 target registry 与 daily workflows 已枚举真实 crawler entry。这是 v1.3 的实现前置矛盾：必须先将该边界调整为“仅允许两种 registry-owned 模板的实际 adapter”，并用测试证明其拒绝任意 entry/args；不能静默绕过现有 guard。

## Anti-Patterns To Avoid

### Anti-Pattern 1: 在 Worker 中运行 Puppeteer

**Why bad:** 会把长期浏览器执行从现有已验证的 Node/local/Actions 执行边界迁入 API Worker，并使任务回调、取消和资源清理的责任混在一个服务中。

**Instead:** Worker 只保存、分发和收集状态，Puppeteer 保持在 `packages/crawler` 的本地 runner 或 GitHub-hosted runner。

### Anti-Pattern 2: 以 Actions 控制台或 URL 参数作为任务事实源

**Why bad:** dispatch 返回与 GitHub 日志都不能成为 D1 业务状态；未带 app run ID 的运行不可可靠取消、重试或归属。

**Instead:** 先创建 D1 run，再把该 ID 传入 workflow。所有终态由已鉴权事件写入 D1。

### Anti-Pattern 3: 以本地 JSON 或 console 文本作为后台日志

**Why bad:** 当前失败任务页明确只能提示本地/Actions 文件，生产 Dashboard 看不到可查询、可分页和可审计的执行历史。

**Instead:** 记录有等级、代码、序列号和脱敏 details 的 D1 结构化日志；Dashboard 按 run 分页读取。

### Anti-Pattern 4: 用通用服务 token 接受任务事件

**Why bad:** `CRAWLER_SECRET` 已可访问旧服务同步接口，复用它会扩大回调 endpoint 的写权限与重放影响面。

**Instead:** 独立 callback secret、HMAC、时间窗、event 去重、run/template 校验；保持旧内容同步认证不变。

### Anti-Pattern 5: 重试覆盖原运行

**Why bad:** 失败原因、取消时间、入库计数和人工操作证据都会丢失，无法解释内容为何存在或为何重复。

**Instead:** 新 attempt、新 run、新日志，原 run 不可变；任务详情聚合各次 attempt。

## Scalability Considerations

| Concern | At 100 runs | At 10K runs | At 1M runs |
|---------|-------------|-------------|------------|
| D1 查询 | `task_id`、`status`、`created_at` 和 `run_id, sequence` 索引；Dashboard 5-10 秒轮询。 | 按 run 分页日志，列表只读摘要/最新 run。 | 日志分区、归档和独立观测存储需要单独立项；当前自用范围不预建。 |
| 事件写入 | 每个状态/日志事件短事务，D1 batch 更新状态投影。 | 合并高频 progress，保留关键 log；避免逐条抓取明细写日志。 | 需要队列或流式采集，不在 v1.3 范围。 |
| 并发控制 | 每模板/执行器一个活动 run；拒绝或排队重复请求。 | 根据模板增加 D1 lease/队列策略。 | 引入外部队列及 worker pool；不能靠 Dashboard 轮询扩容。 |
| 日志保留 | 保留完整最近运行，按时间清理低价值 debug。 | 增加日志 TTL/归档 job。 | 定义合规保留和成本预算后再选择专门日志系统。 |

## Roadmap Order

1. **持久化任务契约与安全边界**
   - 增加 D1 schema/migration、共享 API types、状态迁移 repository、模板 registry、Dashboard command/query routes 和独立 callback auth。
   - 先用单元测试覆盖幂等事件、非法迁移、权限、日志脱敏、取消意图和 retry attempt。

2. **本地 runner 纵向切片**
   - 为视频与漫画模板实现 adapter，接入既有 Node/Puppeteer crawler、内容 sync 与 cleanup；Dashboard 显示任务、日志、取消/重试和入库后内容入口。
   - 通过 Gateway `http://localhost:8080` 验证“创建 -> 本地执行 -> D1 状态/日志 -> 内容 CRUD”完整链路。

3. **GitHub Actions 受控编排**
   - 将两个 daily workflow 改为固定 `appRunId` 输入和签名回调；API dispatch 写入外部 run ID，加入取消 REST 调用、heartbeat 超时与 schedule 注册。
   - 维持 target-profile/environment 投影与现有 secrets，不允许 workflow input 扩展成任意 CLI。

4. **生产验收与运维收口**
   - 验证一次生产模板从 Dashboard 到 Action、回调、D1、Dashboard 日志和真实入库/内容编辑；补充失败、取消、重试与 Actions 重跑回归。
   - 为日志留存、失联 run、dispatch token 权限和回滚步骤更新 canonical RUNBOOK/验证证据。

**Ordering rationale:** 运行记录与签名事件是本地与 CI 的共同依赖，必须先完成；本地纵向切片以较低外部风险验证状态机和现有 crawler adapter；只有在其稳定后再接入 GitHub dispatch/cancel 的异步语义，最后才有可信的生产端到端验收。

## Sources

| Source | Finding used | Confidence |
|--------|--------------|------------|
| [Cloudflare D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) (last updated 2026-06-22) | `batch()` 按序执行并作为 SQL transaction 回滚，适合事件日志与状态投影的短事务。 | MEDIUM |
| [GitHub workflow dispatch REST API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) | Workflow dispatch 应只接收 API 已分配的 run ID 与受控输入。 | MEDIUM |
| [GitHub workflow run cancellation API](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run) | Actions 取消是异步编排，最终状态需 runner 回调确认。 | MEDIUM |
| [GitHub Actions default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables) | `GITHUB_RUN_ID` 可稳定绑定外部工作流运行。 | MEDIUM |
| Repository evidence: `apps/api/src/routes/admin/crawlers/index.ts`, `.github/workflows/daily-movie-crawl.yml`, `.github/workflows/daily-manga-crawl.yml`, `packages/crawler/src/lib/base-crawler.ts`, `packages/config/src/deployment-target/mutation-entry.ts` | 现有 API/权限、target profile、Actions、crawler sync 与 smoke-only guard 的真实边界。 | HIGH |

## Architecture Research Flags

- GitHub dispatch endpoint 已被官方文档验证，但 API Worker 的 dispatch token 采用 fine-grained PAT 还是 GitHub App 仍需在实现 phase 根据现有 secrets owner 确认；自用单仓优先最小权限 PAT。
- 真实 crawler entry 与 `target-crawl-mutation.ts` 的 smoke-only guard 当前存在活代码矛盾。Phase 2 必须先以测试锁定两模板 adapter 的允许范围，再接生产 workflow。
- 文本日志的单条上限、保留周期和失联 heartbeat 阈值应在 phase 讨论中定值；本研究只确定它们必须受限、可检测和可审计。
