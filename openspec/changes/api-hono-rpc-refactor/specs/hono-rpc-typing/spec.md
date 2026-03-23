## ADDED Requirements

### Requirement: 路由必须使用方法链模式

路由定义 MUST 使用 Hono 的方法链模式（`.get().post().patch()`），确保类型推导完整性。禁止使用命令式的 `app.get()` 后再导出的方式。

#### Scenario: 路由使用方法链定义

- **WHEN** 定义路由模块（如 `moviesRoutes`）
- **THEN** MUST 使用 `new Hono<AppEnv>().get(...).post(...)` 的链式语法
- **THEN** 每个路由方法 MUST 返回 Hono 实例以支持继续链式调用

#### Scenario: 禁止命令式路由定义

- **WHEN** 定义路由模块
- **THEN** 禁止使用以下模式：
  ```typescript
  const app = new Hono()
  app.get('/path', handler)  // ❌ 类型推导断裂
  export default app
  ```

---

### Requirement: 导出完整的 AppType

主应用 (`apps/api/src/index.ts`) MUST 导出完整的 `AppType` 类型，包含所有子路由的类型信息。

#### Scenario: 导出 AppType 类型

- **WHEN** 在 `index.ts` 中组合所有路由
- **THEN** MUST 使用 `export type AppType = typeof app` 导出类型
- **THEN** `app` MUST 是所有路由链式调用后的最终对象

#### Scenario: 类型推导完整性验证

- **WHEN** Dashboard 使用 `hc<AppType>()`
- **THEN** SHALL 能够推导出所有路由的请求参数类型
- **THEN** SHALL 能够推导出所有路由的响应体类型

---

### Requirement: 创建类型共享包

MUST 创建 `packages/api-types` 包，用于跨应用共享 API 类型。

#### Scenario: 创建 api-types 包

- **WHEN** 创建 `packages/api-types`
- **THEN** `package.json` MUST 包含 `"exports": { ".": "./src/index.ts" }`
- **THEN** `src/index.ts` MUST re-export `apps/api` 的 `AppType`

#### Scenario: Dashboard 引入 API 类型

- **WHEN** Dashboard 需要使用 API 类型
- **THEN** MUST 通过 `import type { AppType } from '@starye/api-types'` 引入
- **THEN** 类型检查 MUST 能够检测到 API 接口变更

---

### Requirement: Handler 函数必须解耦 HTTP 上下文

所有 Handler 函数 MUST 从 Hono Context 中提取参数后，将业务逻辑委托给 Services 层。

#### Scenario: Handler 层职责

- **WHEN** 定义 Handler 函数（如 `getMovieList`）
- **THEN** MUST 仅包含以下职责：
  - 解析请求参数（query/params/body）
  - 调用 Services 层函数
  - 格式化响应（`c.json()`）
  - 处理 HTTP 异常（`HTTPException`）
- **THEN** 禁止在 Handler 中直接调用数据库（必须通过 Services）

#### Scenario: Handler 参数传递

- **WHEN** Handler 调用 Service 函数
- **THEN** MUST 传递纯数据类型参数（如 `db`、`options` 对象）
- **THEN** 禁止传递 `Context` 对象到 Services 层

---

### Requirement: 类型安全的 RPC 客户端

Dashboard MUST 能够使用 Hono Client (`hc`) 创建类型安全的 API 客户端。

#### Scenario: 创建 RPC 客户端

- **WHEN** Dashboard 初始化 API 客户端
- **THEN** MUST 使用 `hc<AppType>(baseUrl)` 创建客户端
- **THEN** 客户端方法 MUST 具备完整的类型推导

#### Scenario: 调用 API 接口

- **WHEN** Dashboard 调用 `client.movies.$get({ query: { page: 1 } })`
- **THEN** TypeScript MUST 检查 `query` 参数的类型正确性
- **THEN** 响应体 MUST 自动推导为对应接口的返回类型

#### Scenario: 类型错误检测

- **WHEN** Dashboard 传递错误的参数类型
- **THEN** TypeScript 编译 MUST 报错
- **THEN** IDE MUST 提供自动补全和错误提示
