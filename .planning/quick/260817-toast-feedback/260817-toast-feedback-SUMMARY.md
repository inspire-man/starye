---
quick: 260817-toast-feedback
date: 2026-08-17
status: complete
---

# 统一全平台异步操作反馈与 Toast 体验

## Delivered

- `@starye/ui` 共享 Toast 增加主题 token、语义图标、`title`/`action`、进度条无障碍属性、键盘关闭、移动端布局和 reduced-motion 支持。
- action 支持异步 loading，成功后按配置关闭；普通 Toast 自动过期，进度 Toast 保持可更新。
- Movie App 的 `useToast` 保留既有 `toast`、`showToast`、`success`、`error`、`info` 调用契约，实际渲染统一进入共享 `ToastContainer`。
- `Profile.vue` 与 `MovieDetail.vue` 移除局部重复 Toast，Dashboard 与 Movie App 的反馈入口统一到同一套视觉和交互基础。
- 未修改 API、数据库、爬虫执行和下载/播放业务流程；失败反馈仍由原有 handler 决定。

## Scope

本 quick task 仅修改共享 Toast 基础组件、Movie App 反馈适配、相关测试和 GSD 记录；未覆盖到的工作树修改保持原样。

## Residual

- 三端 build 使用既有本地生成环境文件完成；Dashboard 保留既有大 chunk warning。
- 本轮以组件测试、类型检查、lint、build 和 `git diff --check` 作为自动化证据；Gateway 未登录跳转不作为已登录业务页面的功能证据。
