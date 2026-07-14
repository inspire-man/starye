# Phase 12: Cloudflare Config Switching - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

让 API、gateway、Pages 前端和 GitHub deploy/migrate/crawl/rollback workflow 以显式 selected target 消费 Phase 11 的 non-secret target profile；浏览器侧只接收类型化公开配置，所有远程变更在资源归属和凭据边界通过前不得执行。

**In scope（本 phase 收口）：**

- 把 selected target 投影到 API、gateway、dashboard 及其相关 Pages deploy 配置，而不再保留 singleton production 值作为运行时事实。
- 统一浏览器可见的 public runtime config，明确 API/gateway 基址、应用 base path 与非敏感 target identity，并阻止 secret 通过 public env 前缀泄漏。
- 让 deploy、D1 migration、crawler、rollback workflows 显式选择 target 对应的 GitHub Environment/secret bundle，并在高风险远程变更前执行已存在的 preflight/live resource check。
- 补齐无需真实 secret 的 domain-aware config、workflow target resolution 和 fail-closed regression tests。

**Out of scope（本 phase 明确不做）：**

- local 或 production crawler -> D1 -> admin -> front-end viewing 的全链路 smoke/evidence，属于 Phase 13。
- 旧 `starye.org` 字面量的全仓清理、RUNBOOK 最终操作说明和全部 requirement-to-evidence 映射，属于 Phase 14。
- 新建 Cloudflare 资源、DNS、跨账户蓝绿流量切换或 IaC provision。

</domain>

<decisions>
## Implementation Decisions

### Target-Aware Deploy Configuration
- **D-01:** `TargetProfile` 是所有 deployable Cloudflare surface 的唯一 non-secret target source；任何 deploy/migrate/crawl/rollback 命令必须显式接收 tracked target id，不能以 domain、`prod`、`production` 或默认值推断。
- **D-02:** 选择 target 后，由受版本控制的 resolver 在命令运行期投影 Worker/Pages/CLI 所需的 non-secret config 和参数；不把 profile 拆抄为永久 `[env.<target>]` Wrangler 区块，也不允许 `wrangler.toml` 保留可被误用的 singleton production resource identity。
- **D-03:** 当前 target profile 中的 Worker name/route、Pages project、D1/R2/KV binding、canonical URL 必须逐项成为投影输入；投影前后均执行 fail-closed validation，避免 profile 正确而消费端仍指向旧 target。

### Browser Public Runtime Contract
- **D-04:** 定义一个由 `TargetProfile` 投影的共享、类型化 public runtime config contract；它至少表达 selected target id、gateway base URL、API base URL 与各应用 base path，且所有字段均为可公开值。
- **D-05:** 浏览器端继续以 canonical gateway/API 为服务边界：应用不得从 public config 获取或拼接 Pages/Worker internal origin，也不得自行发现后端服务；local canonical entry 固定为 `http://localhost:8080/...`。
- **D-06:** 只允许 contract allowlist 中的 `VITE_*` / `NUXT_PUBLIC_*` 值进入浏览器构建或 Nuxt `runtimeConfig.public`；任意 secret 名称、未注册 public key、或以 public 前缀暴露 credential 的尝试都必须在 config validation/build test 中 fail closed。

### CI Target And Secret Selection
- **D-07:** 所有手动远程 workflows 提供必填 target input；push/schedule 触发也必须在 workflow 中声明一个可审计、显式的 selected target，而不是依赖隐式仓库 secret 或 branch 外推。
- **D-08:** workflow 先以 selected target 解析其唯一 `githubEnvironment`，再绑定该 Environment 内的一套标准 secret 名称；不得用 target 名拼接不同 secret variable 名，也不得允许 dispatch input 覆盖 profile 的 Environment 映射。
- **D-09:** deploy API/gateway/Pages、D1 migration、crawler 和 rollback 共享同一 target resolution/preflight entry；workflow 只能消费其通过验证后的输出，不能分别重写 account id、domain、resource name 或 API URL。

### Remote Mutation And Rollback Boundaries
- **D-10:** 每个 deploy、migrate、rollback 和 remote crawler 操作在写入前必须执行 `ci`/`remote` preflight，并带 read-only live resource checks；credential key 缺失、account id 不匹配、selected Environment 不匹配或资源不存在都立即阻断。
- **D-11:** D1 backup export/upload、migration apply 与 crawler 运行必须从 selected profile 取得 D1/R2/API identity，并在输出中记录非敏感 target id、resource names 和 run identity，形成下一阶段 smoke/evidence 可复用的边界。
- **D-12:** Worker rollback 必须确认 app name 与 version 操作属于 selected target 才可执行；Pages rollback 维持明确 fail-closed 的手工回退，直到存在可验证且 target-aware 的自动化机制。

### the agent's Discretion
- 投影文件的具体格式、临时目录和命令封装方式由 planner 选择，但不得引入第二个可编辑 target source，也不得把 secret 写入 repo、计划工件或构建产物。
- public contract 的 TypeScript module 位置、Vite/Nuxt adapter 结构和 validation test 组织可沿用现有 workspace patterns，只要每个浏览器消费端共享同一 allowlist/类型语义。
- GitHub Actions 触发层对 push/schedule 的显式 target 表达可按现有 workflow 结构选择 job env、workflow input default 或安全脚本参数；实现必须让 review 能从版本控制中看到实际 target。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Locked Foundation
- `.planning/ROADMAP.md` — Phase 12 goal、requirements 与 success criteria。
- `.planning/REQUIREMENTS.md` — `ENV-03..06`、`DEPL-01..06`、`TEST-03..04` 的验收来源。
- `.planning/PROJECT.md` — v1.2 主线、Cloudflare free-tier-first 和 gateway-first 产品约束。
- `.planning/STATE.md` — 当前 phase/milestone execution state。
- `.planning/phases/11-deployment-target-foundation/11-CONTEXT.md` — 必须继承的 target model、projection、selected-target 与 local/CI identity fail-closed 决策。

### Target Profile And Preflight Contracts
- `packages/config/src/deployment-target/target-profile.schema.ts` — target resources、URL surfaces、Pages/Workers 与 secret metadata 的 runtime schema。
- `packages/config/src/deployment-target/target-resolver.ts` — explicit target resolution 与 legacy alias rejection。
- `packages/config/src/deployment-target/projection-plan.ts` — local projection contract and managed-key validation pattern。
- `packages/config/src/deployment-target/preflight.ts` — local/CI/remote preflight scopes, command inventory, identity boundary and live-check contract。
- `scripts/target-profile.ts` — existing CLI entry point for selected target validation and projection checks。

### Current Runtime Consumers
- `apps/api/wrangler.toml` — current singleton API Worker routes, bindings and public vars to replace with target-aware consumption。
- `apps/gateway/wrangler.toml` — current singleton gateway origins/routes/KV bindings and canonical local port.
- `apps/dashboard/wrangler.toml` — current dashboard Pages public config surface.
- `apps/api/src/config.ts` — API CORS/allowed-origin policy that must become target-aware without weakening local support.
- `apps/auth/nuxt.config.ts` — Nuxt public runtime config adapter.
- `apps/blog/nuxt.config.ts` — Nuxt public runtime config adapter.
- `.env.example` — root public local env baseline using Gateway at `http://localhost:8080`.

### CI And Operations Boundaries
- `.github/workflows/deploy-api.yml` — API deployment target/secret selection surface.
- `.github/workflows/deploy-gateway.yml` — gateway deployment target/secret selection surface.
- `.github/workflows/deploy-dashboard.yml` — Pages public config/deployment selection surface.
- `.github/workflows/deploy-migrations.yml` — D1 export, R2 backup upload and remote migration boundary.
- `.github/workflows/daily-manga-crawl.yml` — scheduled crawler target/credential/API input surface.
- `.github/workflows/rollback.yml` — Worker rollback and Pages fail-closed behavior.
- `RUNBOOK.md` — current deploy, migration backup and rollback semantics; Phase 14 remains its stable documentation update owner.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TargetProfile` schema and `resolveTargetProfile()` already represent the explicit account/domain/resource/URL identity Phase 12 must consume.
- `runTargetPreflight()` already distinguishes local, CI and remote identity boundaries; its remote live checks cover deploy, migrate, rollback, remote crawl and smoke.
- `scripts/target-profile.ts` is an import-safe existing CLI shell that can become the common workflow entry rather than creating per-workflow target parsers.
- `.env.example` and existing Nuxt `runtimeConfig.public` blocks provide the current browser env inputs and local gateway baseline.

### Established Patterns
- Phase 11 locks one profile per deployable target, managed-key-only projections, explicit selected target and no local `CLOUDFLARE_API_TOKEN` shadowing.
- The gateway is the only canonical local browser entry; direct app ports are dev implementation details, never public config defaults.
- GitHub workflows currently inject standard `CLOUDFLARE_*`, crawler and R2 secret names; GitHub Environment selection is the safe way to change their values by target without dynamic secret-name indirection.
- Existing rollback intentionally fails closed for Pages; that boundary must not be relaxed by this phase.

### Integration Points
- API/gateway Wrangler config, dashboard/other Pages build env, API CORS/auth origin config and frontend runtime adapters must all consume the same selected target projection.
- Deploy, migration, crawler and rollback workflow jobs need a shared preflight/output handoff before their existing remote mutation commands.
- Tests can exercise resolver/projection/preflight/workflow text or helper behavior with fixture profiles and fake environments, with no real Cloudflare credentials.

</code_context>

<specifics>
## Specific Ideas

- Auto-selected recommendations preserve the existing preference for explicit, fail-closed contracts: a mismatched target must stop before remote mutation rather than emit a warning.
- Browser config is public by design; hiding arbitrary values behind `VITE_*` or `NUXT_PUBLIC_*` is not security. The contract must make exposure intentional and testable.
- Standard GitHub Environment secret names are preferred over target-suffixed repository secrets, because the profile owns selection while secret values stay in GitHub.

</specifics>

<deferred>
## Deferred Ideas

- Phase 13: selected-target local/production crawler-to-D1-to-admin-to-viewing smoke and evidence capture.
- Phase 14: complete active-source old-domain cleanup, durable RUNBOOK switching procedures and final requirement-to-evidence matrix.
- Future milestone: Cloudflare resource/DNS provisioning IaC, automatic multi-target scheduler matrix and cross-account traffic migration.

</deferred>

---

*Phase: 12-cloudflare-config-switching*
*Context gathered: 2026-07-15*
