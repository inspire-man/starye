## Why

随着 `starye` 系统的成熟，目前多个前端应用（Dashboard, Movie App, Comic App, Blog）与后端 (`apps/api`) 之间的通信仍然采用基于手工 `fetch`/`axios` 及在前端独立维护 TypeScript 数据接口定义的模式。
这种松散的胶水式通信结构带来了严重的类型脱节风险：一旦后端数据结构变动，前端在开发阶段完全无法感知，极易导致运行时白屏与线上错误。此外，重复手写 TypeScript 数据结构也违背了 DRY (Don't Repeat Yourself) 原则。
因此，为了获得完美的端到端类型安全 (E2E Type Safety) 及 IDE 智能提示，我们计划全面将后端迁移至 `@hono/zod-openapi` 架构，并在前端引入 `hono/client`。现在正是业务需求趋于稳定的最佳时机，通过系统级的地基整理，将使得未来的全栈迭代坚不可摧。

## What Changes

- 使用 `@hono/zod-openapi` 和 `Zod` (或 Valibot) 配置并替换当前的 Hono API 路由定义系统，建立统一的 Schema 声明。
- 将后端的路由树聚合，并通过 `hono` 导出唯一的 `AppType`。
- 采用“切香肠战术”，初步挑选特定的 API（暂定为管理后台的 Actor/Publisher 相关接口）进行试点迁移与验证。
- **BREAKING**: 删除 Dashboard、Movie App、Comic App 中冗余的手写 API 响应类型定义，改用 `AppType` 自动推导。
- **BREAKING**: 移除部分前端应用对 `axios` 的依赖包，全面转往 `hc<AppType>()` 原生 fetch RPC 框架。

## Capabilities

### New Capabilities
- `openapi-generation`: 基于 `@hono/zod-openapi` 的 Schema 定义，自动在后端暴露 `/api/swagger` 接口以提供全自动的 OpenAPI 交互式测试文档页面。

### Modified Capabilities
- `hono-rpc-migration`: 明确前端应用弃用手写类型和 axios 逻辑，全面向 `hono/client` 迁移的机制与步骤约定。

## Impact & Non-Goals

**核心影响范围：**
- `apps/api/src/routes/*` 将全面套用 Zod 强类型重构路由定义。
- `apps/movie-app`、`apps/comic-app` 和 `apps/dashboard` 下的 `src/api` 统一调用工具将被重写为 `hc()` 实例，引发全局网络请求的逻辑调整。
- CI 流水线中的 `pnpm type-check` 检测到接口脱节将立刻爆红拦截，构建过程变得极度严格。

**非目标 (Out of Scope)：**
- 本次改造仅限于全栈的**类型推导升级与 API 路由规范化**，绝不进行底层 D1 数据库结构和具体业务链路的大规模重写。
- 与鉴权强相关的系统级 API 调用（Better Auth 处理的登录登出会话等）不受此影响。各前端应用的 Auth 调用 MUST 使用 Better Auth 官方客户端或原生的 `fetch` 实现，保持鉴权的独立性。
