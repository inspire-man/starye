## Context

Quant 当前已经存在按能力拆分的 domain 文件、Vue 子组件和纯函数测试，但三个入口仍是聚合点：`App.vue` 同时承载页面状态与模板，`api-client.ts` 同时承载 transport、解析和资源方法，`routes/quant/index.ts` 同时承载路由、业务编排、持久化读写和 response view。目标是形成单向依赖，而不是简单增加文件数量。

## Target Boundaries

### Frontend

`app` 只负责启动、router 和 shell；`features` 负责页面与用户流程；`stores` 负责跨页面状态和请求 identity；`api` 负责 HTTP 与 payload parsing；`shared` 负责可复用展示/格式化能力。

组件通过 props/emits 接收状态和动作，组件内保留表单、局部展开和展示状态。原始 `fetch` 只允许出现在 `api` transport 层。现有的 `QuantApiError`、SSE cancellation、过期响应保护和历史 payload 兼容规则迁移后保持语义一致。

第一阶段使用 Vue Router 承接当前 hash 深链，使用 Pinia 保存 workspace、candidate、research 和 comparison 的跨视图状态。迁移期间由 store 提供幂等初始化，避免路由切换重复请求。

### API

`routes/quant/index.ts` 只保留认证、错误处理和子路由挂载。handlers 读取已校验的 param/query/json，并调用 use case。use case 负责跨 repository/provider 的流程编排。repository 只负责 D1。provider adapter 只负责外部数据和错误归一化。presenter 负责持久化记录到 transport DTO 的转换。

路由领域划分：

- workspace：watchlist、sync、stock-basic、candidates。
- market：daily、valuation、financial、shareholder-returns、value-selection。
- research：markers、runs、summary、question、change-explanation、comparison、audits。
- decision：decision assistant、decision records、queue、outcome。
- AI：AI config、candidate briefing、candidate sessions、factor config。

第一阶段先抽 workspace handler；它只复用现有 repository、provider、sync 和 candidate 计算逻辑，不改变业务公式。

### Contracts

先建立响应 fixture 和 endpoint matrix，再逐步把 `apps/api/src/schemas/quant.ts` 迁移到按领域组织的契约模块。跨 app 的 transport DTO、Valibot schema 和 SSE event 进入 `packages/quant-contracts`；后端 domain model 与前端 view model 保持独立。

现有 response key、snake_case 请求字段、camelCase 响应字段、`success/data` envelope、错误 code 和 research report v1/v2 兼容形状都作为测试锁定。结构重构阶段保持 D1 migration 数量为 0。

### Dependency Rules

- route handler -> use case -> repository/provider。
- frontend feature -> store/composable -> api resource -> HTTP transport。
- domain 不依赖 Vue、DOM 或 Quant 页面组件。
- shared 不依赖 feature。
- UI 组件不直接创建 URL、解析 response 或访问 D1 类型。

通过 TypeScript path aliases、ESLint restricted imports 和 review checklist 固化上述方向。

## Migration Strategy

1. 写入 fixture、route matrix、OpenSpec task 和现有行为基线。
2. 抽取 workspace route handler，并在 index 中挂载子 router。
3. 抽取客户端 HTTP transport，保留 `quantApi` 对外方法名；随后按资源迁移 parser/method。
4. 把 workspace 加载和选择逻辑迁入 store，再拆 Overview、Watchlist、Candidates 页面。
5. 按 research、decision、AI、comparison 继续垂直迁移。
6. 迁移大组件与 CSS，最后移除旧聚合实现和临时导出。

每个切片都先运行定向单测和 type-check，再运行 Quant 全量测试、build、OpenSpec strict、GitNexus detect_changes，最后经 Gateway 做浏览器和 D1 readback 验证。

## Risks

- `requestJson` 共享 47 个客户端方法，GitNexus upstream impact 为 CRITICAL；先移动 transport，再按资源逐块迁移。
- 研究/AI 流程依赖 request identity、SSE 事件顺序和历史报告版本；每个切片保留 out-of-order、cancel、old-report fixture。
- Hono RPC 类型来自 API build 产物，新增共享契约时同步验证 `@starye/api-types` 构建顺序。
- router/store 引入后可能改变初始化次数和 hash 深链；保留现有 URL 语义并补导航回归。
- CSS 从全局迁移到 scoped 后可能改变 Teleport drawer 的 token 继承；使用 Quant shell token 和桌面/390px 截图回归。
