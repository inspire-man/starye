# Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全 - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

把现有 Cloudflare Workers / Pages / D1 的“能部署”提升到“可稳定上线、可回滚、可观测、迁移有护栏”的正式工程基线。

**In scope（本 phase 收口）：**

- 现有各 app 的 deploy workflow 补齐到可持续维护的统一生产基线
- 新增按 app/version_id 执行的 rollback workflow
- D1 migration 前备份与危险 schema 变更 gate
- API / gateway / movie-app / comic-app / blog / auth 的 Sentry 接入骨架
- RUNBOOK 收口：部署、回滚、WAF、D1 迁移、常见故障处理
- 保留 crawler 的 Actions 默认失败通知作为 v1 告警下限

**Out of scope（本 phase 明确不做）：**

- staging 环境、preview 环境策略优化（保留到 v2 / OPS）
- 自建 Prometheus / Grafana / APM
- 深度 Sentry 噪音打磨（仅做第一轮 `beforeSend` 过滤）
- 新的业务能力、UI 功能或内容域改动
- crawler 架构重写、重试/代理/分布式调度增强

</domain>

<decisions>
## Implementation Decisions

### 部署与触发策略
- **D-01:** 保持现有 `push -> main` 自动部署与 `workflow_dispatch` 手动触发双入口，不改成 PR merge queue、tag release 或复杂 promotion pipeline。
- **D-02:** 继续沿用“每个 app 单独 workflow”的结构，不在 Phase 5 合并成一个超大 monolithic deploy workflow。
- **D-03:** `wrangler` 在 v1 内统一升级到 `^4.90.0` 以上，并以 root / `apps/api` / `apps/gateway` 的 package.json 为准同步。

### 回滚策略
- **D-04:** 新增统一 `rollback.yml`，通过 `workflow_dispatch` 接收 `app` + `version_id`，对 Worker 走 `wrangler rollback`，对 Pages 至少先给出明确人工回滚路径和参数入口。
- **D-05:** 回滚的优先目标是“1 分钟内恢复服务”，不是做全自动多阶段审批；v1 先保住可执行和可理解。
- **D-06:** 数据库 schema 回滚不做自动化逆迁移；D1 仍采用“正向补救 migration”策略，RUNBOOK 里明确这一点。

### D1 migration 安全
- **D-07:** `deploy-migrations.yml` 在 apply 前必须先做 `wrangler d1 export --remote` 备份到 R2。
- **D-08:** `DROP COLUMN`、等价 destructive schema 变更必须单独 gate，CI 不允许静默放行。
- **D-09:** Phase 5 只要求“危险变更必须被 reviewer 明确 ack”，不追求数据库 schema diff 引擎的复杂自动判断超出实际需要。

### Sentry 接入
- **D-10:** Workers 侧统一使用 `@sentry/cloudflare` + `honoIntegration()`，不使用已 deprecated 的 `@hono/sentry`。
- **D-11:** 前端按框架原生 SDK 接入：Vue app 用 `@sentry/vue`，Nuxt app 用 `@sentry/nuxt`。
- **D-12:** 所有端先汇入同一 Sentry 项目，v1 不做多项目拆分。
- **D-13:** `beforeSend` 第一轮明确过滤：`AbortError`、`NetworkError`、以及用户体感上已自恢复的媒体错误噪音。
- **D-14:** `<video>` 播放失败按 message/event 上报，不强行抛 crash exception。

### RUNBOOK 与运维基线
- **D-15:** 现有根目录 `RUNBOOK.md` 作为唯一正式运维手册承载点，不再新建第二份 phase-local 运维文档。
- **D-16:** RUNBOOK 必须吸收 Phase 2 的 WAF 手配记录与 Phase 4 的 migration smoke 经验，避免跨 phase 运维信息分散。
- **D-17:** crawler 失败告警沿用 GitHub Actions 默认邮件，不额外引入 Discord / Slack / Telegram。

### 范围纪律
- **D-18:** Phase 5 关注“上线可靠性与可观测骨架”，不扩成新业务需求整理或历史技术债大清仓。
- **D-19:** 如果现有 workflow 已能稳定完成某 app 的生产 deploy，则 planner 优先做统一性/护栏增强，不重写工作流结构求“更漂亮”。

### the agent's Discretion
- rollback workflow 对 Pages 的具体表达形式（脚本化回滚、指令提示、或半自动）由 planner 结合 Cloudflare 当前能力决定，只要 RUNBOOK 和 workflow 输入输出清晰。
- destructive migration gate 的技术实现（grep / diff / manifest / reviewer label）由 planner 选最稳妥且最少误报的一种。
- Sentry 初始化代码放在各 app 的入口文件还是独立 observability 模块，由 planner 结合现有结构决定。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` Phase 5 段 — Goal、Depends on、5 条 success criteria
- `.planning/REQUIREMENTS.md` § Deploy（DEPLOY-01..06）
- `.planning/REQUIREMENTS.md` § Observability（OBS-01..05）
- `.planning/PROJECT.md` — Core Value、Cloudflare 预算约束、单用户定位
- `.planning/STATE.md` — 当前 milestone 状态与已完成 Phase 1..4 的上下文

### 上游 phase 依赖
- `.planning/phases/02-dashboard/02-CONTEXT.md` — WAF / docs auth / pages.dev redirect 的既有决策
- `.planning/phases/03-movie-app-r2/03-CONTEXT.md` — 播放错误卡片与播放器错误语义，为 `<video>` Sentry 事件埋点提供背景
- `.planning/phases/04-progress/04-CONTEXT.md` — 统一 progress / migration cutover 的语义与 smoke 验证要求
- `.planning/phases/04-progress/04-HUMAN-UAT.md` — 本地 migration smoke checklist
- `.planning/phases/04-progress/04-SECURITY.md` — migration / gate / auth 边界已验证威胁

### 现有 CI/CD 与平台配置
- `.github/workflows/ci.yml` — 当前 CI 顺序与 test gate
- `.github/workflows/deploy-api.yml`
- `.github/workflows/deploy-gateway.yml`
- `.github/workflows/deploy-auth.yml`
- `.github/workflows/deploy-blog.yml`
- `.github/workflows/deploy-dashboard.yml`
- `.github/workflows/deploy-movie.yml`
- `.github/workflows/deploy-comic.yml`
- `.github/workflows/deploy-migrations.yml`
- `apps/api/wrangler.toml`
- `apps/gateway/wrangler.toml`

### 数据库与 migration
- `packages/db/MIGRATION.md`
- `packages/db/drizzle/0026_unified_progress_cutover.sql`
- `packages/db/drizzle/` 下现有 migration 结构

### 运维与集成背景
- `RUNBOOK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

### 官方参考
- `https://developers.cloudflare.com/workers/wrangler/commands/#rollback`
- `https://developers.cloudflare.com/d1/observability/debug-d1/#export-a-database`
- `https://docs.sentry.io/platforms/javascript/guides/cloudflare/`
- `https://docs.sentry.io/platforms/javascript/guides/vue/`
- `https://sentry.nuxtjs.org/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 现有 `.github/workflows/deploy-*.yml` 已覆盖 api / gateway / auth / blog / dashboard / movie / comic 的基本生产部署，可在此基础上统一增强，而非从零新建。
- `deploy-migrations.yml` 已存在远程 apply 流程，是 Phase 5 加备份和 destructive gate 的最佳落点。
- `apps/api/wrangler.toml` 已启用 Workers observability logs/traces，可作为 Sentry 接入前后的对照基线。
- 根目录 `RUNBOOK.md` 已存在，可直接扩写，不需要重新发明位置。

### Established Patterns
- 当前 workflow 普遍使用 Node 24 + pnpm 10.33.0 + `pnpm install --no-frozen-lockfile`
- Pages deploy 走 `wrangler pages deploy ... --project-name=... --branch=main`
- Worker deploy 走 `pnpm --filter api|gateway run deploy`
- migrations 由单独 workflow 处理，而不是隐式耦合在 API deploy 中

### Integration Points
- rollback workflow 要与现有 Cloudflare API token / account secret 体系兼容
- Sentry 接入要落到各 app 的实际入口：Workers 中间件、Vue `main.ts`、Nuxt config/runtime
- RUNBOOK 要串起 Phase 2 的 WAF、Phase 4 的 migration smoke、Phase 3 的播放错误来源

</code_context>

<specifics>
## Specific Ideas

- 用户的核心优先级一直是“能用、不崩”，所以 Phase 5 应优先保证 deploy / rollback / migration / error visibility 的执行闭环，而不是追求平台工程的完整度。
- 现有 repo 已经有大量 deploy workflow，说明这不是“从 0 到 1 搭 CI”，而是“把已有部署路径变成正式受控基线”。
- Phase 4 刚经历过 unified progress cutover，因此数据库迁移备份和 destructive gate 在当前 milestone 里是高优先级。

</specifics>

<deferred>
## Deferred Ideas

- staging / preview 环境矩阵、Sentry 噪音二轮治理、指标仪表盘、自建 APM 保留到 v2 / OPS。
- crawler 可靠性增强（代理轮换、断点续抓、分布式调度）继续留在 crawler 相关后续 phase，不并入 Phase 5。

</deferred>

---

*Phase: 05-migration*
*Context gathered: 2026-05-13*
