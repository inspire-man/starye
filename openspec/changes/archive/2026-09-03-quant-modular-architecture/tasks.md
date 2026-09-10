## 1. Baseline and guardrails

- [x] 1.1 建立独立 change、目标目录和迁移顺序；完成标准：proposal、design、tasks 完整，`skip_specs` 仅用于纯结构重构。
- [x] 1.2 完成当前源码、GitNexus impact、路由矩阵和工作树基线；完成标准：记录聚合文件、直接调用者、风险和现有测试入口。
- [x] 1.3 增加 Quant 结构边界的 lint/review 规则；完成标准：route、api、feature、shared 的依赖方向可自动检查。

## 2. Workspace API slice

- [x] 2.1 抽取 workspace route handler；完成标准：watchlist、stock-basic、candidates、sync 的 URL、状态码、auth 和错误 envelope 保持一致。
- [x] 2.2 抽取 workspace use case/repository/provider 边界；完成标准：handler 不直接编排 D1/provider，既有 candidate/sync 公式和 user scope 测试通过。
- [x] 2.3 按 handler 拆分 Quant route tests；完成标准：route contract、CRUD、sync 和 candidate integration 覆盖保持，D1 authoritative readback 通过。

## 3. Quant client transport slice

- [x] 3.1 抽取 HTTP transport、错误转换和请求 identity 辅助模块；完成标准：`quantApi` 方法名与请求行为保持，客户端 parser 测试通过。
- [x] 3.2 按 workspace、market、research、decision、AI 拆分 resource clients/parsers；完成标准：snake_case 兼容、版本化 payload、SSE started/delta/completed/error 测试通过。
- [x] 3.3 迁移 `quant-types.ts` 为 transport DTO 与 UI view model；完成标准：组件不依赖 API 原始 envelope，类型检查通过。

## 4. Frontend shell and state

- [x] 4.1 引入 router、Pinia stores 和幂等 workspace 初始化；完成标准：hash 深链、刷新、选股和跨页面状态行为保持。
- [x] 4.2 将 Overview、Watchlist、Candidates、Knowledge、Research Detail、Comparison 拆为 feature views；完成标准：App shell 只保留布局和全局 drawer。
- [x] 4.3 迁移 loading、empty、error、cancel、stale response 和 mobile states；完成标准：组件测试与 Gateway 390px 检查通过。

## 5. Component and style decomposition

- [x] 5.1 拆分 AI briefing、research summary、decision assistant、recommendation 大组件；完成标准：每个组件职责单一，props/emits 契约可独立测试。
- [x] 5.2 按 feature 迁移 scoped CSS 和共享 Quant tokens；完成标准：style entry 只保留基础层和 imports，桌面/移动截图无布局回归。

## 6. Verification and cleanup

- [x] 6.1 增加跨 app contract fixtures 和 response schema/OpenAPI 对齐检查；完成标准：47 个 endpoint 的路径、输入、输出、状态码和错误 code 有矩阵覆盖。
- [x] 6.2 运行 API、Quant app、DB type-check、测试、build、OpenSpec strict 和 GitNexus detect_changes；完成标准：结果全绿，变更范围只覆盖 Quant 重构。
- [x] 6.3 通过 Gateway 验证匿名、普通用户、管理员、D1 readback、AI streaming、390px overflow 和浏览器 error/warn；完成标准：保留验收证据并更新 `.planning/STATE.md`。
