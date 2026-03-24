## Context

当前 `apps/api` 的技术栈：
- **框架**: Hono（已完成 RPC 重构，使用方法链模式）
- **验证**: @hono/zod-validator（部分路由已使用，部分路由手动验证）
- **Schema 库**: Zod v4.3.6
- **运行环境**: Cloudflare Workers
- **RPC 客户端**: Dashboard 使用 `hc<AppType>()` 进行类型安全调用

**关键约束**：
- RPC 类型推导不能被破坏（这是核心需求）
- 不能使用 `@hono/zod-openapi`（已知与 RPC 存在兼容性问题）
- 需要为所有 50+ 路由添加文档（不能部分覆盖）
- 代码组织需考虑长期维护（1000+ 行 Schema 定义）

## Goals / Non-Goals

**Goals:**
- 为所有 API 路由生成完整的 OpenAPI 3.1 规范
- 提供 Swagger UI 交互式文档界面
- 建立统一的 Schema 管理规范，避免重复定义
- 确保 RPC 客户端的类型推导完全不受影响
- 支持渐进式迁移（POC → 核心 API → 全量）

**Non-Goals:**
- 不修改现有 API 的业务逻辑
- 不重写路由定义（仅添加 `describeRoute` 中间件）
- 不自动从代码生成文档（手动定义 Schema 更精确）
- 不支持 API 版本控制（当前只有一个版本）

## Decisions

### 决策 1: 使用 rhinobase/hono-openapi 中间件方案

**问题**: 如何在不破坏 RPC 的前提下生成 OpenAPI 文档？

**方案对比**:

| 方案 | RPC 兼容性 | 代码侵入性 | 成熟度 |
|------|-----------|-----------|-------|
| @hono/zod-openapi | ⚠️ 有已知问题 | 高（需重写路由） | ✅ 官方 |
| rhinobase/hono-openapi | ✅ 完全兼容 | 低（加中间件） | 🟡 第三方 |
| 自研反向生成 | ✅ 完全兼容 | 无 | ⚠️ 需从零开发 |

**决定**: 采用 **rhinobase/hono-openapi**

**理由**:
- ✅ `describeRoute()` 是纯中间件，不改变 Hono 的类型链
- ✅ 支持 Zod v4 和多种验证库
- ✅ 社区活跃（755 stars，持续维护）
- ✅ 最新版本（v1.3.0）修复了路径参数泄漏等关键 bug
- ⚠️ 风险：第三方维护，如有阻塞问题需提 issue 给作者

---

### 决策 2: 混合式 Schema 组织结构

**问题**: 如何组织 1000+ 行的 Schema 定义，避免维护噩梦？

**决定**: 采用三层结构

```
apps/api/src/
├── schemas/                        (全局共享 Schema)
│   ├── common/                     (通用模板)
│   │   ├── responses.ts            (dataResponse, paginatedResponse)
│   │   ├── pagination.ts           (分页元数据)
│   │   └── errors.ts               (错误响应 + commonErrorResponses)
│   └── entities/                   (领域实体)
│       ├── movie.schema.ts         (movieSchema, movieListItemSchema, movieDetailSchema)
│       ├── actor.schema.ts
│       ├── publisher.schema.ts
│       ├── comic.schema.ts
│       └── user.schema.ts
│
└── routes/                         (路由模块)
    ├── movies/
    │   ├── index.ts                (路由定义 + describeRoute)
    │   ├── route-schemas.ts        (路由专属：query/params/response schemas)
    │   ├── handlers/
    │   └── services/
    └── actors/
        ├── index.ts
        ├── route-schemas.ts
        └── ...
```

**职责划分**:
- `schemas/common`: 可复用的模板（成功/错误响应、分页结构）
- `schemas/entities`: 领域对象的完整定义（Movie, Actor 等）
- `routes/*/route-schemas.ts`: 路由特定的请求参数和响应组合

**命名规范**:
```
Entity Schema:
- {entity}Schema              (完整实体)
- {entity}ListItemSchema      (列表项精简版)
- {entity}DetailSchema        (详情含关联数据)

Route Schema:
- {route}{Action}QuerySchema  (查询参数)
- {route}{Action}ParamsSchema (路径参数)
- {route}{Action}BodySchema   (请求体)
- {route}{Action}ResponseSchema (响应)

Route Config:
- {route}{Action}RouteConfig  (describeRoute 配置对象)
```

**理由**:
- ✅ 实体 Schema 集中管理，便于复用
- ✅ 路由 Schema 就近放置，改动范围明确
- ✅ 通用模板避免重复代码（DRY 原则）
- ✅ 清晰的命名规范降低认知负担

---

### 决策 3: Response Schema 的定义策略

**问题**: 现有代码有多种响应模式，如何统一？

**现状分析**:
```typescript
// 模式 1: 分页列表
return c.json(result)  // { data: [], meta: { total, page, ... } }

// 模式 2: 单对象包装
return c.json({ data: movie })

// 模式 3: 单对象直接返回
return c.json(actor)

// 模式 4: 错误响应
return c.json({ error: '...' }, 500)
```

**决定**: 使用辅助函数统一定义

```typescript
// schemas/common/responses.ts

export const dataResponse = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ data: schema })

export const paginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number()
    })
  })

export const errorResponse = z.object({
  error: z.string()
})

// 通用错误响应（可直接复用）
export const commonErrorResponses = {
  400: { description: 'Bad Request', content: { 'application/json': { schema: errorResponse } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: errorResponse } } },
  404: { description: 'Not Found', content: { 'application/json': { schema: errorResponse } } },
  500: { description: 'Internal Server Error', content: { 'application/json': { schema: errorResponse } } }
}

// 辅助函数：合并成功响应和错误响应
export function withCommonErrors<T>(
  successResponses: T,
  errorCodes: Array<400 | 403 | 404 | 500> = [500]
) {
  const errors = Object.fromEntries(
    errorCodes.map(code => [code, commonErrorResponses[code]])
  )
  return { ...successResponses, ...errors }
}
```

**使用示例**:
```typescript
// routes/movies/route-schemas.ts
import { movieListItemSchema } from '../../schemas/entities/movie.schema'
import { paginatedResponse, withCommonErrors } from '../../schemas/common/responses'
import { resolver } from 'hono-openapi/zod'

export const movieListResponseSchema = paginatedResponse(movieListItemSchema)

export const movieListRouteConfig = {
  tags: ['Movies'],
  summary: '获取电影列表',
  responses: withCommonErrors({
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: resolver(movieListResponseSchema)
        }
      }
    }
  }, [500])  // 只需要 500 错误
}
```

**理由**:
- ✅ 一次定义，到处复用
- ✅ 减少重复代码（每个路由节省 10-15 行）
- ✅ 统一错误响应格式
- ✅ 便于未来调整（如添加新的通用字段）

---

### 决策 4: POC 验证流程

**问题**: 如何在全量迁移前验证方案可行性？

**决定**: 三阶段验证

**Phase 1: 基础设施（1-2 天）**
```
[ ] 安装依赖
    - hono-openapi
    - @hono/swagger-ui
    
[ ] 创建目录结构
    - schemas/common/
    - schemas/entities/
    
[ ] 实现通用模板
    - responses.ts
    - 示例 entity schema (movie.schema.ts)
```

**Phase 2: POC 验证（1 天）**
```
[ ] 为 health 路由添加文档（最简单）
[ ] 为 movies 的 2 个路由添加完整文档
    - GET /movies (分页列表，包含 query 验证)
    - GET /movies/:identifier (详情)
    
[ ] 验证关键问题
    - /openapi.json 生成是否正确
    - Swagger UI 是否可用
    - RPC 类型推导是否正常（Dashboard 测试）
    - Zod union types 是否正确转换
    - 嵌套路由 tags 是否冲突
    
[ ] 输出 POC 报告
    - 兼容性评估
    - 工作量估算
    - 风险清单
```

**Phase 3: 全量迁移（按 POC 结果决定）**

**理由**:
- ✅ 降低风险，及早发现阻塞问题
- ✅ POC 失败可快速回滚，成本低
- ✅ 验证真实场景（分页、参数验证、错误处理）

---

### 决策 5: 渐进式迁移优先级

**问题**: 50+ 路由如何安排迁移顺序？

**决定**: 按业务重要性分组

```
P0 (核心 Public API，优先):
- health
- movies (8 个路由)
- actors (2 个路由)
- publishers (2 个路由)

P1 (公开 API):
- public/movies (2 个路由)
- public/comics (3 个路由)
- public/progress (2 个路由)

P2 (管理 API):
- admin/* (20+ 个路由)

P3 (其他):
- auth, upload, posts
```

**理由**:
- ✅ 核心 API 先完成，外部开发者优先受益
- ✅ 管理 API 内部使用，可后置
- ✅ 每组独立可测，可随时暂停

---

## Risks / Trade-offs

### 风险 1: rhinobase/hono-openapi 有阻塞 bug

**风险**: POC 验证时发现 Zod v4 兼容性问题或其他 bug

**缓解措施**:
- POC 阶段充分测试复杂场景（union types, 嵌套路由）
- 遇到问题提 issue 给作者（项目活跃，响应快）
- Plan B: 如果等待修复时间过长，考虑暂时回退到 Zod v3 或自研工具

---

### 风险 2: Response Schema 与实际响应不一致

**风险**: 手动定义 Schema 可能与 handler 实际返回值不匹配

**缓解措施**:
- 开发环境启用 Zod 的 `.parse()` 验证响应
- 添加 TypeScript 类型断言（handler 返回值需符合 schema）
- E2E 测试覆盖关键路径

---

### 风险 3: 路径参数泄漏（已知 bug）

**风险**: rhinobase/hono-openapi 的 Issue #119 提到嵌套路由的 `describeRoute` 可能污染其他路由

**现状**: 已在 v1.3.0 修复（PR #225）

**缓解措施**:
- 确保使用 v1.3.0+
- POC 阶段测试嵌套路由（如 `/api/movies/actors` vs `/api/actors`）
- 为每个路由使用唯一的 tags 组合

---

### 权衡 1: 手动定义 Schema 的工作量

**权衡**: 1000-1500 行 Schema 定义需要投入 1-2 周时间

**收益**:
- ✅ 精确的文档（比自动生成更准确）
- ✅ 长期可维护（代码即文档，不会过期）
- ✅ 类型安全（TypeScript + Zod 双重保障）
- ✅ 外部开发者体验提升（完整的 Swagger UI）

**结论**: 收益远大于成本，值得投入

---

### 权衡 2: 第三方依赖风险

**权衡**: rhinobase/hono-openapi 不是官方方案，有维护风险

**缓解**:
- 项目活跃（755 stars, 最近一周有更新）
- 代码开源，可 fork 维护
- 核心逻辑简单，易于理解
- 官方 `@hono/zod-openapi` 未来可能修复 RPC 问题，届时可迁移

---

## Migration Plan

### 部署步骤

**Step 1: 基础设施搭建**（不影响现有功能）
```bash
# 1. 安装依赖
pnpm add hono-openapi @hono/swagger-ui -F api

# 2. 创建目录结构
mkdir apps/api/src/schemas/{common,entities}

# 3. 实现通用模板
# - schemas/common/responses.ts
# - schemas/common/pagination.ts
# - schemas/common/errors.ts
```

**Step 2: POC 验证**（隔离验证，可回滚）
```typescript
// apps/api/src/index.ts (新增端点)
import { openAPISpecs } from 'hono-openapi'
import { swaggerUI } from '@hono/swagger-ui'

app.get('/openapi.json', openAPISpecs({
  documentation: {
    openapi: '3.1.0',
    info: { title: 'Starye API', version: '1.0.0' }
  }
}))

app.get('/docs', swaggerUI({ url: '/openapi.json' }))
```

**Step 3: 全量迁移**（按优先级分组）
- 每完成一组路由，提交一次 commit
- 每个 commit 独立可测
- 遇到问题可回滚到上一个工作状态

### 回滚策略

- **Phase 1 失败**: 删除 `schemas/` 目录和依赖，无影响
- **Phase 2 失败**: 移除 POC 路由的 `describeRoute()`，保留基础设施
- **Phase 3 失败**: 按 commit 回滚，已完成的路由保留

### 验证检查点

**POC 阶段**:
- [ ] `/openapi.json` 可访问且格式正确
- [ ] `/docs` Swagger UI 可用
- [ ] Dashboard `hc<AppType>()` 类型推导正常
- [ ] Zod union types 正确转换为 `oneOf`
- [ ] 嵌套路由的 tags 不冲突

**全量迁移后**:
- [ ] 所有路由都有 `describeRoute()`
- [ ] OpenAPI spec 包含所有端点
- [ ] Swagger UI 可测试所有接口
- [ ] E2E 测试通过

---

## Open Questions

1. **是否需要为 response 添加示例数据（examples）？**  
   → 建议暂不添加，优先完成基础文档，后续按需补充

2. **是否需要为 admin API 添加 security schemes（JWT/Session）？**  
   → 建议 Phase 3 考虑，当前先完成基础文档

3. **如果 rhinobase/hono-openapi 有严重 bug 无法修复，是否切换到官方方案？**  
   → 根据 POC 结果决定，如果阻塞严重且作者响应慢，考虑等待官方修复或自研工具
