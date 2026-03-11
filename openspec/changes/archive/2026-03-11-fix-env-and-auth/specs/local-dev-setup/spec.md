## ADDED Requirements

### Requirement: 提供本地开发启动指南

项目 MUST 提供清晰的本地开发环境搭建和启动指南文档。

#### Scenario: 新开发者搭建本地环境
- **WHEN** 新开发者需要启动本地开发环境
- **THEN** 文档 SHALL 明确说明以下内容：
  - 必需的依赖（如 Node.js 版本、pnpm、wrangler CLI）
  - 环境变量配置步骤（复制 `.env.example` 为 `.env`）
  - 服务启动顺序（gateway → api → 其他 apps）

#### Scenario: 文档说明端口映射关系
- **WHEN** 开发者查阅本地开发文档
- **THEN** 文档 SHALL 列出所有服务的端口映射：
  - Gateway: `http://localhost:8080`
  - API: `http://localhost:8787`（仅 Gateway 访问）
  - Dashboard: `http://localhost:5173`
  - Blog: `http://localhost:3002`
  - Movie: `http://localhost:3001`
  - Comic: `http://localhost:3000`
  - Auth: `http://localhost:3003`

#### Scenario: 文档说明通过 Gateway 访问
- **WHEN** 开发者需要访问各前端应用
- **THEN** 文档 SHALL 明确说明：
  - 本地开发应通过 Gateway 访问：`http://localhost:8080/blog/`, `http://localhost:8080/comic/` 等
  - 直接访问应用端口（如 `http://localhost:3002`）可能导致鉴权问题
  - Gateway 会自动代理请求到对应服务

### Requirement: 明确服务启动顺序

本地开发环境 MUST 按照依赖关系依次启动服务。

#### Scenario: 正确的服务启动顺序
- **WHEN** 开发者启动本地开发环境
- **THEN** 服务启动顺序 MUST 为：
  1. Gateway (`pnpm dev --filter gateway`)
  2. API Worker (`pnpm dev --filter api`)
  3. 其他前端应用（blog/comic/movie/auth/dashboard，顺序任意）

#### Scenario: Gateway 未启动时的错误提示
- **WHEN** 开发者直接启动前端应用但未启动 Gateway
- **THEN** 前端应用在调用 API 时 SHALL 显示网络错误（无法连接到 `http://localhost:8080`）

### Requirement: 提供调试和故障排查指引

文档 MUST 包含常见问题的故障排查指引。

#### Scenario: 登录无限重定向的排查
- **WHEN** 开发者遇到登录无限重定向问题
- **THEN** 文档 SHALL 提供排查步骤：
  - 检查 `authClient.baseURL` 是否指向 `http://localhost:8080/api/auth`
  - 检查浏览器控制台是否有跨域或 Cookie 错误
  - 检查 Gateway 和 API 服务是否正常运行

#### Scenario: 登录跳转 404 的排查
- **WHEN** 开发者遇到登录按钮跳转 404 问题
- **THEN** 文档 SHALL 说明：
  - 检查登录链接是否使用 `external: true` 或完整路径（`/auth/login`）
  - 检查 Nuxt 应用的 `routeRules` 是否有错误的重定向配置

#### Scenario: Cookie 无法共享的排查
- **WHEN** 开发者发现登录后其他应用仍显示未登录状态
- **THEN** 文档 SHALL 提供排查步骤：
  - 检查是否通过 Gateway（`http://localhost:8080`）访问所有应用
  - 检查浏览器开发者工具中 Cookie 的 `domain` 和 `path` 属性
  - 验证 API 的 `auth.ts` 中 Cookie 配置是否正确
