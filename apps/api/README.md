# Starye API

API Worker 负责 Hono 路由、Better Auth、业务服务、OpenAPI 和 D1/R2 访问。

## 本地开发

应用端口仅用于诊断：

~~~bash
cd apps/api
pnpm dev
~~~

浏览器和跨应用验证统一通过 Gateway：

- http://localhost:8080/api/health
- http://localhost:8080/api/docs
- http://localhost:8080/api/openapi.json

OpenAPI 和 Scalar 页面需要 admin 或 super_admin session。

## 常用命令

~~~bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
~~~

## 运行边界

- Better Auth session/cookie 是用户认证入口，服务间调用使用显式 crawler 认证边界。
- API Worker 本地诊断端口为 8787，不能替代 Gateway 验收入口。
- D1 migration、R2、部署、回滚和生产验证遵循仓库根目录 RUNBOOK.md。
- 跨 API、数据库、crawler 和前端的能力先在 openspec/ 记录契约。

## 代码结构

- src/routes：路由和 handler。
- src/services：跨路由业务逻辑。
- src/middleware：认证、缓存、日志和错误处理。
- src/schemas：Valibot 请求/响应模式。
- src/index.ts：路由注册和 OpenAPI/Scalar 入口。

相关入口：

- ../../README.md
- ../../ARCHITECTURE.md
- ../../RUNBOOK.md
- ../../packages/db/MIGRATION.md
- ../../docs/testing-strategy.md
