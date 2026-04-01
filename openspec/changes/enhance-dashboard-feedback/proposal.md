## Why

Dashboard 管理端目前缺少统一的用户反馈系统，导致用户体验存在明显短板：操作后无明确的成功/失败提示，加载状态只有简单的"加载中"文字，错误信息直接输出到控制台。这些问题影响了管理员的操作效率和信心，尤其在批量操作、数据保存等关键场景中，用户无法清晰了解操作状态。

通过实现统一的反馈系统（Toast 通知、骨架屏、错误处理），我们 **SHALL** 为所有 Dashboard 页面提供一致、友好的用户体验，减少操作焦虑，提升感知性能。

## What Changes

### 1. Toast 通知系统
- 实现全局 Toast 组件，支持 success/error/warning/info 四种类型
- 创建 `useToast` composable，提供统一的 API
- 支持自动消失、手动关闭、多 Toast 队列管理
- 替换现有页面中的 `alert()` 和 `console` 调用

### 2. 骨架屏加载效果
- 创建通用骨架屏组件（Table/Card/Form）
- 在数据加载时显示骨架屏而非空白/纯文字
- 改进感知性能，减少布局跳动

### 3. 错误处理改进
- 创建 `ErrorDisplay` 组件，统一错误展示样式
- 实现错误边界处理（Vue 错误捕获）
- 提供友好的错误消息和操作建议
- 区分网络错误、权限错误、业务错误

### 4. 批量操作反馈增强
- 在批量操作时显示进度条
- 展示成功/失败数量和详细错误信息

## Capabilities

### New Capabilities
- `toast-notification`: Toast 通知系统，提供全局统一的成功/错误/警告/信息提示
- `skeleton-loading`: 骨架屏加载组件，改善数据加载时的视觉体验
- `error-handling-ui`: 错误处理 UI 组件，提供友好的错误展示和操作建议

### Modified Capabilities
<!-- 此变更不修改现有 spec，仅新增 UI 组件和 composables -->

## Impact

### 前端代码
- **新增组件**：
  - `apps/dashboard/src/components/Toast.vue` - Toast 通知组件
  - `apps/dashboard/src/components/ToastContainer.vue` - Toast 容器
  - `apps/dashboard/src/components/SkeletonTable.vue` - 表格骨架屏
  - `apps/dashboard/src/components/SkeletonCard.vue` - 卡片骨架屏
  - `apps/dashboard/src/components/ErrorDisplay.vue` - 错误展示组件
  
- **新增 Composables**：
  - `apps/dashboard/src/composables/useToast.ts` - Toast 管理（已存在于 movie-app，需复制并调整）
  - `apps/dashboard/src/composables/useErrorHandler.ts` - 错误处理

- **修改页面**：
  - `Movies.vue` - 替换 alert，添加骨架屏
  - `Actors.vue` - 替换 alert，添加骨架屏
  - `Publishers.vue` - 替换 alert，添加骨架屏
  - `Crawlers.vue` - 添加错误处理
  - `Home.vue` - 添加骨架屏
  - 其他管理页面（按需逐步迁移）

- **修改布局**：
  - `DefaultLayout.vue` - 添加 ToastContainer

### 用户体验
- ✅ 所有操作都有明确的反馈（成功/失败）
- ✅ 加载状态更友好，减少白屏感
- ✅ 错误信息更清晰，提供操作建议
- ✅ 批量操作有进度显示

### 兼容性
- 此变更为纯 UI 改进，不影响后端 API
- 不涉及数据库 schema 变更
- 现有功能保持向后兼容

### 依赖
- 无新增外部依赖
- 复用 movie-app 中已有的 `useToast` 模式
- 使用 Vue 3 内置的 Teleport 实现 Toast 渲染
