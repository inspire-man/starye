## Why

Starye monorepo 在过去一个月经历了密集迭代（24 个变更），功能成长很快，但基础设施出现了明显的碎片化：

- **主题系统四套并存**：@starye/ui 用 shadcn/ui HSL 变量，Dashboard 用 Element Plus 风格色阶，Movie App 用 sky 色系，Comic App 用 orange 色系。变量命名不兼容，组件无法跨 app 复用。
- **API 调用层四种写法**：Dashboard 用原生 fetch + 手写类型（453 行），Movie App 用 axios + 手写类型（183+234 行），Comic App 用 axios + 手写类型（80+60 行），Blog 用 Nuxt useFetch + 手写 URL。Hono RPC Client 已在 Dashboard 和 Blog 创建但未实际使用。
- **UI 组件零复用**：Dashboard 有 17 个通用组件全部 `<style scoped>` 硬编码色值，@starye/ui 仅 3 个卡片组件。
- **前端 app 成熟度参差**：Movie App 58 文件 / 14 测试，Comic App 12 文件 / 0 测试，Blog 6 页面 / 1 E2E。
- **关键路径零测试**：Gateway 路由和 Auth flow 无任何测试覆盖。

现在是统一整合的最佳时机 — 变更归档后无活跃分支，可以做一次干净的基建升级。

## What Changes

### 基建线 (Track A)

- **A0 — 统一主题体系**：所有 app MUST 通过 `@import "@starye/ui/globals.css"` 接入 shadcn/ui CSS 变量体系，各 app 仅通过 `:root` 覆盖品牌色。删除 Dashboard 的 `theme.css`、Movie App 和 Comic App 的 `tailwind.config.js`（迁移到 TW v4 `@theme`）。
- **A1 — UI 组件库扩充**：从 Dashboard 提取 8+ 通用组件（Pagination、DataTable、ConfirmDialog、FilterPanel、Toast/ToastContainer、ErrorDisplay、Skeleton 系列）到 `@starye/ui`，全部改用 Tailwind class 样式。配套 composable（useToast、usePagination、useFilters）一并提取。
- **A2 — Hono RPC 全量迁移**：所有前端 app MUST 使用 `hc<AppType>()` 替代手写 API 调用层。删除 Dashboard 的 `lib/api.ts` 手写类型、Movie App 的 `types.ts` + `api.ts`（axios）、Comic App 的 `types.ts` + `api.ts`（axios）、Blog 的手写 URL 调用。移除 axios 依赖。Auth API 调用保留 Better Auth 官方客户端。
- **A3 — 关键路径测试覆盖**：Gateway 路由单元测试（路径匹配 + 路径重写 + 环境检测），Auth flow E2E 测试（登录跳转 + 会话获取 + 权限守卫）。

### 产品线 (Track B)

- **B1 — Blog 增强**：代码高亮（Shiki/Prism）、搜索功能、归档页、RSS Feed、阅读进度条、代码块复制按钮、SEO Open Graph 完善。
- **B2 — Comic App 功能补齐**：对齐 Movie App 功能水平 — 收藏系统、搜索增强、Toast 通知、移动端适配。在 A2 完成后启动，直接使用 Hono RPC + 共享 UI 组件。

### 执行策略

- Track A 和 Track B1（Blog 增强）SHALL 并行推进，二者触及不同文件域。
- Track B2（Comic App 补齐）SHALL 在 A2（RPC 迁移）完成后启动，避免"做了再拆"。
- Track A3（测试覆盖）SHALL 在其他改动稳定后进行。

## Capabilities

### New Capabilities

- `unified-theme-system`: 统一 CSS 变量体系 — 所有 app 共享 shadcn/ui 设计 token，支持品牌色覆盖
- `shared-ui-components`: 通用 UI 组件库扩充 — 从 Dashboard 提取通用组件到 @starye/ui
- `hono-rpc-migration`: Hono RPC 全量迁移 — 替代所有手写 API 调用层，实现端到端类型安全
- `blog-reading-enhancement`: Blog 阅读体验增强 — 代码高亮、搜索、归档、RSS、阅读进度
- `comic-app-feature-parity`: Comic App 功能对齐 — 收藏、搜索、Toast、移动端适配
- `gateway-auth-test-coverage`: Gateway 路由 + Auth flow 测试覆盖

### Modified Capabilities

（无现有 spec 需要修改，本次全部为新增能力）

## Impact

- **涉及 app**：全部 7 个 app（api、blog、dashboard、movie-app、comic-app、auth、gateway）+ 3 个 package（ui、api-types、config）
- **依赖变更**：movie-app 和 comic-app 新增 `hono` 依赖，移除 `axios`；可能新增代码高亮库（Shiki）
- **Breaking**：Dashboard 组件引用路径变更（从 `@/components/X` 到 `@starye/ui`）；API 调用层接口变更（从 `fetchApi`/`axios` 到 `hc<AppType>()`）
- **风险**：RPC 迁移范围大（涉及 ~40 个 view/component 文件的 API 调用），需确认 API 端所有 handler 返回类型明确
