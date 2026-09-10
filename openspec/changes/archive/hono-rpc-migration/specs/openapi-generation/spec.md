## ADDED Requirements

### Requirement: 自动生成 OpenAPI 3.0 规范与可视文档

系统 SHALL 为所有采用 `@hono/zod-openapi` 构建的端点自动生成符合 OpenAPI 规范的文档。MUST 提供可直观互动的 Swagger UI，以便进行 API 测试与前后台联调。

#### Scenario: 访问 Swagger 可视化页面
- **WHEN** 开发者以浏览器 GET 访问 `/api/swagger`（或等价挂载点）
- **THEN** 系统响应解析好的 OpenAPI UI，开发者可在页面中看到各路由及入参出参数据结构，并能在线发起请求测试。

#### Scenario: Zod Schema 转 OpenAPI Schema
- **WHEN** 开发者在路由定义中使用 `z.object({ id: z.string().openapi({ example: "123" }) })`
- **THEN** OpenAPI 文档将自动收集提取该定义并在 Swagger UI 中将该参数标注为必填并自带 example 数据。

### Requirement: 响应与错误类型的标准化 (Zod)

系统 MUST 建立可复用的标准 Zod 错误与响应 Schema，并在各类受重构的路由里做复用，降低模板代码量。

#### Scenario: 使用统一的分页 Schema
- **WHEN** 多个列表接口都需要分页参数时引入 `PaginationQuerySchema`
- **THEN** 在不同端点的 OpenAPI 结构中，自动且一致地展现出 page, limit 等请求参数的说明与默认值。
