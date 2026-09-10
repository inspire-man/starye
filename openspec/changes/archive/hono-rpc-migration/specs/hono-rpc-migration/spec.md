## MODIFIED Requirements

### Requirement: 所有前端 app 使用 Hono RPC Client

Dashboard、Movie App、Comic App、Blog MUST 使用 `hc<AppType>()` 创建类型安全的 API 客户端，替换传统的 fetch 与 axios。手写的 API 类型定义和调用函数 MUST 被删除 SHALL。

#### Scenario: Dashboard API 调用类型安全
- **WHEN** Dashboard 通过 `client.api.admin.movies.$get({ query: { page: "1" } })` 调用 API
- **THEN** TypeScript 自动推导 query 参数类型和响应类型，并支持编辑器错误下划线提示与字段自补全。

#### Scenario: 应用移除旧 axios 依赖包
- **WHEN** Movie App 将原有的 axios 依赖与封装拦截器彻底剥离后
- **THEN** 所有与后端的非纯鉴权网络请求全盘经由生成的 `hono/client` 进行获取，包体积随之下降。

### Requirement: Auth API 调用保留独立实现

Better Auth 的端点（`/api/auth/**` 等由 SDK 接管的）不走 Hono RPC 推导。各 app 的 auth 调用 MUST 使用 Better Auth 官方客户端或通过统一挂载在原生 fetch 上运行，保持独立 SHALL。

#### Scenario: Movie App auth 调用独立
- **WHEN** 会话鉴权及登录/登出调用触发时
- **THEN** 必须通过 `authClient` 发起认证流（或相关封装），而非强行混杂纳入 `hc` 实例配置中引发冲突。

### Requirement: API 端 handler 返回类型明确

apps/api 中所有作为 RPC 服务暴露的 handler MUST 基于 `@hono/zod-openapi` 给出通过 `RouteConfig` 严谨声明过的返回结构（无隐性的 `any`），确保前端类型推导绝对强严谨。

#### Scenario: 返回与声明不匹配时的编译预警
- **WHEN** API 修改了 Zod 声明的 Reponse 为含有 `createdAt` 但 Handler 内部忘记吐出该字段时
- **THEN** Typescript 会在服务端直接抛出红色预警，禁止通过 CI 打包检查。
