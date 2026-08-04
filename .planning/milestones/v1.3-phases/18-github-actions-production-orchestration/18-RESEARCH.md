# Phase 18: GitHub Actions Production Orchestration - Research

**Researched:** 2026-07-31
**Domain:** GitHub App、GitHub Actions workflow 生命周期、Cloudflare Worker/D1 控制面与签名 crawler runner 事件
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Provider 凭据与 dispatch 边界

- **D-01:** 生产 API 使用 GitHub App installation token 调用 provider；token 按操作即时 mint，仅存在于当前请求生命周期，令牌值不进入 D1、日志或 receipt。
- **D-02:** workflow 发现采用服务端封闭 registry：`movie` 固定映射 `.github/workflows/daily-movie-crawl.yml`，`manga` 固定映射 `.github/workflows/daily-manga-crawl.yml`；仓库、`main` ref、`starye-org` target 和 GitHub Environment 由服务端确定。
- **D-03:** dispatch payload 显式携带 `run_id`、`attempt`、`template`、`target`；workflow 首步将四项与 API 记录逐项校验后再进入 crawler。

### 手动与 schedule 注册

- **D-04:** 手动任务由 API 先创建 D1 run，再 dispatch 固定 workflow；GitHub `schedule` 保留为生产定时入口，workflow 首步向 API 注册并取得 `run_id`。
- **D-05:** schedule 使用 `template + target + workflow + scheduled_at` 组成固定时间桶唯一键；重复注册返回已有控制面 run，避免同一时间桶形成第二个执行事实。
- **D-06:** schedule 注册复用独立 runner-event HMAC 体系，新增 `schedule_register` 事件语义，并绑定 workflow、repository、ref、Environment、template、target 与时间桶。
- **D-07:** 注册请求对网络超时和 5xx 做有限退避重试；身份、模板、target、时间桶等校验异常立即停止，重试窗口耗尽后在 crawler 启动前 fail-closed。

### Provider run 关联与状态补偿

- **D-08:** 注册成功后 workflow 首步发送签名 `provider_started`，携带 `GITHUB_RUN_ID`、`GITHUB_RUN_ATTEMPT`、workflow、ref、sha、Environment、template 和 target；API 只接受与 dispatch 快照精确一致的 provider 绑定。
- **D-09:** 采用混合观察：签名事件承载启动、进度、日志、终态和 receipt；API 以固定间隔查询 GitHub，在回调缺失、状态停滞或终态不一致时写入补偿事件。
- **D-10:** provider 标识不一致时写入 `provider_mismatch` 审计事件并进入有限 reconciliation window；窗口结束仍不匹配则当前 attempt 失败，后续重试使用新 attempt。
- **D-11:** 生产成功需要三重一致：GitHub provider 状态成功、签名终态事件绑定同一应用 run/attempt/provider ID、receipt 经 API 内容核验。dispatch 受理、workflow 退出码或单独的 GitHub 成功状态都不足以形成成功 receipt。

### 生产取消、重试与失联恢复

- **D-12:** 取消遵循协作语义：API 先将 run 置为 `cancel_requested`，再调用 GitHub cancel；workflow 在心跳或安全检查点读取取消状态，停止后续 crawler 并签名回写 `cancelled`。provider 接受 cancel 作为过程证据，签名终态事件负责落最终状态。
- **D-13:** 每次管理员确认后的生产重试创建递增的新 D1 attempt 和新的 GitHub workflow run；GitHub rerun 仅作为 provider 基础设施补偿手段，保持业务 attempt 语义稳定。
- **D-14:** reconciliation 在固定失联窗口后记录 `provider_lost` 并结束当前 attempt；自动重试保持关闭，管理员确认后以新 attempt 继续。
- **D-15:** 取消与成功竞态沿用既有契约：已核验的成功 receipt 在取消生效前到达时成功优先并记录“取消未生效”；其余情况保持 `cancelled` 或失败且不生成成功 receipt。已经写入的内容与审计摘要保留，后续重试使用新 attempt。

### the agent's Discretion
- GitHub App metadata 字段、installation token 的具体 mint 实现、provider REST client 封装、API route 名称、D1 migration 编号、事件码细节、轮询/退避的具体时间值、reconciliation window 的默认阈值和测试 fixture 由实现与研究决定。
- 以上实现仍需遵守 Phase 16/17 的 template registry、lease、sequence、nonce、HMAC、日志脱敏、receipt 和 Gateway/local boundary 契约。

### Deferred Ideas (OUT OF SCOPE)
- Dashboard 全量任务历史、筛选、详情、实时流式日志、RUNBOOK 更新和本地/生产完整 CRUD 证据：Phase 19。
- 后台定时策略编辑、通知策略、额外 crawler 模板、多任务并发和无限自动重试：未来需求。
- Provider-backed 生产运行的真实凭据配置和具体 remote evidence 仍需在执行/验收阶段按目标环境另行授权与记录。

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROD-01 | 生产 API 使用最小权限凭据触发固定的电影或漫画 GitHub Actions workflow。 | 使用 GitHub App installation token 的即时 mint、封闭 workflow registry、固定 repository/ref/Environment 与原生 Worker fetch dispatch。相关官方权限和 endpoint 见 GitHub Actions REST 文档。 [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event] |
| PROD-02 | Actions 将应用 run 与 GITHUB_RUN_ID 绑定，并以签名事件回写状态、日志和终态 receipt。 | 将 app run_id、attempt、template、target 作为显式 input；首步发送绑定 workflow/ref/sha/Environment 的 provider_started；复用现有 HMAC、nonce、sequence、event_id 和 receipt 校验。 [VERIFIED: repository grep] [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables] |
| PROD-03 | 生产任务支持 provider 状态补偿、取消和重试，且不会把 dispatch 受理视为成功。 | 采用签名事件加 GitHub REST 轮询的混合观察；provider mismatch、provider_lost、cancel、new attempt 和三重成功门槛均落在 D1 状态机中。 [VERIFIED: repository grep] [CITED: https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 使用中文完成研究、验证和交付结论。 [VERIFIED: AGENTS.md]
- 代码或 phase 工作先经过对应 GSD 工作流；本文件属于 Phase 18 research artifact。 [VERIFIED: AGENTS.md]
- 当前执行真相以 .planning/PROJECT.md、.planning/ROADMAP.md 和 .planning/STATE.md 为准。 [VERIFIED: AGENTS.md]
- 本地服务验证沿 Gateway canonical URL http://localhost:8080/... 进行；生产 provider proof 使用后续目标环境证据。 [VERIFIED: AGENTS.md]
- 文档只写 canonical owner；Phase 18 研究输出写入本阶段目录。 [VERIFIED: AGENTS.md]
- 保留工作树现有脏文件和未跟踪 evidence；本阶段只新增研究文档。 [VERIFIED: AGENTS.md]
- 修改函数、类或方法前先做 GitNexus impact analysis；返回 HIGH/CRITICAL 时在计划中保留显式告警。 [VERIFIED: AGENTS.md]
- 提交前运行 GitNexus detect-changes，确认变更只覆盖预期文件与 execution flows。 [VERIFIED: AGENTS.md]

## Summary

Phase 18 应把 GitHub Actions 当作受控的外部执行器，把 D1 中的 crawler task/run 作为唯一业务事实源。现有管理 API 已能创建任务、查询 run、读取日志、请求取消和重试；内部 runner API 已具备独立 HMAC、current/previous key、时间窗、nonce、event_id、sequence、幂等事件与 receipt 验证。 [VERIFIED: repository grep]

生产 API 的推荐路径是：服务端从封闭 registry 解析模板和固定 provider 快照，使用 GitHub App installation token 在请求内 mint 后 dispatch；workflow 首步以签名 schedule_register 或 provider_started 进入控制面，随后复用 target-profile、GitHub Environment、prepared context 和既有 crawler entry。 [VERIFIED: 18-CONTEXT.md; repository grep] [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app]

GitHub dispatch 的 HTTP 受理、workflow 进程退出和单独的 provider conclusion 都只是部分证据。生产成功必须同时满足 provider 成功、签名终态绑定相同 app run/attempt/provider 快照、以及 API 已核验的非空 receipt；取消先写 D1 再调用 provider cancel，重试创建新 attempt 和新的 workflow run。 [VERIFIED: 18-CONTEXT.md; repository grep] [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run]

**Primary recommendation:** 新增一个集中式 GitHub App/provider adapter 和 reconciliation worker；保持 D1 CAS 状态机、独立 runner-event HMAC、target-profile prepared context 与现有 crawler transport 不变，只把两个 registry-owned production adapter 接入现有 workflow。 [VERIFIED: 18-CONTEXT.md; repository grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 管理员创建、取消、重试命令 | API / Backend | Database / Storage | 现有 admin crawler-tasks route 做 session/resource 权限校验，repository 负责条件状态迁移和审计。 [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; apps/api/src/domain/crawler-tasks/repository.ts] |
| GitHub App JWT 与 installation token mint | API / Backend | External Provider | 私钥只在 Worker secret 中使用，installation token 只存在当前请求；GitHub 官方规定 App JWT 使用 RS256、短期 exp，并通过 installation access-token endpoint 换取 token。 [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app] |
| workflow registry、repository/ref/Environment snapshot | API / Backend | Config / CI | template-registry 与 target-profile 是服务端边界；调用方只提交 movie/manga 模板键，workflow、main ref、repository 和 starye-org Environment 从固定映射取得。 [VERIFIED: 18-CONTEXT.md; apps/api/src/domain/crawler-tasks/template-registry.ts; packages/config/src/deployment-target/target-resolver.ts] |
| D1 task/run/provider association/attempt history | Database / Storage | API / Backend | D1 保存业务事实、attempt 链、provider 绑定、补偿事件和 receipt 摘要；API 只通过 repository 的 CAS/batch 边界写入。 [VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts; .planning/research/ARCHITECTURE.md] |
| schedule 首步注册与时间桶幂等 | External CI / Runner | API / Backend, Database / Storage | GitHub schedule 没有 workflow_dispatch inputs，且可能延迟；workflow 首步必须以 template + target + workflow + scheduled_at bucket 向 API 注册。 [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule] [VERIFIED: 18-CONTEXT.md] |
| provider_started、进度、日志、终态 receipt | External CI / Runner | API / Backend, Database / Storage | Actions 生成 GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT，签名事件把 provider 快照绑定到预创建 app run，API 验证后写 D1。 [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables] [VERIFIED: apps/api/src/routes/internal/crawler-runs/index.ts] |
| crawler 执行和 target-profile prepared context | External CI / Runner | Config / API | Node/Puppeteer 继续运行在 GitHub-hosted runner；workflow 保留 target-profile validate、prepare-mutation、run-prepared-entry，Worker 只做控制面。 [VERIFIED: .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml; packages/crawler/scripts/target-crawl-mutation.ts] |
| provider 状态补偿、取消和失联收口 | API / Backend | External Provider, Database / Storage | API 轮询已绑定 run ID，仅把 provider 事实写为补偿事件；cancel REST 响应是过程证据，终态仍由签名事件或 reconciliation 确认。 [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run] [VERIFIED: 18-CONTEXT.md] |

## Standard Stack

### Core

| Library / platform | Version | Purpose | Why Standard |
|-------------------|---------|---------|-------------|
| Cloudflare Workers Fetch + Web Crypto | runtime | GitHub REST、App JWT/HMAC、API route 编排 | Worker 已是 API 控制面；Fetch/Web Crypto 是平台原生边界，避免把 Node-only provider SDK 引入 Worker。 [VERIFIED: apps/api; .planning/research/STACK.md] [CITED: https://developers.cloudflare.com/workers/runtime-apis/fetch/; https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |
| Cloudflare D1 + Drizzle ORM | drizzle-orm 0.45.2 in repo; npm latest 0.45.2 on 2026-07-31 | task/run/provider association、CAS、索引和 migration | 现有 repository、schema 与 migration 已基于 D1/Drizzle；新增 provider 字段应沿用同一 owner。 [VERIFIED: packages/db/package.json; npm view drizzle-orm version] [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| Hono | 4.12.14 range in repo; npm latest 4.12.33 on 2026-07-31 | admin/internal routes 与 Worker middleware | 现有 API 采用 Hono；路由、validator 和 HTTPException 已覆盖 crawler command/event boundary。 [VERIFIED: apps/api/package.json; apps/api/src/routes/admin/crawler-tasks/index.ts; npm view hono version] |
| Valibot | 1.3.1 range in repo; npm latest 1.4.2 on 2026-07-31 | provider input、event envelope、receipt schema | 现有 event/schema 与 target boundary 使用 Valibot；所有 provider 输入采用 closed schema。 [VERIFIED: apps/api/package.json; apps/api/src/schemas/crawler-run-events.ts; npm view valibot version] |
| @starye/api-types | workspace | task/run/provider DTO 与共享枚举 | API、runner、Dashboard 共享 workspace contract，避免 provider 字段在多处漂移。 [VERIFIED: packages/api-types/package.json; .planning/research/ARCHITECTURE.md] |
| GitHub Actions existing workflows | actions/checkout@v6; pnpm/action-setup@v4; actions/setup-node@v6.3.0; Node 24; pnpm 10.33.0 | 生产 crawler 执行 | 两个既有 workflow 已固定 target-profile prepare/run-prepared-entry，并使用 starye-org Environment。 [VERIFIED: .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml] [CITED: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax] |
| Node crawler adapters | Node 24; puppeteer-core 24.41.0; puppeteer 24.41.0; p-queue 9.1.2; p-map 7.0.4 in repo | movie/manga 数据面、心跳检查点、取消与 receipt | 既有 crawler 依赖 Node/browser；Production adapter 应注入 run context/event sink，而非重写 crawler transport。 [VERIFIED: packages/crawler/package.json; packages/crawler/src/task-runner/runner-client.ts] |

### Supporting

| Library / module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| Vitest | 4.1.4 in repo; npm latest 4.1.10 on 2026-07-31 | provider client、JWT claim、schedule idempotency、reconciliation、state race tests | 每个 provider branch 用 stubbed fetch/D1 fixture 覆盖；不引入 SaaS E2E。 [VERIFIED: package.json; apps/api/package.json; npm view vitest version] |
| tsx | 4.21.0 in repo; npm latest 4.23.1 on 2026-07-31 | 既有 target-profile、crawler entry、local runner CLI | workflow 继续调用既有 package scripts，不把新 provider 逻辑塞进 shell。 [VERIFIED: packages/crawler/package.json; npm view tsx version] |
| target-profile resolver/prepared context | workspace | target、CI Environment、generated config 的闭边界 | 所有 production workflow 先 validate，再 prepare-mutation，再 run-prepared-entry。 [VERIFIED: packages/config/src/deployment-target/target-resolver.ts; scripts/target-profile.ts] |
| runner-event-auth + crawler-run-events | workspace | current/previous HMAC key、时间窗、nonce、sequence、event_id 和 receipt | Actions callback adapter 复用现有签名边界，仅扩展 schedule_register/provider_started/provider metadata 字段。 [VERIFIED: apps/api/src/domain/crawler-tasks/runner-event-auth.ts; apps/api/src/schemas/crawler-run-events.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker 原生 fetch provider client | 通用 GitHub SDK | 原生 fetch 覆盖 dispatch/cancel/status/token exchange 的窄接口，不增加 Worker runtime 适配层；SDK 只有在后续 provider 资源明显扩张时再评估。 [VERIFIED: repository stack] |
| D1 lease + reconciliation | GitHub Actions concurrency 作为业务队列 | Actions concurrency 可限制执行冲突，却不承载 task/run/attempt 历史；D1 lease 继续拥有业务排队和幂等。 [VERIFIED: .planning/research/ARCHITECTURE.md; .planning/research/PITFALLS.md] |
| 新 dispatch + 新 D1 attempt | GitHub rerun 作为业务 retry | GitHub rerun 保持同一 GITHUB_RUN_ID、递增 run_attempt；Phase 18 的业务重试要保留新 attempt/new workflow run，rerun 仅作 provider 基础设施补偿。 [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables] [VERIFIED: 18-CONTEXT.md] |

**Installation:**

本阶段不安装外部 runtime package；复用现有 lockfile、workspace package 和 GitHub Actions versions。 [VERIFIED: 18-CONTEXT.md; package.json]

~~~bash
pnpm --filter api type-check
pnpm --filter @starye/db type-check
pnpm --filter @starye/api-types build
pnpm --filter @starye/crawler type-check
~~~

**Version verification:**

2026-07-31 已对 Hono、Drizzle ORM、Valibot、Vitest、Puppeteer、p-queue、p-map、tsx 和 Wrangler 运行 npm view；表内 repository versions 作为本阶段锁定基线，registry newer 版本只记录观察，不触发顺手升级。 [VERIFIED: npm view; repository package.json]

## Package Legitimacy Audit

本阶段没有新增 external package，Package Legitimacy Gate = N/A；现有包保持 lockfile 版本，planner 不生成安装任务。 [VERIFIED: 18-CONTEXT.md; package.json]

| Package | Registry snapshot | Postinstall | Phase disposition |
|---------|-------------------|-------------|-------------------|
| hono | 4.12.33 latest; repo range ^4.12.14 | empty | Existing dependency; no install. [VERIFIED: npm view] |
| drizzle-orm | 0.45.2 latest; repo 0.45.2 | empty | Existing dependency; no install. [VERIFIED: npm view] |
| valibot | 1.4.2 latest; repo range ^1.3.1 | empty | Existing dependency; no install. [VERIFIED: npm view] |
| vitest | 4.1.10 latest; repo range ^4.1.4 | empty | Existing dependency; no install. [VERIFIED: npm view] |
| puppeteer-core | 25.4.0 latest; repo range ^24.41.0 | empty | Existing dependency; no install or upgrade. [VERIFIED: npm view] |
| wrangler | 4.116.0 latest; repo range ^4.90.0 | empty | Existing dev dependency; invoke via pnpm exec. [VERIFIED: npm view] |

Packages removed due to SLOP verdict: none — no new package candidate entered the gate.
Packages flagged as suspicious SUS: none — no new package candidate entered the gate.

## Architecture Patterns

### System Architecture Diagram

~~~text
Admin session
   |
   v
POST /api/admin/crawler-tasks
   |
   +--> session/resource permission + closed template registry
   |
   +--> D1 create task + queued run + provider snapshot
   |        |
   |        +--> manual: mint App installation token -> dispatch fixed workflow
   |        |
   |        +--> schedule: workflow first step -> signed schedule_register
   |                                  |
   |                                  +--> template/target/workflow/time bucket idempotency
   |
   v
GitHub Actions resolve target
   |
   +--> validate starye-org -> resolve GitHub Environment
   +--> prepare-mutation -> prepared context -> controlled movie/manga adapter
   |
   +--> signed provider_started
           {app run_id, attempt, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
            workflow, repository, ref, sha, Environment, template, target}
   |
   v
API exact binding + D1 CAS
   |
   +--> heartbeat/progress/log events ----+
   |                                      |
   +--> API polls GET workflow run -------+--> reconciliation branch
                                          |       |
                                          |       +--> provider_mismatch -> audit + bounded window
                                          |       +--> provider_lost -> current attempt failed
                                          |       +--> provider success -> still await signed terminal + receipt
   |
   +--> admin cancel: D1 cancel_requested -> GitHub cancel -> runner checkpoint
   |
   +--> signed terminal + validated receipt
           |
           +--> provider success AND same app/attempt/provider binding AND receipt valid
                       |
                       +--> D1 succeeded
           +--> otherwise D1 failed/cancelled with audit facts
~~~

The diagram reflects the required control/data split: API and D1 own business state, GitHub owns process execution, and the crawler owns Node/browser work. [VERIFIED: 18-CONTEXT.md; .planning/research/ARCHITECTURE.md] GitHub schedule is a separate trigger path without dispatch inputs, so the first job must perform control-plane registration before the crawler starts. [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule]

### Recommended Project Structure

~~~text
apps/api/src/
├── domain/crawler-tasks/
│   ├── provider-association.ts       # provider snapshot and exact binding
│   ├── reconciliation.ts             # bounded polling and mismatch/lost facts
│   ├── repository.ts                 # existing D1 CAS/lease/event boundary
│   └── state-machine.ts              # existing lifecycle plus provider transitions
├── lib/github-app/
│   ├── jwt.ts                        # App JWT claim construction/signing
│   ├── installation-token.ts         # per-request token exchange, no persistence
│   └── github-actions-client.ts      # fixed dispatch/cancel/status REST calls
├── routes/admin/crawler-tasks/
│   └── index.ts                      # existing command surface, provider calls
└── routes/internal/crawler-runs/
    └── index.ts                      # existing signed event surface, provider fields
packages/crawler/src/task-runner/
├── runner-client.ts                  # existing signed client pattern
└── actions-event-client.ts           # workflow callback adapter
.github/workflows/
├── daily-movie-crawl.yml             # schedule + controlled dispatch inputs
└── daily-manga-crawl.yml             # schedule + controlled dispatch inputs
packages/db/
└── drizzle/                          # provider association/reconciliation migration
~~~

This is a recommended ownership map, not a claim that every listed file already exists. Existing paths and responsibilities are verified in the canonical references. [VERIFIED: repository grep]

### Pattern 1: Per-request GitHub App installation token

**What:** Build a short-lived App JWT, exchange it for an installation token, perform one provider operation, and discard token material after the request. GitHub documents RS256, iat backdating of about 60 seconds, exp no more than 10 minutes ahead, App ID in iss, and the installation access-token endpoint. [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app; https://docs.github.com/en/rest/apps/installations#create-an-installation-access-token-for-a-github-app]

**When to use:** Every manual dispatch, cancel, status poll, or reconciliation request from the Worker.

**Example:**

~~~typescript
const now = Math.floor(Date.now() / 1000)
const appJwtClaims = {
  iat: now - 60,
  exp: now + 9 * 60,
  iss: APP_ID,
}
const appJwt = await signRs256(appJwtClaims, APP_PRIVATE_KEY)

const tokenResponse = await fetch(
  'https://api.github.com/app/installations/' + INSTALLATION_ID + '/access_tokens',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + appJwt,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      repository_ids: [REPOSITORY_ID],
      permissions: { actions: 'write' },
    }),
  },
)
if (!tokenResponse.ok) throw new Error('github_installation_token_failed')
const { token } = await tokenResponse.json()
~~~

signRs256 应调用 Web Crypto 的 RSASSA-PKCS1-v1_5/SHA-256 helper；JWT/private key/token 只进入当前 request scope，日志、D1、receipt 只保存 redacted reason code。 [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] [VERIFIED: 18-CONTEXT.md]

### Pattern 2: Closed workflow registry and immutable provider snapshot

**What:** API receives only movie/manga template key; registry supplies exact workflow path, repository, ref, target, Environment and controlled entry. Dispatch inputs explicitly carry run_id, attempt, template and target. The workflow validates all four against the API record before crawler work. [VERIFIED: 18-CONTEXT.md; apps/api/src/domain/crawler-tasks/template-registry.ts]

**Example:**

~~~typescript
const providerSpec = workflowRegistry[templateKey]
const input = {
  ref: providerSpec.ref,
  return_run_details: true,
  inputs: {
    run_id: run.id,
    attempt: String(run.attemptNumber),
    template: providerSpec.template,
    target: providerSpec.targetId,
  },
}
const response = await githubActionsClient.dispatch(providerSpec.workflowPath, input)
if (!response.accepted) {
  await repository.recordDispatchFailure(run.id, response.reasonCode)
} else {
  await repository.markDispatching(run.id, response.workflowRunId || null)
}
// A dispatch response is not the running or success proof.
~~~

The existing movie workflow uses crawler-optimized and the manga workflow uses crawler-comic; both resolve target-profile and Environment before run-prepared-entry. [VERIFIED: .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml]

### Pattern 3: Schedule registration with a fixed time bucket

**What:** Schedule-triggered workflows call the signed internal API before crawler startup. The idempotency key is template + target + workflow + scheduled_at bucket; duplicate registration returns the existing control-plane run. [VERIFIED: 18-CONTEXT.md] [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule]

**Example:**

~~~typescript
const scheduleBucket = scheduledAt.toISOString().slice(0, 16)
const registerEvent = {
  type: 'schedule_register',
  schedule_key: [template, target, workflow, scheduleBucket].join(':'),
  template,
  target,
  workflow,
  repository,
  ref: 'main',
  environment,
  scheduled_at: scheduledAt.toISOString(),
}
const result = await signedRunnerClient.registerSchedule(registerEvent)
if (result.kind === 'duplicate') return result.run
if (result.kind === 'validation_error') throw new Error('schedule_registration_rejected')
return result.run
~~~

Network timeout/5xx receive a finite retry budget with backoff; identity, template, target and bucket validation errors stop before crawler startup. [VERIFIED: 18-CONTEXT.md]

### Pattern 4: Exact provider_started binding

**What:** The first signed event records GitHub run ID and attempt plus the immutable dispatch snapshot. API accepts it only when every field matches the D1 provider association. [VERIFIED: 18-CONTEXT.md; apps/api/src/routes/internal/crawler-runs/index.ts] [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables]

~~~typescript
const startedEvent = {
  run_id: APP_RUN_ID,
  attempt: ATTEMPT,
  event_id: EVENT_ID,
  nonce: CALLBACK_NONCE,
  sequence: 1,
  type: 'provider_started',
  provider: {
    github_run_id: process.env.GITHUB_RUN_ID,
    github_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    workflow: WORKFLOW_PATH,
    repository: REPOSITORY,
    ref: GIT_REF,
    sha: GITHUB_SHA,
    environment: GITHUB_ENVIRONMENT,
    template: TEMPLATE,
    target: TARGET,
  },
}
await signedRunnerClient.send(startedEvent)
~~~

GITHUB_RUN_ID stays stable across a GitHub rerun while GITHUB_RUN_ATTEMPT increments; business retry therefore creates a new workflow run and a new D1 attempt, while provider rerun is reserved for infrastructure recovery. [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables] [VERIFIED: 18-CONTEXT.md]

### Pattern 5: Hybrid observation and terminal gate

**What:** Signed events carry startup, progress, logs, terminal state and receipt. API polls only the already-bound GitHub run for missing callbacks, stalled status, or mismatched conclusion; every poll writes an auditable reconciliation fact. [VERIFIED: 18-CONTEXT.md] [CITED: https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run]

~~~typescript
const providerSuccess = providerRun.status === 'completed'
  && providerRun.conclusion === 'success'
const eventBindingMatches = terminalEvent.run_id === appRun.id
  && terminalEvent.attempt === appRun.attempt
  && terminalEvent.provider.github_run_id === providerRun.id
const receiptValid = terminalEvent.type === 'succeeded'
  && validateReceipt(terminalEvent.receipt).ok

if (providerSuccess && eventBindingMatches && receiptValid) {
  return repository.completeSucceeded(appRun.id, terminalEvent.receipt)
}
if (providerMismatch(providerRun, appRun.providerSnapshot)) {
  await repository.recordProviderMismatch(appRun.id, providerRun)
  return 'reconciliation_window'
}
return repository.keepOpenOrFailClosed(appRun.id, 'provider_lost_or_terminal_evidence_missing')
~~~

A dispatch HTTP 200/204, a workflow process exit code, or provider conclusion alone never completes the D1 run. [VERIFIED: 18-CONTEXT.md; .planning/research/PITFALLS.md]

### Pattern 6: Cooperative cancellation and new-attempt retry

**What:** Admin cancel first transitions D1 to cancel_requested, then calls the GitHub cancel endpoint. The runner observes cancellation at heartbeat/safe checkpoints and signs cancelled; the API records final cancelled only after signed terminal evidence or reconciliation. Retry creates a new attempt and workflow run; old logs and receipt facts remain queryable. [VERIFIED: 18-CONTEXT.md; apps/api/src/domain/crawler-tasks/state-machine.ts] [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run]

~~~typescript
const decision = await repository.applyTransition(runId, {
  actor: 'admin',
  type: 'admin_cancel',
})
if (decision.nextStatus === 'cancel_requested') {
  const association = await repository.getProviderAssociation(runId)
  if (association && association.github_run_id) {
    await githubActionsClient.cancelRun(association.github_run_id)
  }
}
// Terminal status comes from signed cancelled/succeeded or bounded reconciliation.
~~~

The existing state machine gives a verified success receipt precedence when cancellation races with success and records cancel_not_effective; the production provider adapter should preserve that rule. [VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts]

### Pattern 7: Controlled production crawler adapter

**What:** Extend the existing prepared-context entry boundary so only the two registry-owned production adapters run, while preserving target_id, run_id, generated API/gateway config and declared secret keys. target-crawl-mutation.ts currently accepts the smoke fixture and check-config operations and rejects other entries; Phase 18 must add explicit movie/manga adapters with tests for closed entry/argument sets. [VERIFIED: packages/crawler/scripts/target-crawl-mutation.ts; .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml]

**When to use:** Both production workflows after registration and target-profile preparation.

### Anti-Patterns to Avoid

- **Dispatch response as success:** A provider response confirms request acceptance only; wait for exact provider_started, signed terminal and receipt. [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event] [VERIFIED: 18-CONTEXT.md]
- **Caller-owned workflow/ref/target/URL:** Keep registry, repository, ref, Environment and target server-owned; accept only template and run context. [VERIFIED: 18-CONTEXT.md]
- **Schedule bypass:** Every scheduled workflow registers through D1 first; schedule timing is UTC/default-branch based and can be delayed. [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule]
- **Loose provider association:** Match app run, attempt, workflow, repository, ref, sha, Environment, template and target before accepting events. [VERIFIED: 18-CONTEXT.md]
- **Immediate cancelled:** GitHub cancel is asynchronous; retain cancel_requested until signed terminal/reconciliation. [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run]
- **Rerun as business retry:** Rerun keeps GITHUB_RUN_ID and increments attempt; business retry requires a fresh D1 attempt/new workflow run. [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables]
- **Direct crawler execution in Worker/Dashboard:** Node/Puppeteer stays in Actions/local runner; API remains short-lived control plane. [VERIFIED: packages/crawler/package.json; .planning/research/ARCHITECTURE.md]
- **Existing smoke guard silently bypassed:** Add named production adapters and allowlist tests; preserve prepared context and secret boundaries. [VERIFIED: packages/crawler/scripts/target-crawl-mutation.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT/HMAC cryptography | custom RSA/HMAC primitives or string equality checks | Web Crypto plus existing runner-event-auth | Platform primitives cover signing/verification; existing helper already handles current/previous keys and timing. [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] [VERIFIED: apps/api/src/domain/crawler-tasks/runner-event-auth.ts] |
| Task/run state | second provider-specific state machine | existing crawler-tasks repository + state-machine + D1 CAS | Local runner already exercises transitions, cancellation race and validated receipt semantics. [VERIFIED: apps/api/src/domain/crawler-tasks/repository.ts; apps/api/src/domain/crawler-tasks/state-machine.ts] |
| Schedule deduplication | in-memory lock or Actions concurrency as queue | D1 unique schedule bucket + repository transaction | Worker instances are stateless; D1 keeps one durable registration fact. [VERIFIED: 18-CONTEXT.md; .planning/research/ARCHITECTURE.md] |
| Provider discovery | query latest workflow or accept arbitrary workflow name | closed registry snapshot | Recent-run scanning can mix schedule/manual/rerun executions; registry preserves exact association. [VERIFIED: .planning/research/PITFALLS.md] |
| Target/environment resolution | inline account IDs, URL or secret args | target-profile validate + prepare-mutation + prepared context | Existing target resolver is the canonical target/Environment boundary. [VERIFIED: packages/config/src/deployment-target/target-resolver.ts; scripts/target-profile.ts] |
| Receipt validation | count-only or process-exit success check | existing receipt schema, normalization and repository validator | DATA-01 requires non-empty matching content identity; success race already uses receipt validity. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; apps/api/src/domain/crawler-tasks/state-machine.ts] |
| Crawler data plane | new browser automation or duplicate movie/manga sync | existing movie-adapter.ts, manga-adapter.ts, ApiClient and controlled adapter | Existing transport and cleanup encode site-specific behavior and API contracts. [VERIFIED: packages/crawler/src/task-runner/movie-adapter.ts; packages/crawler/src/task-runner/manga-adapter.ts] |
| Provider HTTP retry policy | scattered fetch retries | one provider client with bounded retry classification | Retry only network/5xx; identity, permission, schema and target mismatch fail closed. [VERIFIED: 18-CONTEXT.md] |

**Key insight:** Phase 18 complexity is the binding/evidence protocol, not a new queue or crawler framework. Reusing the existing D1 state/event/receipt boundaries keeps provider execution replaceable and makes late/mismatched evidence auditable. [VERIFIED: 18-CONTEXT.md; .planning/research/ARCHITECTURE.md]

## Common Pitfalls

### Pitfall 1: Dispatch accepted but run never bound

**What goes wrong:** API marks running or succeeded from dispatch response, or scans the newest workflow run and attaches the wrong provider execution. [VERIFIED: .planning/research/PITFALLS.md]
**Why it happens:** Dispatch acknowledgement and actual workflow execution are separate asynchronous facts; schedule, manual, and rerun paths can overlap. [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event]
**How to avoid:** Store a D1 provider snapshot, pass app run_id/attempt explicitly, require exact signed provider_started, then poll only the bound provider ID. [VERIFIED: 18-CONTEXT.md]
**Warning signs:** dispatching lasts past the startup window, multiple provider IDs claim one app run, or no matching signed event arrives. [VERIFIED: 18-CONTEXT.md]

### Pitfall 2: Schedule creates duplicate runs

**What goes wrong:** A delayed or retried schedule registration makes two D1 runs for one scheduled execution. [VERIFIED: 18-CONTEXT.md]
**Why it happens:** GitHub schedule has no dispatch inputs and may be delayed/dropped under load; network retry can repeat the first API call. [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule]
**How to avoid:** Unique key template + target + workflow + scheduled_at bucket, idempotent signed schedule_register, and finite retry only for timeout/5xx. [VERIFIED: 18-CONTEXT.md]
**Warning signs:** two active runs share one bucket or one workflow execution lacks a control-plane run ID.

### Pitfall 3: Provider association drifts on ref/SHA/Environment

**What goes wrong:** A signed event carries correct GITHUB_RUN_ID but a different workflow path, ref, SHA, Environment, template or target. [VERIFIED: 18-CONTEXT.md]
**Why it happens:** workflows can run from default branch, manual inputs, or reruns; caller-supplied values are mutable. [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule; https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables]
**How to avoid:** Compare every snapshot field before binding; mismatch writes provider_mismatch and enters a bounded reconciliation window. [VERIFIED: 18-CONTEXT.md]
**Warning signs:** provider event ID matches but SHA/environment/template differs.

### Pitfall 4: Rerun and business retry are conflated

**What goes wrong:** Rerun overwrites the same business attempt, or late events from the old execution modify the new attempt. [VERIFIED: 18-CONTEXT.md]
**Why it happens:** GitHub keeps GITHUB_RUN_ID across rerun and increments GITHUB_RUN_ATTEMPT. [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables]
**How to avoid:** Admin retry creates new D1 attempt and new dispatch; provider rerun is infrastructure-only and event binding includes both app attempt and provider run_attempt. [VERIFIED: 18-CONTEXT.md]
**Warning signs:** attempt history has duplicate provider IDs or a terminal event sequence jumps backward across attempts.

### Pitfall 5: Cancel appears final before crawler stops

**What goes wrong:** API writes cancelled from a 202/409 provider response while crawler is still syncing content. [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run]
**Why it happens:** provider cancel is asynchronous and cannot interrupt every in-flight browser/request operation. [VERIFIED: .planning/research/PITFALLS.md]
**How to avoid:** D1 cancel_requested first, runner checkpoint/heartbeat observes it, then signed cancelled or reconciliation closes the run; preserve success receipt precedence. [VERIFIED: 18-CONTEXT.md; apps/api/src/domain/crawler-tasks/state-machine.ts]
**Warning signs:** cancelled run receives later success receipt, content count changes after terminal state, or Actions conclusion and signed terminal disagree.

### Pitfall 6: Callback replay or cross-run write

**What goes wrong:** Replayed/forged event changes status, duplicates logs, or writes a receipt to another run. [VERIFIED: apps/api/src/routes/internal/crawler-runs/index.ts]
**Why it happens:** a shared secret, missing nonce/time window, or missing event idempotency leaves the event endpoint broadly writable. [VERIFIED: 18-CONTEXT.md; .planning/research/PITFALLS.md]
**How to avoid:** Separate callback HMAC, current/previous key rotation, timestamp window, nonce, key ID, event_id, sequence and exact run/attempt/template binding; redact log details. [VERIFIED: apps/api/src/domain/crawler-tasks/runner-event-auth.ts; apps/api/src/routes/internal/crawler-runs/index.ts]
**Warning signs:** duplicate event IDs, sequence regression, stale timestamp, invalid key ID, receipt-template mismatch.

### Pitfall 7: Production adapter still only runs smoke fixture

**What goes wrong:** Workflow reaches target-crawl-mutation and rejects crawler-comic/crawler-optimized, or a developer bypasses the guard with arbitrary arguments. [VERIFIED: packages/crawler/scripts/target-crawl-mutation.ts]
**Why it happens:** Phase 13/17 guard currently permits smoke/check-config operations while the production workflows already name the two real entries. [VERIFIED: .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml]
**How to avoid:** Add two named registry-owned adapters, retain prepared-context validation and test rejection of every unlisted entry/argument. [VERIFIED: 18-CONTEXT.md; packages/crawler/scripts/target-crawl-mutation.ts]
**Warning signs:** production workflow succeeds through config check but never emits provider_started/receipt, or target-crawl-mutation error mentions registry-owned smoke operation.

### Pitfall 8: Secret material enters logs or D1

**What goes wrong:** App private key, JWT, installation token, callback secret, request authorization header or raw source body appears in logs/receipt. [VERIFIED: 18-CONTEXT.md]
**Why it happens:** generic fetch error logging and unbounded event details cross the control/data boundary. [VERIFIED: .planning/research/PITFALLS.md]
**How to avoid:** log only provider status/reason codes and redacted IDs; keep secrets in Worker/GitHub Environment secret stores, and add tests for secret-shaped fields. [VERIFIED: 18-CONTEXT.md; apps/api/src/routes/internal/crawler-runs/index.ts]
**Warning signs:** D1 details_json includes token-like prefixes, Authorization, PEM markers, or raw HTML.

### Pitfall 9: Local canonical proof is mistaken for production provider proof

**What goes wrong:** Gateway/local runner evidence is reported as GitHub App/Actions completion. [VERIFIED: AGENTS.md; .planning/STATE.md]
**Why it happens:** GitHub App metadata and private key are not configured in the current environment, while local runner proof is available. [VERIFIED: environment audit]
**How to avoid:** keep local contract tests separate from provider-backed evidence; require a later target-environment run for remote proof. [VERIFIED: 18-CONTEXT.md; .planning/STATE.md]
**Warning signs:** no app/installation metadata, no provider run URL, or evidence only references http://localhost:8080.

## Code Examples

Verified implementation shapes:

### Provider client response classification

~~~typescript
type ProviderFailureClass =
  | 'network_retryable'
  | 'provider_5xx_retryable'
  | 'permission_failed'
  | 'input_rejected'
  | 'binding_mismatch'

function classifyProviderResponse(response: Response): ProviderFailureClass {
  if (response.status === 408 || response.status === 429) return 'network_retryable'
  if (response.status >= 500) return 'provider_5xx_retryable'
  if (response.status === 401 || response.status === 403) return 'permission_failed'
  if (response.status >= 400) return 'input_rejected'
  throw new Error('provider_response_requires_contract_parse')
}
~~~

This classification mirrors the locked schedule retry boundary: timeout/5xx use finite backoff; identity, permission, template and target failures stop before crawler startup. [VERIFIED: 18-CONTEXT.md]

### Workflow input contract

~~~yaml
on:
  workflow_dispatch:
    inputs:
      run_id:
        required: true
        type: string
      attempt:
        required: true
        type: string
      template:
        required: true
        type: string
      target:
        required: true
        type: string
~~~

The server registry remains the source of workflow path/repository/ref/Environment; the YAML input is only a transport envelope that the first job validates against the API record. [VERIFIED: 18-CONTEXT.md; .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml] [CITED: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#onworkflow_dispatchinputs]

### Provider mismatch transition

~~~typescript
if (!matchesSnapshot(event.provider, run.providerSnapshot)) {
  await repository.appendAudit(run.id, {
    code: 'provider_mismatch',
    details: redactProviderFields(event.provider),
  })
  return repository.openReconciliationWindow(run.id)
}
~~~

A mismatch is an auditable fact and a bounded branch, not an alternate success path. [VERIFIED: 18-CONTEXT.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PAT or long-lived provider token in Worker | Per-request GitHub App installation token minted from App JWT | Phase 18 locked decision, 2026-07-31 | Shorter credential exposure and repository/permission scoping; requires App metadata/private-key secret configuration. [VERIFIED: 18-CONTEXT.md] [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app] |
| Dispatch 204 treated as started/succeeded | Dispatch acknowledgement followed by signed provider_started and receipt gate | Existing Phase 16/17 -> Phase 18 | Separates provider acceptance from execution and ingestion evidence. [VERIFIED: .planning/research/PITFALLS.md] [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event] |
| App run associated by latest workflow scan | Explicit run_id + attempt + immutable workflow/ref/SHA/Environment snapshot | Phase 18 locked decision, 2026-07-31 | Prevents schedule/manual/rerun cross-wiring. [VERIFIED: 18-CONTEXT.md] |
| Callback-only observation | Signed events plus REST polling reconciliation | Phase 18 locked decision, 2026-07-31 | Recovers missing callbacks while retaining authenticated terminal evidence. [VERIFIED: 18-CONTEXT.md] [CITED: https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run] |
| Immediate provider cancel -> cancelled | cancel_requested -> provider cancel -> signed/reconciled terminal | Phase 16/17 contract carried into Phase 18 | Preserves cancellation race and partial-ingestion facts. [VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts; 18-CONTEXT.md] |
| Business retry via GitHub rerun | New D1 attempt + new workflow run; rerun only provider infrastructure compensation | Phase 18 locked decision, 2026-07-31 | Old attempt evidence stays immutable; late events cannot overwrite the new attempt. [VERIFIED: 18-CONTEXT.md] |

**Deprecated/outdated:**

- Long-lived fine-grained PAT for provider mutation: outside the locked Phase 18 credential boundary; use the GitHub App installation token path. [VERIFIED: 18-CONTEXT.md]
- Workflow page/manual input as task ownership: replaced by D1 registration and fixed registry snapshot. [VERIFIED: 18-CONTEXT.md]
- target-crawl-mutation smoke-only path for production entries: the phase must add explicit production adapters before declaring provider orchestration ready. [VERIFIED: packages/crawler/scripts/target-crawl-mutation.ts]

## Assumptions Log

All implementation claims in this document are either locked user decisions, repository observations, or official documentation citations. Exact migration names, provider client module names, retry counts, reconciliation window length, and test fixture details remain implementation discretion and are intentionally left as planning choices. [VERIFIED: 18-CONTEXT.md; repository grep; official documentation]

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No [ASSUMED] claims recorded. | — | — |

## Open Questions

1. **GitHub App metadata and secret binding names**
   - What we know: D-01 fixes per-request installation tokens; official docs define App JWT and installation token flow. [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app]
   - What's unclear: current environment has no App ID, installation ID or private key variables. [VERIFIED: environment audit]
   - Recommendation: add explicit Worker bindings for APP_ID, INSTALLATION_ID, APP_PRIVATE_KEY, repository owner/name or repository ID; keep values out of D1 and logs; make missing binding a fail-closed configuration error.

2. **Provider association migration shape**
   - What we know: current crawler_run reads task/attempt/status/receipt and lacks github_run_id, github_run_attempt and full provider snapshot columns. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; .planning/research/ARCHITECTURE.md]
   - What's unclear: exact migration number, JSON-versus-column split, and index naming.
   - Recommendation: use typed columns for lookup fields (provider run ID, attempt, workflow, repository, ref, Environment, SHA, provider status/conclusion) plus bounded JSON only for redacted provider facts; add uniqueness for provider run ID plus attempt-aware condition checks.

3. **Reconciliation cadence and window**
   - What we know: D-09/D-10/D-14 require fixed intervals, finite reconciliation window and provider_lost terminal fact. [VERIFIED: 18-CONTEXT.md]
   - What's unclear: numeric interval, max attempts and window length.
   - Recommendation: choose named constants in one module, inject clock/fetch in tests, and document the selected values in the phase plan; keep automatic retry disabled.

4. **workflow_dispatch return payload compatibility**
   - What we know: current GitHub REST supports return_run_details and may otherwise return 204; provider_started remains mandatory. [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event]
   - What's unclear: repository API compatibility and whether the installed GitHub App permission set returns run details.
   - Recommendation: accept both a returned workflow_run_id and an empty accepted response, persist dispatching, and wait for signed provider_started before running state.

5. **Production adapter entry semantics**
   - What we know: daily workflows call crawler-optimized/crawler-comic; target-crawl-mutation currently accepts smoke/check-config only. [VERIFIED: .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-manga-crawl.yml; packages/crawler/scripts/target-crawl-mutation.ts]
   - What's unclear: exact existing movie-adapter/manga-adapter invocation and receipt fields for production.
   - Recommendation: plan a controlled adapter task that reuses runner-client, local cancellation checkpoints, ApiClient sync and receipt validation, with one fixture per template and rejection tests for free-form entries.

6. **Remote proof scheduling**
   - What we know: provider-backed proof needs GitHub App metadata and target Environment secrets; current environment audit found these missing. [VERIFIED: environment audit]
   - What's unclear: selected production repository/environment and the approved evidence run.
   - Recommendation: keep local Gateway contract tests in Phase 18 plan and reserve credentialed provider proof for a separately recorded target run; Phase 19 owns full end-to-end sign-off.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | API tests, workflow crawler, TypeScript | yes | v24.0.1 | — [VERIFIED: environment audit] |
| pnpm | workspace commands and Actions | yes | 10.33.0 | — [VERIFIED: environment audit] |
| Git | phase artifact commit and GitNexus guardrails | yes | 2.39.2 | — [VERIFIED: environment audit] |
| Wrangler | local Worker/D1 checks | yes via pnpm exec | 4.90.1 | global command resolution is absent; use workspace invocation. [VERIFIED: environment audit] |
| Vitest | API/crawler contract tests | yes | 4.1.4 | — [VERIFIED: package.json; environment audit] |
| GitHub App ID | token mint | no | — | configure target Worker secret before provider-backed run; use stubbed fetch tests meanwhile. [VERIFIED: environment audit] |
| GitHub installation ID | token mint | no | — | configure target Worker secret before provider-backed run; use stubbed fetch tests meanwhile. [VERIFIED: environment audit] |
| GitHub App private key | JWT signing | no | — | configure target Worker secret before provider-backed run; use generated test key fixture for local contract tests. [VERIFIED: environment audit] |
| GitHub Actions repository/Environment secrets | crawler and callback | not probed | — | keep workflow contract tests local; record target configuration during execution. [VERIFIED: environment audit] |

**Missing dependencies with no fallback:**

- A real provider-backed production proof needs App metadata/private key and selected GitHub Environment secret configuration. [VERIFIED: environment audit]

**Missing dependencies with fallback:**

- Provider REST behavior: stubbed fetch/D1 fixtures and signed event contract tests.
- Local API/task flow: existing Gateway http://localhost:8080 path and local runner contracts. [VERIFIED: AGENTS.md; Phase 17 artifacts]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Session/resource permission for admin commands plus GitHub App JWT and installation token for provider calls; separate runner-event HMAC. [VERIFIED: AGENTS.md; 18-CONTEXT.md] |
| V3 Session Management | yes | Keep admin session checks in existing routes; provider credentials never enter browser/session DTOs. [VERIFIED: apps/api/src/routes/admin/crawler-tasks/index.ts; 18-CONTEXT.md] |
| V4 Access Control | yes | Closed template registry, fixed repository/ref/Environment/target, task/run ownership and exact run binding prevent cross-template and cross-run access. [VERIFIED: 18-CONTEXT.md; apps/api/src/domain/crawler-tasks/template-registry.ts] |
| V5 Input Validation | yes | Valibot schemas for admin input, workflow inputs, signed event envelope, provider metadata and receipts; reject free-form workflow/URL/secret/command fields. [VERIFIED: apps/api/src/schemas/crawler-run-events.ts; packages/config/src/deployment-target/target-profile.schema.ts] |
| V6 Cryptography | yes | Web Crypto RS256 JWT signing, HMAC-SHA-256 runner events, timestamp/nonce/event_id/sequence checks and constant-time verification. [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] [VERIFIED: apps/api/src/domain/crawler-tasks/runner-event-auth.ts] |

### Known Threat Patterns for GitHub Actions + Cloudflare Worker

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| App private key or installation token in log/receipt | Information disclosure | Request-scoped secret values, redacted reason codes, tests for Authorization/PEM/token-shaped fields. [VERIFIED: 18-CONTEXT.md] |
| Forged or replayed runner event | Spoofing / Tampering | Independent HMAC key, current/previous rotation, timestamp window, nonce, event_id, sequence and exact run/attempt binding. [VERIFIED: apps/api/src/routes/internal/crawler-runs/index.ts; apps/api/src/domain/crawler-tasks/runner-event-auth.ts] |
| Cross-run or cross-template receipt | Tampering / Elevation | D1 association snapshot and receipt template match before state mutation; provider_mismatch audit. [VERIFIED: 18-CONTEXT.md] |
| Caller-supplied workflow/ref/target/URL | Elevation / SSRF | Closed registry and target-profile projection; API accepts template/run context only. [VERIFIED: 18-CONTEXT.md; packages/config/src/deployment-target/target-resolver.ts] |
| GitHub schedule duplicate | Tampering / Denial of service | Fixed bucket unique key and idempotent schedule_register before crawler startup. [VERIFIED: 18-CONTEXT.md] |
| Cancel race with successful ingestion | Tampering / Inconsistent state | cancel_requested first; success receipt validated with precedence; terminal state from signed event/reconciliation. [VERIFIED: apps/api/src/domain/crawler-tasks/state-machine.ts; 18-CONTEXT.md] |
| Provider status guessed from unrelated run | Tampering | Poll only stored provider run ID and compare workflow/ref/SHA/Environment. [VERIFIED: 18-CONTEXT.md] |

## Sources

### Primary (HIGH confidence)

- [VERIFIED: repository grep] .planning/phases/18-github-actions-production-orchestration/18-CONTEXT.md — locked provider/auth/dispatch/schedule/cancel/retry decisions.
- [VERIFIED: repository grep] apps/api/src/routes/admin/crawler-tasks/index.ts — current command/read/cancel/retry and receipt projection.
- [VERIFIED: repository grep] apps/api/src/routes/internal/crawler-runs/index.ts — signed poll/claim/events, HMAC rotation and receipt checks.
- [VERIFIED: repository grep] apps/api/src/domain/crawler-tasks/repository.ts and state-machine.ts — D1 CAS, lease, retry, sweep and cancellation precedence.
- [VERIFIED: repository grep] .github/workflows/daily-movie-crawl.yml and daily-manga-crawl.yml — schedule/manual workflow inputs, target-profile and Environment.
- [VERIFIED: repository grep] packages/config/src/deployment-target/* and scripts/target-profile.ts — target and prepared context boundary.
- [VERIFIED: repository grep] packages/crawler/scripts/target-crawl-mutation.ts and packages/crawler/src/task-runner/* — current smoke guard and reusable runner/crawler adapter patterns.
- [CITED: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app] — App JWT claims, RS256 and installation-token flow.
- [CITED: https://docs.github.com/en/rest/apps/installations#create-an-installation-access-token-for-a-github-app] — installation token endpoint, repository and permission scoping.
- [CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event] — dispatch inputs, ref, accepted responses and Actions write permission.
- [CITED: https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run] — run status/conclusion/path/head_sha/run_attempt polling.
- [CITED: https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run] — cancel endpoint and asynchronous process response.
- [CITED: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables] — GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT behavior.
- [CITED: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#schedule] — schedule default branch, UTC and delay characteristics.
- [CITED: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax] — workflow_dispatch and environment syntax.
- [CITED: https://developers.cloudflare.com/workers/runtime-apis/fetch/] — Worker fetch boundary.
- [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] — Worker Web Crypto boundary.
- [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] — D1 Worker API.

### Secondary (MEDIUM confidence)

- [VERIFIED: repository grep] .planning/research/SUMMARY.md — v1.3 control-plane boundary and Phase 18 gap.
- [VERIFIED: repository grep] .planning/research/ARCHITECTURE.md — task/run/log/provider association and cancellation patterns.
- [VERIFIED: repository grep] .planning/research/STACK.md — current package/runtime and GitHub/Cloudflare integration constraints.
- [VERIFIED: repository grep] .planning/research/PITFALLS.md — dispatch, callback, schedule, cancellation and receipt failure modes.
- [VERIFIED: GitNexus query] createCrawlerTaskRepository, createCrawlerRunsRoutes, runTargetCrawlerMutation, resolveTargetProfile — cross-flow ownership and integration points.

### Tertiary (LOW confidence)

- None. No training-only claim is used in the recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — current repository package manifests, workflow files and npm view snapshots were checked; no dependency upgrade is proposed.
- Architecture: HIGH — state/event/target boundaries are directly present in source and were cross-checked with GitNexus.
- Provider behavior: MEDIUM — GitHub official documentation was reviewed, while live App metadata and remote provider execution are absent in this environment.
- Pitfalls: MEDIUM — critical failure modes are grounded in locked decisions, existing guards and official asynchronous API behavior.

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 for provider API semantics and registry versions; refresh earlier if GitHub Actions REST or App permission behavior changes.
