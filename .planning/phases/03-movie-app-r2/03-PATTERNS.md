# Phase 3: movie-app 播放稳定化（现有路径错误恢复） - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 11
**Analogs found:** 8 / 8（其余为同文件就地重构或文档类计划）

## File Classification

| 新建/修改文件 | Role | Data Flow | 最近 Analog | 匹配质量 |
|---|---|---|---|---|
| `.planning/REQUIREMENTS.md`（修改） | planning doc | requirements | 当前 Phase 3 CONTEXT 的 D-20 指令 | exact（doc sync） |
| `.planning/ROADMAP.md`（修改） | planning doc | roadmap | 当前 Phase 3 CONTEXT 的 D-21 指令 | exact（doc sync） |
| `.planning/PROJECT.md`（修改） | planning doc | project decisions | 当前 Key Decisions 表结构 | exact |
| `.planning/STATE.md`（修改） | planning doc | workflow state | Phase 1/2 计划完成后的状态表达 | exact |
| `apps/movie-app/src/views/Player.vue`（修改） | view | player state / media events | 自身现有 TorrServer overlay | exact（self-refactor） |
| `apps/movie-app/src/views/MovieDetail.vue`（修改） | view | button state / connection state | 自身现有按钮区块 | exact（self-refactor） |
| `apps/movie-app/src/utils/__tests__/torrServerClient.test.ts`（参考） | unit test | pure logic | TorrServer URL / file selection 纯逻辑测试 | role-match |
| `apps/movie-app/src/composables/__tests__/useAuthGuard.test.ts`（参考） | unit test | small UI state / browser redirect | composable 级轻测试骨架 | role-match |

## Pattern Assignments

### `apps/movie-app/src/views/Player.vue`（Phase 3 主战场）

**Analog:** 自身现有 `torrServerBuffering` / `torrServerError` overlay 逻辑

**当前状态组织：**

```ts
const isTorrServerMode = computed(() => !!route.query.streamUrl)
const torrServerBuffering = ref(false)
const torrServerError = ref('')
const currentMagnetUrl = ref('')
```

**现有事件绑定：**

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

**Pattern recommendation:**

- **保留** `isTorrServerMode`、`currentMagnetUrl`、`goToDetail()`、`fallbackToAria2()` 这些现有语义位。
- **合并掉** `torrServerBuffering` / `torrServerError` 这种“分支专用状态”，改成统一 `playerUiState` 或 `errorState + loadingState`。
- **不要**再新开第二套 overlay。直接把当前 TorrServer overlay 视觉模式升级成“统一 loading + error”。

**建议状态形状：**

```ts
type ErrorKind = 'torrserver' | 'xgplayer' | 'network' | 'source-invalid' | 'unknown'

const playerLoading = ref(false)
const playerError = ref<{
  visible: boolean
  kind: ErrorKind
  message: string
  recoverable: boolean
}>({
  visible: false,
  kind: 'unknown',
  message: '',
  recoverable: true,
})
```

这比把所有东西都塞进一个超级大对象更接近当前代码的风格，也比继续维持 `torrServerBuffering` / `torrServerError` 更可控。

### `apps/movie-app/src/views/MovieDetail.vue`（离线按钮反馈）

**Analog:** 自身现有按钮组渲染模式

当前关键模式是：

```vue
<button
  v-if="isMagnetLink(player.sourceUrl) && aria2Connected"
  class="..."
  @click="addToAria2(player)"
>
  ⬇️ Aria2
</button>

<button
  v-if="isMagnetLink(player.sourceUrl) && torrServerConnected"
  :disabled="torrServerLoading"
  class="..."
  @click="playViaTorrServer(player)"
>
  {{ torrServerLoading ? '⏳ 加载中' : '▶ 在线播放' }}
</button>
```

**Pattern recommendation:**

- 不再用 `v-if="... && aria2Connected"` / `v-if="... && torrServerConnected"` 把按钮直接藏掉。
- 改成：
  - `v-if="isMagnetLink(...)"` 决定“按钮种类是否适用”
  - `:disabled="!aria2Connected"` / `:disabled="!torrServerConnected || torrServerLoading"` 决定“当前能否操作”
  - `:title="..."` 决定最小提示

这与当前 Phase 2 的 `useAuthGuard` 方式一样，属于**最小局部修正**，不需要拆组件。

### `useAria2.ts` / `useTorrServer.ts`（连接态来源）

**Analog:** 当前对外 return 的 `isConnected`

```ts
return {
  config,
  isConnected,
  version,
  tasks,
  isLoading,
  ...
}
```

以及：

```ts
return {
  config,
  isConnected,
  serverVersion,
  isLoading,
  ...
}
```

**Pattern recommendation:**

- 不要为了 Phase 3 再包一层“player connectivity store”。
- 直接在 `MovieDetail.vue` / `Player.vue` 用现有 `isConnected`。
- 若需要按钮 title 文案，优先在 view 层通过 computed 拼出来，不反向塞回 composable。

### 测试模式

#### 1. 轻逻辑单测

**Analog:** `apps/movie-app/src/composables/__tests__/useAuthGuard.test.ts`

适合拿来验证：

- 离线时按钮 title 文案的计算函数
- 错误分类的纯函数
- retry eligibility 的纯函数

**不适合**直接照抄去测完整 `Player.vue`，因为 `Player.vue` 依赖真实 xgplayer 生命周期。

#### 2. 工具/集成测试

**Analog:** `apps/movie-app/src/utils/__tests__/torrServerClient.test.ts` 与 `torrServerClient.integration.test.ts`

适合拿来验证：

- TorrServer URL 构造仍可用
- 文件选择逻辑不被误伤
- 真实 TorrServer 集成在可用环境下仍通

这说明 Phase 3 的自动化验证更适合往“工具层”和“连接层”靠，而不是强顶一堆 brittle 的播放器 DOM 测试。

### 文档修订 plan 写法

**Analog:** `.planning/phases/02-dashboard/02-04-PLAN.md` 与 `02-05-PLAN.md`

从现有计划风格看，文档修订类 plan 依然使用标准 frontmatter + `<objective>` + `<tasks>` 结构，而不是额外发明“docs only”模板。  
Phase 3 的 Wave 0 可以照常写成 execute plan，只是 `files_modified` 全是 `.planning/*` 文件，`requirements` 字段明确写“VIDEO-04/05 + dropped VIDEO-01/02/03/06”。

## Shared Patterns

### 统一 overlay 视觉风格

**Source:** `Player.vue` 当前两个 `<Transition name="fade">` overlay

```vue
<Transition name="fade">
  <div
    v-if="isTorrServerMode && torrServerBuffering && !torrServerError"
    class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
  >
```

**Apply to:** Phase 3 的统一 loading / error 卡片  
结论：继续用 `absolute inset-0 ... bg-black/60|80 z-20` 是最稳的，不要在这个 phase 顺手重做播放器页面视觉系统。

### “返回详情页”作为次级动作

**Source:** `Player.vue` 当前错误 overlay 已有 `goToDetail()`

这意味着新的统一错误卡片可以保留：

- 主按钮：`重试`
- 次按钮：`返回详情页`
- 条件按钮：`添加到 Aria2`（仅 magnet + aria2Connected）

不需要重新发明交互路径。

### 原生 `title` 作为最小 tooltip

**Source:** 代码库里已经广泛用原生 `title`（如 `Header.vue`, `DownloadTaskPanel.vue` 等）

这给了 Phase 3 一个非常明确的最小实现模式：

```vue
<button
  :disabled="!aria2Connected"
  :title="aria2Connected ? '添加到 Aria2' : 'aria2 未连接，请先在设置中配置'"
>
```

这比为当前未接 i18n 的 movie-app 额外引入 tooltip 组件更符合现状。

## No Analog Found

以下内容没有好的现成 analog，应该在 plan 中按“保守实现”处理：

1. **Player 级错误状态机测试**
   - 仓库里没有 `Player.vue` 或类似大视图的成熟测试先例。
   - 结论：不要把 Phase 3 成败绑定在重型 view 单测上。

2. **xgplayer event payload 结构**
   - 当前仓库只监听事件名，不消费 payload。
   - 结论：实现时避免依赖 payload 细节，优先用“事件发生了”而不是“解析 event.data 字段”。

## Suggested Plan Granularity

基于 patterns，推荐的最稳定拆分：

1. **Plan 01：Wave 0 文档收敛**
2. **Plan 02：Player 统一 loading / error / retry**
3. **Plan 03：MovieDetail + Player 离线按钮与提示**
4. **Plan 04：自动化回归 + Human UAT**

不要再拆成“Player 事件绑定”和“Player 视觉 UI”两个 plan，因为二者都在同一个大文件里，拆开只会引入 merge 风险和验收边界模糊。

## PATTERNS COMPLETE

