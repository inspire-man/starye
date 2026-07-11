# Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全 - Pattern Map

**Mapped:** 2026-05-13  
**Files analyzed:** 18  
**Analogs found:** 8 / 8（其余为 Phase 5 新增 workflow / rollback / observability 文件）

## File Classification

| 新建/修改文件 | Role | Data Flow | 最近 Analog | 匹配质量 |
|---|---|---|---|---|
| `.github/workflows/rollback.yml`（新建） | workflow | GitHub Actions -> Cloudflare | `deploy-api.yml` / `deploy-gateway.yml` / `deploy-movie.yml` | role-match |
| `.github/workflows/deploy-migrations.yml`（修改） | workflow | GitHub Actions -> D1 / R2 | 自身现有 migration workflow | exact |
| `.github/workflows/ci.yml`（修改） | workflow | PR / push checks | 自身现有 CI | exact |
| `package.json` / `apps/api/package.json` / `apps/gateway/package.json`（修改） | dependency config | toolchain versioning | 现有 wrangler pin | exact |
| `apps/api/src/index.ts`（修改） | worker bootstrap | request-response / middleware | 自身现有 Hono middleware stack | exact |
| `apps/gateway/src/index.ts`（修改） | worker bootstrap | request-response / proxy | 自身现有 gateway proxy flow | exact |
| `apps/movie-app/src/main.ts` / `apps/comic-app/src/main.ts`（修改） | SPA bootstrap | browser error capture | 现有 Vue app bootstrap | strong |
| `apps/blog/nuxt.config.ts` / `apps/auth/nuxt.config.ts`（修改） | Nuxt config | runtime / build | 自身现有 Nuxt config | exact |
| `RUNBOOK.md`（修改） | ops doc | human runbook | 根 RUNBOOK 当前结构 | exact |

## Pattern Assignments

### 1. Deploy workflows stay per-app

**Analog:** `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-gateway.yml`, `.github/workflows/deploy-movie.yml`

**Pattern recommendation:**

- 继续沿用“每个 app 单独 deploy workflow”的结构。
- 不在 Phase 5 合并成一个 monolithic deploy pipeline。
- 可以通过共享步骤风格来统一：
  - checkout
  - Node 24
  - pnpm 10.33.0
  - `pnpm install --no-frozen-lockfile`
  - app-specific build
  - Cloudflare deploy

**Planning implication:** rollback workflow 可以统一，但 deploy workflow 仍按 app 维持分散。

### 2. Worker deploy path

**Analog:** `deploy-api.yml`, `deploy-gateway.yml`

**Current pattern:**

```yaml
- name: Deploy API
  run: pnpm --filter api run deploy
```

**Planning implication:**

- Worker rollback 最自然的实现也是单条 `wrangler rollback` 命令。
- Phase 5 中对 Worker rollback 的 automation 风险较低，适合作为最先落地的部分。

### 3. Pages deploy path

**Analog:** `deploy-movie.yml`, `deploy-dashboard.yml`, `deploy-comic.yml`, `deploy-auth.yml`, `deploy-blog.yml`

**Current pattern:**

```yaml
pnpm exec wrangler pages project create <name> --production-branch=main || true
pnpm exec wrangler pages deploy apps/<app>/dist --project-name=<name> --branch=main ...
```

**Planning implication:**

- Pages rollback 不一定能像 Worker 一样直接 `wrangler rollback`。
- 计划里应把 Pages rollback 视为需要先确认平台能力的子问题。
- 如果 CLI 不支持完整 rollback，应在 `rollback.yml` + `RUNBOOK.md` 中落“半自动/人工回退路径”。

### 4. Migration workflow is already isolated

**Analog:** `.github/workflows/deploy-migrations.yml`

**Current pattern:**

- 单独 workflow
- `working-directory: ./apps/api`
- 直接 remote apply

**Planning implication:**

- 很适合在这个文件里直接补：
  - backup step
  - destructive gate
  - restore guidance
- 不要把 migration apply 回灌进 `deploy-api.yml`

### 5. Worker bootstrap instrumentation

**Analog:** `apps/api/src/index.ts`

**Current pattern:**

- Hono app 统一挂 middleware
- requestId / logger / timing / error handler 已存在

**Planning implication:**

- Worker 侧 Sentry 应优先在 bootstrap 层接入，而不是散落到单个 route handler。
- `api` 和 `gateway` 可以共用同类接法，但不能假定完全同文件结构。

### 6. SPA bootstrap pattern

**Analog:** `apps/movie-app/src/main.ts`, `apps/comic-app/src/main.ts`, `apps/dashboard/src/main.ts`

**Planning implication:**

- Vue apps 的 Sentry 接入宜放在 `main.ts` 入口，不要先引入复杂 plugin registry。
- 播放失败这类非 crash 事件则应从 `Player.vue` 或相关 utils 主动上报，不靠全局异常捕获。

### 7. Nuxt app config pattern

**Analog:** `apps/blog/nuxt.config.ts`, `apps/auth/nuxt.config.ts`

**Planning implication:**

- Nuxt 的 Sentry 方案更适合落在 config/module 层，而不是单个 page。
- 计划里应把 Nuxt 与 Vue SPA 分开，不要混在一个 implementation task 里。

### 8. Root RUNBOOK as single source

**Analog:** `RUNBOOK.md`

**Current pattern:**

- 已承载 WAF 与 `ADMIN_GITHUB_ID`
- markdown section-based 运维记录

**Planning implication:**

- Phase 5 所有运维沉淀继续汇总到根 `RUNBOOK.md`
- 不应再新增 `apps/*/RUNBOOK.md` 或 phase-local 运维 clone

## Shared Patterns

### GitHub Actions baseline

所有现有 workflow 都已经稳定使用：

- `actions/checkout@v6`
- `actions/setup-node@v6.3.0`
- `pnpm/action-setup@v4`
- Node 24
- pnpm 10.33.0

**Apply to:** rollback / migration safety / deploy baseline 统一增强

### Cloudflare secret / env pattern

**Source:** `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, RUNBOOK current sections

**Apply to:** Sentry DSN / auth / deploy secrets 继续走 wrangler secret / GitHub Actions secrets，不引入新 secret store

### Brownfield doc-first hardening

**Source:** Phase 2 `RUNBOOK.md` additions + Phase 4 UAT/SECURITY artifacts

**Apply to:** Phase 5 每个 plan 都应该要求文档/ops 产物同步更新，而不是只改 workflow 或代码

## No Analog Found

以下内容在 repo 中没有直接现成 analog，计划里需要显式定义：

1. **统一 rollback workflow**
2. **destructive migration reviewer gate**
3. **Sentry init / beforeSend baseline**
4. **video failure message contract**

## Suggested Plan Granularity

推荐固定拆成 4 个 plan：

1. `05-01` Wave 1：wrangler baseline + rollback workflow + deploy surface统一
2. `05-02` Wave 2：D1 backup + destructive migration gate
3. `05-03` Wave 2：Workers Sentry + video failure event contract
4. `05-04` Wave 3：Frontend Sentry + RUNBOOK 收口 + deploy/rollback validation

`05-02` 与 `05-03` 可以并行：一个偏 CI/migration，一个偏 runtime observability。

## PATTERNS COMPLETE
