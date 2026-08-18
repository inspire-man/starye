---
quick_id: 260817-kys
title: 优化共享二次确认弹窗并审计 Dashboard 高频确认操作
status: complete
---

# 目标

把 `@starye/ui` 的 `ConfirmDialog` 提升为全 Dashboard 可复用的确认基础组件，并确保危险操作、异步提交和合并表单在真实页面中保持可用。

## 必须满足

- 弹窗拥有平滑入场/退场、Esc 关闭、焦点保存/恢复、基础 Tab 焦点约束、body 滚动锁定和正确的 `aria-labelledby` / `aria-describedby`。
- danger/default 语义使用共享主题 token 和图标；危险操作默认不因遮罩点击误关闭；所有按钮声明 `type="button"`。
- 支持默认 slot、预览列表、文本确认、异步 `loading` 状态和移动端按钮布局；提交失败时仍能再次操作。
- 7 个调用页面的确认入口继续调用原有 API，异步操作期间按钮不可重复提交，成功/失败后的弹窗状态符合原有业务语义。

## 任务

### 1. 改造共享组件并补回归测试

- 文件：`packages/ui/src/components/ConfirmDialog.vue`、`apps/dashboard/src/components/__test__/ConfirmDialog.test.ts`
- 动作：增加主题化 danger/default 视觉、图标、Transition、ARIA、Esc/焦点/滚动行为、slot、loading 和按钮语义；覆盖打开、确认、取消、遮罩、Esc、文本确认、slot 和异步保持打开等行为。
- 完成：组件测试通过，`@starye/ui` type-check/lint 通过。

### 2. 闭合全部调用方的异步状态与文案语义

- 文件：`apps/dashboard/src/views/Actors.vue`、`Comics.vue`、`Crawlers.vue`、`Movies.vue`、`Posts.vue`、`Publishers.vue`、`R18Whitelist.vue`
- 动作：统一 danger/confirm/cancel 文案和 loading 绑定；为缺失的删除/批量/任务操作增加最小状态；保留合并表单 slot，并让成功关闭、失败可重试。
- 完成：页面原有 API handler 仍只触发一次，按钮在请求期间禁用，组件类型检查通过。

## 验证

- `pnpm --filter @starye/ui type-check`
- `pnpm --filter @starye/ui lint`
- `pnpm --filter dashboard type-check`
- `pnpm --filter dashboard test -- --run src/components/__test__/ConfirmDialog.test.ts`
- `pnpm --filter dashboard test -- --run src/views/__test__/Actors.test.ts src/views/__test__/Comics.test.ts src/views/__test__/Crawlers.test.ts src/views/__test__/Movies.test.ts`
- `pnpm --filter dashboard lint`
- `git diff --check`
- Gateway 浏览器检查：`http://localhost:8080/dashboard/...` 的确认弹窗视觉、Esc、遮罩、键盘和异步提交。
- 提交前运行 GitNexus `detect_changes(scope="all")`，确认只影响共享确认组件及 7 个预期调用页。
