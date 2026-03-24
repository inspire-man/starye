## Capability

使用 rhinobase/hono-openapi 中间件为 Hono API 自动生成 OpenAPI 3.1 规范。

## Requirements

### R1: 集成 hono-openapi 中间件

系统必须集成 rhinobase/hono-openapi 包，通过 `describeRoute()` 中间件为路由添加 OpenAPI 元数据 MUST

- 必须使用 v1.3.0 或更高版本（修复了路径参数泄漏 bug）MUST
- 必须通过 `openAPISpecs()` 函数生成 `/openapi.json` 端点 MUST
- 生成的规范必须符合 OpenAPI 3.1.0 标准 MUST

### R2: 保持 RPC 类型推导完整性

`describeRoute()` 中间件的添加不得破坏 Hono RPC 客户端的类型推导 MUST

- Dashboard 的 `hc<AppType>()` 必须能正确推导所有路由类型 MUST
- `apiClient.api.{module}.{endpoint}.$get()` 的自动补全必须正常工作 MUST
- TypeScript 编译不得出现类型错误 MUST

### R3: 支持 Zod schema 转换

必须正确将 Zod schema 转换为 OpenAPI JSON Schema MUST

- 必须支持 Zod v4.x 的所有常用类型（string, number, boolean, array, object）MUST
- 必须正确转换 `z.union()` 为 `oneOf` MUST
- 必须正确转换 `z.enum()` 为 `enum` MUST
- 必须正确处理 `.optional()`, `.default()`, `.nullable()` 等修饰符 MUST
- 必须通过 `resolver()` 函数包装 Zod schema 用于 OpenAPI MUST

### R4: 支持完整的路由描述

必须支持为路由定义完整的 OpenAPI 元数据 MUST

- 必须支持 `tags` 字段（用于路由分组）MUST
- 必须支持 `summary` 和 `description` 字段 MUST
- 必须支持 `request` 定义（query, params, body）MUST
- 必须支持 `responses` 定义（多状态码、多 content-type）MUST
- 必须支持 `deprecated` 标记（可选）SHOULD

### R5: 嵌套路由隔离

嵌套路由的 `describeRoute()` 元数据不得污染其他路由 MUST

- `/api/movies/actors` 的 tags 不得影响 `/api/actors` MUST
- 路径参数定义必须正确隔离 MUST
- 验证 v1.3.0 的 PR #225 修复是否生效 MUST

### R6: 文档端点配置

必须提供 OpenAPI 规范的访问端点和配置能力 MUST

- 必须暴露 `/openapi.json` 端点返回完整规范 MUST
- 必须支持配置 `info` 对象（title, version, description）MUST
- 必须支持配置 `servers` 数组（production, development 等）MUST
- 应该支持配置全局 `security` 定义（可选）SHOULD

## Acceptance Criteria

### AC1: 基础集成验证

- [ ] 安装 `hono-openapi` 包成功
- [ ] `/openapi.json` 端点可访问
- [ ] 返回的 JSON 符合 OpenAPI 3.1.0 规范
- [ ] `info.title` 和 `info.version` 显示正确

### AC2: RPC 兼容性验证

- [ ] Dashboard 的 `hc<AppType>()` 编译无错误
- [ ] 类型自动补全正常（`apiClient.api.movies.$get`）
- [ ] 运行时 API 调用成功
- [ ] 添加 `describeRoute()` 前后对比无差异

### AC3: Schema 转换验证

- [ ] Zod `z.object()` 转换为 OpenAPI `object` 类型
- [ ] Zod `z.union([z.enum(...), z.literal('')])` 转换为 `oneOf`
- [ ] Zod `.optional()` 生成 `required: false`
- [ ] Zod `.default()` 生成 `default` 字段

### AC4: 路由元数据验证

- [ ] 为测试路由添加 `describeRoute({ tags: ['Test'], summary: '...' })`
- [ ] OpenAPI spec 包含该路由的 `tags` 和 `summary`
- [ ] `request.query` 的 schema 正确显示
- [ ] `responses.200` 的 schema 正确显示

### AC5: 嵌套路由隔离验证

- [ ] 为 `/api/movies/actors` 添加 `tags: ['Movies', 'Actors']`
- [ ] 为 `/api/actors` 添加 `tags: ['Actors']`
- [ ] 验证两个路由的 tags 不会互相影响
- [ ] 验证路径参数定义正确

### AC6: 文档端点配置验证

- [ ] `/openapi.json` 包含配置的 `servers` 数组
- [ ] `info` 对象包含 title, version, description
- [ ] 所有路由都在 `paths` 对象中

## Implementation Notes

### 技术选型理由

选择 rhinobase/hono-openapi 而非官方 `@hono/zod-openapi` 的原因：
- ✅ 中间件模式不改变路由类型链，完全兼容 RPC
- ✅ 支持 Zod v4（官方方案有已知问题）
- ✅ 社区活跃，持续维护
- ⚠️ 第三方依赖，需关注维护状态

### 关键风险

1. **Zod v4 兼容性**: 最新版本（v1.3.0）刚支持 Zod v4，可能有边界情况
   - 缓解：POC 阶段充分测试 union types, 复杂嵌套等场景
   
2. **路径参数泄漏**: Issue #119 报告的 bug，v1.3.0 已修复但需验证
   - 缓解：POC 测试嵌套路由的隔离性

3. **第三方维护风险**: 作者停更或有重大 bug
   - 缓解：代码开源可 fork，核心逻辑简单易维护

### 使用示例

```typescript
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1)
})

const responseSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
  meta: z.object({ total: z.number() })
})

app.get(
  '/movies',
  describeRoute({
    tags: ['Movies'],
    summary: '获取电影列表',
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: resolver(responseSchema)
          }
        }
      }
    }
  }),
  zValidator('query', querySchema),
  handler
)
```

## Dependencies

- 依赖 `hono` 的方法链路由模式（已在 `api-hono-rpc-refactor` 中完成）
- 依赖 `@hono/zod-validator` 进行参数验证
- 依赖 `zod` v4.3.6+
