## Capability

建立统一的 API Schema 组织和管理规范，确保 1000+ 行 Schema 定义的可维护性。

## Requirements

### R1: 三层目录结构

必须建立 `schemas/` 目录，按职责分为三层 MUST

- 必须创建 `schemas/common/` 存放通用响应模板 MUST
- 必须创建 `schemas/entities/` 存放领域实体 Schema MUST
- 路由模块必须在各自目录下创建 `route-schemas.ts` 文件 MUST

### R2: 通用响应模板

必须实现可复用的响应 Schema 构建函数 MUST

- 必须实现 `dataResponse<T>(schema)` 包装单对象响应 MUST
- 必须实现 `paginatedResponse<T>(itemSchema)` 生成分页响应 MUST
- 必须实现 `errorResponse` 定义错误响应结构 MUST
- 必须实现 `commonErrorResponses` 常量对象（400, 403, 404, 500）MUST
- 必须实现 `withCommonErrors(successResponses, errorCodes)` 合并响应 MUST

### R3: 实体 Schema 管理

实体 Schema 必须集中定义在 `schemas/entities/` 目录 MUST

- 每个实体必须有独立的 `.schema.ts` 文件 MUST
- 必须导出完整实体 Schema（如 `movieSchema`）MUST
- 必须导出列表精简版（如 `movieListItemSchema`）MUST
- 应该导出详情扩展版（如 `movieDetailSchema`，含关联数据）SHOULD
- 实体 Schema 不得包含路由逻辑 MUST

### R4: 路由 Schema 组织

路由专属 Schema 必须定义在 `routes/{module}/route-schemas.ts` MUST

- 必须定义请求参数 Schema（query, params, body）MUST
- 必须定义响应 Schema（组合 entities 和 common 模板）MUST
- 必须导出完整的 `RouteConfig` 对象（可直接用于 `describeRoute()`）MUST
- 路由 Schema 文件必须保持简洁（每个路由 15-30 行）MUST

### R5: 命名规范

所有 Schema 和配置对象必须遵循统一的命名规范 MUST

**Entity Schema 命名**:
- `{entity}Schema` - 完整实体（如 `movieSchema`）MUST
- `{entity}ListItemSchema` - 列表项精简版（如 `movieListItemSchema`）MUST
- `{entity}DetailSchema` - 详情含关联（如 `movieDetailSchema`）MUST

**Route Schema 命名**:
- `{route}{Action}QuerySchema` - 查询参数（如 `movieListQuerySchema`）MUST
- `{route}{Action}ParamsSchema` - 路径参数（如 `movieDetailParamsSchema`）MUST
- `{route}{Action}BodySchema` - 请求体（如 `movieCreateBodySchema`）MUST
- `{route}{Action}ResponseSchema` - 响应（如 `movieListResponseSchema`）MUST

**Route Config 命名**:
- `{route}{Action}RouteConfig` - describeRoute 配置（如 `movieListRouteConfig`）MUST

### R6: DRY 原则

必须避免重复定义，充分利用辅助函数 MUST

- 禁止在多个路由中重复定义相同的错误响应结构 MUST
- 必须使用 `withCommonErrors()` 合并通用错误 MUST
- 必须使用 `dataResponse()` 和 `paginatedResponse()` 构建响应 MUST
- 实体 Schema 必须复用，不得在路由中重复定义实体字段 MUST

### R7: 文档注释

所有 Schema 文件必须包含 JSDoc 注释 MUST

- 每个导出的 Schema 必须有注释说明用途 MUST
- 复杂 Schema 必须注明使用场景和示例 MUST
- 通用模板必须说明参数含义和返回值 MUST

## Acceptance Criteria

### AC1: 目录结构验证

- [ ] `apps/api/src/schemas/` 目录存在
- [ ] `apps/api/src/schemas/common/` 目录存在
- [ ] `apps/api/src/schemas/entities/` 目录存在
- [ ] 至少一个路由模块有 `route-schemas.ts` 文件

### AC2: 通用模板验证

- [ ] `schemas/common/responses.ts` 文件存在
- [ ] `dataResponse<T>()` 函数可用且返回正确结构
- [ ] `paginatedResponse<T>()` 函数可用且返回正确结构
- [ ] `withCommonErrors()` 函数正确合并响应
- [ ] 所有函数都有 JSDoc 注释

### AC3: 实体 Schema 验证

- [ ] `schemas/entities/movie.schema.ts` 存在
- [ ] 导出 `movieSchema`, `movieListItemSchema`, `movieDetailSchema`
- [ ] Schema 定义完整（包含所有必要字段）
- [ ] 有 JSDoc 注释说明用途

### AC4: 路由 Schema 验证

- [ ] `routes/movies/route-schemas.ts` 存在
- [ ] 导出至少一个 QuerySchema
- [ ] 导出至少一个 ResponseSchema
- [ ] 导出至少一个 RouteConfig
- [ ] 路由 Schema 复用了 entities 和 common 模板

### AC5: 命名规范验证

- [ ] 所有 Schema 命名符合规范（手动检查或通过 lint）
- [ ] 没有不符合规范的命名（如 `getMoviesQuery` 应为 `movieListQuerySchema`）
- [ ] RouteConfig 以 `RouteConfig` 结尾

### AC6: DRY 原则验证

- [ ] 搜索代码中没有重复定义的错误响应结构
- [ ] 所有路由都使用 `withCommonErrors()` 而非手动定义
- [ ] 实体字段没有在路由 Schema 中重复定义

### AC7: 文档注释验证

- [ ] 每个导出的 Schema 都有 JSDoc 注释
- [ ] 通用模板的注释包含使用示例
- [ ] 复杂 Schema 的注释说明了使用场景

## Implementation Notes

### 文件结构示例

```
apps/api/src/
├── schemas/
│   ├── common/
│   │   ├── responses.ts        (~80 行)
│   │   │   export dataResponse<T>()
│   │   │   export paginatedResponse<T>()
│   │   │   export errorResponse
│   │   │   export commonErrorResponses
│   │   │   export withCommonErrors()
│   │   │
│   │   ├── pagination.ts       (~20 行)
│   │   │   export paginationMeta
│   │   │
│   │   └── errors.ts           (可选，未来扩展)
│   │
│   └── entities/
│       ├── movie.schema.ts     (~100 行)
│       │   export movieSchema
│       │   export movieListItemSchema
│       │   export movieDetailSchema
│       │
│       ├── actor.schema.ts     (~80 行)
│       ├── publisher.schema.ts (~70 行)
│       └── comic.schema.ts     (~90 行)
│
└── routes/
    ├── movies/
    │   ├── index.ts            (路由定义)
    │   ├── route-schemas.ts    (~150 行)
    │   │   export movieListQuerySchema
    │   │   export movieListResponseSchema
    │   │   export movieListRouteConfig
    │   │   export movieDetailParamsSchema
    │   │   export movieDetailResponseSchema
    │   │   export movieDetailRouteConfig
    │   │   // ... 其他 8 个路由
    │   │
    │   ├── handlers/
    │   └── services/
    │
    └── actors/
        ├── index.ts
        ├── route-schemas.ts    (~80 行)
        └── ...
```

### 通用模板实现示例

```typescript
// schemas/common/responses.ts

/**
 * 通用成功响应 - 包装单个对象
 * 
 * @example
 * const response = dataResponse(movieSchema)
 * // 生成: { data: Movie }
 */
export const dataResponse = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ data: schema })

/**
 * 分页列表响应
 * 
 * @example
 * const response = paginatedResponse(movieListItemSchema)
 * // 生成: { data: Movie[], meta: { total, page, pageSize } }
 */
export const paginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: paginationMeta
  })

/**
 * 合并通用错误响应
 * 
 * @example
 * const responses = withCommonErrors(
 *   { 200: { ... } },
 *   [403, 404, 500]
 * )
 * // 生成: { 200: {...}, 403: {...}, 404: {...}, 500: {...} }
 */
export function withCommonErrors<T extends Record<number, any>>(
  successResponses: T,
  errorCodes: Array<400 | 403 | 404 | 500> = [500]
) {
  const errors = Object.fromEntries(
    errorCodes.map(code => [code, commonErrorResponses[code]])
  )
  return { ...successResponses, ...errors }
}
```

### 预期工作量

- 创建通用模板: 2-3 小时
- 创建实体 Schema (4 个核心实体): 4-5 小时
- 创建路由 Schema (50+ 路由): 每个路由 20 分钟 = 16-20 小时
- **总计**: 22-28 小时（约 3-4 天）

## Dependencies

- 依赖 Zod v4.3.6+ 的类型系统
- 依赖 `hono-openapi` 的 `resolver()` 函数
- 依赖项目现有的路由结构
