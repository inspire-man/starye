# Phase 4: 统一 Progress 表 + 漫画阅读/视频观看进度 - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

用一张统一 `progress` 表收口 movie / comic 两条现有进度能力，让“打开即恢复”成为稳定、可解释、可测试的正式行为。

**In scope（本 phase 收口）：**

- 新建统一 `progress` 表，按 `userId + contentType + contentId` 记录 movie / comic 进度
- 用统一模型替换现有 `reading_progress` / `watching_progress` 两张旧表、旧 API、旧前端调用
- movie 端：恢复播放位置、保存进度、完成判定、历史 / 继续观看聚合规则
- comic 端：恢复页码、保存页码、章节完成判定、阅读历史聚合规则
- 进度入口与进度页面的登录门控统一到 `/auth/login?next=...`
- 同期删除旧表与双轨兼容逻辑，不保留迁移兜底

**Out of scope（本 phase 明确不做）：**

- 旧阅读 / 观看进度数据迁移、回填或提示公告
- 新增“继续阅读首页横幅”、独立 comic 历史页、额外发现型 UI 打磨（`CONT-01/02` 仍留在 v1.x）
- 播放器错误恢复、streamUrl 安全门禁、Sentry、部署 / migration 运行保障（分别留在 Phase 3 / 5）
- 把所有 progress 相关内部动作强行抽成全站统一 guard；本期只收口入口与页面级门控

</domain>

<decisions>
## Implementation Decisions

### 旧进度实现退场

- **D-01:** Phase 4 采用**硬切换**：旧 `reading_progress` / `watching_progress` 数据**不迁移**，不做兼容兜底读取。
- **D-02:** 旧实现一步到位退场：统一 `progress`` 表、新 API、新前端调用在同一 phase 全量替换，**不**保留“旧 API 外壳转发到新表”的过渡层。
- **D-03:** cutover 后按**空进度**处理；不做“进度系统已重置”提示、toast、banner 或公告。
- **D-04:** Phase 4 的 migration 同期**直接删除** `reading_progress` / `watching_progress` 旧表，不留 `_legacy`、不延后到后续 ops / migration phase。
- **D-05:** 统一表只保留一套正式语义：planner 不应继续维护两张旧表或双写逻辑。

### Movie 进度语义

- **D-06:** movie 的“已看完”阈值固定为 **`progress / duration >= 90%`**。
- **D-07:** 已看完影片下次再次打开时，**从头开始播放**，不自动 seek 到结尾附近。
- **D-08:** 用户重新开始播放一个已看完影片时，`completed` **在新会话开始时立即清掉**。
- **D-09:** 已看完影片仍保留在历史中；“继续观看”只排除 `completed=true` 的记录，历史可分“全部 / 在看 / 已看完”。
- **D-10:** movie 进度作用域固定为**按影片聚合**，不是按具体 `player` 源聚合；同一影片不同播放源共享一个进度。
- **D-11:** 用户在同一影片里手动切换播放源时，新源也应尽量恢复这条**共享进度**。
- **D-12:** 历史 / 继续观看列表对同一影片**始终只显示一条记录**，以该影片最近一次有效进度为准。
- **D-13:** Phase 4 **不记录最近使用的播放源**；统一表只记录“看到哪”，不记录“用哪个源看到哪”。
- **D-14:** **小于 30 秒**的影片进度既**不自动恢复**，也**不写入统一表**；把试播 / 误触当噪音过滤掉。
- **D-15:** 对 `duration` 缺失的影片，**取消**当前 `History.vue` 的 `progress >= 3600` 秒兜底推断；是否完成统一依赖显式 `completed` 标记，不再做时长猜测。
- **D-16:** 可信 TorrServer / `streamUrl` 直达播放路径**纳入同一套 movie 进度模型**，不再排除在统一进度之外。
- **D-17:** `streamUrl` 模式沿用与普通 movie 播放源**相同**的 30 秒阈值、完成判定与共享进度规则。

### Comic 进度语义

- **D-18:** 章节读到最后一页时，记录 `completed=true`。
- **D-19:** 章节完成时，`position` 仍记录为**最后一页**；“下次打开回第一页”由读取逻辑决定，不通过篡改存储位置实现。
- **D-20:** 已完成章节下次再次打开时，默认**回到第一页**，按重读处理。
- **D-21:** 用户重新开始阅读一个已完成章节时，`completed` **在新会话开始时立即清掉**。
- **D-22:** 已完成章节仍保留在阅读历史 / 进度列表中，未完成与已完成可以分开看；不要完成后直接消失。

### 进度入口与页面门控

- **D-23:** 匿名用户面对进度入口时，入口**可见**，但点击后直接跳 `/auth/login?next=...`。
- **D-24:** 匿名用户若直接访问进度页面本身，也应在进入页面前**直接重定向**到登录页，而不是显示空态或 toast 阻断。
- **D-25:** Phase 4 的门控落点只做到**进度入口与进度页面路由**，不把 Reader / Player 内部“未登录则不写”这种自然保护扩 scope 成新系统。
- **D-26:** Phase 4 要把现有 movie / comic 的“toast 阻断”统一改成和 Phase 2 收藏按钮一样的 **`next` 登录跳转语义**。
- **D-27:** 已存在的 `useAuthGuard(nextPath?)` 设计继续沿用，作为进度入口跳转的首选复用点；planner 不应另造第二套同义 guard。

### Phase 4 UI / Scope Discipline

- **D-28:** Phase 4 只更新**现有**进度消费面与必要入口：movie 的 `Home.vue` / `History.vue` / `Profile.vue` / `Player.vue`，comic 的 `Reader.vue` / `Profile.vue` 与对应路由门控。
- **D-29:** 不把 scope 扩成“新增 comic 首页继续阅读横幅”或“新建独立 comic 历史页”；这些仍按 `CONT-01/02` 或后续 phase 处理。

### the agent's Discretion

- 统一 `progress` 表的具体列名（如 `position` / `duration` / `completed` / `updatedAt` / `contentType` / `contentId`）由 planner 在不违背 `PROG-01..08` 的前提下定稿。
- API 路径形状（保留现有 `/public/progress/*` 风格并重构，还是改成更统一的 `PUT /api/progress/:contentType/:id` 映射）由 planner 决定，但外部行为必须满足这里锁定的语义。
- “新会话开始时立即清掉 completed” 的精确触发点（例如 `play` / 首次有效 `timeupdate` / Reader 首次有效翻页）由 planner 结合现有事件流选择，只要对用户体感是“重新开始就算新的未完成会话”即可。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图

- `.planning/ROADMAP.md` Phase 4 段 — phase goal、`PROG-01..08`、5 条 success criteria
- `.planning/REQUIREMENTS.md` § Progress（`PROG-01..08`）— 统一表、索引、upsert、恢复、写入、completed 原始要求
- `.planning/REQUIREMENTS.md` § Continue Rails — `CONT-01/02` 仍属 v1.x / 后续能力，避免把 Phase 4 scope 扩大
- `.planning/PROJECT.md` — v1 “能用、不崩”优先，说明本 phase 应优先收口语义而非扩展花哨入口
- `.planning/STATE.md` — 当前 milestone 状态与 P4 kick-off 备注（视频进度粒度倾向 int seconds）

### 上游上下文约束

- `.planning/phases/01-auth-gateway/01-CONTEXT.md` — Phase 1 的登录态与 gateway 会话基线，解释为什么 progress 可以安全按 `userId` 分片
- `.planning/phases/02-dashboard/02-CONTEXT.md` — Phase 2 已把“历史/进度入口门控” defer 到 Phase 4，并已落地 `useAuthGuard(nextPath?)`
- `.planning/phases/03-movie-app-r2/03-CONTEXT.md` — Phase 3 明确把 progress 留给 Phase 4，同时 `streamUrl` 安全门禁已固定

### 数据模型与 API

- `packages/db/src/schema.ts` — 现有 `reading_progress` / `watching_progress` 旧表定义，Phase 4 要替换并删除
- `apps/api/src/routes/public/progress/index.ts` — 当前进度 API 的真实读写路径与历史聚合行为
- `apps/api/src/schemas/progress.ts` — 当前 reading / watching 的 schema 形状与验证限制
- `apps/api/src/routes/public/progress/__tests__/progress.test.ts` — 现有历史列表与认证守卫测试基线

### Movie 端现有消费面

- `apps/movie-app/src/views/Player.vue` — 当前恢复 / 保存进度、`streamUrl` 模式、同影片按 `movieCode` 聚合的关键位置
- `apps/movie-app/src/views/Home.vue` — 当前“继续观看” rail，仅对未完成记录展示
- `apps/movie-app/src/views/History.vue` — 当前历史页、“在看 / 已看完”切分逻辑、`duration` 缺失兜底逻辑
- `apps/movie-app/src/views/Profile.vue` — 现有观看历史 tab 的另一消费面
- `apps/movie-app/src/lib/api-client.ts` — `progressApi` 现有客户端边界
- `apps/movie-app/src/router.ts` — 当前 `/history` 受保护路由与 toast 阻断逻辑
- `apps/movie-app/src/composables/useAuthGuard.ts` — 已有 `next` 登录跳转 guard，可直接复用

### Comic 端现有消费面

- `apps/comic-app/src/views/Reader.vue` — 当前恢复页码、滚动保存、章节 ID 使用方式
- `apps/comic-app/src/views/Profile.vue` — 当前阅读历史列表消费面
- `apps/comic-app/src/lib/api-client.ts` — `progressApi` 现有 reading 端客户端边界
- `apps/comic-app/src/router.ts` — 当前受保护路由与 toast 阻断逻辑
- `apps/comic-app/src/composables/useAuthGuard.ts` — 与 movie 对齐的 `next` guard

### 代码库背景

- `.planning/codebase/STACK.md` — Cloudflare Workers + D1 + Vue/Pinia 基线，说明 D1 schema / route / SPA 边界
- `.planning/codebase/ARCHITECTURE.md` — Gateway / API / Frontend / D1 分层与进度相关组件职责
- `.planning/codebase/INTEGRATIONS.md` — Better Auth、cookie 会话、gateway / API 环境集成，辅助理解门控行为
- `.planning/codebase/CONCERNS.md` — 当前大组件、测试覆盖与 fragile 区，提醒 planner 保持 Phase 4 改动聚焦

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/movie-app/src/composables/useAuthGuard.ts` 与 `apps/comic-app/src/composables/useAuthGuard.ts`：已支持 `nextPath`，正是 Phase 4 历史/进度入口门控要复用的资产
- `apps/api/src/routes/public/progress/__tests__/progress.test.ts`：已有认证守卫、历史列表、limit 处理测试骨架，适合作为 unified progress API 回归入口
- `apps/movie-app/src/views/Home.vue` / `History.vue` / `Profile.vue`：已有“继续观看 / 历史”真实消费面，无需为 Phase 4 重新发明 movie 侧 UI
- `apps/comic-app/src/views/Profile.vue`：已有阅读历史板块，可作为统一进度落地后的现成 comic 消费面

### Established Patterns

- 当前进度 API 全部挂在 `/api/public/progress/*`，并统一要求登录；新的实现应保留“未登录不读不写”的安全边界
- movie 端当前按 `movieCode` 聚合一条进度；本轮 discussion 明确要求保留这个影片级语义，而非下沉到 `player` 粒度
- Reader / Player 都是前端事件驱动写入：movie 有 `timeupdate` / `pause` / `seek` 语义，comic 有滚动 / 翻页语义；planner 应在这个基础上统一，而不是引入全新交互模型
- 两个 app 的 router 现在对受保护页使用“toast + 阻断”；Phase 4 要把 progress 相关入口 / 页面改成 `next` 登录跳转，收藏按钮语义已经在 Phase 2 证明过可复用

### Integration Points

- 数据层：`packages/db/src/schema.ts` 与对应 drizzle migration 要从双表切到统一 `progress` 表
- API 层：`apps/api/src/routes/public/progress/index.ts` 与 `apps/api/src/schemas/progress.ts` 要统一 movie / comic 的入参与返回模型
- movie 前端：`Player.vue` 的恢复/写入逻辑、`Home.vue` 的 continue rail、`History.vue` / `Profile.vue` 的历史聚合逻辑
- comic 前端：`Reader.vue` 的恢复/写入逻辑、`Profile.vue` 的阅读历史聚合逻辑
- 门控层：`movie-app/src/router.ts`、`comic-app/src/router.ts` 与两个 `useAuthGuard.ts` 的统一登录跳转收口

</code_context>

<specifics>
## Specific Ideas

- 用户明确选择 **clean cutover**：旧进度不迁移、不兼容、不公告，Phase 4 同期删旧表。
- 用户要求 movie / comic 的“已完成后重开”语义保持一致：都把重新打开视作**新的从头开始会话**。
- 用户要求 progress 只表达“看到哪 / 读到哪”，**不顺手承载最近使用源偏好**。
- 用户明确授权：后续未问完的小灰区（极短进度、无 duration 兜底、`streamUrl` 是否纳入统一 progress）可直接采用推荐选项，因此这些决定同样视为已锁定。

</specifics>

<deferred>
## Deferred Ideas

- 不在 Phase 4 新增 comic 首页“继续阅读”横幅或独立 comic 历史页；这类新入口 / 新 discoverability 仍属 `CONT-01/02` 或后续 phase。
- 不在 Phase 4 记录“最近使用的播放源”或做按源偏好恢复；如果未来确有价值，再单独作为播放器 UX phase 讨论。
- 不为 `duration` 缺失影片追加新的猜测性完成规则；若后续数据质量需要，可在 crawler / metadata phase 解决。

</deferred>

---

*Phase: 04-progress*
*Context gathered: 2026-05-13*
