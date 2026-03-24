## Why

当前 `apps/api` 模块的类型定义管理混乱，主要问题包括：

1. **缺失完整的 RPC 能力**：各路由模块（`movies.ts`、`actors.ts` 等）未使用方法链模式，导致类型推导断裂，无法在 Dashboard 中通过 `hc<AppType>()` 实现端到端类型安全
2. **代码可维护性差**：`movies.ts` 单文件 998 行代码，包含路由定义、业务逻辑、数据库查询等多种职责，违背单一职责原则
3. **重复代码泛滥**：分页、过滤、权限校验等逻辑在多个路由中重复实现，缺乏统一抽象
4. **测试缺失**：核心业务逻辑未覆盖单元测试，重构风险高

基于 Hono 最佳实践与 Drizzle ORM 官方推荐模式，本次重构将建立清晰的架构分层，实现完全的类型共享与测试覆盖，提升代码质量与开发效率。

## What Changes

- **架构分层**：将路由拆分为 Routes → Handlers → Services 三层结构，实现关注点分离
- **方法链改造**：所有路由采用 Hono 方法链模式（`.get().post().patch()`），确保类型推导完整性
- **类型共享机制**：创建 `packages/api-types` 导出 `AppType`，使 Dashboard 可通过 `hc<AppType>()` 获得完整类型支持
- **通用查询构建器**：基于 Drizzle 的 `SQL[]` 模式，提取通用分页/过滤逻辑
- **单元测试覆盖**：使用 Vitest 为 Services 层（80%+）和 Handlers 层（60%+）建立测试
- **渐进式迁移**：优先重构 `movies` 模块，验证通过后再推广到其他模块

## Capabilities

### New Capabilities

- `hono-rpc-typing`: 实现完整的 Hono RPC 类型推导与跨应用类型共享 MUST
- `api-query-builder`: 基于 Drizzle 的通用查询构建器，支持动态过滤与分页 MUST
- `api-testing-infrastructure`: API 模块的单元测试基础设施（Vitest 配置、测试工具） MUST

### Modified Capabilities

无现有能力的需求级变更（仅实现层重构）。

## Impact

**受影响模块**：
- `apps/api/src/routes/movies.ts`（998 行 → 拆分为 10+ 文件）
- `apps/api/src/index.ts`（新增 `export type AppType`）
- `apps/dashboard`（新增对 `@starye/api-types` 的依赖）

**新增包**：
- `packages/api-types`（类型共享包）

**构建流程**：
- 无需修改 Cloudflare Workers 构建流程（类型包仅用于开发时类型检查）

**兼容性**：
- ✅ API 接口不变（路径、参数、响应结构完全兼容）
- ✅ 现有调用方无需修改
- ⚠️ 内部导入路径会变化（如 `./routes/movies` → `./routes/movies/index`）
