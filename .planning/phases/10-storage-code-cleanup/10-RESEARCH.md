# Phase 10: Storage Code Cleanup - Research

**Researched:** 2026-07-13
**Confidence:** HIGH
**Scope:** shared storage contract/helper consolidation, legacy R2-first assumption cleanup, and minimal regression strategy for CODE-01..04.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 10 采用共享“纯 contract/helper”层，不做更高耦合的 shared storage service。
- **D-02:** 共享层范围收口到 `policy + key/url helper`：统一 purpose、prefix、object key builder、R2-managed URL 判定、external URL 判定等纯逻辑。
- **D-03:** 共享 helper 继续放在 `@starye/api-types` 扩展，而不是新建专门 storage package。
- **D-04:** 只做封装与 contract 收口，不改现有 key / prefix 形状。
- **D-05:** 需要清掉脚本/测试中的 R2-only 硬编码，以及后台 heuristics 中“不是 R2 就有问题”的判断。
- **D-06:** `actor` / `publisher` 后台逻辑要接受“合法外链也是终态”，判断应围绕 policy 与缺失必要资产，而不是 `startsWith(R2_PUBLIC_URL)`。
- **D-07:** legacy scripts 默认行为要改成 policy-aware：接受“合法外链”和“必要时存 R2”并存。
- **D-08:** 对外字段名与返回 shape 保持兼容，本 phase 只修正内部判定语义、注释、日志和测试。
- **D-09:** 测试补强以 shared helper 单测为主，再给现有 API/crawler 调用点补最小回归。
- **D-10:** 本 phase 优先守 shared helper contract drift，不重复重测 Phase 7/8 已锁定的高层链路。
- **D-11:** shared helper 需要直接测试；API 与 crawler 至少各保留一处接线回归。
- **D-12:** comic public API external URL、chapter-page reject、Reader failure behavior 等 Phase 7/8 coverage 只需复用，不重新造完整高层回归。

### the agent's Discretion

- helper 具体命名、拆分方式和内部变量/注释文案可自行收敛，只要语义更显式、仍保持纯 helper 定位。
- 调用点 smoke test 的分布可最小化，但必须满足 shared helper 直测 + API/crawler 最少各一处接线回归。

### Deferred Ideas (OUT OF SCOPE)

- 新建 shared storage runtime service。
- 变更既有 R2 key / prefix contract。
- 对外 API 字段重命名。
- 重做 Phase 7/8 的高层 external-image 回归。

</user_constraints>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CODE-01 | R2 key generation and allowed upload purposes are centralized enough that API upload and crawler flows do not drift. | 当前 API upload 自己构 key，crawler 自己管 namespace guard；共享 contract 还没真的承载 key/url helper。 |
| CODE-02 | ImageProcessor or its callers make the difference between `storeNecessaryAsset` and `preserveExternalImageUrl` explicit. | 当前仓库已在 Phase 7/8 锁住“正文图保外链、必要资产才进 R2”，但内部 helper / 变量 / heuristics 仍混有“R2 才算正确”的旧语义。 |
| CODE-03 | Storage-related tests cover allowed uploads, rejected chapter page uploads, and comic reader/API external URL behavior. | upload route、crawler purpose guard、public comics、Reader failure UX 都已有分散测试面，可复用并做最小补强。 |
| CODE-04 | Legacy scripts that assume "cover image must be R2 URL" are updated or documented as optional, cost-aware flows. | `backfill-covers.ts`、`test-full-flow.ts`、`test-single-movie.ts` 仍把 CDN/R2 当默认成功叙事。 |

## Summary

Phase 10 不是再发明一层新的 storage service，而是把已经锁定的 policy 真正收口成单一 helper truth source，并把仓库里残留的 R2-first 语义降到最少。当前代码已经具备三个关键前提：Phase 8 把 manual upload purpose vocabulary 固定在 `packages/api-types/src/storage-purpose-policy.ts`，crawler 已经把 chapter page upload 禁掉，Phase 7 的 public comic API 与 Reader 已经接受 external URLs。真正缺的是 shared helper 没有覆盖 key/url semantics，调用点因此仍各写各的。 

最关键的漂移点有四个：

1. `apps/api/src/routes/upload/index.ts` 仍自己维护 `buildUploadObjectKey()`，而不是从 shared contract 取用。
2. `packages/crawler/src/lib/image-processor.ts` 直接定义 crawler namespace guard，与 API 侧没有真正共享 helper。
3. `apps/api/src/routes/admin/actors/index.ts` 与 `publishers/index.ts` 仍把“不是 R2”当成“需要更新”。
4. `packages/crawler/scripts/backfill-covers.ts`、`test-full-flow.ts`、`test-single-movie.ts` 仍把 CDN/R2 叙事写成默认成功标准。

**Primary recommendation:** 把 Phase 10 规划成三段式：

1. 在 `@starye/api-types` 扩 shared storage helper，集中 purpose/prefix、manual key builder、crawler namespace helper、R2-managed vs external URL classifier，并让 API upload 先接上。
2. 让 crawler upload seam 与 admin actor/publisher heuristics 共用这套 helper，停止用 `R2_PUBLIC_URL startsWith` 推导业务合法性。
3. 更新 legacy scripts / smoke wording，并用 shared helper 直测 + API/crawler focused regressions + 复跑已有 public comic / Reader tests 完成 Phase 10 验证。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Why |
|------------|--------------|----------------|-----|
| shared storage policy/key/url helper | `packages/api-types` | API + crawler consumers | 最低摩擦的 shared contract 落点已存在；只需扩大纯 helper 范围，不必新建 package。 |
| manual upload key generation | API upload route | shared helper | 真实 R2 write 仍在 API，但 key 规则应由 shared helper 提供。 |
| crawler namespace / purpose guard | crawler `ImageProcessor` seam | shared helper | 真正的自动上传边界在 `ImageProcessor`，guard 需要 fail-closed 且不可散落到 callers。 |
| policy-aware actor/publisher heuristics | admin pending routes | shared URL classifier | 兼容现有 `needsAvatarUpdate` / `needsLogoUpdate` 字段名，但内部判断要接受合法外链。 |
| legacy storage script messaging | crawler scripts | shared helper / source assertions | 目标是收口默认叙事，不是把每个脚本都改成新框架。 |

## Current Contract Surfaces

### Shared helper today: too thin

- `packages/api-types/src/storage-purpose-policy.ts` 目前只定义了 `manualUploadPurposeValues`、`manualUploadPrefixMap`、`crawlerImagePurposeValues` 和 `isManualUploadPurpose()`。
- 这里还没有：
  - manual object key builder
  - crawler namespace helper
  - managed-vs-external URL classifier
  - 能同时被 API / crawler / admin heuristics 复用的纯语义函数

### API upload seam

- `apps/api/src/routes/upload/index.ts` 当前本地定义了 `parseUploadPurpose()` 和 `buildUploadObjectKey()`。
- 这意味着 Phase 8 固化的 purpose vocabulary 虽然被共享了，但 key generation 仍然是 route 私有逻辑。
- dashboard 已经通过 `apps/dashboard/src/lib/api.ts::upload.uploadImage(file, purpose)` 显式传 `purpose`，所以 Phase 10 不需要再回改 dashboard consumer contract。

### Crawler upload seam

- `packages/crawler/src/lib/image-processor.ts` 目前自己持有：
  - `normalizeCrawlerNamespace()`
  - `assertAllowedCrawlerImageTarget()`
  - `buildApprovedCrawlerPrefix()`
- 这些逻辑虽然正确，但还停留在 crawler 私有 helper，无法与 API / admin heuristics 共用“managed vs external”语义。
- 该 seam 已经是最佳 fail-closed 边界，因为它在下载与上传前就能拒绝不允许的 target。

### Admin actor/publisher heuristics

- `apps/api/src/routes/admin/actors/index.ts` 的 `/pending` 逻辑把 `!avatar.startsWith(r2PublicUrl)` 视为 `needsAvatarUpdate`。
- `apps/api/src/routes/admin/publishers/index.ts` 的 `/pending` 逻辑把 `!logo.startsWith(r2PublicUrl)` 视为 `needsLogoUpdate`。
- 这与 Phase 10 锁定语义冲突：外链可以是合法终态，`needs*Update` 应只代表“缺少必要资产 / 仍需特定来源补全”，而不是“不是 R2”。

### Legacy script / smoke surfaces

- `packages/crawler/scripts/backfill-covers.ts` 已经有 fallback 到外链的行为，但注释、控制台文案和成功标签仍偏向 `CDN/R2 = 正常`。
- `packages/crawler/scripts/test-full-flow.ts` 直接把“验证 coverImage 是 R2 URL”写成测试通过条件。
- `packages/crawler/scripts/test-single-movie.ts` 仍保留“检查 coverImage 是否是 R2 URL”的成功口径。
- 这些脚本不一定需要大改控制流，但必须停止继续向后续维护者灌输“封面一定要是 R2 URL”的默认叙事。

## Test Strategy

Phase 10 的最优测试组合不是“再造一套高层集成”，而是“shared helper 直测 + 现有回归复用”：

- **Shared helper direct tests:** 新增 `packages/api-types/src/storage-purpose-policy.test.ts`，直接覆盖 manual key builder、crawler namespace helper、managed/external URL classifier。
- **API regression:** 继续扩展 `apps/api/src/routes/upload/__tests__/upload.route.test.ts`，确认 upload route 已接上 shared helper，且 key shape 与 Phase 8 一致。
- **Crawler regression:** 继续扩展 `packages/crawler/test/image-processor-purpose-policy.test.ts`，确认 `ImageProcessor` 改用 shared helper 后，chapter-page reject 与 allowed namespaces 仍成立。
- **Admin focused regressions:** 为 actor/publisher pending heuristics 增补最小 route tests，确保合法外链不再被当成“必须更新”。
- **Phase 7 reuse only:** 复跑 `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` 与 `apps/comic-app/src/views/__tests__/Reader.test.ts`，确认 external URL / Reader failure behavior 未被 storage helper 收口回归伤到。

## Common Pitfalls

### Pitfall 1: helper 扩着扩着变成 runtime service

**What goes wrong:** 为了“一次统一”，把 API 和 crawler 的真实上传行为也试图抽到同一服务里。  
**Why it is wrong here:** Context 明确禁止新建 shared runtime service；Phase 10 只允许纯 policy/helper 层。  
**Avoidance:** 所有新 shared exports 必须保持纯函数、零平台绑定、零 I/O。

### Pitfall 2: 一边修语义，一边改 public field 名

**What goes wrong:** 顺手把 `needsAvatarUpdate` / `needsLogoUpdate` 改名，扩大前后端 blast radius。  
**Why it is wrong here:** Context 已锁对外兼容，本 phase 优先修内部语义。  
**Avoidance:** 保留字段名，修正其计算逻辑与日志注释。

### Pitfall 3: 只改 helper，不补 direct tests

**What goes wrong:** contract 看起来集中起来了，但没人真正锁住 helper 的 pure semantics。  
**Why it is risky:** 之后 API 与 crawler 仍可能各自再包一层私有变体。  
**Avoidance:** shared helper 必须有直接单测，而不是只靠调用点间接覆盖。

### Pitfall 4: 把 Phase 10 扩成“再验证一遍 Phase 7/8”

**What goes wrong:** 计划膨胀成大规模 regression sweep，执行成本高且与当前目标不符。  
**Why it is wrong here:** Context 明确要求复用现有 high-level coverage，而不是重做整轮高层回归。  
**Avoidance:** 仅复跑 `public-comics.test.ts` 和 `Reader.test.ts`，不新增更重的外链集成链路。

## Recommended Plan Shape

### Wave 1

- **Plan 10-01:** 扩 shared storage helper，并让 API upload 接上纯 contract。

### Wave 2

- **Plan 10-02:** 让 crawler seam 与 admin actor/publisher heuristics 改用 shared semantics。
- **Plan 10-03:** 更新 legacy scripts 的 policy-aware 默认叙事，并完成 focused regression matrix。

这三个 plans 的写集基本可分离：

- 10-01 主要写 `packages/api-types` + upload route/tests
- 10-02 主要写 crawler seam + admin pending heuristics/tests
- 10-03 主要写 crawler scripts + verification-facing test/doc assertions

## Validation Architecture

| Layer | Command |
|-------|---------|
| shared helper direct test | `pnpm --filter @starye/api-types exec vitest run src/storage-purpose-policy.test.ts` |
| upload route regression | `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload.route.test.ts` |
| crawler purpose regression | `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts` |
| admin heuristic regressions | `pnpm --filter api exec vitest run src/routes/admin/actors/__tests__/pending.test.ts src/routes/admin/publishers/__tests__/pending.test.ts` |
| existing external-url regressions | `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts` + `pnpm --filter @starye/comic-app exec vitest run src/views/__tests__/Reader.test.ts` |
| type safety | `pnpm --filter api exec tsc --noEmit` + `pnpm --filter @starye/crawler exec tsc --noEmit` + `pnpm --filter @starye/api-types exec tsc --noEmit` |

## Sources

- `.planning/phases/10-storage-code-cleanup/10-CONTEXT.md`
- `.planning/phases/10-storage-code-cleanup/10-DISCUSSION-LOG.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `packages/api-types/src/storage-purpose-policy.ts`
- `apps/api/src/routes/upload/index.ts`
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts`
- `packages/crawler/src/lib/image-processor.ts`
- `packages/crawler/test/image-processor-purpose-policy.test.ts`
- `apps/api/src/routes/admin/actors/index.ts`
- `apps/api/src/routes/admin/publishers/index.ts`
- `packages/crawler/scripts/backfill-covers.ts`
- `packages/crawler/scripts/test-full-flow.ts`
- `packages/crawler/scripts/test-single-movie.ts`
- `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts`
- `apps/comic-app/src/views/__tests__/Reader.test.ts`
