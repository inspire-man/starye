# Spec: 认证客户端配置

## ADDED Requirements

### Requirement: 客户端使用正确的环境变量访问方式

所有应用的 `auth-client.ts` 文件 **SHALL** 使用 `import.meta.env.VITE_API_URL` 访问 API URL，确保在浏览器环境中正确读取。

#### Scenario: Auth 应用 auth-client.ts 配置
- **WHEN** 查看 `apps/auth/app/lib/auth-client.ts`
- **THEN** 代码 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 代码 **SHALL NOT** 使用 `process.env.NUXT_PUBLIC_API_URL`
- **AND** 代码 **SHALL NOT** 使用 `process.env.VITE_API_URL`

#### Scenario: Comic 应用 auth-client.ts 配置
- **WHEN** 查看 `apps/comic/app/lib/auth-client.ts`
- **THEN** 代码 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 代码 **SHALL NOT** 使用 `process.env.*`

#### Scenario: Blog 应用 auth-client.ts 配置
- **WHEN** 查看 `apps/blog/app/lib/auth-client.ts`
- **THEN** 代码 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 代码 **SHALL** 保持现有正确配置不变

#### Scenario: Movie 应用 auth-client.ts 配置
- **WHEN** 查看 `apps/movie/app/lib/auth-client.ts`
- **THEN** 代码 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 代码 **SHALL** 保持现有正确配置不变

#### Scenario: Dashboard 应用 auth-client.ts 配置
- **WHEN** 查看 `apps/dashboard/src/lib/auth-client.ts`
- **THEN** 代码 **SHALL** 使用 `import.meta.env.VITE_API_URL`
- **AND** 代码 **SHALL** 保持现有正确配置不变

---

### Requirement: 默认 API URL 降级逻辑

所有 `auth-client.ts` **SHALL** 提供默认的 API URL，当环境变量未设置时使用本地开发环境的 Gateway 地址。

#### Scenario: 环境变量未设置时的默认值
- **WHEN** 环境变量 `VITE_API_URL` 未设置
- **THEN** `apiUrl` **SHALL** 使用默认值 `'http://localhost:8080'`

#### Scenario: 环境变量设置时优先使用
- **WHEN** 环境变量 `VITE_API_URL` 设置为 `'https://starye.org'`
- **THEN** `apiUrl` **SHALL** 使用 `'https://starye.org'`

---

### Requirement: Better Auth 客户端正确初始化

所有 `auth-client.ts` **SHALL** 使用正确的 API URL 初始化 Better Auth 客户端。

#### Scenario: Better Auth baseURL 配置
- **WHEN** 查看任意 `auth-client.ts` 文件
- **THEN** `createAuthClient` **SHALL** 使用 `${apiUrl}/api/auth` 作为 `baseURL`

#### Scenario: 生产环境 Better Auth 请求地址
- **WHEN** 生产环境中调用 `authClient.useSession()`
- **THEN** 请求 **SHALL** 发送到 `https://starye.org/api/auth/get-session`
- **AND** 请求 **SHALL NOT** 发送到 `http://localhost:8080/api/auth/get-session`

#### Scenario: 开发环境 Better Auth 请求地址
- **WHEN** 本地开发环境中调用 `authClient.useSession()`
- **THEN** 请求 **SHALL** 发送到 `http://localhost:8080/api/auth/get-session`

---

### Requirement: 导出的认证方法

所有 `auth-client.ts` **SHALL** 导出 Better Auth 提供的核心认证方法。

#### Scenario: 必需方法导出
- **WHEN** 查看任意 `auth-client.ts` 文件
- **THEN** 文件 **SHALL** 导出 `signIn` 方法
- **AND** 文件 **SHALL** 导出 `signUp` 方法
- **AND** 文件 **SHALL** 导出 `signOut` 方法
- **AND** 文件 **SHALL** 导出 `useSession` 方法或函数

#### Scenario: authClient 实例导出（可选）
- **WHEN** 查看任意 `auth-client.ts` 文件
- **THEN** 文件 **MAY** 导出 `authClient` 实例，供高级用法使用

---

### Requirement: TypeScript 类型安全

所有 `auth-client.ts` **SHALL** 提供正确的 TypeScript 类型定义。

#### Scenario: useSession 返回类型
- **WHEN** 应用使用 `useSession()` 方法
- **THEN** 返回值 **SHALL** 具有正确的类型定义
- **AND** TypeScript 编译 **SHALL** 无类型错误

#### Scenario: ExtendedSession 类型（如有）
- **WHEN** 应用定义了 `ExtendedSession` 类型
- **THEN** `useSession()` **SHALL** 返回符合 `ExtendedSession` 的类型
