# Domain Pitfalls

**Domain:** Starye v1.3 后台爬虫任务与内容运维
**Researched:** 2026-07-30
**Overall confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: 把 GitHub Actions dispatch 当成任务已经开始或成功

**What goes wrong:** `workflow_dispatch` 的受理结果只证明 GitHub 接受了请求，尚未绑定实际的 `GITHUB_RUN_ID`，也未证明 crawler、入库或内容可编辑。通过扫描“最近一次 workflow”关联任务会在并发、schedule 与人工 rerun 时串单。

**Prevention:** API 先生成 D1 `crawler_task` 和 `crawler_run`，把唯一的应用 run ID 作为固定 workflow input。Action 的第一步回传 `GITHUB_RUN_ID`、attempt 和已签名的 `started` 事件；成功必须回传有验证的入库 receipt。

**Detection:** `dispatching` 长时间未收到 `started`、同一应用 run 关联多个 GitHub run、或 terminal run 缺少 receipt 时，保留为 checkpoint/failed，而非显示成功。

### Pitfall 2: 状态与日志缺少幂等和条件转换

**What goes wrong:** 网络重试、GitHub rerun、晚到的失败回调会重复写日志，或将已成功的 run 改回失败。重试覆盖旧 run 则会丢失失败原因、取消记录和内容归属。

**Prevention:** `crawler_run` 使用封闭状态机和 compare-and-set 更新；每个 runner event 带唯一 `event_id`、单调 `sequence` 和 run nonce。`crawler_run_log` 对 `(run_id, sequence)`/`event_id` 建唯一约束；retry 永远创建新的 attempt，并关联旧 run。

**Detection:** 为非法前序状态、重复 event、sequence 回退、终态再写入建立单元测试和审计日志；Dashboard 明确显示所有 attempt，而非只显示最后一条。

### Pitfall 3: 让 Cloudflare Worker 或 Dashboard 直接执行 crawler

**What goes wrong:** 当前 crawler 依赖 Node、Puppeteer、浏览器资源清理和既有 target-profile 入口。Worker/Pages/Dashboard 承担这些执行会破坏生产边界，本地浏览器按钮也不会自动拥有启动用户机器进程的能力。

**Prevention:** API 仅做控制面和短请求；本地由显式 Node runner 使用已创建的 run ID 执行，生产继续由 GitHub Actions 执行。二者向同一个 runner-event API 上报状态、日志、取消确认和 receipt。

**Detection:** 任何 dashboard DTO 中出现 shell、任意 URL、环境变量或 workflow 文件名，或 API route 出现 Puppeteer/`child_process`，都应被契约测试拒绝。

### Pitfall 4: 取消只调用 GitHub API，或立即显示已取消

**What goes wrong:** Actions cancel 是异步的；crawler 可能正请求来源站、同步内容或关闭浏览器。API 收到取消 REST 响应后直接写 `cancelled` 会造成状态与真实写入不一致。

**Prevention:** 先原子写 `cancel_requested`/`cancelling`，runner 在开始、批次边界和同步前后检查取消意图，以 `AbortController` 和安全 cleanup 终止。GitHub cancel 是第二道编排；只有 callback 或可信 provider reconciliation 确认后才进入终态。

**Detection:** 覆盖 pending、dispatching、running、terminal 四种取消分支；检查终态后的日志、入库计数和 Actions run 结论一致。

### Pitfall 5: 回调通道成为新的高权限写入口

**What goes wrong:** 复用广泛用途的 `CRAWLER_SECRET`，或只信任 task/run ID，会让重放、伪造或跨任务事件修改状态。把 token、请求头、来源 HTML 写入日志还会扩大泄露与存储成本。

**Prevention:** 独立 `TASK_RUNNER_CALLBACK_SECRET`，对 `timestamp + '.' + raw body` 做 HMAC；校验短时间窗、nonce、run/template 对应关系和事件去重。日志使用封闭事件类型、字段 allowlist、大小上限和 redaction，GitHub token 仅留在 Worker secret。

**Detection:** 为错误签名、过期时间、错误 nonce、重复事件、跨 run 事件和包含 secret-shaped 字段的日志加入 API 测试。

## Moderate Pitfalls

### Pitfall 1: 把现有 `crawlStatus` 当作任务执行状态

**What goes wrong:** `movies`/`comics` 的 `crawlStatus` 表达内容完整度；它无法表达一次任务的队列、provider、取消、日志或 retry history。

**Prevention:** 独立 `crawler_task`/`crawler_run`/`crawler_run_log`。完成任务只通过 receipt 关联新增/更新的内容 ID，再跳转现有 CRUD。

### Pitfall 2: 让 schedule 或 GitHub 手动页面绕过控制平面

**What goes wrong:** 日常 workflow、Actions 手动 run 与 Dashboard run 分别生成事实，导致任务不可见、无法取消和双重执行。

**Prevention:** schedule workflow 也先向 API 注册 run，所有 workflow 都消费 API 分配的 run ID 和固定模板；D1 lease 决定同模板的 active run。

### Pitfall 3: 以 Actions concurrency 充当持久队列

**What goes wrong:** GitHub concurrency 会替换同组 pending run，无法提供 v1.3 所需 FIFO、重试历史和可信状态。

**Prevention:** D1 作为任务/claim 的唯一业务事实源；Actions concurrency 只作执行器的额外冲突保护。

### Pitfall 4: 将高频 debug 或原始日志长期存入 D1/R2

**What goes wrong:** 单个抓取项和页面级日志会迅速膨胀；R2 长期 debug dump 也违背当前成本/生命周期边界。

**Prevention:** D1 只存状态、关键结构化事件和受限摘要；按 run 分页、限制单条和总行数，明确 TTL。原始执行细节保留在 GitHub Actions 短期日志，并在后台链接。

### Pitfall 5: 将“进程退出 0”视为入库成功

**What goes wrong:** crawler 可因空结果、部分同步或错误 target 成功退出，Dashboard 随即声称任务完成而内容页无可管理数据。

**Prevention:** terminal `succeeded` 需要经过 schema 校验的 receipt，至少包含已发现/已同步/已跳过计数及稳定内容标识；对空/不匹配 receipt 记为 `partial` 或 `failed`。

## Minor Pitfalls

### Pitfall 1: 重建已有内容编辑器

**What goes wrong:** 为任务页新增第二套 video/comic 编辑逻辑会分叉校验、缓存失效和审计。

**Prevention:** run receipt 直接链接现有 Dashboard 内容列表/详情 CRUD，仅增加必要的 run filter 或 receipt 关联。

### Pitfall 2: 未定义 dispatch token 的轮换与权限边界

**What goes wrong:** 一个宽权限或永久 GitHub token 成为生产控制面的隐性单点。

**Prevention:** 单仓 fine-grained PAT 只授予 Actions 所需权限、设置到期日；在 RUNBOOK 记录 secret 名称、轮换、失效、回滚和 GitHub App 升级触发条件。

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Task domain foundation | schema 只描述 happy path，重试/取消/幂等无处落脚 | 先写状态表、唯一约束、迁移、transition matrix 和 event tests |
| Local runner slice | 为了方便绕开 API，使用本地 JSON 或直接更新数据库 | local runner 只消费 API 分配的 run ID，并通过同一 signed event API 上报 |
| GitHub Actions orchestration | dispatch 与 provider run 错绑、schedule 双执行或 token 泄露 | 固定 workflow/ref/template，首事件绑定 `GITHUB_RUN_ID`，D1 lease，secret 仅存在 Worker/Environment |
| Dashboard operations | 按钮重复触发、直接信任 optimistic state 或泄露日志细节 | command confirmation、loading/disabled state、轮询 D1 投影、日志 redaction/pagination |
| E2E and operations | 把 provider dispatch 或 process exit 当作 production success | 验收必须覆盖 Dashboard -> Action/local runner -> D1 status/log -> ingestion receipt -> content CRUD |

## Sources

- Repository evidence (HIGH): [`.planning/PROJECT.md`](../PROJECT.md), [`apps/api/src/routes/admin/crawlers/index.ts`](../../apps/api/src/routes/admin/crawlers/index.ts), [`apps/dashboard/src/views/Crawlers.vue`](../../apps/dashboard/src/views/Crawlers.vue), [daily crawler workflows](../../.github/workflows/), [`packages/crawler/package.json`](../../packages/crawler/package.json).
- Official platform documentation (MEDIUM): GitHub Actions workflow dispatch/cancel/concurrency and Cloudflare D1 prepared statement/transaction documentation, cross-checked in v1.3 STACK and ARCHITECTURE research.
