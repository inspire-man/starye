# toast-notification Specification

## Purpose
提供统一的 Toast 通知系统，为 Dashboard 管理端的所有操作提供即时、清晰的反馈。

## ADDED Requirements

### Requirement: System SHALL display toast notifications for user actions

系统 **SHALL** 为用户操作提供 Toast 通知，包括成功、错误、警告和信息四种类型。

#### Scenario: Display success toast
- **WHEN** 用户成功保存电影信息
- **THEN** 系统显示绿色 Toast 提示"保存成功"，3 秒后自动消失

#### Scenario: Display error toast
- **WHEN** 用户保存电影失败（如网络错误）
- **THEN** 系统显示红色 Toast 提示"保存失败: [错误原因]"，5 秒后自动消失

#### Scenario: Display warning toast
- **WHEN** 用户尝试删除有关联数据的项目
- **THEN** 系统显示黄色 Toast 提示"警告: 此操作会影响 N 个关联项"，5 秒后自动消失

#### Scenario: Display info toast
- **WHEN** 系统自动保存草稿
- **THEN** 系统显示蓝色 Toast 提示"草稿已自动保存"，2 秒后自动消失

### Requirement: Toast SHALL support manual dismissal

Toast 通知 **SHALL** 支持用户手动关闭。

#### Scenario: User closes toast manually
- **WHEN** Toast 显示时，用户点击关闭按钮
- **THEN** Toast 立即消失，不等待自动消失时间

#### Scenario: User closes toast by clicking elsewhere
- **WHEN** Toast 显示时，用户点击页面其他区域
- **THEN** Toast 保持显示，不受影响（仅关闭按钮可关闭）

### Requirement: System SHALL manage multiple concurrent toasts

系统 **SHALL** 支持同时显示多个 Toast，并按时间顺序堆叠。

#### Scenario: Multiple toasts displayed
- **WHEN** 用户触发批量操作，短时间内产生 3 个 Toast
- **THEN** 系统在屏幕右上角垂直堆叠显示 3 个 Toast

#### Scenario: Toast queue limit
- **WHEN** 已有 5 个 Toast 显示，用户触发新操作产生第 6 个 Toast
- **THEN** 系统自动关闭最早的 Toast，显示新 Toast

#### Scenario: Toast auto-dismiss order
- **WHEN** 显示 3 个 Toast，每个持续时间不同
- **THEN** 每个 Toast 按各自设定的持续时间独立消失

### Requirement: Toast SHALL support custom duration

Toast 通知 **SHALL** 支持自定义显示时长。

#### Scenario: Default duration for success
- **WHEN** 显示成功 Toast 且未指定时长
- **THEN** Toast 持续显示 3000ms（3 秒）

#### Scenario: Default duration for error
- **WHEN** 显示错误 Toast 且未指定时长
- **THEN** Toast 持续显示 5000ms（5 秒）

#### Scenario: Custom duration
- **WHEN** 显示 Toast 并指定时长为 10000ms
- **THEN** Toast 持续显示 10 秒后自动消失

#### Scenario: Persistent toast
- **WHEN** 显示 Toast 并设置 duration 为 0
- **THEN** Toast 不自动消失，必须手动关闭

### Requirement: useToast composable SHALL provide consistent API

`useToast` composable **SHALL** 提供统一的 API 供所有组件使用。

#### Scenario: Show simple toast
- **WHEN** 组件调用 `showToast('操作成功', 'success')`
- **THEN** 系统显示成功 Toast，内容为"操作成功"

#### Scenario: Show toast with options
- **WHEN** 组件调用 `showToast('重要提示', 'warning', { duration: 10000 })`
- **THEN** 系统显示警告 Toast，持续 10 秒

#### Scenario: Access toast instance
- **WHEN** 组件调用 `const { toasts } = useToast()`
- **THEN** 组件可访问当前所有 Toast 的响应式数组

### Requirement: Toast SHALL be accessible

Toast 组件 **SHALL** 符合无障碍访问标准（ARIA）。

#### Scenario: Screen reader announcement
- **WHEN** Toast 显示
- **THEN** 屏幕阅读器朗读 Toast 内容和类型

#### Scenario: Keyboard navigation
- **WHEN** Toast 显示时，用户按 Escape 键
- **THEN** 当前焦点的 Toast 关闭

### Requirement: Toast SHALL be responsive

Toast **SHALL** 在移动端和桌面端都有良好的展示效果。

#### Scenario: Desktop display
- **WHEN** 在桌面端（宽度 > 768px）显示 Toast
- **THEN** Toast 显示在屏幕右上角，宽度固定 400px

#### Scenario: Mobile display
- **WHEN** 在移动端（宽度 ≤ 768px）显示 Toast
- **THEN** Toast 显示在屏幕顶部，宽度占满屏幕减去边距

#### Scenario: Toast animation
- **WHEN** Toast 出现或消失
- **THEN** 使用平滑的淡入淡出动画（200ms）
