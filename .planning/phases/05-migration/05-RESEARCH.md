---
phase: 05-migration
status: complete
generated: 2026-05-13
source: gsd-plan-phase
---

# Phase 5 Research — 部署基础盘 + 可观测骨架 + Migration 安全

## Executive Summary

当前仓库已经具备“每个应用大致都能单独部署”的基础，但还没有达到 Phase 5 要求的“可稳定上线、可回滚、迁移有护栏、错误可集中观测”的正式生产基线。

最重要的现状判断：

1. **Deploy workflows 已存在，但分散且不一致。**
   - `api` / `gateway` 用 `pnpm --filter api|gateway run deploy`
   - Pages 应用多为 `wrangler pages deploy`
   - 都支持 `push main` 与 `workflow_dispatch`
   - 但还没有统一 rollback path，也没有显式部署后验证与 runbook 闭环

2. **D1 migration workflow 已存在，但缺少“备份先行”和 destructive guard。**
   - `.github/workflows/deploy-migrations.yml` 直接 remote apply
   - 没有 `wrangler d1 export --remote` 备份
   - 没有 `DROP COLUMN` / destructive schema change reviewer gate

3. **Sentry 目前基本是空白。**
   - 代码库 grep 未发现 `@sentry/*` 依赖或初始化
   - Workers 只有 Cloudflare logs/traces
   - Vue/Nuxt 前端没有统一 crash / message 上报
   - Phase 3/4 新增的播放与进度路径正适合成为第一批观测对象

4. **RUNBOOK 已有雏形，但只覆盖 Phase 2 的 WAF / ADMIN_GITHUB_ID。**
   - 根 `RUNBOOK.md` 是正确落点
   - 需要扩写 deploy、rollback、migration、Sentry、故障响应

5. **Wrangler 版本未达到需求。**
   - root / `apps/api` / `apps/gateway` 仍是 `^4.81.1`
   - Phase 5 需求要求提升到 `^4.90.0`

## Current Deploy Baseline

### Existing workflows

发现以下 deploy / ops workflows：

- `deploy-api.yml`
- `deploy-gateway.yml`
- `deploy-auth.yml`
- `deploy-blog.yml`
- `deploy-dashboard.yml`
- `deploy-movie.yml`
- `deploy-comic.yml`
- `deploy-migrations.yml`
- `ci.yml`

### Positive baseline already in place

- 所有主应用都已具备 GitHub Actions 入口
- 大部分 deploy workflow 已支持 `workflow_dispatch`
- Pages 部署普遍会尝试 `wrangler pages project create ... || true`
- CI 已具备 lint / type-check / unit tests / movie e2e smoke
- API Worker 已启用 Cloudflare observability logs/traces

### Inconsistencies / gaps

- app 命名、build step、deploy step 写法不完全一致
- 没有统一 rollback workflow
- 没有 deploy 后 smoke / health verification 规范
- `auth` 缺少明确 deploy script（package.json 里没有 `deploy`）
- `blog/auth` 使用 Nuxt，`movie/comic/dashboard` 使用 Vite，deploy 前 build 验证路径不同，需要 planner 拆分

## Migration Safety Findings

### Existing state

- `packages/db/MIGRATION.md` 里已明确本地 / 远程 apply 的推荐命令
- `apps/api/wrangler.toml` 已绑定 `../../packages/db/drizzle` 为 migration dir
- `deploy-migrations.yml` 目前只有：
  - checkout
  - install
  - optional fix script
  - `wrangler d1 migrations apply starye-db --remote`

### Missing pieces relative to Phase 5

- **No remote backup before apply**
- **No destructive diff detection**
- **No reviewer ack gate**
- **No rollback guidance in workflow output**

### Constraint

D1 不适合自动逆迁移。Phase 5 更合理的策略是：

- apply 前强制 backup
- 对 destructive 变更加 gate
- 回滚数据库采用“restore backup / forward-fix migration / manual recovery path”

而不是追求自动 schema rollback

## Observability Findings

### Workers

- `apps/api/wrangler.toml` 已启用：
  - logs
  - traces
- `apps/gateway/wrangler.toml` 还没有同级 observability 配置

### Frontend

目前未发现：

- `@sentry/vue`
- `@sentry/nuxt`
- Sentry init module
- `beforeSend`
- message-based video failure reporting

### Existing error surfaces worth instrumenting

- `apps/movie-app/src/views/Player.vue`
  - unified error card
  - waiting timeout
  - retry escalation
  - `streamUrl` / TorrServer failures
- `apps/movie-app/src/utils/aria2Client.ts`
- `apps/movie-app/src/utils/torrServerClient.ts`
- `apps/comic-app/src/views/Reader.vue`
  - pagehide flush / restore path
- API global error handling
- Gateway proxy failures

### Noise patterns already visible in codebase

grep 能看到代码明确区分：

- `AbortError`
- `NetworkError`
- fetch timeout / offline style errors

这意味着 Phase 5 的第一轮 `beforeSend` 过滤策略是有现实依据的，不是凭空设计

## RUNBOOK Findings

根 `RUNBOOK.md` 已存在，已记录：

- WAF Rate Limiting 手配记录
- `ADMIN_GITHUB_ID` 配置

这说明：

- 运维知识已经开始集中
- Phase 5 不应再创建第二份 runbook
- 应该继续扩充根 `RUNBOOK.md`

建议新增章节：

- Deploy matrix（各 app 怎么部署）
- Rollback matrix（Workers / Pages 各自怎么回滚）
- D1 migration safety（备份、apply、恢复）
- Sentry setup / DSN / release / source maps（按实际 scope 取舍）
- Incident quick actions（API 500、gateway 路由错误、Pages 回退、播放失败噪音）

## Risk Assessment

### Highest risk items for planning

1. **Rollback across Workers and Pages is asymmetric**
   - Worker 可用 `wrangler rollback`
   - Pages 的回滚能力与 CLI / 历史部署能力需要确认
   - 这会直接影响 `DEPLOY-02` 的 plan 切分

2. **Destructive migration gate implementation choice**
   - grep SQL diff
   - parse migration files
   - CI reviewer label / manual ack file
   - 需要选一个稳妥且简单的机制

3. **Sentry on Nuxt + Vue + Workers spans 3 runtime shapes**
   - Hono Worker
   - Vue SPA
   - Nuxt Pages
   - 应按 runtime 拆计划，避免单 plan 过宽

4. **Phase 4 still not fully phase-complete in tracking docs**
   - 磁盘状态上 Phase 4 已 complete
   - 但 `ROADMAP.md` / `REQUIREMENTS.md` / `STATE.md` 仍未收口
   - Phase 5 planning 需要承认这一现实，但不应把自己扩成“顺手修一切 phase-state 漂移”

## Recommended Planning Split

基于现状，Phase 5 最合理的 plan 拆分倾向是：

1. **05-01**: deploy / wrangler baseline统一 + rollback workflow ground layer
2. **05-02**: D1 backup + destructive migration gate
3. **05-03**: Workers Sentry (`api` + `gateway`) + video failure event contract
4. **05-04**: Frontend Sentry (`movie` / `comic` / `blog` / `auth`) + RUNBOOK 收口

这套拆分的优点：

- deployment / rollback 与 migration safety 分开
- Workers 与 frontend observability 分开
- RUNBOOK 放在最后汇总，能吸收前面 3 个计划的真实输出

## Recommendations for Planner

- 明确承认 Phase 5 是 **brownfield hardening**，不是 greenfield infra build
- 保持每个 plan 的 `files_modified` 尽量集中
- 对 rollback 与 migration safety 写清“平台能力确认”前置步骤
- 把 `wrangler` 版本升级纳入最早 wave，避免后续计划各自重复 bump
- RUNBOOK 只保留根文件，不新增 phase-local runbook clone
- 对 Sentry 计划显式写出 `beforeSend` 最小过滤集

## Open Research Constraints

- Pages 回滚的 CLI/平台路径需要在 planning 阶段明确确认落法
- destructive migration gate 最终技术方案仍需 planner 定稿
- Sentry release/source map 是否纳入 v1，需要 planner 视复杂度判断
