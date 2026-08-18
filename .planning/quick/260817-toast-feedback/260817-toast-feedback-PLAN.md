---
quick_id: 260817-toast-feedback
title: 统一全平台异步操作反馈与 Toast 体验
status: complete
---

# 目标

把 `@starye/ui` 的 Toast/Progress 作为 Dashboard、Comic App、Movie App 的统一反馈基础，并保持 Movie App 现有 `useToast` 调用契约不变。

## 必须满足

- 共享 Toast 使用主题 token、语义图标、响应式布局、正确的 `role`/`aria-live` 和键盘关闭行为。
- 进度 Toast 保持可更新、不会被普通 Toast 自动移除；可选 action 为失败重试等后续操作保留入口。
- Movie App 的现有 `toast`、`showToast`、`success`、`error`、`info` 调用继续可用，但渲染统一进入共享 `ToastContainer`。
- Profile/MovieDetail 的局部重复 Toast 接入同一共享队列，避免同一平台出现多种样式。
- 不修改 API、数据库、下载/播放业务流程；失败反馈仍由原有业务 handler 决定。

## 任务

### 1. 升级共享 Toast 基础组件

- 文件：`packages/ui/src/composables/useToast.ts`、`packages/ui/src/components/Toast.vue`、`packages/ui/src/components/ToastContainer.vue`
- 动作：增加 title/action 类型、语义主题 token、图标、loading/action 状态、移动端布局、progress 无障碍语义；保留现有导出函数签名兼容性。

### 2. 迁移 Movie App 反馈入口

- 文件：`apps/movie-app/src/composables/useToast.ts`、`apps/movie-app/src/App.vue`、`apps/movie-app/src/views/Profile.vue`、`apps/movie-app/src/views/MovieDetail.vue`
- 动作：将本地 Toast composable 改为共享 Toast 的兼容适配器，挂载共享 ToastContainer，移除重复的局部渲染。

### 3. 回归与记录

- 更新共享 UI、Dashboard、Movie App 定向测试及 quick task 证据。
- 完成 type-check、lint、定向测试、`git diff --check`、GitNexus detect-changes 和 Gateway/浏览器边界记录。
