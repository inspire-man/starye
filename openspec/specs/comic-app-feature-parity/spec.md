# Comic App Feature Parity

## Requirement: 收藏系统
Comic App MUST 支持用户收藏漫画，功能对齐 Movie App 的收藏系统 SHALL。

### Scenario: 登录用户收藏漫画
- **WHEN** 已登录用户在漫画详情页点击收藏按钮
- **THEN** 漫画被添加到用户收藏列表，按钮状态变为"已收藏"

### Scenario: 查看收藏列表
- **WHEN** 已登录用户访问 `/favorites`（或个人中心中的收藏板块）
- **THEN** 展示用户收藏的所有漫画，支持分页浏览

### Scenario: 取消收藏
- **WHEN** 用户点击已收藏漫画的收藏按钮
- **THEN** 漫画从收藏列表移除，按钮状态恢复为"收藏"

## Requirement: 搜索增强
Comic App MUST 提供关键词搜索功能，支持按标题和作者搜索 SHALL。

### Scenario: 关键词搜索漫画
- **WHEN** 用户在搜索页输入关键词
- **THEN** 展示匹配的漫画列表（标题或作者包含关键词），支持分页

## Requirement: Toast 通知系统
Comic App MUST 使用 @starye/ui 的 Toast 组件替代 `alert()` 进行用户反馈 SHALL。

### Scenario: 未登录操作提示
- **WHEN** 未登录用户尝试访问需要登录的功能（如收藏、个人中心）
- **THEN** 显示 Toast 通知"请先登录"而非浏览器原生 alert

### Scenario: 操作成功反馈
- **WHEN** 用户成功收藏/取消收藏漫画
- **THEN** 显示 Toast 通知确认操作结果

## Requirement: 移动端适配
Comic App MUST 在移动设备上提供良好的浏览体验，核心页面（首页、详情、阅读器）SHALL 适配 320px–768px 宽度 SHALL。

### Scenario: 移动端首页布局
- **WHEN** 用户在 375px 宽度的设备上访问 Comic App 首页
- **THEN** 漫画卡片以单列或双列网格展示，无水平溢出

### Scenario: 阅读器移动端适配
- **WHEN** 用户在移动设备上阅读漫画章节
- **THEN** 图片宽度自适应屏幕，支持上下滑动翻页

## Requirement: 使用 Hono RPC 和共享 UI 组件
Comic App 的所有 API 调用 MUST 使用 `hc<AppType>()`（在 A2 完成后），UI 交互组件 MUST 优先使用 @starye/ui 的共享组件 SHALL。

### Scenario: API 调用类型安全
- **WHEN** Comic App 通过 `client.api.public.comics.$get({ query })` 获取漫画列表
- **THEN** 返回类型自动推导，无需手写 interface
