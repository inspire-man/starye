# skeleton-loading Specification

## Purpose
提供骨架屏加载组件，在数据加载时显示内容占位符，改善感知性能和用户体验。

## ADDED Requirements

### Requirement: System SHALL display skeleton screens during data loading

系统 **SHALL** 在数据加载时显示骨架屏，而非空白页面或简单的加载文字。

#### Scenario: Table skeleton for movie list
- **WHEN** 用户打开电影列表页面，数据尚未加载完成
- **THEN** 系统显示表格骨架屏（5 行占位行）

#### Scenario: Card skeleton for dashboard
- **WHEN** 用户打开 Dashboard 首页，统计数据尚未加载
- **THEN** 系统显示卡片骨架屏（4 个卡片占位）

#### Scenario: Transition from skeleton to content
- **WHEN** 数据加载完成
- **THEN** 骨架屏平滑淡出，真实内容平滑淡入（300ms 过渡）

### Requirement: SkeletonTable SHALL match actual table layout

`SkeletonTable` 组件 **SHALL** 匹配实际表格的列布局和行数。

#### Scenario: Custom column widths
- **WHEN** 组件使用 `<SkeletonTable :columns="5" :rows="10" :widths="['20%', '30%', '15%', '20%', '15%']" />`
- **THEN** 骨架屏显示 5 列 10 行，每列宽度按指定比例分配

#### Scenario: Default row count
- **WHEN** 组件使用 `<SkeletonTable />` 不指定行数
- **THEN** 骨架屏显示 5 行（默认值）

#### Scenario: With selection column
- **WHEN** 组件使用 `<SkeletonTable :selectable="true" />`
- **THEN** 骨架屏第一列显示复选框占位符

### Requirement: SkeletonCard SHALL support different card types

`SkeletonCard` 组件 **SHALL** 支持不同类型的卡片骨架屏。

#### Scenario: Statistics card skeleton
- **WHEN** 组件使用 `<SkeletonCard variant="stat" />`
- **THEN** 骨架屏显示：标题行 + 大号数字行 + 描述行

#### Scenario: Content card skeleton
- **WHEN** 组件使用 `<SkeletonCard variant="content" />`
- **THEN** 骨架屏显示：标题行 + 3 行内容占位

#### Scenario: Image card skeleton
- **WHEN** 组件使用 `<SkeletonCard variant="image" />`
- **THEN** 骨架屏显示：图片占位 + 标题行 + 描述行

### Requirement: SkeletonForm SHALL match form field layout

`SkeletonForm` 组件 **SHALL** 匹配表单的字段布局。

#### Scenario: Simple form skeleton
- **WHEN** 组件使用 `<SkeletonForm :fields="3" />`
- **THEN** 骨架屏显示 3 个字段（标签 + 输入框占位）

#### Scenario: Form with textarea
- **WHEN** 组件使用 `<SkeletonForm :fields="2" :hasTextarea="true" />`
- **THEN** 骨架屏显示 2 个普通字段 + 1 个文本域占位（高度 3 倍）

#### Scenario: Form with buttons
- **WHEN** 组件使用 `<SkeletonForm :fields="3" :hasButtons="true" />`
- **THEN** 骨架屏底部显示 2 个按钮占位（保存 + 取消）

### Requirement: Skeleton SHALL use animated shimmer effect

骨架屏 **SHALL** 使用动画闪烁效果表示加载中。

#### Scenario: Shimmer animation
- **WHEN** 骨架屏显示
- **THEN** 从左到右循环播放淡色光泽滑过效果（1.5 秒循环）

#### Scenario: Animation respects prefers-reduced-motion
- **WHEN** 用户系统设置了 `prefers-reduced-motion: reduce`
- **THEN** 骨架屏使用简单的脉冲效果，不使用滑动动画

### Requirement: Skeleton components SHALL be reusable

骨架屏组件 **SHALL** 易于在不同页面复用。

#### Scenario: Use in multiple pages
- **WHEN** 多个页面（Movies, Actors, Publishers）都需要表格骨架屏
- **THEN** 所有页面使用同一个 `SkeletonTable` 组件，通过 props 配置

#### Scenario: Composition of skeletons
- **WHEN** 页面需要组合多种骨架屏（卡片 + 表格）
- **THEN** 可以同时使用多个骨架屏组件，组合布局

### Requirement: Skeleton SHALL match theme colors

骨架屏颜色 **SHALL** 与 Dashboard 主题颜色保持一致。

#### Scenario: Light theme skeleton
- **WHEN** Dashboard 使用浅色主题
- **THEN** 骨架屏使用浅灰色背景（#E5E7EB）和白色闪烁（#F3F4F6）

#### Scenario: Dark theme skeleton (future)
- **WHEN** Dashboard 使用深色主题（未来实现）
- **THEN** 骨架屏使用深灰色背景和浅色闪烁

### Requirement: Skeleton SHALL prevent layout shift

骨架屏 **SHALL** 与实际内容具有相同的高度和布局，避免内容跳动。

#### Scenario: Table height consistency
- **WHEN** 骨架屏显示 10 行表格
- **THEN** 骨架屏高度与实际 10 行数据表格高度相同

#### Scenario: Card height consistency
- **WHEN** 骨架屏显示统计卡片
- **THEN** 骨架屏高度与实际统计卡片高度相同（包括内边距）
