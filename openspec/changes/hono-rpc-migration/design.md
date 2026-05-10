## Context

随着 `starye` 项目的不断迭代，前端应用（Dashboard, Movie App, Comic App, Blog）与后端 (`apps/api`) 之间的通信仍依靠传统的 `fetch`/`axios` 和手写 TypeScript 定义。这种方式存在严重弊端：两端类型容易脱节，一旦后端 API 的 Request/Response 结构发生变动，前端代码极易在运行时出现报错或白屏。这也造成了糟糕的开发体验，无法享受开箱即用的属性补全与类型检查。

为彻底解决这些痛点并在系统进入业务稳定期后夯实地基，计划向更现代化的 E2E (End-to-End) 类型安全方案迈进：利用 Hono 生态的 `@hono/zod-openapi` 与 `hono/client` 构建强大的全栈 RPC 架构。

## Goals / Non-Goals

**Goals:**
- 提供严格且自动化推导的 E2E 类型安全通信（借助 Zod Schema）。
- 前端通过 `hc<AppType>()` 享有极佳的 IDE 智能提示，提升重构效率。
- 选定管理后台涉及的 Actors/Publishers 相关 API 进行端到端的试点迁移验证。
- 自动生成符合 OpenAPI 规范的 `/api/swagger` 在线调试页面。
- 提供在流水线上强大的错误阻断能力（通过 `pnpm type-check` 提前发现客户端调用的脱节）。

**Non-Goals:**
- 不改变底层 Drizzle / D1 的数据库结构，仅限于路由定义层的重构。
- 不影响底层核心业务流，不涉及数据模型业务规则的大洗牌。
- 不干涉应用的鉴权逻辑：前端获取 User、Session 依然统一依赖 `better-auth` 的 client 和相关原生机制，保持鉴权独立。
- 不打算在第一阶段将所有接口全量覆盖，采用渐进替换防止主流程长时间挂起。

## Decisions

1. **采用 `@hono/zod-openapi` 而非轻量级 `@hono/zod-validator`**
   - **Rationale**: OpenAPI 的方案可以自动结合生成 Swagger UI 文档进行 API 可视化探索，并且同样能被 `hono/client` 完美推断类型，调试更直观。
   - **Alternatives Considered**: 曾考虑 `tRPC`，但其对现有标准的 RESTful 架构侵入性过强，且基于 Hono 原生的 RPC 已足够优秀且心智负担小。

2. **客户端通信转用 原生Fetch + `hono/client` (`hc`)**
   - **Rationale**: 官方支持的 Fetch RPC 包装器，能够完美提取并关联后端导出的 `AppType`。借此机会将在受影响的应用中移除并清理掉冗余的 `axios` 依赖。

3. **重组后端路由结构以导出统一类型**
   - **Rationale**: 为了提取全局的 API Type 被前端引用，Hono 后端代码必须改为显式的链式挂载 (`app.route('/a', aRoute).route('/b', bRoute)`)，并统一返回一个供导出的 `AppType`。

4. **Monorepo 下的类型跨包引用**
   - **Rationale**: 前端应用将直接通过相对路径或者 Workspace 对 `apps/api` 的引用导入 `type { AppType }`，无需引入额外的编译层保证。

## Risks / Trade-offs

- **[Risk] Schema 定义繁琐引发的文件变长**: `@hono/zod-openapi` 要求显式声明所有成功及错误状态下的类型 Schema，使得代码量增加。
  - **Mitigation**: 抽离通用的 Schema 定义库，如分页（Pagination）、标准错误响应（Error Response）的 Zod Schema，以减少重复样板代码。
- **[Risk] 过渡期间两套网络调用机制并存**: 需要短时间内在某些前端应用中兼容旧机制。
  - **Mitigation**: 从低耦合的页面快速试水并完成验证后，逐步且批量地彻底消灭旧有封装逻辑，避免遗留债务。

## Migration Plan

1. **后端基础设施引入**：在 `apps/api` 引入 `@hono/zod-openapi`、`@asteasolutions/zod-to-openapi` 和 Swagger UI 挂载件。
2. **制定通用 Schema**：将常用通用的 Response、Error Zod 对象提取至可复用的文件。
3. **试点接口改造**：选取 API 的 `actors` 与 `publishers` 相关路由重构为 OpenAPI Route 并在 `index.ts` 聚合并导出 `AppType`。
4. **前端替换**：在 Dashboard 及关联的前端应用中，引入 `hono/client` 构建 `rpc` 实例，将对应页面与状态管理库内部的网络调用改为 RPC 调用。
5. **拆卸旧组件**：移除刚刚迁移接口关联的本地类型声明及 Axios 调用配置，最后运行类型检查确保无脱漏。

## Open Questions

- 是否需要在 Workspace 配置中将 API 端声明为一个带 `exports` 定义的正式子包，以便前端直接 `import type { AppType } from '@starye/api'`，这样能最优雅地规避 TS 对不同子应用模块解析不到的问题？（将在实现前验证最直接的导入方式）。
