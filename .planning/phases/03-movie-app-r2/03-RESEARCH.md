# Phase 3: movie-app 播放稳定化（现有路径错误恢复） - Research

**Researched:** 2026-05-12
**Domain:** Vue 3 + xgplayer 播放错误恢复 / TorrServer 与 Aria2 连接态反馈 / Phase 文档收窄修订
**Confidence:** HIGH（代码现状与 Phase 3 CONTEXT 已基本对齐；xgplayer 事件细节中有一小部分为保守推断）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01/D-02/D-03:** Phase 3 不再做 R2 视频宿主，也不再为视频绑定 `cdn.starye.org` / CORS / Range / Cache-Control；R2 只保留轻量文件定位，视频继续走现有 magnet / TorrServer / 外链路径。
- **D-04:** 错误恢复逻辑直接改 `apps/movie-app/src/views/Player.vue`，不抽 composable、不抽共享组件。
- **D-05/D-06/D-07/D-08:** 播放错误统一收敛到一个错误卡片，现有 `torrServerBuffering` / `torrServerError` 需要并入统一状态；至少接住 `error`、`waiting`、`canplay`、`playing` 等事件。
- **D-09/D-10/D-11:** 重试只做“同源重试”，保留 `currentTime`，不自动切换下一个 player 源，不做自动重试，也不做 codec swap 多级降级。
- **D-12/D-13/D-14:** Aria2 / TorrServer 离线时，按钮保持可见但 `disabled`，并提供轻量提示；tooltip 方案可以由 planner 选择，但不能把动作隐藏掉。
- **D-15/D-16:** R18 播放层不再做签名 URL，不再做额外鉴权；依赖 Phase 2 已落地的 `buildAdultVisibilityCondition` 和 detail 403 防御。
- **D-17:** 不做 Sentry，只预留未来 Phase 5 接入点。
- **D-20/D-21/D-22/D-23:** Planner 的第一波交付必须先同步修订 `.planning/REQUIREMENTS.md`、`.planning/ROADMAP.md`、`.planning/PROJECT.md`、`.planning/STATE.md`，把已收窄的范围反映为真实 v1 计划。

### Claude's Discretion

- `errorState` 具体字段形状可以由 planner 决定，但需要满足 `kind`、`message`、`recoverable`、`visible` 这些语义位。
- 等待超时阈值可以在 10-20 秒区间内调整，但必须显式进 plan，而不是执行时临时拍脑袋。
- tooltip 如无现成组件，可接受先用原生 `title` 做最小实现。
- `player.src = sameUrl` 与 `destroy + new Player({ startTime })` 两种重试策略，需要以仓库当前版本和现有代码风险做保守选择。

### Deferred Ideas (OUT OF SCOPE)

- R2 视频宿主、Range/CORS/Cache Rules、R18 签名短链、自动续签
- codec swap 降级链、自动切源、自动重试 / 指数退避
- Sentry 上报、播放偏好持久化、进度存储重构（归 Phase 4 / Phase 5）
- 统一全局“下载器离线”banner
</user_constraints>

<phase_requirements>
## Phase Requirements

> **重要：** 当前 `.planning/REQUIREMENTS.md` 仍是旧稿，VIDEO-01/02/03/06 还挂在 v1 Active。Phase 3 的第一步不是实现，而是把 requirements 与 roadmap 改成现在已经锁定的真实范围。

| ID | 当前需求文本状态 | 本 phase 真实支持方式 |
|----|------------------|----------------------|
| VIDEO-04 | 旧稿仍写“`<video>` 捕获 `error`，自动降级（reload src → swap codec → 显式失败）” | 需要改成“统一错误卡片 + 同源重试”，删除 codec swap 描述 |
| VIDEO-05 | 旧稿基本可复用 | 保留，但要从“只有 TorrServer overlay”升级到“所有播放错误统一可见” |
| VIDEO-01/02/03/06 | 旧稿仍在 v1 Active | 必须从 v1 移除，改为 Out of Scope / dropped-from-v1 |

</phase_requirements>

## Summary

Phase 3 已经不是“R2 直发视频”项目，而是一次**播放错误体验和规划文档对齐**的收敛性阶段。代码库现状与新目标并不冲突，甚至已经有一半基础：`Player.vue` 中已有 TorrServer 专用的缓冲和错误 overlay，`useAria2()` 和 `useTorrServer()` 也都已经暴露 `isConnected`；真正缺的是把这些零散状态收口成稳定的前端行为，并把旧的规划文档修回来。

最关键的三个 VERIFIED 结论：

1. **API 侧的 R18 detail 防御已经存在。** `apps/api/src/routes/public/movies/index.ts:469` 已对 `movie.isR18 && !user?.isR18Verified` 返回 403，Phase 3 大概率可以零改 API，只需要在 RESEARCH/PLAN 中显式确认这一点。
2. **Aria2 / TorrServer 的连接态都已经对前端暴露。** `apps/movie-app/src/composables/useAria2.ts` 与 `apps/movie-app/src/composables/useTorrServer.ts` 都返回 `isConnected`，这足以支撑“按钮始终显示，但离线时 disabled + title”的方案，不需要新增全局状态。
3. **movie-app 当前没有接 `vue-i18n`。** `apps/movie-app/src/main.ts` 只 `app.use(createPinia())` 和 `app.use(router)`，没有 `createI18n()`；因此 CONTEXT 里的“tooltip 文案需要国际化位”如果按严格 i18n 实现，会引出额外初始化改造。本 phase 更稳妥的策略是：**保留 packages/locales 中可复用的文案来源作为未来方向，但当前最小实现接受原生 `title` 中文提示。**

Primary recommendation:

- **Wave 0 先修规划文档。** 这是必须的，不是“文档洁癖”。如果先写代码再保留旧的 VIDEO-01/02/03/06 在 v1，execute/verify 阶段会持续把不该做的 R2 直发当成 gap。
- **Player 错误状态合并优先于新增复杂 UI。** 当前 `Player.vue` 的状态已经足够支持一次就地重构，不需要再抽层。
- **重试默认选“销毁后重建播放器 + startTime 回填”的保守路线。** 对当前代码结构来说，这比直接复写 `player.src` 更接近“可预测状态重置”，也更容易在播放失败后彻底清掉旧监听与内部状态。

## Current Code Audit

### 1. `apps/movie-app/src/views/Player.vue`

**VERIFIED：**

- 当前只在 **TorrServer 模式** 下监听四类事件：`canplay`、`error`、`waiting`、`playing`。
- `torrServerBuffering` / `torrServerError` 仅服务于 TorrServer 分支；标准模式没有统一错误 UI。
- `progressApi.saveWatchingProgress()` 已经接在 `timeupdate` 上，但被 `!isTorrServerMode.value` 限制，Phase 3 不需要动这一块。
- 组件在 `onUnmounted` 中会 `player.destroy()`，说明“销毁重建播放器”的生命周期路径已经被现有代码接受。

**现状片段：**

```ts
player.on('canplay', () => {
  torrServerBuffering.value = false
})

player.on('error', () => {
  torrServerBuffering.value = false
  torrServerError.value = '视频播放失败。可能是浏览器不支持该视频格式（如 MKV/HEVC），建议使用 Aria2 下载后本地播放。'
})

player.on('waiting', () => {
  torrServerBuffering.value = true
})

player.on('playing', () => {
  torrServerBuffering.value = false
})
```

**缺口：**

- 标准模式（直接外链或普通 player 源）没有任何“可见错误态”。
- `waiting` 只表示“显示缓冲”，没有“超时后转错误”。
- 错误 UI 与 “回详情页 / 加 Aria2 / 重试” 行为还未统一。

### 2. `apps/movie-app/src/views/MovieDetail.vue`

**VERIFIED：**

- 当前 Aria2 与 TorrServer 按钮是 **条件渲染**，不是“始终可见 + 离线禁用”。
- `showToast('请先在个人中心配置 Aria2 连接', 'error')` 和 `showToast('请先在个人中心配置 TorrServer 连接', 'error')` 已存在，但这依赖用户点击后才给反馈。
- `const { isConnected: aria2Connected } = useAria2()` 与 `const { isConnected: torrServerConnected } = useTorrServer()` 已经在页面顶层拿到。

**这意味着：**

- Phase 3 不需要新增连接状态来源，只需要把按钮渲染条件从 `v-if="... && aria2Connected"` 改成“始终渲染，离线时 `disabled + title`”。
- MovieDetail 是一个 1100+ 行大组件，**应该做最小侵入改动**：按钮不拆，保持现有 handler，只改模板层和极少量计算逻辑。

### 3. `apps/movie-app/src/composables/useAria2.ts`

**VERIFIED：**

- 全局单例 `isConnected = ref(false)` 已存在。
- `testConnection()` 成功时设为 `true`，异常时设为 `false`。
- 对外 return 已包含 `isConnected`。

**结论：** Aria2 连接态能力已经满足 Phase 3，不需要改 composable 结构。

### 4. `apps/movie-app/src/composables/useTorrServer.ts`

**VERIFIED：**

- 全局单例 `isConnected = ref(false)` 已存在。
- 初始化时如果本地配置或系统默认值存在，会自动尝试 `testConnection()`。
- 对外 return 已包含 `isConnected`。

**结论：** CONTEXT 里“若不存在则新增 `isConnected`”在当前代码里已经不成立，planner 不需要再为此分配独立任务。

### 5. `apps/api/src/routes/public/movies/index.ts`

**VERIFIED：**

- `getMovieDetail` 已有 R18 访问控制：

```ts
if (movie.isR18 && !user?.isR18Verified) {
  return c.json({ success: false, error: '需要 R18 访问权限' }, 403)
}
```

- related movies / same series / genre fallback 也已经统一调用 `buildAdultVisibilityCondition`。

**结论：**

- Phase 3 的播放层“无额外 R18 鉴权”是成立的。
- API 侧无需再补 `detail handler` 的 R18 过滤；该项在 plan 中应该记录为 **verification-only / zero-code path**，避免 executor 白白搜索一轮。

### 6. `packages/locales` 与 movie-app 的关系

**VERIFIED：**

- `packages/locales/src/zh-CN/movie.ts` 与 `packages/locales/src/en-US/movie.ts` 已存在 movie 文案词典。
- 但 `apps/movie-app/src/main.ts` 未接 i18n。
- `apps/movie-app/src` 中也没有 `useI18n()` 或 `createI18n()` 的使用痕迹。

**结论：**

- “tooltip 文案需要国际化位”在当前仓库里还没有真正运行时接线。
- 本 phase 如果强行把提示接到 packages/locales，会把 scope 从“播放稳定化”拉成“movie-app i18n 接入”。这不值。
- **推荐：** 本期按钮提示接受原生 `title` 中文文案；如需留 future-proof 痕迹，可在 `03-PATTERNS.md` / `03-PLAN.md` 里注明“文案 key 未来可迁入 `packages/locales/src/*/movie.ts`”。

## xgplayer Capability Notes

### VERIFIED from local code / package manifest

- 工作区依赖版本为 `xgplayer: ^3.0.24`（`apps/movie-app/package.json`）。
- 当前代码已直接使用：
  - `new Player({ id, url, startTime, ... })`
  - `player.on('event', handler)`
  - `player.currentTime`
  - `player.duration`
  - `player.destroy()`

### ASSUMED but low-risk

- `error`、`waiting`、`canplay`、`playing` 这些事件在 3.x 持续可用。当前代码已经实际绑定了它们，因此至少“可监听”这一层不需怀疑。
- 直接写回 `player.src = sameUrl` 在 3.x 多半可行，但**仅从当前仓库代码看**，没有现成调用点，也没有现成测试锚点，因此它比“destroy + new Player”更偏假设。

### Retry path tradeoff

| 方案 | 优点 | 风险 | 建议 |
|------|------|------|------|
| `player.src = sameUrl` | 改动少，保留现有实例 | 难判断是否彻底清掉旧错误状态、旧等待计时器和插件内部状态 | 作为次选 |
| `player.destroy()` 后 `new Player({ url, startTime })` | 生命周期清晰，和现有 `onUnmounted` 路径一致，易于彻底 reset | 要重新挂监听器，代码略长 | **推荐主选** |

**Primary recommendation:** 在当前仓库而不是官方 demo 的语境下，优先走“记录最后时间 -> destroy -> re-init -> startTime 回填”的保守策略。

## Why Wave 0 Must Be Docs First

这不是“先写文档再写代码”的习惯问题，而是一个**执行正确性**问题：

1. 旧的 `.planning/REQUIREMENTS.md` 还把 VIDEO-01/02/03/06 算作 v1 Active。
2. 旧的 `.planning/ROADMAP.md` 还把 Phase 3 Goal 写成 R2 直发 + R18 签名。
3. `STATE.md` 里还把 `P3 kick-off` 写成 “确认 xgplayer error 事件结构 + R2 custom domain 与 Cache Rules 交互”。

如果不先改：

- planner/checker 会持续把“没做 R2 直发”判成 coverage gap；
- execute/verify 会错误追逐 `cdn.starye.org` / 206 / CF-Cache-Status 等本 phase 已明确放弃的目标；
- 后续 Phase 4/5 在读取 ROADMAP / PROJECT 时也会拿到过期约束。

因此 Wave 0 必须拆成**单独 plan**，并且最好单独 commit，作为后续实现 plan 的前置依赖。

## Recommended Plan Split

基于当前代码现状，最自然的 Phase 3 拆分是 4 个 plan：

1. **03-01 文档收敛**
   - 改 `.planning/REQUIREMENTS.md`
   - 改 `.planning/ROADMAP.md`
   - 改 `.planning/PROJECT.md`
   - 改 `.planning/STATE.md`

2. **03-02 Player 错误卡片与同源重试**
   - 改 `apps/movie-app/src/views/Player.vue`
   - 增加等待超时逻辑
   - 合并 TorrServer 与标准模式错误 UI
   - 落“销毁重建 + startTime 回填”重试路径

3. **03-03 MovieDetail / Player 按钮连接态反馈**
   - 改 `apps/movie-app/src/views/MovieDetail.vue`
   - 改 `apps/movie-app/src/views/Player.vue`
   - 把 Aria2 / TorrServer 按钮改成离线可见、disabled、title 提示

4. **03-04 测试与人工 UAT**
   - 增加少量 movie-app 单测或 util/composable 测试
   - 更新 / 新建人工播放检查文档
   - 用真实 TorrServer / 断网 / 错误源做冒烟验证

不建议再拆得更细，因为：

- `Player.vue` 是单文件主战场，错误卡片与重试行为高度耦合。
- 连接态按钮反馈虽然涉及两个页面，但属于同一用户可见体验面。

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Unit framework | Vitest ^4.1.4 |
| Unit config | `apps/movie-app/vitest.config.ts` |
| E2E framework | Playwright |
| E2E config | `apps/movie-app/playwright.config.ts` |
| Existing player-adjacent tests | `src/utils/__tests__/torrServerClient.test.ts`, `torrServerClient.integration.test.ts` |

### Recommended automated coverage

| Area | Best fit |
|------|----------|
| 文档收敛 | 无需自动化测试，改完后用 grep/requirements coverage 校验 |
| 按钮离线状态 | 轻量组件/视图测试或 DOM 级断言 |
| TorrServer URL 构建 / 文件选择 | 复用已有 `torrServerClient` 测试 |
| Player 真正媒体失败行为 | **人工 UAT 优先**，少做脆弱 DOM 自动化 |

### Why not heavy Player view tests

- 当前 movie-app 的单测主要集中在 utils / composables / 小组件，没有成熟的 `Player.vue` 级测试先例。
- `Player.vue` 依赖真实 xgplayer 实例和 `<video>` 事件，纯 happy-dom 下容易变成 mock-heavy、价值低、脆弱高的测试。
- 因此推荐只对“状态机可抽出的少量纯逻辑”做单测，主体验收放在 `03-HUMAN-UAT.md`。

## Risks & Open Questions

### Medium risk

1. **等待超时阈值误判**
   - 过短会把正常慢网误报成错误
   - 过长又会让用户继续黑屏无反馈
   - 建议先按 10s 落地，并在 plan 中明确允许执行时调到 15s

2. **重试后 startTime 回填是否触发重复保存**
   - 当前 `timeupdate -> debounceSaveProgress()` 是标准模式下生效
   - 如果重建播放器时自动跳到旧位置，可能立刻触发一轮 `timeupdate`
   - 这不是阻塞风险，但执行时要注意不要引入无意义写入风暴

### Low risk / resolved

1. **TorrServer / Aria2 是否需要新增 `isConnected`**
   - **RESOLVED:** 不需要，两个 composable 已有该字段

2. **R18 detail handler 是否需要补防御**
   - **RESOLVED:** 不需要，已有 403

3. **movie-app 是否必须接 i18n 才能做 tooltip**
   - **RESOLVED:** 不必，本期接受原生 `title`

## Sources

### Primary (HIGH confidence)

- `.planning/phases/03-movie-app-r2/03-CONTEXT.md`
- `.planning/phases/03-movie-app-r2/03-DISCUSSION-LOG.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `apps/movie-app/src/views/Player.vue`
- `apps/movie-app/src/views/MovieDetail.vue`
- `apps/movie-app/src/composables/useAria2.ts`
- `apps/movie-app/src/composables/useTorrServer.ts`
- `apps/movie-app/src/main.ts`
- `apps/movie-app/package.json`
- `apps/api/src/routes/public/movies/index.ts`
- `packages/locales/src/zh-CN/movie.ts`
- `packages/locales/src/en-US/movie.ts`

### Secondary (MEDIUM confidence)

- `apps/movie-app/playwright.config.ts`
- `apps/movie-app/vitest.config.ts`
- `apps/movie-app/src/utils/__tests__/torrServerClient.test.ts`
- `apps/movie-app/src/utils/__tests__/torrServerClient.integration.test.ts`

### Tertiary (LOW confidence / inferred)

- xgplayer 3.x 更细的事件对象 shape：本轮未通过本地依赖源码直接核对，建议执行阶段以最小事件集（`error`/`waiting`/`canplay`/`playing`）落地，避免依赖复杂 payload。

## Metadata

**Confidence breakdown:**

- Current code state: HIGH
- API/R18 conclusions: HIGH
- i18n/runtime assessment: HIGH
- xgplayer retry strategy recommendation: MEDIUM-HIGH
- exact xgplayer event payload details: MEDIUM

**Research date:** 2026-05-12
**Valid until:** 2026-06-12（前提：movie-app 未在此期间整体切换播放器）

## RESEARCH COMPLETE

