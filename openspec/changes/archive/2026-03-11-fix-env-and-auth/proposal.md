## Why

当前项目在本地开发环境存在严重的环境变量管理混乱和鉴权流程错误问题，导致：
1. **无法正常登录**：blog 点击登录跳转 404，comic/movie 访问时无限重定向到登录页
2. **请求到错误的服务**：各前端 app 的 `authClient` 配置不一致，部分直接请求生产环境 API 导致本地 Cookie 无法共享
3. **维护困难**：每个 app 的环境变量 fallback 逻辑不同，新增服务时容易出错

这些问题阻碍了日常开发调试，必须立即修复 MUST 确保本地开发环境可用。

## What Changes

- 统一所有前端 app（blog/comic/movie/auth/dashboard）的环境变量命名和 fallback 逻辑
- 修正本地开发时 `apiUrl` 配置，确保所有请求通过 Gateway (`http://localhost:8080`) 而非直接访问生产环境
- 修复 blog app 的登录跳转路由，移除错误的 `routeRules` 配置
- 验证 Better Auth 的 Cookie 配置在本地跨端口场景下正常工作
- 创建 `.env.example` 和开发文档，明确本地启动顺序和环境变量配置

## Capabilities

### New Capabilities

- `unified-env-config`: 统一的环境变量配置规范，包括命名约定、fallback 逻辑、.env 文件模板
- `local-dev-setup`: 本地开发环境搭建指南，包括服务启动顺序、端口映射、调试方法

### Modified Capabilities

- `auth-flow`: 现有鉴权流程的修复，确保 Cookie 在本地多端口环境正确共享，登录跳转路由正确

## Impact

**影响范围：**
- **前端 apps**：blog, comic, movie, auth, dashboard 的 `auth-client.ts` 和 `nuxt.config.ts` / `vite.config.ts`
- **Gateway**：验证路由规则是否正确代理鉴权请求
- **API**：验证 `auth.ts` 中 Cookie 配置对本地开发的兼容性
- **文档**：新增 `.env.example`、`README.md` 或 `docs/local-development.md`

**风险：**
- 修改环境变量配置可能影响生产环境部署，需确保只改本地 fallback 逻辑，不影响生产环境变量读取
- Cookie 配置变更可能影响已登录用户，需在测试环境充分验证

**依赖：**
- 无新增依赖，仅修改现有配置
