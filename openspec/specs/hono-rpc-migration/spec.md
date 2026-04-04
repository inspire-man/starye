# Hono RPC Migration

## Requirement: 所有前端 app 使用 Hono RPC Client
Dashboard、Movie App、Comic App、Blog MUST 使用 `hc<AppType>()` 创建类型安全的 API 客户端。手写的 API 类型定义和调用函数 MUST 被删除 SHALL。

### Scenario: Dashboard API 调用类型安全
- **WHEN** Dashboard 通过 `client.api.movies.$get({ query: { page: 1 } })` 调用 API
- **THEN** TypeScript 自动推导 query 参数类型和响应类型，无需手写 interface

### Scenario: Movie App 从 axios 迁移到 hc
- **WHEN** Movie App 将 `const { data } = await api.get('/public/movies', { params })` 替换为 `const res = await client.api.public.movies.$get({ query: params })`
- **THEN** 请求行为相同（含 credentials），且获得完整类型推导

### Scenario: Blog 页面使用 RPC Client
- **WHEN** Blog 的 `index.vue` 将 `useFetch('/api/posts', { baseURL })` 替换为 `useAsyncData(() => client.api.posts.$get({ query }).then(r => r.json()))`
- **THEN** 返回数据类型自动推导，无需手写 `ApiResponse<Post[]>`

## Requirement: 删除手写类型和 axios 依赖
以下文件 MUST 被删除：Dashboard 的 `lib/api.ts` 中的类型定义部分、Movie App 的 `types.ts` 和 `api.ts`、Comic App 的 `types.ts` 和 `api.ts`。Movie App 和 Comic App 的 `package.json` 中 `axios` 依赖 MUST 被移除 SHALL。

### Scenario: axios 完全移除
- **WHEN** 从 movie-app 和 comic-app 的 package.json 中移除 axios
- **THEN** `pnpm install` 后无 axios 残留，所有 API 调用通过 hono/client 的 fetch 实现

## Requirement: Auth API 调用保留独立实现
Better Auth 的端点（`/auth/get-session`、`/auth/sign-in/social`、`/auth/sign-out`）不走 Hono RPC 推导。各 app 的 auth 调用 MUST 使用 Better Auth 官方客户端或原生 fetch（非 axios），保持独立 SHALL。

### Scenario: Movie App auth 调用不依赖 axios
- **WHEN** 移除 axios 后 Movie App 的 authApi 模块改用原生 fetch
- **THEN** 登录、登出、获取会话功能正常工作

## Requirement: API 端 handler 返回类型明确
apps/api 中所有被 RPC 客户端调用的 handler MUST 具有明确的返回类型（不含 `any`），确保前端类型推导有效 SHALL。

### Scenario: handler 返回 any 时前端得到警告
- **WHEN** API 端某 handler 返回类型为 `any`
- **THEN** 迁移前的类型审计步骤识别并修复该 handler，使前端推导出具体类型
