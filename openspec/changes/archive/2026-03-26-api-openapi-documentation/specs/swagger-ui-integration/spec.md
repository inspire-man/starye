## ADDED Requirements

### Requirement: Scalar UI 集成

系统 MUST 集成 `@scalar/hono-api-reference` 提供交互式 API 文档页面，SHALL 在 `/docs` 端点提供完整的 Scalar UI 界面。

#### Scenario: 访问文档页面
- **WHEN** 用户访问 `GET /docs`
- **THEN** 系统返回渲染好的 Scalar UI HTML 页面，展示所有 API 端点的文档

#### Scenario: OpenAPI 规范加载
- **WHEN** Scalar UI 初始化
- **THEN** 自动从 `/openapi.json` 加载 OpenAPI 规范并渲染为交互式文档

### Requirement: 主题与视觉配置

系统 SHALL 使用 `moon` 主题提供深色科技感的视觉体验，MUST 启用 `darkMode: true`，并通过 `customCss` 应用品牌色覆盖。

#### Scenario: Moon 主题应用
- **WHEN** Scalar UI 配置 `theme: 'moon'`
- **THEN** 文档页面使用深色背景和科技感配色方案

#### Scenario: 自定义品牌色
- **WHEN** Scalar UI 配置 `customCss` 包含 `--scalar-color-accent: #6366f1`
- **THEN** 文档的强调色（按钮、链接）使用指定的品牌色

#### Scenario: 深色模式
- **WHEN** 配置 `darkMode: true`
- **THEN** 文档默认以深色模式渲染，无论用户系统设置

### Requirement: 搜索与导航优化

系统 MUST 配置搜索快捷键为 `k`（Command/Ctrl+K），SHALL 默认展开所有 tags 和按字母顺序排序 operations。

#### Scenario: 快捷键搜索
- **WHEN** 用户在文档页面按下 `Ctrl/Cmd + K`
- **THEN** 系统打开搜索框，支持快速搜索 API 端点

#### Scenario: Tags 自动展开
- **WHEN** 配置 `defaultOpenAllTags: true`
- **THEN** 文档页面加载时所有 tag 分组默认展开，方便浏览

#### Scenario: 端点排序
- **WHEN** 配置 `tagsSorter: 'alpha'` 和 `operationsSorter: 'alpha'`
- **THEN** tags 和 operations 按字母顺序排序，提供一致的浏览体验

### Requirement: 认证配置

系统 SHALL 在 Scalar UI 配置中设置 `preferredSecurityScheme: 'cookieAuth'`，MUST 支持开发者在文档页面中使用 Better Auth 的 session cookie 进行接口测试。

#### Scenario: 认证方案选择
- **WHEN** Scalar UI 配置 `authentication.preferredSecurityScheme: 'cookieAuth'`
- **THEN** 文档页面的认证部分默认展示 cookie 认证方式

#### Scenario: 已登录用户测试
- **WHEN** 用户已通过 Better Auth 登录（浏览器存在 `better-auth.session_token` cookie）
- **THEN** 在 Scalar UI 中测试 Admin API 时自动携带该 cookie，无需手动配置

### Requirement: 页面标题与元信息

系统 MUST 设置 `pageTitle: 'Starye API Documentation'`，SHALL 在 OpenAPI `info` 中提供详细的 API 描述、联系方式和版本信息。

#### Scenario: 浏览器标题
- **WHEN** 用户访问 `/docs` 页面
- **THEN** 浏览器 tab 标题显示 "Starye API Documentation"

#### Scenario: API 元信息展示
- **WHEN** Scalar UI 加载 OpenAPI 规范
- **THEN** 页面顶部展示 API 标题、版本号、描述和联系方式

### Requirement: 服务器环境配置

系统 SHALL 在 OpenAPI `servers` 数组中定义开发和生产环境的 base URL，MUST 允许用户在 Scalar UI 中切换不同的服务器环境。

#### Scenario: 开发环境选择
- **WHEN** 用户在 Scalar UI 中选择 "本地开发环境" 服务器
- **THEN** 所有请求发送到 `http://localhost:8787`

#### Scenario: 生产环境选择
- **WHEN** 用户在 Scalar UI 中选择 "生产环境" 服务器
- **THEN** 所有请求发送到 `https://api.starye.example.com`

### Requirement: CDN 与性能优化

系统 MAY 配置自定义 CDN URL 以加速 Scalar UI 资源加载，SHALL 确保文档页面在 Cloudflare Workers 环境中快速响应。

#### Scenario: 默认 CDN 加载
- **WHEN** 未配置自定义 CDN
- **THEN** Scalar UI 从默认 CDN 加载最新版本的静态资源

#### Scenario: 自定义 CDN 配置
- **WHEN** 配置 `cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'`
- **THEN** Scalar UI 从指定的 CDN 加载资源，支持版本锁定和加速
