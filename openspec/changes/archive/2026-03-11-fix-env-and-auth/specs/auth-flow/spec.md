## MODIFIED Requirements

### Requirement: 登录跳转路由正确性

前端应用的登录跳转 MUST 指向独立的 Auth 服务（`/auth/login`），而非应用自身路径下的 `/login`。

#### Scenario: Blog 应用登录按钮跳转
- **WHEN** 用户在 Blog 应用（`/blog/`）点击登录按钮
- **THEN** 应用 SHALL 跳转到 `/auth/login?redirect=/blog/` 而非 `/blog/login`

#### Scenario: 移除错误的 routeRules 重定向
- **WHEN** 检查 Nuxt 应用的 `nuxt.config.ts`
- **THEN** 配置文件 MUST NOT 包含将 `/login` 重定向到 `/auth/login` 的 `routeRules`（因为 `baseURL` 会导致路径错误）

#### Scenario: 使用外部链接跳转到 Auth
- **WHEN** 前端应用需要跳转到登录页
- **THEN** 应用 SHALL 使用以下方式之一：
  - `<a :href="/auth/login">` （原生 HTML 链接）
  - `<NuxtLink to="/auth/login" external>` （Nuxt 外部链接）
  - `window.location.href = '/auth/login'` （JavaScript 跳转）

### Requirement: Cookie 在本地多端口环境共享

Better Auth 的 Cookie 配置 MUST 确保在本地开发环境（多个 localhost 端口）下正常工作。

#### Scenario: 本地开发环境 Cookie 配置
- **WHEN** API Worker 在本地开发环境（`localhost`）运行
- **THEN** Cookie 配置 SHALL 满足：
  - `sameSite: 'lax'`（允许同站跨端口）
  - `secure: false`（本地 HTTP 环境）
  - `domain: undefined`（让浏览器自动设置为 `localhost`）
  - `path: '/'`（确保所有路径可访问）

#### Scenario: Cookie 前缀统一
- **WHEN** 配置 Better Auth Cookie
- **THEN** `cookiePrefix` SHALL 为 `'starye'`，确保所有应用使用相同前缀

#### Scenario: 生产环境 Cookie 配置
- **WHEN** API Worker 部署到生产环境（`starye.org`）
- **THEN** Cookie 配置 SHALL 满足：
  - `sameSite: 'lax'`
  - `secure: true`（HTTPS 环境）
  - `domain: 'starye.org'`（共享到所有子域名）
  - `path: '/'`

### Requirement: 所有前端应用通过 Gateway 访问 API

所有前端应用的鉴权请求 MUST 通过 Gateway（`/api/auth`）访问，而非直接访问 API Worker 端口。

#### Scenario: authClient baseURL 配置
- **WHEN** 前端应用初始化 `authClient`
- **THEN** `baseURL` SHALL 为 `${apiUrl}/api/auth`，其中 `apiUrl` 指向 Gateway（本地 `http://localhost:8080`，生产 `https://starye.org`）

#### Scenario: SSR 场景下的 session 获取
- **WHEN** Nuxt 中间件在服务端（SSR）检查用户登录状态
- **THEN** 中间件 SHALL 调用 `authClient.getSession({ fetchOptions: { headers } })` 并传递请求头中的 Cookie

#### Scenario: 客户端场景下的 session 获取
- **WHEN** 前端应用在客户端获取用户登录状态
- **THEN** 应用 SHALL 使用 `useSession()` composable，浏览器会自动携带 Cookie

## ADDED Requirements

### Requirement: 本地开发鉴权流程完整性测试

本地开发环境 MUST 能够完整走通登录流程，包括跨应用的 Cookie 共享。

#### Scenario: 完整登录流程测试
- **WHEN** 开发者在本地环境测试登录功能
- **THEN** 流程 SHALL 满足：
  1. 在 `http://localhost:8080/blog/` 点击登录 → 跳转到 `http://localhost:8080/auth/login`
  2. 在 Auth 页面登录成功 → 设置 Cookie（domain=localhost, path=/）
  3. 重定向回 `http://localhost:8080/blog/` → Blog 应用能读取到 Cookie 和 session
  4. 访问 `http://localhost:8080/comic/` → Comic 应用也能读取到相同 Cookie 和 session

#### Scenario: 中间件鉴权检查不重定向
- **WHEN** 用户已在 Blog 登录，然后访问 Comic 或 Movie 应用
- **THEN** Comic/Movie 的全局中间件 SHALL 检测到有效 session，不触发重定向到登录页
