# Phase 10: Storage Code Cleanup - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 在 v1.1 已经锁住的存储成本边界之上，收口 storage contract、旧 R2-first 假设和测试覆盖，目标是让 API upload、crawler image handling、legacy scripts、以及 admin heuristics 不再各自漂移。它要做的是把共享 policy / key / URL helper 提炼成单一 contract，把“必要资产存储”和“外链保留”的语义落实到调用点，并校正仓库里仍把 R2/CDN 当唯一正确结果的旧判断或脚本默认行为。

本 phase 不重做存储架构，不引入新的 shared runtime service，不修改既有 R2 object key / prefix contract，不重命名现有对外 API 字段，也不重新验证已在 Phase 7/8 锁定的整条 comic external-image 高层链路。

</domain>

<decisions>
## Implementation Decisions

### Shared Storage Contract
- **D-01:** Phase 10 采用共享“纯 contract/helper”层，不做更高耦合的 shared storage service。
- **D-02:** 共享层范围收口到 `policy + key/url helper`：统一 purpose、prefix、object key builder、R2-managed URL 判定、external URL 判定等纯逻辑，不把上传 runtime 本身抽成跨端服务。
- **D-03:** 共享 helper 继续放在 `@starye/api-types` 扩展，而不是新建专门 storage package。
- **D-04:** 只做封装与 contract 收口，不改现有 key / prefix 形状；现有 `covers/manual/`、`manual-assets/blog-inline/`、`movies/<code>`、`comics/<slug>` 等 contract 保持不变。

### Legacy R2-First Assumption Cleanup
- **D-05:** 必须清掉两类旧假设：一类是脚本/测试里把 R2/CDN 当唯一正确结果的硬编码；另一类是后台 heuristics 里把“不是 R2”直接视为待修复的判断。
- **D-06:** `actor` / `publisher` 相关后台逻辑要从“不是 R2 就有问题”改成“外链也可以是合法终态”；判断标准应围绕当前 policy 是否允许、是否缺必要资产、是否确实需要特定来源补全，而不是单纯 `startsWith(R2_PUBLIC_URL)`。
- **D-07:** 关键 legacy scripts 要改成 policy-aware 默认行为，默认接受“合法外链”和“必要时存 R2”并存，而不是继续强化 CDN-only / R2-only 叙事。
- **D-08:** 对外字段名与返回 shape 先保持兼容；本 phase 优先修正内部判定语义、注释、日志措辞和测试，不扩大到前后端联动重命名。

### Test Strategy
- **D-09:** 测试补强以 shared helper 单测为主，再给现有 API/crawler 调用点补最小回归，重点防止 contract 在两端再次漂移。
- **D-10:** Phase 10 优先守 shared helper contract 不一致风险，而不是重新把全部旧链路再跑一遍高层回归。
- **D-11:** 共享 helper 需要直接测试；现有 `upload` / `image-processor` 等调用点只保留“已正确接上共享 contract”的最小 smoke / regression coverage。
- **D-12:** 已在 Phase 7/8 锁住的 comic public API external URL、chapter-page reject、reader failure behavior 等链路，不在本 phase 重复造完整高层回归；只有接入 shared helper 的边界需要补 smoke。

### the agent's Discretion
- 对 `CODE-02` 中“必要资产存储”与“外链保留”语义的具体 helper 命名、内部变量命名、注释文案，planner / executor 可自行收敛，只要让语义更显式，并且不扩展为对外 API 字段重命名。
- shared helper 的具体导出形状可由规划阶段决定，例如拆成 `build*Key` / `is*Url` / `normalize*Policy` 等多个纯函数，前提是保持 `@starye/api-types` 纯 contract/helper 定位，不引入 Worker-only 或 Node-only 运行时依赖。
- 在调用点 smoke 测试的分布上，planner / executor 可按最小有效覆盖裁剪，只要 shared helper 本身有直接单测，且 API 与 crawler 至少各有一处接线回归。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Phase Boundaries
- `.planning/PROJECT.md` — v1.1 的免费额度目标、R2 只存必要资产、正文图不进 R2 / 不走默认代理的项目级边界。
- `.planning/REQUIREMENTS.md` — Phase 10 requirements `CODE-01` through `CODE-04`，以及与 reliability / operations v2 defer 的边界。
- `.planning/ROADMAP.md` — Phase 10 goal 和 success criteria；明确本 phase 是 storage code cleanup，不是新能力 phase。
- `.planning/STATE.md` — 当前 phase 状态、前序 phase 已锁决策，以及 Phase 10 从 Phase 9 closeout 延续而来的执行语境。

### Prior Locked Storage Decisions
- `.planning/phases/07-comic-external-image-flow/07-CONTEXT.md` — 章节正文图只保存 external/source URL，API/Reader 不再假设 same-origin / R2。
- `.planning/phases/08-cost-guardrails/08-CONTEXT.md` — purpose allowlist、chapter-page reject、以及“helper 全面统一留到 Phase 10”的已锁边界。
- `.planning/phases/09-documentation-restructure/09-CONTEXT.md` — 文档 owner 边界；如果 Phase 10 需要更新脚本说明或长期规则，必须遵守 canonical owner 分工。

### Current Shared Contract and Main Call Sites
- `packages/api-types/src/storage-purpose-policy.ts` — 当前共享 purpose / prefix contract 的起点，Phase 10 的 shared helper 应在这里或同包附近扩展。
- `apps/api/src/routes/upload/index.ts` — 手工上传入口，当前自行解析 purpose 并构造 object key，是 API-side contract 收口重点。
- `packages/crawler/src/lib/image-processor.ts` — crawler-side purpose / namespace policy 与 R2 upload 行为当前主入口，是另一侧 contract 收口重点。
- `apps/dashboard/src/lib/api.ts` — dashboard 对 upload purpose 的客户端调用边界，决定 shared contract 变更是否会影响前端 consumer。
- `apps/dashboard/src/components/ImageUpload.vue` — 默认 `manual_asset` 上传 consumer，帮助判断 shared helper 收口后前端是否需要最小同步。

### Legacy Assumption Surfaces to Clean Up
- `apps/api/src/routes/admin/actors/index.ts` — 仍用 `!avatar.startsWith(R2_PUBLIC_URL)` 推导 `needsAvatarUpdate`，是 policy-aware 判定修正重点。
- `apps/api/src/routes/admin/publishers/index.ts` — 仍用 `!logo.startsWith(R2_PUBLIC_URL)` 推导 `needsLogoUpdate`，与 actor 侧一起校正。
- `packages/crawler/scripts/backfill-covers.ts` — 当前默认把 R2/CDN 视为标准流程，虽然有回退路径，但脚本叙事仍偏 R2-first。
- `packages/crawler/scripts/test-full-flow.ts` — 当前测试输出仍把 “coverImage 是 R2 URL” 写成验证项，需要改成 policy-aware 成功标准。

### Existing Coverage to Reuse Instead of Rebuilding
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts` — upload purpose / prefix contract 已有测试，Phase 10 只需保持与 shared helper 接线一致。
- `packages/crawler/test/image-processor-purpose-policy.test.ts` — crawler purpose / namespace contract 已有测试，可复用为 shared contract 接入回归。
- `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` — public comic chapter external URL contract 已在 Phase 7 锁定，本 phase 不应整轮重测。
- `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts` — comic cover opt-in 与 chapter external flow 已有 regression，Phase 10 只在受影响边界补 smoke。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/api-types/src/storage-purpose-policy.ts`：已经承载 shared purpose / prefix 常量和类型，是扩展 key/url helper 的最低摩擦落点。
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts`：已把 manual upload contract 拉成独立 route test，适合在不重建整套 test harness 的前提下验证 shared helper 接线。
- `packages/crawler/test/image-processor-purpose-policy.test.ts`：已把 crawler purpose / namespace 约束单独拆出，适合继续承载 shared contract regression。
- `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts`：已覆盖封面 opt-in 与正文图 external URL 语义，可作为“不重复高层回归”的稳定边界。

### Established Patterns
- 仓库已经接受“API 与 crawler 共享 type/policy contract，但各自保留运行时实现”的模式；Phase 10 应延续这个轻共享思路，而不是把 Node crawler 和 Worker upload 逻辑强行揉成一个 runtime service。
- 当前多处用 `R2_PUBLIC_URL` 前缀判断“是不是正确图片”，说明仓库存在从“R2 presence”推断“业务合法性”的旧模式；Phase 10 需要把它收回到 policy-aware 语义。
- Phase 7/8 已经把 “正文图外链化” 和 “chapter-page upload 禁止” 锁死，因此 Phase 10 的重点应放在 contract 收口和术语修正，而不是重新讨论正文图是否进 R2。

### Integration Points
- `dashboard -> /api/upload -> R2/media` 是手工资产上传的主链路，shared key/url helper 变更会首先影响这里。
- `crawler scripts / crawlers -> ImageProcessor -> R2` 是自动资产上传的另一条主链路，需要和 API 侧 contract 对齐，但不共享 runtime。
- `admin actors/publishers pending list -> crawler recrawl/update` 是旧 heuristics 的直接消费面；如果判断口径变化，需要同步最小回归测试。
- `legacy scripts -> console guidance / assertions` 是仓库中继续传播旧 R2-first 语义的低成本高噪声入口，适合本 phase 顺手收口。

</code_context>

<specifics>
## Specific Ideas

- shared helper 应直接成为单一 truth source：purpose / prefix、object key builder、`isR2ManagedUrl`、`isExternalUrl` 之类纯逻辑不要再散在 API 和 crawler 两边。
- 这期不追求 rename everything；更看重“少 blast radius 地把语义拉正”，尤其是保留现有返回字段名的同时修正其判定含义。
- 关键脚本的成功标准要从“cover 一定是 CDN/R2 URL”改成“结果符合当前 policy”，避免继续误导未来维护者。
- 测试以 shared helper 单测为主，调用点补最小 smoke；Phase 7/8 已锁住的高层链路不要重复造轮子。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Storage Code Cleanup*
*Context gathered: 2026-07-13*
