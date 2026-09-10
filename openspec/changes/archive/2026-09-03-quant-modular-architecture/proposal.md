## Why

Quant 的功能已经覆盖观察池、行情同步、候选筛选、研究报告、决策记录和 AI 辅助，但前端根组件、客户端和 Quant 路由入口持续聚合新的业务流程。聚合文件扩大了修改半径，也让接口契约、异步状态和持久化边界难以独立验证。

本 change 以结构重构为目标，先把已有行为拆到清晰的模块边界，再继续扩展 Quant 能力。结构重构 MUST 保持现有 API 路径、响应 envelope、错误码、SSE 事件、D1 表结构和用户可见行为一致。

## What Changes

- 将 Quant API 路由入口收敛为组合根，按 workspace、research、decision、AI 和 market 领域拆分 handlers。
- 将路由中的业务编排、response presenter、D1 repository 和外部 provider 适配分别归位。
- 将 Quant 客户端拆为 HTTP transport、资源 API、运行时 payload parser 和领域类型模块。
- 将 Quant Vue 根组件拆为 router、shell、Pinia stores、feature views 和 feature components。
- 将大组件和全局样式按功能边界拆分，保留 Quant shell tokens 与共享 UI 组件。
- 为跨层边界增加契约 fixture、竞态/SSE 测试、D1 readback 和 Gateway 验证。

## Capabilities

### New Capabilities

本 change 是纯结构重构，行为能力保持现有实现；因此通过 `skip_specs: true` 跳过新增规格。

### Modified Capabilities

无。

## Impact

- `apps/api/src/routes/quant/index.ts` 及其测试组织。
- `apps/api/src/domain/quant/` 的 use case、repository、provider 和持久化 JSON parser 边界。
- `apps/quant-app/src/App.vue`、`src/api/` transport resources、`src/lib/quant-view-models.ts`、组件和样式。
- `packages/quant-contracts/`（计划新增）以及 `@starye/api-types` 的构建顺序。
- D1 migration、Gateway `/quant`、`/api/quant` 和 Better Auth session 行为保持当前契约。

## Scope Boundary

- 第一批切片覆盖 workspace 的 watchlist、candidates、sync，以及客户端 HTTP transport 边界。
- 研究、决策、AI、comparison 和大组件拆分随后按垂直切片推进。
- 当前阶段不引入新的业务字段、数据库表或 provider 能力。
