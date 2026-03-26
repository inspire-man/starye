## Why

Starye API 当前缺乏完整的 API 文档，导致前端开发时需要频繁查阅代码或手动测试接口。同时，项目使用 Zod 进行验证，但 Valibot 提供了更小的 bundle size（4KB vs 14KB）、更灵活的类型强制转换管道，以及与 Hono OpenAPI 的原生集成。通过本次变更，我们将建立标准化的 API 文档工作流，并优化验证库选型。MUST 为所有 API 端点生成完整的 OpenAPI 3.0 规范，SHALL 使用 Valibot 替换所有 Zod 验证逻辑。

## What Changes

- **移除依赖**：从 `apps/api` 和 `packages/crawler` 移除 `zod` 和 `@hono/zod-validator`
- **新增依赖**：添加 `valibot`、`@valibot/to-json-schema`、`hono-openapi`、`@scalar/hono-api-reference`（使用 `pnpm add` 安装最新版本）
- **验证迁移**：将所有 `zValidator` 调用替换为 `hono-openapi` 的 `validator`，所有 Zod schema 转换为 Valibot schema
- **Schema 组织**：创建 `apps/api/src/schemas/` 目录结构，按领域分类管理所有验证 schema（common、comic、movie、actor、responses 等）
- **OpenAPI 生成**：在 `apps/api/src/index.ts` 配置 `openAPIRouteHandler`，自动生成 `/openapi.json` 端点
- **文档 UI**：集成 Scalar UI（`moon` 主题 + 深色模式 + 自定义品牌 CSS），提供 `/docs` 交互式文档页面
- **TypeScript 优化**：在 `apps/api/tsconfig.json` 启用 `composite: true` 和 `declaration: true`，在 `apps/dashboard/tsconfig.json` 添加 project references，确保 RPC 类型推导正确
- **路由文档化**：为所有路由添加 `describeRoute()` 元数据（summary、description、tags、operationId、responses）
- **保留 api-types**：保持 `packages/api-types` 作为类型契约层，未来可扩展客户端辅助函数

## Capabilities

### New Capabilities

- `openapi-generation`: OpenAPI 3.0 规范的自动生成，包括 routes、schemas、security definitions
- `api-schema-management`: API 验证 schema 的统一组织与管理（基于 Valibot）
- `swagger-ui-integration`: Scalar UI 的集成与配置（主题、品牌、搜索优化）

### Modified Capabilities

<!-- 无现有 capabilities 被修改 -->

## Impact

**影响范围：**
- **API 路由**：所有 `apps/api/src/routes/` 下的路由文件（约 15+ 文件）
- **共享 Schema**：`apps/api/src/types.ts` 迁移到 `apps/api/src/schemas/crawler.ts`
- **Crawler 包**：`packages/crawler/src/lib/image-processor.ts` 的 `R2ConfigSchema` 迁移
- **Admin 服务**：`apps/api/src/routes/admin/movies/services/movie.service.ts` 的 `MovieFilterSchema` 迁移
- **依赖清理**：`apps/api/package.json` 和 `packages/crawler/package.json` 的依赖更新

**破坏性变更：**
- 无（内部验证库更换，对外 API 契约不变）

**新增端点：**
- `GET /openapi.json`：OpenAPI 规范文档
- `GET /docs`：Scalar UI 交互式文档页面

**性能提升：**
- API bundle size 减少约 10KB（Zod 14KB → Valibot 4KB）
- 类型推导性能提升（通过 TypeScript Project References）

**开发体验改进：**
- 前端开发者可通过 `/docs` 快速查阅接口文档
- RPC 客户端类型推导更稳定
- Schema 复用通过 `metadata({ ref })` 简化
