## Why

当前 `apps/api` 缺少完整的 API 文档，主要问题包括：

1. **缺失 OpenAPI 规范**：API 路由虽然使用 Zod 进行参数验证，但未生成标准的 OpenAPI/Swagger 文档，外部开发者和前端团队难以快速了解接口定义 MUST
2. **文档与代码分离**：如果手动维护文档，容易出现代码与文档不同步的问题，增加维护成本 MUST
3. **接口测试效率低**：缺少 Swagger UI 等交互式文档工具，接口调试需要手动构造请求，开发效率受影响 MUST
4. **类型安全需保证**：现有 Hono RPC 客户端依赖完整的类型推导，任何文档方案不能破坏 RPC 的类型安全性 MUST

基于 rhinobase/hono-openapi 中间件方案，本次变更将在保持 RPC 类型安全的前提下，为所有 API 路由生成完整的 OpenAPI 3.1 规范和 Swagger UI 文档。

## What Changes

- **OpenAPI 生成**：集成 rhinobase/hono-openapi 中间件，通过 `describeRoute()` 为路由添加 OpenAPI 元数据
- **Schema 组织规范**：建立 `schemas/` 目录结构，统一管理通用响应模板、实体 Schema 和路由专属 Schema
- **Swagger UI 集成**：添加 `/docs` 端点，提供交互式 API 文档界面
- **全量文档覆盖**：为所有 50+ 路由添加完整的 OpenAPI 描述，包括请求参数、响应结构、错误码等
- **POC 验证**：先对 2-3 个路由进行验证，确认 RPC 兼容性和文档生成质量后再全量迁移

## Capabilities

### New Capabilities

- `openapi-generation`: 使用 rhinobase/hono-openapi 自动生成 OpenAPI 3.1 规范 MUST
- `api-schema-management`: 统一的 Schema 组织和管理规范，确保可维护性 MUST
- `swagger-ui-integration`: Swagger UI 文档界面，提供交互式接口测试能力 MUST

### Modified Capabilities

无现有能力的需求级变更（仅新增文档层，不修改业务逻辑）。

## Impact

**受影响模块**：
- `apps/api/src/routes/**`（所有路由文件需添加 `describeRoute()`）
- `apps/api/src/index.ts`（新增 `/openapi.json` 和 `/docs` 端点）
- `apps/api/package.json`（新增 `hono-openapi` 和 `@hono/swagger-ui` 依赖）

**新增目录**：
- `apps/api/src/schemas/`（Schema 定义和通用模板）

**兼容性**：
- ✅ API 接口不变（仅添加元数据，不修改路由逻辑）
- ✅ RPC 客户端不受影响（`describeRoute` 为纯中间件，不改变类型链）
- ✅ 现有调用方无需修改

**预期工作量**：
- 基础设施搭建：1-2 天
- POC 验证：1 天
- 全量迁移（50+ 路由）：1-2 周
- Response Schema 定义：约 1000-1500 行代码
