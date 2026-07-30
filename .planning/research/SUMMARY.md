# Project Research Summary

**Project:** Starye v1.3 后台爬虫任务与内容运维
**Domain:** 单作者内容中台的 crawler control plane
**Researched:** 2026-07-30
**Overall confidence:** MEDIUM

## Executive Summary

v1.3 的正确形态是持久化的“爬虫控制平面”。Dashboard 发起受控的视频或漫画任务，`apps/api` 在 D1 中保存任务、每次执行和结构化日志；真正的数据面继续使用现有 Node/Puppeteer crawler。本地由显式 Node runner 执行，生产继续由 GitHub Actions 执行。Cloudflare Worker 只负责鉴权、状态、受控 dispatch 和回调，不承担浏览器自动化。

现有仓库已具备视频/漫画 crawler、内容同步、Dashboard 内容 CRUD、GitHub Actions `workflow_dispatch`、target-profile 和 crawler 监控页。实际缺口是任务事实源：当前恢复接口只返回手工操作说明，失败任务只存在于本地/Actions 文件，无法形成可查询、可取消、可重试、可审计的后台执行记录。

生产链路可在既有 Actions 上实现，但要坚持“D1 是业务真相、Actions 是执行器”的边界。API 必须先创建应用级 run ID，再把它作为固定 workflow input；Action 以签名回调绑定 `GITHUB_RUN_ID` 并持续上报。成功必须拥有经过校验的入库 receipt，绝不能由 dispatch 受理、runner 启动或进程退出码推断。

## Key Findings

**Stack:** 复用 Turborepo、TypeScript、Hono、Drizzle/D1、Valibot、现有 Node 24/Puppeteer 和 GitHub Actions；GitHub 控制面采用窄的原生 Workers `fetch` client，避免新增 Octokit、Redis、BullMQ、Temporal 或 Durable Objects。

**Feature baseline:** 固定视频/漫画模板、任务/attempt 生命周期、状态和结构化日志、启动/详情/取消/重试、local/Actions 双 runner、入库 receipt 与现有内容 CRUD 跳转，是本里程碑的 table stakes。

**Architecture:** `crawler_task` 保存一次受控请求，`crawler_run` 保存每个 attempt，`crawler_run_log` 保存追加式脱敏事件；API command routes 和 runner-event routes 分离鉴权。模板 registry 由服务端封闭映射到两个现有 entry 和 workflow，Dashboard 永远不传 shell、密钥、任意 URL、workflow 名或 target-profile 参数。

**Critical pitfall:** GitHub `workflow_dispatch` 的成功响应不等于执行或入库成功。必须用应用级 run ID、回调 nonce、HMAC、事件幂等和条件状态迁移避免串单、重放、晚到回调和错误成功声明。

## Implications for Roadmap

1. **Phase 16: Task Domain Foundation**
   - 交付 D1 schema/migration、共享 DTO/状态机、受控模板 registry、API command/query routes、审计、幂等与日志 redaction。
   - 先锁定 `queued -> dispatching -> running -> terminal`、取消与 retry 新 attempt 语义。
   - 避免复用 `movies`/`comics` 的 `crawlStatus`，也不让 Actions concurrency 充当业务队列。

2. **Phase 17: Local Runner Vertical Slice**
   - 交付 local runner adapter、签名 event/heartbeat/receipt、取消协作、retry 和 Dashboard 查询面。
   - 通过 Gateway `http://localhost:8080` 证明“后台创建 -> 本地 crawler -> D1 状态/日志 -> 入库 -> 现有内容 CRUD”。
   - 复用既有 crawler/ApiClient/cleanup，避免重写站点策略和 Puppeteer。

3. **Phase 18: GitHub Actions Production Orchestration**
   - 交付固定 workflow dispatch/correlation、GitHub run 回调、missed-callback reconciliation、provider cancel/retry 和 schedule 接入。
   - 保留 target-profile、GitHub Environment 与现有 Cloudflare/R2 secrets；API 使用单仓最小权限 Actions token，runner callback 使用独立 HMAC secret。

4. **Phase 19: Dashboard Operations And End-to-End Proof**
   - 交付任务启动、列表、详情、分页日志、取消/重试、receipt 到现有内容 CRUD 的跳转，以及本地和生产路径验收。
   - 成功证据包含应用 run、Actions/local runner、D1 状态/日志、入库 receipt 和内容编辑，不把 provider dispatch 当验收终点。

**Phase ordering rationale:** 持久化契约与签名事件同时是两类执行器和 Dashboard 的依赖，必须优先。随后用本地纵向切片低风险验证状态机和 crawler adapter，再接入 GitHub 的异步/凭据语义，最后做生产端到端证明和运维收口。

## Research Flags

| Phase | Assessment | Follow-up |
|-------|------------|-----------|
| 16 | Needs focused design | 明确 migration、状态转换矩阵、D1 条件更新和回调签名格式。 |
| 17 | Needs implementation research | 核对现有 target-crawl mutation guard，收窄为两个 registry-owned 实际 crawler adapter。 |
| 18 | Needs provider verification | 在实现前验证 GitHub fine-grained PAT 的确切 Actions 权限、dispatch/cancel 回应和 workflow input 契约。 |
| 19 | Standard application patterns | 复用 Dashboard 的确认、资源权限、错误处理和既有内容 CRUD。 |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | 仓库依赖和平台能力已核对；GitHub/Cloudflare API 由官方资料支持。 |
| Features | HIGH | 直接来自用户确认的 v1.3 目标和现有 crawler/dashboard 缺口。 |
| Architecture | HIGH | 基于现有 Hono、D1、target-profile、Actions workflow 和 Node crawler 的真实边界。 |
| Pitfalls | MEDIUM | 幂等、取消和 provider correlation 基于平台行为与仓库执行模式，需以实现测试进一步固化。 |

## Gaps To Address

- GitHub Actions dispatch token 的最终权限/轮换方式需在 Phase 18 按实际 repository owner 和 secret 管理面验证；单仓 fine-grained PAT 是当前建议，GitHub App 仅作为明确升级路径。
- 本地 runner 的启动方式需在 Phase 17 与现有本地 dev supervisor 协调，但其状态/事件契约已固定。
- 日志单条大小、保留期、heartbeat 超时和每模板并发上限需在 Phase 16 形成可测试的具体数值。

## Sources

- Repository evidence (HIGH): [`.planning/PROJECT.md`](../PROJECT.md), [`apps/api/src/routes/admin/crawlers/index.ts`](../../apps/api/src/routes/admin/crawlers/index.ts), [`apps/dashboard/src/views/Crawlers.vue`](../../apps/dashboard/src/views/Crawlers.vue), [daily movie/manga workflows](../../.github/workflows/), [`packages/crawler/package.json`](../../packages/crawler/package.json).
- Platform documentation (MEDIUM): GitHub workflow dispatch/cancel/concurrency and Cloudflare D1 prepared statement/transaction documentation, recorded in [STACK.md](STACK.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
