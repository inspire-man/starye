## ADDED Requirements

### Requirement: 自动生成 OpenAPI 3.0 规范

系统 SHALL 为所有 API 端点自动生成完整的 OpenAPI 3.0 规范文档，包括 request schemas、response schemas、security definitions 和 tags。MUST 通过 `openAPIRouteHandler` 在 `/openapi.json` 端点提供标准的 JSON 格式文档。

#### Scenario: 访问 OpenAPI 规范文档
- **WHEN** 用户访问 `GET /openapi.json`
- **THEN** 系统返回包含 `openapi: "3.0.0"`、`info`、`servers`、`paths` 和 `components` 的完整 JSON 文档

#### Scenario: Request schema 自动推导
- **WHEN** 路由使用 `validator('query', QuerySchema)` 定义验证
- **THEN** OpenAPI 文档的 `paths[path][method].parameters` 自动包含该 schema 定义，无需手动编写

#### Scenario: Response schema 定义
- **WHEN** 路由使用 `describeRoute()` 定义 responses 并使用 `resolver(ResponseSchema)`
- **THEN** OpenAPI 文档的 `paths[path][method].responses` 包含正确的 schema 引用和示例数据

### Requirement: Schema 引用与复用

系统 MUST 支持通过 `metadata({ ref: 'Name' })` 定义可复用的 schema 组件，SHALL 在生成的 OpenAPI 文档中使用 `$ref` 引用而非内联定义，以减少文档冗余。

#### Scenario: 定义可复用 schema
- **WHEN** schema 使用 `v.pipe(..., v.metadata({ ref: 'PaginationParams' }))`
- **THEN** OpenAPI 文档的 `components.schemas` 包含 `PaginationParams` 定义

#### Scenario: 引用复用 schema
- **WHEN** 多个端点使用同一个带 ref 的 schema
- **THEN** 各端点在 OpenAPI 文档中使用 `{ $ref: '#/components/schemas/PaginationParams' }` 引用，而非重复定义

### Requirement: Security Scheme 配置

系统 SHALL 在 OpenAPI 文档的 `components.securitySchemes` 中定义 Better Auth 的 cookie 认证方案，MUST 标记需要认证的 Admin 路由。

#### Scenario: Cookie 认证定义
- **WHEN** OpenAPI 文档生成
- **THEN** `components.securitySchemes` 包含 `cookieAuth` 定义（type: apiKey, in: cookie, name: better-auth.session_token）

#### Scenario: 受保护路由标记
- **WHEN** Admin 路由（如 `/admin/comics`）在 OpenAPI 文档中生成
- **THEN** 该路由的 `security` 字段包含 `[{ cookieAuth: [] }]`

### Requirement: Tags 与分组

系统 MUST 通过 `describeRoute()` 的 `tags` 字段为 API 端点分组，SHALL 在 OpenAPI 文档的 `tags` 顶层定义所有标签及其描述。

#### Scenario: 路由分组
- **WHEN** 路由定义 `describeRoute({ tags: ['Comics'] })`
- **THEN** OpenAPI 文档的 `paths[path][method].tags` 包含 `['Comics']`

#### Scenario: Tags 元信息
- **WHEN** OpenAPI 文档生成
- **THEN** `tags` 顶层数组包含 `{ name: 'Comics', description: '漫画相关接口' }` 等所有分组的元信息

### Requirement: OperationId 命名规范

系统 SHALL 为每个 API 端点生成唯一的 `operationId`，MUST 遵循 `{动词}{资源}{后缀}` 的命名规范（如 `getComicsList`、`createComic`）。

#### Scenario: 列表接口 operationId
- **WHEN** 定义 `GET /comics` 的 `describeRoute({ operationId: 'getComicsList' })`
- **THEN** OpenAPI 文档的 `paths['/comics'].get.operationId` 为 `getComicsList`

#### Scenario: 详情接口 operationId
- **WHEN** 定义 `GET /comics/:slug` 的 `describeRoute({ operationId: 'getComicDetail' })`
- **THEN** OpenAPI 文档的 `paths['/comics/{slug}'].get.operationId` 为 `getComicDetail`

### Requirement: Examples 与文档增强

系统 MUST 支持通过 Valibot 的 `.examples()` 方法为 schema 字段添加示例数据，SHALL 将这些示例包含在 OpenAPI 文档的 `examples` 字段中。

#### Scenario: Query 参数示例
- **WHEN** schema 定义 `v.pipe(v.string(), v.examples(['海贼王', 'one piece']))`
- **THEN** OpenAPI 文档的对应参数包含 `examples: ['海贼王', 'one piece']`

#### Scenario: Response 示例
- **WHEN** schema 通过 `.examples([{ id: 'cm001', title: '海贼王' }])` 定义
- **THEN** OpenAPI 文档的 response 包含完整的示例对象
