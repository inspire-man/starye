# Phase 12: Cloudflare Config Switching - Research

**Researched:** 2026-07-15
**Phase:** 12 - Cloudflare Config Switching
**Status:** Ready for planning

## 用户约束

- Phase 12 必须让 Workers、Pages、GitHub deploy/migrate/crawl/rollback workflow 和域名敏感运行时配置消费显式 selected target，不能继续把 singleton production 值当作运行时事实。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- `TargetProfile` 是所有 deployable Cloudflare surface 的唯一 non-secret target source；命令只能接收 tracked target id，不能从 domain、`prod`、`production` 或默认值推断。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- 浏览器仅能得到包含 target id、gateway/API base URL 和应用 base path 的类型化 public allowlist，且本地 canonical 入口固定为 `http://localhost:8080/...`。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md; AGENTS.md]
- CI 必须先以 selected target 解析唯一 GitHub Environment，再绑定该 Environment 中固定名称的一套 secrets；dispatch input 不得覆盖 profile 到 Environment 的映射。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- deploy、migrate、rollback 和 remote crawler 必须在远端写入前完成 CI/remote preflight 与只读 live resource checks；凭据、account、Environment 或资源归属不匹配必须阻断。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- 本阶段不创建 Cloudflare 资源、DNS 或 IaC，不执行 local/production crawler-to-viewing 全链路 smoke，不做旧 `starye.org` 的全仓字面量清理，也不定稿 RUNBOOK。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- 研究和自动化测试不得写入真实 secret、构建产物或远端资源；Pages rollback 必须继续保持显式 fail-closed 的人工回退边界。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

## 阶段现状

- Phase 11 已建立严格的 `TargetProfile` schema，包含 account、domain、完整 URL surfaces、Workers、Pages、D1/R2/KV、local Wrangler profile、GitHub Environment 与仅名称级的 required-secret metadata。 [VERIFIED: packages/config/src/deployment-target/target-profile.schema.ts; packages/config/src/deployment-target/target-profiles.ts]
- `resolveTargetProfile()` 已要求非空的显式 tracked target id，并拒绝缺失、未知或 schema-invalid profile；`runTargetPreflight()` 额外拒绝 `default`、`prod`、`production` 和旧域名等 legacy aliases。 [VERIFIED: packages/config/src/deployment-target/target-resolver.ts; packages/config/src/deployment-target/preflight.ts]
- 现有 CLI 入口 `pnpm target-profile` 已可校验 selected profile、投影四个本地最终 env consumer，并执行 local/CI/remote preflight。 [VERIFIED: package.json; scripts/target-profile.ts]
- 当前 `starye-org` profile 映射 `githubEnvironment: starye-org`，并记录 API/gateway Worker、六个 Pages project 与 D1/R2/KV identity；profile 不保存真实 secret。 [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts]
- 远端 preflight 已要求 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 与 selected profile 的 account id 一致，并以 argv-only D1/R2/KV read checks fail closed。 [VERIFIED: packages/config/src/deployment-target/preflight.ts; packages/config/src/deployment-target/live-checks.ts]
- 当前 Phase 12 尚无计划，且 canonical state 指向 Phase 12 executing / context gathered；Phase 13 负责真实 data-chain smoke，Phase 14 负责 RUNBOOK 与旧域名全仓收口。 [VERIFIED: .planning/STATE.md; .planning/ROADMAP.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

## 需求映射

| Requirement | 计划必须交付 | 可自动验证的证据 |
|---|---|---|
| ENV-03 | 从 selected `TargetProfile` 构建一个共享、类型化的 public contract，包含 target id、gateway base、API base 和稳定的 app base paths；Vite/Nuxt consumer 只适配该 contract。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | profile fixture 的 local/production contract snapshot，以及 Vite/Nuxt adapter type tests。 [ASSUMED]
| ENV-04 | 定义 public key allowlist 和 validation，拒绝未注册的 `VITE_*` / `NUXT_PUBLIC_*` key、secret-shaped key 或 credential value。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | public config validation tests 必须证明 token/secret keys 不会进入结果或错误日志。 [ASSUMED]
| ENV-05 | 浏览器 config 只发布 canonical gateway/API 与应用 path，不发布 `profile.pages.*.canonicalUrl` 或 Worker/Pages internal deployment origin。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | consumer contract tests 断言 local 值是 `http://localhost:8080`，production page URL 由 gateway base path 组成。 [ASSUMED]
| ENV-06 | 增加不需要 source edit 和真实 secret 的 selected-target config smoke，分别覆盖 local Gateway projection 与 production public projection；真实服务链路仍由 Phase 13 证明。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/ROADMAP.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | fixture profile 的 CLI/helper smoke 输出、无凭据运行的 Vitest tests。 [ASSUMED]
| DEPL-01 | API、gateway 与 dashboard 的 Worker/Pages deploy config 必须由 selected profile 投影到临时/命令期配置，不保留可被误用的 singleton `wrangler.toml` identity。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | projection snapshot 包含 Worker name/routes/bindings 与 Pages project/build public vars。 [ASSUMED]
| DEPL-02 | gateway origins、API auth/CORS URL 和 frontend public API URL 必须从同一 selected target contract 消费。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | gateway/API/public-config unit tests 用 profile fixture 覆盖 local 与 production。 [ASSUMED]
| DEPL-03 | 所有手动远端 deploy flow 使用 required target input，schedule/push flow 在版本控制中声明固定 selected target，并通过 resolver 输出绑定唯一 GitHub Environment 的标准 secret names。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | workflow target-resolution tests 与 workflow static contract assertions。 [ASSUMED]
| DEPL-04 | migration 在任何 remote write 前完成 target/environment/live checks、导出 D1 backup、上传 selected R2 bucket，再执行 repair/apply。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | migration command-plan tests 断言 preflight -> export -> upload -> write 的顺序与 selected resource argv。 [ASSUMED]
| DEPL-05 | crawler workflow 从 selected profile 注入非敏感 API/R2/account identity，只从 selected GitHub Environment 注入标准 secret names，并在实际 crawl 前 preflight。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | crawler target-resolution fixture tests，且无测试输出包含 fixture secret。 [ASSUMED]
| DEPL-06 | rollback 在操作 Worker version 前验证 selected target 的 Worker name 与 live resources；Pages rollback 保持失败并指向人工回退。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] | rollback command-plan tests 覆盖 app-to-profile membership、错误 target 与 Pages fail-closed case。 [ASSUMED]
| TEST-03 | 补齐 domain-aware gateway/API/auth configuration tests。 [VERIFIED: .planning/REQUIREMENTS.md] | existing gateway routing tests 加 selected contract cases；API CORS/auth tests 加 selected target/local Gateway cases。 [VERIFIED: apps/gateway/src/__tests__/routing.test.ts; apps/api/src/config.ts; apps/api/src/lib/auth.ts]
| TEST-04 | 补齐 deploy/migration/crawler target resolution tests，所有测试使用 fixture identity 和假执行器，不读取真实 secrets。 [VERIFIED: .planning/REQUIREMENTS.md] | deployment-target package Vitest tests 与 workflow helper tests。 [VERIFIED: packages/config/src/deployment-target/__tests__/preflight.test.ts]

## 已有实现与可复用模式

### Target resolution and validation

- `TargetProfile` 已把 Workers route、Pages canonical URL、D1/R2/KV binding、GitHub Environment 和 URL surface 放在一个 strict schema；schema 还校验 Worker routes / Pages canonical URLs 与显式 URL surfaces 一致。 [VERIFIED: packages/config/src/deployment-target/target-profile.schema.ts]
- `runTargetPreflight()` 的执行流为 `runTargetPreflight -> resolveSelectedTarget -> resolveTargetProfile -> parseTargetProfile -> formatTargetProfileIssues`，可继续作为 Phase 12 单一 validation choke point。 [VERIFIED: gitnexus://repo/starye/process/RunTargetPreflight%20%E2%86%92%20FormatTargetProfileIssues; packages/config/src/deployment-target/preflight.ts]
- `buildLocalEnvProjectionPlan()` 已把 `STARYE_TARGET_ID`、domain/account markers 与 local gateway public URL 写入 API、gateway、root 与 crawler 的四个最终 consumer；marker-aware writer 只拥有 target-managed keys。 [VERIFIED: packages/config/src/deployment-target/projection-plan.ts; packages/config/src/deployment-target/env-file-block.ts]
- `scripts/target-profile.ts` 是 import-safe CLI，已有 `validate`、`project-local` 和 `preflight` 三条命令；其 live executor 使用 `spawnSync('pnpm', ['exec', 'wrangler', ...argv], { shell: false })`。 [VERIFIED: scripts/target-profile.ts]
- deployment-target tests 已使用 temp env roots、fixture secrets 和 mocked executor，且验证 fail-closed error 不回显 fixture secret；这是 Phase 12 无真实凭据测试的直接模式。 [VERIFIED: packages/config/src/deployment-target/__tests__/preflight.test.ts]

### Runtime consumers

- API 和 gateway 的 `wrangler.toml` 仍固定写入 Worker name、routes、D1/R2/KV identity、生产 origins 和 public vars，因此它们目前不能安全消费另一个 profile。 [VERIFIED: apps/api/wrangler.toml; apps/gateway/wrangler.toml]
- dashboard `wrangler.toml` 把 `VITE_API_URL` 固定为 `https://api.starye.org`，但 dashboard deploy workflow build step 又固定为 `https://starye.org`；同一 consumer 已存在两个生产 API 值。 [VERIFIED: apps/dashboard/wrangler.toml; .github/workflows/deploy-dashboard.yml]
- auth 和 blog 在 Nuxt `runtimeConfig.public` 中使用 `NUXT_PUBLIC_API_URL || VITE_API_URL || http://localhost:8080`，但各自 auth client 又直接读取 `import.meta.env.VITE_API_URL`；这需要统一到共享 public contract adapter。 [VERIFIED: apps/auth/nuxt.config.ts; apps/blog/nuxt.config.ts; apps/auth/app/lib/auth-client.ts; apps/blog/app/lib/auth-client.ts]
- dashboard、movie 和 comic 同样直接读取 Vite env 或在 Vite dev server 内指向 direct API port；这些开发端口只能保留为内部 dev implementation，不能成为 public config 的 canonical default。 [VERIFIED: apps/dashboard/src/views/Actors.vue; apps/dashboard/src/views/Publishers.vue; apps/movie-app/vite.config.ts; apps/comic-app/vite.config.ts; AGENTS.md]
- gateway production routing 已从 `API_ORIGIN`、`AUTH_ORIGIN`、`DASHBOARD_ORIGIN`、`BLOG_ORIGIN`、`MOVIE_ORIGIN`、`COMIC_ORIGIN` 和 `TAVERN_ORIGIN` 读取 target origins，且现有 routing tests 已覆盖 local / production path rewrite，可扩展为 selected-profile cases。 [VERIFIED: apps/gateway/src/index.ts; apps/gateway/src/__tests__/routing.test.ts]
- API CORS 和 Better Auth cookie/trusted-origin behavior 由 `getAllowedOrigins()`、`WEB_URL`、`ADMIN_URL` 与 `BETTER_AUTH_URL` 决定，但 `getAllowedOrigins()` 仍含旧 production literals；Phase 12 应只替换此 domain-aware choke point，不能扩张为全仓 literal cleanup。 [VERIFIED: apps/api/src/config.ts; apps/api/src/lib/auth.ts; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

### CI and operations surfaces

- deploy API、gateway、dashboard、auth、blog、movie、comic，以及 API-after-PR workflow 都直接使用 repository-level `secrets.CLOUDFLARE_*` 和固定 project/name/build URL，尚未声明 selected target 或 GitHub Environment。 [VERIFIED: .github/workflows/deploy-api.yml; .github/workflows/deploy-gateway.yml; .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-auth.yml; .github/workflows/deploy-blog.yml; .github/workflows/deploy-movie.yml; .github/workflows/deploy-comic.yml; .github/workflows/deploy-api-after-pr.yml]
- `TargetProfile.pages.blog.project` 是 `starye-blog`，而现有 deploy-blog workflow 使用 `blog-pages`；在切换实现前必须把 profile 和 workflow resource identity 收敛为一个可验证值，不能静默任选其一。 [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; .github/workflows/deploy-blog.yml]
- deploy dashboard/auth/blog/movie/comic workflow 以 `wrangler pages project create ... || true` 创建或忽略 Pages project 创建失败；这与“不创建资源”和资源不存在必须 fail closed 的本阶段边界冲突。 [VERIFIED: .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-auth.yml; .github/workflows/deploy-blog.yml; .github/workflows/deploy-movie.yml; .github/workflows/deploy-comic.yml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- migration workflow 当前在 export backup 前运行 `fix-missing-tables.sql`，随后将固定 `starye-db` backup 写入 secret-provided R2 bucket；任何 remote write 必须被重排到 selected target preflight 和 backup/upload 之后。 [VERIFIED: .github/workflows/deploy-migrations.yml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- daily manga/movie/actor/publisher crawler workflows 都从 repository secrets 直接取 API/R2/account identity，且 schedule event 没有版本控制中的 selected target declaration；它们都属于 target-resolution adoption inventory。 [VERIFIED: .github/workflows/daily-manga-crawl.yml; .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-actor-crawl.yml; .github/workflows/daily-publisher-crawl.yml]
- rollback workflow 固定 `starye-api` / `starye-gateway` worker names，且 Pages app branch 明确退出失败；前者需要 profile ownership validation，后者应原样保留。 [VERIFIED: .github/workflows/rollback.yml]
- monthly cleanup 也会对固定 `starye-db` 执行 remote D1 reads/writes，并可手动 dispatch；因 D-07 要求所有手动远端 workflow 显式 target，planner 必须把它列入 adoption inventory 或在计划中以 locked scope 说明其同等 preflight 接入。 [VERIFIED: .github/workflows/monthly-cleanup.yml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

## 必须处理的计划风险

- 当前 CLI 的 `runPreflight()` 无论 scope 都调用 `collectPreflightProjectionIssues()`，而 CI checkout 不包含四个 operator-owned local env files；若直接在 CI 调用，必然产生 missing-projection-file / user-secret issues。 [VERIFIED: scripts/target-profile.ts; packages/config/src/deployment-target/projection-plan.ts]
- 现有 live checks 只检查 D1、R2 和 KV；它们不能证明 selected API/gateway Worker 或 Pages project 存在，因此不足以满足 deploy/rollback 的完整资源归属要求。 [VERIFIED: packages/config/src/deployment-target/live-checks.ts; packages/config/src/deployment-target/target-profile.schema.ts]
- `ci`/`remote` scope 目前通过同一 `ciEnvironment` option 校验 GitHub Environment，但 CLI 不会产出可供 GitHub job 的 machine-readable target/environment/public/deploy projection；Phase 12 需要在同一 resolver 层增加安全的 workflow-output contract。 [VERIFIED: packages/config/src/deployment-target/preflight.ts; scripts/target-profile.ts]
- profile 中的 `pages.*.canonicalUrl` 是 gateway upstream/deployment identity 的输入，不应直接进入 browser public config；公开 app URL 应由 `gatewayBase + appBasePath` 组成。 [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; apps/gateway/src/index.ts; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- Vite build-time replacement与 Nuxt public runtime config 在构建阶段消费环境值；统一 contract 时必须同时更新 Vite 和 Nuxt adapter，不能只替换 `.env.local` 的两个 API keys。 [VERIFIED: apps/auth/nuxt.config.ts; apps/blog/nuxt.config.ts; apps/dashboard/vite.config.ts; apps/auth/app/lib/auth-client.ts]
- Workflow static build URL、Wrangler config、profile 和 CLI output 之间出现第二套 target source 时会重新引入 mixed-target deploy；所有 resource name、account id、route/origin 和 build public value 必须由同一个 selected resolution 投影。 [VERIFIED: apps/api/wrangler.toml; apps/gateway/wrangler.toml; .github/workflows/deploy-dashboard.yml; packages/config/src/deployment-target/target-resolver.ts]

## 计划建议

### Plan 12-01: Shared target projections and public contract

1. 在 `@starye/config/deployment-target` 扩展 selected-resolution projection，提供 machine-readable CI context、Worker/Pages deploy projection 与 typed public runtime config；所有 output 仅含 profile 中的 non-secret identity。 [VERIFIED: packages/config/src/deployment-target/index.ts; packages/config/src/deployment-target/target-profile.schema.ts]
2. 将 app base paths 作为稳定 typed public contract 的一部分，并由 gateway base 组装 browser-facing app URLs；不要让应用消费 `pages.*.canonicalUrl`、Worker origin 或任意 env map。 [VERIFIED: apps/gateway/src/index.ts; apps/dashboard/vite.config.ts; apps/auth/nuxt.config.ts]
3. 让 deploy projection 在命令期生成临时 Wrangler/Pages input，包含 profile 的 Worker name/route/binding、Pages project 与 public build vars；移除静态 config 中 singleton identity，而不新增永久 `[env.<target>]` 分叉。 [VERIFIED: apps/api/wrangler.toml; apps/gateway/wrangler.toml; apps/dashboard/wrangler.toml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
4. 为 deploy/rollback 资源归属扩展 readonly live checks，使 selected Worker 和 Pages project 与现有 D1/R2/KV checks 一样可验证；project 不存在必须阻断而非创建。 [VERIFIED: packages/config/src/deployment-target/live-checks.ts; .github/workflows/deploy-dashboard.yml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

### Plan 12-02: Runtime consumer adoption and domain-aware tests

1. API CORS/Better Auth、gateway origins 与 dashboard/auth/blog/movie/comic browser adapters 都读取 Plan 12-01 的 selected public/runtime projection；本地始终走 Gateway `http://localhost:8080`。 [VERIFIED: apps/api/src/config.ts; apps/api/src/lib/auth.ts; apps/gateway/src/index.ts; apps/auth/app/lib/auth-client.ts; apps/blog/app/lib/auth-client.ts; .env.example]
2. 保留 gateway 的 local direct-port proxy 行为作为开发内部实现，但 public contract、文档和 tests 不得把这些 ports 表述为 canonical browser endpoint。 [VERIFIED: apps/gateway/src/index.ts; AGENTS.md]
3. 将 dashboard 的 build env 与 `wrangler.toml` 的 public value 收敛至同一 projection，并将 profile-vs-existing `blog-pages` project mismatch 在 target data 或 deploy consumer 中以明确验证方式修复。 [VERIFIED: apps/dashboard/wrangler.toml; .github/workflows/deploy-dashboard.yml; packages/config/src/deployment-target/target-profiles.ts; .github/workflows/deploy-blog.yml]
4. 增加 API/gateway/auth public config unit tests，以 profile fixture 断言 selected-domain CORS/auth/cookie origin、gateway origin 和 browser config，而不做全仓 literal cleanup。 [VERIFIED: apps/gateway/src/__tests__/routing.test.ts; apps/api/src/config.ts; apps/api/src/lib/auth.ts; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

### Plan 12-03: CI target resolution, preflight and remote mutation wiring

1. 建立一个无 secret 的 resolver job/CLI contract：manual workflow target input 必填；push/schedule 在版本控制中给出 selected target；resolver 校验 target 后输出其唯一 `githubEnvironment` 和 non-secret deployment context。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md; scripts/target-profile.ts]
2. 每个 remote mutation job 通过 resolver output 绑定 GitHub Environment，并只读取固定名称的 secrets；`API_URL`、R2 bucket、Worker/Pages name 等非敏感值来自 profile output，不再误建成另一组 target secrets。 [VERIFIED: packages/config/src/deployment-target/target-profiles.ts; .github/workflows/daily-manga-crawl.yml; .github/workflows/deploy-migrations.yml]
3. 将 CLI preflight 拆成 scope-appropriate validation：local 才读取 operator-owned local env projection；CI/remote 改验 selected workflow/deploy projection、Environment、credential key presence、account identity 和 readonly live resources。 [VERIFIED: scripts/target-profile.ts; packages/config/src/deployment-target/preflight.ts]
4. 接入 API/gateway/Pages deploy、migration、四条 crawler、rollback、API-after-PR 和 monthly cleanup 的实际 remote command 前；CI test-only workflow 不需要绑定真实 target Environment。 [VERIFIED: .github/workflows/deploy-api.yml; .github/workflows/deploy-gateway.yml; .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-auth.yml; .github/workflows/deploy-blog.yml; .github/workflows/deploy-movie.yml; .github/workflows/deploy-comic.yml; .github/workflows/deploy-migrations.yml; .github/workflows/daily-manga-crawl.yml; .github/workflows/daily-movie-crawl.yml; .github/workflows/daily-actor-crawl.yml; .github/workflows/daily-publisher-crawl.yml; .github/workflows/rollback.yml; .github/workflows/deploy-api-after-pr.yml; .github/workflows/monthly-cleanup.yml; .github/workflows/ci.yml]
5. migration command plan 必须固定为 validation/live read -> D1 export -> selected R2 upload -> any repair/apply write；rollback 必须在 profile membership/live validation 后使用 resolved Worker name，Pages branch 仍 exit 1。 [VERIFIED: .github/workflows/deploy-migrations.yml; .github/workflows/rollback.yml; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

## 安全域与边界

- public runtime contract 是 allowlist，不是把环境变量原样转发；只允许 target id、canonical URLs、base paths 及明确审计为公开的 telemetry 值，拒绝 token、client secret、crawler secret、R2 access key 和未注册 `VITE_*` / `NUXT_PUBLIC_*` key。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md; packages/config/src/deployment-target/target-profile.schema.ts]
- `TargetProfile` 和 generated projection 不得保存 secret value；现有 strict schema 已因未知 `value` 字段而拒绝 profile 内的 secret 值。 [VERIFIED: packages/config/src/deployment-target/target-profile.schema.ts; packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts]
- workflow 必须使用 GitHub Environment 选择 secret bundle，禁止 target 名拼接 secret variable 名或 dispatch input 直接决定 Environment。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]
- machine-readable workflow output、preflight log 与 verification evidence 只能记录 target id、Environment、resource name 和 run identity，不能记录 token、secret value 或完整 environment dump。 [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md; scripts/target-profile.ts]
- generated deploy config 应在临时目录创建并在 job 结束时移除；它可含 non-secret resource identity，但不应成为另一个受编辑的 target source。 [ASSUMED]
- local Wrangler profile 和 CI token/account identity 继续严格分离；local scope 设置 `CLOUDFLARE_API_TOKEN` 已被现有 preflight 视为阻断项。 [VERIFIED: packages/config/src/deployment-target/preflight.ts]

## Validation Architecture

### Automated layers

1. **Target projection unit tests:** 对两个以上 in-memory fixture profiles 验证 explicit resolution、legacy alias rejection、public allowlist、app base paths、Worker/Pages deploy projection、profile/project mismatch 和 no-secret serialization。 [ASSUMED]
2. **Preflight unit tests:** 对 local/CI/remote 分别验证 scope-specific projection input、GitHub Environment mismatch、missing credentials、wrong account、missing Worker/Pages/D1/R2/KV resource 和 argv-only readonly checks 全部 blocking。 [VERIFIED: packages/config/src/deployment-target/__tests__/preflight.test.ts; packages/config/src/deployment-target/preflight.ts]
3. **Runtime consumer tests:** 在 gateway routing tests 中注入 profile-derived production origins；在 API config/auth tests 中断言 selected gateway/domain trusted origins、cookie domain 和 local `localhost:8080` path；在 Vite/Nuxt adapter tests 中断言 browser config 不包含 secret-shaped fields。 [VERIFIED: apps/gateway/src/__tests__/routing.test.ts; apps/api/src/config.ts; apps/api/src/lib/auth.ts; apps/auth/nuxt.config.ts; apps/blog/nuxt.config.ts]
4. **Workflow contract tests:** 将 target-to-Environment/standard-secret-name/command argv construction 留在可 import 的 TypeScript helper，测试 `workflow_dispatch`、push、schedule、migration、crawler、rollback 和 Pages-manual cases；YAML 只消费受验证 helper output，不在每个 workflow 重写 identity。 [ASSUMED]
5. **Config smoke:** 用 fixture target 执行 local public config projection 和 production public/deploy projection，验证无需修改源代码即可切换 selected target；不调用 `wrangler --remote`、不读取真实 secret。 [VERIFIED: .planning/REQUIREMENTS.md; .planning/ROADMAP.md]

### Required commands and gates

- Focused baseline available now: `pnpm --filter @starye/config test --run src/deployment-target` passed 7 files / 58 tests during research. [VERIFIED: 2026-07-15 local command output]
- Focused profile validation available now: `pnpm target-profile validate --target starye-org` passed without remote mutation during research. [VERIFIED: 2026-07-15 local command output]
- Phase implementation should retain focused deployment-target tests, then run affected API/gateway/frontend tests, respective type checks/builds, and a no-credential workflow/config test suite before any human credentialed operation. [ASSUMED]
- Any eventual commit must run GitNexus detect-changes and confirm only expected symbols/execution flows are affected; source symbol edits need a prior impact analysis. [VERIFIED: AGENTS.md]

### Phase boundary for smoke

- Phase 12 validates selected-target configuration resolution and fail-closed remote preflight mechanics without real credentials; Phase 13 owns actual local/production crawl -> D1 -> admin -> viewing smoke evidence. [VERIFIED: .planning/ROADMAP.md; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

## Environment Availability

- Node `v24.0.1`, pnpm `10.33.0`, and Wrangler `4.90.1` are installed in the current workspace. [VERIFIED: 2026-07-15 local command output]
- `pnpm target-profile validate --target starye-org` completes locally and reports the tracked profile, local Wrangler profile, CI environment, D1, R2 and KV identity without invoking remote commands. [VERIFIED: 2026-07-15 local command output]
- `@starye/config` already uses Vitest and Phase 11 deployment-target tests can create isolated temp fixtures without operator secret files. [VERIFIED: packages/config/package.json; packages/config/src/deployment-target/__tests__/preflight.test.ts]
- GitNexus was re-indexed successfully during research; its target-preflight execution trace confirms the existing resolver/schema validation chain. [VERIFIED: 2026-07-15 `npx gitnexus analyze`; gitnexus://repo/starye/process/RunTargetPreflight%20%E2%86%92%20FormatTargetProfileIssues]

## Sources and Provenance

- [VERIFIED: .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md] Locked Phase 12 decisions, scope fence and canonical references.
- [VERIFIED: .planning/REQUIREMENTS.md; .planning/ROADMAP.md; .planning/STATE.md] Requirement acceptance, phase ownership and active execution state.
- [VERIFIED: packages/config/src/deployment-target/] Phase 11 schema, resolver, projection, preflight, live-check and test contracts.
- [VERIFIED: scripts/target-profile.ts; package.json; packages/config/package.json] Existing CLI and focused verification entry points.
- [VERIFIED: apps/api/wrangler.toml; apps/gateway/wrangler.toml; apps/dashboard/wrangler.toml; apps/api/src/config.ts; apps/api/src/lib/auth.ts; apps/gateway/src/index.ts; apps/auth/nuxt.config.ts; apps/blog/nuxt.config.ts] Current singleton runtime consumers and browser/API/gateway behavior.
- [VERIFIED: .github/workflows/] Current deploy, migration, crawler, rollback and cleanup workflow identities.
- [VERIFIED: AGENTS.md] Gateway canonical URL, GSD and GitNexus guardrails.

## Research Conclusion

Phase 12 can be planned as three dependency-ordered plans: first make selected-target projections/public contract testable, then adopt it in runtime consumers, then wire every remote mutation workflow through resolver -> GitHub Environment -> preflight/live checks. [VERIFIED: packages/config/src/deployment-target/target-resolver.ts; .planning/phases/12-cloudflare-config-switching/12-CONTEXT.md]

The planner must explicitly close the existing CI-local-preflight incompatibility, Pages/Worker live-resource coverage gap, static Pages project creation, migration backup ordering, dashboard public URL drift and `blog-pages` identity mismatch; otherwise a nominally successful deploy could still be mixed-target or unsafe. [VERIFIED: scripts/target-profile.ts; packages/config/src/deployment-target/live-checks.ts; .github/workflows/deploy-migrations.yml; .github/workflows/deploy-dashboard.yml; .github/workflows/deploy-blog.yml]

---
*Phase: 12-cloudflare-config-switching*
*Research completed: 2026-07-15*
