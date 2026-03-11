## ADDED Requirements

### Requirement: 统一环境变量命名约定

所有前端应用（blog, comic, movie, auth, dashboard）MUST 使用统一的环境变量命名规范来配置 API 端点和服务地址。

#### Scenario: Nuxt 应用读取 API URL
- **WHEN** Nuxt 应用（blog/comic/movie/auth）启动时
- **THEN** 应用 SHALL 优先读取 `NUXT_PUBLIC_API_URL`，其次读取 `VITE_API_URL`，最后 fallback 到本地开发默认值 `http://localhost:8080`

#### Scenario: Vite 应用读取 API URL
- **WHEN** Vite 应用（dashboard）启动时
- **THEN** 应用 SHALL 读取 `VITE_API_URL`，fallback 到本地开发默认值 `http://localhost:8080`

#### Scenario: 生产环境部署
- **WHEN** 应用部署到生产环境
- **THEN** 应用 SHALL 从环境变量读取配置，fallback 值不得指向生产域名（避免本地开发误操作）

### Requirement: 统一 authClient 配置

所有前端应用的 `auth-client.ts` MUST 使用统一的 `baseURL` 配置逻辑，确保鉴权请求通过 Gateway。

#### Scenario: 本地开发环境配置 authClient
- **WHEN** 应用在本地开发环境运行（未设置环境变量）
- **THEN** `authClient.baseURL` SHALL 为 `http://localhost:8080/api/auth`（通过 Gateway）

#### Scenario: 生产环境配置 authClient
- **WHEN** 应用部署到生产环境且设置了 `NUXT_PUBLIC_API_URL` 或 `VITE_API_URL`
- **THEN** `authClient.baseURL` SHALL 为 `${apiUrl}/api/auth`

#### Scenario: authClient 不直接请求 API Worker
- **WHEN** 任何前端应用初始化 authClient
- **THEN** baseURL MUST NOT 直接指向 API Worker 的端口（如 `http://localhost:8787`），必须通过 Gateway

### Requirement: 提供 .env.example 模板

项目根目录或各应用目录 MUST 提供 `.env.example` 文件，明确列出本地开发所需的环境变量。

#### Scenario: 新开发者配置本地环境
- **WHEN** 新开发者克隆项目并需要配置本地环境
- **THEN** 项目 SHALL 提供 `.env.example` 文件，包含所有必需的环境变量及其说明和本地开发推荐值

#### Scenario: .env.example 包含完整配置
- **WHEN** 查看 `.env.example` 文件
- **THEN** 文件 SHALL 包含以下变量及说明：
  - `VITE_API_URL`: API 服务地址（本地开发建议 `http://localhost:8080`）
  - `NUXT_PUBLIC_API_URL`: Nuxt 应用 API 地址（同上）
  - 其他必需环境变量（如 R2_URL, ADMIN_URL 等）

### Requirement: 移除生产环境硬编码 fallback

nuxt.config.ts 和 vite.config.ts 中的 `runtimeConfig` MUST NOT 将生产环境域名作为 fallback 默认值。

#### Scenario: nuxt.config.ts 的 fallback 配置
- **WHEN** 检查 `apps/blog/nuxt.config.ts` 的 `runtimeConfig.public.apiUrl`
- **THEN** fallback 值 MUST 为本地开发地址（如 `http://localhost:8080`），不得为 `https://starye.org`

#### Scenario: auth-client.ts 的 fallback 配置
- **WHEN** 检查任何 `auth-client.ts` 中的 `apiUrl` 定义
- **THEN** fallback 值 MUST 为本地开发地址，不得为生产环境域名
