## Capability

集成 Swagger UI 提供交互式 API 文档界面，支持在线测试接口。

## Requirements

### R1: 集成 Swagger UI 中间件

必须集成 `@hono/swagger-ui` 包，提供文档界面 MUST

- 必须安装 `@hono/swagger-ui` 依赖 MUST
- 必须暴露 `/docs` 端点渲染 Swagger UI MUST
- Swagger UI 必须指向 `/openapi.json` 获取规范 MUST
- 界面必须支持中文显示（OpenAPI spec 包含中文描述）MUST

### R2: 界面功能完整性

Swagger UI 必须提供完整的交互式文档功能 MUST

- 必须支持浏览所有 API 端点 MUST
- 必须支持按 tags 分组显示 MUST
- 必须支持查看每个端点的详细信息（参数、响应、示例）MUST
- 必须支持"Try it out"功能，可在线测试接口 MUST
- 必须正确显示 Zod schema 转换后的类型（如 `oneOf`, `enum`）MUST

### R3: 认证支持（可选）

Swagger UI 应该支持认证测试（后续扩展）SHOULD

- 应该支持配置 API Key 认证 SHOULD
- 应该支持配置 Bearer Token 认证 SHOULD
- 应该支持在 UI 中输入认证凭证 SHOULD

### R4: 自定义配置

必须支持自定义 Swagger UI 的配置选项 MUST

- 必须支持配置 `url` 参数（OpenAPI spec 地址）MUST
- 应该支持配置 `docExpansion` 参数（展开级别）SHOULD
- 应该支持配置 `tryItOutEnabled` 参数（是否默认启用测试）SHOULD
- 应该支持自定义 CSS（可选）SHOULD

### R5: 性能优化

Swagger UI 的加载和渲染必须保持良好性能 MUST

- `/docs` 端点首次加载时间应 < 2 秒 SHOULD
- OpenAPI spec 解析时间应 < 500ms SHOULD
- 界面交互应流畅无卡顿 MUST

### R6: 开发体验

必须提供良好的开发者使用体验 MUST

- `/docs` 路径必须易记且符合行业惯例 MUST
- 文档必须在 README 中说明如何访问 MUST
- 应该在 API 根路径（`/`）提供链接跳转到 `/docs` SHOULD
- 错误信息必须清晰（如 OpenAPI spec 格式错误时）MUST

## Acceptance Criteria

### AC1: 基础集成验证

- [ ] 安装 `@hono/swagger-ui` 成功
- [ ] 访问 `/docs` 可正常加载 Swagger UI 界面
- [ ] 界面显示项目名称和版本（来自 OpenAPI spec 的 `info`）
- [ ] 界面正确显示中文描述

### AC2: 功能完整性验证

- [ ] 可以浏览所有 API 端点
- [ ] 端点按 `tags` 分组显示（如 Movies, Actors, Admin）
- [ ] 点击端点可查看详细信息（参数类型、描述、响应结构）
- [ ] "Try it out" 按钮可用
- [ ] 输入参数后可执行请求
- [ ] 显示真实的响应结果

### AC3: Schema 显示验证

- [ ] Zod `z.object()` 显示为 `object` 类型
- [ ] Zod `z.union()` 显示为 `oneOf`
- [ ] Zod `z.enum()` 显示为 `enum` 选项
- [ ] `.optional()` 字段标记为非必填
- [ ] `.default()` 显示默认值

### AC4: 认证支持验证（可选）

- [ ] 如果配置了 `security` schemes，Swagger UI 显示认证按钮
- [ ] 可以输入 API Key 或 Bearer Token
- [ ] 认证后的请求正确携带凭证

### AC5: 配置验证

- [ ] `url` 参数指向 `/openapi.json`
- [ ] （可选）`docExpansion` 设置为 `list`（默认折叠）
- [ ] （可选）`tryItOutEnabled` 设置为 `true`

### AC6: 性能验证

- [ ] 访问 `/docs` 页面加载时间 < 2 秒
- [ ] 切换不同端点响应流畅
- [ ] 执行"Try it out"响应时间正常（取决于 API 性能）

### AC7: 文档验证

- [ ] `apps/api/README.md` 中包含 Swagger UI 访问说明
- [ ] 说明中包含本地和生产环境的 URL
- [ ] 说明中提示如何使用"Try it out"功能

## Implementation Notes

### 基础实现

```typescript
// apps/api/src/index.ts

import { swaggerUI } from '@hono/swagger-ui'

// 添加 Swagger UI 端点
app.get('/docs', swaggerUI({ 
  url: '/openapi.json' 
}))

// 可选：在根路径提供跳转链接
app.get('/', (c) => {
  return c.html(`
    <html>
      <head><title>Starye API</title></head>
      <body>
        <h1>Starye API</h1>
        <p><a href="/docs">📖 View API Documentation</a></p>
        <p><a href="/openapi.json">📄 View OpenAPI Specification</a></p>
      </body>
    </html>
  `)
})
```

### 自定义配置示例

```typescript
app.get('/docs', swaggerUI({
  url: '/openapi.json',
  docExpansion: 'list',      // 默认折叠所有端点
  tryItOutEnabled: true,      // 默认启用测试按钮
  defaultModelsExpandDepth: 1 // Schema 展开深度
}))
```

### 认证配置（未来扩展）

```typescript
// 在 openAPISpecs 中配置 security
app.get('/openapi.json', openAPISpecs({
  documentation: {
    openapi: '3.1.0',
    info: { /* ... */ },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ]
  }
}))
```

### README 文档示例

```markdown
## API 文档

### 访问 Swagger UI

- **本地开发**: http://localhost:8787/docs
- **生产环境**: https://api.starye.com/docs

### 使用说明

1. 访问 `/docs` 端点打开 Swagger UI
2. 浏览左侧的 API 分组（Movies, Actors, Admin 等）
3. 点击任意端点查看详细信息
4. 点击"Try it out"按钮在线测试接口
5. 填写参数后点击"Execute"执行请求
6. 查看"Responses"部分的实际返回结果

### OpenAPI 规范

完整的 OpenAPI 3.1 规范可在 `/openapi.json` 查看。
```

### 已知限制

1. **Cloudflare Workers 限制**: Swagger UI 使用静态资源（JS/CSS），确保这些资源可正常加载
   - `@hono/swagger-ui` 已处理了资源加载问题
   
2. **中文显示**: Swagger UI 本身支持 Unicode，无需额外配置

3. **CORS**: 如果前端页面需要访问 `/docs`，确保 CORS 配置正确
   - 当前项目已有 `corsMiddleware()`，应该无问题

### 预期工作量

- 安装依赖和基础配置: 30 分钟
- 测试和验证: 1 小时
- 文档编写: 30 分钟
- **总计**: 2 小时

## Dependencies

- 依赖 `openapi-generation` capability（需要先有 `/openapi.json`）
- 依赖 `@hono/swagger-ui` npm 包
- 依赖项目现有的 CORS 配置
