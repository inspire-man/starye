# Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof - Research

**Researched:** 2026-08-08  
**Domain:** fresh production tuple、D1 playback evidence、Gateway browser proof  
**Confidence:** MEDIUM（仓库集成边界为 HIGH；浏览器/外部 source 的现场行为为 MEDIUM）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** production proof 使用已入库且当前为 `no_source` 或 `source_failed` 的 movie。fresh 约束落在全新的 task/run/attempt/provider tuple，不要求创建新 content identity。
- **D-02:** fresh tuple 必须从已认证 Dashboard repair command 开始。Dashboard 提交 server-owned movie identity、bounded reason 和 target intent，随后轮询同一个 task detail；不使用 API/runner 预创建 task 或旧 task 的新 attempt 代替 Dashboard command。
- **D-03:** 使用服务端 registry 已登记的 selected production target profile。deployment target、Gateway origin、Actions workflow/repository/ref/environment 由 registry 绑定；evidence 只保存非敏感 target 标识。
- **D-04:** dispatch 前检查 signed Dashboard session、registry target、当前 movie disposition 可修复、同电影无 active repair 和 evidence root 可写。dispatch 后必须拿到新的 run/attempt/provider tuple；任一前置条件或 run allocation 缺失都停在 `checkpoint`。

### Playback Source 与 Actual Playback Pass

- **D-05:** Viewer 优先使用 source projection 中第一个 eligible `direct` source；没有 eligible direct 时才走现有受控 TorrServer/Aria2 路径，并把实际 `sourceType` 记录到 evidence。
- **D-06:** actual playback pass 需要在 bounded observation window 内观察到 `canplay`、`playing`，并采集两次 `currentTime`；`currentTimeAfter - currentTimeBefore >= 1s` 且无终态媒体错误才算通过。
- **D-07:** evidence 记录 allowlisted event timeline。`canplay`/`playing` 必须出现；`waiting`、`stalled`、`error` 按实际观察记录，未发生的事件显式表示未观察；终态 `error` 使 playback 失败。
- **D-08:** 沿用 Phase 22 的 bounded source retry：当前 source 最多尝试 2 次，仍失败后切换下一个 eligible source 或受控 TorrServer/Aria2 路径；所有尝试和最终 source 都进入 evidence，达到上限仍失败则为 `checkpoint/failed`。
- **D-09:** Viewer 保持 Player 当前 `autoplay: false`，Playwright 必须通过可见 Play button click 触发播放。导航覆盖 Dashboard task detail -> 同电影 MovieDetail -> source card -> Player -> Play，并记录各段 path 与选中 source。
- **D-10:** 点击后采用媒体事件驱动的 bounded wait；等待 `canplay`/`playing`，记录 `currentTimeBefore`，在限定窗口内等待至少 1 秒推进后记录 `currentTimeAfter`。Play button 不可见、点击无效、播放策略阻断、media error 或超时都保留实际 evidence 并停在 `checkpoint/failed`，不使用 autoplay、`evaluate().play()`、readyState 注入或人工接管绕过。

### Playback Evidence Projection 与 Dashboard 追溯

- **D-11:** D1 保存 task/run/attempt 绑定的 bounded playback summary，同时生成脱敏 JSON/Markdown artifact pair。D1 summary 与 artifact 不替代 receipt/source observation，三层状态继续分开。
- **D-12:** D1 evidence 字段限于 task/run/attempt/provider、content ID、source revision/type、provider/repair/playback 分层状态、Viewer path、allowlisted event observation/time、`currentTimeBefore/After/delta` 和 artifact reference。artifact 保留 allowlisted event timeline；raw source URL、token、cookie、session/signature material、原始 runner JSON 和完整媒体不进入 evidence。
- **D-13:** Dashboard task detail 以 current attempt 为焦点，独立展示 provider、repair/receipt 和 actual playback evidence 区块；展示同一 content ID、source revision、Viewer path 和 artifact reference；旧 attempts 保留为可展开 bounded history，不使用单一 overall success badge。
- **D-14:** JSON 是 canonical evidence source，Markdown 是确定性 projection。文件名绑定 task/run/attempt，写入前执行 schema、redaction 和 JSON/Markdown pair 一致性校验。
- **D-15:** 成功的 playback evidence 只有在 task/run/attempt、content ID 和 source revision 全部匹配时，才更新当前 bounded `playback_verified` projection；不改变 source health/receipt。失败 evidence 只保留在 task/evidence history。

### Browser Evidence Write Boundary

- **D-16:** Playwright/Viewer 通过 server-owned、带 task/run/attempt/content/source revision 绑定的受控 endpoint 提交 bounded terminal summary；API 负责 schema validation、redaction、idempotency、CAS 和 D1 projection。verifier 不直接写 privileged D1，普通用户播放不产生本阶段 proof telemetry。
- **D-17:** evidence endpoint 复用同一 Gateway authenticated session cookie，并额外校验 tuple 绑定；session、nonce、signature material 不保存到 evidence。
- **D-18:** endpoint 接受一次 tuple 绑定的 bounded terminal summary，allowlisted event timeline 作为同一 evidence pair 处理。相同 payload 返回稳定 `duplicate/accepted`，冲突 payload 返回 `conflict`，不覆盖首个已验证事实。

### Artifact Ownership、Retention 与写入顺序

- **D-19:** JSON/Markdown pair 写入本次验证明确传入的 phase/CI evidence root，D1 只保存 artifact reference；本阶段不新增 R2 evidence storage 边界。
- **D-20:** 每个 task/run/attempt/provider tuple 生成不可覆盖的 pair，failed/checkpoint pair 也保留；不覆盖同一 movie 的旧 proof，不生成公开媒体 URL 或签名 URL。
- **D-21:** Dashboard 只展示 D1 bounded summary；JSON/Markdown 原件留在验证 workspace/CI artifact，由验证报告引用，生产应用不直接读取本地文件系统。
- **D-22:** 先构造、redact、校验并写入不可变 artifact pair，再提交 D1 summary/reference。任一步失败都不标记 pass；D1 提交失败时保留 artifact 并记录 `checkpoint`。

### Failure、Retry 与 Late Evidence

- **D-23:** provider、repair/receipt、source 和 playback 是独立事实层。只有同一 fresh tuple 的各层全部满足要求且 playback 达标，才允许标记 production pass；provider/repair 成功但 Viewer 失败时保留前层成功，并将 playback 标为 failed/checkpoint。
- **D-24:** proof-level 失败后只允许使用 Player 内已锁定的 bounded retry；当前 tuple 停止并保留失败 evidence，下一次必须重新分配新的 task/run/attempt/provider tuple，不覆盖或复用当前 proof。
- **D-25:** 缺少 signed session、target、run allocation、evidence output、认证/Viewer 入口，或 tuple/content/source revision 不一致、evidence redaction/persistence 失败时记 `checkpoint`。完整 tuple 在 bounded provider/repair/browser 窗口内终态失败时记 `failed`；两者都保留部分 evidence。
- **D-26:** canonical verifier 必须检查同一 fresh tuple 的 task/run/attempt/provider、content/source revision、validated receipt、Viewer path、allowlisted event timeline、至少 1 秒 `currentTime` 推进、D1/artifact redaction 和 Dashboard trace；全部通过后才是 production pass，人工只复核脱敏摘要。
- **D-27:** 旧 attempt 的 playback evidence 通过 current task/run/attempt、content ID 和 source revision CAS；旧事件可保留为 `late/stale/ignored` 历史，但不更新 current projection。
- **D-28:** 只有对应 repair run 达到允许的 terminal/readback 状态、source revision 仍匹配且处于 bounded evidence window 内，playback evidence 才能影响 current projection。超时或 revision 变化只记 `late/stale`，不自动创建新的 repair attempt。
- **D-29:** duplicate/stale/late/conflict 返回稳定 outcome code 并保留 bounded rejection history；current projection 不变，Dashboard 同时展示当前 evidence 和 rejection history。

### the agent's Discretion

- bounded event timestamp、evidence identity/hash、window duration、API route naming、D1 schema/migration、CAS SQL 和 artifact filename 的具体实现，只要满足 D-01 至 D-29。
- evidence endpoint 的内部 DTO 拆分、错误码 allowlist、Dashboard section 布局、Playwright fixture/trace 组织和 production target 的非敏感 label，只要保持 server-owned、脱敏、可审计和同 tuple 约束。

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 24 scope. Broader user playback telemetry, public artifact hosting, R2 evidence lifecycle, automatic unbounded retries and additional content-type repair templates remain outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVID-01 | 用户可以通过一个独立 fresh production run 完成 Dashboard command -> D1 task/run/attempt -> provider -> validated receipt -> source observation -> Viewer -> 实际播放的同 tuple 验收。 | Fresh tuple allocation、current-attempt projection、source-revision CAS、Gateway 浏览器路径和 canonical verifier；[VERIFIED: `.planning/REQUIREMENTS.md`、现有 crawler task routes] |
| EVID-02 | 用户可以查看脱敏的播放证据摘要；证据至少包含受控的 `canplay`、`playing`、`waiting`、`stalled`、`error` 事件和 `currentTime` 推进结果，不保存完整媒体或签名材料。 | Bounded event schema、artifact pair、redaction rules、visible Play click、`currentTime` delta gate；[CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement] |
| EVID-03 | 用户可以从 Dashboard task detail 追溯到对应 content ID、source revision、repair receipt 和 Viewer evidence；provider success、repair success 与 actual playback 分别呈现。 | Admin task detail DTO、typed Dashboard API、独立 evidence projection 和三层 UI sections；[VERIFIED: `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/dashboard/src/lib/api.ts`, `apps/dashboard/src/views/Crawlers.vue`] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 默认使用中文沟通、分析、验证和交付；[VERIFIED: `AGENTS.md`]
- 改仓库前先走 GSD 工作流；本研究只写 phase artifact，不实施 source change；[VERIFIED: `AGENTS.md`]
- 本地验证必须经 Gateway，canonical URL 固定为 `http://localhost:8080/...`，应用直连端口只是 implementation detail；[VERIFIED: `AGENTS.md`、`scripts/local-task-runner.e2e.ts`]
- 文档只修改 canonical owner，不能把同一说明复制到多个 root document；本阶段输出 owner 是 phase-local `24-RESEARCH.md`；[VERIFIED: `AGENTS.md`、`docs/documentation-ownership.md`]
- 保留无关 dirty files；当前 `AGENTS.md` 与 `CLAUDE.md` 的既有修改不得被覆盖；[VERIFIED: `git status`, `AGENTS.md`]
- 修改函数、类、方法或其他 symbol 前先做 GitNexus impact analysis，并报告 blast radius；[VERIFIED: `AGENTS.md`]
- impact 为 HIGH/CRITICAL 时先告警；[VERIFIED: `AGENTS.md`]
- commit 前运行 GitNexus detect-changes，确认只影响预期 symbols/flows；[VERIFIED: `AGENTS.md`]

## Summary

Phase 24 的实现重点是把“生产修复成功”和“浏览器实际播放成功”接成同一条可核验的 fresh tuple，而不是把任何一层的绿色状态提升为总成功。[VERIFIED: `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/research/PITFALLS.md`]

推荐沿用现有 `repair_players` 控制面：Dashboard 通过已认证 Gateway session 创建新的 task/run/attempt，API 继续由 registry 决定 production target 和 GitHub Actions 参数；修复完成后，Viewer 选择 projection 中第一个 eligible direct source，使用可见 Play click 观察 `canplay`、`playing` 和 `currentTime` 推进，再把脱敏 terminal summary 提交给同 tuple 绑定的 server-owned endpoint。[VERIFIED: `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/dashboard/src/lib/api.ts`, `apps/movie-app/src/views/Player.vue`, `scripts/local-task-runner.e2e.ts`; CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event]

当前代码已有 task/run/attempt、provider association、receipt/source projection、MovieDetail source card 和 Player bounded retry；缺口是 bounded playback evidence 的 schema、D1 summary/reference、CAS/idempotent endpoint、Dashboard 独立证据区块和 fresh production verifier。[VERIFIED: `packages/db/src/schema.ts`, `apps/api/src/domain/movies/source-contract.ts`, `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/dashboard/src/views/Crawlers.vue`, `apps/movie-app/src/views/Player.vue`]

**Primary recommendation:** 新增 tuple-bound playback evidence 领域与受保护写入端点，先生成不可变脱敏 JSON/Markdown pair，再以 CAS 写入 D1 bounded summary；把 provider、receipt/source、playback 作为三个并列投影，由 canonical verifier 在 Gateway fresh browser flow 中收口。[VERIFIED: existing repository/evidence patterns; `CONTEXT.md` D-11 至 D-29]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fresh Dashboard repair command 与 tuple allocation | API / Backend | Browser / Client | API 已拥有认证、固定 template、task/run 创建和 provider dispatch；Dashboard 只提交 allowlisted movie identity/reason/intent。[VERIFIED: `apps/api/src/routes/admin/crawler-tasks/index.ts:1028`, `apps/dashboard/src/lib/api.ts:694`] |
| Provider lifecycle 与 validated receipt | API / Backend | CDN / Static / GitHub Actions boundary | GitHub Actions 执行 crawler，API/D1 接收 signed lifecycle、provider association 和 receipt validation；Provider green 不等于 playback green。[VERIFIED: `apps/api/src/routes/internal/crawler-runs/index.ts`, `packages/db/src/schema.ts:445`; CITED: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event] |
| Source observation/current source revision | Database / Storage | API / Backend | `movie_source_observation` 是 append-only source fact，`movie_source_state` 是 current projection，API 负责脱敏读回和 revision 校验。[VERIFIED: `packages/db/src/schema.ts:187`, `packages/db/src/schema.ts:405`, `apps/api/src/routes/admin/crawler-tasks/index.ts:565`] |
| Playback event collection 与 visible Play interaction | Browser / Client | Frontend Server / API | `Player.vue` 拥有 xgplayer/media event lifecycle；浏览器只提交 bounded terminal summary，API 验证后才产生 D1 projection。[VERIFIED: `apps/movie-app/src/views/Player.vue:572`, CONTEXT D-16; CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event] |
| Playback evidence persistence/CAS/redaction | API / Backend | Database / Storage, CI artifact root | API 是 privileged write boundary，D1 保存 bounded summary/reference，CI/workspace 保存不可变 JSON/Markdown 原件。[VERIFIED: `scripts/phase19-evidence.ts`, `packages/config/src/deployment-target/data-chain-evidence.ts`, CONTEXT D-19 至 D-22] |
| Dashboard trace projection | Browser / Client | API / Backend | Dashboard current attempt 读取 server DTO，并分别渲染 provider、repair/receipt、source 和 playback evidence；不从 GitHub/raw artifact 拼装事实。[VERIFIED: `apps/dashboard/src/views/Crawlers.vue:754`, `apps/dashboard/src/lib/api.ts:386`] |
| Canonical production verifier | Browser / Client + CI | API / Backend | Playwright 负责 Gateway path/media observation，verifier 负责比较 D1 summary、artifact pair、task detail 和 tuple；Verifier 不直接写 privileged D1。[VERIFIED: `apps/dashboard/playwright.config.ts`, `apps/movie-app/playwright.config.ts`, CONTEXT D-16/D-26] |

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm workspace + Turborepo | pnpm `10.33.0`; Turbo `^2.9.6` | monorepo task orchestration | Root `package.json` 已定义 workspace scripts 和 `turbo run`；Phase 24 不新增构建系统。[VERIFIED: `package.json`] |
| TypeScript | `^6.0.2` | shared tuple/evidence DTO、API response、browser collector | API、Dashboard、Movie App、crawler 已以 TypeScript 为主；跨 tier contract 应继续放在现有 shared packages。[VERIFIED: app/package manifests] |
| Hono + hono-openapi + Valibot | Hono `^4.12.14`; hono-openapi `^1.3.0`; Valibot `^1.3.1` | authenticated endpoint、runtime validation、OpenAPI route contract | 项目路由已使用 Hono validator/Valibot，项目 skill 要求新 API 先定义 schema 再挂载 route。[VERIFIED: `apps/api/src/routes/admin/crawler-tasks/index.ts`, `.agents/skills/starye-hono-rpc/SKILL.md`] |
| Cloudflare Workers + D1 + Drizzle | Workers types `^4.20260417.1`; Drizzle ORM `0.45.2`; Wrangler `^4.90.0` | short API request、prepared statements、migration 和 current projection | 现有 repository 以 D1 prepared statements/CAS 管理 crawler control plane；长时 Puppeteer 留在 GitHub Actions。[VERIFIED: `apps/api/src/domain/crawler-tasks/repository.ts`, `packages/db/src/schema.ts`, `.github/workflows/daily-movie-crawl.yml`] |
| Vue + Vue Router | Vue `^3.5.32`; Router `^5.0.4` | Dashboard/MovieDetail/Player projection and navigation | 现有 Dashboard 和 Movie App 已实现 typed state、同电影路由和 source card handoff。[VERIFIED: app manifests, `apps/dashboard/src/views/Crawlers.vue`, `apps/movie-app/src/views/MovieDetail.vue`] |
| xgplayer | project dependency `^3.0.24`（resolved `3.0.24`） | direct/TorrServer player lifecycle、event listeners、bounded retry | 当前 Player 已使用 xgplayer、`autoplay: false`、`canplay`/`playing`/`waiting`/`error`/`timeupdate` 和实例销毁重建；不要在 Phase 24 升级播放器。[VERIFIED: `apps/movie-app/package.json`, `apps/movie-app/src/views/Player.vue`; CITED: https://github.com/bytedance/xgplayer] |
| Playwright Test | project dependency `^1.59.1`（resolved `1.59.1`） | Gateway Dashboard -> Viewer -> visible Play proof | Dashboard/Movie App 已有 Playwright configs、Chromium project、trace/video/screenshot；Phase 24 应复用而不是引入第二浏览器框架。[VERIFIED: `apps/dashboard/package.json`, `apps/movie-app/package.json`, `apps/dashboard/playwright.config.ts`, `apps/movie-app/playwright.config.ts`; CITED: https://playwright.dev/docs/test-assertions] |
| Vitest | project dependency `^4.1.4`（resolved `4.1.4`） | API/domain/UI contract and integration tests | API、Dashboard、Movie App、db/crawler 都已有 Vitest config/test suites。[VERIFIED: package manifests and `rg --files` test inventory] |

### Supporting

| Library / Existing Pattern | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `@starye/api-types` | workspace package | typed Dashboard/Movie API contracts | evidence summary/ref 字段跨 API 与 UI 时扩展已有类型边界。[VERIFIED: `apps/dashboard/src/lib/api.ts`, package manifests] |
| Existing crawler task repository | workspace source | task/run/attempt/lease/CAS/reconciliation | 新 evidence repository method 应复用 current-attempt、source revision、late/stale/conflict 语义，不在 route 中散落 SQL。[VERIFIED: `apps/api/src/domain/crawler-tasks/repository.ts`] |
| Existing redaction/evidence helpers | workspace source | canonical JSON、deterministic Markdown、safe-field scan、evidence root | 复用 `scripts/phase19-evidence.ts` 与 `packages/config/src/deployment-target/data-chain-evidence.ts` 的 pair validation/redaction 形状。[VERIFIED: source files] |
| Existing `playbackSources` resolver | workspace source | direct-first source eligibility and magnet/TorrServer split | Viewer/source card 选择时使用已有分类与 eligibility predicate，不直接按 `players[0]` 或 URL 字符串猜测。[VERIFIED: `apps/movie-app/src/utils/playbackSources.ts`, `apps/movie-app/src/views/Player.vue`] |
| Gateway session cookie | existing runtime | same-origin auth for Dashboard, MovieDetail, Player and evidence endpoint | Playwright 和 local runner 所有请求统一经 `http://localhost:8080` 并复用同一 cookie；[VERIFIED: `scripts/local-task-runner.e2e.ts`, `AGENTS.md`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing xgplayer + native media events | HLS.js/Shaka/another player | 当前 source contract 是 direct/magnet/TorrServer；引入新 engine 会扩大 source/codec/fixture 范围，且 Context 已锁定现有 Player。[VERIFIED: CONTEXT D-05/D-08, `Player.vue`] |
| D1 bounded summary + CI artifact pair | R2 telemetry store or public artifact hosting | 超出本阶段 R2/evidence lifecycle 边界，且 Dashboard 只应显示 bounded summary。[VERIFIED: CONTEXT D-19 至 D-21, `.planning/research/STACK.md`] |
| Existing Playwright Test | Cypress or second browser framework | 分散现有 Gateway/auth/config/artifact pattern；当前两个 app 已有 Playwright project。[VERIFIED: Playwright configs, CONTEXT D-09] |
| Existing task/run/attempt control plane | Queue/DO/BullMQ/Temporal | Phase 24 只增加 playback proof write boundary；另起 orchestration 会改变 Phase 23 已验证 provider/reconciliation 责任。[VERIFIED: `repository.ts`, `.github/workflows/daily-movie-crawl.yml`] |

**Installation:** No new external package is planned. Keep the existing lockfile and use package-local commands; [VERIFIED: CONTEXT D-03/D-16/D-19, package manifests].

**Version verification:** The current project resolutions were checked with `node --version` (`v24.0.1`), `pnpm --version` (`10.33.0`), package-local Playwright (`1.59.1`) and xgplayer resolution (`3.0.24`). Registry queries observed newer releases (`xgplayer 3.0.26`, `@playwright/test 1.62.1`, `vitest 4.1.10`), but no upgrade is part of this phase; [VERIFIED: npm registry query + package manifests].

## Package Legitimacy Audit

No package installation is planned for this phase, so the package legitimacy gate is not applicable. Existing package names and resolved versions are repository facts, not new dependency recommendations; [VERIFIED: package manifests and lockfile resolution].

## Architecture Patterns

### System Architecture Diagram

```text
Authenticated Dashboard click
        |
        v
Gateway session -> API repair_players command
        |
        +--> preflight: signed session + target registry + repairable movie
        |       +--> missing precondition -> checkpoint artifact, stop
        |       +--> valid -> D1 creates fresh task/run/attempt
        |
        v
Provider association -> GitHub Actions repair -> signed callbacks
        |
        v
validated receipt + movie_source_observation + movie_source_state revision
        |
        +--> provider / repair / source projections remain separate
        |
        v
Dashboard task detail -> same-movie MovieDetail -> eligible direct source card
        |                                              |
        |                                              +--> no direct -> TorrServer/Aria2 path
        v
Player visible Play click -> canplay -> playing -> currentTime before/after
        |
        +--> error/timeout/retry cap -> failed or checkpoint evidence
        |
        v
redact + validate -> immutable JSON/Markdown pair in phase/CI evidence root
        |
        v
tuple-bound evidence endpoint -> schema/CAS/idempotency -> D1 summary/reference
        |
        v
canonical verifier compares Dashboard + D1 + artifact + live Viewer
        |
        +--> all gates pass: production pass
        +--> precondition/binding/output gap: checkpoint
        +--> bounded terminal browser/provider failure: failed
```

### Recommended Project Structure

```text
packages/db/src/schema.ts                         # playback summary + bounded rejection tables
packages/db/drizzle/00xx_playback_evidence.sql    # generated D1 migration
apps/api/src/schemas/playback-evidence.ts         # Valibot input/output schema
apps/api/src/domain/playback-evidence/            # identity, redaction, CAS repository
apps/api/src/routes/admin/crawler-tasks/index.ts  # command/detail integration boundary
apps/api/src/routes/admin/crawler-tasks/playback-evidence.ts  # optional focused route module
apps/api/src/index.ts                              # route mount/type inference
apps/dashboard/src/lib/api.ts                      # typed summary/reference DTO
apps/dashboard/src/views/Crawlers.vue              # independent playback evidence section
apps/movie-app/src/views/MovieDetail.vue           # traceable source/revision handoff
apps/movie-app/src/views/Player.vue                # event collector and visible proof markers
scripts/phase24-evidence.ts                        # canonical JSON/Markdown builder/verifier
scripts/phase24-production-proof.ts                # fresh Gateway/production Playwright flow
apps/api/src/**/__tests__/playback-evidence*.test.ts
apps/dashboard/src/views/__test__/Crawlers.test.ts
apps/movie-app/src/views/__tests__/Player.security.test.ts
```

The exact route module split and migration number are discretionary; the ownership boundaries are prescribed by existing files and project skills. New schema work must update Drizzle relations when applicable, generate a migration, apply local D1, rebuild API types, and run API type-check; [VERIFIED: `.agents/skills/starye-db-migration/SKILL.md`, `.agents/skills/starye-hono-rpc/SKILL.md`].

### Pattern 1: Tuple-Bound Terminal Evidence

**What:** Treat `runId`/`attemptNumber` as the application proof identity, then require `taskId`, provider label, `contentId`, and `sourceRevision` to match the server's current facts before accepting playback. Keep `accepted` summary and rejection history separate from crawler receipt/source observation; [VERIFIED: CONTEXT D-15/D-18/D-27/D-29, `repository.ts` CAS/reconciliation patterns].

**When to use:** Every browser proof submission. The endpoint should first authenticate the Gateway session, load the task/run/current attempt, validate the repair terminal/readback state, compare receipt identity and source revision, then perform one repository transaction.

**Example:**

```typescript
const PlaybackEvidenceInput = v.strictObject({
  taskId: SafeId,
  runId: SafeId,
  attemptNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  provider: v.literal('github-actions'),
  contentId: SafeId,
  sourceRevision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sourceType: v.picklist(['direct', 'TorrServer']),
  viewerPath: v.pipe(v.string(), v.regex(/^\/(dashboard|movie)\//u)),
  events: AllowlistedPlaybackEvents,
  currentTimeBefore: NonNegativeFinite,
  currentTimeAfter: NonNegativeFinite,
  artifact: ArtifactReferenceSchema,
})

// Repository returns one of: accepted, duplicate, conflict, stale, late, checkpoint.
const outcome = await playbackEvidenceRepository.acceptTerminal({
  sessionUserId: user.id,
  input: v.parse(PlaybackEvidenceInput, body),
})
return c.json(outcome.body, outcome.status)
```

The route must never accept raw source URL, cookies, signed query, authorization material, raw runner JSON, or media bytes; [VERIFIED: CONTEXT D-12/D-16/D-17, existing route redaction tests].

### Pattern 2: Allowlisted Event Timeline and Progress Gate

**What:** Store one bounded observation record for each required event. Required events are `canplay` and `playing`; `waiting`, `stalled`, and `error` are explicit `{ observed: boolean, observedAt?: number, offsetMs?: number }` entries. Playback pass is a pure predicate: required events observed, no terminal error, finite `currentTime` values, and delta at least one second; [VERIFIED: CONTEXT D-06/D-07, `source-contract.ts:240`; CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event].

**Example:**

```typescript
const EventObservation = v.strictObject({
  observed: v.boolean(),
  offsetMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(120_000))),
})

const AllowlistedPlaybackEvents = v.strictObject({
  canplay: EventObservation,
  playing: EventObservation,
  waiting: EventObservation,
  stalled: EventObservation,
  error: EventObservation,
})

function playbackPass(input: PlaybackFacts): boolean {
  return input.events.canplay.observed
    && input.events.playing.observed
    && !input.events.error.observed
    && Number.isFinite(input.currentTimeBefore)
    && Number.isFinite(input.currentTimeAfter)
    && input.currentTimeAfter - input.currentTimeBefore >= 1
}
```

Use event timestamps relative to proof start or a bounded epoch representation; do not accept unbounded client timestamps as ordering authority. `canplay` means enough data is available to start, while `playing` means playback has started or resumed; `waiting` and `stalled` are diagnostic signals, not success; [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event, https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event, https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event].

### Pattern 3: Artifact-First Canonical Pair

**What:** Build a bounded object, redact it, validate schema and forbidden-field scans, serialize deterministic JSON, render deterministic Markdown from that JSON, compare the pair, write both under an explicitly passed evidence root, then submit only artifact references/hash to D1; [VERIFIED: `scripts/phase19-evidence.ts:50-93`, `packages/config/src/deployment-target/data-chain-evidence.ts:894-903`, CONTEXT D-14/D-22].

**When to use:** Both pass and failed/checkpoint outcomes. A D1 write failure must leave the pair available and produce checkpoint evidence rather than deleting or overwriting the artifact.

**Required safe fields:** `schemaVersion`, `status`, tuple identifiers, non-sensitive target label, content ID, source revision/type, separate provider/repair/source/playback statuses, canonical route paths, event observations/times, currentTime before/after/delta, artifact stem/hash, and bounded rejection outcome; [VERIFIED: CONTEXT D-12/D-20/D-21].

**Forbidden-field scan:** assert absence of raw source URL, token, cookie, Authorization header, session/nonce/signature material, provider URL, workflow command, raw runner JSON, exception stack, response HTML and media bytes; [VERIFIED: `scripts/local-task-runner.e2e.ts:366-372`, existing readiness redaction tests].

### Pattern 4: Visible UI Flow, Event-Driven Wait

**What:** Use one authenticated browser context. Start at Dashboard task detail, follow the existing same-movie link to MovieDetail, select the first eligible direct source card, enter Player, click the visible Play control, observe explicit app markers for allowlisted media events and currentTime samples, then submit evidence. If no direct source exists, record the existing TorrServer/Aria2 route and source type; [VERIFIED: CONTEXT D-05/D-09/D-10, `Crawlers.vue`, `MovieDetail.vue`, `Player.vue`].

**Example:**

```typescript
await page.goto('/dashboard/crawlers?taskId=' + taskId)
await expect(page.locator('[data-task-detail]')).toBeVisible()
await page.getByRole('link', { name: /查看影片|MovieDetail/u }).click()
await page.locator('[data-source-card][data-source-type="direct"]').first().getByRole('button', { name: /播放|Play/u }).click()
await expect(page.getByRole('button', { name: /播放|Play/u })).toBeVisible()
await page.getByRole('button', { name: /播放|Play/u }).click()
await expect(page.locator('[data-playback-event="playing"]')).toHaveAttribute('data-observed', 'true', { timeout: PLAYBACK_WINDOW_MS })
await expect(page.locator('[data-playback-current-time-delta]')).toHaveText(/^[1-9]\d*(\.\d+)?$/u)
```

The selector names above are recommended proof markers, not existing selectors; implementation must add stable markers without allowing them to synthesize media state. The click must be visible and user-like; do not call `evaluate(() => media.play())`, enable autoplay, inject `readyState`, or use a screenshot as the terminal assertion; [VERIFIED: CONTEXT D-09/D-10, existing Playwright config and Player behavior].

### Pattern 5: Independent UI Projections

**What:** Dashboard current attempt should render four independently readable facts: provider lifecycle, repair/receipt validation, source readback/revision, and actual playback evidence/outcome. MovieDetail should expose content ID, readiness/source revision and playback status; Player should expose selected source type and bounded attempt/error state. Never derive a single `overallSuccess` from provider status or receipt status; [VERIFIED: CONTEXT D-13/D-15/D-23, `Crawlers.vue`, `MovieDetail.vue`].

**History rule:** Keep old attempts and evidence rejections expandable and bounded. A stale/late/conflict submission can appear in history with outcome code, but must not replace the current evidence projection; [VERIFIED: CONTEXT D-27/D-29, `repository.ts` reconciliation outcomes].

### Anti-Patterns to Avoid

- **Receipt-as-playback:** receipt validates content identity/source readback, not browser playback; require browser events and progress.[VERIFIED: `receipt-validation.ts`, `source-contract.ts`, `.planning/research/PITFALLS.md`]
- **Direct-origin proof:** running the app or API on `5173`/`3001` can bypass Gateway routing/session behavior; run canonical proof through `http://localhost:8080`.[VERIFIED: `AGENTS.md`, Playwright configs]
- **Default `players[0]`:** use existing eligibility/source resolver and direct-first policy; scores and sort order do not prove health.[VERIFIED: `playbackSources.ts`, CONTEXT D-05]
- **Magnet-as-direct:** magnet is download/TorrServer/Aria2 input in the current Player, not a browser direct URL.[VERIFIED: `Player.vue`, CONTEXT D-05; CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement]
- **Client-authoritative write:** browser telemetry must submit bounded DTO to API; it must not write D1 or alter receipt/source state directly.[VERIFIED: CONTEXT D-16/D-17]
- **Artifact overwrite:** tuple-bound files are immutable; use unique stem/hash and retain failed/checkpoint pairs.[VERIFIED: CONTEXT D-14/D-20/D-22]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API input/output validation | ad-hoc `typeof` checks scattered in route | Valibot schemas + existing Hono validator pattern | Existing route boundary already validates closed repair input; one schema also defines safe DTO shape.[VERIFIED: `apps/api/src/routes/admin/crawler-tasks/index.ts`, `.agents/skills/starye-hono-rpc/SKILL.md`] |
| Tuple idempotency/CAS | read-then-write route logic | `createCrawlerTaskRepository` pattern plus one D1 transaction/prepared statements | Existing repository already handles attempt uniqueness, sequence, stale/late/duplicate/conflict and source revision CAS.[VERIFIED: `repository.ts`, `source-reconciliation.ts`] |
| Browser media engine | a new custom `<video>`/HLS abstraction | existing xgplayer + `playbackSources.ts` | Player lifecycle, source classification, retry and TorrServer/Aria2 routing already exist.[VERIFIED: `Player.vue`, `playbackSources.ts`; CITED: https://github.com/bytedance/xgplayer] |
| Browser automation | a second E2E framework or arbitrary sleeps | existing Playwright Test with event-driven assertions | Existing app configs already provide Chromium, artifacts and bounded timeout; MDN event semantics require event observations rather than page-load heuristics.[VERIFIED: Playwright configs; CITED: https://playwright.dev/docs/test-assertions] |
| Evidence serialization/redaction | hand-written JSON/Markdown in each test | existing `phase19-evidence` and `data-chain-evidence` helpers, extended for Phase 24 | Existing helpers validate deterministic pair output and forbidden safe-field leakage.[VERIFIED: source files] |
| Source eligibility | URL-string checks inside proof runner | existing `classifyPlaybackSource`/eligibility resolver and server source projection | Keeps direct/magnet/TorrServer and inactive/unverified/failed semantics aligned across MovieDetail and Player.[VERIFIED: `playbackSources.ts`, `source-contract.ts`] |

**Key insight:** Phase 24 is an evidence/projection problem, not a media-platform problem. The expensive edge cases are identity binding, late evidence, redaction, browser event timing and failure classification; existing control-plane, player and evidence utilities already own those lower-level mechanisms.[VERIFIED: repository and prior research files]

## Common Pitfalls

### Pitfall 1: Provider or receipt green is promoted to playback pass

**What goes wrong:** Dashboard shows provider success or validated receipt while the Viewer has no eligible direct source, emits an error, or never advances time.[VERIFIED: `.planning/research/PITFALLS.md`, `source-contract.ts`]

**Why it happens:** Current provider/receipt/source projections are separate, and `derivePlaybackProof` only exposes a minimal `playing + positive currentTime` public projection.[VERIFIED: `apps/api/src/domain/movies/source-contract.ts:240-256`]

**How to avoid:** Keep separate provider, repair/receipt, source and playback sections; production pass requires every layer plus fresh tuple/source revision match.[VERIFIED: CONTEXT D-15/D-23/D-26]

**Warning signs:** `status === succeeded` used as sole assertion, `players.length > 0` treated as ready, or Dashboard renders one overall success badge.[VERIFIED: `.planning/research/PITFALLS.md`, `Crawlers.vue`]

### Pitfall 2: Browser proof bypasses visible interaction

**What goes wrong:** A test records an apparently valid `playing`/time value without proving that the user-facing Play button and selected source work.[VERIFIED: CONTEXT D-09/D-10]

**Why it happens:** autoplay, `evaluate().play()`, readyState injection, or direct app-port navigation avoids the actual Gateway/Viewer path.[VERIFIED: CONTEXT D-10, `AGENTS.md`]

**How to avoid:** Add stable app-owned event/currentTime markers, click visible Play with Playwright, wait on those markers, and keep autoplay disabled.[VERIFIED: `Player.vue`, existing Playwright configs]

**Warning signs:** no click in trace, direct `3001`/`5173` URL, `waitForTimeout` as terminal condition, or only screenshot/page-load assertions.[VERIFIED: `.planning/research/PITFALLS.md`]

### Pitfall 3: Stale or late evidence mutates current projection

**What goes wrong:** A prior attempt reports success after a newer repair changed source revision and incorrectly turns current MovieDetail into `playback_verified`.[VERIFIED: CONTEXT D-27/D-28]

**Why it happens:** Endpoint checks only `contentId` or only `taskId`, without matching current run/attempt, receipt revision and source state revision in the write transaction.[VERIFIED: existing `source-reconciliation.ts` CAS boundary]

**How to avoid:** Require all tuple fields, current/latest run, allowed terminal/readback state and exact source revision; return `stale`/`late`/`ignored` history without current update.[VERIFIED: CONTEXT D-27-D-29]

**Warning signs:** evidence endpoint accepts old `runId`, source revision mismatch is only logged, or retry creates a new attempt but old endpoint can still update public readiness.[VERIFIED: existing reconciliation tests and route projections]

### Pitfall 4: Duplicate and conflict submissions overwrite first fact

**What goes wrong:** The same browser/artifact retry creates two effective terminal facts, or a different payload silently replaces the first.[VERIFIED: CONTEXT D-18/D-29]

**Why it happens:** No unique evidence identity/hash or no append-only rejection history.[ASSUMED: exact schema is discretionary]

**How to avoid:** Hash canonical redacted JSON; unique accepted row by tuple; identical hash returns stable `duplicate`, differing hash returns `conflict`, and both are recorded in bounded rejection history.[VERIFIED: CONTEXT D-18/D-29; ASSUMED: exact table split]

**Warning signs:** second POST returns generic 200 with different summary, current artifact reference changes, or duplicate outcome has no persisted record.[VERIFIED: CONTEXT D-18/D-29]

### Pitfall 5: Evidence leaks source/signature material

**What goes wrong:** raw source URL, signed query, cookie, Authorization header, runner payload, response HTML or media bytes land in D1, Dashboard or CI artifact.[VERIFIED: CONTEXT D-12/D-17/D-21, existing redaction tests]

**Why it happens:** collecting browser/network debug objects wholesale and redacting only at the final Dashboard render.[VERIFIED: `scripts/local-task-runner.e2e.ts:366-372`, `.planning/research/PITFALLS.md`]

**How to avoid:** Accept a closed DTO, redact before artifact serialization, scan JSON and Markdown, and project only safe fields at both endpoint and Dashboard boundaries.[VERIFIED: existing evidence helpers and CONTEXT D-12/D-22]

**Warning signs:** fields named `sourceUrl`, `cookie`, `token`, `signature`, `authorization`, `rawRunner`, `exception`, `workflow` or provider URL appear in serialized evidence.[VERIFIED: existing redaction tests]

### Pitfall 6: Production preconditions are converted into failed playback

**What goes wrong:** Missing signed session, selected target, fresh run allocation, writable evidence root or viewer entry is reported as a media failure, obscuring the actual checkpoint.[VERIFIED: CONTEXT D-04/D-25]

**Why it happens:** The verifier has no explicit preflight result vocabulary and starts browser steps with incomplete identity.[VERIFIED: `.planning/STATE.md`, `.planning/research/PITFALLS.md`]

**How to avoid:** Run preflight before dispatch and before browser navigation; create a checkpoint artifact with missing fields and stop without allocating a replacement tuple.[VERIFIED: CONTEXT D-04/D-25]

**Warning signs:** evidence has no fresh task/run/attempt/provider, no artifact reference, or an old Phase 13 carrier is used to fill a missing step.[VERIFIED: CONTEXT D-20/D-25, `.planning/ROADMAP.md`]

### Pitfall 7: Gateway and cache boundaries are skipped

**What goes wrong:** Local proof passes through an app dev port but does not exercise Gateway route, auth cookie, or cache invalidation used by the canonical surface.[VERIFIED: `AGENTS.md`, prior research]

**Why it happens:** Existing Playwright configs default Dashboard to `http://localhost:5173`, while project instructions require Gateway as canonical proof origin.[VERIFIED: `apps/dashboard/playwright.config.ts`, `AGENTS.md`]

**How to avoid:** Phase 24 runner must override base URL/path to `http://localhost:8080`, avoid starting a competing direct proof server, and assert fresh task detail/source revision after repair.[VERIFIED: CONTEXT D-09, `scripts/local-task-runner.e2e.ts`]

**Warning signs:** test output cites `5173`/`3001` as proof URL, or MovieDetail still shows previous source revision after Dashboard readback.[VERIFIED: `AGENTS.md`, `.planning/research/PITFALLS.md`]

## Code Examples

Verified patterns from official sources and current repository:

### Media event meanings

```text
loadedmetadata -> metadata available; not actual playback
canplay        -> enough data to begin; readiness signal
playing        -> playback started/resumed; actual-start signal
waiting        -> playback paused for missing data; diagnostic
stalled        -> user agent is trying to fetch data but data is not arriving; diagnostic
error          -> media resource failed; terminal failure for this proof
currentTime    -> sample before and after playing; delta proves progress
```

The event meanings are from MDN; the phase's one-second delta and required event set are locked project decisions.[CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement, https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event; VERIFIED: CONTEXT D-06/D-07]

### Existing Player lifecycle to extend

```typescript
player = new Player({
  id: 'mse',
  url: sourceUrl,
  autoplay: false,
})

player.on('canplay', () => markPlaybackEvent('canplay'))
player.on('playing', () => markPlaybackEvent('playing'))
player.on('waiting', () => markPlaybackEvent('waiting'))
player.on('stalled', () => markPlaybackEvent('stalled'))
player.on('error', () => markPlaybackEvent('error'))
player.on('timeupdate', () => markCurrentTime(player.currentTime))
```

This mirrors the current event hooks and preserves the visible Play/bounded retry boundary; use the actual xgplayer API surface already present in `Player.vue` rather than inventing a second player instance.[VERIFIED: `apps/movie-app/src/views/Player.vue:572-647`; CITED: https://github.com/bytedance/xgplayer]

### Artifact pair shape

```json
{
  "schemaVersion": 1,
  "kind": "phase24-playback-evidence",
  "status": "passed",
  "tuple": {
    "taskId": "TASK_ID",
    "runId": "RUN_ID",
    "attemptNumber": 1,
    "provider": "github-actions"
  },
  "content": { "contentId": "CONTENT_ID", "sourceRevision": 7, "sourceType": "direct" },
  "layers": {
    "provider": "success",
    "repair": "validated",
    "source": "ready",
    "playback": "playback_verified"
  },
  "viewer": { "paths": ["/dashboard/crawlers/TASK_ID", "/movie/MOVIE_CODE", "/movie/MOVIE_CODE/player"] },
  "events": {
    "canplay": { "observed": true, "offsetMs": 1200 },
    "playing": { "observed": true, "offsetMs": 1800 },
    "waiting": { "observed": false },
    "stalled": { "observed": false },
    "error": { "observed": false }
  },
  "currentTime": { "before": 0, "after": 1.4, "delta": 1.4 },
  "artifact": { "stem": "TASK_ID-RUN_ID-A1", "sha256": "ARTIFACT_HASH" }
}
```

This is a planning shape, not a locked final field list; exact window, hash and filename remain agent discretion. It demonstrates the required redacted fields and the absence of raw media/source/signature material.[VERIFIED: CONTEXT D-12/D-14/D-20; ASSUMED: exact schema field names]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| metadata receipt or `players.length > 0` implied playable | separate metadata, source readiness and browser playback projections | Phase 20-22 baseline | Phase 24 must never collapse layers; [VERIFIED: `.planning/research/FEATURES.md`, `source-contract.ts`] |
| page load/screenshot/HTTP 200 implied playback | visible Play + `canplay`/`playing` + currentTime delta | Phase 22 baseline, Phase 24 gate | Browser evidence now proves the final user-visible boundary; [VERIFIED: CONTEXT D-06/D-10/D-26; CITED: MDN URLs above] |
| raw or hand-built evidence output | canonical JSON + deterministic Markdown pair with redaction | Phase 19 evidence pattern | Reproducible artifact references and safe-field scans; [VERIFIED: `scripts/phase19-evidence.ts`] |
| one current status and implicit retry | task/run/attempt/provider association with CAS and bounded outcomes | v1.3/Phase 23 | Late/duplicate/conflict results remain auditable without rewriting current facts; [VERIFIED: `repository.ts`, `packages/db/src/schema.ts`] |

**Deprecated/outdated:**

- Reusing a Phase 13 carrier as a Phase 24 production pass: it is frozen historical context and does not prove the current crawler/source/player tuple; [VERIFIED: CONTEXT D-01/D-24, `.planning/ROADMAP.md`].
- Treating `canplay` alone as terminal success: MDN describes it as readiness to begin, so the project requires `playing` and one-second progress as well; [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event; VERIFIED: CONTEXT D-06].
- Saving full media/debug/network material in the product evidence model: Phase 24 explicitly limits D1 to bounded summary/reference and artifacts to redacted allowlisted fields; [VERIFIED: CONTEXT D-12/D-19/D-21].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The endpoint can be named under `/api/admin/crawler-tasks/:taskId/runs/:runId/playback-evidence` while retaining the existing admin session/permission boundary. | Architecture Patterns | Route naming or auth ownership may require a separate internal route; planner must confirm mount and permission middleware before locking the plan. |
| A2 | One accepted evidence summary per application run is sufficient, with duplicate/conflict/stale/late submissions retained in a bounded rejection history. | Common Pitfalls / data model | A different evidence retry policy would change unique indexes and current projection semantics. |
| A3 | Stable proof markers can be added to Player/MovieDetail without exposing source URL or producing client-authoritative proof state. | Browser pattern | Tests may need an in-memory collector or API-backed marker contract if DOM markers conflict with UI boundaries. |
| A4 | The selected production target has at least one eligible direct source after repair, or the controlled TorrServer/Aria2 path is available. | Environment / production proof | Without one playable path, Phase 24 can produce honest failed/checkpoint evidence but not a production pass. |
| A5 | Artifact references can be represented as non-sensitive stem/hash values while raw files remain in the explicitly supplied phase/CI evidence root. | Artifact pattern | A CI retention or upload contract may need to be fixed before implementation; do not add public hosting in this phase. |

## Open Questions

1. **Which selected production target, signed Dashboard session, fresh movie disposition and evidence root will be used?**
   - What we know: the target must come from server registry, the movie must currently be repairable, and the proof needs a fresh tuple; [VERIFIED: CONTEXT D-01-D-04, `.planning/STATE.md`].
   - What's unclear: live target label, session availability, evidence root path and whether the selected movie yields direct or fallback playback; [VERIFIED: `.planning/STATE.md` records these as prerequisites].
   - Recommendation: make these explicit preflight inputs; missing values produce checkpoint artifacts, never an inferred target or reused Phase 13 carrier; [VERIFIED: CONTEXT D-04/D-25].

2. **Does the production source support the browser's actual media request from the Gateway/Viewer origin?**
   - What we know: HTTP/Range probes are only source filters, and media events are the final proof; [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests, https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement].
   - What's unclear: source-specific CORS, Referer/Origin, signed URL lifetime, Range behavior and codec support; [MEDIUM: prior research identified these as environment-dependent].
   - Recommendation: let the fresh run observe the real source; record only bounded failure class and keep source material out of evidence; [VERIFIED: CONTEXT D-05-D-07/D-12].

3. **Should current `playback_verified` be stored in a dedicated current table or an existing bounded state row?**
   - What we know: current `movie_source_state` has no playback columns, and current public `PlaybackProjection` is derived from minimal evidence input; [VERIFIED: `packages/db/src/schema.ts:187`, `apps/api/src/domain/movies/source-contract.ts:80-99`].
   - What's unclear: whether a new `crawler_playback_evidence` current row plus rejection table or an extension of `movie_source_state` gives the clearest query/migration boundary; [ASSUMED: schema choice is discretionary per CONTEXT].
   - Recommendation: keep immutable evidence rows keyed by run/attempt and expose a separate bounded current projection keyed by content/source revision; do not overload receipt/source observation columns; [VERIFIED: CONTEXT D-11/D-15/D-27].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | API/scripts/Playwright evidence helpers | ✓ | `v24.0.1` | —; [VERIFIED: `node --version`] |
| pnpm | workspace tests/type-check/migrations | ✓ | `10.33.0` | —; [VERIFIED: `pnpm --version`, `package.json`] |
| Wrangler | local D1 migration/Worker checks | ✓ | `4.90.1` | —; [VERIFIED: `pnpm exec wrangler --version`] |
| Gateway | canonical local Dashboard/Movie/API flow | ✓ | port `8080` listening | —; [VERIFIED: `Test-NetConnection localhost:8080`, `AGENTS.md`] |
| `@playwright/test` | Dashboard/Movie browser proof | ✓ package-local | `1.59.1` | run via `pnpm --filter dashboard exec playwright` or Movie App package; [VERIFIED: package-local CLI] |
| Chromium for Playwright | visible Play proof | ? | browser installation not independently confirmed in this research | planner must run package-local `playwright install chromium` or stop at checkpoint; [VERIFIED: package script, environment probe] |
| GitHub Actions selected target/session | fresh production provider proof | ? | server registry/live credentials | no production pass; produce checkpoint and use local contract proof only; [VERIFIED: `.planning/STATE.md`, CONTEXT D-03/D-04] |
| Direct/TorrServer/Aria2 playable source | actual media proof | ? | selected content/source dependent | bounded failed/checkpoint evidence; do not synthesize playback; [VERIFIED: CONTEXT D-05-D-10] |

**Missing dependencies with no fallback:** None for local contract implementation. A missing selected production target/session or missing playable source blocks the production pass, even though schema/unit tests can proceed; [VERIFIED: environment audit, CONTEXT D-25].

**Missing dependencies with fallback:** Chromium has a package-local install path; production credentials/source have a checkpoint-only fallback, not a pass fallback; [VERIFIED: package manifests, CONTEXT D-04/D-25].

## Phase-Specific Verification Strategy

### Contract and persistence tests

| Area | Focused tests / command | Required assertions |
|------|-------------------------|----------------------|
| Evidence schema/redaction | `pnpm --filter api test -- --run src/domain/playback-evidence/__tests__` | closed DTO, allowlisted events only, finite bounded timestamps, no raw URL/cookie/token/signature/runner/media fields; [VERIFIED: existing API test conventions] |
| Evidence repository/CAS | `pnpm --filter api test -- --run src/domain/crawler-tasks/__tests__/repository.test.ts` plus new evidence repository test | accepted once; identical replay `duplicate`; differing replay `conflict`; old attempt/revision `stale/late`; current projection unchanged on rejection; [VERIFIED: existing repository outcome vocabulary, CONTEXT D-18/D-29] |
| Admin endpoint | `pnpm --filter api test -- --run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | same session required; tuple/current attempt/content/source revision checked; provider/receipt/source/playback fields remain separate; [VERIFIED: existing route test path and route] |
| D1 migration | `pnpm --filter @starye/db drizzle-kit generate` then `pnpm --filter @starye/db test -- --run src/__tests__` | migration applies locally, unique tuple identity works, rejection history is bounded/queryable, relations/types remain valid; [VERIFIED: `.agents/skills/starye-db-migration/SKILL.md`] |

### UI and browser tests

| Area | Focused tests / command | Required assertions |
|------|-------------------------|---------------------|
| Dashboard | `pnpm --filter dashboard test -- --run src/views/__test__/Crawlers.test.ts` | current attempt is the focus; provider, receipt/repair, source revision, playback evidence and rejection history are separate sections; no overall success badge; [VERIFIED: existing test file and `Crawlers.vue`] |
| MovieDetail | `pnpm --filter @starye/movie-app test -- --run src/views/__tests__/MovieDetail.dom-contract.test.ts` | same content ID/source revision, visible source type, readiness/playback projection, canonical path to Player; [VERIFIED: existing DOM contract test] |
| Player security/semantics | `pnpm --filter @starye/movie-app test -- --run src/views/__tests__/Player.security.test.ts src/utils/__tests__/playbackSources.test.ts` | direct-first selection, magnet not treated as direct, retry cap, error/waiting handling, visible proof markers do not leak source material; [VERIFIED: existing test files] |
| Fresh browser flow | `BASE_URL=http://localhost:8080 pnpm --filter dashboard test:e2e -- --project=chromium` plus Movie App proof spec or a dedicated `scripts/phase24-production-proof.ts` | one authenticated browser context, Dashboard command/task detail -> MovieDetail -> source card -> Player -> visible Play -> event/time evidence; use fresh IDs and no Phase 13 carrier; [VERIFIED: Playwright configs, CONTEXT D-09/D-10/D-26] |

### Canonical verifier gate

The verifier should report a machine-readable evidence matrix with one row per required surface: Dashboard command, fresh task/run/attempt, provider association/conclusion, validated receipt, source observation/readback/revision, MovieDetail path/content ID, Player/source type, required media events, currentTime delta, artifact pair/redaction, D1 summary and Dashboard trace. A row may be `pass`, `failed`, or `checkpoint`; absence or mismatch must remain visible as a gap and must not be inferred from summary or screenshot; [VERIFIED: CONTEXT D-25/D-26, `.planning/research/PITFALLS.md`].

Minimum pass predicate:

```text
fresh tuple allocated from Dashboard command
AND provider association matches task/run/attempt
AND terminal receipt is validated
AND receipt contentId == Viewer contentId
AND receipt sourceRevision == source readback sourceRevision
AND selected source is eligible and recorded
AND Viewer path is canonical and same-session
AND canplay observed
AND playing observed
AND error not observed as terminal
AND currentTimeAfter - currentTimeBefore >= 1
AND D1 summary == redacted artifact JSON projection
AND Markdown == deterministic projection of JSON
AND Dashboard displays provider, repair, source and playback independently
```

All other outcomes are explicitly `failed` for bounded terminal provider/browser failure or `checkpoint` for missing precondition/binding/output/verification input; [VERIFIED: CONTEXT D-04/D-22/D-25/D-26].

### Type-check and Gateway commands

```powershell
pnpm --filter api type-check
pnpm --filter dashboard type-check
pnpm --filter @starye/movie-app type-check
pnpm --filter @starye/crawler type-check
git diff --check

# canonical local surface; use Gateway, not app ports
pnpm check:services
# then run the phase proof against:
http://localhost:8080/dashboard/...
```

These commands verify compile/format/service readiness only; they do not count as production playback proof until the canonical verifier observes the fresh browser tuple and media progress; [VERIFIED: `AGENTS.md`, package scripts, CONTEXT D-26].

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement: false`; [VERIFIED: `.planning/config.json`, verification protocol].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse `requireSessionUser`/existing authenticated Gateway session on Dashboard command, task detail and evidence POST; [VERIFIED: admin route pattern, CONTEXT D-17] |
| V3 Session Management | yes | Same Gateway cookie/context across Dashboard -> MovieDetail -> Player -> endpoint; never persist cookie/session/nonce/signature material in evidence; [VERIFIED: CONTEXT D-17, `local-task-runner.e2e.ts`] |
| V4 Access Control | yes | Keep crawler permission/resource guard and task/run ownership checks; endpoint must bind user to task and current run; [VERIFIED: `canAccessCrawler`, `requireTaskRunAccess` in admin route] |
| V5 Input Validation | yes | Valibot strict schemas, bounded IDs/timestamps/event count, allowlisted source type/status/path, redaction before persistence; [VERIFIED: `.agents/skills/starye-hono-rpc/SKILL.md`, existing schemas/tests] |
| V6 Cryptography | yes | Reuse existing signed provider callback/session verification; do not store or reimplement signature/HMAC material in playback evidence; [VERIFIED: `apps/api/src/routes/internal/crawler-runs/index.ts`, CONTEXT D-12/D-17] |

### Known Threat Patterns for Hono + D1 + Vue/Playwright

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-task/run evidence submission | Tampering / Elevation | authenticated session plus server-loaded task/run/current-attempt/content/source revision comparison; reject stale/conflict; [VERIFIED: CONTEXT D-16-D-18/D-27] |
| Replay or conflicting terminal summary | Tampering / Repudiation | canonical redacted hash, unique accepted tuple, append-only bounded rejection history; [VERIFIED: CONTEXT D-18/D-29] |
| Signed URL/cookie/provider secret leakage | Information Disclosure | closed DTO, redaction at artifact and API projection, forbidden-field scans; [VERIFIED: `local-task-runner.e2e.ts`, CONTEXT D-12] |
| CSRF/session confusion on evidence POST | Spoofing / Tampering | same authenticated Gateway session, normal admin permission middleware, origin/canonical route checks where existing middleware supports them; [VERIFIED: `AGENTS.md`, admin route auth patterns] |
| Unbounded event/timeline payload | Denial of Service | strict allowlist, maximum event count/window/timestamp and payload size; [ASSUMED: exact numeric bounds remain discretionary] |
| Raw SQL/migration drift | Tampering / Availability | Drizzle schema plus generated migration, prepared statements, local D1 apply, API type-check and migration tests; [VERIFIED: `.agents/skills/starye-db-migration/SKILL.md`] |

## Sources

### Primary (HIGH confidence)

- [`24-CONTEXT.md`](./24-CONTEXT.md) — locked tuple, playback, artifact, endpoint, failure and Dashboard decisions; [VERIFIED: phase context]
- [`REQUIREMENTS.md`](../../REQUIREMENTS.md) — EVID-01/EVID-02/EVID-03; [VERIFIED: planning artifact]
- [`STATE.md`](../../STATE.md) and [`ROADMAP.md`](../../ROADMAP.md) — Phase 23 handoff, fresh production prerequisite and Phase 13 carrier boundary; [VERIFIED: planning artifacts]
- [`packages/db/src/schema.ts`](../../../packages/db/src/schema.ts) — current task/run/provider/source observation tables and indexes; [VERIFIED: codebase grep]
- [`apps/api/src/domain/crawler-tasks/repository.ts`](../../../apps/api/src/domain/crawler-tasks/repository.ts) — current task/run/attempt/CAS/reconciliation pattern; [VERIFIED: codebase grep]
- [`apps/api/src/domain/movies/source-contract.ts`](../../../apps/api/src/domain/movies/source-contract.ts) — minimal playback projection and source/readiness separation; [VERIFIED: codebase grep]
- [`apps/api/src/routes/admin/crawler-tasks/index.ts`](../../../apps/api/src/routes/admin/crawler-tasks/index.ts), [`apps/dashboard/src/lib/api.ts`](../../../apps/dashboard/src/lib/api.ts), [`apps/dashboard/src/views/Crawlers.vue`](../../../apps/dashboard/src/views/Crawlers.vue) — admin task detail and current-attempt Dashboard projection; [VERIFIED: codebase grep]
- [`apps/movie-app/src/views/MovieDetail.vue`](../../../apps/movie-app/src/views/MovieDetail.vue), [`apps/movie-app/src/views/Player.vue`](../../../apps/movie-app/src/views/Player.vue), [`apps/movie-app/src/utils/playbackSources.ts`](../../../apps/movie-app/src/utils/playbackSources.ts) — existing Viewer/source selection/retry/event boundary; [VERIFIED: codebase grep]
- [`scripts/phase19-evidence.ts`](../../../scripts/phase19-evidence.ts), [`scripts/local-task-runner.e2e.ts`](../../../scripts/local-task-runner.e2e.ts), [`packages/config/src/deployment-target/data-chain-evidence.ts`](../../../packages/config/src/deployment-target/data-chain-evidence.ts) — canonical artifact, redaction, Gateway session and evidence-root patterns; [VERIFIED: codebase grep]
- [`.agents/skills/starye-db-migration/SKILL.md`](../../../.agents/skills/starye-db-migration/SKILL.md) and [`.agents/skills/starye-hono-rpc/SKILL.md`](../../../.agents/skills/starye-hono-rpc/SKILL.md) — project migration/API conventions; [VERIFIED: project skill files]

### Secondary (MEDIUM confidence)

- [MDN `HTMLMediaElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) — media lifecycle and `currentTime`; [CITED: official documentation]
- [MDN `canplay`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event), [`playing`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event), [`waiting`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event), [`stalled`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event), [`error`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error_event) — event meanings and failure/buffering distinctions; [CITED: official documentation]
- [MDN HTTP Range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests) — bounded transport observation; [CITED: official documentation]
- [xgplayer official repository](https://github.com/bytedance/xgplayer) and [official docs](https://h5player.bytedance.com/en/) — current initialization/event reuse boundary; [CITED: official documentation]
- [Playwright assertions](https://playwright.dev/docs/test-assertions), [web server](https://playwright.dev/docs/test-webserver), [trace](https://playwright.dev/docs/trace-viewer) — locators, bounded assertions and auxiliary artifacts; [CITED: official documentation]
- [GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) — provider dispatch/run/concurrency semantics; [CITED: official documentation]

### Tertiary (LOW confidence)

- None. Web search provider confidence was `LOW` because Brave/web search was unavailable; no unverified community or competitor claims are used; [VERIFIED: `classify-confidence --provider websearch`].

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — package manifests, resolved package versions, configs and existing source all agree; [VERIFIED: package manifests, npm/package-local probes]
- Architecture: MEDIUM — existing control-plane and Viewer boundaries are HIGH, while the new evidence schema/table/route shape is a prescribed design under agent discretion; [VERIFIED: repository; ASSUMED: new shape]
- Pitfalls: MEDIUM — identity/redaction/status pitfalls are supported by repository tests and prior phase artifacts; actual production source/CORS/codec behavior requires the fresh run; [VERIFIED: prior research; ASSUMED: selected source availability]
- Security: MEDIUM — ASVS controls map directly to existing auth/redaction/CAS patterns, while exact CSRF/origin middleware behavior should be checked during implementation; [VERIFIED: existing routes; ASSUMED: exact middleware composition]

**Research date:** 2026-08-08  
**Valid until:** 2026-08-15 for production source/provider behavior; 2026-09-07 for stable repository patterns and test commands.
