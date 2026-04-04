## Context

Starye monorepo 包含 7 个 app 和 6 个 package，部署在 Cloudflare 平台（Workers + Pages + D1 + R2）。经过一个月密集开发，各 app 在主题系统、API 调用方式、UI 组件上各自演化，形成四套不兼容的体系。本设计文档描述如何在不中断功能的前提下统一技术栈。

### 当前状态

| 维度 | @starye/ui + Blog + Auth | Dashboard | Movie App | Comic App |
|------|-------------------------|-----------|-----------|-----------|
| CSS 变量 | shadcn/ui HSL | Element Plus 风格色阶 | 无变量体系 | 无变量体系 |
| Tailwind | v4 @theme | v4（几乎不用） | v4 + v3 config | v4 + v3 config |
| API 调用 | useFetch 手写 URL | fetchApi 手写类型 | axios 手写类型 | axios 手写类型 |
| 组件样式 | Tailwind class | `<style scoped>` 硬编码 | 混合 | 混合 |
| 品牌色 | 深靛蓝 | 蓝色 #3b82f6 | 天蓝 #0ea5e9 | 橙色 #f97316 |

## Goals / Non-Goals

**Goals:**
- 所有 app 共享统一的 CSS 变量体系（shadcn/ui token），各 app 保持自己的品牌色
- 通用 UI 组件从 Dashboard 提取到 @starye/ui，全部使用 Tailwind class
- 所有前端 app 使用 Hono RPC 实现端到端类型安全，消除手写类型和手写 URL
- Blog 阅读体验达到技术博客主流水平
- Comic App 功能对齐 Movie App
- Gateway 和 Auth flow 的关键路径有测试覆盖

**Non-Goals:**
- 不引入新的 UI 框架（不用 Vuetify、Naive UI 等）
- 不重构 API 端路由结构
- 不改变部署架构（仍然 Cloudflare Workers + Pages）
- 不做 SSR/SSG 迁移（Movie App / Comic App 保持 SPA）
- Dashboard 暗色模式（留作后续）
- 评论系统（Blog 不在本次范围）

## Decisions

### D1: 主题体系 — 统一到 shadcn/ui CSS 变量

**选择**：所有 app 以 `@starye/ui/globals.css` 为唯一主题源，通过 `:root` CSS 变量覆盖实现品牌色差异。

**替代方案**：每个 app 维护独立主题，组件通过 props 传色值 → 否决，因为组件数量多，props 穿透代价大。

**具体实施**：

```
packages/ui/src/assets/globals.css     ← 定义 @theme 映射 + :root 默认值 + .dark 暗色
                                          (已有，保持不变)

apps/blog/app/assets/css/main.css      ← @import "@starye/ui/globals.css"  (已有)
apps/auth/app/assets/css/main.css      ← @import "@starye/ui/globals.css"  (已有)
apps/dashboard/src/style.css           ← @import "@starye/ui/globals.css" + 删除 theme.css
apps/movie-app/src/style.css           ← @import "@starye/ui/globals.css" + 品牌色覆盖
apps/comic-app/src/style.css           ← @import "@starye/ui/globals.css" + 品牌色覆盖
```

品牌色覆盖示例：
```css
/* movie-app: 天蓝品牌色 */
:root {
  --primary: 199 89% 48%;
  --primary-foreground: 0 0% 100%;
}

/* comic-app: 橙色品牌色 */
:root {
  --primary: 25 95% 53%;
  --primary-foreground: 0 0% 100%;
}
```

需要删除的文件：
- `apps/dashboard/src/styles/theme.css`（164 行 Element Plus 风格色阶）
- `apps/movie-app/tailwind.config.js`（v3 config，迁移到 @theme）
- `apps/comic-app/tailwind.config.js`（v3 config，迁移到 @theme）

### D2: UI 组件提取 — Tailwind class 重写 + 提取到 @starye/ui

**选择**：从 Dashboard 提取高通用性组件，重写为 Tailwind class 样式，放入 `@starye/ui`。

**提取清单（第一批）**：

| 组件 | 来源 | 改造要点 |
|------|------|---------|
| Pagination | Dashboard | 硬编码 CSS → Tailwind，去 i18n 依赖 |
| DataTable | Dashboard | 硬编码 CSS → Tailwind，保留泛型设计 |
| ConfirmDialog | Dashboard | 硬编码 CSS → Tailwind |
| FilterPanel | Dashboard | 硬编码 CSS → Tailwind |
| Toast + ToastContainer | Dashboard | 合并 Dashboard 和 Movie App 两套实现 |
| ErrorDisplay | Dashboard | 硬编码 CSS → Tailwind |
| SkeletonCard | Dashboard | 保持 shimmer 动画 |
| SkeletonTable | Dashboard | 保持 shimmer 动画 |

**配套 composable 提取**：

| Composable | 来源 | 说明 |
|------------|------|------|
| useToast | Dashboard + Movie App | 合并两套实现为统一 API |
| usePagination | Dashboard | 无外部依赖，直接提取 |
| useFilters | Dashboard | 无外部依赖，直接提取 |

**包结构调整**：
```
packages/ui/src/
├── assets/globals.css
├── lib/utils.ts
├── components/
│   ├── MovieCard.vue       (已有)
│   ├── ComicCard.vue       (已有)
│   ├── PostCard.vue        (已有)
│   ├── Pagination.vue      (新增)
│   ├── DataTable.vue       (新增)
│   ├── ConfirmDialog.vue   (新增)
│   ├── FilterPanel.vue     (新增)
│   ├── Toast.vue           (新增)
│   ├── ToastContainer.vue  (新增)
│   ├── ErrorDisplay.vue    (新增)
│   ├── SkeletonCard.vue    (新增)
│   └── SkeletonTable.vue   (新增)
├── composables/
│   ├── useToast.ts         (新增)
│   ├── usePagination.ts    (新增)
│   └── useFilters.ts       (新增)
└── index.ts                (更新导出)
```

### D3: Hono RPC 全量迁移

**选择**：一次性迁移所有 4 个前端 app 到 `hc<AppType>()`，删除所有手写 API 类型。

**替代方案**：渐进式迁移（新代码用 RPC，老代码逐步迁移）→ 否决，因为维护两套调用方式会让代码更混乱。

**迁移路径**：

```
Step 1: 验证 API 端类型完整性
  - 检查 apps/api/src/index.ts 的链式路由是否覆盖所有公开端点
  - 确认每个 handler 的返回类型是否明确（不能是 any）

Step 2: 为每个 app 创建统一的 RPC client
  - Dashboard: 复用 lib/hono-rpc-client.ts（已存在），但加入 credentials: 'include'
  - Movie App: 新建 lib/api-client.ts，替代 api.ts
  - Comic App: 新建 lib/api-client.ts，替代 api.ts
  - Blog: 复用 composables/useApiClient.ts（已存在）

Step 3: 逐 app 迁移 view 文件中的 API 调用
  - 替换 fetchApi/axios/useFetch → hc 客户端链式调用
  - 删除手写的类型定义文件

Step 4: 清理
  - 删除手写类型文件
  - 从 movie-app 和 comic-app 的 package.json 中移除 axios
```

**Auth API 例外处理**：Better Auth 的路由（`/auth/get-session`、`/auth/sign-in/social` 等）不走 Hono 的链式类型推导。处理策略：
- Movie App / Comic App 的 authApi 模块保留，改用 `fetch` 替代 `axios`（删除 axios 依赖时）
- Dashboard 和 Blog 已有 Better Auth 的客户端，不需要改

### D4: Blog 增强技术选型

| 功能 | 技术选型 | 理由 |
|------|---------|------|
| 代码高亮 | Shiki | Nuxt 生态有 `nuxt-shiki`，支持 SSR，主题丰富 |
| 搜索 | 客户端全文搜索（基于已有 API） | 文章数量有限，无需引入 Algolia 等 |
| 归档页 | 新增 `/archive` 页面 | 按时间线展示所有文章 |
| RSS Feed | Nuxt server route 生成 | 标准 RSS 2.0 XML |
| 阅读进度条 | 纯 CSS/JS 组件 | 滚动进度可视化 |
| 代码块复制 | 自定义指令或组件 | 点击复制到剪贴板 |
| SEO | Nuxt 的 `useHead` + `useSeoMeta` | 补充 Open Graph 和 Twitter Card |

### D5: Comic App 功能补齐策略

Comic App 在 A2（RPC 迁移）完成后启动，直接基于新技术栈构建：
- 使用 `hc<AppType>()` 调用 API（不再走 axios）
- 使用 `@starye/ui` 的共享组件（Toast、Pagination 等）
- 使用 shadcn/ui 变量体系 + 橙色品牌覆盖
- 功能参照 Movie App：收藏系统、搜索增强、移动端适配

### D6: 测试策略

**Gateway 路由测试**：纯单元测试，不需要启动真实服务。Mock `fetch` 函数，验证：
- 路径匹配逻辑（/api → API, /dashboard → Dashboard, etc.）
- 路径重写逻辑（生产环境剥离前缀）
- 本地/生产环境检测
- 代理头部设置（X-Forwarded-Host 等）

**Auth E2E 测试**：使用 Playwright，覆盖：
- 未登录时 Dashboard 守卫跳转到 /auth/login
- 模拟 GitHub OAuth 回调（mock callback URL）
- 会话持久化（Cookie 设置正确性）
- 权限不足时的 /unauthorized 页面

## Risks / Trade-offs

**[RPC 迁移 — API handler 返回类型退化]**
→ 缓解：迁移前先扫描所有 handler，确认返回类型不含 `any`。如发现问题先修 API 端。

**[Dashboard 组件提取 — 样式回归]**
→ 缓解：提取后对 Dashboard 做视觉回归检查。组件保持相同的 UI 行为，只是样式实现方式从硬编码 CSS 变为 Tailwind class。

**[主题覆盖 — 品牌色不够精确]**
→ 缓解：shadcn/ui 的 HSL 变量体系足够灵活。必要时可扩展 `--secondary`、`--accent` 等变量。Movie App 和 Comic App 的品牌色差异主要在 `--primary` 一个变量。

**[Blog 搜索 — 性能]**
→ 缓解：文章数量当前有限（< 100），客户端搜索足够。未来文章量增大时可迁移到 KV-based 索引。

**[Comic App 延迟启动]**
→ 权衡：等待 RPC 迁移完成再补齐 Comic App，短期内 Comic App 功能不变。但避免了做了再拆的浪费。
