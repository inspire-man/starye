# Phase 11: Deployment Target Foundation - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

建立一套单一、非 secret 的部署目标 profile 契约，以及与之配套的本地 env 归一和 hard fail-closed preflight 边界，确保后续 deploy、migration、crawler、rollback、smoke 在切换 Cloudflare 账户/域名时有一致的目标身份基础。

**In scope（本 phase 收口）：**

- 定义一个 profile = 一个可部署目标的目标模型，不做 overlay 式拼装
- 显式收口 account、domain、Workers、Pages、D1、R2、KV、canonical URLs、required-secret metadata 的字段边界
- 定义本地 target-managed env 的生成和更新规则，兼容现有 `.dev.vars`、`.env.local`、crawler `.env`
- 定义静态 + live 的 fail-closed preflight 规则，阻断 mixed target、legacy fallback、缺失 target、错误本地身份等问题
- 定义本地 Wrangler auth profile 与 CI token/environment secrets 的硬边界

**Out of scope（本 phase 明确不做）：**

- 实际改造 Workers、Pages、GitHub workflows 去消费 selected target 的代码变更，这属于 Phase 12
- 本地到生产的 crawler -> D1 -> admin -> viewing 全链路 smoke，这属于 Phase 13
- 旧域名字面量全仓清理、RUNBOOK 最终成文、requirement-to-evidence 最终核对，这属于 Phase 14
- Cloudflare 资源自动 provision / DNS 自动创建 / IaC 全托管

</domain>

<decisions>
## Implementation Decisions

### Deployment Target Model
- **D-01:** `TargetProfile` 的粒度锁定为“一个 profile = 一个可部署目标”，不得再靠 account overlay、domain overlay 或资源推导去拼半套目标身份。
- **D-02:** profile 必须显式记录每类关键资源的稳定身份信息：名称、ID 或 route pattern、canonical URL，以及 required-secret metadata。
- **D-03:** `profile.urls` 必须显式列出每个对外 surface 的 canonical URL，至少覆盖 gateway、api、dashboard、auth、blog、movie、comic、tavern，不允许只记 root domain 再隐式推导。
- **D-04:** required-secret metadata 只记录 secret 名称、必填/选填、消费者；profile 永远不存真实 secret 值。

### Local Env Projection
- **D-05:** 选中 profile 后，本地命令要直接生成现有运行时最终消费文件，而不是引入额外中间层。
- **D-06:** 目标文件以当前 repo 既有消费面为准：`apps/api/.dev.vars`、`apps/gateway/.dev.vars`、root `.env.local`、`packages/crawler/.env`。
- **D-07:** 生成器只管理 target-managed 键；真正的本地敏感值继续由操作者维护，生成器最多保留空洞或占位，不伪装成“已可运行”。
- **D-08:** 切换 profile 时，只更新 target-managed 键，并清理旧的 target-managed 残留；用户自填 secrets 与非 target-managed 本地值必须原样保留。

### Fail-Closed Validation
- **D-09:** preflight 采用 hard fail-closed：任何 target identity 不一致都直接阻断，不保留“warning 但继续”的捷径。
- **D-10:** 校验范围必须同时覆盖 profile 本身、投影结果和命令输入，避免“profile 正确但落地文件还是旧 target”的半切换状态。
- **D-11:** 未显式纳入 selected profile 的 legacy alias、fallback、旧域名默认值一律视为阻断项，不允许通过“最终解析凑巧一致”侥幸放行。
- **D-12:** 对 deploy、migrate、rollback、remote crawl/smoke 这类高风险远程命令，preflight 必须要求 live 资源存在性校验；缺少可用凭证时直接阻断。

### Local Wrangler vs CI Identity Boundary
- **D-13:** 本地 Cloudflare 身份只允许通过 Wrangler auth profile 选择；CI 只允许通过 token/account-secret + GitHub environment / secret bundle 选择，严禁混用。
- **D-14:** 每个 `TargetProfile` 必须显式声明期望的本地 Wrangler profile 名称；当前本地身份与之不匹配时直接阻断。
- **D-15:** 每个 `TargetProfile` 必须显式映射到一个 GitHub environment 或等价 secret bundle；workflow 只能按该映射取 secrets，不允许手工覆盖 secret 来源。
- **D-16:** 所有本地命令和 GitHub workflows 都必须显式给出 selected target；不存在隐式 default target。

### the agent's Discretion
- profile 的文件格式（例如 JSON、TS module、YAML）与命令命名可由 planner 按 repo 现有脚本生态选择，只要字段契约、显式 target 语义和 fail-closed 行为不被削弱。
- target-managed 键在生成文件中的标记方式、占位注释格式、以及“哪些键属于 target-managed” 的内部表示可由 planner 选最稳妥的实现。
- live 校验具体通过哪组 Cloudflare API / Wrangler 子命令完成，由 planner 按当前 CLI 能力和可测试性决定。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope And Locked Requirements
- `.planning/ROADMAP.md` — Phase 11 的 goal、requirements 和 success criteria
- `.planning/REQUIREMENTS.md` — `PROF-01..04`、`ENV-01..02`、`TEST-02` 的约束来源
- `.planning/PROJECT.md` — v1.2 主线、Cloudflare free-tier-first、gateway canonical URL、单用户定位
- `.planning/STATE.md` — 当前 milestone 状态与 Phase 11 的入口状态

### Milestone Research And Codebase Maps
- `.planning/research/SUMMARY.md` — v1.2 研究结论，尤其是 target profile、Cloudflare local-vs-CI identity split、full-chain risk
- `.planning/codebase/STACK.md` — 现有 Wrangler / Nuxt / Vite / crawler / workflow 技术栈与 env surface
- `.planning/codebase/ARCHITECTURE.md` — gateway-first 架构、local canonical entry、Cloudflare runtime 边界
- `.planning/codebase/INTEGRATIONS.md` — D1、R2、KV、GitHub Actions、auth、crawler 的外部集成约束

### Current Target Identity Sources
- `.env.example` — 当前 root public env 入口，已把本地 canonical API 指向 `http://localhost:8080`
- `apps/api/wrangler.toml` — 当前 API Worker 的 singleton account/domain/D1/R2/KV 绑定来源
- `apps/gateway/wrangler.toml` — 当前 gateway Worker 的 singleton origins、routes、local dev 端口来源
- `apps/dashboard/wrangler.toml` — 当前 dashboard Pages public API URL 配置
- `apps/api/src/config.ts` — API CORS / allowed origins 现状，存在旧 domain / localhost surface 的硬编码
- `apps/auth/nuxt.config.ts` — Nuxt app public runtime config 现状，回退到 `NUXT_PUBLIC_API_URL || VITE_API_URL || http://localhost:8080`
- `apps/blog/nuxt.config.ts` — 与 auth 相同的 Nuxt public runtime config surface

### Existing Validation And Local Tooling Surfaces
- `packages/crawler/scripts/check-config.ts` — 当前 crawler 环境检查入口，暴露出 “从 API `.dev.vars` 复制配置” 的现状摩擦
- `scripts/pre-deploy-check.ps1` — 现有本地 deploy 前检查脚本，后续可作为 target-aware preflight 的整合入口之一

### CI / Remote Mutation Surfaces
- `.github/workflows/deploy-api.yml` — 当前 API deploy 直接消费 repo-level Cloudflare secrets
- `.github/workflows/deploy-migrations.yml` — 当前 D1 backup / migration / R2 backup upload 的 target 输入面
- `.github/workflows/daily-manga-crawl.yml` — 当前 crawler workflow 的 `API_URL` / `CRAWLER_SECRET` / R2 输入面
- `.github/workflows/rollback.yml` — 当前 rollback workflow 的 target 入口与 Pages fail-closed 行为

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.env.example` 已经建立了“本地浏览器侧 public config 默认经由 gateway”的契约，可以作为 root public env projection 的基线。
- `apps/api/wrangler.toml`、`apps/gateway/wrangler.toml`、`apps/dashboard/wrangler.toml` 已经暴露出当前 singleton target 的所有关键字段，是 profile schema 反推现状字段的最佳样本。
- `packages/crawler/scripts/check-config.ts` 已有最基础的 env 完整性校验结构，可复用为 target-aware crawler preflight 的起点。
- `scripts/pre-deploy-check.ps1` 已提供一个本地多项检查壳子，后续可吸纳 selected target / live validation 逻辑，而不是再造第二套入口。
- `.github/workflows/deploy-migrations.yml`、`daily-manga-crawl.yml`、`rollback.yml` 已把远程高风险操作拆成独立 workflow，适合分别接入 target preflight，而不是埋进单个超大 deploy 脚本。

### Established Patterns
- 本地 canonical 访问路径锁定为 `http://localhost:8080/...`；前端 public config 不应回退为直连 app 端口。
- Worker 本地 secrets 通过 `.dev.vars`，远端 secrets 通过 `wrangler secret` / GitHub Actions secrets 注入；secret 不进入 repo。
- Nuxt / Vite public runtime config 目前都通过 env 回退链条解析，说明 Phase 11 优先应统一 env 入口，而不是直接改前端 runtime 结构。
- GitHub workflows 当前普遍直接读取 repo-level `secrets.*`，这正是 Phase 11 必须收口 target-to-environment 映射的原因。

### Integration Points
- profile resolver / projection 层需要同时触达 Worker、本地前端、crawler 三类运行面。
- hard preflight 需要在本地命令入口和 GitHub workflow 入口都生效，避免“本地能拦、CI 不能拦”的双标。
- selected target 将成为 Phase 12 消费 wrangler/pages/workflow 配置的唯一身份来源，也会影响 Phase 13 smoke 目标与 Phase 14 验证证据归属。

</code_context>

<specifics>
## Specific Ideas

- 讨论明确偏向“宁可早停，也不接受半切换成功”的策略，因此 planner 不应为了省事保留 implicit default target、旧 alias 宽容解析或 warning-only 分支。
- target-managed 键和用户自填 secrets 的边界必须足够清楚，否则 profile 切换时会再次退化成“手工复制 `.dev.vars`”。
- 本地多账号切换是为了提升操作者体验，但这层便利不能泄漏到 CI；CI 的 target 只能由显式 environment / secret bundle 驱动。

</specifics>

<deferred>
## Deferred Ideas

- Phase 12：让 Workers、Pages、GitHub deploy/migrate/crawl/rollback workflows 实际消费 selected target。
- Phase 13：把 selected target 跑通 local + production full-chain smoke，并记录可重复 evidence。
- Phase 14：旧域名字面量清理、RUNBOOK 定稿、requirement-to-evidence 总核验。

</deferred>

---

*Phase: 11-deployment-target-foundation*
*Context gathered: 2026-07-14*
