# Gateway and Auth Test Coverage

## Requirement: Gateway 路由单元测试
Gateway Worker 的路由逻辑 MUST 有单元测试覆盖，包括路径匹配、路径重写、环境检测、代理头部设置 SHALL。

### Scenario: API 路径路由
- **WHEN** 请求路径为 `/api/movies`
- **THEN** Gateway 将请求转发到 API 服务的 `/api/movies`

### Scenario: Dashboard 路径重写（生产环境）
- **WHEN** 生产环境中请求路径为 `/dashboard/movies`
- **THEN** Gateway 将路径重写为 `/movies` 后转发到 Dashboard 服务

### Scenario: Dashboard 路径保持（本地环境）
- **WHEN** 本地开发环境中请求路径为 `/dashboard/movies`
- **THEN** Gateway 保持完整路径 `/dashboard/movies` 转发到 localhost:5173

### Scenario: 本地环境检测
- **WHEN** 请求来自 `localhost`、`127.0.0.1`、`192.168.*` 或 `10.*` 地址
- **THEN** Gateway 识别为本地环境，使用 localhost 端口作为转发目标

### Scenario: 默认路由到 Blog
- **WHEN** 请求路径不匹配任何已知前缀（如 `/some-article-slug`）
- **THEN** Gateway 将请求转发到 Blog 服务

### Scenario: 代理头部设置
- **WHEN** Gateway 转发请求到目标服务
- **THEN** 请求头中 MUST 包含 `X-Forwarded-Host`、`X-Forwarded-Proto`、`X-Real-IP`

## Requirement: Auth flow E2E 测试
认证流程 MUST 有 E2E 测试覆盖，包括未登录跳转、会话获取、权限守卫 SHALL。

### Scenario: Dashboard 未登录跳转
- **WHEN** 未登录用户直接访问 Dashboard 任意受保护路由
- **THEN** 页面跳转到 `/auth/login?redirect=<原始路径>`

### Scenario: 会话获取成功
- **WHEN** 已登录用户（有有效 session cookie）访问 Dashboard
- **THEN** 路由守卫通过，正常展示页面内容

### Scenario: 权限不足拒绝
- **WHEN** 角色为普通 user（非 admin/super_admin）的已登录用户访问 Dashboard
- **THEN** 页面跳转到 `/auth/login?error=insufficient_permissions`

### Scenario: 资源级权限检查
- **WHEN** 角色为 `comic_admin` 的用户尝试访问 `/movies`（需要 movie_admin 权限）
- **THEN** 页面跳转到 `/unauthorized`
